/**
 * security.js — Express security middleware for ScrollScape
 *
 * This module registers two sets of middleware:
 *
 *  1. securityHeaders(app)
 *     Sets defensive HTTP response headers:
 *       • X-Content-Type-Options   — prevents MIME-sniffing attacks
 *       • X-Frame-Options          — stops clickjacking via <iframe>
 *       • X-XSS-Protection         — legacy XSS filter hint (belt-and-suspenders)
 *       • Referrer-Policy          — no-referrer: prevents any referrer header being sent
 *       • Content-Security-Policy  — explicit allowlist for scripts, styles, images…
 *
 *  2. rateLimiter(windowMs, maxPerWindow)
 *     A lightweight, zero-dependency, in-process sliding-window rate limiter.
 *     Returns an Express middleware function keyed on the client IP address.
 *     Intended to be applied selectively (e.g. on /api/* only) rather than on
 *     every static-file request.
 *
 *     Defaults:  600 requests / 10 minutes per IP.
 *     On breach: HTTP 429 Too Many Requests with a Retry-After header.
 *
 * Platform note: these headers add zero latency because they are set in-process
 * (no proxies, no extra dependencies).
 */

'use strict';

// ── Security headers ─────────────────────────────────────────────────────────

/**
 * Registers security response headers on the Express app.
 *
 * @param {import('express').Application} app
 */
function applySecurityHeaders(app) {
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options',  'nosniff');
    // DENY: this app has no legitimate use for iframe embedding from any origin.
    res.setHeader('X-Frame-Options',         'DENY');
    res.setHeader('X-XSS-Protection',        '1; mode=block');
    // no-referrer: privacy-first app — never send Referer to external manga sources.
    res.setHeader('Referrer-Policy',         'no-referrer');

    // CSP — allows same-origin content plus trusted CDNs used by the UI.
    // worker-src blob: is required for the PDF.js web worker spawned via a blob URL.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: https:; " +
      "connect-src 'self' https://api.anilist.co https://api.mangaupdates.com https://cdn.jsdelivr.net; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "worker-src blob: 'self'; " +
      "frame-ancestors 'none'"
    );
    next();
  });
}

// ── Rate limiter ─────────────────────────────────────────────────────────────

/**
 * Creates a sliding-window, in-process rate-limiting middleware.
 *
 * Implementation details:
 *  • One Map entry per IP address holds an array of request timestamps.
 *  • On each request, timestamps older than `windowMs` are pruned before
 *    counting, so the window truly slides.
 *  • The Map is never accessed from multiple threads (Node.js is single-
 *    threaded), so no locking is required.
 *  • The prune-on-request approach bounds memory: each entry holds at most
 *    `maxPerWindow` timestamps.
 *  • A periodic cleanup timer removes entries for IPs that have been idle
 *    for more than `windowMs` to prevent unbounded Map growth.
 *
 * @param {number} [windowMs=600_000]      Sliding window size in ms (default 10 min)
 * @param {number} [maxPerWindow=600]      Max requests per window per IP (default 600)
 * @returns {import('express').RequestHandler}
 */
function rateLimiter(windowMs = 600_000, maxPerWindow = 600) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  // Periodically evict idle entries to prevent unbounded memory growth.
  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const fresh = timestamps.filter(t => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else hits.set(ip, fresh);
    }
  }, windowMs).unref(); // .unref() so this timer doesn't prevent process exit

  return function rateLimit(req, res, next) {
    // Never throttle critical bootstrap reads, otherwise the app appears "stuck"
    // with empty sections after a heavy import burst.
    const p = req.path || '';
    if (req.method === 'GET' && (
      p === '/api/state' ||
      p === '/api/library' ||
      p === '/api/user/status' ||
      p === '/api/ratings' ||
      p === '/api/lists' ||
      p === '/api/popular-all' ||
      p === '/api/anilist/sync-meta' ||
      p === '/api/local/list'
    )) {
      return next();
    }

    // Honour X-Forwarded-For set by a trusted reverse proxy, fall back to
    // the direct socket IP.  In standalone-exe mode the server binds to
    // 127.0.0.1 so there is no proxy and req.ip is always the real client.
    const ip  = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = hits.get(ip) || [];
    // Prune expired timestamps before counting (sliding window).
    timestamps = timestamps.filter(t => t > cutoff);

    if (timestamps.length >= maxPerWindow) {
      const retryAfterSec = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: 'Too many requests — please slow down.',
        retryAfter: retryAfterSec,
      });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

module.exports = { applySecurityHeaders, rateLimiter };
