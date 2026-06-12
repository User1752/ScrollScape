'use strict';

const ALLOWED_IMAGE_CT = /^(image\/|application\/octet-stream)/i;

const MAX_CONCURRENT_PROXY = 8;
let currentProxyRequests = 0;
const proxyQueue = [];

async function acquireProxyLock() {
  if (currentProxyRequests < MAX_CONCURRENT_PROXY) {
    currentProxyRequests++;
    return;
  }
  return new Promise(resolve => proxyQueue.push(resolve));
}

function releaseProxyLock() {
  if (proxyQueue.length > 0) {
    const next = proxyQueue.shift();
    next();
  } else {
    currentProxyRequests--;
  }
}

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
    let inferredRef = 'https://mangapill.com';
    try {
      const parsed = new URL(url);
      if (/vortexscans\.org$/i.test(parsed.hostname) || /storage\.vortexscans\.org$/i.test(parsed.hostname)) {
        inferredRef = 'https://vortexscans.org';
      } else if (/kingofshojo\.com$/i.test(parsed.hostname) || /cdn\.kingofshojo\.com$/i.test(parsed.hostname)) {
        inferredRef = 'https://kingofshojo.com';
      } else if (/readdetectiveconan\.com$/i.test(parsed.hostname) || /mangapill\.com$/i.test(parsed.hostname)) {
        inferredRef = 'https://mangapill.com';
      } else if (/mangakatana\.com$/i.test(parsed.hostname)) {
        inferredRef = 'https://mangakatana.com';
      } else {
        inferredRef = parsed.origin;
      }
    } catch (_) {}

    let imgRes;
    await acquireProxyLock();
    try {
      imgRes = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          Referer: safeRef || inferredRef,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
    } catch (e) {
      const err = new Error(`Upstream connection failed: ${e.message}`);
      err.statusCode = 502;
      throw err;
    } finally {
      releaseProxyLock();
    }

    if (!imgRes.ok) {
      const status = Number(imgRes.status) || 502;
      const message = status === 404
        ? 'Upstream image not found (404)'
        : `Upstream image request failed with ${status}`;
      const err = new Error(message);
      if (status === 404) err.expected = true;
      err.statusCode = imgRes.status;
      throw err;
    }



    let upstreamCt = imgRes.headers.get('content-type') || '';
    let finalCt = upstreamCt.split(';')[0].trim();
    const isImage = /^image\//i.test(finalCt);
    const isOctet = /octet-stream|binary/i.test(finalCt);
    const isKnownExt = /\.(jpg|jpeg|png|webp|gif)([?#].*)?$/i.test(url);
    // Se a extensão for de imagem (mesmo com query string), sempre aceita e força o tipo correto
    if (isKnownExt) {
      if (/\.png([?#].*)?$/i.test(url)) finalCt = 'image/png';
      else if (/\.webp([?#].*)?$/i.test(url)) finalCt = 'image/webp';
      else if (/\.gif([?#].*)?$/i.test(url)) finalCt = 'image/gif';
      else finalCt = 'image/jpeg';
    } else if (!isImage && !isOctet) {
      // Log para diagnóstico de URLs rejeitadas
      console.warn('[proxy-image] 415 Unsupported:', url, '| Content-Type:', finalCt);
      const err = new Error('Unsupported upstream content type');
      err.statusCode = 415;
      throw err;
    }

    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    return {
      contentType: finalCt,
      cacheControl: 'public, max-age=86400',
      contentLength: bytes.byteLength,
      body: Buffer.from(bytes),
    };
  }

  return {
    proxyAniList,
    fetchProxyImage,
  };
}

module.exports = { createProxyService };