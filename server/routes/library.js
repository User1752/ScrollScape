'use strict';

const { safeManga, isSafeUrl } = require('../helpers');
const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createLibraryService } = require('../modules/library/service');

const asyncHandler = createAsyncHandler('LIBRARY');

const libraryService = createLibraryService({
  readStore,
  writeStore,
  safeManga,
  isSafeUrl,
});

/**
 * @param {import('express').Router} router
 */
function registerLibraryRoutes(router) {
  router.get('/api/library', asyncHandler(async (_req, res) => {
    res.json(await libraryService.getLibrary());
  }));

  router.post('/api/library/add', asyncHandler(async (req, res) => {
    res.json(await libraryService.addToLibrary(req.body || {}));
  }));

  router.post('/api/library/remove', asyncHandler(async (req, res) => {
    res.json(await libraryService.removeFromLibrary(req.body || {}));
  }));

  router.post('/api/library/cover', asyncHandler(async (req, res) => {
    res.json(await libraryService.updateLibraryCover(req.body || {}));
  }));

  router.post('/api/history/add', asyncHandler(async (req, res) => {
    res.json(await libraryService.addHistoryEntry(req.body || {}));
  }));

  router.post('/api/history/remove', asyncHandler(async (req, res) => {
    res.json(await libraryService.removeHistoryEntry(req.body || {}));
  }));

  router.delete('/api/history/clear', asyncHandler(async (_req, res) => {
    res.json(await libraryService.clearHistory());
  }));

  router.post('/api/favorites/toggle', asyncHandler(async (req, res) => {
    res.json(await libraryService.toggleFavorite(req.body || {}));
  }));

  router.get('/api/user/status', asyncHandler(async (_req, res) => {
    res.json(await libraryService.getUserStatus());
  }));

  router.post('/api/user/status', asyncHandler(async (req, res) => {
    res.json(await libraryService.setUserStatus(req.body || {}));
  }));

  router.post('/api/anilist/import-apply', asyncHandler(async (req, res) => {
    res.json(await libraryService.importAniListLibrary(req.body || {}));
  }));

  router.post('/api/anilist/resolve-apply', asyncHandler(async (req, res) => {
    res.json(await libraryService.resolveAniListLibrary(req.body || {}));
  }));

  router.get('/api/anilist/sync-meta', asyncHandler(async (_req, res) => {
    res.json(await libraryService.getAniListSyncMeta());
  }));

  router.post('/api/library/migrate', asyncHandler(async (req, res) => {
    res.json(await libraryService.migrateLibrary(req.body || {}));
  }));

  router.delete('/api/library/clear', asyncHandler(async (_req, res) => {
    res.json(await libraryService.clearLibrary());
  }));
}

module.exports = { registerLibraryRoutes };