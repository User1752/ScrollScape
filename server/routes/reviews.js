/**
 * routes/reviews.js — Per-manga user reviews and ratings
 *
 * Endpoints:
 *   GET    /api/reviews/:mangaId   — Retrieve reviews for a manga
 *   POST   /api/reviews            — Add / prepend a review (keeps last 20)
 *   GET    /api/ratings            — Returns a quick { mangaId: score } map
 *   POST   /api/ratings/clear      — Remove the review (and rating) for a manga
 *   DELETE /api/ratings/:mangaId   — [POSSIVELMENTE OBSOLETO] Functionally identical to
 *                                     POST /api/ratings/clear; kept for backwards compatibility.
 *                                     Client uses POST /api/ratings/clear. REVER para remover.
 *
 * Security:
 *  • Composite keys are sanitised to prevent prototype-pollution attacks
 *    (__proto__, constructor, etc.).
 *  • Rating is clamped to [1, 10] (integer math on the server side).
 *  • Review text is capped at 2 000 characters.
 */

'use strict';

const { safeId } = require('../helpers');
const { readStore, writeStore } = require('../store');

/**
 * @param {import('express').Router} router
 */
function registerReviewRoutes(router) {
  // ── GET /api/reviews/:mangaId ──────────────────────────────────────────────
  router.get('/api/reviews/:mangaId', async (req, res) => {
    try {
      const safeKey = String(req.params.mangaId || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 200);
      const store   = await readStore();
      res.json({ reviews: store.reviews[safeKey] || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/reviews ──────────────────────────────────────────────────────
  router.post('/api/reviews', async (req, res) => {
    try {
      const { mangaId, rating, text } = req.body || {};
      if (!mangaId || !rating) return res.status(400).json({ error: 'mangaId and rating required' });

      // Sanitise key to prevent prototype pollution.
      const safeKey = String(mangaId).replace(/[^a-z0-9:_-]/gi, '_').slice(0, 200);
      if (!safeKey) return res.status(400).json({ error: 'Invalid mangaId' });

      const store = await readStore();
      if (!Object.prototype.hasOwnProperty.call(store.reviews, safeKey)) store.reviews[safeKey] = [];
      store.reviews[safeKey] = [
        {
          rating: Math.min(10, Math.max(1, Number(rating))),
          text:   String(text || '').slice(0, 2000),
          date:   new Date().toISOString(),
        },
        ...store.reviews[safeKey].slice(0, 19),
      ];
      await writeStore(store);
      res.json({ ok: true, reviews: store.reviews[safeKey] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/ratings ───────────────────────────────────────────────────────
  router.get('/api/ratings', async (_req, res) => {
    try {
      const store   = await readStore();
      const ratings = {};
      for (const [mangaId, arr] of Object.entries(store.reviews)) {
        if (arr[0]?.rating) ratings[mangaId] = arr[0].rating;
      }
      res.json({ ratings });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/ratings/clear ────────────────────────────────────────────────
  router.post('/api/ratings/clear', async (req, res) => {
    try {
      const { mangaId } = req.body || {};
      const safeKey = String(mangaId || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 200);
      if (!safeKey) return res.status(400).json({ error: 'Invalid mangaId' });
      const store = await readStore();
      delete store.reviews[safeKey];
      await writeStore(store);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/ratings/:mangaId ───────────────────────────────────────────
  router.delete('/api/ratings/:mangaId', async (req, res) => {
    try {
      const mangaId = String(req.params.mangaId || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 200);
      if (!mangaId) return res.status(400).json({ error: 'Invalid mangaId' });
      const store = await readStore();
      delete store.reviews[mangaId];
      await writeStore(store);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerReviewRoutes };
