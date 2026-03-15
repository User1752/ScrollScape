/**
 * routes/analytics.js — Reading analytics aggregation
 *
 * Endpoints:
 *   GET  /api/analytics           — Returns analytics + computed aggregates
 *   POST /api/analytics/session   — Record a completed reading session
 *
 * The analytics object is stored in the main store.  This module only reads
 * and writes the `store.analytics` sub-object; it does not touch other fields.
 *
 * Security:
 *  • Session duration is clamped to [0, 1440] minutes (max 24 h) to prevent
 *    bogus values from inflating the "time spent" counter.
 *  • Free-form string fields (mangaId, chapterId) are length-capped.
 *
 * Performance:
 *  • readingSessions is capped at 200 entries stored in the store.
 *  • Daily-streak logic is O(1) — two date-string comparisons.
 */

'use strict';

const { readStore, writeStore } = require('../store');

/**
 * @param {import('express').Router} router
 */
function registerAnalyticsRoutes(router) {
  // ── GET /api/analytics ────────────────────────────────────────────────────
  router.get('/api/analytics', async (_req, res) => {
    try {
      const store = await readStore();

      // Compute reading-status distribution from the status map.
      const dist = { reading: 0, completed: 0, on_hold: 0, plan_to_read: 0, dropped: 0 };
      for (const s of Object.values(store.readingStatus)) {
        if (dist[s.status] !== undefined) dist[s.status]++;
      }

      // Single pass over store.reviews: collect latest ratings + count total review entries.
      let ratingSum = 0, ratingCount = 0, totalReviews = 0;
      for (const arr of Object.values(store.reviews)) {
        totalReviews += arr.length;
        const r = arr[0]?.rating;
        if (typeof r === 'number' && r > 0) { ratingSum += r; ratingCount++; }
      }
      const meanScore = ratingCount
        ? Math.round((ratingSum / ratingCount) * 100) / 100
        : null;

      res.json({
        analytics:          store.analytics,
        statusDistribution: dist,
        totalFavorites:     store.favorites.length,
        totalReviews,
        totalLists:         store.customLists.length,
        meanScore,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/analytics/session ───────────────────────────────────────────
  // Called when a reading session ends; `duration` is in minutes.
  router.post('/api/analytics/session', async (req, res) => {
    try {
      const { mangaId, chapterId, duration } = req.body || {};
      const safeMid = String(mangaId   ?? '').slice(0, 200);
      const safeCid = String(chapterId ?? '').slice(0, 200);

      const store = await readStore();
      const a     = store.analytics;

      // Clamp duration: max 1440 min (24 h).
      const mins = Math.min(1440, Math.max(0, Number(duration) || 0));
      a.totalTimeSpent    = (a.totalTimeSpent    || 0) + mins;
      a.totalChaptersRead = (a.totalChaptersRead || 0) + 1;

      // Daily streak: increment if the last read was yesterday; reset if older.
      const todayStr     = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
      if (a.lastReadDate !== todayStr) {
        a.dailyStreak  = a.lastReadDate === yesterdayStr ? (a.dailyStreak || 0) + 1 : 1;
        a.lastReadDate = todayStr;
      }

      a.readingSessions = a.readingSessions || [];
      a.readingSessions.unshift({ mangaId: safeMid, chapterId: safeCid, duration: mins, date: new Date().toISOString() });
      a.readingSessions = a.readingSessions.slice(0, 200);

      await writeStore(store);
      res.json({ ok: true, analytics: store.analytics });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerAnalyticsRoutes };
