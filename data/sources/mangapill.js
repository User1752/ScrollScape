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

    // Genre links inside each card use href="/search?genre=..."
    const genres = [];
    $(el).find('a[href*="/search?genre"]').each((_, g) => {
      const t = $(g).text().trim();
      if (t) genres.push(t);
    });

    results.push({ id, title, cover: normCover(raw), url: BASE + href, genres, status: 'unknown', author: '' });
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

// ── Genre enrichment ─────────────────────────────────────────────────────────

// MangaPill search cards contain no genre data — fetch detail pages in parallel
// to enrich results. Runs up to `concurrency` requests at a time.
async function enrichGenres(results, concurrency = 5) {
  const out = results.map(r => ({ ...r }));
  let i = 0;
  async function worker() {
    while (i < out.length) {
      const idx = i++;
      const item = out[idx];
      if (!item.id) continue;
      try {
        const html = await getHtml(`${BASE}/manga/${item.id}`);
        const $    = cheerio.load(html);
        const genres = [];
        $('a[href*="/search?genre"]').each((_, el) => genres.push($(el).text().trim()));
        item.genres = genres;
      } catch (_) { /* leave genres empty on error */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, out.length) }, worker));
  return out;
}

// ── Module export ─────────────────────────────────────────────────────────────

// Client-side sort for MangaPill (no server-side sort support)
function sortResults(results, orderBy) {
  if (!orderBy || orderBy === 'relevance' || orderBy === 'followedCount') return results;
  const r = [...results];
  if (orderBy === 'title')  r.sort((a, b) => a.title.localeCompare(b.title));
  if (orderBy === '-title') r.sort((a, b) => b.title.localeCompare(a.title));
  return r;
}

module.exports = {
  meta: {
    id: 'mangapill',
    name: 'MangaPill',
    version: '1.1.0',
    author: 'scraper'
  },

  async search(query, page = 1, orderBy = '') {
    const html = await getHtml(`${BASE}/search?q=${encodeURIComponent(query)}&page=${page}`);
    const $ = cheerio.load(html);
    const results = await enrichGenres(sortResults(parseSearchCards($), orderBy));
    return { results, hasNextPage: !!$('a.btn.btn-sm').length };
  },

  async trending()      { return { results: await getFromChaptersPage() }; },
  async recentlyAdded() { return { results: await getFromChaptersPage() }; },
  async latestUpdates() { return { results: await getFromChaptersPage() }; },

  async byGenres(genres, orderBy = '') {
    if (!genres?.length) return this.trending();
    // Normalize to MangaPill's exact casing
    const caseMap = { 'sci-fi': 'Sci-Fi', 'one shot': 'One-Shot', 'shoujo ai': 'Shoujo Ai', 'shounen ai': 'Shounen Ai' };
    const norm = g => caseMap[g.toLowerCase()] || g;
    // MangaPill genre filter: /search?genre=Action&genre=Drama (original case, plain param)
    const params = genres.map(g => `genre=${encodeURIComponent(norm(g))}`).join('&');
    const html = await getHtml(`${BASE}/search?${params}`);
    const $ = cheerio.load(html);
    const results = await enrichGenres(sortResults(parseSearchCards($), orderBy));
    return { results };
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
