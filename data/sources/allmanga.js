// AllManga.to source  uses the GraphQL API at https://api.allanime.day/api
// v1.1.0

const crypto = require('crypto');

const APIS = [
  'https://api.allanime.day/api',
  'https://api.allmanga.to/api',
  'https://api.allanime.day/allanimeapi',
];
const COVER_BASE = 'https://wp.youtube-anime.com/aln.youtube-anime.com/';
const WEB_BASE = 'https://allmanga.to';

// Key derivation used by AllAnime/AllManga encrypted API payloads.
const DECRYPT_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest();

const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://allmanga.to',
  'Origin': 'https://allmanga.to',
};

const DAILY_POPULAR_HASH = '60f50b84bb545fa25ee7f7c8c0adbf8f5cea40f7b1ef8501cbbff70e38589489';
const LATEST_UPDATES_HASH = '2d48e19fb67ddcac42fbb885204b6abb0a84f406f15ef83f36de4a66f49f651a';

const HTML_HEADERS = {
  'User-Agent': GQL_HEADERS['User-Agent'],
  'Referer': WEB_BASE,
  'Origin': WEB_BASE,
};

function decodeTobeparsed(blob) {
  const raw = Buffer.from(blob, 'base64');
  if (raw.length <= 29) {
    throw new Error('Invalid encrypted AllManga payload');
  }

  // Layout: [1-byte header][12-byte nonce][ciphertext][16-byte GCM auth tag]
  // Data is encrypted with AES-256 in CTR mode using counter = 2 (equivalent
  // to the data-encryption phase of AES-GCM). The auth tag is not verified
  // but MUST be excluded from the ciphertext or the decrypted JSON is garbage.
  const nonce = raw.subarray(1, 13);
  const iv = Buffer.concat([nonce, Buffer.from([0, 0, 0, 2])]);
  const ciphertext = raw.subarray(13, raw.length - 16); // exclude 16-byte auth tag
  const decipher = crypto.createDecipheriv('aes-256-ctr', DECRYPT_KEY, iv);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return JSON.parse(plain);
}

function isLikelyHtml(text) {
  return /^\s*</.test(text) && /<!doctype|<html|just a moment/i.test(text);
}

function withTimeout(ms) {
  return AbortSignal.timeout(ms);
}

async function gql(query) {
  let lastErr;

  for (const apiUrl of APIS) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: GQL_HEADERS,
        body: JSON.stringify({ query }),
        signal: withTimeout(12000),
      });

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // ignore
      }

      if (!res.ok) {
        if (json?.errors) throw new Error(json.errors[0]?.message || `HTTP ${res.status}`);
        if (isLikelyHtml(text)) {
          throw new Error(`AllManga upstream blocked (${res.status})`);
        }
        throw new Error(`AllManga API HTTP ${res.status}`);
      }

      if (isLikelyHtml(text)) {
        throw new Error('AllManga upstream returned HTML challenge page');
      }

      if (json.errors) {
        const msg = json.errors[0]?.message || 'Unknown AllManga API error';
        throw new Error(msg);
      }

      // New API responses may come encrypted in data.tobeparsed.
      if (json.data?.tobeparsed) {
        const decoded = decodeTobeparsed(json.data.tobeparsed);
        if (decoded.errors) {
          throw new Error(decoded.errors[0]?.message || 'Unknown AllManga API error (encrypted)');
        }
        // tobeparsed may decode to { data: ... } or directly to payload.
        return decoded.data ?? decoded;
      }

      return json.data;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('AllManga API unavailable');
}

async function safeListCall(fn) {
  try {
    return await fn();
  } catch {
    // Keep discover UI usable when AllManga is temporarily blocked by upstream.
    return { results: [] };
  }
}

