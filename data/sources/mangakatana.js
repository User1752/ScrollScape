const cheerio = require('cheerio');

const BASE = 'https://mangakatana.com';
const FETCH_TIMEOUT_MS = 12000;
let nextAllowedAt = 0;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function withSoftTimeout(promise, ms, fallbackValue) {
  return Promise.race([
    promise.catch(() => fallbackValue),
    sleep(ms).then(() => fallbackValue),
  ]);
}

function isRateLimitBody(text) {
  const s = String(text || '').toLowerCase();
  if (!s.trim()) return true;
  return s.includes('just a moment') ||
    s.includes('attention required') ||
    s.includes('cloudflare') ||
    s.includes('captcha') ||
    s.includes('access denied') ||
    s.includes('too many requests');
}

function isRateLimitedError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('rate limited') ||
    msg.includes('too many requests') ||
    msg.includes('http 429') ||
    msg.includes('just a moment') ||
    msg.includes('cloudflare') ||
    msg.includes('empty response');
}

function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

async function getHtml(url, isPaginated = false) {
  if (Date.now() < nextAllowedAt) {
    await sleep(nextAllowedAt - Date.now());
  }

  // MangaKatana aggressively blocks rapid pagination requests.
  if (isPaginated) {
    await sleep(randomBetween(1400, 2200));
  }

  const maxRetries = 5;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Exponential backoff + jitter to avoid burst retries.
      if (attempt > 0) {
        const backoff = Math.min(12000, 1000 * Math.pow(2, attempt - 1)) + randomBetween(250, 950);
        await sleep(backoff);
      }

      const res = await fetch(url, {
        headers: HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (res.status === 429) {
        lastError = new Error('HTTP 429 (rate limited)');
        nextAllowedAt = Date.now() + randomBetween(7000, 12000);
        if (attempt < maxRetries - 1) continue;
        throw lastError;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();

      // Empty/challenge pages are treated as transient rate limiting.
      if (isRateLimitBody(text)) {
        lastError = new Error('Empty/challenge response (rate limited)');
        nextAllowedAt = Date.now() + randomBetween(7000, 12000);
        if (attempt < maxRetries - 1) continue;
        throw lastError;
      }

      // Small pacing gap after success reduces consecutive burst traffic.
      nextAllowedAt = Date.now() + randomBetween(400, 900);
      return text;
    } catch (err) {
      lastError = err;
      if (isRateLimitedError(err)) {
        nextAllowedAt = Math.max(nextAllowedAt, Date.now() + randomBetween(6000, 10000));
      }
      if (attempt < maxRetries - 1) {
        continue;
      }
    }
  }

  throw new Error(`MangaKatana fetch failed after ${maxRetries} attempts: ${lastError.message} (${url})`);
}

function extractMangaId(href) {
  if (!href) return '';
  let id = String(href)
    .replace(/^https?:\/\/mangakatana\.com\//i, '/')
    .replace(/^\/manga\//i, '')
    .replace(`${BASE}/manga/`, '')
    .split('?')[0]
    .split('#')[0];
  return id.replace(/\/$/, '').trim();
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
    const id = extractMangaId(href);
    if (!id) return;
    const status = $(el).find('.status').text().trim().toLowerCase() || 'unknown';
    const genres = [];
    $(el).find('.genres a, .genre a, a[href*="/genre/"]').each((_, gEl) => {
      const gText = $(gEl).text().trim();
      if (gText && !genres.includes(gText)) genres.push(gText);
    });

    results.push({
      id,
      title,
      cover: proxyImg(rawCover),
      url: href,
      genres,
      status,
      author: '',
      sourceId: 'mangakatana',
      sourceName: 'MangaKatana'
    });
  });

  return results;
}

function parseHotSidebarList($) {
  const results = [];
  const seen = new Set();

  $('#hot_book .item').each((_, el) => {
    const titleA = $(el).find('h3.title a').first();
    const href = titleA.attr('href') || '';
    const title = titleA.text().trim();
    if (!href || !title) return;

    const id = extractMangaId(href);
    if (!id || seen.has(id)) return;
    seen.add(id);

    const imgEl = $(el).find('.wrap_img img').first();
    const rawCover = imgEl.attr('data-src') || imgEl.attr('src') || '';
    const status = ($(el).find('.status').first().text().trim() || 'unknown').toLowerCase();

    results.push({
      id,
      title,
      cover: proxyImg(rawCover),
      url: href,
      genres: [],
      status,
      author: '',
      sourceId: 'mangakatana',
      sourceName: 'MangaKatana'
    });
  });

  return results;
}

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('ongoing') || s.includes('publishing') || s.includes('releasing')) return 'ongoing';
  if (s.includes('complet') || s.includes('finished')) return 'completed';
  if (s.includes('hiatus')) return 'hiatus';
  if (s.includes('cancel')) return 'cancelled';
  return s || 'unknown';
}

