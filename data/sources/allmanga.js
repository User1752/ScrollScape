// AllManga.to source  uses the GraphQL API at https://api.allanime.day/api
// v1.1.0

const crypto = require('crypto');

const APIS = [
  'https://api.allanime.day/api',
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
      if (!res.ok) {
        if (isLikelyHtml(text)) {
          throw new Error(`AllManga upstream blocked (${res.status})`);
        }
        throw new Error(`AllManga API HTTP ${res.status}`);
      }

      if (isLikelyHtml(text)) {
        throw new Error('AllManga upstream returned HTML challenge page');
      }

      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('AllManga returned invalid JSON');
      }

      if (json.errors) throw new Error(json.errors[0].message);

      // New API responses may come encrypted in data.tobeparsed.
      if (json.data?.tobeparsed) {
        const decoded = decodeTobeparsed(json.data.tobeparsed);
        if (decoded.errors) throw new Error(decoded.errors[0].message);
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

function thumbUrl(thumbnail) {
  if (!thumbnail) return '';
  if (thumbnail.startsWith('http')) return thumbnail;
  return COVER_BASE + thumbnail + '?w=500';
}

function mapEdge(e) {
  return {
    id: e._id,
    title: e.name || e._id,
    cover: thumbUrl(e.thumbnail),
    url: `${WEB_BASE}/manga/${e._id}`,
    genres: e.genres || [],
    status: normalizeStatus(e.status),
    author: (e.authors || [])[0] || '',
  };
}

function normalizeStatus(s) {
  if (!s) return 'unknown';
  const l = s.toLowerCase();
  if (l.includes('releas') || l.includes('ongoing') || l.includes('publishing')) return 'ongoing';
  if (l.includes('finish') || l.includes('complet')) return 'completed';
  return l || 'unknown';
}

module.exports = {
  meta: {
    id: 'allmanga',
    name: 'AllManga.to',
    version: '1.1.0',
    author: 'auto',
    icon: '',
  },

  async search(query, page = 1, orderBy = '', filters = {}) {
    return safeListCall(async () => {
      // status filter applied client-side after fetch (AllManga GQL enum not reliable)
      const q = `{ mangas(search:{query:${JSON.stringify(query || '')}}, limit:30, page:${page}) { edges { _id name thumbnail status } } }`;
      const data = await gql(q);
      const edges = data.mangas?.edges || [];
      return { results: edges.map(mapEdge), hasNextPage: edges.length >= 30 };
    });
  },

  async trending() {
    return safeListCall(async () => {
      const q = `{ mangas(search:{sortBy: Popular}, limit:20, page:1) { edges { _id name thumbnail status } } }`;
      const data = await gql(q);
      return { results: (data.mangas?.edges || []).map(mapEdge) };
    });
  },

  async recentlyAdded() {
    return safeListCall(async () => {
      const q = `{ mangas(search:{sortBy: Latest_Update}, limit:20, page:1) { edges { _id name thumbnail status } } }`;
      const data = await gql(q);
      return { results: (data.mangas?.edges || []).map(mapEdge) };
    });
  },

  async latestUpdates() {
    return this.recentlyAdded();
  },

  async byGenres(genres, orderBy = '', filters = {}, page = 1) {
    return safeListCall(async () => {
      // status filter applied client-side (AllManga GQL status enum not reliable)
      if (!genres || genres.length === 0) {
        const q = `{ mangas(search:{sortBy: Popular, allowAdult: false}, limit:30, page:${page}) { edges { _id name thumbnail status genres authors } } }`;
        const data = await gql(q);
        const edges = data.mangas?.edges || [];
        return { results: edges.map(mapEdge), hasNextPage: edges.length === 30 };
      }
      const genreList = genres.map(g => JSON.stringify(g)).join(',');
      const q = `{ mangas(search:{genres:[${genreList}], sortBy: Popular, allowAdult: false}, limit:30, page:${page}) { edges { _id name thumbnail status genres authors } } }`;
      const data = await gql(q);
      const edges = data.mangas?.edges || [];
      return { results: edges.map(mapEdge), hasNextPage: edges.length === 30 };
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
    const detail = data.manga?.availableChaptersDetail || {};
    const nums = detail.sub || detail.raw || [];
    const chapters = nums.map(num => ({
      id: `${mangaId}/chapter-${num}-sub`,
      name: `Chapter ${num}`,
      chapter: String(num),
      url: `${WEB_BASE}/manga/${mangaId}/chapter-${num}-sub`,
    }));
    // Sort newest-first
    chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));
    return { chapters };
  },

  async pages(chapterId) {
    // chapterId = "MANGAID/chapter-NUM-sub"
    const parts = chapterId.match(/^(.+?)\/chapter-([\d.]+)-sub$/);
    if (!parts) throw new Error(`Invalid chapterId: ${chapterId}`);
    const mangaId = parts[1];
    const chapterString = parts[2];
    const q = `{ chapterPages(mangaId:${JSON.stringify(mangaId)}, chapterString:${JSON.stringify(chapterString)}, translationType: sub) { edges { pictureUrls pictureUrlHead } } }`;
    const data = await gql(q);
    const edge = (data.chapterPages?.edges || [])[0];
    if (!edge) return { pages: [] };
    const head = edge.pictureUrlHead || '';
    const REF  = encodeURIComponent('https://allmanga.to');

    // pictureUrls currently comes as an array of strings, but keep object fallback.
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
