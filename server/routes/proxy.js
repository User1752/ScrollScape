'use strict';

const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { isSafeUrl } = require('../helpers');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { createProxyService } = require('../modules/proxy/service');

const asyncHandler = createAsyncHandler('PROXY');
const proxyService = createProxyService({ isSafeUrl });

async function sendProxyImageResponse(res, { contentType, cacheControl, body } = {}) {
  res.set('Content-Type', contentType);
  res.set('Cache-Control', cacheControl);

  const nodeStream = Readable.fromWeb(body);
  await pipeline(nodeStream, res);
}

/**
 * @param {import('express').Router} router
 */
function registerProxyRoutes(router) {
  // ── POST /api/anilist ────────────────────────────────────────────────────────
  // Proxies AniList GraphQL requests from the browser to avoid CORS issues.
  router.post('/api/anilist', asyncHandler(async (req, res) => {
    const result = await proxyService.proxyAniList(req.body || {}, req.headers?.authorization);
    res.status(result.status).json(result.data);
  }));

  // ── GET /api/proxy-image ──────────────────────────────────────────────────────
  router.get('/api/proxy-image', asyncHandler(async (req, res) => {
    const result = await proxyService.fetchProxyImage(req.query || {});
    await sendProxyImageResponse(res, result);
  }));
}

module.exports = { registerProxyRoutes };
