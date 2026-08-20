'use strict';

const { withTimeout } = require('../common/async-utils');

const MD_TIMEOUT_MS = 20_000;

// Fallback release-date source for manga that don't resolve to a MangaDex
// UUID but whose own installed source is a NATIVE_DATE_SOURCES member (see
// calendar/service.js) — computes intervals straight from that source's
// own dated chapter history instead.
function createNativeDatesService({ loadSourceFromFile }) {
  const sourceChapCache = new Map();
  const nativeChapCache = new Map();
  const SOURCE_CHAP_TTL = 30 * 60_000;

  async function fetchNativeDatedChapters(manga) {
    const cacheKey = `${manga.sourceId}:${manga.id}`;
    const cached = nativeChapCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < SOURCE_CHAP_TTL) return cached.chapters;
    try {
      const src = loadSourceFromFile(manga.sourceId);
      const result = await withTimeout(src.chapters(manga.id), MD_TIMEOUT_MS, 'timeout');
      const chapters = (result?.chapters || [])
        .map(ch => ({
          date: new Date(ch.publishAt || ch.date || 0),
          chapter: String(ch.chapter || '?').trim().slice(0, 20),
          id: ch.id,
        }))
        .filter(ch => !isNaN(ch.date.getTime()) && ch.date.getTime() > 0)
        .sort((a, b) => a.date - b.date);
      nativeChapCache.set(cacheKey, { chapters, ts: Date.now() });
      return chapters;
    } catch (err) {
      console.error('[calendar] native chapters error:', manga.title, err.message);
      nativeChapCache.set(cacheKey, { chapters: [], ts: Date.now() });
      return [];
    }
  }

  async function fetchNativeDatedChaptersBatch(mangaList) {
    const results = await Promise.all(mangaList.map(async (manga) => ({
      key: `${manga.sourceId}:${manga.id}`,
      chapters: await fetchNativeDatedChapters(manga),
    })));
    return new Map(results.map(r => [r.key, r.chapters]));
  }

  async function fetchSourceLatestChapNum(manga) {
    const cacheKey = `${manga.sourceId}:${manga.id}`;
    const cached = sourceChapCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < SOURCE_CHAP_TTL) return cached.num;
    try {
      const src = loadSourceFromFile(manga.sourceId);
      const result = await withTimeout(src.chapters(manga.id), MD_TIMEOUT_MS, 'timeout');
      const chaps = result?.chapters || [];
      if (!chaps.length) {
        sourceChapCache.set(cacheKey, { num: null, ts: Date.now() });
        return null;
      }
      const raw = String(chaps[0]?.chapter || chaps[0]?.name || '');
      const match = raw.match(/(\d+(?:\.\d+)?)/);
      const num = match ? parseFloat(match[1]) : null;
      sourceChapCache.set(cacheKey, { num, ts: Date.now() });
      return num;
    } catch (err) {
      console.error('[calendar] source chap error:', manga.title, err.message);
      sourceChapCache.set(cacheKey, { num: null, ts: Date.now() });
      return null;
    }
  }

  return { fetchNativeDatedChaptersBatch, fetchSourceLatestChapNum };
}

module.exports = { createNativeDatesService };
