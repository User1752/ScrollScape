'use strict';

const ALLOWED_IMAGE_CT = /^(image\/|application\/octet-stream)/i;

// Some upstreams (e.g. AllManga's CDN, wp.youtube-anime.com) serve genuine
// images over a 200 response with NO Content-Type header at all — neither
// declaring nor lying about it. That's different from a server actively
// claiming a non-image type, which is the case fetchProxyImage's content-type
// check exists to catch (a redirect-to-homepage disguised as an image).
// When there's simply no signal either way, sniffing the real bytes is
// strictly more rigorous than trusting the URL's extension would be.
function sniffImageType(bytes) {
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'image/png';
  }
  if (bytes.length >= 6 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return 'image/gif';
  }
  return null;
}

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

const { getDomainSession, getFlaresolverrUrl, executeFlareSolverr } = require('../network/fetch-utils');

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
      } else if (/batcave\.biz$/i.test(parsed.hostname)) {
        inferredRef = 'https://batcave.biz/';
      } else {
        inferredRef = parsed.origin;
      }
    } catch (_) {}

    const refererHeader = safeRef || inferredRef;
    let session = getDomainSession(url, refererHeader);

    function buildHeaders(sess) {
      const headers = {
        Referer: refererHeader,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': sess?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (sess?.cookieHeader) {
        headers['Cookie'] = sess.cookieHeader;
      }
      return headers;
    }

    let imgRes;
    await acquireProxyLock();
    try {
      imgRes = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: buildHeaders(session),
      });

      // If upstream rejects with 403 and FlareSolverr is available, try refreshing domain session
      if (imgRes.status === 403) {
        const solverUrl = await getFlaresolverrUrl();
        if (solverUrl) {
          try {
            await executeFlareSolverr(refererHeader, solverUrl);
            session = getDomainSession(url, refererHeader);
            imgRes = await fetch(url, {
              signal: AbortSignal.timeout(30_000),
              headers: buildHeaders(session),
            });
          } catch (_) {}
        }
      }
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
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    // The upstream response is the source of truth. A redirect to an
    // unrelated page (e.g. a bad/expired image path bouncing to the site's
    // homepage) still resolves with HTTP 200, so trusting the *requested*
    // URL's file extension over what the server actually sent would let an
    // HTML error page through mislabeled as an image — it downloads fine
    // but can never render, and fails completely silently.
    if (!isImage && !isOctet) {
      // No Content-Type at all (as opposed to an explicit non-image one) —
      // some upstreams just don't send it for genuine images. Sniff the
      // real bytes rather than reject outright or trust the URL blindly.
      const sniffed = finalCt === '' ? sniffImageType(bytes) : null;
      if (sniffed) {
        finalCt = sniffed;
      } else {
        console.warn('[proxy-image] 415 Unsupported:', url, '| Content-Type:', finalCt);
        const err = new Error('Unsupported upstream content type');
        err.statusCode = 415;
        throw err;
      }
    } else {
      // Upstream did send image (or ambiguous octet-stream) data — normalise
      // a vague/incorrect subtype using the URL's extension.
      if (/\.png([?#].*)?$/i.test(url)) finalCt = 'image/png';
      else if (/\.webp([?#].*)?$/i.test(url)) finalCt = 'image/webp';
      else if (/\.gif([?#].*)?$/i.test(url)) finalCt = 'image/gif';
      else if (/\.(jpe?g)([?#].*)?$/i.test(url)) finalCt = 'image/jpeg';
    }

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