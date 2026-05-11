'use strict';

const { safeManga } = require('../helpers');
const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createListService } = require('../modules/lists/service');

const asyncHandler = createAsyncHandler('LISTS');

const listService = createListService({
  readStore,
  writeStore,
  safeManga,
});

/**
 * @param {import('express').Router} router
 */
function registerListRoutes(router) {
  router.get('/api/lists', asyncHandler(async (_req, res) => {
    res.json(await listService.getLists());
  }));

  router.post('/api/lists', asyncHandler(async (req, res) => {
    res.json(await listService.createList(req.body || {}));
  }));

  router.put('/api/lists/:id', asyncHandler(async (req, res) => {
    const listId = String(req.params.id || '').slice(0, 100);
    if (listId === 'manga-categories') {
      res.json(await listService.setMangaCategories(req.body || {}));
      return;
    }

    res.json(await listService.updateList(listId, req.body || {}));
  }));

  router.delete('/api/lists/:id', asyncHandler(async (req, res) => {
    res.json(await listService.deleteList(req.params.id));
  }));

  router.post('/api/lists/:id/manga', asyncHandler(async (req, res) => {
    res.json(await listService.addMangaToList(req.params.id, req.body || {}));
  }));

  router.delete('/api/lists/:id/manga/:mangaId', asyncHandler(async (req, res) => {
    res.json(await listService.removeMangaFromList(req.params.id, req.params.mangaId));
  }));

  router.put('/api/lists/manga-categories', asyncHandler(async (req, res) => {
    res.json(await listService.setMangaCategories(req.body || {}));
  }));

  router.get('/api/lists/manga/:mangaId/categories', asyncHandler(async (req, res) => {
    res.json(await listService.getMangaCategories(req.params.mangaId, req.query.sourceId));
  }));
}

module.exports = { registerListRoutes };