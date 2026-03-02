/* eslint-disable no-console */
const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const multer = require('multer');
const AdmZip  = require('adm-zip');
const compression = require('compression');

const app = express();
app.use(compression()); // gzip all responses

// ── Security headers ────────────────────────────────────────────────────────
// Prevents MIME-sniffing, clickjacking and basic XSS attacks with minimal
// overhead (pure in-process, no extra dependencies).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: allow same-origin + trusted CDNs (PDF.js, feather-icons, Google Fonts).
  // worker-src blob: is required for the PDF.js web worker spawned via a blob URL.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://api.anilist.co https://api.mangaupdates.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "worker-src blob: 'self'; " +
    "frame-ancestors 'self'"
  );
  next();
});

app.use(express.json({ limit: "5mb" }));

// When bundled as .exe (pkg), __dirname is the virtual snapshot root.
// User-writable data (store, cache, downloads) must live next to the exe.
const IS_PKG = typeof process.pkg !== 'undefined';
const USER_ROOT  = IS_PKG ? path.dirname(process.execPath) : __dirname;
const DATA_DIR   = path.join(USER_ROOT, "data");
// User-writable sources dir — drop/replace .js files here to update scrapers
// without rebuilding the exe. Seeded from snapshot on first run.
const SOURCES_DIR = path.join(DATA_DIR, "sources");
// Bundled snapshot sources — read-only fallback baked into the exe
const SNAP_SOURCES_DIR = path.join(__dirname, "data", "sources");
const STORE_PATH  = path.join(DATA_DIR, "store.json");
const CACHE_DIR   = path.join(DATA_DIR, "cache");
const LOCAL_DIR   = path.join(DATA_DIR, "local");
const TMP_DIR     = path.join(DATA_DIR, "tmp");
const PORT = process.env.PORT || 3000;

const reposCache = new Map();
// Per-module require() cache — avoids re-parsing source files on every API call.
// Cleared on install/uninstall so stale code is never served.
const sourceCache = new Map();
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 500 * 1024 * 1024 } });

// In-memory store cache — eliminates read/write race conditions.
// All requests read from and write to this object; disk is only
// used for persistence (written after every mutation).
let _store = null;

function safeId(id) {
  if (typeof id !== "string") return null;
  return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : null;
}

// Whitelist the fields we actually store for a manga object so that
// client-supplied payloads cannot inject arbitrary keys into the store
// (prototype pollution, oversized blobs, etc.)
function safeManga(manga) {
  if (!manga || typeof manga !== 'object') return {};
  const str  = (v, max = 300) => String(v ?? '').slice(0, max);
  const arr  = (v) => (Array.isArray(v) ? v.map(x => str(x, 100)).slice(0, 50) : []);
  return {
    id:          str(manga.id, 100),
    title:       str(manga.title),
    cover:       str(manga.cover, 500),
    author:      str(manga.author),
    description: str(manga.description, 1000),
    status:      str(manga.status, 50),
    url:         str(manga.url, 500),
    genres:      arr(manga.genres),
    type:        str(manga.type, 20),
  };
}

function sha1Short(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 12);
}

async function ensureDirs() {
  for (const dir of [DATA_DIR, SOURCES_DIR, CACHE_DIR, LOCAL_DIR, TMP_DIR]) {
    await fsp.mkdir(dir, { recursive: true });
  }
  // Seed user sources dir from bundled snapshot on first run (or when a file is missing).
  // Users can then edit/replace these files to update sources without rebuilding the exe.
  if (IS_PKG && fs.existsSync(SNAP_SOURCES_DIR)) {
    for (const file of fs.readdirSync(SNAP_SOURCES_DIR).filter(f => f.endsWith('.js'))) {
      const dest = path.join(SOURCES_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(SNAP_SOURCES_DIR, file), dest);
        console.log(`✦ Seeded source: ${file}`);
      }
    }
  }
  if (!fs.existsSync(STORE_PATH)) {
    await fsp.writeFile(
      STORE_PATH,
      JSON.stringify({ repos: [], installedSources: {}, history: [], favorites: [] }, null, 2),
      "utf8"
    );
  }
}

async function readStore() {
  if (!_store) {
    // Fallback: read from disk (should normally only run at startup via initStore)
    const raw = await fsp.readFile(STORE_PATH, "utf8");
    _store = JSON.parse(raw);
    normaliseStore(_store);
  }
  return _store;
}

async function writeStore(store) {
  _store = store; // update in-memory cache synchronously so concurrent reads see the new state
  debouncedFlush();
}

// Debounced disk writes — coalesces rapid mutations into a single write.
let _flushTimer = null;
function debouncedFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(async () => {
    _flushTimer = null;
    try {
      await fsp.writeFile(STORE_PATH, JSON.stringify(_store, null, 2), "utf8");
    } catch (e) {
      console.error("Store write error:", e.message);
    }
  }, 300);
}

// Force-flush on shutdown
function flushStoreSync() {
  if (_store) {
    try { fs.writeFileSync(STORE_PATH, JSON.stringify(_store, null, 2), "utf8"); }
    catch (e) { console.error("Shutdown flush error:", e.message); }
  }
}
process.on('SIGINT',  () => { flushStoreSync(); process.exit(0); });
process.on('SIGTERM', () => { flushStoreSync(); process.exit(0); });

