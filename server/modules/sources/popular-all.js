'use strict';

/**
 * Creates a reusable popular-all aggregator service for sources.
 * Keeps cache and enrichment logic out of HTTP route handlers.
 */
function createPopularAllService({ readStore, loadSourceFromFile, withTimeout, timeoutMs }) {
  // Cached popular-all response — { ts: number, data: object }
  let cache = null;
  const POPULAR_ALL_TTL = 60_000; // 1 minute

  async function enrichPopularBucketMissingGenres(mod, sid, items = [], enrichLimit = 12, enrichConcurrency = 4) {
    if (!Array.isArray(items) || items.length === 0) return items;
    if (typeof mod.mangaDetails !== 'function') return items;

    const out = items.map(m => ({ ...m }));
    const missing = out
      .map((m, idx) => ({ idx, m }))
      .filter(({ m }) => !Array.isArray(m.genres) || m.genres.length === 0)
      .slice(0, enrichLimit);

    if (missing.length === 0) return out;

    let cursor = 0;
    async function worker() {
      while (cursor < missing.length) {
        const at = cursor++;
        const { idx, m } = missing[at];
        try {
          const details = await withTimeout(mod.mangaDetails(m.id || ''), timeoutMs, `${sid}.mangaDetails`);
          if (Array.isArray(details?.genres) && details.genres.length > 0) out[idx].genres = details.genres;
          if ((!out[idx].author || out[idx].author === '') && details?.author) out[idx].author = details.author;
          if ((!out[idx].status || out[idx].status === 'unknown') && details?.status) out[idx].status = details.status;
        } catch (_) {
          // Keep base card data if enrichment fails.
        }
      }
    }

    const workers = Math.min(enrichConcurrency, missing.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return out;
  }

  async function getPopularAll() {
    // Serve from cache if still fresh.
    if (cache && Date.now() - cache.ts < POPULAR_ALL_TTL) {
      return cache.data;
    }

    const store = await readStore();
    const allSourceIds = Object.keys(store.installedSources || {});
    if (!allSourceIds.length) return { results: [] };

    // Only include sources that have a genuine all-time popularity ranking.
    const sourceIds = allSourceIds.filter(sid => {
      try {
        const mod = loadSourceFromFile(sid);
        return mod.meta?.supportsPopularAllTime === true;
      } catch (_) {
        return false;
      }
    });
    if (!sourceIds.length) return { results: [] };

    // Build one bucket per source with max 20 all-time popular titles.
    const settled = await Promise.allSettled(
      sourceIds.map(async (sid) => {
        const mod = loadSourceFromFile(sid);
        let results = [];

        if (typeof mod.popularAllTime === 'function') {
          const r = await withTimeout(mod.popularAllTime(), timeoutMs, `${sid}.popularAllTime`);
          results = (r.results || []).slice(0, 20);
        } else if (typeof mod.trending === 'function') {
          const r = await withTimeout(mod.trending(1), timeoutMs, `${sid}.trending`);
          results = (r.results || []).slice(0, 20);
        } else if (typeof mod.recentlyAdded === 'function') {
          const r = await withTimeout(mod.recentlyAdded(1), timeoutMs, `${sid}.recentlyAdded`);
          results = (r.results || []).slice(0, 20);
        }

        const base = results.map(m => ({
          ...m,
          sourceId: sid,
          sourceName: store.installedSources[sid]?.name || sid,
        }));

        return enrichPopularBucketMissingGenres(mod, sid, base);
      })
    );

    // Interleave source buckets (zip) then de-duplicate by title.
    const buckets = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const seen = new Set();
    const merged = [];
    const maxLen = Math.max(...buckets.map(b => b.length), 0);

    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (i < bucket.length) {
          const key = (bucket[i].title || '').trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(bucket[i]);
          }
        }
      }
    }

    const response = { results: merged.slice(0, 40) };
    cache = { ts: Date.now(), data: response };
    return response;
  }

  function invalidate() {
    cache = null;
  }

  return {
    getPopularAll,
    invalidate,
  };
}

module.exports = {
  createPopularAllService,
};
