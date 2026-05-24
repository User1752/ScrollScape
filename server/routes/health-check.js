/**
 * routes/health-check.js — Source health check + error log HTTP endpoints
 *
 * Endpoints:
 *   GET /api/sources/health-check — Run a probe search() on every installed source
 *   GET /api/error-log            — Read known errors from data/error-log.json
 *                                   Optional query param: ?area=mangadex
 *
 * Response shape:
 *   {
 *     ok: true,
 *     total: 4,
 *     passing: 3,
 *     failing: 1,
 *     results: [
 *       { id: 'mangadex', name: 'MangaDex', ok: true },
 *       { id: 'broken',   name: 'Broken',   ok: false, error: '...' }
 *     ]
 *   }
 */

'use strict';

const path                           = require('path');
const fsp                            = require('fs').promises;
const { createSourceHealthCheckService } = require('../modules/sources/health-check');
const { readStore }          = require('../store');
const { loadSourceFromFile } = require('../sourceLoader');
const { createAsyncHandler } = require('../modules/http/async-handler');

const asyncHandler = createAsyncHandler('HEALTH_CHECK');

const healthCheckService = createSourceHealthCheckService({ readStore, loadSourceFromFile });

/**
 * @param {import('express').Application} app
 */
function registerHealthCheckRoutes(app) {
  app.get('/api/sources/health-check', asyncHandler(async (_req, res) => {
    const results  = await healthCheckService.runHealthCheck();
    const passing  = results.filter(r => r.ok).length;
    const failing  = results.filter(r => !r.ok).length;

    res.json({
      ok: true,
      total:   results.length,
      passing,
      failing,
      results,
    });
  }));

  // ── GET /api/error-log ───────────────────────────────────────────────────
  // Returns the contents of data/error-log.json sorted by most recent first.
  // Optional ?area=<source-id> to filter by source area.
  app.get('/api/error-log', asyncHandler(async (req, res) => {
    const dataDir = path.resolve(__dirname, '../../data');
    const logPath = path.join(dataDir, 'error-log.json');

    let entries = [];
    try {
      const raw = await fsp.readFile(logPath, 'utf8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      // File doesn't exist yet or is invalid — return empty list gracefully.
      entries = [];
    }

    // Filter by area if requested
    const area = typeof req.query.area === 'string' ? req.query.area.trim() : '';
    if (area) {
      entries = entries.filter(e => e.area === area);
    }

    // Sort: most recently seen first
    entries.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));

    res.json({ ok: true, entries });
  }));

  // ── DELETE /api/error-log ─────────────────────────────────────────────────
  // Clears all recorded errors by writing an empty array to the log file.
  app.delete('/api/error-log', asyncHandler(async (_req, res) => {
    const dataDir = path.resolve(__dirname, '../../data');
    const logPath = path.join(dataDir, 'error-log.json');
    await fsp.writeFile(logPath, '[]', 'utf8');
    res.json({ ok: true });
  }));
}

module.exports = { registerHealthCheckRoutes, healthCheckService };
