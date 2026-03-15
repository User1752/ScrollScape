/**
 * routes/library.js — User library, reading history, favorites, and reading status
 *
 * Endpoints:
 *   GET    /api/library              — Returns favorites + history arrays
 *   POST   /api/library/add          — Add or update a manga in favorites
 *   POST   /api/library/remove       — Remove a manga from favorites
 *   POST   /api/history/add          — Prepend an entry to reading history (cap 100)
 *   POST   /api/history/remove       — Remove a specific history entry
 *   DELETE /api/history/clear        — Wipe all history
 *   POST   /api/favorites/toggle     — Toggle favorite status (add or remove)
 *   GET    /api/user/status          — Return the reading-status map
 *   POST   /api/user/status          — Set / clear reading status for a manga
 *
 * Security:
 *  • All manga payloads are sanitised via safeManga() — only a whitelisted
 *    set of scalar/array fields are written to the store.
 *  • Reading-status composite keys (mangaId:sourceId) are sanitised to
 *    prevent prototype-pollution attacks (__proto__, constructor…).
 *  • The `status` value is validated against a strict whitelist of known
 *    reading states to prevent arbitrary data injection.
 *  • String fields are length-capped throughout.
 */

'use strict';

const { safeManga } = require('../helpers');
const { readStore, writeStore } = require('../store');

/**
 * @param {import('express').Router} router
 */
function registerLibraryRoutes(router) {
  // ── GET /api/library ────────────────────────────────────────────────────────
  router.get('/api/library', async (_req, res) => {
    try {
      const store = await readStore();
      res.json({ favorites: store.favorites || [], history: store.history || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/library/add ───────────────────────────────────────────────────
  router.post('/api/library/add', async (req, res) => {
    try {
      const { mangaId, sourceId, manga } = req.body || {};
      const store    = await readStore();
      const safeEntry = { ...safeManga(manga), sourceId, addedAt: new Date().toISOString() };
      const existing  = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
      if (existing >= 0) store.favorites[existing] = safeEntry;
      else store.favorites.push(safeEntry);
      await writeStore(store);
      res.json({ ok: true, favorites: store.favorites });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/library/remove ────────────────────────────────────────────────
  router.post('/api/library/remove', async (req, res) => {
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

  // ── POST /api/history/add ───────────────────────────────────────────────────
  router.post('/api/history/add', async (req, res) => {
    try {
      const { mangaId, sourceId, manga, chapterId } = req.body || {};
      const store    = await readStore();
      const existing = store.history.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
      if (existing >= 0) store.history.splice(existing, 1);
      store.history.unshift({
        ...safeManga(manga),
        sourceId,
        chapterId: String(chapterId ?? '').slice(0, 200),
        readAt:    new Date().toISOString(),
      });
      store.history = store.history.slice(0, 100); // cap at 100 entries
      await writeStore(store);
      res.json({ ok: true, history: store.history });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/history/remove ────────────────────────────────────────────────
  router.post('/api/history/remove', async (req, res) => {
    try {
      const { mangaId, sourceId } = req.body || {};
      const store = await readStore();
      store.history = store.history.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
      await writeStore(store);
      res.json({ ok: true, history: store.history });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/history/clear ───────────────────────────────────────────────
  router.delete('/api/history/clear', async (_req, res) => {
    try {
      const store   = await readStore();
      store.history = [];
      await writeStore(store);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/favorites/toggle ──────────────────────────────────────────────
  // Sanitises the manga payload via safeManga() so arbitrary client-controlled
  // fields cannot pollute the store.
  router.post('/api/favorites/toggle', async (req, res) => {
    try {
      const { mangaId, sourceId, manga } = req.body || {};
      const store = await readStore();
      const index = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
      let isFavorite;
      if (index > -1) {
        store.favorites.splice(index, 1);
        isFavorite = false;
      } else {
        store.favorites.push({ ...safeManga(manga), id: mangaId, sourceId, addedAt: new Date().toISOString() });
        isFavorite = true;
      }
      await writeStore(store);
      res.json({ success: true, isFavorite, favorites: store.favorites });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/user/status ────────────────────────────────────────────────────
  router.get('/api/user/status', async (_req, res) => {
    try {
      const store = await readStore();
      res.json({ readingStatus: store.readingStatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/user/status ───────────────────────────────────────────────────
  // Pass status: null / "none" to remove the entry.
  // Valid status values mirror the client-side reading-status selector.
  const VALID_STATUSES = new Set(['reading', 'completed', 'on_hold', 'plan_to_read', 'dropped']);

  router.post('/api/user/status', async (req, res) => {
    try {
      const { mangaId, sourceId, status, mangaData } = req.body || {};
      if (!mangaId || !sourceId) return res.status(400).json({ error: 'mangaId and sourceId required' });

      const store = await readStore();
      // Sanitise the composite key to prevent prototype-pollution attacks.
      const key = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);

      if (!status || status === 'none') {
        delete store.readingStatus[key];
      } else {
        // Reject unknown status values to prevent arbitrary data injection.
        if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status value' });
        store.readingStatus[key] = {
          status,
          updatedAt: new Date().toISOString(),
          manga:     safeManga(mangaData),
        };
      }

      await writeStore(store);
      res.json({ ok: true, readingStatus: store.readingStatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerLibraryRoutes };
