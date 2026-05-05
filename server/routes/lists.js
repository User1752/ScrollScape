/**
 * routes/lists.js — Custom manga list management
 *
 * Endpoints:
 *   GET    /api/lists                        — List all custom lists
 *   POST   /api/lists                        — Create a new list
 *   PUT    /api/lists/:id                    — Update list name / description
 *   DELETE /api/lists/:id                    — Delete a list
 *   POST   /api/lists/:id/manga              — Add a manga to a list (idempotent)
 *   DELETE /api/lists/:id/manga/:mangaId     — Remove a manga from a list
 *
 * Security:
 *  • List IDs and manga IDs are length-capped; characters are not further
 *    restricted because they are always compared with strict equality (===).
 *  • Manga payloads added to lists are sanitised via safeManga() to prevent
 *    arbitrary key injection.
 *  • String field lengths are capped: name 100 chars, description 500 chars.
 */

'use strict';

const { safeManga } = require('../helpers');
const { readStore, writeStore } = require('../store');

/**
 * Higher-order function to encapsulate try-catch blocks for async route handlers.
 * 
 * @param {Function} fn 
 */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

async function setMangaCategories(req, res) {
  const { mangaId, sourceId, categoryIds, mangaData } = req.body || {};
  if (!mangaId || !sourceId) {
    return res.status(400).json({ error: 'mangaId and sourceId required' });
  }

  // Validate: categoryIds must be an array of strings, max 50 categories
  const safeIds = Array.isArray(categoryIds)
    ? [...new Set(categoryIds.map(id => String(id).slice(0, 100)))].slice(0, 50)
    : [];

  const store = await readStore();

  // Validate all requested ids actually exist to prevent phantom entries
  const validIds = new Set(store.customLists.map(l => l.id));
  const resolvedIds = safeIds.filter(id => validIds.has(id));

  const mangaKey = `${mangaId}:${sourceId}`;
  const safeItem = mangaData
    ? { ...safeManga(mangaData), sourceId, addedAt: new Date().toISOString() }
    : null;

  for (const list of store.customLists) {
    const shouldBeIn = resolvedIds.includes(list.id);
    const currentIdx = list.mangaItems.findIndex(
      m => m.id === mangaId && (m.sourceId === sourceId || !m.sourceId)
    );
    const isCurrentlyIn = currentIdx >= 0;

    if (shouldBeIn && !isCurrentlyIn) {
      // Add — use provided mangaData or a minimal stub
      const item = safeItem || { id: mangaId, sourceId, addedAt: new Date().toISOString() };
      list.mangaItems.push(item);
    } else if (!shouldBeIn && isCurrentlyIn) {
      // Remove
      list.mangaItems.splice(currentIdx, 1);
    }
  }

  await writeStore(store);
  res.json({ ok: true, mangaKey, categoryIds: resolvedIds });
}

/**
 * @param {import('express').Router} router
 */
function registerListRoutes(router) {
  // ── GET /api/lists ─────────────────────────────────────────────────────────
  router.get('/api/lists', asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json({ lists: store.customLists });
  }));

  // ── POST /api/lists ────────────────────────────────────────────────────────
  router.post('/api/lists', asyncHandler(async (req, res) => {
    const { name, description } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'List name required' });
    
    const store = await readStore();
    const list = {
      id: `list_${Date.now()}`,
      name: name.trim().slice(0, 100),
      description: String(description || '').slice(0, 500),
      mangaItems: [],
      createdAt: new Date().toISOString(),
    };
    
    store.customLists.push(list);
    await writeStore(store);
    res.json({ ok: true, list });
  }));

  // ── PUT /api/lists/:id ─────────────────────────────────────────────────────
  router.put('/api/lists/:id', asyncHandler(async (req, res) => {
    const listId = String(req.params.id || '').slice(0, 100);

    // Route-conflict guard: /api/lists/manga-categories can be captured here.
    if (listId === 'manga-categories') {
      return setMangaCategories(req, res);
    }

    const { name, description } = req.body || {};
    
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    
    if (!list) return res.status(404).json({ error: 'Category not found' });
    
    if (name) list.name = name.trim().slice(0, 100);
    if (description !== undefined) list.description = String(description).slice(0, 500);
    
    await writeStore(store);
    res.json({ ok: true, list });
  }));

  // ── DELETE /api/lists/:id ──────────────────────────────────────────────────
  router.delete('/api/lists/:id', asyncHandler(async (req, res) => {
    const listId = String(req.params.id || '').slice(0, 100);
    const store = await readStore();
    
    store.customLists = store.customLists.filter(l => l.id !== listId);
    
    await writeStore(store);
    res.json({ ok: true });
  }));

  // ── POST /api/lists/:id/manga ──────────────────────────────────────────────
  router.post('/api/lists/:id/manga', asyncHandler(async (req, res) => {
    const listId = String(req.params.id || '').slice(0, 100);
    const { mangaData } = req.body || {};
    
    if (!mangaData?.id) return res.status(400).json({ error: 'mangaData.id required' });
    
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    
    if (!list) return res.status(404).json({ error: 'Category not found' });
    
    if (!list.mangaItems.some(m => m.id === mangaData.id)) {
      list.mangaItems.push({ ...safeManga(mangaData), addedAt: new Date().toISOString() });
    }
    
    await writeStore(store);
    res.json({ ok: true, list });
  }));

  // ── DELETE /api/lists/:id/manga/:mangaId ───────────────────────────────────
  router.delete('/api/lists/:id/manga/:mangaId', asyncHandler(async (req, res) => {
    const listId = String(req.params.id || '').slice(0, 100);
    const mId = String(req.params.mangaId || '').slice(0, 200);
    
    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);
    
    if (!list) return res.status(404).json({ error: 'Category not found' });
    
    list.mangaItems = list.mangaItems.filter(m => m.id !== mId);
    
    await writeStore(store);
    res.json({ ok: true, list });
  }));

  // ── PUT /api/lists/manga-categories ───────────────────────────────────────
  // Atomically sets all category memberships for a manga.
  // Body: { mangaId, sourceId, categoryIds: string[], mangaData? }
  // Adds the manga to each listed category and removes it from any others.
  router.put('/api/lists/manga-categories', asyncHandler(async (req, res) => {
    return setMangaCategories(req, res);
  }));

  // ── GET /api/lists/manga/:mangaId/categories ───────────────────────────────
  // Returns all category IDs that contain a given manga (by mangaId + sourceId query param).
  router.get('/api/lists/manga/:mangaId/categories', asyncHandler(async (req, res) => {
    const mangaId  = String(req.params.mangaId || '').slice(0, 200);
    const sourceId = String(req.query.sourceId || '').slice(0, 100);
    const store = await readStore();

    const categoryIds = store.customLists
      .filter(l => l.mangaItems.some(
        m => m.id === mangaId && (!sourceId || m.sourceId === sourceId || !m.sourceId)
      ))
      .map(l => l.id);

    res.json({ categoryIds });
  }));
}

module.exports = { registerListRoutes };
