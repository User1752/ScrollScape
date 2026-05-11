'use strict';

function createMangaUpdatesService() {
  async function searchByTitle({ title } = {}) {
    if (!title || typeof title !== 'string') {
      const err = new Error('title (string) required');
      err.statusCode = 400;
      throw err;
    }

    const safeTitle = title.trim().slice(0, 200);

    const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: safeTitle, perpage: 5 }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!searchRes.ok) {
      const err = new Error(`MangaUpdates search error: ${searchRes.status}`);
      err.statusCode = 502;
      throw err;
    }

    const searchData = await searchRes.json();
    const results = searchData.results || [];
    if (!results.length) {
      return { found: false, message: 'No results found on MangaUpdates' };
    }

    const seriesId = Number(results[0].record?.series_id);
    if (!Number.isFinite(seriesId) || seriesId <= 0) {
      const err = new Error('Invalid series_id in MangaUpdates response');
      err.statusCode = 502;
      throw err;
    }

    const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!detailRes.ok) {
      const err = new Error(`MangaUpdates detail error: ${detailRes.status}`);
      err.statusCode = 502;
      throw err;
    }

    const details = await detailRes.json();

    return {
      found: true,
      seriesId,
      title: results[0].record.title,
      latestChapter: details.latest_chapter || null,
      status: details.status || 'Unknown',
      year: details.year || 'Unknown',
      genres: (details.genres || []).map(g => g.genre),
      url: `https://www.mangaupdates.com/series/${seriesId}`,
    };
  }

  return {
    searchByTitle,
  };
}

module.exports = { createMangaUpdatesService };