'use strict';

function normaliseStore(store) {
  if (!store || typeof store !== 'object') return;

  store.repos = Array.isArray(store.repos)
    ? store.repos.map(repo => ({ ...repo, kind: repo.kind || 'jsrepo', name: repo.name || repo.url }))
    : [];

  store.installedSources = store.installedSources || {};
  store.history = store.history || [];
  store.favorites = store.favorites || [];
  store.readingStatus = store.readingStatus || {};
  store.reviews = store.reviews || {};
  
  store.settings = store.settings || {};
  store.settings.flaresolverrUrl = store.settings.flaresolverrUrl || '';
  store.settings.comicVineApiKey = store.settings.comicVineApiKey || '';
  store.customLists = Array.isArray(store.customLists) ? store.customLists : [];
  store.achievements = Array.isArray(store.achievements) ? store.achievements : [];

  // Achievement Points wallet, purchased shop themes, and active theme —
  // previously localStorage-only, which meant clearing browser data (or
  // switching profile) silently wiped a user's AP/themes while the library
  // and history (already stored here) survived untouched. Consolidated
  // into the same server-side store so everything lives in one place.
  store.ap = store.ap && typeof store.ap === 'object' ? store.ap : {};
  store.ap.bonus = Number.isFinite(store.ap.bonus) ? store.ap.bonus : 0;
  store.ap.spent = Number.isFinite(store.ap.spent) ? store.ap.spent : 0;
  store.purchasedThemes = Array.isArray(store.purchasedThemes) ? store.purchasedThemes : ['default'];
  store.activeTheme = typeof store.activeTheme === 'string' && store.activeTheme ? store.activeTheme : 'default';

  store.anilistSync = store.anilistSync || {
    lastImportAt: null,
    importedCount: 0,
    overwriteCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  store.analytics = store.analytics || {
    totalChaptersRead: 0,
    totalTimeSpent: 0,
    readingSessions: [],
    dailyStreak: 0,
    lastReadDate: null,
  };

  // dailyChapterCounts backs the reading-activity heatmap with per-day
  // totals that persist independently of readingSessions' 200-entry cap
  // (see analytics/service.js's recordSession) — added after
  // readingSessions already existed, so backfill it once from whatever
  // session history survived the cap instead of starting existing users
  // off with an empty chart.
  if (!store.analytics.dailyChapterCounts || typeof store.analytics.dailyChapterCounts !== 'object') {
    const counts = {};
    for (const s of (store.analytics.readingSessions || [])) {
      const d = new Date(s.date);
      if (isNaN(d)) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + (Number(s.chaptersRead) || 1);
    }
    store.analytics.dailyChapterCounts = counts;
  }
}

module.exports = { normaliseStore };