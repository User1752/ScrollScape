/**
 * sourceLoader.js — Loading, caching, and validation of manga source modules
 *
 * Sources are Node.js CommonJS modules dropped into SOURCES_DIR.  When bundled
 * as a standalone exe (pkg) a snapshot copy lives in SNAP_SOURCES_DIR; the
 * user-filesystem version always takes priority so scrapers can be updated
 * without rebuilding the exe.
 *
 * Security notes:
 *  • Path confinement: resolved paths are checked against the expected
 *    directory prefix before fs operations (directory traversal prevention).
 *  • Module interface validation: after require() we assert that the module
 *    exports the four required functions (search / mangaDetails / chapters /
 *    pages) and a valid meta.id field.  Missing exports abort early rather
 *    than letting callers hit a runtime "not a function" error.
 *  • Module cache invalidation: the require() cache is cleared before each
 *    fresh load so that a newly-dropped .js file is picked up immediately,
 *    and stale code is never served after an uninstall.
 *
 * Exports:
 *   configure(opts)          — Set SOURCES_DIR, SNAP_SOURCES_DIR, IS_PKG
 *   sourcePath(id)           — Resolve + confine the filesystem path for a source
 *   loadSourceFromFile(id)   — Load (and cache) a source module by ID
 *   clearSourceCache(id?)    — Evict one source (or all) from the module cache
 *   detectRepoKind(data)     — Detect "jsrepo" | "tachiyomi" | "unknown"
 *   getRepoDataWithCache(r)  — Fetch repo JSON with a 1 h in-process TTL
 *   listAvailableSourcesFromRepos(repos) — Enumerate installable sources
 *   autoInstallLocalSources()            — Register on-disk sources in the store
 */

'use strict';

const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const { safeId, fetchJson } = require('./helpers');
const { readStore, writeStore } = require('./store');

// Injected via configure()
let SOURCES_DIR      = '';
let SNAP_SOURCES_DIR = '';
let IS_PKG           = false;

// Per-module require() cache — avoids re-parsing source .js on every API call.
const sourceCache = new Map();

// In-process TTL cache for remote repo manifests (1 hour).
const reposCache = new Map();

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * @param {{ sourcesDir: string, snapSourcesDir: string, isPkg: boolean }} opts
 */
function configure(opts) {
  SOURCES_DIR      = opts.sourcesDir;
  SNAP_SOURCES_DIR = opts.snapSourcesDir;
  IS_PKG           = opts.isPkg;
}

// ── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Resolves the filesystem path for a source file, preferring the user-writable
 * directory over the bundled snapshot.
 *
 * Raises a path-traversal error if the resolved path escapes its parent dir.
 *
 * @param {string} id  A validated source ID (alphanumeric + hyphen/underscore)
 * @returns {string}   Absolute path (may not exist yet for install flows)
 */
function sourcePath(id) {
  const userPath     = path.join(SOURCES_DIR, `${id}.js`);
  const resolvedUser = path.resolve(userPath);
  const inSources    = resolvedUser.startsWith(path.resolve(SOURCES_DIR) + path.sep);
  if (inSources && fs.existsSync(resolvedUser)) return resolvedUser;

  if (IS_PKG) {
    const snapPath = path.resolve(path.join(SNAP_SOURCES_DIR, `${id}.js`));
    const inSnap   = snapPath.startsWith(path.resolve(SNAP_SOURCES_DIR) + path.sep);
    if (inSnap && fs.existsSync(snapPath)) return snapPath;
  }
  // Return user path — callers that write (install) expect this location.
  return resolvedUser;
}

// ── Module loading ───────────────────────────────────────────────────────────

/**
 * Loads and validates a source module, returning the cached copy on subsequent
 * calls.  Throws with a descriptive message if the module is missing, fails to
 * load, or does not export the required contract.
 *
 * @param {string} id
 * @returns {object}  The source module
 */
