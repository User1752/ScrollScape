'use strict';

const SESSION_COOKIE = 'scrollscape_session';

function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) {
      try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
  }
  return out;
}

/**
 * Gates /api/* behind the optional single-password login (see
 * modules/auth/service.js). Deliberately does NOT gate /opds/* — external
 * OPDS readers have no way to run a browser-style cookie login flow, so
 * that route relies on its own rate limit (server.js) instead. Static
 * assets are never gated either: the SPA shell/JS must load unauthenticated
 * so it can render the login screen in the first place.
 *
 * @param {ReturnType<typeof import('../modules/auth/service').createAuthService>} authService
 */
function createAuthGate(authService) {
  const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/status', '/api/auth/logout']);

  return async function authGate(req, res, next) {
    // req.path is relative to wherever this middleware is mounted (Express
    // strips the mount prefix) — e.g. mounted at app.use('/api', ...), a
    // request to /api/auth/login shows up here as req.path === '/auth/login',
    // never matching a full '/api/auth/login' string. req.originalUrl is
    // always the full, unstripped path regardless of mount point.
    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (EXEMPT_PATHS.has(fullPath)) return next();

    let enabled = false;
    try {
      enabled = await authService.isGateEnabled();
    } catch {
      // If the store can't be read yet, fail open rather than locking the
      // app out of its own bootstrap — the rest of the app will surface
      // that error on its own.
      return next();
    }
    if (!enabled) return next();

    const token = parseCookies(req)[SESSION_COOKIE];
    if (authService.isValidSession(token)) return next();

    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  };
}

module.exports = { createAuthGate, parseCookies, SESSION_COOKIE };
