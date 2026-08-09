'use strict';

const { readStore, writeStore } = require('../store');
const { createAuthService } = require('../modules/auth/service');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { parseCookies, SESSION_COOKIE } = require('../middleware/auth-gate');

const authService = createAuthService({ readStore, writeStore });
const asyncHandler = createAsyncHandler('AUTH');

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // keep in sync with service.js's SESSION_TTL_MS

function setSessionCookie(res, token) {
  // No "Secure" attribute: this app is typically reached over plain HTTP on
  // a LAN/localhost with no automatic TLS — Secure would silently stop the
  // cookie from ever being sent. If this is ever put behind HTTPS, the
  // cookie still works fine either way.
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

/** @param {import('express').Router} router */
function registerAuthRoutes(router) {
  router.get('/api/auth/status', asyncHandler(async (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    res.json(await authService.getStatus(token));
  }));

  router.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    const result = await authService.login(password);
    if (result.token) setSessionCookie(res, result.token);
    res.json({ ok: true });
  }));

  router.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    authService.logout(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Setting/changing/removing the password itself goes through the normal
  // auth gate (server/middleware/auth-gate.js) like any other /api route —
  // if a password is already set, you must already be logged in to change
  // it. Only the very first time (no password set yet) is this reachable
  // without a session, since the gate is off until a password exists.
  router.post('/api/auth/set-password', asyncHandler(async (req, res) => {
    const { newPassword, currentPassword } = req.body || {};
    res.json(await authService.setPassword({ newPassword, currentPassword }));
  }));
}

module.exports = { registerAuthRoutes };
