// AllManga.to source  uses the GraphQL API at https://api.allanime.day/api
// v1.0.0

const API = 'https://api.allanime.day/api';
const COVER_BASE = 'https://wp.youtube-anime.com/aln.youtube-anime.com/';
const WEB_BASE = 'https://allmanga.to';

const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function gql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
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
    version: '1.0.0',
    author: 'auto',
    icon: '',
  },

  async search(query, page = 1) {
    const q = `{ mangas(search:{query:${JSON.stringify(query || '')}}, limit:30, page:${page}) { edges { _id name thumbnail } } }`;
    const data = await gql(q);
    const edges = data.mangas?.edges || [];
    return { results: edges.map(mapEdge), hasNextPage: edges.length >= 30 };
  },

  async trending() {
    const q = `{ mangas(search:{sortBy: Popular}, limit:20, page:1) { edges { _id name thumbnail } } }`;
    const data = await gql(q);
    return { results: (data.mangas?.edges || []).map(mapEdge) };
  },

  async recentlyAdded() {
    const q = `{ mangas(search:{sortBy: Latest_Update}, limit:20, page:1) { edges { _id name thumbnail } } }`;
    const data = await gql(q);
    return { results: (data.mangas?.edges || []).map(mapEdge) };
  },

  async latestUpdates() {
    return this.recentlyAdded();
  },

  async byGenres(genres, orderBy = '') {
    if (!genres || genres.length === 0) return this.trending();
    const genreList = genres.map(g => JSON.stringify(g)).join(',');
    const sortBy = orderBy && orderBy !== 'relevance' ? `sortBy: Popular,` : `sortBy: Popular,`;
    const q = `{ mangas(search:{genres:[${genreList}], ${sortBy} allowAdult: false}, limit:30, page:1) { edges { _id name thumbnail genres status authors } } }`;
    const data = await gql(q);
    const edges = data.mangas?.edges || [];
    return { results: edges.map(mapEdge) };
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
    const pages = (edge.pictureUrls || []).map(p => {
      const raw = head + p.url;
      return {
        img: `/api/proxy-image?url=${encodeURIComponent(raw)}&ref=${REF}`,
        index: p.num,
      };
    });
    return { pages };
  },
};
