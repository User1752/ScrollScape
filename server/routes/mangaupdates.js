/**
 * routes/mangaupdates.js — MangaUpdates series metadata lookup
 *
 * Endpoints:
 *   POST /api/mangaupdates/search — Search MangaUpdates for a series by title
 *
 * Returns enriched metadata (latest chapter, status, year, genres) from the
 * MangaUpdates API.  Results are intended as a supplemental data source,
 * not a replacement for the primary manga source.
 *
 * Security:
 *  • The search query is trimmed and capped at 200 characters before being
 *    sent to the external API.
 *  • The series_id returned by MangaUpdates is validated as a positive finite
 *    integer before being interpolated into a URL.
 *  • All external fetch calls carry an AbortSignal.timeout(10_000) to prevent
 *    a slow MangaUpdates API from blocking the Node.js event loop.
 */

'use strict';

const { createAsyncHandler } = require('../modules/http/async-handler');
const { createMangaUpdatesService } = require('../modules/mangaupdates/service');

const asyncHandler = createAsyncHandler('MANGAUPDATES');
const mangaUpdatesService = createMangaUpdatesService();

/**
 * @param {import('express').Router} router
 */
function registerMangaUpdatesRoutes(router) {
  router.post('/api/mangaupdates/search', asyncHandler(async (req, res) => {
    res.json(await mangaUpdatesService.searchByTitle(req.body || {}));
  }));
}

module.exports = { registerMangaUpdatesRoutes };
