/**
 * routes/theme-presets.js — Persist custom theme presets on disk
 *
 * Endpoints:
 *   GET /api/theme-presets  — Returns { presets: [...] }
 *   PUT /api/theme-presets  — Replaces preset list from body.presets
 */

'use strict';

const { createAsyncHandler } = require('../modules/http/async-handler');
const { createThemePresetService } = require('../modules/theme-presets/service');

const asyncHandler = createAsyncHandler('THEME_PRESETS');
const themePresetService = createThemePresetService();

function configure(opts) {
  themePresetService.configure(opts);
}

function registerThemePresetRoutes(router) {
  router.get('/api/theme-presets', asyncHandler(async (_req, res) => {
    res.json(await themePresetService.getPresets());
  }));

  router.put('/api/theme-presets', asyncHandler(async (req, res) => {
    res.json(await themePresetService.replacePresets(req.body || {}));
  }));
}

module.exports = { configure, registerThemePresetRoutes };