async function fetchDailyPopular(limit = 20) {
  const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const variables = encodeURIComponent(JSON.stringify({
    type: 'manga',
    size: limit,
    dateRange: 1,
    page: 1,
    allowUnknown: false,
    allowAdult: false,
  }));
  const extensions = encodeURIComponent(JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash: DAILY_POPULAR_HASH,
    },
  }));
  const url = `${APIS[0]}?variables=${variables}&extensions=${extensions}&day=${encodeURIComponent(dayKey)}`;

  const res = await fetch(url, {
    headers: {
      ...HTML_HEADERS,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
    signal: withTimeout(12000),
  });
  const json = await res.json();
  const rows = json?.data?.queryPopular?.recommendations || json?.data?.recommendations || [];

  return rows
    .map(rec => {
      const m = rec?.anyCard || {};
      if (!m._id || !m.name) return null;
      return {
        id: m._id,
        title: m.name,
        cover: thumbUrl(m.thumbnail),
        url: `${WEB_BASE}/manga/${m._id}`,
        genres: [],
        status: normalizeStatus(m.status),
        author: '',
        sourceId: 'allmanga',
        sourceName: 'AllManga.to',
      };
    })
    .filter(Boolean);
}

async function fetchLatestUpdates(limit = 20) {
  const variables = encodeURIComponent(JSON.stringify({
    search: { isManga: true },
    limit,
    page: 1,
    translationType: 'sub',
    countryOrigin: 'ALL',
  }));
  const extensions = encodeURIComponent(JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash: LATEST_UPDATES_HASH,
    },
  }));
  const url = `${APIS[0]}?variables=${variables}&extensions=${extensions}`;

  const res = await fetch(url, {
    headers: {
      ...HTML_HEADERS,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
    signal: withTimeout(12000),
  });
  const json = await res.json();
  const rows = json?.data?.mangas?.edges || [];

  return rows
    .map(e => {
      if (!e?._id || !e?.name) return null;
      return {
        id: e._id,
        title: e.name,
        cover: thumbUrl(e.thumbnail),
        url: `${WEB_BASE}/manga/${e._id}`,
        genres: [],
        status: normalizeStatus(e.status),
        author: '',
      };
    })
    .filter(Boolean);
}

function thumbUrl(thumbnail) {
  if (!thumbnail) return '';
  const REF = encodeURIComponent(WEB_BASE);
  const full = thumbnail.startsWith('http') ? thumbnail : COVER_BASE + thumbnail + '?w=500';
  return `/api/proxy-image?url=${encodeURIComponent(full)}&ref=${REF}`;
}

function mapEdge(e) {
  const genres = e.genres || [];
  const set = new Set(genres.map(g => String(g).toLowerCase()));
  let format = 'manga';
  if (set.has('manhwa') || set.has('webtoon') || set.has('webtoons')) format = 'manhwa';
  else if (set.has('manhua')) format = 'manhua';
  else if (set.has('doujinshi')) format = 'doujinshi';
  else if (set.has('one-shot') || set.has('oneshot') || set.has('one shot')) format = 'oneshot';

  let contentRating = 'safe';
  if (set.has('hentai') || set.has('smut') || set.has('mature') || set.has('adult') || set.has('ecchi')) contentRating = 'erotica';
  else if (set.has('suggestive')) contentRating = 'suggestive';

  return {
    id: e._id,
    title: e.name || e._id,
    cover: thumbUrl(e.thumbnail),
    url: `${WEB_BASE}/manga/${e._id}`,
    genres,
    status: normalizeStatus(e.status),
    author: (e.authors || [])[0] || '',
    format,
    contentRating,
    sourceId: 'allmanga',
    sourceName: 'AllManga.to',
  };
}

function normalizeStatus(s) {
  if (!s) return 'unknown';
  const l = s.toLowerCase();
  if (l.includes('releas') || l.includes('ongoing') || l.includes('publishing')) return 'ongoing';
  if (l.includes('finish') || l.includes('complet')) return 'completed';
  return l || 'unknown';
}

function sortResults(results, orderBy = '') {
  if (!orderBy || orderBy === 'relevance') return results;
  const rows = [...results];
  if (orderBy === 'title') rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  if (orderBy === '-title') rows.sort((a, b) => String(b.title || '').localeCompare(String(a.title || '')));
  return rows;
}

