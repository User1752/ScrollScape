'use strict';

const { createLibraryContentService } = require('./content-service');

function createLibraryService({ readStore, writeStore, safeManga, isSafeUrl }) {
  const contentService = createLibraryContentService({ readStore, writeStore, safeManga, isSafeUrl });

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

  function mergeReviewEntries(existing, incoming) {
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

  function collectReadingStatusCandidates(store, fromMangaId, fromSourceIdRaw) {
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

  async function getLibrary() {
    return contentService.getLibrary();
  }

  async function addToLibrary({ mangaId, sourceId, manga } = {}) {
    return contentService.addToLibrary({ mangaId, sourceId, manga });
  }

  async function removeFromLibrary({ mangaId, sourceId } = {}) {
    return contentService.removeFromLibrary({ mangaId, sourceId });
  }

  async function updateLibraryCover({ mangaId, sourceId, cover } = {}) {
    return contentService.updateLibraryCover({ mangaId, sourceId, cover });
  }

  async function addHistoryEntry({ mangaId, sourceId, manga, chapterId, chapterName } = {}) {
    return contentService.addHistoryEntry({ mangaId, sourceId, manga, chapterId, chapterName });
  }

  async function removeHistoryEntry({ mangaId, sourceId } = {}) {
    return contentService.removeHistoryEntry({ mangaId, sourceId });
  }

  async function clearHistory() {
    return contentService.clearHistory();
  }

  async function toggleFavorite({ mangaId, sourceId, manga } = {}) {
    return contentService.toggleFavorite({ mangaId, sourceId, manga });
  }

  async function getUserStatus() {
    return contentService.getUserStatus();
  }

  async function setUserStatus({ mangaId, sourceId, status, mangaData } = {}) {
    return contentService.setUserStatus({ mangaId, sourceId, status, mangaData });
  }

  async function importAniListLibrary({ entries } = {}) {
    if (!Array.isArray(entries) || entries.length === 0) {
      const err = new Error('entries array required');
      err.statusCode = 400;
      throw err;
    }

    const safeEntries = entries.slice(0, 2000);
    const ANILIST_STATUS_MAP = {
      CURRENT: 'reading',
      COMPLETED: 'completed',
      PAUSED: 'on_hold',
      DROPPED: 'dropped',
      PLANNING: 'plan_to_read',
      REPEATING: 'reading',
    };

    const normTitle = (s) => String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const store = await readStore();
    let imported = 0;
    let overwritten = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of safeEntries) {
      try {
        const anilistId = Number(entry.anilistId);
        if (!anilistId || anilistId <= 0) { skipped++; continue; }

        const localStatus = ANILIST_STATUS_MAP[String(entry.status || '').toUpperCase()] || null;
        const mangaObj = safeManga({
          id: String(anilistId),
          title: String(entry.title || '').slice(0, 400),
          cover: String(entry.cover || '').slice(0, 2000),
        });

        const alId = String(anilistId);
        const nt = normTitle(entry.title);

        let favIdx = store.favorites.findIndex(
          m => (m.id === alId && m.sourceId === 'anilist') || m.anilistId === alId
        );

        if (favIdx < 0 && nt) {
          favIdx = store.favorites.findIndex(
            m => m.sourceId !== 'anilist' && normTitle(m.title) === nt
          );
        }

        const alreadyFav = favIdx >= 0;
        const existingFav = alreadyFav ? store.favorites[favIdx] : null;

        if (alreadyFav) {
          if (existingFav?.sourceId && existingFav.sourceId !== 'anilist') {
            store.favorites[favIdx] = {
              ...existingFav,
              title: existingFav.title || mangaObj.title,
              cover: existingFav.cover || mangaObj.cover,
              anilistId: alId,
              updatedAt: new Date().toISOString(),
            };
          } else {
            store.favorites[favIdx] = {
              ...existingFav,
              ...mangaObj,
              sourceId: 'anilist',
              anilistId: alId,
              updatedAt: new Date().toISOString(),
            };
          }
          overwritten++;
        } else {
          store.favorites.push({ ...mangaObj, sourceId: 'anilist', anilistId: alId, addedAt: new Date().toISOString() });
          imported++;
        }

        if (localStatus) {
          const alKey = `${anilistId}:anilist`;
          let targetKey = alKey;
          let targetManga = { ...mangaObj, sourceId: 'anilist' };

          const updatedFav = store.favorites[favIdx];
          if (updatedFav?.id && updatedFav?.sourceId && updatedFav.sourceId !== 'anilist') {
            targetKey = `${updatedFav.id}:${updatedFav.sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
            targetManga = safeManga({
              id: updatedFav.id,
              title: updatedFav.title || mangaObj.title,
              cover: updatedFav.cover || mangaObj.cover,
            });
            targetManga.sourceId = updatedFav.sourceId;
          }

          store.readingStatus[targetKey] = {
            status: localStatus,
            updatedAt: new Date().toISOString(),
            manga: targetManga,
          };

          if (targetKey !== alKey) delete store.readingStatus[alKey];
        }
      } catch (_) {
        failed++;
      }
    }

    store.anilistSync = {
      lastImportAt: new Date().toISOString(),
      importedCount: imported,
      overwriteCount: overwritten,
      skippedCount: skipped,
      failedCount: failed,
    };

    await writeStore(store);
    return {
      ok: true,
      imported,
      overwritten,
      skipped,
      failed,
      syncedAt: store.anilistSync.lastImportAt,
    };
  }

  async function resolveAniListLibrary({ resolutions } = {}) {
    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return { ok: true, resolved: 0 };
    }

    const store = await readStore();
    let resolved = 0;

    for (const r of resolutions.slice(0, 2000)) {
      try {
        const anilistId = String(Number(r.anilistId) || 0);
        const mangaId = String(r.mangaId || '').slice(0, 400);
        const sourceId = String(r.sourceId || '').slice(0, 100);
        const title = String(r.title || '').slice(0, 400);
        const cover = String(r.cover || '').slice(0, 2000);

        if (!anilistId || anilistId === '0' || !mangaId || !sourceId || sourceId === 'anilist') continue;

        const mangaObj = safeManga({ id: mangaId, title, cover });

        const realFavIdx = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
        const alFavIdx = store.favorites.findIndex(m => m.id === anilistId && m.sourceId === 'anilist');
        const alFav = alFavIdx >= 0 ? store.favorites[alFavIdx] : null;

        if (realFavIdx >= 0) {
          store.favorites[realFavIdx] = {
            ...store.favorites[realFavIdx],
            title: store.favorites[realFavIdx].title || mangaObj.title,
            cover: store.favorites[realFavIdx].cover || mangaObj.cover,
            sourceId,
            anilistId,
            updatedAt: new Date().toISOString(),
          };
        } else {
          store.favorites.push({
            ...mangaObj,
            sourceId,
            anilistId,
            addedAt: alFav?.addedAt || new Date().toISOString(),
          });
        }

        const alKey = `${anilistId}:anilist`;
        const realKey = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
        const alStatus = store.readingStatus[alKey];
        if (alStatus) {
          const existingSt = store.readingStatus[realKey];
          if (!existingSt || new Date(alStatus.updatedAt) >= new Date(existingSt.updatedAt || 0)) {
            store.readingStatus[realKey] = { ...alStatus, manga: { ...mangaObj, sourceId } };
          }
          delete store.readingStatus[alKey];
        }

        const freshAlIdx = store.favorites.findIndex(m => m.id === anilistId && m.sourceId === 'anilist');
        if (freshAlIdx >= 0) store.favorites.splice(freshAlIdx, 1);

        resolved++;
      } catch (_) {
        // Skip bad entry.
      }
    }

    await writeStore(store);
    return { ok: true, resolved };
  }

  async function getAniListSyncMeta() {
    const store = await readStore();
    return store.anilistSync || {};
  }

  async function migrateLibrary({ migrations } = {}) {
    if (!Array.isArray(migrations) || migrations.length === 0) {
      const err = new Error('migrations array required');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    let migrated = 0;
    let failed = 0;
    const migratedEntries = [];

    for (const m of migrations.slice(0, 500)) {
      try {
        const fromMangaId = String(m.fromMangaId || '').slice(0, 400);
        const fromSourceIdRaw = normSourceId(m.fromSourceId);
        const toMangaId = String(m.toMangaId || '').slice(0, 400);
        const toSourceId = String(m.toSourceId || '').slice(0, 100);
        const title = String(m.title || '').slice(0, 400);
        const cover = String(m.cover || '').slice(0, 2000);

        if (!fromMangaId || !toMangaId || !toSourceId) {
          console.warn('[MIGRATION][BACKEND] Skipped: missing ids', { fromMangaId, toMangaId, toSourceId });
          failed++;
          continue;
        }
        if (fromMangaId === toMangaId && fromSourceIdRaw === toSourceId) {
          console.warn('[MIGRATION][BACKEND] Skipped: same manga and source', { fromMangaId, toMangaId, fromSourceIdRaw, toSourceId });
          failed++;
          continue;
        }

        const mangaObj = { ...safeManga({ id: toMangaId, title, cover, sourceId: toSourceId }), sourceId: toSourceId };

        const oldFavIdx = store.favorites.findIndex(
          f => f.id === fromMangaId && normSourceId(f.sourceId) === fromSourceIdRaw
        );
        const oldFav = oldFavIdx >= 0 ? store.favorites[oldFavIdx] : null;
        const newFavIdx = store.favorites.findIndex(f => f.id === toMangaId && f.sourceId === toSourceId);

        const carriedAnilistId = oldFav?.anilistId || (newFavIdx >= 0 ? store.favorites[newFavIdx]?.anilistId : null);
        if (carriedAnilistId) mangaObj.anilistId = String(carriedAnilistId);

        if (newFavIdx >= 0) {
          store.favorites[newFavIdx] = { ...store.favorites[newFavIdx], ...mangaObj, updatedAt: new Date().toISOString() };
        } else {
          store.favorites.push({ ...mangaObj, addedAt: oldFav?.addedAt || new Date().toISOString() });
        }

        const newKey = safeStatusKey(toMangaId, toSourceId);
        const statusCandidates = collectReadingStatusCandidates(store, fromMangaId, fromSourceIdRaw);
        if (statusCandidates.length > 0) {
          const picked = statusCandidates[0];
          store.readingStatus[newKey] = { ...picked.value, manga: mangaObj };
          if (picked.key !== newKey) delete store.readingStatus[picked.key];
        } else {
          console.warn('[MIGRATION][BACKEND] No reading status found for migration', {
            fromMangaId,
            fromSourceId: fromSourceIdRaw || 'unknown',
          });
        }

        const oldReviewRawKey = String(fromMangaId).slice(0, 200);
        const oldReviewSafeKey = safeReviewKey(fromMangaId);
        const newReviewKey = safeReviewKey(toMangaId);
        const reviewSourceKeys = [...new Set([oldReviewRawKey, oldReviewSafeKey])]
          .filter(k => k && Array.isArray(store.reviews?.[k]) && store.reviews[k].length > 0);

        if (newReviewKey && reviewSourceKeys.length > 0) {
          let incoming = [];
          for (const k of reviewSourceKeys) incoming = incoming.concat(store.reviews[k] || []);
          store.reviews[newReviewKey] = mergeReviewEntries(store.reviews[newReviewKey], incoming);

          for (const k of reviewSourceKeys) {
            if (k !== newReviewKey) delete store.reviews[k];
          }
        } else if (reviewSourceKeys.length === 0) {
          console.warn('[MIGRATION][BACKEND] No reviews to copy for manga:', fromMangaId);
        }

        for (const list of (store.customLists || [])) {
          const idx = list.mangaItems.findIndex(
            i => i.id === fromMangaId && normSourceId(i.sourceId) === fromSourceIdRaw
          );
          if (idx >= 0) {
            const alreadyIn = list.mangaItems.some(i => i.id === toMangaId && i.sourceId === toSourceId);
            if (!alreadyIn) {
              list.mangaItems[idx] = { ...mangaObj, addedAt: list.mangaItems[idx].addedAt || new Date().toISOString() };
            } else {
              list.mangaItems.splice(idx, 1);
            }
          }
        }

        const freshOldIdx = store.favorites.findIndex(
          f => f.id === fromMangaId && normSourceId(f.sourceId) === fromSourceIdRaw
        );
        if (freshOldIdx >= 0) {
          store.favorites.splice(freshOldIdx, 1);
        }

        migrated++;
        migratedEntries.push({ fromMangaId, toMangaId });
      } catch (err) {
        failed++;
        console.error('[MIGRATION][BACKEND] Migration failed:', err);
      }
    }

    await writeStore(store);
    return { ok: true, migrated, failed, migrations: migratedEntries };
  }

  async function clearLibrary() {
    return contentService.clearLibrary();
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
    importAniListLibrary,
    resolveAniListLibrary,
    getAniListSyncMeta,
    migrateLibrary,
    clearLibrary,
  };
}

module.exports = { createLibraryService };