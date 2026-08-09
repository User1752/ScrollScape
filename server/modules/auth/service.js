'use strict';

/**
 * Optional single-password gate for this self-hosted app.
 *
 * Off by default — store.settings.accessPasswordHash is unset until the
 * user explicitly sets a password in Settings, so existing installs behave
 * exactly as before. Meant for "I'm exposing this beyond localhost (LAN,
 * port-forward, reverse proxy) and want at least one password in front of
 * it" — not a multi-user system. Sessions are a random token kept in an
 * in-process Map, not a JWT/signed cookie, since there is nothing here that
 * needs to survive a server restart or scale beyond one process.
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — convenience gate, not a bank
const PBKDF2_ITERATIONS = 100_000;

const sessions = new Map(); // token -> expiresAt (ms)

function hashPassword(password, saltHex) {
  return crypto.pbkdf2Sync(String(password || ''), Buffer.from(saltHex, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}

function createAuthService({ readStore, writeStore }) {
  async function isGateEnabled() {
    const store = await readStore();
    return !!(store.settings?.accessPasswordHash && store.settings?.accessPasswordSalt);
  }

  async function getStatus(token) {
    return { passwordSet: await isGateEnabled(), authenticated: isValidSession(token) };
  }

  async function setPassword({ newPassword, currentPassword } = {}) {
    const store = await readStore();
    store.settings = store.settings || {};
    const hadPassword = !!(store.settings.accessPasswordHash && store.settings.accessPasswordSalt);

    if (hadPassword) {
      // Changing or removing an existing password requires the current one —
      // otherwise anyone with an already-open (but unattended) session could
      // silently disable the gate.
      const attempt = hashPassword(currentPassword, store.settings.accessPasswordSalt);
      const stored = store.settings.accessPasswordHash;
      const match = attempt.length === stored.length && crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(stored));
      if (!match) {
        const err = new Error('Current password is incorrect');
        err.statusCode = 401;
        throw err;
      }
    }

    if (!newPassword) {
      delete store.settings.accessPasswordHash;
      delete store.settings.accessPasswordSalt;
    } else {
      const salt = crypto.randomBytes(16).toString('hex');
      store.settings.accessPasswordSalt = salt;
      store.settings.accessPasswordHash = hashPassword(newPassword, salt);
    }

    // Changing (or removing) the password invalidates every existing
    // session — otherwise a stolen old session token would keep working
    // right through a password change meant to shut it out.
    sessions.clear();

    await writeStore(store);
    return { ok: true, passwordSet: !!newPassword };
  }

  async function login(password) {
    const store = await readStore();
    const hash = store.settings?.accessPasswordHash;
    const salt = store.settings?.accessPasswordSalt;
    if (!hash || !salt) return { ok: true, token: null }; // gate isn't on — nothing to check

    const attempt = hashPassword(password, salt);
    const match = attempt.length === hash.length && crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(hash));
    if (!match) {
      const err = new Error('Incorrect password');
      err.statusCode = 401;
      throw err;
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return { ok: true, token };
  }

  function logout(token) {
    if (token) sessions.delete(token);
  }

  function isValidSession(token) {
    if (!token) return false;
    const expiresAt = sessions.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  return { isGateEnabled, getStatus, setPassword, login, logout, isValidSession };
}

module.exports = { createAuthService };
