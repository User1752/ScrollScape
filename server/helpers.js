/**
 * helpers.js — Shared utility functions for ScrollScape server
 *
 * Exports:
 *   safeId(id)           — Validates and returns a safe alphanumeric ID (or null)
 *   safeManga(manga)     — Whitelist-filters incoming manga objects to prevent injection
 *   sha1Short(input)     — Returns a 12-character SHA-1 hex prefix
 *   isSafeUrl(rawUrl)    — SSRF guard: rejects private/loopback URLs
 *   fetchJson(url)       — Fetches and parses JSON with 10 s timeout
 *   fetchText(url)       — Fetches text with 10 s timeout
 */

'use strict';

const { safeId, sha1Short, safeName } = require('./modules/common/identity');
const { safeManga, isSafeUrl } = require('./modules/common/sanitize');
const {
  fetchJson,
  fetchText,
  fetchImageBuffer,
  createPageUrlResolver,
} = require('./modules/network/fetch-utils');

const { resolvePageUrl } = createPageUrlResolver({ isSafeUrl });

module.exports = { safeId, safeManga, sha1Short, isSafeUrl, fetchJson, fetchText, fetchImageBuffer, resolvePageUrl, safeName };
