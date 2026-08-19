'use strict';

const limits = require('../../config/limits');
const { isSafeUrl } = require('../common/sanitize');
const IMG_FETCH_TIMEOUT = limits.sourceCallTimeoutMs;

// The one spoofed desktop-Chrome UA string every source and network helper
// in the project sends — used to be typed out independently in a dozen-plus
// places (with three different, undocumented Chrome version numbers between
// them). Exported so sources and other server modules can import this
// instead of hand-rolling their own copy.
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchJson(url, retries = 2) {
  // SSRF guard: reject private/loopback/link-local targets before any network call.
  if (!isSafeUrl(url)) throw new Error('Blocked unsafe URL');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(limits.fetchTimeoutMs),
        headers: { 'User-Agent': 'ScrollScape/1.0' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

// Defaults to this project's own store for drop-in behavior in server.js's
// normal boot, but lifting this module into another project (it's a
// generic HTTP/Cloudflare-bypass helper, arguably the most reusable one in
// the whole server/) shouldn't require dragging server/store.js along —
// call configure({ readStore }) to point it at a different store, or at a
// stub that just returns a fixed flaresolverrUrl.
let _readStore = null;

function configure({ readStore } = {}) {
  if (typeof readStore === 'function') _readStore = readStore;
}

async function getFlaresolverrUrl() {
  try {
    if (!_readStore) _readStore = require('../../store').readStore;
    const store = await _readStore();
    return store?.settings?.flaresolverrUrl || 'http://127.0.0.1:8191/v1';
  } catch {
    return 'http://127.0.0.1:8191/v1';
  }
}

const domainSessions = new Map();

function saveDomainSession(targetUrl, cookies = [], userAgent = '') {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.replace(/^www\./i, '');
    const parts = host.split('.');
    const mainDomain = parts.length > 2 ? parts.slice(-2).join('.') : host;

    const cookieHeader = Array.isArray(cookies)
      ? cookies.map(c => `${c.name}=${c.value}`).join('; ')
      : '';

    const session = {
      cookieHeader,
      userAgent: userAgent || DEFAULT_USER_AGENT,
      timestamp: Date.now()
    };

    domainSessions.set(host, session);
    domainSessions.set(mainDomain, session);
  } catch (_) {}
}

function getDomainSession(targetUrl, refererUrl) {
  const candidates = [];
  if (refererUrl) {
    try {
      const r = new URL(refererUrl);
      const host = r.hostname.replace(/^www\./i, '');
      const parts = host.split('.');
      candidates.push(host);
      if (parts.length > 2) candidates.push(parts.slice(-2).join('.'));
    } catch (_) {}
  }
  if (targetUrl) {
    try {
      const t = new URL(targetUrl);
      const host = t.hostname.replace(/^www\./i, '');
      const parts = host.split('.');
      candidates.push(host);
      if (parts.length > 2) candidates.push(parts.slice(-2).join('.'));
    } catch (_) {}
  }

  for (const d of candidates) {
    if (domainSessions.has(d)) {
      return domainSessions.get(d);
    }
  }
  return null;
}

// Single-flight per domain: when a burst of requests (e.g. a grid of 10
// covers) all miss their session at once, only the first actually calls
// FlareSolverr. The rest await that same in-flight solve and reuse its
// result, instead of each queueing up to redundantly re-solve the same
// challenge one after another (which previously turned one ~10s solve into
// N sequential ones for a page full of images).
const domainFsInflight = new Map();

async function withFsLock(domain, fn) {
  const existing = domainFsInflight.get(domain);
  if (existing) return existing;

  const promise = fn().finally(() => {
    domainFsInflight.delete(domain);
  });
  domainFsInflight.set(domain, promise);
  return promise;
}

// Error messages below are user-facing (batcave.js re-throws err.message
// as-is) and this helper is now shared across multiple scraped sites, so the
// site name must come from the actual URL rather than being hardcoded.
function siteLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'O site';
  }
}

function isBotChallengePage(html) {
  // Some sites (e.g. BatCave) serve a 200 OK "verifying your browser" shell on
  // individual content pages even when a cookie session from an earlier
  // (different) page is reused. It never resolves client-side without a real
  // browser, so treat it the same as a hard challenge and re-solve via
  // FlareSolverr instead of caching/returning it as valid content.
  return html.includes('cdp_flags');
}

function isChromeErrorPage(html) {
  // Detect Chrome/FlareSolverr browser error pages.
  // Chrome error pages embed Google-specific CSS variables and metadata that never appear on real sites.
  if (html.includes('This page isn\'t working') ||
      html.includes('ERR_CONNECTION_TIMED_OUT') ||
      html.includes('ERR_CONNECTION_REFUSED') ||
      html.includes('ERR_NAME_NOT_RESOLVED') ||
      html.includes('ERR_TIMED_OUT') ||
      html.includes('chrome-error://')) {
    return true;
  }
  // Chrome connection error pages always embed these Google-specific CSS variables
  if (html.includes('--google-blue-600') && html.includes('--google-gray-700') &&
      html.includes('name="color-scheme"')) {
    return true;
  }
  return false;
}

