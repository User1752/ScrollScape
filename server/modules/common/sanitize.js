'use strict';

const PRIVATE_IP_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i;

function safeManga(manga) {
  if (!manga || typeof manga !== 'object') return {};
  const str = (value, max = 300) => String(value ?? '').slice(0, max);
  const arr = (value) => (Array.isArray(value) ? value.map(entry => str(entry, 100)).slice(0, 50) : []);
  return {
    id: str(manga.id, 100),
    title: str(manga.title),
    cover: str(manga.cover, 500),
    author: str(manga.author),
    description: str(manga.description, 1000),
    status: str(manga.status, 50),
    url: str(manga.url, 500),
    genres: arr(manga.genres),
    type: str(manga.type, 20),
  };
}

// The WHATWG URL parser always normalizes an IPv4-mapped IPv6 host (however
// it was written — dotted "::ffff:127.0.0.1", full "0:0:0:0:0:ffff:127.0.0.1",
// whatever) down to this one compressed hex form, e.g. "::ffff:7f00:1" for
// 127.0.0.1 — so matching just this shape after the fact is enough to catch
// every input spelling, without needing a full IPv6 parser.
function extractMappedIPv4(host) {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isSafeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/\[|\]/g, '');
    if (PRIVATE_IP_RE.test(host) || host === 'localhost') return false;
    const mappedV4 = extractMappedIPv4(host);
    if (mappedV4 && PRIVATE_IP_RE.test(mappedV4)) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  safeManga,
  isSafeUrl,
};