'use strict';

const ALLOWED_METHODS = new Set([
  'search', 'mangaDetails', 'chapters', 'pages',
  'trending', 'recentlyAdded', 'latestUpdates',
  'byGenres', 'authorSearch',
]);

function buildSourceCall(mod, method, payload = {}) {
  const {
    query,
    page,
    mangaId,
    chapterId,
    genres,
    orderBy,
    authorName,
    publicationStatus,
    contentRating,
    format,
  } = payload;

  const filters = {
    publicationStatus: publicationStatus || '',
    contentRating: contentRating || '',
    format: format || '',
  };

  switch (method) {
    case 'search':
      return mod.search(query || '', Number(page) || 1, orderBy || '', filters);
    case 'mangaDetails':
      return mod.mangaDetails(mangaId || '');
    case 'chapters':
      return mod.chapters(mangaId || '');
    case 'pages':
      return mod.pages(chapterId || '');
    case 'trending':
      return mod.trending();
    case 'recentlyAdded':
      return mod.recentlyAdded();
    case 'latestUpdates':
      return mod.latestUpdates();
    case 'byGenres':
      return mod.byGenres(genres || [], orderBy || '', filters, Number(page) || 1);
    case 'authorSearch':
      return mod.authorSearch(authorName || '');
    default:
      return null;
  }
}

function createSourceDispatchService({ safeId, loadSourceFromFile, withTimeout, timeoutMs, logger = console }) {
  async function dispatch({ id, method, body } = {}) {
    const sid = safeId(id);
    if (!sid) {
      const err = new Error('Invalid source ID');
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED_METHODS.has(method)) {
      const err = new Error('Method not supported');
      err.statusCode = 400;
      throw err;
    }

    const mod = loadSourceFromFile(sid);
    if (typeof mod[method] !== 'function') {
      const err = new Error('Method not implemented by this source');
      err.statusCode = 400;
      throw err;
    }

    const payload = body || {};
    const call = buildSourceCall(mod, method, payload);

    try {
      return await withTimeout(call, timeoutMs, `${sid}.${method}`);
    } catch (err) {
      const { query, mangaId, chapterId } = payload;
      logger.error('[SOURCES][CALL_FAILED]', {
        sourceId: sid,
        method,
        mangaId,
        chapterId,
        query,
        error: err?.message,
      });
      throw err;
    }
  }

  return { dispatch };
}

module.exports = { createSourceDispatchService };