async function initStore() {
  if (!fs.existsSync(STORE_PATH)) return;
  const raw = await fsp.readFile(STORE_PATH, "utf8");
  _store = JSON.parse(raw);
  normaliseStore(_store); // run once at startup, not on every readStore() call
}

// Migrate / fill missing fields — runs once at startup only.
function normaliseStore(s) {
  s.repos = Array.isArray(s.repos) ? s.repos.map(r => ({
    ...r,
    kind: r.kind || "jsrepo",
    name: r.name || r.url
  })) : [];
  s.installedSources = s.installedSources || {};
  s.history          = s.history          || [];
  s.favorites        = s.favorites        || [];
  s.readingStatus    = s.readingStatus    || {};
  s.reviews          = s.reviews          || {};
  s.customLists      = s.customLists      || [];
  s.analytics        = s.analytics || {
    totalChaptersRead: 0,
    totalTimeSpent: 0,
    readingSessions: [],
    dailyStreak: 0,
    lastReadDate: null
  };
  s.achievements = s.achievements || [];
}

async function fetchJson(url) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// ── SSRF guard — reject URLs that resolve to private / loopback addresses ──
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i;
function isSafeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/\[|\]/g, ''); // strip IPv6 brackets
    return !PRIVATE_IP_RE.test(host) && host !== 'localhost';
  } catch { return false; }
}

function sourcePath(id) {
  // Prefer user-filesystem version so sources can be updated without rebuilding exe
  const userPath = path.join(SOURCES_DIR, `${id}.js`);
  // Confinement: resolved path must stay inside SOURCES_DIR or SNAP_SOURCES_DIR
  const resolvedUser = path.resolve(userPath);
  const inSources = resolvedUser.startsWith(path.resolve(SOURCES_DIR) + path.sep);
  if (inSources && fs.existsSync(resolvedUser)) return resolvedUser;
  // Fall back to bundled snapshot (pkg only)
  if (IS_PKG) {
    const snapPath = path.resolve(path.join(SNAP_SOURCES_DIR, `${id}.js`));
    if (snapPath.startsWith(path.resolve(SNAP_SOURCES_DIR) + path.sep) && fs.existsSync(snapPath)) return snapPath;
  }
  return userPath; // will throw naturally if not found
}

function loadSourceFromFile(id) {
  // Return cached module if already loaded
  if (sourceCache.has(id)) return sourceCache.get(id);
  const p = sourcePath(id);
  if (!fs.existsSync(p)) throw new Error("Source not found");
  // Clear require cache so a freshly dropped file is picked up
  try { delete require.cache[require.resolve(p)]; } catch (_) {}
  const mod = require(p);
  if (!mod?.meta?.id) throw new Error("Invalid source: missing meta.id");
  if (typeof mod.search !== "function") throw new Error("Source missing search()");
  if (typeof mod.mangaDetails !== "function") throw new Error("Source missing mangaDetails()");
  if (typeof mod.chapters !== "function") throw new Error("Source missing chapters()");
  if (typeof mod.pages !== "function") throw new Error("Source missing pages()");
  sourceCache.set(id, mod);
  return mod;
}

function detectRepoKind(data) {
  if (data?.sources && Array.isArray(data.sources)) return "jsrepo";
  if (Array.isArray(data)) return "tachiyomi";
  if (data?.extensions && Array.isArray(data.extensions)) return "tachiyomi";
  return "unknown";
}

async function getRepoDataWithCache(repo, ttl = 3600000) {
  const cached = reposCache.get(repo.url);
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }
  if (repo.url.startsWith("localrepo:")) return { sources: [] };
  try {
    const data = await fetchJson(repo.url);
    reposCache.set(repo.url, { data, time: Date.now() });
    return data;
  } catch (e) {
    console.warn(`Erro ao carregar ${repo.url}:`, e.message);
    return cached?.data || {};
  }
}

