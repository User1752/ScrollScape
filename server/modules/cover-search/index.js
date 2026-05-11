'use strict';

const { isSafeUrl } = require('../../helpers');

const DEFAULT_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
};

function safeQuery(v) {
  return String(v || '').trim().slice(0, 120);
}

function safeInt(v, fallback, min, max) {
  const n = Number.parseInt(String(v || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function dedupeUrls(urls, limit) {
  const out = [];
  const seen = new Set();
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchSearchHtml(url, acceptLanguage) {
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_FETCH_HEADERS,
      'Accept-Language': acceptLanguage,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) return null;
  return response.text();
}

function extractGoogleImageUrls(html) {
  const picked = [];
  const raw = String(html || '');
  const normalized = raw
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\x3d/gi, '=')
    .replace(/\\x26/gi, '&');

  const addCandidate = (value) => {
    const cleaned = String(value || '')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&')
      .trim();
    if (!isSafeUrl(cleaned)) return;
    if (/google\.(?:com|[a-z]{2,})\/images\/branding/i.test(cleaned)) return;
    picked.push(cleaned);
  };

  const imgUrlRe = /[?&]imgurl=([^&"'\s>]+)/gi;
  const imgUrlEscapedRe = /imgurl=(https?:\\\/\\\/[^&"'\s>]+)/gi;
  let m;
  while ((m = imgUrlRe.exec(normalized)) !== null) {
    try {
      addCandidate(decodeURIComponent(m[1]));
    } catch {
      // Ignore malformed URL fragments.
    }
  }

  while ((m = imgUrlEscapedRe.exec(normalized)) !== null) {
    try {
      addCandidate(decodeURIComponent(m[1]));
    } catch {
      // Ignore malformed URL fragments.
    }
  }

  const jsonUrlRes = [
    /"ou":"(https?:\\\/\\\/[^"\\]+)"/gi,
    /"murl":"(https?:\\\/\\\/[^"\\]+)"/gi,
    /"imgurl":"(https?:\\\/\\\/[^"\\]+)"/gi,
  ];
  for (const re of jsonUrlRes) {
    while ((m = re.exec(raw)) !== null) addCandidate(m[1]);
  }

  const escapedThumbRe = /https?:\\\/\\\/(?:encrypted-tbn0\.gstatic\.com|[^"'\s<>]+)\\\/[^"'\s<>]+/gi;
  while ((m = escapedThumbRe.exec(raw)) !== null) addCandidate(m[0]);

  if (picked.length === 0) {
    const imgSrcRe = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
    while ((m = imgSrcRe.exec(normalized)) !== null) {
      addCandidate(m[1]);
    }
  }

  return dedupeUrls(picked, 40);
}

function extractBraveImageUrls(html) {
  const raw = String(html || '');
  const picked = [];

  const addCandidate = (value) => {
    const cleaned = String(value || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
    if (!isSafeUrl(cleaned)) return;
    if (/search\.brave\.com\//i.test(cleaned)) return;
    if (/\/icons?\//i.test(cleaned)) return;
    picked.push(cleaned);
  };

  const originalRe = /original:"(https?:\/\/[^"\\]+)"/gi;
  let m;
  while ((m = originalRe.exec(raw)) !== null) addCandidate(m[1]);

  if (picked.length === 0) {
    const imageFieldRe = /(?:url|resized):"(https?:\/\/[^"\\]+)"/gi;
    while ((m = imageFieldRe.exec(raw)) !== null) addCandidate(m[1]);
  }

  return dedupeUrls(picked, 40);
}

async function searchGoogleImageUrls({ q, start, hl, gl }) {
  const url = `https://www.google.com/search?tbm=isch&safe=off&ijn=0&q=${encodeURIComponent(q)}&start=${start}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
  const html = await fetchSearchHtml(url, `${hl},en;q=0.9`);
  if (!html) return [];
  return extractGoogleImageUrls(html);
}

async function searchBraveImageUrls({ q, start, count }) {
  const page = Math.max(1, Math.floor(start / Math.max(1, count)) + 1);
  const url = `https://search.brave.com/images?q=${encodeURIComponent(q)}&page=${page}&source=web`;
  const html = await fetchSearchHtml(url, 'en-US,en;q=0.9');
  if (!html) return [];
  return extractBraveImageUrls(html);
}

/**
 * Resolves cover candidates using Google first, then Brave fallback.
 * Keeps endpoint behavior stable while isolating provider logic.
 */
async function searchCoverImages(rawQuery) {
  const q = safeQuery(rawQuery.q);
  if (!q) {
    const err = new Error('Missing query');
    err.statusCode = 400;
    throw err;
  }

  const start = safeInt(rawQuery.start, 0, 0, 200);
  const count = safeInt(rawQuery.count, 12, 1, 30);
  const gl = String(rawQuery.gl || 'us').slice(0, 8);
  const hl = String(rawQuery.hl || 'en').slice(0, 8);
  const requestedEngine = String(rawQuery.engine || '').trim().toLowerCase();

  let urls = [];
  let provider = 'Google Images';

  if (requestedEngine !== 'brave') {
    urls = await searchGoogleImageUrls({ q, start, hl, gl });
  }

  if (urls.length === 0) {
    provider = 'Brave Images';
    urls = await searchBraveImageUrls({ q, start, count });
  }

  const limited = urls.slice(0, count);
  const items = limited.map((cover, idx) => ({
    id: `${provider === 'Brave Images' ? 'brave' : 'google'}-${start + idx}`,
    title: q,
    cover,
    provider,
    sourceId: 'google-images',
  }));

  return {
    items,
    hasNextPage: limited.length >= count,
  };
}

module.exports = {
  searchCoverImages,
};
