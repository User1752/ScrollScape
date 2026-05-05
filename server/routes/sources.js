/**
 * routes/sources.js — Source install / uninstall + generic source method dispatcher
 *
 * Endpoints:
 *   POST /api/sources/install      — Download and register a remote JS source
 *   POST /api/sources/uninstall    — Remove a registered source
 *   POST /api/source/:id/:method   — Dispatch a method call to a source module
 *   GET  /api/popular-all          — Aggregate trending results from all sources
 *
 * Security:
 *  • Source IDs are validated with safeId() on every endpoint.
 *  • Install: the codeUrl is SSRF-guarded with isSafeUrl() before fetching.
 *  • Dispatch: accepted methods are whitelisted; arbitrary method names are
 *    rejected with 400.
 *  • Per-source call timeout: each source method call is wrapped in a
 *    Promise.race with a 30-second AbortController so a hung scraper
 *    cannot stall the server process indefinitely.
 *
 * Performance:
 *  • popular-all uses a 60-second in-memory TTL to avoid hammering all
 *    installed sources on every home-screen render.
 *  • Results are merged by interleaving source buckets (zip), de-duplicated
 *    by title (case-insensitive), and capped at 40 items.
 */

'use strict';

const fs  = require('fs');
const fsp = fs.promises;
const { safeId, isSafeUrl, fetchText } = require('../helpers');
const { readStore, writeStore }         = require('../store');
const {
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  listAvailableSourcesFromRepos,
} = require('../sourceLoader');

// Cached popular-all response — { ts: number, data: object }
let _popularAllCache = null;
const POPULAR_ALL_TTL = 60_000; // 1 minute

// Maximum wall-clock time for a single source method call (ms).
const SOURCE_CALL_TIMEOUT = 30_000;

/**
 * Wraps a Promise with a timeout, rejecting after `ms` milliseconds.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label  Used in the rejection message.
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label = 'source call') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Higher-order function to encapsulate try-catch blocks for async route handlers.
 */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

/**
 * @param {import('express').Router} router
 */