async function listAvailableSourcesFromRepos(repos) {
  const sources = [];
  for (const repo of repos) {
    try {
      const data = await getRepoDataWithCache(repo);
      const kind = repo.kind || detectRepoKind(data);
      if (kind === "jsrepo" && data.sources) {
        for (const s of data.sources) {
          if (s?.id && s?.name && s?.version && s?.codeUrl && safeId(s.id)) {
            sources.push({
              kind: "js",
              installable: true,
              repoUrl: repo.url,
              repoName: repo.name,
              id: s.id,
              name: s.name,
              version: s.version,
              codeUrl: s.codeUrl,
              author: s.author || "",
              icon: s.icon || ""
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Erro repo ${repo.url}:`, e.message);
    }
  }
  return sources;
}

async function autoInstallLocalSources() {
  const store = await readStore();
  // Collect unique IDs from both locations; user filesystem takes priority over snapshot
  const seen = new Set();
  const allIds = [];
  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const id = f.replace('.js', '');
      if (!seen.has(id)) { seen.add(id); allIds.push(id); }
    }
  };
  scanDir(SOURCES_DIR);                    // user filesystem (hot-swappable)
  if (IS_PKG) scanDir(SNAP_SOURCES_DIR);  // bundled fallback
  for (const id of allIds) {
    if (store.installedSources[id]) continue;
    try {
      const mod = loadSourceFromFile(id);
      store.installedSources[id] = {
        id,
        name: mod.meta.name || id,
        version: mod.meta.version || "1.0.0",
        author: mod.meta.author || "Local",
        icon: mod.meta.icon || "",
        installedAt: new Date().toISOString()
      };
      console.log(`✓ Auto-instalada: ${mod.meta.name}`);
    } catch (e) {
      console.warn(`⚠ Erro ao auto-instalar ${id}:`, e.message);
    }
  }
  await writeStore(store);
}

// ============================================================================
// IMAGE PROXY (used by sources whose CDN requires a specific Referer)
// ============================================================================
app.get("/api/proxy-image", async (req, res) => {
  const { url, ref } = req.query;
  // Validate: must be a public http/https URL (SSRF guard)
  if (!url || !isSafeUrl(url)) return res.status(400).end();
  // Validate referer origin too
  const safeRef = (ref && isSafeUrl(ref)) ? ref : undefined;
  try {
    const imgRes = await fetch(url, {
      headers: {
        "Referer": safeRef || "https://mangapill.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    // Restrict to known image MIME types — prevents upstream from serving
    // HTML/JS through this proxy endpoint (content-type confusion attack).
    const upstreamCt = imgRes.headers.get("content-type") || "";
    const ALLOWED_IMAGE_CT = /^image\/(jpeg|png|gif|webp|avif|bmp|svg\+xml)/i;
    if (!ALLOWED_IMAGE_CT.test(upstreamCt)) return res.status(415).end();
    res.set("Content-Type", upstreamCt.split(";")[0].trim());
    res.set("Cache-Control", "public, max-age=86400");
    Readable.fromWeb(imgRes.body).pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

// ============================================================================
// EXISTING ENDPOINTS
// ============================================================================

app.get("/api/state", async (req, res) => {
  try {
    const store = await readStore();
    const available = await listAvailableSourcesFromRepos(store.repos);
    res.json({ repos: store.repos, availableSources: available, installedSources: store.installedSources });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/repos", async (req, res) => {
  try {
    const { url, repoJson } = req.body || {};
    let repoData, kind, repoUrl;
    if (typeof url === "string" && url.startsWith("http")) {
      repoData = await fetchJson(url);
      repoUrl = url;
    } else if (repoJson) {
      repoData = repoJson;
      repoUrl = `localrepo:${sha1Short(JSON.stringify(repoData))}`;
    } else {
      return res.status(400).json({ error: "URL ou JSON inválido" });
    }
    kind = detectRepoKind(repoData);
    if (kind === "unknown") return res.status(400).json({ error: "Formato de repo não reconhecido" });
    const store = await readStore();
    if (!store.repos.some(r => r.url === repoUrl)) {
      const name = repoData?.name || (kind === "tachiyomi" ? "Tachiyomi Repo" : repoUrl);
      store.repos.push({ url: repoUrl, name, kind });
      await writeStore(store);
    }
    res.json({ ok: true, kind });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/repos", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL obrigatória" });
    const store = await readStore();
    store.repos = store.repos.filter(r => r.url !== url);
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sources/install", async (req, res) => {
  try {
    const { id } = req.body || {};
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "ID inválido" });
    const store = await readStore();
    const available = await listAvailableSourcesFromRepos(store.repos);
    const source = available.find(s => s.id === sid);
    if (!source) return res.status(404).json({ error: "Source não encontrado" });
    if (source.kind !== "js") return res.status(400).json({ error: "Source não compatível" });
    if (!isSafeUrl(source.codeUrl)) return res.status(400).json({ error: "URL de source inválida" });
    const code = await fetchText(source.codeUrl);
    await fsp.writeFile(sourcePath(sid), code, "utf8");
    sourceCache.delete(sid); // invalidate module cache so fresh code is loaded
    _popularAllCache = null;  // invalidate popular-all cache so new source appears
    const mod = loadSourceFromFile(sid);
    store.installedSources[sid] = {
      id: sid,
      name: mod.meta.name || source.name,
      version: mod.meta.version || source.version,
      author: mod.meta.author || source.author || "",
      icon: mod.meta.icon || source.icon || "",
      installedAt: new Date().toISOString()
    };
    await writeStore(store);
    res.json({ ok: true, installed: store.installedSources[sid] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sources/uninstall", async (req, res) => {
  try {
    const { id } = req.body || {};
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "ID inválido" });
    const store = await readStore();
    delete store.installedSources[sid];
    await writeStore(store);
    sourceCache.delete(sid); // clear module cache
    _popularAllCache = null;  // invalidate popular-all cache
    const p = sourcePath(sid);
    if (fs.existsSync(p)) await fsp.unlink(p);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// LOCAL MANGA — Virtual source endpoints (must be before generic handler)
// ============================================================================
app.use('/local-media', express.static(LOCAL_DIR));

app.post('/api/source/local/search', (_req, res) => {
  res.json({ results: [], hasNextPage: false });
});

app.post('/api/source/local/mangaDetails', async (req, res) => {
  try {
    const { mangaId } = req.body;
    const sid = safeId(mangaId);
    if (!sid) return res.status(400).json({ error: 'Invalid ID' });
    const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    res.json({ id: meta.id, title: meta.title, cover: meta.cover,
      description: meta.description || 'Local manga', status: 'completed',
      genres: meta.genres || [], author: meta.author || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/source/local/chapters', async (req, res) => {
  try {
    const { mangaId } = req.body;
    const sid = safeId(mangaId);
    if (!sid) return res.status(400).json({ error: 'Invalid ID' });
    const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    res.json({
      chapters: meta.chapters.map((ch, i) => ({
        id: ch.id, name: ch.name, chapter: String(i + 1),
        date: ch.date || new Date().toISOString()
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/source/local/pages', async (req, res) => {
  try {
    const { chapterId } = req.body;
    const lastColon = String(chapterId).lastIndexOf(':');
    if (lastColon < 0) return res.status(400).json({ error: 'Invalid chapterId' });
    const mangaId = chapterId.slice(0, lastColon);
    const chIndex = parseInt(chapterId.slice(lastColon + 1), 10);
    const sid = safeId(mangaId);
    if (!sid) return res.status(400).json({ error: 'Invalid ID' });
    const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    const chapter = meta.chapters[chIndex];
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    if (chapter.isPDF) {
      res.json({ isPDF: true, pdfUrl: chapter.pdfUrl, pages: [] });
    } else {
      res.json({ pages: chapter.pages.map(img => ({ img })) });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// LOCAL MANGA — Import / List / Delete
// ============================================================================
app.get('/api/local/list', async (_req, res) => {
  try {
    if (!fs.existsSync(LOCAL_DIR)) return res.json({ localManga: [] });
    const dirs = await fsp.readdir(LOCAL_DIR);
    const localManga = [];
    for (const dir of dirs) {
      const metaPath = path.join(LOCAL_DIR, dir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
          localManga.push({ id: meta.id, title: meta.title, cover: meta.cover, type: meta.type, sourceId: 'local' });
        } catch (_) {}
      }
    }
    res.json({ localManga });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Serve the best available thumbnail for a local manga
app.get('/api/local/:mangaId/thumb', async (req, res) => {
  try {
    const sid = safeId(req.params.mangaId);
    if (!sid) return res.status(400).end();
    const mangaDir = path.join(LOCAL_DIR, sid);
    // 1. cover.jpg
    const coverJpg = path.join(mangaDir, 'cover.jpg');
    if (fs.existsSync(coverJpg)) return res.redirect(`/local-media/${sid}/cover.jpg`);
    // 2. first image in images/
    const imagesDir = path.join(mangaDir, 'images');
    if (fs.existsSync(imagesDir)) {
      const files = (await fsp.readdir(imagesDir))
        .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (files.length) return res.redirect(`/local-media/${sid}/images/${files[0]}`);
    }
    res.status(404).end();
  } catch (e) { res.status(500).end(); }
});

app.post('/api/local/:mangaId/cover', express.raw({ type: 'image/*', limit: '5mb' }), async (req, res) => {
  try {
    const sid = safeId(req.params.mangaId);
    if (!sid) return res.status(400).json({ error: 'Invalid ID' });
    const mangaDir = path.join(LOCAL_DIR, sid);
    const metaPath = path.join(mangaDir, 'meta.json');
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
    const coverPath = path.join(mangaDir, 'cover.jpg');
    await fsp.writeFile(coverPath, req.body);
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    meta.cover = `/local-media/${sid}/cover.jpg`;
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    res.json({ success: true, cover: meta.cover });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/local/:mangaId', async (req, res) => {
  try {
    const sid = safeId(req.params.mangaId);
    if (!sid) return res.status(400).json({ error: 'Invalid ID' });
    const mangaDir = path.join(LOCAL_DIR, sid);
    if (fs.existsSync(mangaDir)) await fsp.rm(mangaDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/local/import', upload.single('file'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const origName = req.file.originalname || 'manga';
    const ext = path.extname(origName).toLowerCase();
    const titleBase = (req.body.title || path.basename(origName, path.extname(origName)))
      .replace(/[_\-]+/g, ' ').trim() || 'Local Manga';
    if (!['.cbz', '.cbr', '.pdf'].includes(ext))
      return res.status(400).json({ error: 'Unsupported format. Use CBZ, CBR or PDF.' });

    const mangaId  = `local-${sha1Short(titleBase + Date.now())}`;
    const mangaDir = path.join(LOCAL_DIR, mangaId);
    const imagesDir = path.join(mangaDir, 'images');
    await fsp.mkdir(imagesDir, { recursive: true });

    let pages = [], chapterIsPDF = false, pdfUrl = '';

    if (ext === '.pdf') {
      const destPdf = path.join(mangaDir, 'original.pdf');
      await fsp.copyFile(tmpPath, destPdf);
      chapterIsPDF = true;
      pdfUrl = `/local-media/${mangaId}/original.pdf`;
    } else {
      let extracted = false;
      // Try as ZIP (CBZ and fake CBR)
      try {
        const zip = new AdmZip(tmpPath);
        const entries = zip.getEntries()
          .filter(e => !e.isDirectory && /\.(jpe?g|png|gif|webp)$/i.test(e.entryName))
          .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));
        if (entries.length > 0) {
          for (const [i, entry] of entries.entries()) {
            // Sanitise extension — only allow known image types so a crafted
            // ZIP cannot write executable files (e.g. .php, .js) to the images dir.
            const rawExt = path.extname(entry.name).toLowerCase();
            const imgExt = /^\.(jpe?g|png|gif|webp)$/.test(rawExt) ? rawExt.replace('jpeg','jpg') : '.jpg';
            const filename = String(i + 1).padStart(4, '0') + imgExt;
            await fsp.writeFile(path.join(imagesDir, filename), entry.getData());
            pages.push(`/local-media/${mangaId}/images/${filename}`);
          }
          extracted = true;
        }
      } catch (_) {}

      if (!extracted) {
        // True RAR — use node-unrar-js (WASM)
        const { createExtractorFromData } = await import('node-unrar-js');
        const buffer = await fsp.readFile(tmpPath);
        const extractor = await createExtractorFromData({ data: buffer.buffer });
        const list = extractor.getFileList();
        const imageHeaders = [...list.fileHeaders]
          .filter(h => /\.(jpe?g|png|gif|webp)$/i.test(h.fileHeader.name))
          .sort((a, b) => a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true, sensitivity: 'base' }));
        if (imageHeaders.length === 0)
          return res.status(400).json({ error: 'No images found in CBR/RAR file.' });
        const extractedFiles = [...extractor.extract({ files: imageHeaders.map(h => h.fileHeader.name) }).files];
        for (const [i, file] of extractedFiles.entries()) {
          // Same extension allowlist as the ZIP path above
          const rawExt = path.extname(file.fileHeader.name).toLowerCase();
          const imgExt = /^\.(jpe?g|png|gif|webp)$/.test(rawExt) ? rawExt.replace('jpeg','jpg') : '.jpg';
          const filename = String(i + 1).padStart(4, '0') + imgExt;
          await fsp.writeFile(path.join(imagesDir, filename), Buffer.from(file.extraction));
          pages.push(`/local-media/${mangaId}/images/${filename}`);
        }
      }
      if (pages.length === 0)
        return res.status(400).json({ error: 'No images found in the file.' });
    }

    const cover = pages[0] || (chapterIsPDF ? pdfUrl : '');
    const meta = {
      id: mangaId, title: titleBase, cover, type: ext.slice(1),
      sourceId: 'local', description: `Imported on ${new Date().toLocaleDateString()}`,
      genres: [], author: '',
      chapters: [{ id: `${mangaId}:0`, name: titleBase,
        date: new Date().toISOString(), isPDF: chapterIsPDF,
        pdfUrl: pdfUrl || null, pages: chapterIsPDF ? [] : pages }]
    };
    await fsp.writeFile(path.join(mangaDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
    res.json({ success: true, manga: { id: meta.id, title: meta.title, cover: meta.cover, type: meta.type, sourceId: 'local' } });
  } catch (e) {
    console.error('Local import error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    if (tmpPath) fsp.unlink(tmpPath).catch(() => {});
  }
});

// ============================================================================
// GENERIC SOURCE HANDLER
// ============================================================================
app.post("/api/source/:id/:method", async (req, res) => {
  try {
    const { id, method } = req.params;
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "ID inválido" });
    const mod = loadSourceFromFile(sid);
    if (typeof mod[method] !== "function") return res.status(400).json({ error: "Método não existe" });
    const { query, page, mangaId, chapterId, genres, orderBy } = req.body || {};
    let result;
    if (method === "search")         result = await mod.search(query || "", Number(page) || 1, orderBy || "");
    else if (method === "mangaDetails")  result = await mod.mangaDetails(mangaId || "");
    else if (method === "chapters")      result = await mod.chapters(mangaId || "");
    else if (method === "pages")         result = await mod.pages(chapterId || "");
    else if (method === "trending")      result = await mod.trending();
    else if (method === "recentlyAdded") result = await mod.recentlyAdded();
    else if (method === "latestUpdates") result = await mod.latestUpdates();
    else if (method === "byGenres")      result = await mod.byGenres(genres || [], orderBy || "");
    else if (method === "authorSearch")  result = await mod.authorSearch(req.body?.authorName || "");
    else return res.status(400).json({ error: "Método não suportado" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// All-sources popular: fetch trending from every installed source in parallel
// Short-lived in-process cache for /api/popular-all — avoids hammering every
// installed source on every home-screen visit. TTL: 60 s.
let _popularAllCache = null; // { ts: number, data: object }
const POPULAR_ALL_TTL = 60_000;

app.get("/api/popular-all", async (req, res) => {
  try {
    // Serve from cache if still fresh
    if (_popularAllCache && Date.now() - _popularAllCache.ts < POPULAR_ALL_TTL) {
      return res.json(_popularAllCache.data);
    }

    const store = await readStore();
    const sourceIds = Object.keys(store.installedSources || {});
    if (!sourceIds.length) return res.json({ results: [] });

    const settled = await Promise.allSettled(
      sourceIds.map(async sid => {
        const mod = loadSourceFromFile(sid);
        if (typeof mod.trending !== "function") return [];
        const r = await mod.trending();
        return (r.results || []).map(m => ({ ...m, sourceId: sid, sourceName: store.installedSources[sid]?.name || sid }));
      })
    );

    // Merge results interleaving sources (zip), dedupe by title (case-insensitive)
    const buckets = settled.filter(s => s.status === "fulfilled").map(s => s.value);
    const seen = new Set();
    const merged = [];
    const maxLen = Math.max(...buckets.map(b => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (i < bucket.length) {
          const key = (bucket[i].title || "").trim().toLowerCase();
          if (!seen.has(key)) { seen.add(key); merged.push(bucket[i]); }
        }
      }
    }
    const response = { results: merged.slice(0, 40) };
    _popularAllCache = { ts: Date.now(), data: response };
    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/library/add", async (req, res) => {
  try {
    const { mangaId, sourceId, manga } = req.body || {};
    const store = await readStore();
    const existing = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    const safeEntry = { ...safeManga(manga), sourceId, addedAt: new Date().toISOString() };
    if (existing >= 0) {
      store.favorites[existing] = safeEntry;
    } else {
      store.favorites.push(safeEntry);
    }
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/library/remove", async (req, res) => {
  try {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    store.favorites = store.favorites.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/history/add", async (req, res) => {
  try {
    const { mangaId, sourceId, manga, chapterId } = req.body || {};
    const store = await readStore();
    const existing = store.history.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    if (existing >= 0) store.history.splice(existing, 1);
    store.history.unshift({ ...safeManga(manga), sourceId, chapterId: String(chapterId ?? '').slice(0, 200), readAt: new Date().toISOString() });
    store.history = store.history.slice(0, 100);
    await writeStore(store);
    res.json({ ok: true, history: store.history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/history/remove", async (req, res) => {
  try {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    store.history = store.history.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    await writeStore(store);
    res.json({ ok: true, history: store.history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/history/clear", async (_req, res) => {
  try {
    const store = await readStore();
    store.history = [];
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/library', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ favorites: store.favorites || [], history: store.history || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/favorites/toggle', async (req, res) => {
  try {
    const { mangaId, sourceId, manga } = req.body;
    const store = await readStore();
    const index = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    let isFavorite;
    if (index > -1) {
      store.favorites.splice(index, 1);
      isFavorite = false;
    } else {
      store.favorites.push({ ...manga, id: mangaId, sourceId, addedAt: new Date().toISOString() });
      isFavorite = true;
    }
    await writeStore(store);
    res.json({ success: true, isFavorite, favorites: store.favorites });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEW ENDPOINTS: READING STATUS
// ============================================================================

app.get('/api/user/status', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ readingStatus: store.readingStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Set reading status for a manga; pass status: null to remove
app.post('/api/user/status', async (req, res) => {
  try {
    const { mangaId, sourceId, status, mangaData } = req.body || {};
    if (!mangaId || !sourceId) return res.status(400).json({ error: "mangaId and sourceId required" });
    const store = await readStore();
    // Sanitize composite key against prototype pollution
    const rawKey = `${mangaId}:${sourceId}`;
    const key = rawKey.replace(/[^a-z0-9:_\-]/gi, '_').slice(0, 300);
    if (!status || status === 'none') {
      delete store.readingStatus[key];
    } else {
      store.readingStatus[key] = {
        status,
        updatedAt: new Date().toISOString(),
        manga: mangaData || {}
      };
    }
    await writeStore(store);
    res.json({ ok: true, readingStatus: store.readingStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEW ENDPOINTS: REVIEWS
// ============================================================================

app.get('/api/reviews/:mangaId', async (req, res) => {
  try {
    // Sanitize key the same way the POST endpoint does so the lookup is consistent
    const safeKey = String(req.params.mangaId || '').replace(/[^a-z0-9:_\-]/gi, '_').slice(0, 200);
    const store = await readStore();
    res.json({ reviews: store.reviews[safeKey] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add or update local review; local app uses single reviewer model
app.post('/api/reviews', async (req, res) => {
  try {
    const { mangaId, rating, text } = req.body || {};
    if (!mangaId || !rating) return res.status(400).json({ error: "mangaId and rating required" });
    // Sanitize key to prevent prototype pollution (__proto__, constructor, etc.)
    const safeKey = String(mangaId).replace(/[^a-z0-9:_\-]/gi, '_').slice(0, 200);
    if (!safeKey) return res.status(400).json({ error: "Invalid mangaId" });
    const store = await readStore();
    if (!Object.prototype.hasOwnProperty.call(store.reviews, safeKey)) store.reviews[safeKey] = [];
    store.reviews[safeKey] = [{
      rating: Math.min(10, Math.max(1, Number(rating))),
      text: String(text || "").slice(0, 2000),
      date: new Date().toISOString()
    }, ...store.reviews[safeKey].slice(0, 19)];
    await writeStore(store);
    res.json({ ok: true, reviews: store.reviews[safeKey] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEW ENDPOINTS: CUSTOM LISTS
// ============================================================================

app.get('/api/lists', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ lists: store.customLists });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/lists', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "List name required" });
    const store = await readStore();
    const list = {
      id: `list_${Date.now()}`,
      name: name.trim().slice(0, 100),
      description: String(description || "").slice(0, 500),
      mangaItems: [],
      createdAt: new Date().toISOString()
    };
    store.customLists.push(list);
    await writeStore(store);
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/lists/:id', async (req, res) => {
  try {
    const listId = String(req.params.id || '').slice(0, 100);
    const { name, description } = req.body || {};
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    if (!list) return res.status(404).json({ error: "List not found" });
    if (name) list.name = name.trim().slice(0, 100);
    if (description !== undefined) list.description = String(description).slice(0, 500);
    await writeStore(store);
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/lists/:id', async (req, res) => {
  try {
    const listId = String(req.params.id || '').slice(0, 100);
    const store = await readStore();
    store.customLists = store.customLists.filter(l => l.id !== listId);
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/lists/:id/manga', async (req, res) => {
  try {
    const listId = String(req.params.id || '').slice(0, 100);
    const { mangaData } = req.body || {};
    if (!mangaData?.id) return res.status(400).json({ error: "mangaData.id required" });
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    if (!list) return res.status(404).json({ error: "List not found" });
    if (!list.mangaItems.some(m => m.id === mangaData.id)) {
      list.mangaItems.push({ ...safeManga(mangaData), addedAt: new Date().toISOString() });
    }
    await writeStore(store);
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/lists/:id/manga/:mangaId', async (req, res) => {
  try {
    const listId  = String(req.params.id      || '').slice(0, 100);
    const mId     = String(req.params.mangaId || '').slice(0, 200);
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    if (!list) return res.status(404).json({ error: "List not found" });
    list.mangaItems = list.mangaItems.filter(m => m.id !== mId);
    await writeStore(store);
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEW ENDPOINTS: ANALYTICS
// ============================================================================

app.get('/api/analytics', async (req, res) => {
  try {
    const store = await readStore();
    // Compute reading-status distribution
    const dist = { reading: 0, completed: 0, on_hold: 0, plan_to_read: 0, dropped: 0 };
    for (const s of Object.values(store.readingStatus)) {
      if (dist[s.status] !== undefined) dist[s.status]++;
    }
    // Mean score: average of the first (user's own) review rating across all rated manga
    const allRatings = Object.values(store.reviews)
      .map(arr => arr[0]?.rating)
      .filter(r => typeof r === 'number' && r > 0);
    const meanScore = allRatings.length
      ? Math.round((allRatings.reduce((s, r) => s + r, 0) / allRatings.length) * 100) / 100
      : null;
    res.json({
      analytics: store.analytics,
      statusDistribution: dist,
      totalFavorites: store.favorites.length,
      totalReviews: Object.values(store.reviews).reduce((n, arr) => n + arr.length, 0),
      totalLists: store.customLists.length,
      meanScore
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Quick ratings map: { mangaId: score } for all rated manga
app.get('/api/ratings', async (req, res) => {
  try {
    const store = await readStore();
    const ratings = {};
    for (const [mangaId, arr] of Object.entries(store.reviews)) {
      if (arr[0]?.rating) ratings[mangaId] = arr[0].rating;
    }
    res.json({ ratings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a rating (clear the review for a manga)
app.delete('/api/ratings/:mangaId', async (req, res) => {
  try {
    const mangaId = safeId(req.params.mangaId);
    if (!mangaId) return res.status(400).json({ error: 'Invalid mangaId' });
    const store = await readStore();
    delete store.reviews[mangaId];
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Called when a reading session ends; duration in minutes
app.post('/api/analytics/session', async (req, res) => {
  try {
    const { mangaId, chapterId, duration } = req.body || {};
    // Cap free-form strings to prevent unbounded store growth
    const safeMid = String(mangaId   ?? '').slice(0, 200);
    const safeCid = String(chapterId ?? '').slice(0, 200);
    const store = await readStore();
    const a = store.analytics;
    // Clamp duration: max 1440 minutes (24 h) to prevent bogus entries inflating analytics
    const mins = Math.min(1440, Math.max(0, Number(duration) || 0));

    a.totalTimeSpent = (a.totalTimeSpent || 0) + mins;
    a.totalChaptersRead = (a.totalChaptersRead || 0) + 1;

    // Daily streak: consecutive days with at least one read
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    if (a.lastReadDate !== todayStr) {
      a.dailyStreak = a.lastReadDate === yesterdayStr ? (a.dailyStreak || 0) + 1 : 1;
      a.lastReadDate = todayStr;
    }

    a.readingSessions = a.readingSessions || [];
    a.readingSessions.unshift({ mangaId: safeMid, chapterId: safeCid, duration: mins, date: new Date().toISOString() });
    a.readingSessions = a.readingSessions.slice(0, 200);

    await writeStore(store);
    res.json({ ok: true, analytics: store.analytics });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEW ENDPOINTS: ACHIEVEMENTS
// ============================================================================

app.get('/api/achievements', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ achievements: store.achievements });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Unlock an achievement; idempotent
app.post('/api/achievements/unlock', async (req, res) => {
  try {
    const { achievementId } = req.body || {};
    if (!achievementId || typeof achievementId !== 'string')
      return res.status(400).json({ error: "achievementId required" });
    // Only allow achievement IDs that look like safe identifiers
    const safeAchId = achievementId.slice(0, 100).replace(/[^a-z0-9_-]/gi, '_');
    const store = await readStore();
    const isNew = !store.achievements.includes(safeAchId);
    if (isNew) {
      store.achievements.push(safeAchId);
      await writeStore(store);
    }
    res.json({ ok: true, isNew, achievements: store.achievements });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// DOWNLOAD ENDPOINTS
// ============================================================================

// Helper: fetch an image URL and return a Buffer (with referer/UA headers)
async function fetchImageBuffer(url, referer = 'https://mangadex.org/') {
  // Enforce 30-second per-image timeout so a slow/hung CDN doesn't stall downloads
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return Buffer.from(await resp.arrayBuffer());
  } finally {
    clearTimeout(tid);
  }
}

// Download individual chapter as CBZ
app.post("/api/download/chapter", async (req, res) => {
  try {
    const { mangaTitle, chapterName, pages } = req.body;
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "No pages provided" });
    }
    // Validate all page URLs are safe external URLs before fetching
    const safePages = pages.filter(p => typeof p === 'string' && isSafeUrl(p));
    if (safePages.length === 0) return res.status(400).json({ error: "No valid page URLs" });

    const zip = new AdmZip();
    for (let i = 0; i < safePages.length; i++) {
      try {
        const buf = await fetchImageBuffer(safePages[i]);
        const ext = (safePages[i].match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1].replace('jpeg','jpg');
        zip.addFile(`${String(i + 1).padStart(3, '0')}.${ext}`, buf);
      } catch (e) {
        console.warn(`[download] skipped page ${i + 1}: ${e.message}`);
      }
    }

    const safe = (s) => s.replace(/[^a-z0-9\-_. ]/gi, '_').trim();
    const filename = `${safe(mangaTitle)} - ${safe(chapterName)}.cbz`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zip.toBuffer());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk download multiple chapters as a single CBZ
app.post("/api/download/bulk", async (req, res) => {
  try {
    const { mangaTitle, chapters, sourceId } = req.body;
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ error: "No chapters provided" });
    }

    const source = loadSourceFromFile(sourceId);
    const zip = new AdmZip();
    const safe = (s) => s.replace(/[^a-z0-9\-_. ]/gi, '_').trim();

    for (const ch of chapters) {
      let pages = [];
      try {
        const result = await source.pages(ch.id);
        pages = result.pages || [];
      } catch (e) {
        console.warn(`[bulk-dl] pages failed for ${ch.name}: ${e.message}`);
        continue;
      }
      const folder = safe(ch.name);
      for (let i = 0; i < pages.length; i++) {
        // SSRF guard: source-provided URLs must be public HTTP/HTTPS
        if (!isSafeUrl(pages[i])) {
          console.warn(`[bulk-dl] skipped unsafe URL: ${pages[i]}`);
          continue;
        }
        try {
          const buf = await fetchImageBuffer(pages[i]);
          const ext = (pages[i].match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1].replace('jpeg','jpg');
          zip.addFile(`${folder}/${String(i + 1).padStart(3, '0')}.${ext}`, buf);
        } catch (e) {
          console.warn(`[bulk-dl] skipped ${ch.name} p${i + 1}: ${e.message}`);
        }
      }
    }

    const filename = `${safe(mangaTitle)} - ${chapters.length} chapters.cbz`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zip.toBuffer());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MANGAUPDATES INTEGRATION
// ============================================================================
app.post("/api/mangaupdates/search", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: "Title is required" });
    }
    // Cap search query to avoid sending large payloads to MangaUpdates
    const safeTitle = title.trim().slice(0, 200);

    // Search MangaUpdates API
    const searchUrl = `https://api.mangaupdates.com/v1/series/search`;
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        search: safeTitle,
        perpage: 5
      })
    });

    if (!response.ok) {
      throw new Error(`MangaUpdates API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      return res.json({ found: false, message: "No results found on MangaUpdates" });
    }

    // Validate seriesId before interpolating into a URL
    const seriesId = Number(results[0].record?.series_id);
    if (!Number.isFinite(seriesId) || seriesId <= 0)
      throw new Error('Invalid series_id in MangaUpdates response');
    
    // Fetch detailed info
    const detailsUrl = `https://api.mangaupdates.com/v1/series/${seriesId}`;
    const detailsResponse = await fetch(detailsUrl);
    
    if (!detailsResponse.ok) {
      throw new Error(`Failed to fetch series details: ${detailsResponse.status}`);
    }

    const details = await detailsResponse.json();
    
    // Extract chapter count
    const latestChapter = details.latest_chapter || null;
    const status = details.status || "Unknown";
    const year = details.year || "Unknown";
    const genres = details.genres || [];

    res.json({
      found: true,
      seriesId: seriesId,
      title: results[0].record.title,
      latestChapter: latestChapter,
      status: status,
      year: year,
      genres: genres.map(g => g.genre),
      url: `https://www.mangaupdates.com/series/${seriesId}`
    });

  } catch (e) {
    console.error("MangaUpdates error:", e.message);
    res.status(500).json({ 
      error: e.message, 
      found: false,
      message: "Failed to fetch data from MangaUpdates"
    });
  }
});

// ============================================================================
// STATIC FILES
// ============================================================================
// Static files — cache immutable assets, revalidate HTML/JS/CSS.
app.use("/", express.static(path.join(__dirname, "public"), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    // CSS/JS change often during dev — short cache; images are stable
    if (/\.(css|js|html)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

ensureDirs()
  .then(() => initStore())
  .then(() => autoInstallLocalSources())
  .then(() => {
    // In Docker: bind 0.0.0.0 so the host port mapping works.
    // As standalone exe: bind 127.0.0.1 so the server is never reachable from outside the machine.
    const host = IS_PKG ? "127.0.0.1" : "0.0.0.0";
    app.listen(PORT, host, () => {
      console.log(`🎌 Manghu running on http://localhost:${PORT}`);
      console.log(`📚 Sources instaladas automaticamente!`);
      if (IS_PKG) {
        // Auto-open browser when running as standalone exe
        const { exec } = require('child_process');
        exec(`start http://localhost:${PORT}`);
      }
    });
  })
  .catch(e => {
    console.error("Fatal:", e);
    process.exit(1);
  });
