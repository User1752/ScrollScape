'use strict';

const ALLOWED_IMAGE_CT = /^(image\/(jpeg|png|gif|webp|avif|bmp|svg\+xml)|application\/octet-stream)/i;

function createProxyService({ isSafeUrl }) {
  async function proxyAniList({ query, variables } = {}, authorizationHeader) {
    if (!query || typeof query !== 'string') {
      const err = new Error('Missing query');
      err.statusCode = 400;
      throw err;
    }

    const proxyHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const authHeader = String(authorizationHeader || '');
    if (authHeader && /^Bearer [A-Za-z0-9\-._~+/]+=*$/.test(authHeader)) {
      proxyHeaders.Authorization = authHeader;
    }

    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await aniRes.json();
    return { status: aniRes.status, data };
  }

  async function fetchProxyImage({ url, ref } = {}) {
    if (!url || !isSafeUrl(url)) {
      const err = new Error('Invalid image URL');
      err.statusCode = 400;
      throw err;
    }

    const safeRef = (ref && isSafeUrl(ref)) ? ref : undefined;
    const imgRes = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Referer: safeRef || 'https://mangapill.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!imgRes.ok) {
      const err = new Error(`Upstream image request failed with ${imgRes.status}`);
      err.statusCode = imgRes.status;
      throw err;
    }

    const upstreamCt = imgRes.headers.get('content-type') || '';
    if (!ALLOWED_IMAGE_CT.test(upstreamCt)) {
      const err = new Error('Unsupported upstream content type');
      err.statusCode = 415;
      throw err;
    }

    let finalCt = upstreamCt.split(';')[0].trim();
    if (finalCt.includes('octet-stream')) finalCt = 'image/jpeg';

    return {
      contentType: finalCt,
      cacheControl: 'public, max-age=86400',
      body: imgRes.body,
    };
  }

  return {
    proxyAniList,
    fetchProxyImage,
  };
}

module.exports = { createProxyService };