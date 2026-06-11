const cheerio = require('cheerio');

const BASE = 'https://kingofshojo.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function extractMangaId(url) {
  const m = url.match(/\/manga\/([^\/]+)/);
  return m ? m[1] : '';
}

async function getHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`KingOfShojo fetch error: ${res.status} ${url}`);
  return res.text();
}

function parseCards($) {
  const results = [];
  $('.bsx').each((_, el) => {
    const a = $(el).find('a').first();
    const href = a.attr('href') || '';
    const id = extractMangaId(href);
    if (!id) return;

    const title = a.attr('title') || $(el).find('.tt').text().trim();
    const img = $(el).find('img').first();
    const cover = img.attr('src') || '';

    results.push({
      id,
      title,
      cover: proxyImg(cover),
      url: href,
      status: 'unknown',
      author: '',
      genres: []
    });
  });
  return results;
}

module.exports = {
  meta: {
    id: 'kingofshojo',
    name: 'KingOfShojo',
    version: '1.0.1',
    author: 'antigravity',
    supportsTrending: true,
    supportsPopularAllTime: true
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    const url = `${BASE}/page/${page}/?s=${encodeURIComponent(query)}`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [], hasNextPage: false };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results, hasNextPage: results.length >= 10 };
  },

  async trending() {
    const url = `${BASE}/manga/?order=trending`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);
    return { results: parseCards($) };
  },

  async popularAllTime() {
    const url = `${BASE}/manga/?order=popular`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);
    return { results: parseCards($) };
  },

  async recentlyAdded() {
    const url = `${BASE}/manga/?order=update`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);
    return { results: parseCards($) };
  },

  async latestUpdates() {
    return this.recentlyAdded();
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    if (!genres || !genres.length) return this.trending();
    const url = `${BASE}/genres/${genres[0].toLowerCase()}/page/${page}/`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [], hasNextPage: false };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results, hasNextPage: results.length >= 10 };
  },

  async authorSearch(authorName) {
    return { results: [], hasNextPage: false };
  },

  async mangaDetails(mangaId) {
    const url = `${BASE}/manga/${mangaId}/`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const title = $('.ts-breadcrumb li:last-child span').text().trim() || $('.entry-title').text().trim() || mangaId;
    const img = $('.thumb img').first();
    const cover = img.attr('src') || '';
    const description = $('.entry-content p').text().trim() || '';

    const genres = [];
    $('.mgen a').each((_, el) => genres.push($(el).text().trim()));

    const author = $('.imptdt:contains("Author") i').text().trim();
    const statusText = $('.imptdt:contains("Status") i').text().trim().toLowerCase();
    
    let status = 'unknown';
    if (statusText.includes('ongoing')) status = 'ongoing';
    else if (statusText.includes('completed')) status = 'completed';

    return {
      id: mangaId,
      title,
      cover: proxyImg(cover),
      description,
      status,
      genres,
      author,
      url
    };
  },

  async chapters(mangaId) {
    const url = `${BASE}/manga/${mangaId}/`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const chapters = [];
    $('#chapterlist li').each((_, el) => {
      const a = $(el).find('a').first();
      const name = $(el).find('.chapternum').text().trim() || a.text().trim();
      const href = a.attr('href') || '';
      
      const chapterId = href.replace(BASE, '').replace(/^\/+/, '').replace(/\/+$/, '');
      if (chapterId) {
        chapters.push({
          id: chapterId,
          name,
          title: name,
          chapter: name,
          url: href,
          publishAt: $(el).find('.chapterdate').text().trim() || null,
          pages: []
        });
      }
    });

    return { chapters };
  },

  async pages(mangaId, chapterId) {
    // In case the caller only passes one argument or swaps them
    const id = chapterId || mangaId;
    const url = `${BASE}/${id}/`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const pages = [];
    $('#readerarea img').each((i, el) => {
      const src = $(el).attr('src') || '';
      if (src) {
        pages.push({
          index: i,
          img: proxyImg(src.trim())
        });
      }
    });

    return { pages };
  }
};
