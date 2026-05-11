'use strict';

const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createAnalyticsService } = require('../modules/analytics/service');

const asyncHandler = createAsyncHandler('ANALYTICS');
const analyticsService = createAnalyticsService({ readStore, writeStore });

/**
 * @param {import('express').Router} router
 */
function registerAnalyticsRoutes(router) {
  router.get('/api/analytics', asyncHandler(async (_req, res) => {
    res.json(await analyticsService.getAnalytics());
  }));

  router.post('/api/analytics/session', asyncHandler(async (req, res) => {
    res.json(await analyticsService.recordSession(req.body || {}));
  }));
}

module.exports = { registerAnalyticsRoutes };