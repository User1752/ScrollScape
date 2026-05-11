'use strict';

function createLibraryContentService({ readStore, writeStore, safeManga, isSafeUrl }) {
  function normSourceId(s) {
    const v = String(s || '').trim();
    if (!v || v === 'unknown' || v === 'null' || v === 'undefined') return '';
    return v.slice(0, 100);
  }

  function sanitizeCompositePart(v) {
    return String(v || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);
  }

  function safeStatusKey(mangaId, sourceId) {
    const mid = sanitizeCompositePart(mangaId);
    const sid = sanitizeCompositePart(sourceId || 'unknown');
    return `${mid}:${sid}`.slice(0, 300);
  }

  function safeReviewKey(mangaId) {
    return sanitizeCompositePart(mangaId).slice(0, 200);
  }

  function coverOverrideKey(mangaId, sourceId) {
    return safeStatusKey(mangaId, sourceId);
  }

  function getCoverOverride(store, mangaId, sourceId) {
    const key = coverOverrideKey(mangaId, sourceId);
    const raw = store?.coverOverrides?.[key];
    return typeof raw === 'string' ? raw.trim().slice(0, 2000) : '';
  }

  function applyCoverOverride(store, manga, sourceId) {
    const override = getCoverOverride(store, manga?.id, sourceId || manga?.sourceId);
    return override ? { ...manga, cover: override } : manga;
  }

  function isAllowedCoverUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return false;
    if (isSafeUrl(value)) return true;
    try {
      const u = new URL(value, 'http://localhost');
      if (u.pathname !== '/api/proxy-image') return false;
      const inner = u.searchParams.get('url');
      return !!inner && isSafeUrl(inner);
    } catch {
      return false;
    }
  }

  function _mergeReviewEntries(existing, incoming) {
    const out = [];
    const seen = new Set();
    for (const item of [...(incoming || []), ...(existing || [])]) {
      if (!item || typeof item !== 'object') continue;
      const key = `${Number(item.rating) || 0}|${String(item.text || '')}|${String(item.date || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 20) break;
    }
    return out;
  }

  function _collectReadingStatusCandidates(store, fromMangaId, fromSourceIdRaw) {
    const wantedSource = normSourceId(fromSourceIdRaw);
    const rawId = String(fromMangaId || '');
    const safeIdPart = sanitizeCompositePart(rawId);
    const out = [];

    for (const [key, val] of Object.entries(store.readingStatus || {})) {
      const sep = key.indexOf(':');
      if (sep < 0) continue;
      const left = key.slice(0, sep);
      const right = normSourceId(key.slice(sep + 1));
      const idMatch = left === rawId || left === safeIdPart;
      if (!idMatch) continue;
      if (wantedSource && right !== wantedSource) continue;
      out.push({ key, value: val, score: Date.parse(val?.updatedAt || '') || 0 });
    }

    if (out.length === 0 && wantedSource) {
      const rawKey = `${rawId}:${wantedSource}`;
      if (store.readingStatus?.[rawKey]) {
        out.push({ key: rawKey, value: store.readingStatus[rawKey], score: Date.parse(store.readingStatus[rawKey]?.updatedAt || '') || 0 });
      }
    }

    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function inferSourceIdForFavorite(store, fav) {
    const idPart = sanitizeCompositePart(fav?.id || '');
    if (!idPart) return '';

    const candidates = new Set();
    for (const k of Object.keys(store.readingStatus || {})) {
      const sep = k.indexOf(':');
      if (sep < 0) continue;
      const left = k.slice(0, sep);
      const right = normSourceId(k.slice(sep + 1));
      if (left === idPart && right) candidates.add(right);
    }
    if (candidates.size === 1) return [...candidates][0];

    const h = (store.history || []).find(x => String(x?.id || '') === String(fav?.id || '') && normSourceId(x?.sourceId));
    if (h) return normSourceId(h.sourceId);

    return '';
  }

  function normalizeFavoritesSourceIds(store) {
    let changed = false;
    store.favorites = (store.favorites || []).map((fav) => {
      const current = normSourceId(fav?.sourceId);
      if (current) {
        if (fav.sourceId !== current) changed = true;
        return { ...fav, sourceId: current };
      }

      const inferred = inferSourceIdForFavorite(store, fav) || 'unknown';
      changed = true;
      return { ...fav, sourceId: inferred };
    });
    return changed;
  }

  const VALID_STATUSES = new Set(['reading', 'completed', 'on_hold', 'plan_to_read', 'dropped']);

  async function getLibrary() {
    const store = await readStore();
    if (normalizeFavoritesSourceIds(store)) {
      await writeStore(store);
    }
    return { favorites: store.favorites || [], history: store.history || [], coverOverrides: store.coverOverrides || {} };
  }

  async function addToLibrary({ mangaId, sourceId, manga } = {}) {
    const store = await readStore();
    const safeEntry = applyCoverOverride(store, { ...safeManga(manga), sourceId, addedAt: new Date().toISOString() }, sourceId);
    const existing = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);

    if (existing >= 0) {
      store.favorites[existing] = safeEntry;
    } else {
      store.favorites.push(safeEntry);
    }

    await writeStore(store);
    return { ok: true, favorites: store.favorites, coverOverrides: store.coverOverrides || {} };
  }

  async function removeFromLibrary({ mangaId, sourceId } = {}) {
    const store = await readStore();
    store.favorites = store.favorites.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    await writeStore(store);
    return { ok: true, favorites: store.favorites, coverOverrides: store.coverOverrides || {} };
  }

  async function updateLibraryCover({ mangaId, sourceId, cover } = {}) {
    const nextCover = String(cover || '').trim().slice(0, 2000);

    if (!mangaId || !sourceId) {
      const err = new Error('mangaId and sourceId required');
      err.statusCode = 400;
      throw err;
    }
    if (!isAllowedCoverUrl(nextCover)) {
      const err = new Error('A valid public image URL is required');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    if (!store.coverOverrides || typeof store.coverOverrides !== 'object') store.coverOverrides = {};
    store.coverOverrides[coverOverrideKey(mangaId, sourceId)] = nextCover;

    store.favorites = (store.favorites || []).map((manga) => {
      if (String(manga?.id) !== String(mangaId) || String(manga?.sourceId || '') !== String(sourceId)) return manga;
      return { ...manga, cover: nextCover };
    });

    store.history = (store.history || []).map((manga) => {
      if (String(manga?.id) !== String(mangaId) || String(manga?.sourceId || '') !== String(sourceId)) return manga;
      return { ...manga, cover: nextCover };
    });

    for (const [key, value] of Object.entries(store.readingStatus || {})) {
      const sep = key.indexOf(':');
      if (sep < 0) continue;
      const keyMangaId = key.slice(0, sep);
      const keySourceId = key.slice(sep + 1);
      if (String(keyMangaId) !== String(mangaId) || String(keySourceId) !== String(sourceId)) continue;
      store.readingStatus[key] = {
        ...value,
        manga: {
          ...safeManga(value?.manga),
          cover: nextCover,
        },
      };
    }

    await writeStore(store);
    return { ok: true, cover: nextCover, favorites: store.favorites, history: store.history, readingStatus: store.readingStatus, coverOverrides: store.coverOverrides || {} };
  }

  async function addHistoryEntry({ mangaId, sourceId, manga, chapterId, chapterName } = {}) {
    const store = await readStore();
    const existing = store.history.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    if (existing >= 0) store.history.splice(existing, 1);

    store.history.unshift({
      ...applyCoverOverride(store, safeManga(manga), sourceId),
      sourceId,
      chapterId: String(chapterId ?? '').slice(0, 200),
      chapterName: String(chapterName ?? '').slice(0, 200),
      readAt: new Date().toISOString(),
    });

    store.history = store.history.slice(0, 100);
    await writeStore(store);
    return { ok: true, history: store.history, coverOverrides: store.coverOverrides || {} };
  }

  async function removeHistoryEntry({ mangaId, sourceId } = {}) {
    const store = await readStore();
    store.history = store.history.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    await writeStore(store);
    return { ok: true, history: store.history, coverOverrides: store.coverOverrides || {} };
  }

  async function clearHistory() {
    const store = await readStore();
    store.history = [];
    await writeStore(store);
    return { ok: true, coverOverrides: store.coverOverrides || {} };
  }

  async function toggleFavorite({ mangaId, sourceId, manga } = {}) {
    const store = await readStore();
    const index = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    let isFavorite = false;

    if (index > -1) {
      store.favorites.splice(index, 1);
    } else {
      store.favorites.push(applyCoverOverride(store, {
        ...safeManga(manga),
        id: mangaId,
        sourceId,
        addedAt: new Date().toISOString()
      }, sourceId));
      isFavorite = true;
    }

    await writeStore(store);
    return { success: true, isFavorite, favorites: store.favorites, coverOverrides: store.coverOverrides || {} };
  }

  async function getUserStatus() {
    const store = await readStore();
    return { readingStatus: store.readingStatus };
  }

  async function setUserStatus({ mangaId, sourceId, status, mangaData } = {}) {
    if (!mangaId || !sourceId) {
      const err = new Error('mangaId and sourceId required');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    const key = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);

    if (!status || status === 'none') {
      delete store.readingStatus[key];
    } else {
      if (!VALID_STATUSES.has(status)) {
        const err = new Error('Invalid status value');
        err.statusCode = 400;
        throw err;
      }

      store.readingStatus[key] = {
        status,
        updatedAt: new Date().toISOString(),
        manga: safeManga(mangaData),
      };
    }

    await writeStore(store);
    return { ok: true, readingStatus: store.readingStatus };
  }

  async function clearLibrary() {
    const store = await readStore();
    store.favorites = [];
    store.readingStatus = {};
    store.customLists = [];
    await writeStore(store);
    return { ok: true };
  }

  return {
    getLibrary,
    addToLibrary,
    removeFromLibrary,
    updateLibraryCover,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistory,
    toggleFavorite,
    getUserStatus,
    setUserStatus,
    clearLibrary,
  };
}

module.exports = { createLibraryContentService };