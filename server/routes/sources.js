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
 *    Promise.race with a 30-second timeout helper so a hung scraper
 *    cannot stall the server process indefinitely.
 *
 * Performance:
 *  • popular-all uses a 60-second in-memory TTL to avoid hammering all
 *    installed sources on every home-screen render.
 *  • Results are merged by interleaving source buckets (zip), de-duplicated
 *    by title (case-insensitive), and capped at 40 items.
 */

'use strict';

const { safeId } = require('../helpers');
const { readStore, writeStore } = require('../store');
const {
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  listAvailableSourcesFromRepos,
} = require('../sourceLoader');
const { createSourceDispatchService } = require('../modules/sources/dispatch-service');
const { createPopularAllService } = require('../modules/sources/popular-all');
const { createSourceLifecycleService } = require('../modules/sources/lifecycle');
const { createAsyncHandler } = require('../modules/http/async-handler');
const limits = require('../config/limits');

const SOURCE_CALL_TIMEOUT = limits.sourceCallTimeoutMs;

function withTimeout(promise, ms = SOURCE_CALL_TIMEOUT, label = 'source call') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const asyncHandler = createAsyncHandler('SOURCES');

const popularAllService = createPopularAllService({
  readStore,
  loadSourceFromFile,
  withTimeout,
  timeoutMs: SOURCE_CALL_TIMEOUT,
});

const sourceLifecycleService = createSourceLifecycleService({
  readStore,
  writeStore,
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  listAvailableSourcesFromRepos,
  invalidatePopularAll: () => popularAllService.invalidate(),
});

const sourceDispatchService = createSourceDispatchService({
  safeId,
  loadSourceFromFile,
  withTimeout,
  timeoutMs: SOURCE_CALL_TIMEOUT,
});

const { requireValidIdParam } = require('../middleware/validation');

/**
 * @param {import('express').Router} router
 */
function registerSourceRoutes(router) {
  // ── POST /api/sources/install ──────────────────────────────────────────────
  router.post('/api/sources/install', asyncHandler(async (req, res) => {
    // ID comes in body, sourceLifecycleService.installById validates internally
    const result = await sourceLifecycleService.installById(req.body?.id);
    res.json(result);
  }));

  // ── POST /api/sources/uninstall ────────────────────────────────────────────
  router.post('/api/sources/uninstall', asyncHandler(async (req, res) => {
    // ID comes in body, sourceLifecycleService.uninstallById validates internally
    const result = await sourceLifecycleService.uninstallById(req.body?.id);
    res.json(result);
  }));

  // ── POST /api/source/:id/:method ────────────────────────────────────────────
  // Whitelisted methods only — arbitrary method names are rejected.
  router.post('/api/source/:id/:method', requireValidIdParam('id'), asyncHandler(async (req, res) => {
    const { id, method } = req.params;
    const body = req.body || {};

    const { getLocalService } = require('./local');
    const localService = getLocalService ? getLocalService() : null;

    // Prefer offline pages if downloaded
    if (localService && method === 'pages' && body.mangaId && body.chapterId) {
      const offlinePages = await localService.getOfflinePages(id, body.mangaId, body.chapterId);
      if (offlinePages) return res.json(offlinePages);
    }

    try {
      const result = await sourceDispatchService.dispatch({ id, method, body });
      res.json(result);
    } catch (e) {
      if (localService && body.mangaId) {
        if (method === 'mangaDetails') {
          const synthetic = await localService.getSyntheticMangaDetails(id, body.mangaId);
          if (synthetic) return res.json(synthetic);
        } else if (method === 'chapters') {
          const synthetic = await localService.getSyntheticChapters(id, body.mangaId);
          if (synthetic) return res.json(synthetic);
        }
      }
      throw e;
    }
  }));

  // ── GET /api/popular-all ───────────────────────────────────────────────────
  router.get('/api/popular-all', asyncHandler(async (req, res) => {
    const response = await popularAllService.getPopularAll();
    res.json(response);
  }));
}

// Allow other modules (e.g. sourceLoader) to invalidate the popular-all cache.
function invalidatePopularCache() {
  popularAllService.invalidate();
}

module.exports = { registerSourceRoutes, invalidatePopularCache };