function inferFormatFromGenres(genres = []) {
  const set = new Set(genres.map(g => String(g).toLowerCase()));
  if (set.has('manhwa') || set.has('webtoon') || set.has('webtoons')) return 'manhwa';
  if (set.has('manhua')) return 'manhua';
  if (set.has('doujinshi')) return 'doujinshi';
  if (set.has('one-shot') || set.has('oneshot') || set.has('one shot')) return 'oneshot';
  return 'manga';
}

function sortLocal(results, orderBy = '') {
  if (!orderBy || orderBy === 'relevance') return results;
  const rows = [...results];
  if (orderBy === 'title') rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  if (orderBy === '-title') rows.sort((a, b) => String(b.title || '').localeCompare(String(a.title || '')));
  return rows;
}

function applyLocalFilters(results, genres = [], filters = {}) {
  let rows = results;

  if (genres?.length) {
    const wanted = new Set(genres.map(g => String(g).toLowerCase()));
    rows = rows.filter(m => (m.genres || []).some(g => wanted.has(String(g).toLowerCase())));
  }

  if (filters.publicationStatus) {
    const target = normalizeStatus(filters.publicationStatus);
    rows = rows.filter(m => normalizeStatus(m.status) === target);
  }

  if (filters.format) {
    const targetFmt = String(filters.format).toLowerCase();
    rows = rows.filter(m => String(m.format || inferFormatFromGenres(m.genres || [])).toLowerCase() === targetFmt);
  }

  return rows;
}

async function enrichListMeta(results, limit = 24, concurrency = 4) {
  const out = results.map(r => ({ ...r }));
  let i = 0;

  async function worker() {
    while (i < Math.min(limit, out.length)) {
      const idx = i++;
      const item = out[idx];
      try {
        const html = await getHtml(`${BASE}/manga/${item.id}`);
        const $ = cheerio.load(html);
        const genres = [];
        $('.info .genres a, .meta .genres a, a.text_0[href*="/genre/"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text && !genres.includes(text)) genres.push(text);
        });
        item.genres = genres;
        item.status = normalizeStatus($('.value.status').text().trim() || item.status);
        item.format = inferFormatFromGenres(genres);
      } catch (_) {
        item.status = normalizeStatus(item.status);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, out.length, limit) }, worker));
  return out;
}

