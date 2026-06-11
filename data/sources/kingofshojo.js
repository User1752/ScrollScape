const cheerio = require('cheerio');

const BASE = 'https://kingofshojo.com';
const FETCH_TIMEOUT_MS = 12_000;
const DETAILS_CACHE_TTL_MS = 30 * 60 * 1000;
const LIST_ENRICH_LIMIT = 12;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

const detailsCache = new Map();

function emptyResults() {
  return { results: [], hasNextPage: false };
}

function proxyImg(url) {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function absolutizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, BASE).href;
  } catch (_) {
    return `${BASE}/${raw.replace(/^\/+/, '')}`;
  }
}

function extractMangaId(url) {
  const m = String(url || '').match(/\/manga\/([^\/?#]+)/i);
  return m ? m[1] : '';
}

async function getHtml(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`KingOfShojo fetch error: ${res.status} ${url}`);
  return res.text();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCachedDetails(mangaId) {
  const key = String(mangaId || '').trim();
  if (!key) return null;
  const hit = detailsCache.get(key);
  if (!hit) return null;
  if ((Date.now() - hit.ts) > DETAILS_CACHE_TTL_MS) {
    detailsCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCachedDetails(mangaId, data) {
  const key = String(mangaId || '').trim();
  if (!key || !data || typeof data !== 'object') return;
  detailsCache.set(key, { ts: Date.now(), data });
}

async function fetchDetailsParsed(mangaId) {
  const cached = getCachedDetails(mangaId);
  if (cached) return cached;

  const url = `${BASE}/manga/${mangaId}/`;
  let parsed = null;
  const attempts = 3;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const html = await getHtml(url);
    const $ = cheerio.load(html);

    const title = $('.ts-breadcrumb li:last-child span').text().trim() || $('.entry-title').text().trim() || mangaId;
    const img = $('.thumb img').first();
    const cover = absolutizeUrl(img.attr('src') || img.attr('data-src') || '');
    const description = $('.entry-content p').text().trim() || '';
    const genres = extractGenresFromDetails($);

    const author =
      $('.imptdt:contains("Author") i').text().trim() ||
      $('.post-content_item .summary-heading:contains("Author")').siblings('.summary-content').text().trim() ||
      $('.post-content_item .summary-heading:contains("Artist")').siblings('.summary-content').text().trim() ||
      '';

    const statusText = (
      $('.imptdt:contains("Status") i').text().trim() ||
      $('.post-content_item .summary-heading:contains("Status")').siblings('.summary-content').text().trim() ||
      ''
    ).toLowerCase();

    let status = 'unknown';
    if (statusText.includes('ongoing')) status = 'ongoing';
    else if (statusText.includes('completed')) status = 'completed';

    parsed = {
      id: mangaId,
      title,
      cover: proxyImg(cover),
      description,
      status,
      genres,
      author,
      url
    };

    if (genres.length > 0) break;
    if (attempt < attempts - 1) await sleep(220 * (attempt + 1));
  }

  if (!parsed) {
    throw new Error(`Failed to parse details for ${mangaId}`);
  }

  setCachedDetails(mangaId, parsed);
  return parsed;
}

async function enrichListMetadata(results, limit = LIST_ENRICH_LIMIT) {
  const rows = Array.isArray(results) ? results.map(r => ({ ...r })) : [];
  const max = Math.min(limit, rows.length);

  for (let i = 0; i < max; i++) {
    const item = rows[i];
    if (!item?.id) continue;
    try {
      const d = await fetchDetailsParsed(item.id);
      if (Array.isArray(d?.genres) && d.genres.length > 0) item.genres = d.genres;
      if (d?.author) item.author = d.author;
      if (d?.status && d.status !== 'unknown') item.status = d.status;
      await sleep(110);
    } catch (_) {
      // Keep card fallback metadata when detail fetch is unavailable.
    }
  }

  return rows;
}

function extractGenresFromDetails($) {
  const out = [];
  const seen = new Set();

  function addGenre(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (/^(n\/a|none|unknown)$/i.test(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  }

  // KingOfShojo layouts vary. Try specific genre chips first, then fallback to genre/tag links.
  [
    '.mgen a',
    '.seriestugenre a',
    '.wd-full a[rel="tag"]',
    '.post-content_item .summary-content a[href*="/genre/"]',
    '.post-content_item .summary-content a[href*="/genres/"]',
    '.tsinfo .imptdt a[href*="/genre/"]',
    '.tsinfo .imptdt a[href*="/genres/"]',
    'a[href*="/genre/"]',
    'a[href*="/genres/"]',
  ].forEach((selector) => {
    $(selector).each((_, el) => addGenre($(el).text()));
  });

  return out;
}

function hasNextPage($, fallbackLength) {
  if ($('.next.page-numbers, .pagination .next, a.next').length > 0) return true;
  return Number(fallbackLength || 0) >= 10;
}

function parseCards($) {
  const results = [];
  $('.bsx').each((_, el) => {
    const a = $(el).find('a').first();
    const href = absolutizeUrl(a.attr('href') || '');
    const id = extractMangaId(href);
    if (!id) return;

    const title = a.attr('title') || $(el).find('.tt').text().trim();
    const img = $(el).find('img').first();
    const cover = absolutizeUrl(img.attr('src') || img.attr('data-src') || '');

    // Listing cards expose a type badge like: <span class="type manhwa"></span>
    // Use it as an immediate genre fallback so home cards are not empty.
    const typeClasses = String($(el).find('span.type').first().attr('class') || '')
      .split(/\s+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean)
      .filter(c => c !== 'type' && c !== 'ts-post-image');

    const genres = typeClasses.length
      ? [typeClasses[0].replace(/-/g, ' ').replace(/\b\w/g, s => s.toUpperCase())]
      : [];

    results.push({
      id,
      title,
      cover: proxyImg(cover),
      url: href,
      status: 'unknown',
      author: '',
      genres
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
    let results = parseCards($);
    results = await enrichListMetadata(results);
    return { results, hasNextPage: hasNextPage($, results.length) };
  },

  async trending() {
    const url = `${BASE}/manga/?order=trending`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [] };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results };
  },

  async popularAllTime() {
    const url = `${BASE}/manga/?order=popular`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [] };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results };
  },

  async recentlyAdded() {
    const url = `${BASE}/manga/?order=update`;
    const html = await getHtml(url).catch(() => null);
    if (!html) return { results: [] };
    const $ = cheerio.load(html);
    const results = parseCards($);
    return { results };
  },

  async latestUpdates() {
    return this.recentlyAdded();
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    if (!genres || !genres.length) return this.trending();
    const slug = String(genres[0] || '').toLowerCase().trim().replace(/\s+/g, '-');
    const candidates = [
      `${BASE}/genres/${slug}/page/${page}/`,
      `${BASE}/genre/${slug}/page/${page}/`,
      `${BASE}/genres/${slug}/`,
      `${BASE}/genre/${slug}/`,
    ];

    for (const url of candidates) {
      const html = await getHtml(url).catch(() => null);
      if (!html) continue;
      const $ = cheerio.load(html);
      const results = await enrichListMetadata(parseCards($));
      if (results.length > 0) {
        return { results, hasNextPage: hasNextPage($, results.length) };
      }
    }

    return emptyResults();
  },

  async authorSearch(authorName) {
    return { results: [], hasNextPage: false };
  },

  /**
   * Lightweight probe used by server health-check at startup.
   * Avoids heavy multi-request enrichment performed by search().
   */
  async healthCheck() {
    try {
      const url = `${BASE}/manga/?order=update`;
      const html = await getHtml(url);
      if (!html || html.length < 200) {
        return { ok: false, temporarilyUnavailable: true, error: 'Empty response body' };
      }
      const $ = cheerio.load(html);
      const cards = parseCards($);
      return { ok: cards.length >= 0 };
    } catch (e) {
      if (String(e?.name || '').toLowerCase() === 'timeouterror') {
        return { ok: false, temporarilyUnavailable: true, error: 'Connection timed out' };
      }
      return { ok: false, temporarilyUnavailable: true, error: e?.message || 'Probe failed' };
    }
  },

  async mangaDetails(mangaId) {
    try {
      return await fetchDetailsParsed(mangaId);
    } catch (_) {
      return {
        id: mangaId,
        title: mangaId,
        cover: '',
        description: '',
        status: 'unknown',
        genres: [],
        author: '',
        url: `${BASE}/manga/${mangaId}/`
      };
    }
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
