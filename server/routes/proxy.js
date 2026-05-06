/**
 * routes/proxy.js — Image proxy endpoint
 *
 * GET /api/proxy-image?url=<encoded>&ref=<encoded>
 *
 * Fetches an image from an external CDN and pipes it back to the client,
 * adding the `Referer` header that some CDNs (e.g. MangaPill) require.
 *
 * Security:
 *  • SSRF guard: the `url` query parameter is checked via isSafeUrl() before
 *    any network request is made.  Loopback / private-range addresses are
 *    rejected unconditionally.
 *  • Content-type allowlist: only known image MIME types are forwarded.
 *    This prevents the upstream origin from using this endpoint to serve
 *    HTML, JavaScript, or other active content to the browser (content-type
 *    confusion / reflected XSS through the proxy).
 *  • Cache headers: successful responses are cached by the browser for 24 h
 *    to reduce repeated proxy traffic.
 */

'use strict';

const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { isSafeUrl } = require('../helpers');

const ALLOWED_IMAGE_CT = /^(image\/(jpeg|png|gif|webp|avif|bmp|svg\+xml)|application\/octet-stream)/i;

/**
 * Higher-order function to encapsulate try-catch blocks for async route handlers.
 */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

/**
 * @param {import('express').Router} router
 */
function registerProxyRoutes(router) {
  // ── POST /api/anilist ────────────────────────────────────────────────────────
  // Proxies AniList GraphQL requests from the browser to avoid CORS issues.
  router.post('/api/anilist', asyncHandler(async (req, res) => {
    const { query, variables } = req.body || {};
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing query' });

    // Forward the Authorization header so authenticated mutations (e.g. SaveMediaListEntry) work.
    // Only allow a well-formed Bearer token to prevent header injection.
    const proxyHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const authHeader = req.headers['authorization'];
    if (authHeader && /^Bearer [A-Za-z0-9\-._~+/]+=*$/.test(authHeader)) {
      proxyHeaders['Authorization'] = authHeader;
    }

    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    
    // In case of non-2xx status, AniList returns a custom payload.
    // Allow pass-through so the frontend can display exact GraphQL errors.
    const data = await aniRes.json();
    res.status(aniRes.status).json(data);
  }));

  // ── GET /api/proxy-image ──────────────────────────────────────────────────────
  router.get('/api/proxy-image', async (req, res) => {
    const { url, ref } = req.query;

    // Validate: must be a public HTTP/HTTPS URL (SSRF guard).
    if (!url || !isSafeUrl(url)) return res.status(400).end();

    // Validate referer origin too — only trust public URLs as a Referer.
    const safeRef = (ref && isSafeUrl(ref)) ? ref : undefined;

    try {
      const imgRes = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          Referer:      safeRef || 'https://mangapill.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!imgRes.ok) return res.status(imgRes.status).end();

      // Allowlist: reject non-image content types.
      const upstreamCt = imgRes.headers.get('content-type') || '';
      if (!ALLOWED_IMAGE_CT.test(upstreamCt)) return res.status(415).end();

      let finalCt = upstreamCt.split(';')[0].trim();
      if (finalCt.includes('octet-stream')) finalCt = 'image/jpeg';
      
      res.set('Content-Type', finalCt);
      res.set('Cache-Control', 'public, max-age=86400');
      
      // Node >16 Readable.fromWeb + pipeline prevents fatal crashes when sockets disconnect prematurely
      const nodeStream = Readable.fromWeb(imgRes.body);
      await pipeline(nodeStream, res);
      
    } catch (e) {
      // Avoid modifying headers if response is already partially sent
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });
}

module.exports = { registerProxyRoutes };
