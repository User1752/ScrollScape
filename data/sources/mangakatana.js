const cheerio = require('cheerio');

const BASE = 'https://mangakatana.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

async function getHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`MangaKatana fetch error: ${res.status} ${url}`);
  return res.text();
}

// Parse the common listing format (homepage + search results)
function parseBookList($) {
  const results = [];

  // Homepage uses `#hot_book .item` or `#book_list .item`
  const items = $('#hot_book .item, #book_list .item');
  items.each((_, el) => {
    const imgEl = $(el).find('.wrap_img img');
    const rawCover = imgEl.attr('data-src') || imgEl.attr('src') || '';
    const titleA = $(el).find('h3.title a, .title a');
    const href = titleA.attr('href') || '';
    const title = titleA.text().trim();
    if (!href || !title) return;
    const id = href.replace(`${BASE}/manga/`, '');
    const status = $(el).find('.status').text().trim().toLowerCase() || 'unknown';
    results.push({ id, title, cover: proxyImg(rawCover), url: href, genres: [], status, author: '' });
  });

  return results;
}

module.exports = {
  meta: {
    id: 'mangakatana',
    name: 'MangaKatana',
    version: '1.1.0',
    author: 'scraper'
  },

  async search(query, page = 1) {
    if (!query || query.trim().length < 3) {
      // No query → return homepage trending items
      return this.trending(page);
    }
    const q = encodeURIComponent(query.trim());
    const pageStr = page === 1 ? '' : `page/${page}/`;
    const html = await getHtml(`${BASE}/${pageStr}?search=${q}&search_by=book_name`);
    const $ = cheerio.load(html);
    const results = parseBookList($);

    // Also try flat list from search page
    if (results.length === 0) {
      $('#book_list .item').each((_, el) => {
        const imgEl = $(el).find('.wrap_img img');
        const rawCover = imgEl.attr('data-src') || imgEl.attr('src') || '';
        const titleA = $(el).find('h3.title a');
        const href = titleA.attr('href') || '';
        const title = titleA.text().trim();
        if (!href || !title) return;
        const id = href.replace(`${BASE}/manga/`, '');
        results.push({ id, title, cover: proxyImg(rawCover), url: href, genres: [], status: 'unknown', author: '' });
      });
    }

    return { results, hasNextPage: !!$('.next.page-numbers').length };
  },

  async trending(page = 1) {
    // Homepage shows the hot/latest books — no search query needed
    const html = await getHtml(`${BASE}/`);
    const $ = cheerio.load(html);
    const results = parseBookList($);
    return { results, hasNextPage: false };
  },

  async recentlyAdded(page = 1) { return this.trending(page); },
  async latestUpdates(page = 1) { return this.trending(page); },

  async byGenres(genres, orderBy, filters, page = 1) {
    return this.trending(page);
  },

  async authorSearch(authorName) {
    return this.search(authorName);
  },

  async mangaDetails(mangaId) {
    const url = `${BASE}/manga/${mangaId}`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const title = $('h1.heading').text().trim() || mangaId;

    // Cover image
    const rawCover = $('.cover img').attr('src') || $('.cover img').attr('data-src') || '';

    const description = $('.summary p').text().trim() || $('.summary').text().trim() || '';
    const status = $('.value.status').text().trim().toLowerCase() || 'unknown';
    const author = $('.author a').text().trim() || '';

    // Genres — only from the manga's own info block
    const genres = [];
    const genreLinks = $('.info .genres a, .meta .genres a');
    if (genreLinks.length > 0) {
      genreLinks.each((_, el) => {
        const text = $(el).text().trim();
        if (text && !genres.includes(text)) genres.push(text);
      });
    } else {
      // fallback: use class text_0 links (direct genre links on the page)
      $('a.text_0[href*="/genre/"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text && !genres.includes(text)) genres.push(text);
      });
    }

    return { id: mangaId, title, cover: proxyImg(rawCover), description, status, genres, author, url };
  },

  async chapters(mangaId) {
    const url = `${BASE}/manga/${mangaId}`;
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const chapters = [];
    // Chapters are listed newest-first in .chapters table
    $('.chapters .chapter a, #single_book .chapters a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || !href.includes('/manga/')) return;
      const name = $(el).text().trim();
      const id = href.split('/manga/')[1];
      if (!id) return;
      chapters.push({ id, name, title: name, chapter: name, url: href, publishAt: null, pages: [] });
    });

    return { chapters };
  },

  async pages(chapterId) {
    const url = `${BASE}/manga/${chapterId}`;
    const html = await getHtml(url);

    const pages = [];

    // thzq has the full array of pages; ytaw is only page 1 (preview)
    let match = html.match(/var\s+thzq\s*=\s*\[(.*?)\];/s);
    if (!match) match = html.match(/var\s+ytaw\s*=\s*\[(.*?)\];/s);

    if (match && match[1]) {
      const urls = match[1].match(/'([^']+)'/g);
      if (urls) {
        urls.forEach((u, i) => {
          const cleanUrl = u.replace(/'/g, '');
          pages.push({ index: i, img: proxyImg(cleanUrl) });
        });
      }
    } else {
      // Fallback: img tags inside #imgs
      const cheerioLocal = require('cheerio');
      const $c = cheerioLocal.load(html);
      $c('#imgs .wrap_img img').each((i, el) => {
        const src = $c(el).attr('data-src') || $c(el).attr('src');
        if (src) pages.push({ index: i, img: proxyImg(src) });
      });
    }

    return { pages };
  }
};