function registerSourceRoutes(router) {
  // ── POST /api/sources/install ──────────────────────────────────────────────
  router.post('/api/sources/install', asyncHandler(async (req, res) => {
    const { id } = req.body || {};
    const sid    = safeId(id);
    if (!sid) return res.status(400).json({ error: 'Invalid source ID' });

    const store     = await readStore();
    const available = await listAvailableSourcesFromRepos(store.repos);
    const source    = available.find(s => s.id === sid);
    if (!source) return res.status(404).json({ error: 'Source not found in any repo' });
    if (source.kind !== 'js') return res.status(400).json({ error: 'Source type not supported' });
    if (!isSafeUrl(source.codeUrl)) return res.status(400).json({ error: 'Source code URL is not valid' });

    const code = await fetchText(source.codeUrl);
    await fsp.writeFile(sourcePath(sid), code, 'utf8');

    // Invalidate stale cached modules.
    clearSourceCache(sid);
    _popularAllCache = null;

    const mod = loadSourceFromFile(sid);
    store.installedSources[sid] = {
      id:          sid,
      name:        mod.meta.name    || source.name,
      version:     mod.meta.version || source.version,
      author:      mod.meta.author  || source.author || '',
      icon:        mod.meta.icon    || source.icon   || '',
      installedAt: new Date().toISOString(),
    };
    await writeStore(store);
    res.json({ ok: true, installed: store.installedSources[sid] });
  }));

  // ── POST /api/sources/uninstall ────────────────────────────────────────────
  router.post('/api/sources/uninstall', asyncHandler(async (req, res) => {
    const { id } = req.body || {};
    const sid    = safeId(id);
    if (!sid) return res.status(400).json({ error: 'Invalid source ID' });

    const store = await readStore();
    delete store.installedSources[sid];
    await writeStore(store);

    clearSourceCache(sid);
    _popularAllCache = null;

    const p = sourcePath(sid);
    if (fs.existsSync(p)) await fsp.unlink(p);

    res.json({ ok: true });
  }));

  // ── POST /api/source/:id/:method ────────────────────────────────────────────
  // Whitelisted methods only — arbitrary method names are rejected.
  const ALLOWED_METHODS = new Set([
    'search', 'mangaDetails', 'chapters', 'pages',
    'trending', 'recentlyAdded', 'latestUpdates',
    'byGenres', 'authorSearch',
  ]);

  router.post('/api/source/:id/:method', asyncHandler(async (req, res) => {
    const { id, method } = req.params;

    const sid = safeId(id);
    if (!sid) return res.status(400).json({ error: 'Invalid source ID' });
    if (!ALLOWED_METHODS.has(method)) return res.status(400).json({ error: 'Method not supported' });

    const mod = loadSourceFromFile(sid);
    if (typeof mod[method] !== 'function') return res.status(400).json({ error: 'Method not implemented by this source' });

    const { query, page, mangaId, chapterId, genres, orderBy, authorName, publicationStatus, format } = req.body || {};
    const filters = { publicationStatus: publicationStatus || '', format: format || '' };

    let call;
    switch (method) {
      case 'search':         call = mod.search(query || '', Number(page) || 1, orderBy || '', filters); break;
      case 'mangaDetails':   call = mod.mangaDetails(mangaId   || ''); break;
      case 'chapters':       call = mod.chapters(mangaId       || ''); break;
      case 'pages':          call = mod.pages(chapterId        || ''); break;
      case 'trending':       call = mod.trending(); break;
      case 'recentlyAdded':  call = mod.recentlyAdded(); break;
      case 'latestUpdates':  call = mod.latestUpdates(); break;
      case 'byGenres':       call = mod.byGenres(genres || [], orderBy || '', filters, Number(page) || 1); break;
      case 'authorSearch':   call = mod.authorSearch(authorName || ''); break;
      // No default needed — ALLOWED_METHODS guard above ensures exhaustion.
    }

    const result = await withTimeout(call, SOURCE_CALL_TIMEOUT, `${sid}.${method}`);
    res.json(result);
  }));

  // ── GET /api/popular-all ───────────────────────────────────────────────────
  router.get('/api/popular-all', asyncHandler(async (req, res) => {
    // Serve from cache if still fresh.
    if (_popularAllCache && Date.now() - _popularAllCache.ts < POPULAR_ALL_TTL) {
      return res.json(_popularAllCache.data);
    }

    const store     = await readStore();
    const sourceIds = Object.keys(store.installedSources || {});
    if (!sourceIds.length) return res.json({ results: [] });

    const settled = await Promise.allSettled(
      sourceIds.map(async (sid) => {
        const mod = loadSourceFromFile(sid);
        if (typeof mod.trending !== 'function') return [];
        const r = await withTimeout(mod.trending(), SOURCE_CALL_TIMEOUT, `${sid}.trending`);
        return (r.results || []).map(m => ({
          ...m,
          sourceId:   sid,
          sourceName: store.installedSources[sid]?.name || sid,
        }));
      })
    );

    // Interleave source buckets (zip) then de-duplicate by title.
    const buckets = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const seen    = new Set();
    const merged  = [];
    const maxLen  = Math.max(...buckets.map(b => b.length), 0);
    
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (i < bucket.length) {
          const key = (bucket[i].title || '').trim().toLowerCase();
          if (!seen.has(key)) { seen.add(key); merged.push(bucket[i]); }
        }
      }
    }

    const response = { results: merged.slice(0, 40) };
    _popularAllCache = { ts: Date.now(), data: response };
    res.json(response);
  }));
}

// Allow other modules (e.g. sourceLoader) to invalidate the public-all cache.
function invalidatePopularCache() {
  _popularAllCache = null;
}

module.exports = { registerSourceRoutes, invalidatePopularCache };