async function executeFlareSolverr(targetUrl, solverUrl) {
  let domain = 'default';
  try {
    const parsed = new URL(targetUrl);
    domain = parsed.hostname.replace(/^www\./i, '');
  } catch (_) {}

  return withFsLock(domain, async () => {
  const payload = { cmd: 'request.get', url: targetUrl, maxTimeout: 35000 };
  const res = await fetch(solverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'ok' && data.solution && data.solution.response) {
      saveDomainSession(targetUrl, data.solution.cookies || [], data.solution.userAgent || '');
      let html = data.solution.response;

      if (isChromeErrorPage(html)) {
        throw new Error(`${siteLabel(targetUrl)} unavailable (server unreachable). Try again in a moment.`);
      }

      // If initial load returned JS PoW challenge page before redirecting, retry via direct fetch using saved cookies
      if (html.includes('/_v') && (html.includes('powNonce') || html.includes('pow_hash'))) {
        await new Promise(r => setTimeout(r, 2000));
        const session = getDomainSession(targetUrl);
        const headers = {
          'User-Agent': session?.userAgent || DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        };
        if (session?.cookieHeader) headers['Cookie'] = session.cookieHeader;
        try {
          const directRes = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(15000) });
          if (directRes.ok) {
            const directHtml = await directRes.text();
            if (!directHtml.includes('/_v')) {
              return directHtml;
            }
          }
        } catch (_) {}
      }
      return html;
    }
    throw new Error(`FlareSolverr failed: ${data.message || 'Unknown error'}`);
  });
}

// Solves `url` via FlareSolverr and validates the result. Returns the solved
// HTML, or null when no solver is configured. Throws when the solver itself
// only produced a known error/interstitial page (never caches those upstream).
async function resolveViaSolver(url) {
  const solverUrl = await getFlaresolverrUrl();
  if (!solverUrl) return null;

  const html = await executeFlareSolverr(url, solverUrl);
  if (isChromeErrorPage(html)) {
    throw new Error(`${siteLabel(url)} unavailable (server unreachable). Try again in a moment.`);
  }
  if (html.includes('Connection timed out') || html.includes('Error code 522') || html.includes('Error code 520')) {
    throw new Error(`${siteLabel(url)} server temporarily unavailable (Cloudflare Error 522). Try again in a moment.`);
  }
  if (isBotChallengePage(html)) {
    // FlareSolverr itself got served the bot-check shell instead of real
    // content — surface this as a retryable failure rather than caching it.
    throw new Error(`${siteLabel(url)} unavailable (anti-bot check not resolved). Try again in a moment.`);
  }
  return html;
}

async function fetchText(url, retries = 2) {
  // SSRF guard: reject private/loopback/link-local targets before any network call.
  if (!isSafeUrl(url)) throw new Error('Blocked unsafe URL');

  const session = getDomainSession(url);
  const headers = {
    'User-Agent': session?.userAgent || DEFAULT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (session?.cookieHeader) {
    headers['Cookie'] = session.cookieHeader;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(limits.fetchTimeoutMs),
        headers
      });
      
      if (!res.ok) {
        if (res.status === 403 || res.status === 503) {
          const html = await resolveViaSolver(url);
          if (html !== null) return html;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const text = await res.text();
      // A cookie session saved from a previously-solved page can still get a
      // 200 OK on a *different* page while only serving a bot-check shell
      // (no 403 raised) — treat that the same as an explicit challenge.
      const needsChallengeSolve =
        (text.includes('/_v') && (text.includes('powNonce') || text.includes('pow_hash'))) ||
        text.includes('Just a moment...') ||
        isBotChallengePage(text);

      if (needsChallengeSolve) {
        const html = await resolveViaSolver(url);
        if (html !== null) return html;
      }

      if (isChromeErrorPage(text)) {
        throw new Error(`${siteLabel(url)} unavailable (server unreachable). Try again in a moment.`);
      }

      if (text.includes('Connection timed out') && text.includes('Error code 522')) {
        throw new Error(`${siteLabel(url)} server temporarily unavailable (Cloudflare Error 522). Try again in a moment.`);
      }

      return text;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

async function fetchImageBuffer(url, referer = 'https://mangadex.org/') {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), IMG_FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Referer: referer,
        'User-Agent': DEFAULT_USER_AGENT,
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return Buffer.from(await resp.arrayBuffer());
  } finally {
    clearTimeout(timerId);
  }
}

function createPageUrlResolver({ isSafeUrl }) {
  function resolvePageUrl(page) {
    const raw = typeof page === 'string' ? page : page?.img;
    if (!raw) return null;
    try {
      const url = new URL(raw, 'http://localhost');
      if (url.pathname === '/api/proxy-image') {
        const inner = url.searchParams.get('url');
        const ref = url.searchParams.get('ref');
        if (inner && isSafeUrl(inner)) {
          return { url: inner, referer: ref ? decodeURIComponent(ref) : undefined };
        }
        return null;
      }
    } catch {
      // fall through
    }
    if (isSafeUrl(raw)) return { url: raw, referer: undefined };
    return null;
  }

  return { resolvePageUrl };
}

module.exports = {
  DEFAULT_USER_AGENT,
  configure,
  fetchJson,
  fetchText,
  fetchImageBuffer,
  createPageUrlResolver,
  saveDomainSession,
  getDomainSession,
  executeFlareSolverr,
  getFlaresolverrUrl,
};