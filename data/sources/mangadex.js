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
  return {
    id: manga.id,
    title: manga.attributes.title.en || manga.attributes.title[Object.keys(manga.attributes.title)[0]] || "Unknown",
    author: authorRel?.attributes?.name || "",
    cover: coverId ? `https://uploads.mangadex.org/covers/${manga.id}/${coverId}.256.jpg` : "",
    url: `https://mangadex.org/title/${manga.id}`,
    genres: manga.attributes.tags?.map(t => t.attributes.name.en).filter(Boolean) || [],
    status: manga.attributes.status || "unknown"
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
    throw new Error(`MangaDex API error: ${res.status}`);
  }
}

module.exports = {
  meta: {
    id: "mangadex",
    name: "MangaDex",
    version: "1.0.0",
    author: "MangaDex API"
  },

  async search(query, page = 1, orderBy = '') {
    const limit = 50;
    const offset = (page - 1) * limit;
    const orderParam = buildOrderParam(orderBy, 'followedCount');
    let url;
    if (!query || query === '*') {
      url = `https://api.mangadex.org/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}`;
    } else {
      url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&${orderParam}`;
    }
    const data = await mdFetch(url);
    return {
      results: (data.data || []).map(mapManga),
      hasNextPage: data.total > offset + limit
    };
  },

  // Most followed / overall popular
  async trending() {
    const data = await mdFetch(
      `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[followedCount]=desc&hasAvailableChapters=true`
    );
    return { results: (data.data || []).map(mapManga) };
  },

  // Newest manga (by creation date)
  async recentlyAdded() {
    const data = await mdFetch(
      `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[createdAt]=desc&hasAvailableChapters=true`
    );
    return { results: (data.data || []).map(mapManga) };
  },

  // Most recently updated (last chapter upload)
  async latestUpdates() {
    const data = await mdFetch(
      `https://api.mangadex.org/manga?limit=20&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&hasAvailableChapters=true`
    );
    return { results: (data.data || []).map(mapManga) };
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

  async byGenres(genres, orderBy = '') {
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
    let url;
    if (tagIds.length === 0) {
      url = `https://api.mangadex.org/manga?limit=50&includes[]=cover_art&includes[]=author&${orderParam}&hasAvailableChapters=true`;
    } else {
      const tagParams = tagIds.map(id => `includedTags[]=${id}`).join('&');
      url = `https://api.mangadex.org/manga?limit=50&includes[]=cover_art&includes[]=author&${orderParam}&includedTagsMode=OR&${tagParams}&hasAvailableChapters=true`;
    }
    const data = await mdFetch(url);
    return { results: (data.data || []).map(mapManga) };
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

    const pages = pageFiles.map(file => ({
      img: `${baseUrl}/data/${hash}/${file}`
    }));

    return { pages };
  }
};
