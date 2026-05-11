'use strict';

const fs = require('fs');
const path = require('path');

function createSourceLoaderCore({ safeId, fetchJson, readStore, writeStore } = {}) {
  let SOURCES_DIR = '';
  let SNAP_SOURCES_DIR = '';
  let IS_PKG = false;
  const sourceCache = new Map();
  const reposCache = new Map();

  function configure(opts) {
    SOURCES_DIR = opts.sourcesDir;
    SNAP_SOURCES_DIR = opts.snapSourcesDir;
    IS_PKG = opts.isPkg;
  }

  function sourcePath(id) {
    const userPath = path.join(SOURCES_DIR, `${id}.js`);
    const resolvedUser = path.resolve(userPath);
    const inSources = resolvedUser.startsWith(path.resolve(SOURCES_DIR) + path.sep);
    if (inSources && fs.existsSync(resolvedUser)) return resolvedUser;

    if (IS_PKG) {
      const snapPath = path.resolve(path.join(SNAP_SOURCES_DIR, `${id}.js`));
      const inSnap = snapPath.startsWith(path.resolve(SNAP_SOURCES_DIR) + path.sep);
      if (inSnap && fs.existsSync(snapPath)) return snapPath;
    }

    return resolvedUser;
  }

  function loadSourceFromFile(id) {
    if (sourceCache.has(id)) return sourceCache.get(id);

    const p = sourcePath(id);
    if (!fs.existsSync(p)) throw new Error(`Source not found: ${id}`);

    try { delete require.cache[require.resolve(p)]; } catch (_) {}

    let mod;
    try {
      mod = require(p);
    } catch (loadErr) {
      if (IS_PKG) {
        const snapPath = path.resolve(path.join(SNAP_SOURCES_DIR, `${id}.js`));
        if (fs.existsSync(snapPath) && snapPath !== p) {
          try { delete require.cache[require.resolve(snapPath)]; } catch (_) {}
          mod = require(snapPath);
          try { fs.unlinkSync(p); } catch (_) {}
        } else {
          throw loadErr;
        }
      } else {
        throw loadErr;
      }
    }

    if (!mod?.meta?.id) throw new Error('Invalid source: missing meta.id');
    if (typeof mod.search !== 'function') throw new Error('Source missing search()');
    if (typeof mod.mangaDetails !== 'function') throw new Error('Source missing mangaDetails()');
    if (typeof mod.chapters !== 'function') throw new Error('Source missing chapters()');
    if (typeof mod.pages !== 'function') throw new Error('Source missing pages()');

    sourceCache.set(id, mod);
    return mod;
  }

  function clearSourceCache(id) {
    if (id !== undefined) sourceCache.delete(id);
    else sourceCache.clear();
  }

  function detectRepoKind(data) {
    if (data?.sources && Array.isArray(data.sources)) return 'jsrepo';
    if (Array.isArray(data)) return 'tachiyomi';
    if (data?.extensions && Array.isArray(data.extensions)) return 'tachiyomi';
    return 'unknown';
  }

  async function getRepoDataWithCache(repo, ttl = 3_600_000) {
    const cached = reposCache.get(repo.url);
    if (cached && Date.now() - cached.time < ttl) return cached.data;

    if (repo.url.startsWith('localrepo:')) return { sources: [] };

    try {
      const data = await fetchJson(repo.url);
      reposCache.set(repo.url, { data, time: Date.now() });
      return data;
    } catch (e) {
      console.warn(`Failed to load repo ${repo.url}:`, e.message);
      return cached?.data || {};
    }
  }

  async function listAvailableSourcesFromRepos(repos) {
    const sources = [];
    for (const repo of repos) {
      try {
        const data = await getRepoDataWithCache(repo);
        const kind = repo.kind || detectRepoKind(data);
        if (kind === 'jsrepo' && data.sources) {
          for (const s of data.sources) {
            if (s?.id && s?.name && s?.version && s?.codeUrl && safeId(s.id)) {
              sources.push({
                kind: 'js',
                installable: true,
                repoUrl: repo.url,
                repoName: repo.name,
                id: s.id,
                name: s.name,
                version: s.version,
                codeUrl: s.codeUrl,
                author: s.author || '',
                icon: s.icon || '',
              });
            }
          }
        }
      } catch (e) {
        console.warn(`Repo error ${repo.url}:`, e.message);
      }
    }
    return sources;
  }

  async function autoInstallLocalSources() {
    const store = await readStore();
    const seen = new Set();
    const allIds = [];

    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir).filter(file => file.endsWith('.js'))) {
        const id = f.replace('.js', '');
        if (!seen.has(id)) {
          seen.add(id);
          allIds.push(id);
        }
      }
    };

    scanDir(SOURCES_DIR);
    if (IS_PKG) scanDir(SNAP_SOURCES_DIR);

    await Promise.all(allIds.map(async (id) => {
      if (store.installedSources[id]) return;
      try {
        const mod = loadSourceFromFile(id);
        store.installedSources[id] = {
          id,
          name: mod.meta.name || id,
          version: mod.meta.version || '1.0.0',
          author: mod.meta.author || 'Local',
          icon: mod.meta.icon || '',
          installedAt: new Date().toISOString(),
        };
      } catch (e) {
        console.warn(`⚠ Auto-install failed for ${id}:`, e.message);
      }
    }));

    await writeStore(store);
  }

  return {
    configure,
    sourcePath,
    loadSourceFromFile,
    clearSourceCache,
    detectRepoKind,
    getRepoDataWithCache,
    listAvailableSourcesFromRepos,
    autoInstallLocalSources,
  };
}

module.exports = { createSourceLoaderCore };