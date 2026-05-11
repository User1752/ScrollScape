/**
 * routes/repos.js — Source repository management endpoints
 *
 * Endpoints:
 *   GET    /api/state          — Returns installed sources, repos, available sources
 *   POST   /api/repos          — Add a repo by URL or inline JSON (SSRF-guarded)
 *   DELETE /api/repos?url=...  — Remove a repo by URL
 *
 * Security:
 *  • Repo URLs are SSRF-guarded via isSafeUrl() before any network request.
 *  • Only recognised repo formats are accepted ("jsrepo" or "tachiyomi").
 */

'use strict';

const { isSafeUrl, fetchJson, sha1Short } = require('../helpers');
const { readStore, writeStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createRepoService } = require('../modules/repos/service');
const {
  listAvailableSourcesFromRepos,
  detectRepoKind,
  autoInstallLocalSources,
  loadSourceFromFile,
} = require('../sourceLoader');

const asyncHandler = createAsyncHandler('REPOS');
const repoService = createRepoService({
  readStore,
  writeStore,
  listAvailableSourcesFromRepos,
  detectRepoKind,
  autoInstallLocalSources,
  loadSourceFromFile,
  isSafeUrl,
  fetchJson,
  sha1Short,
});

/**
 * @param {import('express').Router} router
 */
function registerRepoRoutes(router) {
  router.get('/api/state', asyncHandler(async (_req, res) => {
    res.json(await repoService.getState());
  }));

  router.post('/api/repos', asyncHandler(async (req, res) => {
    res.json(await repoService.addRepo(req.body || {}));
  }));

  router.delete('/api/repos', asyncHandler(async (req, res) => {
    res.json(await repoService.deleteRepo(req.query?.url));
  }));
}

module.exports = { registerRepoRoutes };
