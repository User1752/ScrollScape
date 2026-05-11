/**
 * routes/achievements.js — Achievement unlock and query endpoints
 *
 * Endpoints:
 *   GET  /api/achievements          — Return the list of unlocked achievement IDs
 *   POST /api/achievements/unlock   — Unlock an achievement (idempotent)
 *
 * Security:
 *  • Achievement IDs are sanitised to safe identifier characters and capped
 *    at 100 characters to prevent oversized payloads reaching the store.
 *  • Unlock is idempotent: re-submitting an already-unlocked ID is a no-op,
 *    so callers can safely retry without bloating the achievements array.
 */

'use strict';

const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createAchievementService } = require('../modules/achievements/service');

const asyncHandler = createAsyncHandler('ACHIEVEMENTS');
const achievementService = createAchievementService({ readStore, writeStore });

/**
 * @param {import('express').Router} router
 */
function registerAchievementRoutes(router) {
  router.get('/api/achievements/definitions', asyncHandler(async (_req, res) => {
    res.json(await achievementService.getDefinitions());
  }));

  router.get('/api/achievements', asyncHandler(async (_req, res) => {
    res.json(await achievementService.getAchievements());
  }));

  router.post('/api/achievements/unlock', asyncHandler(async (req, res) => {
    res.json(await achievementService.unlockAchievement(req.body || {}));
  }));
}

module.exports = { registerAchievementRoutes };
