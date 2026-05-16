// Build MangaDex order query param from an orderBy string like 'followedCount', '-title', 'latestUploadedChapter'
function buildOrderParam(orderBy, fallback = 'followedCount') {
  if (!orderBy || orderBy === 'relevance') return `order[${fallback}]=desc`;
  const desc = orderBy.startsWith('-');
  const key  = desc ? orderBy.slice(1) : orderBy;
  const dir  = desc ? 'desc' : 'asc';
  // MangaDex descending makes more sense for most fields except title/year
  const autoDir = ['title', 'year'].includes(key) ? dir : 'desc';
  return `order[${key}]=${autoDir}`;
}

function mapManga(manga) {
  const coverRel = manga.relationships.find(r => r.type === "cover_art");
  const authorRel = manga.relationships.find(r => r.type === "author");
  const coverId = coverRel?.attributes?.fileName;
  const genres = manga.attributes.tags?.map(t => t.attributes.name.en).filter(Boolean) || [];
  const gset = new Set(genres.map(g => String(g).toLowerCase()));
  let format = '';
  if (gset.has('manhwa') || gset.has('webtoon')) format = 'manhwa';
  else if (gset.has('manhua')) format = 'manhua';
  else if (gset.has('doujinshi')) format = 'doujinshi';
  else if (gset.has('oneshot') || gset.has('one shot')) format = 'oneshot';
  else format = 'manga';
  return {
    id: manga.id,
    title: manga.attributes.title.en || manga.attributes.title[Object.keys(manga.attributes.title)[0]] || "Unknown",
    author: authorRel?.attributes?.name || "",
    cover: coverId ? `https://uploads.mangadex.org/covers/${manga.id}/${coverId}.256.jpg` : "",
    url: `https://mangadex.org/title/${manga.id}`,
    genres,
    status: manga.attributes.status || "unknown",
    format,
    contentRating: manga.attributes.contentRating || 'safe',
  };
}

async function mdFetch(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 503 && attempt < retries) {
      // MangaDex is temporarily unavailable — wait before retrying
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      continue;
    }
    // Adiciona mensagem especial para manutenção
    if (res.status === 503) {
      const err = new Error('MangaDex API error: 503 (O site MangaDex está em manutenção ou temporariamente indisponível)');
      err.isMaintenance = true;
      throw err;
    }
    throw new Error(`MangaDex API error: ${res.status}`);
  }
}