module.exports = {
  meta: {
    id: 'mangakatana',
    name: 'MangaKatana',
    version: '1.1.0',
    author: 'scraper',
    supportsPopularAllTime: false
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    if (!query || query.trim().length < 3) {
      // No query → return homepage trending items
      const t = await this.trending(page);
      let rows = sortLocal(t.results || [], orderBy);
      if (filters.publicationStatus || filters.format) {
        rows = await enrichListMeta(rows, 24);
        rows = applyLocalFilters(rows, [], filters);
      }
      return { results: rows, hasNextPage: false };
    }
    const q = encodeURIComponent(query.trim());
    const pageStr = page === 1 ? '' : `page/${page}/`;
    let html;
    try {
      html = await getHtml(`${BASE}/${pageStr}?search=${q}&search_by=book_name`, page > 1);
    } catch (err) {
      if (isRateLimitedError(err)) {
        return { results: [], hasNextPage: false, temporarilyUnavailable: true };
      }
      throw err;
    }
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
        const id = extractMangaId(href);
        if (!id) return;
        results.push({
          id,
          title,
          cover: proxyImg(rawCover),
          url: href,
          genres: [],
          status: 'unknown',
          author: '',
          sourceId: 'mangakatana',
          sourceName: 'MangaKatana'
        });
      });
    }

    let rows = sortLocal(results, orderBy);
    if (filters.publicationStatus || filters.format) {
      rows = await enrichListMeta(rows, 24);
      rows = applyLocalFilters(rows, [], filters);
    }

    return { results: rows, hasNextPage: !!$('.next.page-numbers').length };
  },

  async trending(page = 1) {
    // Use only the sidebar HOT MANGA widget from homepage
    let html;
    try {
      html = await getHtml(`${BASE}/`);
      const $ = cheerio.load(html);
      const results = parseHotSidebarList($);
      return { results, hasNextPage: false };
    } catch (err) {
      if (isRateLimitedError(err)) {
        return { results: [], hasNextPage: false, temporarilyUnavailable: true };
      }
      // Logging e retorno estruturado de erro
      try {
        const { MANGAKATANA_INVALID_RESPONSE } = require('../../server/modules/errors/error-codes');
        const { registerKnownError } = require('../../server/modules/errors/error-registry');
        await registerKnownError({
          logPath: require('path').resolve(__dirname, '../..', 'data', 'error-log.json'),
          code: MANGAKATANA_INVALID_RESPONSE,
          area: 'mangakatana',
          message: 'MangaKatana trending failed or returned invalid response.',
          details: { page, error: err.message }
        });
      } catch (e) {}
      return {
        results: [],
        hasNextPage: false,
        error: 'ERROR-012',
        errorMessage: 'MangaKatana trending failed or returned invalid response.'
      };
    }
  },

  async recentlyAdded(page = 1) {
    // Newly added manga at /new-manga
    const pageStr = page === 1 ? '' : `page/${page}/`;
    let html;
    try {
      html = await getHtml(`${BASE}/new-manga${pageStr}`, page > 1);
    } catch (err) {
      if (isRateLimitedError(err)) {
        return { results: [], hasNextPage: false, temporarilyUnavailable: true };
      }
      throw err;
    }
    const $ = cheerio.load(html);
    const results = parseBookList($);
    return { results, hasNextPage: !!$('.next.page-numbers, .pagination .next').length };
  },

  async latestUpdates(page = 1) {
    // Latest updated manga at /latest
    const pageStr = page === 1 ? '' : `page/${page}/`;
    let html;
    try {
      html = await getHtml(`${BASE}/latest${pageStr}`, page > 1);
    } catch (err) {
      if (isRateLimitedError(err)) {
        return { results: [], hasNextPage: false, temporarilyUnavailable: true };
      }
      throw err;
    }
    const $ = cheerio.load(html);
    const results = parseBookList($);
    return { results, hasNextPage: !!$('.next.page-numbers, .pagination .next').length };
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    const safeGenres = Array.isArray(genres) ? genres : [];
    const safeFilters = (filters && typeof filters === 'object') ? filters : {};
    const needsMeta = safeGenres.length > 0 || !!safeFilters.publicationStatus || !!safeFilters.format;

    const fallbackTrending = { results: [], hasNextPage: false, temporarilyUnavailable: true };
    const t = await withSoftTimeout(this.trending(page), 8500, fallbackTrending);
    let rows = sortLocal(t.results || [], orderBy);

    if (needsMeta && rows.length > 0) {
      // Enrich with metadata (maintaining original scope for speed while soft timeout prevents hangs).
      rows = await withSoftTimeout(enrichListMeta(rows, 8, 3), 12000, rows);
    }

    rows = applyLocalFilters(rows, safeGenres, safeFilters);
    return { results: rows, hasNextPage: false };
  },

  async authorSearch(authorName) {
    return this.search(authorName);
  },

  async mangaDetails(mangaId) {
    mangaId = String(mangaId || '').split('?')[0].split('#')[0].replace(/\/$/, '').trim();
    if (!mangaId) throw new Error('Invalid mangaId');
    const url = `${BASE}/manga/${mangaId}`;
    let html;
    try {
      html = await getHtml(url);
    } catch (err) {
      if (isRateLimitedError(err)) {
        return {
          id: mangaId,
          title: mangaId,
          cover: '',
          description: 'MangaKatana temporarily rate limited this request. Try again in a few seconds.',
          status: 'unknown',
          genres: [],
          author: '',
          url
        };
      }
      throw err;
    }
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
    mangaId = String(mangaId || '').split('?')[0].split('#')[0].replace(/\/$/, '').trim();
    if (!mangaId) throw new Error('Invalid mangaId');
    const url = `${BASE}/manga/${mangaId}`;
    let html;
    try {
      html = await getHtml(url);
    } catch (err) {
      if (isRateLimitedError(err)) {
        return { chapters: [], temporarilyUnavailable: true };
      }
      throw err;
    }
    const $ = cheerio.load(html);

    const chapters = [];
    // Chapters are listed newest-first in .chapters table
    $('.chapters .chapter a, #single_book .chapters a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || !href.includes('/manga/')) return;
      const name = $(el).text().trim();
      let id = href.split('/manga/')[1];
      id = (id || '').split('?')[0].split('#')[0].replace(/\/$/, '').trim();
      if (!id) return;
      chapters.push({ id, name, title: name, chapter: name, url: href, publishAt: null, pages: [] });
    });

    return { chapters };
  },

  async pages(chapterId) {
    chapterId = String(chapterId || '').split('?')[0].split('#')[0].replace(/\/$/, '').trim();
    if (!chapterId) throw new Error('Invalid chapterId');
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