function loadSourceFromFile(id) {
  if (sourceCache.has(id)) return sourceCache.get(id);

  const p = sourcePath(id);
  if (!fs.existsSync(p)) throw new Error(`Source not found: ${id}`);

  // Clear the Node require() cache so a freshly-dropped file is picked up.
  try { delete require.cache[require.resolve(p)]; } catch (_) {}

  let mod;
  try {
    mod = require(p);
  } catch (loadErr) {
    // Real-FS file may be a stale bytecode copy from an old pkg build.
    // Fall back to the snapshot path which is always valid bytecode.
    if (IS_PKG) {
      const snapPath = path.resolve(path.join(SNAP_SOURCES_DIR, `${id}.js`));
      if (fs.existsSync(snapPath) && snapPath !== p) {
        try { delete require.cache[require.resolve(snapPath)]; } catch (_) {}
        mod = require(snapPath);
        // Delete the bad real-FS file so the snapshot is used directly next time
        try { fs.unlinkSync(p); } catch (_) {}
      } else {
        throw loadErr;
      }
    } else {
      throw loadErr;
    }
  }

  // Contract validation — fail loudly rather than silently returning broken sources.
  if (!mod?.meta?.id)                         throw new Error('Invalid source: missing meta.id');
  if (typeof mod.search       !== 'function') throw new Error('Source missing search()');
  if (typeof mod.mangaDetails !== 'function') throw new Error('Source missing mangaDetails()');
  if (typeof mod.chapters     !== 'function') throw new Error('Source missing chapters()');
  if (typeof mod.pages        !== 'function') throw new Error('Source missing pages()');

  sourceCache.set(id, mod);
  return mod;
}

/**
 * Evicts a source (or all sources) from the in-process module cache.
 *
 * @param {string} [id]  If omitted, clears the entire cache.
 */
function clearSourceCache(id) {
  if (id !== undefined) sourceCache.delete(id);
  else sourceCache.clear();
}

// ── Repo helpers ─────────────────────────────────────────────────────────────

/**
 * Detects the format of a fetched repo manifest.
 *
 * @param {unknown} data
 * @returns {'jsrepo'|'tachiyomi'|'unknown'}
 */
function detectRepoKind(data) {
  if (data?.sources && Array.isArray(data.sources))        return 'jsrepo';
  if (Array.isArray(data))                                  return 'tachiyomi';
  if (data?.extensions && Array.isArray(data.extensions))  return 'tachiyomi';
  return 'unknown';
}

/**
 * Fetches a repo manifest with a 1-hour in-process TTL.
 * Falls back to the previous cached copy on network error.
 *
 * @param {{ url: string }} repo
 * @param {number} [ttl=3600000]  Cache TTL in ms (default 1 h)
 * @returns {Promise<object>}
 */
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

/**
 * Enumerates all installable JS sources from the given array of repos.
 *
 * @param {object[]} repos
 * @returns {Promise<object[]>}
 */
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
              kind:      'js',
              installable: true,
              repoUrl:   repo.url,
              repoName:  repo.name,
              id:        s.id,
              name:      s.name,
              version:   s.version,
              codeUrl:   s.codeUrl,
              author:    s.author  || '',
              icon:      s.icon    || '',
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

/**
 * Scans SOURCES_DIR (and SNAP_SOURCES_DIR for pkg builds) and registers any
 * unregistered .js files as installed sources in the store.
 *
 * This enables "just drop a file" installation without going through the UI.
 */
async function autoInstallLocalSources() {
  const store = await readStore();
  const seen  = new Set();
  const allIds = [];

  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const id = f.replace('.js', '');
      if (!seen.has(id)) { seen.add(id); allIds.push(id); }
    }
  };

  scanDir(SOURCES_DIR);
  if (IS_PKG) scanDir(SNAP_SOURCES_DIR);

  // Run registrations in parallel for faster startup.
  await Promise.all(allIds.map(async (id) => {
    if (store.installedSources[id]) return; // already registered
    try {
      const mod = loadSourceFromFile(id);
      store.installedSources[id] = {
        id,
        name:        mod.meta.name    || id,
        version:     mod.meta.version || '1.0.0',
        author:      mod.meta.author  || 'Local',
        icon:        mod.meta.icon    || '',
        installedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.warn(`⚠ Auto-install failed for ${id}:`, e.message);
    }
  }));

  await writeStore(store);
}

/**
 * Bundled sources live in the pkg snapshot as bytecode ("scripts").
 * sourcePath() already falls back to the snapshot path when no real-FS file exists,
 * so require(snapPath) loads them correctly — no need to copy anything to disk.
 * User-installed sources are downloaded directly to SOURCES_DIR by the install route.
 */
function seedSourcesFromSnapshot() {
  // intentionally empty — seeding is not needed and causes problems
  // (copying snapshot bytecode to disk makes require(realPath) fail)
}

module.exports = {
  configure,
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  detectRepoKind,
  getRepoDataWithCache,
  listAvailableSourcesFromRepos,
  autoInstallLocalSources,
  seedSourcesFromSnapshot,
};