module.exports = {
  meta: {
    id: "mangadex",
    name: "MangaDex",
    version: "1.0.0",
    author: "MangaDex API",
    supportsPopularAllTime: true
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    const limit = 50;
    const offset = (page - 1) * limit;
    const orderParam = buildOrderParam(orderBy, 'followedCount');
    const statusParam = filters.publicationStatus ? `&status[]=${encodeURIComponent(filters.publicationStatus)}` : '';
    const ratingParam = filters.contentRating ? `&contentRating[]=${encodeURIComponent(filters.contentRating)}` : '';
    let url;
    if (!query || query === '*') {
      url = `https://api.mangadex.org/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}${statusParam}${ratingParam}`;
    } else {
      url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}${statusParam}${ratingParam}`;
    }
    try {
      const data = await mdFetch(url);
      let results = (data.data || []).map(mapManga);
      if (filters.format) {
        const fmt = String(filters.format).toLowerCase();
        results = results.filter(m => String(m.format || '').toLowerCase() === fmt || (m.genres || []).some(g => String(g).toLowerCase() === fmt));
      }
      // Log known error if no results for a valid query
      if (results.length === 0 && query && query !== '*') {
        try {
          const { MANGADEX_NO_RESULTS } = require('../../server/modules/errors/error-codes');
          const { registerKnownError } = require('../../server/modules/errors/error-registry');
          await registerKnownError({
            logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
            code: MANGADEX_NO_RESULTS,
            area: 'mangadex',
            message: 'MangaDex search returned no results for a valid query.',
            details: { query, url }
          });
        } catch (e) {}
      }
      return {
        results,
        hasNextPage: data.total > offset + limit
      };
    } catch (err) {
      // Log known error for invalid response
      try {
        const { MANGADEX_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGADEX_INVALID_RESPONSE,
          area: 'mangadex',
          message: 'MangaDex search failed or returned invalid response.',
          details: { query, url, error: err.message }
        });
      } catch (e) {}
      const isMaintenance = err && err.isMaintenance;
      return {
        results: [],
        hasNextPage: false,
        error: 'ERR-002',
        errorMessage: isMaintenance
          ? 'MangaDex está em manutenção ou temporariamente indisponível. Tente novamente mais tarde.'
          : 'MangaDex search failed or returned invalid response.'
      };
    }
  },

  // Most followed / overall popular (all-time)
  async popularAllTime() {
    const data = await mdFetch(
      `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[followedCount]=desc&hasAvailableChapters=true`
    );
    return { results: (data.data || []).map(mapManga) };
  },

  // Trending today (by rating)
  async trending() {
    const url = `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[rating]=desc&hasAvailableChapters=true`;
    try {
      const data = await mdFetch(url);
      return { results: (data.data || []).map(mapManga) };
    } catch (err) {
      try {
        const { MANGADEX_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGADEX_INVALID_RESPONSE,
          area: 'mangadex',
          message: 'MangaDex trending failed or returned invalid response.',
          details: { url, error: err.message }
        });
      } catch (e) {}
      const isMaintenance = err && err.isMaintenance;
      return {
        results: [],
        error: 'ERR-002',
        errorMessage: isMaintenance
          ? 'MangaDex está em manutenção ou temporariamente indisponível. Tente novamente mais tarde.'
          : 'MangaDex trending failed or returned invalid response.'
      };
    }
  },

  // Newest manga (by creation date)
  async recentlyAdded() {
    const url = `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[createdAt]=desc&hasAvailableChapters=true`;
    try {
      const data = await mdFetch(url);
      return { results: (data.data || []).map(mapManga) };
    } catch (err) {
      try {
        const { MANGADEX_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGADEX_INVALID_RESPONSE,
          area: 'mangadex',
          message: 'MangaDex recentlyAdded failed or returned invalid response.',
          details: { url, error: err.message }
        });
      } catch (e) {}
      const isMaintenance = err && err.isMaintenance;
      return {
        results: [],
        error: 'ERR-002',
        errorMessage: isMaintenance
          ? 'MangaDex está em manutenção ou temporariamente indisponível. Tente novamente mais tarde.'
          : 'MangaDex recentlyAdded failed or returned invalid response.'
      };
    }
  },

  // Most recently updated (last chapter upload)
  async latestUpdates() {
    const url = `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&hasAvailableChapters=true`;
    try {
      const data = await mdFetch(url);
      return { results: (data.data || []).map(mapManga) };
    } catch (err) {
      try {
        const { MANGADEX_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGADEX_INVALID_RESPONSE,
          area: 'mangadex',
          message: 'MangaDex latestUpdates failed or returned invalid response.',
          details: { url, error: err.message }
        });
      } catch (e) {}
      const isMaintenance = err && err.isMaintenance;
      return {
        results: [],
        error: 'ERR-002',
        errorMessage: isMaintenance
          ? 'MangaDex está em manutenção ou temporariamente indisponível. Tente novamente mais tarde.'
          : 'MangaDex latestUpdates failed or returned invalid response.'
      };
    }
  },

  // Manga that match the given genre names (resolved to MangaDex tag UUIDs)
  async authorSearch(authorName) {
    // Step 1: resolve author name → UUID
    const authorData = await mdFetch(`https://api.mangadex.org/author?name=${encodeURIComponent(authorName)}&limit=5`);
    const authors = authorData.data || [];
    if (!authors.length) return { results: [], hasNextPage: false };
    const authorId = authors[0].id;
    // Step 2: fetch manga by that author UUID
    const data = await mdFetch(
      `https://api.mangadex.org/manga?limit=50&authorOrArtist=${authorId}&includes[]=cover_art&includes[]=author&order[followedCount]=desc`
    );
    return {
      results: (data.data || []).map(mapManga),
      hasNextPage: data.total > 50
    };
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    // Aliases: our genre name → MangaDex tag name (lowercase)
    const aliases = {
      "shoujo ai":      "girls' love",
      "shounen ai":     "boys' love",
      "gender bender":  "gender swap",
      "sci-fi":         "sci-fi",
      "one shot":       "oneshot",
      "school life":    "school life",
      "slice of life":  "slice of life",
      "martial arts":   "martial arts",
    };
    try {
      // Fetch full tag list to resolve names -> UUIDs
      const tagData = await mdFetch(`https://api.mangadex.org/manga/tag`);
      const tagMap = {};
      for (const t of (tagData.data || [])) {
        const name = (t.attributes?.name?.en || "").toLowerCase();
        if (name) tagMap[name] = t.id;
      }
      const tagIds = genres
        .map(g => {
          const key = g.toLowerCase();
          const mapped = aliases[key] || key;
          return tagMap[mapped];
        })
        .filter(Boolean)
        .slice(0, 5);

      const orderParam = buildOrderParam(orderBy, 'followedCount');
      const statusParam = filters.publicationStatus ? `&status[]=${encodeURIComponent(filters.publicationStatus)}` : '';
      const ratingParam = filters.contentRating ? `&contentRating[]=${encodeURIComponent(filters.contentRating)}` : '';
      let url;
      const offset = (page - 1) * 50;
      if (tagIds.length === 0) {
        url = `https://api.mangadex.org/manga?limit=50&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}&hasAvailableChapters=true${statusParam}${ratingParam}`;
      } else {
        const tagParams = tagIds.map(id => `includedTags[]=${id}`).join('&');
        url = `https://api.mangadex.org/manga?limit=50&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}&includedTagsMode=OR&${tagParams}&hasAvailableChapters=true${statusParam}${ratingParam}`;
      }
      const data = await mdFetch(url);
      let results = (data.data || []).map(mapManga);
      if (filters.format) {
        const fmt = String(filters.format).toLowerCase();
        results = results.filter(m => String(m.format || '').toLowerCase() === fmt || (m.genres || []).some(g => String(g).toLowerCase() === fmt));
      }
      return { results, hasNextPage: results.length === 50 };
    } catch (err) {
      try {
        const { MANGADEX_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGADEX_INVALID_RESPONSE,
          area: 'mangadex',
          message: 'MangaDex byGenres failed or returned invalid response.',
          details: { genres, orderBy, filters, page, error: err.message }
        });
      } catch (e) {}
      const isMaintenance = err && err.isMaintenance;
      return {
        results: [],
        hasNextPage: false,
        error: 'ERR-002',
        errorMessage: isMaintenance
          ? 'MangaDex está em manutenção ou temporariamente indisponível. Tente novamente mais tarde.'
          : 'MangaDex byGenres failed or returned invalid response.'
      };
    }
  },

  async mangaDetails(mangaId) {
    const url = `https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
    const data = await res.json();

    const manga = data.data;
    const coverRel = manga.relationships.find(r => r.type === "cover_art");
    const authorRel = manga.relationships.find(r => r.type === "author");
    const coverId = coverRel?.attributes?.fileName;

    return {
      id: manga.id,
      title: manga.attributes.title.en || manga.attributes.title[Object.keys(manga.attributes.title)[0]] || "Unknown",
      altTitle: Object.values(manga.attributes.altTitles?.[0] || {})[0] || "",
      author: authorRel?.attributes?.name || "",
      description: manga.attributes.description.en || manga.attributes.description[Object.keys(manga.attributes.description)[0]] || "",
      cover: coverId ? `https://uploads.mangadex.org/covers/${manga.id}/${coverId}.512.jpg` : "",
      status: manga.attributes.status || "unknown",
      year: manga.attributes.year || null,
      genres: manga.attributes.tags?.map(t => t.attributes.name.en).filter(Boolean) || [],
      lastChapter: manga.attributes.lastChapter ? parseFloat(manga.attributes.lastChapter) : null
    };
  },

  async chapters(mangaId) {
    let allChapters = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.mangadex.org/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&translatedLanguage[]=en&order[chapter]=desc&includeExternalUrl=0`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
      const data = await res.json();

      const chapters = (data.data || []).map(ch => ({
        id: ch.id,
        name: ch.attributes.title || `Chapter ${ch.attributes.chapter || "?"}`,
        chapter: ch.attributes.chapter,
        date: ch.attributes.publishAt || new Date().toISOString()
      }));

      allChapters = allChapters.concat(chapters);
      offset += limit;
      hasMore = data.total > offset;
    }

    return { chapters: allChapters };
  },

  async pages(chapterId) {
    const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
    const data = await res.json();

    const baseUrl = data.baseUrl;
    const hash = data.chapter.hash;
    const pageFiles = data.chapter.data || [];

    const REF = encodeURIComponent('https://mangadex.org');
    const pages = pageFiles.map(file => ({
      img: `/api/proxy-image?url=${encodeURIComponent(`${baseUrl}/data/${hash}/${file}`)}&ref=${REF}`
    }));

    return { pages };
  }
};
