'use strict';

const limits = require('../../config/limits');

const CHAPTERS_PER_FEED = 96;

// Resolves calendar entries' MangaDex chapter-release dates: title -> UUID
// lookup, then batch chapter-feed fetching for whichever UUIDs resolved.
function createMangaDexDatesService() {
  const titleCache = new Map();

  async function resolveMangaDexId(title) {
    const key = title.trim().toLowerCase();
    if (titleCache.has(key)) return titleCache.get(key);
    try {
      const params = new URLSearchParams({ title: title.trim().slice(0, 100), limit: '10', 'order[relevance]': 'desc' });
      for (const rating of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', rating);
      const res = await fetch(`https://api.mangadex.org/manga?${params}`, { signal: AbortSignal.timeout(limits.fetchTimeoutMs) });
      if (!res.ok) {
        titleCache.set(key, null);
        return null;
      }

      const json = await res.json();
      const results = json.data || [];
      if (!results.length) {
        titleCache.set(key, null);
        return null;
      }

      let bestId = results[0].id;
      for (const manga of results) {
        const allTitles = [
          ...Object.values(manga.attributes.title || {}),
          ...(manga.attributes.altTitles || []).flatMap(entry => Object.values(entry)),
        ].map(value => value.trim().toLowerCase());
        if (allTitles.includes(key)) {
          bestId = manga.id;
          break;
        }
      }

      titleCache.set(key, bestId);
      return bestId;
    } catch (err) {
      console.error('[calendar] resolve error:', title, err.message);
      titleCache.set(key, null);
      return null;
    }
  }

  async function fetchBatchMangaChapters(uuids) {
    const results = await Promise.all(uuids.map(async (uuid) => {
      try {
        const params = new URLSearchParams({
          limit: String(CHAPTERS_PER_FEED),
          'order[publishAt]': 'desc',
          includeExternalUrl: '0',
        });
        for (const rating of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', rating);

        const res = await fetch(
          `https://api.mangadex.org/manga/${encodeURIComponent(uuid)}/feed?${params}`,
          { signal: AbortSignal.timeout(limits.fetchTimeoutMs) }
        );
        if (!res.ok) return { uuid, chapters: [] };

        const data = await res.json();
        const chapters = (data.data || [])
          .map(chapter => ({
            date: new Date(chapter.attributes.publishAt || chapter.attributes.readableAt || 0),
            chapter: String(chapter.attributes.chapter || '?').trim().slice(0, 20),
            id: chapter.id,
          }))
          .filter(chapter => !isNaN(chapter.date.getTime()) && chapter.date.getTime() > 0)
          .sort((a, b) => a.date - b.date);
        return { uuid, chapters };
      } catch (err) {
        console.error('[calendar] feed error:', uuid, err.message);
        return { uuid, chapters: [] };
      }
    }));

    return new Map(results.map(result => [result.uuid, result.chapters]));
  }

  return { resolveMangaDexId, fetchBatchMangaChapters };
}

module.exports = { createMangaDexDatesService };
