/**
 * routes/library.js — User library, reading history, favorites, and reading status
 *
 * Endpoints:
 *   GET    /api/library              — Returns favorites + history arrays
 *   POST   /api/library/add          — Add or update a manga in favorites
 *   POST   /api/library/remove       — Remove a manga from favorites
 *   POST   /api/history/add          — Prepend an entry to reading history (cap 100)
 *   POST   /api/history/remove       — Remove a specific history entry
 *   DELETE /api/history/clear        — Wipe all history
 *   POST   /api/anilist/import-apply — Bulk-apply AniList library to local store
 *   POST   /api/favorites/toggle     — Toggle favorite status (add or remove)
 *   GET    /api/user/status          — Return the reading-status map
 *   POST   /api/user/status          — Set / clear reading status for a manga
 *
 * Security:
 *  • All manga payloads are sanitised via safeManga() — only a whitelisted
 *    set of scalar/array fields are written to the store.
 *  • Reading-status composite keys (mangaId:sourceId) are sanitised to
 *    prevent prototype-pollution attacks (__proto__, constructor…).
 *  • The `status` value is validated against a strict whitelist of known
 *    reading states to prevent arbitrary data injection.
 *  • String fields are length-capped throughout.
 */

'use strict';

const { safeManga } = require('../helpers');
const { readStore, writeStore } = require('../store');

function normSourceId(s) {
  const v = String(s || '').trim();
  if (!v || v === 'unknown' || v === 'null' || v === 'undefined') return '';
  return v.slice(0, 100);
}

// Valid reading status states
const VALID_STATUSES = new Set(['reading', 'completed', 'on_hold', 'plan_to_read', 'dropped']);

/**
 * Higher-order function to encapsulate try-catch blocks for async route handlers.
 * Ensures that any unhandled promise rejections are mapped cleanly to 500 errors.
 * 
 * @param {Function} fn 
 */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

/**
 * @param {import('express').Router} router
 */
