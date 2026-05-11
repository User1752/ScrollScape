'use strict';

const { isSafeUrl } = require('../helpers');

function _safeQuery(v) {
  return String(v || '').trim().slice(0, 120);
}

function _safeInt(v, fallback, min, max) {
  const n = Number.parseInt(String(v || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function _dedupeUrls(urls, limit) {
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

function _extractGoogleImageUrls(html) {
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

  // Full-size image links are often present in imgurl= query params.
  const imgUrlRe = /[?&]imgurl=([^&"'\s>]+)/gi;
  const imgUrlEscapedRe = /imgurl=(https?:\\\/\\\/[^&"'\s>]+)/gi;
  let m;
  while ((m = imgUrlRe.exec(normalized)) !== null) {
    try {
      const decoded = decodeURIComponent(m[1]);
      addCandidate(decoded);
    } catch {
      // Ignore malformed URLs.
    }
  }

  while ((m = imgUrlEscapedRe.exec(normalized)) !== null) {
    try {
      const decoded = decodeURIComponent(m[1]);
      addCandidate(decoded);
    } catch {
      // Ignore malformed URLs.
    }
  }

  // Newer payloads often embed URL fields in compact JSON blobs.
  const jsonUrlRes = [
    /"ou":"(https?:\\\/\\\/[^"\\]+)"/gi,
    /"murl":"(https?:\\\/\\\/[^"\\]+)"/gi,
    /"imgurl":"(https?:\\\/\\\/[^"\\]+)"/gi,
  ];
  for (const re of jsonUrlRes) {
    while ((m = re.exec(raw)) !== null) addCandidate(m[1]);
  }

  // Escaped thumbnail URLs are common even when full-size links are not present.
  const escapedThumbRe = /https?:\\\/\\\/(?:encrypted-tbn0\.gstatic\.com|[^"'\s<>]+)\\\/[^"'\s<>]+/gi;
  while ((m = escapedThumbRe.exec(raw)) !== null) addCandidate(m[0]);

  // Fallback: pick direct img src URLs (often thumbnails) when imgurl is absent.
  if (picked.length === 0) {
    const imgSrcRe = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
    while ((m = imgSrcRe.exec(normalized)) !== null) {
      addCandidate(m[1]);
    }
  }

  return _dedupeUrls(picked, 40);
}

function _extractBraveImageUrls(html) {
  const raw = String(html || '');
  const picked = [];

  const addCandidate = (value) => {
    const cleaned = String(value || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
    if (!isSafeUrl(cleaned)) return;
    if (/search\.brave\.com\//i.test(cleaned)) return;
    if (/\/icons?\//i.test(cleaned)) return;
    picked.push(cleaned);
  };

  // Brave image payload commonly exposes original image URLs as original:"...".
  const originalRe = /original:"(https?:\/\/[^"\\]+)"/gi;
  let m;
  while ((m = originalRe.exec(raw)) !== null) addCandidate(m[1]);

  // Fallback: pick image-like URLs from url/resized fields.
  if (picked.length === 0) {
    const imageFieldRe = /(?:url|resized):"(https?:\/\/[^"\\]+)"/gi;
    while ((m = imageFieldRe.exec(raw)) !== null) addCandidate(m[1]);
  }

  return _dedupeUrls(picked, 40);
}

async function _searchBraveImageUrls({ q, start, count }) {
  const page = Math.max(1, Math.floor(start / Math.max(1, count)) + 1);
  const url = `https://search.brave.com/images?q=${encodeURIComponent(q)}&page=${page}&source=web`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return [];
  const html = await response.text();
  return _extractBraveImageUrls(html);
}

function registerCoverSearchRoutes(router) {
  router.get('/api/cover/google-images', async (req, res) => {
    const q = _safeQuery(req.query.q);
    if (!q) return res.status(400).json({ error: 'Missing query' });

    const start = _safeInt(req.query.start, 0, 0, 200);
    const count = _safeInt(req.query.count, 12, 1, 30);
    const gl = String(req.query.gl || 'us').slice(0, 8);
    const hl = String(req.query.hl || 'en').slice(0, 8);
    const requestedEngine = String(req.query.engine || '').trim().toLowerCase();

    try {
      let urls = [];
      let provider = 'Google Images';

      if (requestedEngine !== 'brave') {
        const url = `https://www.google.com/search?tbm=isch&safe=off&ijn=0&q=${encodeURIComponent(q)}&start=${start}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': `${hl},en;q=0.9`,
            'Cache-Control': 'no-cache',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          const html = await response.text();
          urls = _extractGoogleImageUrls(html);
        }
      }

      if (urls.length === 0) {
        provider = 'Brave Images';
        urls = await _searchBraveImageUrls({ q, start, count });
      }

      urls = urls.slice(0, count);
      const items = urls.map((cover, idx) => ({
        id: `${provider === 'Brave Images' ? 'brave' : 'google'}-${start + idx}`,
        title: q,
        cover,
        provider,
        sourceId: 'google-images',
      }));

      // Use a heuristic for next-page availability.
      const hasNextPage = urls.length >= count;
      res.json({ items, hasNextPage });
    } catch (err) {
      res.status(502).json({ error: err?.message || 'Google search failed' });
    }
  });
}

module.exports = { registerCoverSearchRoutes };
