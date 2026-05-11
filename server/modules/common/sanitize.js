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

function isSafeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/\[|\]/g, '');
    return !PRIVATE_IP_RE.test(host) && host !== 'localhost';
  } catch {
    return false;
  }
}

module.exports = {
  safeManga,
  isSafeUrl,
};