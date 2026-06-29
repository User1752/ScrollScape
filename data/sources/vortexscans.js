const cheerio = require('cheerio');

const BASE = 'https://vortexscans.org';
const FETCH_TIMEOUT_MS = 25_000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': BASE
};

function proxyImg(url, ref = BASE) {
  if (!url) return '';
  const safeRef = ref ? `&ref=${encodeURIComponent(ref)}` : '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}${safeRef}`;
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

function decodeWsrvTarget(url) {
  const raw = String(url || '').trim();
  if (!/wsrv\.nl/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const target = parsed.searchParams.get('url');
    return target ? decodeURIComponent(target) : raw;
  } catch (_) {
    return raw;
  }
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeImageUrl(url) {
  const abs = absolutizeUrl(url);
  return decodeWsrvTarget(abs);
}

function extractMangaId(url) {
  const m = String(url || '').match(/\/series\/([^\/?#]+)/i);
  return m ? m[1] : '';
}

async function getHtml(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`VortexScans fetch error: ${res.status} ${url}`);
  return res.text();
}

function parseLdJsonBlocks($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch (_) {}
  });
  return blocks;
}

function findPrimaryImageFromLd($) {
  const blocks = parseLdJsonBlocks($);
  for (const block of blocks) {
    const graph = Array.isArray(block?.['@graph']) ? block['@graph'] : [];
    for (const item of graph) {
      if (item?.['@type'] === 'ImageObject' || (Array.isArray(item?.['@type']) && item['@type'].includes('ImageObject'))) {
        if (item.url) return normalizeImageUrl(item.url);
      }
    }
  }
  return '';
}

function getMetaContent($, matcher) {
  const meta = $('meta').toArray().find((el) => matcher($(el)));
  return meta ? $(meta).attr('content') || '' : '';
}

function extractGenres($) {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  $('a[href*="/series?genres="]').each((_, el) => add($(el).text()));

  return out;
}

function cleanDescription(text, title) {
  let value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  value = value.replace(/\s*-\s*Vortex Scans$/i, '').trim();
  const safeTitle = String(title || '').trim();
  if (safeTitle && value.toLowerCase().startsWith(safeTitle.toLowerCase())) {
    value = value.slice(safeTitle.length).replace(/^\s*[,:-]\s*/, '').trim();
  }
  return value;
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
    const cover = normalizeImageUrl(img.attr('src') || img.attr('data-src') || '');

    let existing = results.find(r => r.id === id);
    if (!existing) {
      existing = {
        id,
        title: id,
        cover: '',
        url: absolutizeUrl(href),
        status: 'unknown',
        author: '',
        genres: []
      };
      results.push(existing);
    }

    if (cover) {
      existing.cover = proxyImg(cover, BASE);
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

function extractSerializedGenres(html) {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  const decoded = decodeHtmlEntities(String(html || ''));
  const genreBlockMatch = decoded.match(/"genres":\[1,\[\[0,\{[\s\S]*?\}\]\]\],"team":\[1,\[\]\]/i);
  const block = genreBlockMatch ? genreBlockMatch[0] : decoded;
  for (const match of block.matchAll(/"name":\[0,"([^"]+)"\]/g)) {
    add(match[1]);
  }
  return out;
}

function collectImageCandidates(html) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const clean = text
      .replace(/\\\//g, '/')
      .replace(/\\u002F/g, '/')
      .replace(/&amp;/g, '&')
      .replace(/&quot;.*$/g, '');
    const normalized = normalizeImageUrl(clean);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const srcPatterns = [
    /https:\/\/storage\.vortexscans\.org\/upload\/series\/[^"'\s<>]+/g,
    /https:\\\/\\\/storage\.vortexscans\.org\\\/upload\\\/series\\\/[^"'\s<>]+/g,
    /https:\/\/wsrv\.nl\/\?url=[^"'\s<>]+/g,
    /https:\\\/\\\/wsrv\.nl\\\/\?url=[^"'\s<>]+/g,
  ];

  for (const pattern of srcPatterns) {
    for (const match of String(html || '').matchAll(pattern)) {
      const candidate = String(match[0] || '').trim();
      if (!candidate) continue;
      if (/wsrv\.nl/i.test(candidate)) {
        push(decodeWsrvTarget(candidate));
      } else {
        push(candidate);
      }
    }
  }

  return out;
}

function extractChaptersFromSerializedState(html, mangaId) {
  const decoded = decodeHtmlEntities(String(html || ''));
  const entries = [];
  const seen = new Set();
  const baseRx = /"number":\[0,([0-9.]+)\],"slug":\[0,"(chapter-[^"]+)"\]/g;

  for (const match of decoded.matchAll(baseRx)) {
    const numberText = String(match[1] || '').trim();
    const chapterNum = Number(numberText);
    const chapterSlug = String(match[2] || '').trim();
    if (!chapterSlug || !Number.isFinite(chapterNum) || chapterNum <= 0) continue;

    const from = Math.max(0, (match.index || 0));
    const tail = decoded.slice(from, from + 800);
    const accessMatch = tail.match(/"isAccessible":\[0,(true|false)\]/i);
    if (accessMatch && String(accessMatch[1]).toLowerCase() !== 'true') continue;

    const titleMatch = tail.match(/"title":\[0,"([^"]*)"\]/i);
    const createdAtMatch = tail.match(/"createdAt":\[0,"([^"]+)"\]/i);
    const title = String(titleMatch?.[1] || '').trim();
    const name = title ? `Chapter ${numberText} - ${title}` : `Chapter ${numberText}`;
    const id = `${mangaId}/${chapterSlug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    entries.push({
      id,
      name,
      title: name,
      chapter: numberText,
      url: `${BASE}/series/${mangaId}/${chapterSlug}`,
      publishAt: createdAtMatch?.[1] || null,
      pages: []
    });
  }

  // ScrollScape expects newest chapters first (index 0 = newest).
  // VortexScans serialized state is usually oldest to newest.
  entries.sort((a, b) => Number(b.chapter) - Number(a.chapter));

  return entries;
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
    if (!html) return { results: [], hasNextPage: false, temporarilyUnavailable: true };
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
    const meta = (pattern) => {
      const m = html.match(pattern);
      return m ? String(m[1] || '').trim() : '';
    };

    const title =
      meta(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
      meta(/<title>([^<]+)<\/title>/i) ||
      mangaId;

    const ldCover = meta(/"@type":"ImageObject"[^>]*?"url":"([^"]+)"/i);
    const cover = normalizeImageUrl(
      ldCover ||
      meta(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    );

    const cleanTitle = title.replace(/\s+Manhwa\s*-\s*Vortex Scans$/i, '').replace(/\s*-\s*Vortex Scans$/i, '').trim();
    const description = cleanDescription(
      meta(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
      meta(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i),
      cleanTitle
    );

    const genres = [];
    const seenGenres = new Set();
    for (const g of extractSerializedGenres(html)) {
      const key = g.toLowerCase();
      if (seenGenres.has(key)) continue;
      seenGenres.add(key);
      genres.push(g);
    }
    for (const match of html.matchAll(/href="([^"]*\/series\?genres=[^"]*)"[^>]*>([^<]+)</gi)) {
      const text = String(match[2] || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (seenGenres.has(key)) continue;
      seenGenres.add(key);
      genres.push(text);
    }

    const lowerHtml = html.toLowerCase();
    let status = 'unknown';
    if (lowerHtml.includes('ongoing')) status = 'ongoing';
    else if (lowerHtml.includes('completed')) status = 'completed';
    else if (lowerHtml.includes('hiatus')) status = 'hiatus';

    return {
      id: mangaId,
      title: cleanTitle,
      cover: proxyImg(cover, BASE),
      description,
      status,
      genres,
      author: '',
      url
    };
  },

  async chapters(mangaId) {
    const url = `${BASE}/series/${mangaId}`;
    const html = await getHtml(url);

    // Prefer serialized chapter state because it includes accessibility info.
    // This avoids exposing locked chapters that return no public images.
    const serializedChapters = extractChaptersFromSerializedState(html, mangaId);
    if (serializedChapters.length > 0) {
      return { chapters: serializedChapters };
    }

    const $ = cheerio.load(html);

    const chapters = [];
    $(`a[href^="/series/${mangaId}/chapter-"]`).each((_, el) => {
      const a = $(el);
      
      // Attempt to extract cleaner text
      let name = a.find('span.font-medium').first().text().trim();
      if (!name) name = a.text().trim();

      // Skip read buttons which are just duplicates
      if (name.toLowerCase().startsWith('read chapter') || name.toLowerCase() === 'read first chapter' || name.toLowerCase() === 'read last chapter') return;

      const href = absolutizeUrl(a.attr('href') || '');
      
      const chapterSlug = href.split('/').filter(Boolean).pop();
      const chapterId = chapterSlug ? `${mangaId}/${chapterSlug}` : '';
      if (chapterId && !chapters.some(c => c.id === chapterId)) {
        chapters.push({
          id: chapterId,
          name,
          title: name,
          chapter: name,
          url: href,
          publishAt: null,
          pages: []
        });
      }
    });

    // ScrollScape expects newest first. If DOM is oldest to newest, reverse it.
    chapters.reverse();

    return { chapters };
  },

  async pages(mangaId, chapterId) {
    const rawId = String(chapterId || mangaId || '').trim();
    let url = '';

    if (/^https?:\/\//i.test(rawId)) {
      url = rawId;
    } else if (rawId.includes('/')) {
      url = `${BASE}/series/${rawId.replace(/^\/+/, '')}`;
    } else if (chapterId && mangaId) {
      url = `${BASE}/series/${String(mangaId).replace(/^\/+/, '')}/${String(chapterId).replace(/^\/+/, '')}`;
    } else {
      return { pages: [] };
    }

    const html = await getHtml(url);
    const candidates = collectImageCandidates(html);
    const pages = candidates
      .filter((src) => /storage\.vortexscans\.org\/upload\/series\//i.test(src))
      .map((src, index) => ({
        index,
        img: proxyImg(src, BASE)
      }));

    if (pages.length === 0) {
      const low = String(html || '').toLowerCase();
      const looksLocked =
        low.includes('&quot;isaccessible&quot;:[0,false]') ||
        low.includes('&quot;islocked&quot;:[0,true]') ||
        low.includes('unlock with') ||
        low.includes('is permanently locked');
      if (looksLocked) {
        throw new Error('This chapter is locked on Vortex Scans and has no public images.');
      }
    }

    return { pages };
  }
};
