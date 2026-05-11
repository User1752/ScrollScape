'use strict';

const IMG_FETCH_TIMEOUT = 30_000;

async function fetchJson(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchImageBuffer(url, referer = 'https://mangadex.org/') {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), IMG_FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
  fetchJson,
  fetchText,
  fetchImageBuffer,
  createPageUrlResolver,
};