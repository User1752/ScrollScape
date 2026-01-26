/* eslint-disable no-console */
const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const DATA_DIR = path.join(__dirname, "data");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const PORT = process.env.PORT || 3000;

function safeId(id) {
  // allow a-z, 0-9, -, _
  if (typeof id !== "string") return null;
  const ok = /^[a-z0-9_-]{1,80}$/i.test(id);
  return ok ? id : null;
}

function sha1Short(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 12);
}

async function ensureDirs() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(SOURCES_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    await fsp.writeFile(
      STORE_PATH,
      JSON.stringify({ repos: [], installedSources: {} }, null, 2),
      "utf8"
    );
  }
}

async function readStore() {
  const raw = await fsp.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);

  // Backward compat: if repos missing kind, assume jsrepo
  store.repos = Array.isArray(store.repos) ? store.repos.map(r => ({
    ...r,
    kind: r.kind || "jsrepo",
    name: r.name || r.url
  })) : [];

  store.installedSources = store.installedSources || {};
  return store;
}

async function writeStore(store) {
  await fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch text: ${res.status} ${res.statusText}`);
  return await res.text();
}

function sourcePath(id) {
  return path.join(SOURCES_DIR, `${id}.js`);
}

function loadSourceFromFile(id) {
  const p = sourcePath(id);
  if (!fs.existsSync(p)) throw new Error("Source file not found");

  delete require.cache[require.resolve(p)];
  const mod = require(p);

  if (!mod || typeof mod !== "object") throw new Error("Invalid source module");
  if (!mod.meta || typeof mod.meta !== "object") throw new Error("Source missing meta");

  const meta = mod.meta;
  if (!meta.id || meta.id !== id) throw new Error("meta.id must match installed id");
  if (typeof mod.search !== "function") throw new Error("Source missing search()");
  if (typeof mod.mangaDetails !== "function") throw new Error("Source missing mangaDetails()");
  if (typeof mod.chapters !== "function") throw new Error("Source missing chapters()");
  if (typeof mod.pages !== "function") throw new Error("Source missing pages()");

  return mod;
}

/**
 * Detect repo type:
 * - jsrepo: object with { sources:[{id,name,version,codeUrl}] }
 * - tachiyomi: array (or object with { extensions:[...] }) of extension metadata
 */
function detectRepoKind(repoJson) {
  if (repoJson && typeof repoJson === "object" && Array.isArray(repoJson.sources)) return "jsrepo";
  if (Array.isArray(repoJson)) return "tachiyomi";
  if (repoJson && typeof repoJson === "object" && Array.isArray(repoJson.extensions)) return "tachiyomi";
  return "unknown";
}

function getBaseUrl(url) {
  try {
    const u = new URL(url);
    // remove file part
    u.pathname = u.pathname.replace(/\/[^/]*$/, "/");
    return u.toString();
  } catch {
    return url;
  }
}

async function listAvailableSourcesFromRepos(repos) {
  const out = [];

  for (const repo of repos) {
    try {
      const data = await fetchJson(repo.url);
      const kind = repo.kind || detectRepoKind(data);
      const repoName = repo.name || (data && data.name) || repo.url;

      // ---- JS repo (our format) ----
      if (kind === "jsrepo") {
        const sources = Array.isArray(data.sources) ? data.sources : [];
        for (const s of sources) {
          if (!s || typeof s !== "object") continue;
          if (!safeId(s.id)) continue;
          if (typeof s.name !== "string") continue;
          if (typeof s.version !== "string") continue;
          if (typeof s.codeUrl !== "string") continue;

          out.push({
            kind: "js",
            installable: true,
            repoUrl: repo.url,
            repoName,
            id: s.id,
            name: s.name,
            version: s.version,
            codeUrl: s.codeUrl,
            author: s.author || "",
            website: s.website || "",
            icon: s.icon || ""
          });
        }
        continue;
      }

      // ---- Tachiyomi/Mihon extension repo index ----
      // Usually: top-level array of extensions objects
      // Fields commonly include: name, pkg, apk, lang, version, nsfw, sources:[{name, lang, id}]
      if (kind === "tachiyomi") {
        const list = Array.isArray(data) ? data : (Array.isArray(data.extensions) ? data.extensions : []);
        const baseUrl = getBaseUrl(repo.url);

        for (const ext of list) {
          if (!ext || typeof ext !== "object") continue;

          const pkg = typeof ext.pkg === "string" ? ext.pkg : "";
          const extName = typeof ext.name === "string" ? ext.name : (pkg || "Unknown extension");
          const version = typeof ext.version === "string" ? ext.version : "";
          const lang = typeof ext.lang === "string" ? ext.lang : "";
          const nsfw = typeof ext.nsfw === "number" ? ext.nsfw : null;
          const apk = typeof ext.apk === "string" ? ext.apk : "";

          // Represent each extension as a non-installable item in our UI
          const id = `tach_${sha1Short(repo.url + "|" + (pkg || extName))}`;

          out.push({
            kind: "tachiyomi",
            installable: false,
            repoUrl: repo.url,
            repoName,
            id,
            name: extName,
            version,
            author: "",
            website: "",
            icon: "",
            note: "Repo Tachiyomi/Mihon (APK). Não compatível com instalação JS neste servidor.",
            meta: {
              pkg,
              lang,
              nsfw,
              apk,
              apkUrl: apk ? (baseUrl + apk) : ""
            }
          });

          // Optional: also expose sub-sources inside the extension (still non-installable)
          if (Array.isArray(ext.sources) && ext.sources.length > 0) {
            for (const s of ext.sources) {
              if (!s || typeof s !== "object") continue;
              const sName = typeof s.name === "string" ? s.name : "Source";
              const sLang = typeof s.lang === "string" ? s.lang : lang;
              const sId = typeof s.id === "number" || typeof s.id === "string" ? String(s.id) : "";

              out.push({
                kind: "tachiyomi",
                installable: false,
                repoUrl: repo.url,
                repoName,
                id: `tach_${sha1Short(repo.url + "|" + (pkg || extName) + "|" + sName + "|" + sId)}`,
                name: `${sName}${sLang ? ` (${sLang})` : ""}`,
                version,
                note: "Source dentro de extensão Tachiyomi/Mihon (APK). Não executável aqui.",
                meta: {
                  pkg,
                  sourceId: sId,
                  lang: sLang,
                  apk,
                  apkUrl: apk ? (baseUrl + apk) : ""
                }
              });
            }
          }
        }
        continue;
      }

      // Unknown repo type: ignore
    } catch (e) {
      // ignore repo failures
    }
  }

  return out;
}

/**
 * SECURITY NOTE:
 * This MVP downloads and executes third-party JavaScript sources on your server.
 * Only add/install sources you trust. A production version should sandbox sources.
 */

app.get("/api/state", async (req, res) => {
  try {
    const store = await readStore();
    const available = await listAvailableSourcesFromRepos(store.repos);
    res.json({
      repos: store.repos,
      availableSources: available,
      installedSources: store.installedSources
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/repos", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== "string" || !url.startsWith("http")) {
      return res.status(400).json({ error: "Invalid repo url" });
    }

    const repoJson = await fetchJson(url);
    const kind = detectRepoKind(repoJson);

    if (kind === "unknown") {
      return res.status(400).json({
        error: "Repo JSON não reconhecido. Suportado: { sources:[...] } (JS) ou index de extensões Tachiyomi/Mihon (array/extensions)."
      });
    }

    const store = await readStore();
    const exists = store.repos.some(r => r.url === url);
    if (!exists) {
      const name =
        (repoJson && typeof repoJson === "object" && repoJson.name) ? repoJson.name :
        (kind === "tachiyomi" ? "Tachiyomi/Mihon Repo" : url);

      store.repos.push({ url, name, kind });
      await writeStore(store);
    }

    res.json({ ok: true, kind });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete("/api/repos", async (req, res) => {
  try {
    const { url } = req.query;
    if (typeof url !== "string") return res.status(400).json({ error: "Missing url" });
    const store = await readStore();
    store.repos = store.repos.filter(r => r.url !== url);
    await writeStore(store);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/sources/install", async (req, res) => {
  try {
    const { id } = req.body || {};
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const store = await readStore();
    const available = await listAvailableSourcesFromRepos(store.repos);

    const found = available.find(s => s.id === sid);
    if (!found) return res.status(404).json({ error: "Source not found in any repo" });

    if (found.kind !== "js" || !found.installable) {
      return res.status(400).json({
        error: "Esta entrada é de um repo Tachiyomi/Mihon (APK) e não pode ser instalada/executada neste servidor."
      });
    }

    const code = await fetchText(found.codeUrl);
    await fsp.writeFile(sourcePath(sid), code, "utf8");

    const mod = loadSourceFromFile(sid);

    store.installedSources[sid] = {
      id: sid,
      name: mod.meta.name || found.name,
      version: mod.meta.version || found.version,
      author: mod.meta.author || found.author || "",
      icon: mod.meta.icon || found.icon || "",
      installedAt: new Date().toISOString()
    };
    await writeStore(store);

    res.json({ ok: true, installed: store.installedSources[sid] });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/sources/uninstall", async (req, res) => {
  try {
    const { id } = req.body || {};
    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const store = await readStore();
    delete store.installedSources[sid];
    await writeStore(store);

    const p = sourcePath(sid);
    if (fs.existsSync(p)) await fsp.unlink(p);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Generic calls to installed JS source methods
app.post("/api/source/:id/search", async (req, res) => {
  try {
    const sid = safeId(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const { query = "", page = 1 } = req.body || {};
    const mod = loadSourceFromFile(sid);
    const result = await mod.search(String(query), Number(page) || 1);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/source/:id/manga", async (req, res) => {
  try {
    const sid = safeId(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const { mangaId } = req.body || {};
    const mod = loadSourceFromFile(sid);
    const result = await mod.mangaDetails(String(mangaId));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/source/:id/chapters", async (req, res) => {
  try {
    const sid = safeId(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const { mangaId } = req.body || {};
    const mod = loadSourceFromFile(sid);
    const result = await mod.chapters(String(mangaId));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/source/:id/pages", async (req, res) => {
  try {
    const sid = safeId(req.params.id);
    if (!sid) return res.status(400).json({ error: "Invalid source id" });

    const { chapterId } = req.body || {};
    const mod = loadSourceFromFile(sid);
    const result = await mod.pages(String(chapterId));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Serve static UI
app.use("/", express.static(path.join(__dirname, "public")));

ensureDirs()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Manga Web Reader running on http://localhost:${PORT}`)
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
