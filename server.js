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
    if (store.installedSources[id]) continue; // Já instalada
    
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

// --- Endpoints ---
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
    if (kind === "unknown") {
      return res.status(400).json({ error: "Formato de repo não reconhecido" });
    }

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
    
    // Mapeamento de métodos
    let result;
    if (method === "search") {
      result = await mod.search(query || "", Number(page) || 1);
    } else if (method === "mangaDetails") {
      result = await mod.mangaDetails(mangaId || "");
    } else if (method === "chapters") {
      result = await mod.chapters(mangaId || "");
    } else if (method === "pages") {
      result = await mod.pages(chapterId || "");
    } else {
      return res.status(400).json({ error: "Método não suportado" });
    }
    
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
    if (existing >= 0) {
      store.history.splice(existing, 1);
    }
    store.history.unshift({ ...manga, sourceId, chapterId, readAt: new Date().toISOString() });
    store.history = store.history.slice(0, 100);
    await writeStore(store);
    res.json({ ok: true, history: store.history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint da biblioteca
app.get('/api/library', async (req, res) => {
  try {
    const store = await readStore();
    
    res.json({
      favorites: store.favorites || [],
      history: store.history || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle de favoritos
app.post('/api/favorites/toggle', async (req, res) => {
  try {
    const { mangaId, sourceId, manga } = req.body;
    const store = await readStore();
    
    if (!store.favorites) {
      store.favorites = [];
    }
    
    const index = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    let isFavorite;
    
    if (index > -1) {
      store.favorites.splice(index, 1);
      isFavorite = false;
    } else {
      store.favorites.push({
        ...manga,
        id: mangaId,
        sourceId: sourceId,
        addedAt: new Date().toISOString()
      });
      isFavorite = true;
    }
    
    await writeStore(store);
    res.json({ success: true, isFavorite, favorites: store.favorites });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
