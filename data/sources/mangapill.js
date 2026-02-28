const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');

const BASE = 'https://mangapill.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

// Route all image URLs through the server proxy so the CDN receives the right Referer
function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

// Normalise a relative-or-absolute cover URL and wrap it in the proxy
function normCover(raw) {
  if (!raw) return '';
  return proxyImg(raw.startsWith('http') ? raw : BASE + raw);
}

async function getHtml(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`MangaPill fetch error: ${res.status} ${url}`);
  return res.text();
}

// ── Card parsers ─────────────────────────────────────────────────────────────

// Cards on /search results pages
function parseSearchCards($) {
  const results = [];
  $('div.grid > div').each((_, el) => {
    const a     = $(el).find('a').first();
    const img   = $(el).find('img');
    const titleEl = $(el).find('a').last().find('div').first();
    const href  = a.attr('href') || '';
    if (!href.startsWith('/manga/')) return;
    const id    = href.replace('/manga/', '').split('?')[0];
    const raw   = img.attr('data-src') || img.attr('src') || '';
    const title = titleEl.text().trim() || $(el).find('a').last().text().trim();
    results.push({ id, title, cover: normCover(raw), url: BASE + href, genres: [], status: 'unknown', author: '' });
  });
  return results;
}

// Cards on /chapters (latest-updates layout)
function parseChapterCards($) {
  const results = [];
  $('.grid > div:not([class])').each((_, el) => {
    const imgEl   = $(el).find('img');
    const mangaA  = $(el).find('a[href^="/manga/"]').first();
    const titleEl = $(el).find('a:not(:first-child) > div').first();
    const href    = mangaA.attr('href') || '';
    if (!href) return;
    const id    = href.replace('/manga/', '').split('?')[0];
    const raw   = imgEl.attr('data-src') || imgEl.attr('src') || '';
    const title = titleEl.text().trim() || mangaA.text().trim();
    results.push({ id, title, cover: normCover(raw), url: BASE + href, genres: [], status: 'unknown', author: '' });
  });
  return results;
}

// Shared helper for trending / recentlyAdded / latestUpdates
async function getFromChaptersPage(limit = 20) {
  const html = await getHtml(`${BASE}/chapters`);
  const $    = cheerio.load(html);
  const seen = new Set();
  return parseChapterCards($)
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .slice(0, limit);
}

// ── Module export ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    id: 'mangapill',
    name: 'MangaPill',
    version: '1.1.0',
    author: 'scraper'
  },

  async search(query, page = 1) {
    const html = await getHtml(`${BASE}/search?q=${encodeURIComponent(query)}&page=${page}`);
    const $ = cheerio.load(html);
    return { results: parseSearchCards($), hasNextPage: !!$('a.btn.btn-sm').length };
  },

  async trending()      { return { results: await getFromChaptersPage() }; },
  async recentlyAdded() { return { results: await getFromChaptersPage() }; },
  async latestUpdates() { return { results: await getFromChaptersPage() }; },

  async byGenres(genres) {
    if (!genres?.length) return this.trending();
    // MangaPill genre filter: /search?genre[]=action&genre[]=adventure
    const params = genres.map(g => `genre[]=${encodeURIComponent(g.toLowerCase())}`).join('&');
    const html = await getHtml(`${BASE}/search?${params}`);
    const $ = cheerio.load(html);
    return { results: parseSearchCards($) };
  },

  async authorSearch(authorName) {
    // MangaPill has no dedicated author search — fall back to title search
    const html = await getHtml(`${BASE}/search?q=${encodeURIComponent(authorName)}`);
    const $ = cheerio.load(html);
    return { results: parseSearchCards($), hasNextPage: false };
  },

  async mangaDetails(mangaId) {
    const url  = `${BASE}/manga/${mangaId}`;
    const html = await getHtml(url);
    const $    = cheerio.load(html);

    const title    = $('h1').first().text().trim() || mangaId;
    const rawCover = $('div.container > div:first-child > div:first-child img').attr('data-src')
      || $('div.container > div:first-child > div:first-child img').attr('src') || '';
    const cover    = normCover(rawCover);

    // Use the specific description paragraph (skips site-wide notices)
    const description =
      $('div.container > div:first-child > div:last-child > div:nth-child(2) > p').text().trim() ||
      $('div.container > div:nth-child(2) > p').text().trim() ||
      $('p.text-sm').last().text().trim() || '';

    const status = $('div.container label')
      .filter((_, el) => $(el).text().trim() === 'Status')
      .next('div').text().trim().toLowerCase() || 'unknown';

    const genres = [];
    $('a[href*="/search?genre"]').each((_, el) => genres.push($(el).text().trim()));

    const author = $('a[href*="author"]').first().text().trim() ||
      $('div.container label')
        .filter((_, el) => /author|artist/i.test($(el).text()))
        .first().parent().find('a').first().text().trim() || '';

    return { id: mangaId, title, cover, description, status, genres, author, url };
  },

  async chapters(mangaId) {
    const html = await getHtml(`${BASE}/manga/${mangaId}`);
    const $    = cheerio.load(html);

    const chapters = [];
    $('#chapters div a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.startsWith('/chapters/')) return;
      const name = $(el).text().trim();
      chapters.push({
        id: href.replace('/chapters/', ''),
        name,
        title: name,
        chapter: name,
        url: BASE + href,
        publishAt: null,
        pages: []
      });
    });

    // MangaPill lists newest-first — reverse so oldest is index 0 (reading order)
    return { chapters: chapters.reverse() };
  },

  async pages(chapterId) {
    const html = await getHtml(`${BASE}/chapters/${chapterId}`);
    const $    = cheerio.load(html);

    const pages = [];
    $('picture img').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src') || '';
      if (!src) return;
      pages.push({ index: i, img: proxyImg(src.startsWith('http') ? src : BASE + src) });
    });

    return { pages };
  }
};
