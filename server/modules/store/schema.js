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
  store.customLists = Array.isArray(store.customLists) ? store.customLists : [];
  store.achievements = Array.isArray(store.achievements) ? store.achievements : [];

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
}

module.exports = { normaliseStore };