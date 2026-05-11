'use strict';

function registerAppRoutes(app) {
  const { registerProxyRoutes } = require('./proxy');
  const { registerRepoRoutes } = require('./repos');
  const { registerLocalRoutes } = require('./local');
  const { registerSourceRoutes } = require('./sources');
  const { registerLibraryRoutes } = require('./library');
  const { registerDownloadRoutes } = require('./downloads');
  const { registerReviewRoutes } = require('./reviews');
  const { registerListRoutes } = require('./lists');
  const { registerAnalyticsRoutes } = require('./analytics');
  const { registerAchievementRoutes } = require('./achievements');
  const { registerMangaUpdatesRoutes } = require('./mangaupdates');
  const { registerCalendarRoutes } = require('./calendar');
  const { registerThemePresetRoutes } = require('./theme-presets');
  const { registerCoverSearchRoutes } = require('./cover-search');

  registerProxyRoutes(app);
  registerRepoRoutes(app);
  registerLocalRoutes(app);
  registerSourceRoutes(app);
  registerLibraryRoutes(app);
  registerDownloadRoutes(app);
  registerReviewRoutes(app);
  registerListRoutes(app);
  registerAnalyticsRoutes(app);
  registerAchievementRoutes(app);
  registerMangaUpdatesRoutes(app);
  registerCalendarRoutes(app);
  registerThemePresetRoutes(app);
  registerCoverSearchRoutes(app);
}

module.exports = { registerAppRoutes };