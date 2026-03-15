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

const crypto = require('crypto');

// ── ID validation ────────────────────────────────────────────────────────────
/**
 * Validates a source/manga ID.
 * IDs must be 1–80 chars, alphanumeric + hyphen/underscore only.
 * Returns the ID unchanged, or null if invalid.
 *
 * @param {unknown} id
 * @returns {string|null}
 */
function safeId(id) {
  if (typeof id !== 'string') return null;
  return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : null;
}

// ── Manga payload sanitiser ──────────────────────────────────────────────────
/**
 * Strips unknown keys from a client-supplied manga object.
 * Prevents prototype pollution, oversized blobs, and arbitrary key injection
 * into the store.
 *
 * @param {unknown} manga
 * @returns {object}
 */
function safeManga(manga) {
  if (!manga || typeof manga !== 'object') return {};
  const str = (v, max = 300) => String(v ?? '').slice(0, max);
  const arr = (v) => (Array.isArray(v) ? v.map(x => str(x, 100)).slice(0, 50) : []);
  return {
    id:          str(manga.id, 100),
    title:       str(manga.title),
    cover:       str(manga.cover, 500),
    author:      str(manga.author),
    description: str(manga.description, 1000),
    status:      str(manga.status, 50),
    url:         str(manga.url, 500),
    genres:      arr(manga.genres),
    type:        str(manga.type, 20),
  };
}

// ── Hashing ──────────────────────────────────────────────────────────────────
/**
 * Returns the first 12 hex characters of a SHA-1 digest.
 * Used for generating short deterministic IDs (not for security).
 *
 * @param {string} input
 * @returns {string}
 */
function sha1Short(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 12);
}

// ── SSRF guard ───────────────────────────────────────────────────────────────
// Reject URLs resolving to private / loopback address spaces so that the
// image proxy and external API callers cannot be weaponised as an SSRF vector.
// Includes RFC-1918 private ranges, loopback, link-local (169.254/16 — AWS IMDS
// and other cloud metadata endpoints), and IPv6 equivalents.
const PRIVATE_IP_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i;

/**
 * Returns true only for public-internet HTTP/HTTPS URLs.
 *
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isSafeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/\[|\]/g, ''); // strip IPv6 brackets
    return !PRIVATE_IP_RE.test(host) && host !== 'localhost';
  } catch {
    return false;
  }
}

// ── Network helpers ──────────────────────────────────────────────────────────
/**
 * Fetches a URL and returns the parsed JSON body.
 * Enforces a 10 s timeout and throws on non-2xx responses.
 *
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function fetchJson(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetches a URL and returns the raw text body.
 * Enforces a 10 s timeout and throws on non-2xx responses.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Download / offline-save utilities ────────────────────────────────────────
// Shared between routes/downloads.js and routes/local.js to avoid duplication.

/** Max time (ms) to wait for a single image fetch before aborting. */
const IMG_FETCH_TIMEOUT = 30_000;

/**
 * Fetches an image URL and returns the raw Buffer.
 * Used by the chapter-download and offline-save pipelines.
 *
 * @param {string} url
 * @param {string} [referer='https://mangadex.org/']
 * @returns {Promise<Buffer>}
 */
async function fetchImageBuffer(url, referer = 'https://mangadex.org/') {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), IMG_FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Referer:      referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Resolves a page value (bare URL string or `{img}` object) into a
 * `{ url, referer }` pair after applying the SSRF guard.
 * Unwraps `/api/proxy-image?url=...` envelopes to the real upstream URL.
 *
 * @param {string|{img:string}} page
 * @returns {{url:string, referer:string|undefined}|null}
 */
function resolvePageUrl(page) {
  const raw = typeof page === 'string' ? page : page?.img;
  if (!raw) return null;
  try {
    const u = new URL(raw, 'http://localhost');
    if (u.pathname === '/api/proxy-image') {
      const inner = u.searchParams.get('url');
      const ref   = u.searchParams.get('ref');
      if (inner && isSafeUrl(inner))
        return { url: inner, referer: ref ? decodeURIComponent(ref) : undefined };
      return null;
    }
  } catch { /* fall through */ }
  if (isSafeUrl(raw)) return { url: raw, referer: undefined };
  return null;
}

/**
 * Sanitises a string for use as a filesystem filename or directory name.
 * Replaces characters outside `[a-z0-9 _.-]` with underscores, trims
 * surrounding whitespace, and falls back to `'chapter'` when the result
 * would otherwise be empty.
 *
 * @param {string} s
 * @returns {string}
 */
function safeName(s) {
  return String(s || '').replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'chapter';
}

module.exports = { safeId, safeManga, sha1Short, isSafeUrl, fetchJson, fetchText, fetchImageBuffer, resolvePageUrl, safeName };
