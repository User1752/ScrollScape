const cheerio = require('cheerio');

const BASE = 'https://allmanga.to';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': BASE
};

function normCover(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE + url;
}

module.exports = {
  meta: {
    id: 'allmanga',
    name: 'AllManga.to',
    version: '0.1.0',
    author: 'auto',
    icon: ''
  },

  async search(query, page = 1) {
    const url = `${BASE}/manga?cty=ALL&page=${page}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    $('.manga-list .manga-item').each((_, el) => {
      const a = $(el).find('a.manga-poster');
      const href = a.attr('href') || '';
      const id = href.replace('/manga/', '').split('?')[0];
      const title = a.attr('title') || $(el).find('.manga-title').text().trim();
      const cover = normCover(a.find('img').attr('data-src') || a.find('img').attr('src'));
      results.push({ id, title, cover, url: BASE + href, genres: [], status: 'unknown', author: '' });
    });
    const hasNextPage = $('.pagination .next').length > 0;
    return { results, hasNextPage };
  },
  async trending() {
    // Trending: usar a home (sem query, page 1)
    return this.search('', 1);
  },
  async recentlyAdded() {
    // Recently Added: usar a home (sem query, page 1)
    return this.search('', 1);
  },
  async latestUpdates() {
    // Latest Updates: usar a home (sem query, page 1)
    return this.search('', 1);
  },

  async mangaDetails(mangaId) {
    const url = `${BASE}/manga/${mangaId}`;
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || mangaId;
    const cover = normCover($('.manga-poster img').attr('data-src') || $('.manga-poster img').attr('src'));
    const description = $('.manga-description').text().trim() || '';
    const status = $('.manga-status').text().trim().toLowerCase() || 'unknown';
    const genres = [];
    $('.manga-genres a').each((_, el) => genres.push($(el).text().trim()));
    const author = $('.manga-author').text().trim() || '';
    return { id: mangaId, title, cover, description, status, genres, author, url };
  },

  async chapters(mangaId) {
    const url = `${BASE}/manga/${mangaId}`;
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    const chapters = [];
    $('.chapter-list .chapter-item').each((_, el) => {
      const a = $(el).find('a');
      const href = a.attr('href') || '';
      const id = href.replace('/chapter/', '').split('?')[0];
      const name = a.text().trim();
      chapters.push({ id, name, chapter: name, url: BASE + href, publishAt: null, pages: [] });
    });
    return { chapters };
  },

  async pages(chapterId) {
    const url = `${BASE}/chapter/${chapterId}`;
    const res = await fetch(url, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    const pages = [];
    $('.reader-area img').each((_, el) => {
      const img = $(el).attr('data-src') || $(el).attr('src');
      if (img) pages.push({ img: normCover(img) });
    });
    return { pages };
  }
};
