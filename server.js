/* eslint-disable no-console */
const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json({ limit: "5mb" }));

const DATA_DIR = path.join(__dirname, "data");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const PORT = process.env.PORT || 3000;

const reposCache = new Map();

function safeId(id) {
  if (typeof id !== "string") return null;
  return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : null;
}

function sha1Short(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 12);
}

async function ensureDirs() {
  for (const dir of [DATA_DIR, SOURCES_DIR, CACHE_DIR]) {
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

app.post("/api/source/:id/:method", async (req, res) => {
  try {
    const { id, method } = req.params;
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "ID inválido" });
    const mod = loadSourceFromFile(sid);
    if (typeof mod[method] !== "function") return res.status(400).json({ error: "Método não existe" });
    const { query, page, mangaId, chapterId } = req.body || {};
    let result;
    if (method === "search") result = await mod.search(query || "", Number(page) || 1);
    else if (method === "mangaDetails") result = await mod.mangaDetails(mangaId || "");
    else if (method === "chapters") result = await mod.chapters(mangaId || "");
    else if (method === "pages") result = await mod.pages(chapterId || "");
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
      rating: Math.min(5, Math.max(1, Number(rating))),
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
    res.json({
      analytics: store.analytics,
      statusDistribution: dist,
      totalFavorites: store.favorites.length,
      totalReviews: Object.values(store.reviews).reduce((n, arr) => n + arr.length, 0),
      totalLists: store.customLists.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

// Download individual chapter as PDF
app.post("/api/download/chapter", async (req, res) => {
  try {
    const { mangaTitle, chapterName, pages, sourceId } = req.body;
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "No pages provided" });
    }

    // For simplicity, we'll create a data URI that the frontend can use
    // In a real implementation, you'd want to:
    // 1. Download all images to server
    // 2. Create a PDF or ZIP file
    // 3. Serve it for download
    
    // Simple approach: return the pages and let the client handle the download
    const sanitizedManga = mangaTitle.replace(/[^a-z0-9]/gi, '_');
    const sanitizedChapter = chapterName.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedManga}_${sanitizedChapter}.txt`;

    // Create a simple text file with image URLs (proof of concept)
    const content = `Manga: ${mangaTitle}\nChapter: ${chapterName}\n\nPages:\n${pages.join('\n')}`;
    const base64 = Buffer.from(content).toString('base64');
    const dataUri = `data:text/plain;base64,${base64}`;

    res.json({
      success: true,
      downloadUrl: dataUri,
      filename,
      message: "Chapter download ready"
    });
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
  }
});

// Bulk download multiple chapters
app.post("/api/download/bulk", async (req, res) => {
  try {
    const { mangaTitle, chapters, sourceId } = req.body;
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ error: "No chapters provided" });
    }

    const source = loadSourceFromFile(sourceId);
    const allPages = [];

    // Fetch pages for all selected chapters
    for (const ch of chapters) {
      try {
        const result = await source.pages(ch.id);
        if (result.pages && result.pages.length > 0) {
          allPages.push({
            name: ch.name,
            pages: result.pages
          });
        }
      } catch (e) {
        console.error(`Failed to get pages for ${ch.name}:`, e.message);
      }
    }

    if (allPages.length === 0) {
      return res.status(400).json({ error: "No pages found for selected chapters", success: false });
    }

    // Create a manifest file
    const sanitizedManga = mangaTitle.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedManga}_${chapters.length}_chapters.txt`;

    let content = `Manga: ${mangaTitle}\nTotal Chapters: ${chapters.length}\n\n`;
    allPages.forEach((ch, idx) => {
      content += `\n=== ${ch.name} ===\n`;
      content += `Pages: ${ch.pages.length}\n`;
      ch.pages.forEach((page, pageIdx) => {
        content += `Page ${pageIdx + 1}: ${page}\n`;
      });
    });

    const base64 = Buffer.from(content).toString('base64');
    const dataUri = `data:text/plain;base64,${base64}`;

    res.json({
      success: true,
      downloadUrl: dataUri,
      filename,
      totalChapters: chapters.length,
      totalPages: allPages.reduce((sum, ch) => sum + ch.pages.length, 0),
      message: "Bulk download ready"
    });
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
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
