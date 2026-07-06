'use strict';

const path = require('path');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createSystemHealthService } = require('../modules/system-health/service');
const { readStore } = require('../store');
const { loadSourceFromFile } = require('../sourceLoader');

const asyncHandler = createAsyncHandler('SYSTEM_HEALTH');

const systemHealthService = createSystemHealthService({
  readStore,
  loadSourceFromFile,
  projectRoot: path.resolve(__dirname, '../..'),
  dataDir: path.resolve(__dirname, '../../data'),
});

/**
 * @param {import('express').Application} app
 */
function registerSystemHealthRoutes(app) {
  app.get('/api/system/health', asyncHandler(async (_req, res) => {
    const result = await systemHealthService.getHealth();
    res.json(result);
  }));

  app.get('/api/system/smoke-test', asyncHandler(async (_req, res) => {
    const result = await systemHealthService.runSmokeTest();
    res.json(result);
  }));
}

module.exports = {
  registerSystemHealthRoutes,
  systemHealthService,
};
