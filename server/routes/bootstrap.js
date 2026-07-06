'use strict';

function registerAppRoutes(app) {
  const { registerProxyRoutes } = require('./proxy');
  const { registerRepoRoutes } = require('./repos');
  const { registerLocalRoutes } = require('./local');
  const { registerSourceRoutes } = require('./sources');
  const { registerLibraryRoutes, startDailyLibrarySync } = require('./library');
  const { registerDownloadRoutes } = require('./downloads');
  const { registerReviewRoutes } = require('./reviews');
  const { registerListRoutes } = require('./lists');
  const { registerAnalyticsRoutes } = require('./analytics');
  const { registerAchievementRoutes } = require('./achievements');
  const { registerMangaUpdatesRoutes } = require('./mangaupdates');
  const { registerCalendarRoutes } = require('./calendar');
  const { registerThemePresetRoutes } = require('./theme-presets');
  const { registerCoverSearchRoutes } = require('./cover-search');
  const { registerHealthCheckRoutes } = require('./health-check');
  const { registerSystemHealthRoutes } = require('./system-health');

  registerProxyRoutes(app);
  registerRepoRoutes(app);
  registerLocalRoutes(app);
  registerSourceRoutes(app);
  registerLibraryRoutes(app);
  startDailyLibrarySync();
  registerDownloadRoutes(app);
  registerReviewRoutes(app);
  registerListRoutes(app);
  registerAnalyticsRoutes(app);
  registerAchievementRoutes(app);
  registerMangaUpdatesRoutes(app);
  registerCalendarRoutes(app);
  registerThemePresetRoutes(app);
  registerCoverSearchRoutes(app);
  registerHealthCheckRoutes(app);
  registerSystemHealthRoutes(app);
}

module.exports = { registerAppRoutes };