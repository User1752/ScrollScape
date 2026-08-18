'use strict';

const path = require('path');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createSystemHealthService } = require('../modules/system-health/service');
const { readStore } = require('../store');
const { loadSourceFromFile } = require('../sourceLoader');
const { clearErrors } = require('../modules/error-logger');

const asyncHandler = createAsyncHandler('SYSTEM_HEALTH');

const systemHealthService = createSystemHealthService({
  readStore,
  loadSourceFromFile,
  projectRoot: path.resolve(__dirname, '../..'),
  dataDir: path.resolve(__dirname, '../../data'),
});

// Injected from server.js via configure() — the resource monitor's
// middleware has to be attached to the app very early (before any route
// that might respond and end the request first), which is server.js's job,
// but the route reading its snapshot belongs here with the rest of the
// diagnostic API surface. Defaults to a no-op so this route still responds
// sanely if configure() is never called (e.g. in a unit test).
let getResourceSnapshot = () => null;

function configure(opts) {
  if (typeof opts?.getResourceSnapshot === 'function') {
    getResourceSnapshot = opts.getResourceSnapshot;
  }
}

/**
 * @param {import('express').Application} app
 */
function registerSystemHealthRoutes(app) {
  app.get('/api/system/health', asyncHandler(async (_req, res) => {
    const result = await systemHealthService.getHealth();
    res.json(result);
  }));

  app.get('/api/system/resources', (_req, res) => {
    res.json(getResourceSnapshot() || { error: 'Resource monitor not configured' });
  });

  app.get('/api/system/smoke-test', asyncHandler(async (_req, res) => {
    const result = await systemHealthService.runSmokeTest();
    res.json(result);
  }));

  app.delete('/api/health/source-errors', asyncHandler(async (_req, res) => {
    await clearErrors();
    res.json({ ok: true, cleared: true });
  }));
}

module.exports = {
  registerSystemHealthRoutes,
  systemHealthService,
  configure,
};
