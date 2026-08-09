'use strict';

function createListService({ readStore, writeStore, safeManga }) {
  function normalizeListId(rawValue) {
    return String(rawValue || '').slice(0, 100);
  }

  async function getLists() {
    const store = await readStore();
    return { lists: store.customLists };
  }

  // A dynamic ("smart") category has no manually-curated mangaItems — instead
  // filterQuery is evaluated live, client-side, against each manga's current
  // status/rating/source/genre (see _matchesSmartCategory in ui-library.js).
  // Kept as a plain flat object (no nested query language) so it survives
  // the backup export/import round trip with zero extra plumbing, same as
  // every other field on a list.
  function normalizeFilterQuery(filterQuery) {
    if (!filterQuery || typeof filterQuery !== 'object') return null;
    const q = {};
    const status = String(filterQuery.status || '').trim();
    if (status) q.status = status.slice(0, 50);
    const sourceId = String(filterQuery.sourceId || '').trim();
    if (sourceId) q.sourceId = sourceId.slice(0, 100);
    const genre = String(filterQuery.genre || '').trim();
    if (genre) q.genre = genre.slice(0, 100);
    const ratingMin = Number(filterQuery.ratingMin);
    if (Number.isFinite(ratingMin) && ratingMin > 0) q.ratingMin = Math.min(10, Math.max(0, ratingMin));
    return Object.keys(q).length ? q : null;
  }

  async function createList({ name, description, isDynamic, filterQuery } = {}) {
    if (!name?.trim()) {
      const err = new Error('List name required');
      err.statusCode = 400;
      throw err;
    }

    const dynamic = isDynamic === true;
    const store = await readStore();
    const list = {
      id: `list_${Date.now()}`,
      name: name.trim().slice(0, 100),
      description: String(description || '').slice(0, 500),
      mangaItems: [],
      isDynamic: dynamic,
      filterQuery: dynamic ? normalizeFilterQuery(filterQuery) : null,
      createdAt: new Date().toISOString(),
    };

    store.customLists.push(list);
    await writeStore(store);
    return { ok: true, list };
  }

  async function updateList(listIdRaw, { name, description, isDynamic, filterQuery } = {}) {
    const listId = normalizeListId(listIdRaw);

    if (listId === 'manga-categories') {
      const err = new Error('Use setMangaCategories for manga-categories');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);

    if (!list) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    if (name) list.name = name.trim().slice(0, 100);
    if (description !== undefined) list.description = String(description).slice(0, 500);
    if (isDynamic !== undefined) {
      list.isDynamic = isDynamic === true;
      list.filterQuery = list.isDynamic ? normalizeFilterQuery(filterQuery) : null;
      // Switching a category to dynamic drops any manually-curated members —
      // membership from here on is computed live from filterQuery instead.
      if (list.isDynamic) list.mangaItems = [];
    } else if (filterQuery !== undefined && list.isDynamic) {
      list.filterQuery = normalizeFilterQuery(filterQuery);
    }

    await writeStore(store);
    return { ok: true, list };
  }

  async function deleteList(listIdRaw) {
    const listId = normalizeListId(listIdRaw);
    const store = await readStore();

    store.customLists = store.customLists.filter(l => l.id !== listId);

    await writeStore(store);
    return { ok: true };
  }

  async function addMangaToList(listIdRaw, { mangaData } = {}) {
    const listId = normalizeListId(listIdRaw);
    if (!mangaData?.id) {
      const err = new Error('mangaData.id required');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);

    if (!list) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    if (!list.mangaItems.some(m => m.id === mangaData.id)) {
      list.mangaItems.push({ ...safeManga(mangaData), addedAt: new Date().toISOString() });
    }

    await writeStore(store);
    return { ok: true, list };
  }

  async function removeMangaFromList(listIdRaw, mangaIdRaw) {
    const listId = normalizeListId(listIdRaw);
    const mId = String(mangaIdRaw || '').slice(0, 200);

    const store = await readStore();
    const list = store.customLists.find(l => l.id === listId);

    if (!list) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    list.mangaItems = list.mangaItems.filter(m => m.id !== mId);

    await writeStore(store);
    return { ok: true, list };
  }

  async function setMangaCategories({ mangaId, sourceId, categoryIds, mangaData } = {}) {
    if (!mangaId || !sourceId) {
      const err = new Error('mangaId and sourceId required');
      err.statusCode = 400;
      throw err;
    }

    const safeIds = Array.isArray(categoryIds)
      ? [...new Set(categoryIds.map(id => String(id).slice(0, 100)))].slice(0, 50)
      : [];

    const store = await readStore();
    const validIds = new Set(store.customLists.map(l => l.id));
    const resolvedIds = safeIds.filter(id => validIds.has(id));

    const mangaKey = `${mangaId}:${sourceId}`;
    const safeItem = mangaData
      ? { ...safeManga(mangaData), sourceId, addedAt: new Date().toISOString() }
      : null;

    for (const list of store.customLists) {
      const shouldBeIn = resolvedIds.includes(list.id);
      const currentIdx = list.mangaItems.findIndex(
        m => m.id === mangaId && (m.sourceId === sourceId || !m.sourceId)
      );
      const isCurrentlyIn = currentIdx >= 0;

      if (shouldBeIn && !isCurrentlyIn) {
        const item = safeItem || { id: mangaId, sourceId, addedAt: new Date().toISOString() };
        list.mangaItems.push(item);
      } else if (!shouldBeIn && isCurrentlyIn) {
        list.mangaItems.splice(currentIdx, 1);
      }
    }

    await writeStore(store);
    return { ok: true, mangaKey, categoryIds: resolvedIds };
  }

  async function getMangaCategories(mangaIdRaw, sourceIdRaw) {
    const mangaId = String(mangaIdRaw || '').slice(0, 200);
    const sourceId = String(sourceIdRaw || '').slice(0, 100);
    const store = await readStore();

    const categoryIds = store.customLists
      .filter(l => l.mangaItems.some(
        m => m.id === mangaId && (!sourceId || m.sourceId === sourceId || !m.sourceId)
      ))
      .map(l => l.id);

    return { categoryIds };
  }

  return {
    getLists,
    createList,
    updateList,
    deleteList,
    addMangaToList,
    removeMangaFromList,
    setMangaCategories,
    getMangaCategories,
  };
}

module.exports = { createListService };