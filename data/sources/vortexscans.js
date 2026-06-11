const cheerio = require('cheerio');

const BASE = 'https://vortexscans.org';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function extractMangaId(url) {
  const m = url.match(/\/series\/([^\/]+)$/);
  return m ? m[1] : '';
}

async function getHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`VortexScans fetch error: ${res.status} ${url}`);
  return res.text();
}

function parseCards($) {
  const results = [];
  $('a[href^="/series/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/chapter-')) return; // skip chapters
    const id = extractMangaId(href);
    if (!id) return;

    const text = $(el).text().trim();
    const img = $(el).find('img').first();
    const cover = img.attr('src') || '';

    let existing = results.find(r => r.id === id);
    if (!existing) {
      existing = {
        id,
        title: id,
        cover: '',
        url: BASE + href,
        status: 'unknown',
        author: '',
        genres: []
      };
      results.push(existing);
    }

    if (cover) {
      existing.cover = proxyImg(cover.startsWith('http') ? cover : BASE + cover);
    }
    
    if (text && text.length > 2 && text !== id) {
      const lower = text.toLowerCase();
      // Ignore badges like "Manhwa", "Pinned", etc.
      if (!lower.includes('manhwa') && !lower.includes('manhua') && !lower.includes('pinned')) {
        existing.title = text;
      }
    }
  });
  return results;
}

module.exports = {
  meta: {
    id: 'vortexscans',
    name: 'Vortex Scans',
    version: '1.0.0',
    author: 'antigravity',
    supportsTrending: true,
    supportsPopularAllTime: false
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    const url = `${BASE}/series?page=${page}&q=${encodeURIComponent(query)}`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [], hasNextPage: false };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results, hasNextPage: results.length >= 10 };
  },

  async trending() {
    const html = await getHtml(BASE);
    const $ = cheerio.load(html);
    return { results: parseCards($) };
  },

  async popularAllTime() {
    return this.trending();
  },

  async recentlyAdded() {
    return this.trending();
  },

  async latestUpdates() {
    return this.trending();
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    return this.trending();
  },

  async authorSearch(authorName) {
    return { results: [], hasNextPage: false };
  },

  async mangaDetails(mangaId) {
    const url = `${BASE}/series/${mangaId}`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim() || mangaId;
    const img = $('img').first();
    const rawCover = img.attr('src') || '';
    const cover = rawCover.startsWith('http') ? rawCover : BASE + rawCover;
    const description = $('p').first().text().trim();

    return {
      id: mangaId,
      title,
      cover: proxyImg(cover),
      description,
      status: 'ongoing',
      genres: [],
      author: '',
      url
    };
  },

  async chapters(mangaId) {
    const url = `${BASE}/series/${mangaId}`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const chapters = [];
    $(`a[href^="/series/${mangaId}/chapter-"]`).each((_, el) => {
      const a = $(el);
      
      // Attempt to extract cleaner text
      let name = a.find('span.font-medium').first().text().trim();
      if (!name) name = a.text().trim();

      // Skip read buttons which are just duplicates
      if (name.toLowerCase().startsWith('read chapter') || name.toLowerCase() === 'read first chapter' || name.toLowerCase() === 'read last chapter') return;

      const href = a.attr('href') || '';
      
      const chapterId = href.split('/').pop();
      if (chapterId && !chapters.some(c => c.id === chapterId)) {
        chapters.push({
          id: chapterId,
          name,
          title: name,
          chapter: name,
          url: BASE + href,
          publishAt: null,
          pages: []
        });
      }
    });

    return { chapters };
  },

  async pages(mangaId, chapterId) {
    const cId = chapterId || mangaId; 
    const url = `${BASE}/series/${mangaId}/${cId}`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const pages = [];
    $('img').each((i, el) => {
      let src = $(el).attr('src') || '';
      if (!src) return;
      if (src.includes('avatar') || src.includes('logo') || src.includes('Logo') || src.includes('featured') || src.includes('wsrv.nl') || src.includes('_vcomics') || src.includes('iconify')) return;
      
      pages.push({
        index: pages.length,
        img: proxyImg(src.startsWith('http') ? src : BASE + src)
      });
    });

    return { pages };
  }
};
