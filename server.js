/* eslint-disable no-console */
const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const multer = require('multer');
const AdmZip  = require('adm-zip');

const app = express();
app.use(express.json({ limit: "5mb" }));

const DATA_DIR   = path.join(__dirname, "data");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const STORE_PATH  = path.join(DATA_DIR, "store.json");
const CACHE_DIR   = path.join(DATA_DIR, "cache");
const LOCAL_DIR   = path.join(DATA_DIR, "local");
const TMP_DIR     = path.join(DATA_DIR, "tmp");
const PORT = process.env.PORT || 3000;

const reposCache = new Map();
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 500 * 1024 * 1024 } });

function safeId(id) {
  if (typeof id !== "string") return null;
  return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : null;
}

function sha1Short(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 12);
}

async function ensureDirs() {
  for (const dir of [DATA_DIR, SOURCES_DIR, CACHE_DIR, LOCAL_DIR, TMP_DIR]) {
    await fsp.mkdir(dir, { recursive: true });
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
  const raw = await fsp.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  store.repos = Array.isArray(store.repos) ? store.repos.map(r => ({
    ...r,
    kind: r.kind || "jsrepo",
    name: r.name || r.url
  })) : [];
  store.installedSources = store.installedSources || {};
  store.history = store.history || [];
  store.favorites = store.favorites || [];

  // --- New feature fields: migrate existing stores gracefully ---
  store.readingStatus = store.readingStatus || {};
  store.reviews = store.reviews || {};
  store.customLists = store.customLists || [];
  store.analytics = store.analytics || {
    totalChaptersRead: 0,
    totalTimeSpent: 0,  // minutes
    readingSessions: [],
    dailyStreak: 0,
    lastReadDate: null
  };
  store.achievements = store.achievements || [];

  return store;
}

async function writeStore(store) {
  await fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url, { redirect: "follow", timeout: 10000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow", timeout: 10000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function sourcePath(id) {
  return path.join(SOURCES_DIR, `${id}.js`);
}

function loadSourceFromFile(id) {
  const p = sourcePath(id);
  if (!fs.existsSync(p)) throw new Error("Source not found");
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  if (!mod?.meta?.id) throw new Error("Invalid source: missing meta.id");
  if (typeof mod.search !== "function") throw new Error("Source missing search()");
  if (typeof mod.mangaDetails !== "function") throw new Error("Source missing mangaDetails()");
  if (typeof mod.chapters !== "function") throw new Error("Source missing chapters()");
  if (typeof mod.pages !== "function") throw new Error("Source missing pages()");
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
  const localSourceFiles = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith(".js"));
  for (const file of localSourceFiles) {
    const id = file.replace(".js", "");
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
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).end();
  try {
    const imgRes = await fetch(url, {
      headers: {
        "Referer": ref || "https://mangapill.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    res.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    imgRes.body.pipe(res);
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
    const code = await fetchText(source.codeUrl);
    await fsp.writeFile(sourcePath(sid), code, "utf8");
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
            const imgExt = path.extname(entry.name) || '.jpg';
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
          const imgExt = path.extname(file.fileHeader.name) || '.jpg';
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
    const { query, page, mangaId, chapterId, genres } = req.body || {};
    let result;
    if (method === "search")         result = await mod.search(query || "", Number(page) || 1);
    else if (method === "mangaDetails")  result = await mod.mangaDetails(mangaId || "");
    else if (method === "chapters")      result = await mod.chapters(mangaId || "");
    else if (method === "pages")         result = await mod.pages(chapterId || "");
    else if (method === "trending")      result = await mod.trending();
    else if (method === "recentlyAdded") result = await mod.recentlyAdded();
    else if (method === "latestUpdates") result = await mod.latestUpdates();
    else if (method === "byGenres")      result = await mod.byGenres(genres || []);
    else if (method === "authorSearch")  result = await mod.authorSearch(req.body?.authorName || "");
    else return res.status(400).json({ error: "Método não suportado" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/library/add", async (req, res) => {
  try {
    const { mangaId, sourceId, manga } = req.body || {};
    const store = await readStore();
    const existing = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    if (existing >= 0) {
      store.favorites[existing] = { ...manga, sourceId, addedAt: new Date().toISOString() };
    } else {
      store.favorites.push({ ...manga, sourceId, addedAt: new Date().toISOString() });
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
    store.history.unshift({ ...manga, sourceId, chapterId, readAt: new Date().toISOString() });
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
    const key = `${mangaId}:${sourceId}`;
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
    const store = await readStore();
    res.json({ reviews: store.reviews[req.params.mangaId] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add or update local review; local app uses single reviewer model
app.post('/api/reviews', async (req, res) => {
  try {
    const { mangaId, rating, text } = req.body || {};
    if (!mangaId || !rating) return res.status(400).json({ error: "mangaId and rating required" });
    const store = await readStore();
    if (!store.reviews[mangaId]) store.reviews[mangaId] = [];
    // Replace if user already has a review (single-user app)
    store.reviews[mangaId] = [{
      rating: Math.min(10, Math.max(1, Number(rating))),
      text: String(text || "").slice(0, 2000),
      date: new Date().toISOString()
    }, ...store.reviews[mangaId].slice(0, 19)];
    await writeStore(store);
    res.json({ ok: true, reviews: store.reviews[mangaId] });
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
    const { name, description } = req.body || {};
    const store = await readStore();
    const list = store.customLists.find(l => l.id === req.params.id);
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
    const store = await readStore();
    store.customLists = store.customLists.filter(l => l.id !== req.params.id);
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/lists/:id/manga', async (req, res) => {
  try {
    const { mangaData } = req.body || {};
    if (!mangaData?.id) return res.status(400).json({ error: "mangaData.id required" });
    const store = await readStore();
    const list = store.customLists.find(l => l.id === req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });
    if (!list.mangaItems.some(m => m.id === mangaData.id)) {
      list.mangaItems.push({ ...mangaData, addedAt: new Date().toISOString() });
    }
    await writeStore(store);
    res.json({ ok: true, list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/lists/:id/manga/:mangaId', async (req, res) => {
  try {
    const store = await readStore();
    const list = store.customLists.find(l => l.id === req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });
    list.mangaItems = list.mangaItems.filter(m => m.id !== req.params.mangaId);
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
    const { mangaId } = req.params;
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
    const store = await readStore();
    const a = store.analytics;
    const mins = Math.max(0, Number(duration) || 0);

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
    a.readingSessions.unshift({ mangaId, chapterId, duration: mins, date: new Date().toISOString() });
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
    if (!achievementId) return res.status(400).json({ error: "achievementId required" });
    const store = await readStore();
    const isNew = !store.achievements.includes(achievementId);
    if (isNew) {
      store.achievements.push(achievementId);
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
async function fetchImageBuffer(url) {
  const resp = await fetch(url, {
    headers: {
      'Referer': 'https://mangadex.org/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

// Download individual chapter as CBZ
app.post("/api/download/chapter", async (req, res) => {
  try {
    const { mangaTitle, chapterName, pages } = req.body;
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "No pages provided" });
    }

    const zip = new AdmZip();
    for (let i = 0; i < pages.length; i++) {
      try {
        const buf = await fetchImageBuffer(pages[i]);
        const ext = (pages[i].match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1].replace('jpeg','jpg');
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
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Search MangaUpdates API
    const searchUrl = `https://api.mangaupdates.com/v1/series/search`;
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        search: title,
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

    // Get the most relevant result (first one)
    const seriesId = results[0].record.series_id;
    
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
app.use("/", express.static(path.join(__dirname, "public")));

ensureDirs()
  .then(() => autoInstallLocalSources())
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🎌 Manghu running on http://localhost:${PORT}`);
      console.log(`📚 Sources instaladas automaticamente!`);
    });
  })
  .catch(e => {
    console.error("Fatal:", e);
    process.exit(1);
  });