function registerLibraryRoutes(router) {
  // ── GET /api/library ────────────────────────────────────────────────────────
  router.get('/api/library', asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json({ favorites: store.favorites || [], history: store.history || [] });
  }));

  // ── POST /api/library/add ───────────────────────────────────────────────────
  router.post('/api/library/add', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, manga } = req.body || {};
    const store = await readStore();
    
    const safeEntry = { ...safeManga(manga), sourceId, addedAt: new Date().toISOString() };
    const existing = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    
    if (existing >= 0) {
      store.favorites[existing] = safeEntry;
    } else {
      store.favorites.push(safeEntry);
    }
    
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites });
  }));

  // ── POST /api/library/remove ────────────────────────────────────────────────
  router.post('/api/library/remove', asyncHandler(async (req, res) => {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    
    store.favorites = store.favorites.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites });
  }));

  // ── POST /api/history/add ───────────────────────────────────────────────────
  router.post('/api/history/add', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, manga, chapterId } = req.body || {};
    const store = await readStore();
    
    const existing = store.history.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    if (existing >= 0) store.history.splice(existing, 1);
    
    store.history.unshift({
      ...safeManga(manga),
      sourceId,
      chapterId: String(chapterId ?? '').slice(0, 200),
      readAt: new Date().toISOString(),
    });
    
    store.history = store.history.slice(0, 100); // cap at 100 entries
    
    await writeStore(store);
    res.json({ ok: true, history: store.history });
  }));

  // ── POST /api/history/remove ────────────────────────────────────────────────
  router.post('/api/history/remove', asyncHandler(async (req, res) => {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    
    store.history = store.history.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    
    await writeStore(store);
    res.json({ ok: true, history: store.history });
  }));

  // ── DELETE /api/history/clear ───────────────────────────────────────────────
  router.delete('/api/history/clear', asyncHandler(async (_req, res) => {
    const store = await readStore();
    
    store.history = [];
    
    await writeStore(store);
    res.json({ ok: true });
  }));

  // ── POST /api/favorites/toggle ──────────────────────────────────────────────
  router.post('/api/favorites/toggle', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, manga } = req.body || {};
    const store = await readStore();
    
    const index = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    let isFavorite = false;
    
    if (index > -1) {
      store.favorites.splice(index, 1);
    } else {
      store.favorites.push({
        ...safeManga(manga),
        id: mangaId,
        sourceId,
        addedAt: new Date().toISOString()
      });
      isFavorite = true;
    }
    
    await writeStore(store);
    res.json({ success: true, isFavorite, favorites: store.favorites });
  }));

  // ── GET /api/user/status ────────────────────────────────────────────────────
  router.get('/api/user/status', asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json({ readingStatus: store.readingStatus });
  }));

  // ── POST /api/user/status ───────────────────────────────────────────────────
  router.post('/api/user/status', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, status, mangaData } = req.body || {};
    
    if (!mangaId || !sourceId) {
      return res.status(400).json({ error: 'mangaId and sourceId required' });
    }

    const store = await readStore();
    // Sanitise the composite key to prevent prototype-pollution attacks.
    const key = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);

    if (!status || status === 'none') {
      delete store.readingStatus[key];
    } else {
      // Reject unknown status values
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      
      store.readingStatus[key] = {
        status,
        updatedAt: new Date().toISOString(),
        manga: safeManga(mangaData),
      };
    }

    await writeStore(store);
    res.json({ ok: true, readingStatus: store.readingStatus });
  }));

  // ── POST /api/anilist/import-apply ─────────────────────────────────────────
  // Bulk-apply a normalized AniList MANGA library to favorites + readingStatus.
  // Expects: { entries: [{ anilistId, title, cover, status, progress, score }] }
  // AniList always wins in conflicts (per user preference).
  router.post('/api/anilist/import-apply', asyncHandler(async (req, res) => {
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries array required' });
    }

    // Cap to 2 000 entries per import to prevent abuse
    const safeEntries = entries.slice(0, 2000);

    const ANILIST_STATUS_MAP = {
      CURRENT:    'reading',
      COMPLETED:  'completed',
      PAUSED:     'on_hold',
      DROPPED:    'dropped',
      PLANNING:   'plan_to_read',
      REPEATING:  'reading',
    };

    const store = await readStore();
    let imported = 0, overwritten = 0, skipped = 0, failed = 0;

    for (const entry of safeEntries) {
      try {
        const anilistId = Number(entry.anilistId);
        if (!anilistId || anilistId <= 0) { skipped++; continue; }

        const localStatus = ANILIST_STATUS_MAP[String(entry.status || '').toUpperCase()] || null;

        // Build canonical AniList placeholder object.
        const mangaObj = safeManga({
          id:      String(anilistId),
          title:   String(entry.title || '').slice(0, 400),
          cover:   String(entry.cover || '').slice(0, 2000),
        });

        // Favorites — upsert
        // Check both: anilist placeholder AND already-resolved real entry (has anilistId field)
        const alId = String(anilistId);
        const favIdx = store.favorites.findIndex(
          m => (m.id === alId && m.sourceId === 'anilist') || m.anilistId === alId
        );
        const alreadyFav = favIdx >= 0;
        const existingFav = alreadyFav ? store.favorites[favIdx] : null;
        if (alreadyFav) {
          // If this entry was already resolved to a real source, preserve real id/source.
          // Otherwise keep/update as AniList placeholder.
          if (existingFav?.sourceId && existingFav.sourceId !== 'anilist') {
            store.favorites[favIdx] = {
              ...existingFav,
              title: mangaObj.title || existingFav.title,
              cover: mangaObj.cover || existingFav.cover,
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

        // Reading status — always overwrite with AniList value
        if (localStatus) {
          const alKey = `${anilistId}:anilist`;
          let targetKey = alKey;
          let targetManga = { ...mangaObj, sourceId: 'anilist' };

          if (existingFav?.id && existingFav?.sourceId && existingFav.sourceId !== 'anilist') {
            targetKey = `${existingFav.id}:${existingFav.sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
            targetManga = safeManga({
              id: existingFav.id,
              title: existingFav.title || mangaObj.title,
              cover: existingFav.cover || mangaObj.cover,
            });
            targetManga.sourceId = existingFav.sourceId;
          }

          store.readingStatus[targetKey] = {
            status:    localStatus,
            updatedAt: new Date().toISOString(),
            manga:     targetManga,
          };

          if (targetKey !== alKey) delete store.readingStatus[alKey];
        }
      } catch (_) {
        failed++;
      }
    }

    store.anilistSync = {
      lastImportAt:   new Date().toISOString(),
      importedCount:  imported,
      overwriteCount: overwritten,
      skippedCount:   skipped,
      failedCount:    failed,
    };

    await writeStore(store);
    res.json({
      ok: true,
      imported,
      overwritten,
      skipped,
      failed,
      syncedAt: store.anilistSync.lastImportAt,
    });
  }));

  // ── POST /api/anilist/resolve-apply ────────────────────────────────────────
  // Replace anilist-source favorites with real source entries discovered by the
  // frontend search and copy reading status to the new key.
  // Expects: { resolutions: [{ anilistId, mangaId, sourceId, title, cover }] }
  router.post('/api/anilist/resolve-apply', asyncHandler(async (req, res) => {
    const { resolutions } = req.body || {};
    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return res.json({ ok: true, resolved: 0 });
    }

    const store = await readStore();
    let resolved = 0;

    for (const r of resolutions.slice(0, 2000)) {
      try {
        const anilistId = String(Number(r.anilistId) || 0);
        const mangaId   = String(r.mangaId  || '').slice(0, 400);
        const sourceId  = String(r.sourceId || '').slice(0, 100);
        const title     = String(r.title    || '').slice(0, 400);
        const cover     = String(r.cover    || '').slice(0, 2000);

        if (!anilistId || anilistId === '0' || !mangaId || !sourceId || sourceId === 'anilist') continue;

        const mangaObj = safeManga({ id: mangaId, title, cover });

        // Upsert real-source favorite
        const realFavIdx = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
        // Find existing anilist entry to carry its addedAt timestamp
        const alFavIdx = store.favorites.findIndex(m => m.id === anilistId && m.sourceId === 'anilist');
        const alFav    = alFavIdx >= 0 ? store.favorites[alFavIdx] : null;

        if (realFavIdx >= 0) {
          store.favorites[realFavIdx] = {
            ...store.favorites[realFavIdx],
            ...mangaObj,
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

        // Copy reading status from the anilist key to the real key (overwrite so AniList stays authoritative)
        const alKey   = `${anilistId}:anilist`;
        const realKey = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
        const alStatus = store.readingStatus[alKey];
        if (alStatus) {
          store.readingStatus[realKey] = { ...alStatus, manga: { ...mangaObj, sourceId } };
          delete store.readingStatus[alKey];
        }

        // Remove the anilist placeholder favorite now that the real one is in place
        if (alFavIdx >= 0) {
          // splice index may have shifted if realFavIdx was before it
          const freshIdx = store.favorites.findIndex(m => m.id === anilistId && m.sourceId === 'anilist');
          if (freshIdx >= 0) store.favorites.splice(freshIdx, 1);
        }

        resolved++;
      } catch (_) { /* skip bad entry */ }
    }

    await writeStore(store);
    res.json({ ok: true, resolved });
  }));

  // ── GET /api/anilist/sync-meta ─────────────────────────────────────────────
  router.get('/api/anilist/sync-meta', asyncHandler(async (_req, res) => {
    const store = await readStore();
    res.json(store.anilistSync || {});
  }));

  // ── POST /api/library/migrate ──────────────────────────────────────────────
  // Migrate a set of manga from one source to another.
  // Expects: { migrations: [{ fromMangaId, fromSourceId, toMangaId, toSourceId, title, cover }] }
  // For each entry:
  //  1. Upserts a new favorite with the target source (carries addedAt from old entry)
  //  2. Copies readingStatus from old key to new key (only if new key absent)
  //  3. Replaces manga in all custom lists
  //  4. Removes the old favorite
  router.post('/api/library/migrate', asyncHandler(async (req, res) => {
    const { migrations } = req.body || {};
    if (!Array.isArray(migrations) || migrations.length === 0) {
      return res.status(400).json({ error: 'migrations array required' });
    }

    const store = await readStore();
    let migrated = 0, failed = 0;

    for (const m of migrations.slice(0, 500)) {
      try {
        const fromMangaId  = String(m.fromMangaId  || '').slice(0, 400);
        const fromSourceIdRaw = normSourceId(m.fromSourceId);
        const toMangaId    = String(m.toMangaId    || '').slice(0, 400);
        const toSourceId   = String(m.toSourceId   || '').slice(0, 100);
        const title        = String(m.title        || '').slice(0, 400);
        const cover        = String(m.cover        || '').slice(0, 2000);

        if (!fromMangaId || !toMangaId || !toSourceId) { failed++; continue; }
        if (fromMangaId === toMangaId && fromSourceIdRaw === toSourceId) { failed++; continue; }

        const mangaObj = safeManga({ id: toMangaId, title, cover, sourceId: toSourceId });

        // 1. Upsert target-source favorite
        const oldFavIdx = store.favorites.findIndex(
          f => f.id === fromMangaId && normSourceId(f.sourceId) === fromSourceIdRaw
        );
        const oldFav    = oldFavIdx >= 0 ? store.favorites[oldFavIdx] : null;
        const newFavIdx = store.favorites.findIndex(f => f.id === toMangaId   && f.sourceId === toSourceId);

        if (newFavIdx >= 0) {
          store.favorites[newFavIdx] = { ...store.favorites[newFavIdx], ...mangaObj, updatedAt: new Date().toISOString() };
        } else {
          store.favorites.push({ ...mangaObj, addedAt: oldFav?.addedAt || new Date().toISOString() });
        }

        // 2. Copy reading status (old key → new key, overwrite to keep latest status)
        const oldKey = `${fromMangaId}:${fromSourceIdRaw || 'unknown'}`.replace(/[^a-z0-9:_-]/gi, '_');
        const newKey = `${toMangaId}:${toSourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
        const oldStatus = store.readingStatus[oldKey];
        if (oldStatus) {
          store.readingStatus[newKey] = { ...oldStatus, manga: mangaObj };
        }
        delete store.readingStatus[oldKey];

        // 3. Update category lists — replace the old manga entry with the new one
        for (const list of (store.customLists || [])) {
          const idx = list.mangaItems.findIndex(
            i => i.id === fromMangaId && normSourceId(i.sourceId) === fromSourceIdRaw
          );
          if (idx >= 0) {
            // Only add new entry if it isn't already in the list
            const alreadyIn = list.mangaItems.some(i => i.id === toMangaId && i.sourceId === toSourceId);
            if (!alreadyIn) {
              list.mangaItems[idx] = { ...mangaObj, addedAt: list.mangaItems[idx].addedAt || new Date().toISOString() };
            } else {
              list.mangaItems.splice(idx, 1);
            }
          }
        }

        // 4. Remove old favorite
        const freshOldIdx = store.favorites.findIndex(
          f => f.id === fromMangaId && normSourceId(f.sourceId) === fromSourceIdRaw
        );
        if (freshOldIdx >= 0) store.favorites.splice(freshOldIdx, 1);

        migrated++;
      } catch (_) { failed++; }
    }

    await writeStore(store);
    res.json({ ok: true, migrated, failed });
  }));

  // ── DELETE /api/library/clear ────────────────────────────────────────────────
  router.delete('/api/library/clear', asyncHandler(async (_req, res) => {
    const store = await readStore();
    store.favorites    = [];
    store.readingStatus = {};
    store.customLists  = [];
    await writeStore(store);
    res.json({ ok: true });
  }));
}

module.exports = { registerLibraryRoutes };