function applyFilters(results, filters = {}) {
  let rows = results;

  if (filters.publicationStatus) {
    const target = String(filters.publicationStatus || '').toLowerCase();
    rows = rows.filter(m => String(m.status || '').toLowerCase() === target);
  }

  if (filters.format) {
    const fmt = String(filters.format || '').toLowerCase();
    rows = rows.filter(m => String(m.format || '').toLowerCase() === fmt || (m.genres || []).some(g => String(g).toLowerCase() === fmt));
  }

  if (filters.contentRating) {
    const target = String(filters.contentRating || '').toLowerCase();
    rows = rows.filter(m => String(m.contentRating || 'safe').toLowerCase() === target);
  }

  return rows;
}

console.warn('[allmanga] Source allmanga.js carregado e registrado!');
module.exports = {
  meta: {
    id: 'allmanga',
    name: 'AllManga.to',
    version: '1.1.0',
    author: 'auto',
    icon: '',
    supportsPopularAllTime: true,
    supportsRecentlyAdded: false,
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    return safeListCall(async () => {
      const q = `{ mangas(search:{query:${JSON.stringify(query || '')}}, limit:30, page:${page}) { edges { _id name thumbnail status genres authors } } }`;
      const data = await gql(q);
      const edges = data.mangas?.edges || [];
      const rows = applyFilters(sortResults(edges.map(mapEdge), orderBy), filters);
      return { results: rows, hasNextPage: edges.length >= 30 };
    });
  },

  async trending() {
    return safeListCall(async () => {
      const results = await fetchDailyPopular(20);
      return { results };
    });
  },

  async popularAllTime() {
    return safeListCall(async () => {
      const variables = encodeURIComponent(JSON.stringify({
        search: {
          sortBy: 'Top',
          isManga: true,
        },
        limit: 26,
        page: 1,
        translationType: 'sub',
        countryOrigin: 'ALL',
      }));
      const extensions = encodeURIComponent(JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: LATEST_UPDATES_HASH,
        },
      }));
      const url = `${APIS[0]}?variables=${variables}&extensions=${extensions}`;
      const res = await fetch(url, {
        headers: {
          ...HTML_HEADERS,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
        signal: withTimeout(12000),
      });
      const json = await res.json();
      const rows = json?.data?.mangas?.edges || [];
      return {
        results: rows
          .map(e => {
            if (!e?._id || !e?.name) return null;
            return {
              id: e._id,
              title: e.name,
              cover: thumbUrl(e.thumbnail),
              url: `${WEB_BASE}/manga/${e._id}`,
              genres: [],
              status: normalizeStatus(e.status),
              author: '',
              sourceId: 'allmanga',
              sourceName: 'AllManga.to',
            };
          })
          .filter(Boolean),
      };
    });
  },

  async latestUpdates() {
    return safeListCall(async () => {
      const results = await fetchLatestUpdates(26);
      return { results };
    });
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    return safeListCall(async () => {
      if (!genres || genres.length === 0) {
        const q = `{ mangas(search:{sortBy: Popular, allowAdult: false}, limit:30, page:${page}) { edges { _id name thumbnail status genres authors } } }`;
        const data = await gql(q);
        const edges = data.mangas?.edges || [];
        const rows = applyFilters(sortResults(edges.map(mapEdge), orderBy), filters);
        return { results: rows, hasNextPage: edges.length === 30 };
      }
      const genreList = genres.map(g => JSON.stringify(g)).join(',');
      const q = `{ mangas(search:{genres:[${genreList}], sortBy: Popular, allowAdult: false}, limit:30, page:${page}) { edges { _id name thumbnail status genres authors } } }`;
      const data = await gql(q);
      const edges = data.mangas?.edges || [];
      const rows = applyFilters(sortResults(edges.map(mapEdge), orderBy), filters);
      return { results: rows, hasNextPage: edges.length === 30 };
    });
  },

  async mangaDetails(mangaId) {
    const q = `{ manga(_id:${JSON.stringify(mangaId)}) { _id name thumbnail description status genres authors } }`;
    const data = await gql(q);
    const m = data.manga;
    if (!m) throw new Error('Manga not found');
    return {
      id: m._id,
      title: m.name,
      cover: thumbUrl(m.thumbnail),
      description: (m.description || '').replace(/<[^>]+>/g, ' ').trim(),
      status: normalizeStatus(m.status),
      genres: m.genres || [],
      author: (m.authors || [])[0] || '',
      url: `${WEB_BASE}/manga/${m._id}`,
    };
  },

  async chapters(mangaId) {
    const q = `{ manga(_id:${JSON.stringify(mangaId)}) { availableChaptersDetail } }`;
    const data = await gql(q);
    console.warn('[allmanga] chapters() — resposta crua:', JSON.stringify(data));
    const detail = data.manga?.availableChaptersDetail || {};

    let chapters = [];
    if (detail.sub && detail.sub.length > 0) {
      chapters = detail.sub.map(num => ({
        id: `${mangaId}/chapter-${num}-sub`,
        name: `Chapter ${num}`,
        chapter: String(num),
        url: `${WEB_BASE}/manga/${mangaId}/chapter-${num}-sub`,
      }));
    } else if (detail.raw && detail.raw.length > 0) {
      chapters = detail.raw.map(num => ({
        id: `${mangaId}/chapter-${num}-raw`,
        name: `Chapter ${num}`,
        chapter: String(num),
        url: `${WEB_BASE}/manga/${mangaId}/chapter-${num}-raw`,
      }));
    }

    // Logar capítulos para diagnóstico
    console.warn('[allmanga] chapters() — mangaId:', mangaId, '| chapters:', JSON.stringify(chapters));

    // Sort newest-first
    chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));
    return { chapters };
  },

  async pages(chapterId) {
    // chapterId = "MANGAID/chapter-NUM-sub" or "-raw"
    console.warn('[allmanga] pages() — chapterId recebido:', chapterId);
    let parts = chapterId.match(/^(.+?)\/chapter-([\d.]+)-(sub|raw)$/);
    if (!parts) {
      // Fallback for old saved chapters que sempre terminavam em -sub
      const oldParts = chapterId.match(/^(.+?)\/chapter-([\d.]+).*$/);
      if (!oldParts) {
        console.warn('[allmanga] pages() — chapterId NÃO CASOU com nenhum padrão:', chapterId);
        throw new Error(`Invalid chapterId: ${chapterId}`);
      }
      parts = [oldParts[0], oldParts[1], oldParts[2], 'sub'];
    }
    const mangaId = parts[1];
    const chapterString = parts[2];
    const type = parts[3];

    // Known AllManga server-side errors that indicate the backend is broken.
    // In these cases we return empty pages rather than crashing with a 500.
    const KNOWN_UPSTREAM_ERRORS = [
      "Cannot read property 'type' of undefined",
      'context is not defined',
    ];

    const tryFetch = async (translationType) => {
      try {
        const q = `{ chapterPages(mangaId:${JSON.stringify(mangaId)}, chapterString:${JSON.stringify(chapterString)}, translationType: ${translationType}) { edges { pictureUrls pictureUrlHead } } }`;
        const data = await gql(q);
        return (data?.chapterPages?.edges || [])[0] || null;
      } catch (err) {
        if (KNOWN_UPSTREAM_ERRORS.some(e => err.message?.includes(e))) {
          return null; // AllManga backend is broken — suppress
        }
        throw err;
      }
    };

    let edge = await tryFetch(type);
    if (!edge) {
      const fallbackType = type === 'sub' ? 'raw' : 'sub';
      edge = await tryFetch(fallbackType);
    }

    if (!edge) {
      console.warn('[allmanga] pages() — edge vazio para', chapterId);
      return { pages: [] };
    }
    // Logar o edge retornado para diagnóstico
    console.warn('[allmanga] pages() — edge:', JSON.stringify(edge));
    return this._processEdge(edge);
  },

  _processEdge(edge) {
    const head = edge.pictureUrlHead || '';
    const REF  = encodeURIComponent('https://allmanga.to');
    const pages = (edge.pictureUrls || []).map((p, idx) => {
      const segment = typeof p === 'string' ? p : (p?.url || '');
      const raw = /^https?:\/\//i.test(segment) ? segment : (head + segment);
      return {
        img: `/api/proxy-image?url=${encodeURIComponent(raw)}&ref=${REF}`,
        index: typeof p === 'object' && p?.num != null ? p.num : idx,
      };
    });
    return { pages };
  },
};
