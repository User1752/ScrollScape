const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
  meta: {
    id: "mangadex",
    name: "MangaDex",
    version: "1.0.0",
    author: "MangaDex API"
  },

  async search(query, page = 1) {
    const limit = 20;
    const offset = (page - 1) * limit;
    
    // Se query for "*" ou vazia, buscar manga populares/recentes
    let url;
    if (!query || query === "*") {
      url = `https://api.mangadex.org/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&order[followedCount]=desc`;
    } else {
      url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author`;
    }
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
    const data = await res.json();

    const results = (data.data || []).map(manga => {
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
    });

    return {
      results,
      hasNextPage: data.total > offset + limit
    };
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
      author: authorRel?.attributes?.name || "",
      description: manga.attributes.description.en || manga.attributes.description[Object.keys(manga.attributes.description)[0]] || "",
      cover: coverId ? `https://uploads.mangadex.org/covers/${manga.id}/${coverId}.512.jpg` : "",
      status: manga.attributes.status || "unknown"
    };
  },

  async chapters(mangaId) {
    // Buscar TODOS os capítulos em múltiplas requisições se necessário
    let allChapters = [];
    let offset = 0;
    const limit = 500; // Máximo permitido pela API MangaDex
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
      
      // Verificar se há mais capítulos
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
