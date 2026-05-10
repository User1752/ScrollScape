/**
 * routes/library.js — User library, reading history, favorites, and reading status
 *
 * Endpoints:
 *   GET    /api/library              — Returns favorites + history arrays
 *   POST   /api/library/add          — Add or update a manga in favorites
 *   POST   /api/library/remove       — Remove a manga from favorites
 *   POST   /api/library/cover        — Replace a manga cover in stored local data
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

const { safeManga, isSafeUrl } = require('../helpers');
const { readStore, writeStore } = require('../store');

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

  // Legacy fallback: unsanitized composite key may still exist in old stores.
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

  // 1) Try readingStatus keys: "mangaId:sourceId"
  const candidates = new Set();
  for (const k of Object.keys(store.readingStatus || {})) {
    const sep = k.indexOf(':');
    if (sep < 0) continue;
    const left = k.slice(0, sep);
    const right = normSourceId(k.slice(sep + 1));
    if (left === idPart && right) candidates.add(right);
  }
  if (candidates.size === 1) return [...candidates][0];

  // 2) Fallback to history entries with same manga id
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
    // Self-heal legacy favorites that lost sourceId during earlier migrations.
    if (normalizeFavoritesSourceIds(store)) {
      await writeStore(store);
    }
    res.json({ favorites: store.favorites || [], history: store.history || [], coverOverrides: store.coverOverrides || {} });
  }));

  // ── POST /api/library/add ───────────────────────────────────────────────────
  router.post('/api/library/add', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, manga } = req.body || {};
    const store = await readStore();
    
    const safeEntry = applyCoverOverride(store, { ...safeManga(manga), sourceId, addedAt: new Date().toISOString() }, sourceId);
    const existing = store.favorites.findIndex(m => m.id === mangaId && m.sourceId === sourceId);
    
    if (existing >= 0) {
      store.favorites[existing] = safeEntry;
    } else {
      store.favorites.push(safeEntry);
    }
    
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites, coverOverrides: store.coverOverrides || {} });
  }));

  // ── POST /api/library/remove ────────────────────────────────────────────────
  router.post('/api/library/remove', asyncHandler(async (req, res) => {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    
    store.favorites = store.favorites.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    
    await writeStore(store);
    res.json({ ok: true, favorites: store.favorites, coverOverrides: store.coverOverrides || {} });
  }));

  // ── POST /api/library/cover ────────────────────────────────────────────────
  router.post('/api/library/cover', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, cover } = req.body || {};
    const nextCover = String(cover || '').trim().slice(0, 2000);

    if (!mangaId || !sourceId) {
      return res.status(400).json({ error: 'mangaId and sourceId required' });
    }
    if (!isAllowedCoverUrl(nextCover)) {
      return res.status(400).json({ error: 'A valid public image URL is required' });
    }

    const store = await readStore();
  if (!store.coverOverrides || typeof store.coverOverrides !== 'object') store.coverOverrides = {};
  store.coverOverrides[coverOverrideKey(mangaId, sourceId)] = nextCover;
    let changed = false;

    store.favorites = (store.favorites || []).map((manga) => {
      if (String(manga?.id) !== String(mangaId) || String(manga?.sourceId || '') !== String(sourceId)) return manga;
      changed = true;
      return { ...manga, cover: nextCover };
    });

    store.history = (store.history || []).map((manga) => {
      if (String(manga?.id) !== String(mangaId) || String(manga?.sourceId || '') !== String(sourceId)) return manga;
      changed = true;
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
      changed = true;
    }

    await writeStore(store);
    res.json({ ok: true, cover: nextCover, favorites: store.favorites, history: store.history, readingStatus: store.readingStatus, coverOverrides: store.coverOverrides || {} });
  }));

  // ── POST /api/history/add ───────────────────────────────────────────────────
  router.post('/api/history/add', asyncHandler(async (req, res) => {
    const { mangaId, sourceId, manga, chapterId, chapterName } = req.body || {};
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
    
    store.history = store.history.slice(0, 100); // cap at 100 entries
    
    await writeStore(store);
    res.json({ ok: true, history: store.history, coverOverrides: store.coverOverrides || {} });
  }));

  // ── POST /api/history/remove ────────────────────────────────────────────────
  router.post('/api/history/remove', asyncHandler(async (req, res) => {
    const { mangaId, sourceId } = req.body || {};
    const store = await readStore();
    
    store.history = store.history.filter(m => !(m.id === mangaId && m.sourceId === sourceId));
    
    await writeStore(store);
    res.json({ ok: true, history: store.history, coverOverrides: store.coverOverrides || {} });
  }));

  // ── DELETE /api/history/clear ───────────────────────────────────────────────
  router.delete('/api/history/clear', asyncHandler(async (_req, res) => {
    const store = await readStore();
    
    store.history = [];
    
    await writeStore(store);
    res.json({ ok: true, coverOverrides: store.coverOverrides || {} });
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
      store.favorites.push(applyCoverOverride(store, {
        ...safeManga(manga),
        id: mangaId,
        sourceId,
        addedAt: new Date().toISOString()
      }, sourceId));
      isFavorite = true;
    }
    
    await writeStore(store);
    res.json({ success: true, isFavorite, favorites: store.favorites, coverOverrides: store.coverOverrides || {} });
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

  // ── POST /api/anilist/import-apply ───────────────────────────────────────
  // Bulk-apply a normalized AniList MANGA library to favorites + readingStatus.
  // Expects: { entries: [{ anilistId, title, cover, status, progress, score }] }
  // AniList always wins in conflicts (per user preference).
  // Three-tier dedup to prevent duplicates:
  //   Tier 1: id === alId && sourceId === 'anilist'  (existing anilist placeholder)
  //   Tier 2: m.anilistId === alId                   (already resolved to real source)
  //   Tier 3: normalized title match in real sources (added manually before import)
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

    // Normalize a title for fuzzy dedup (lowercase, strip accents & punctuation)
    const normTitle = (s) => String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

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

        const alId = String(anilistId);
        const nt   = normTitle(entry.title);

        // Tier 1 & 2: anilist placeholder or already-resolved real-source entry
        let favIdx = store.favorites.findIndex(
          m => (m.id === alId && m.sourceId === 'anilist') || m.anilistId === alId
        );

        // Tier 3: title match — catches manga the user added manually before this import
        if (favIdx < 0 && nt) {
          favIdx = store.favorites.findIndex(
            m => m.sourceId !== 'anilist' && normTitle(m.title) === nt
          );
        }

        const alreadyFav  = favIdx >= 0;
        const existingFav = alreadyFav ? store.favorites[favIdx] : null;

        if (alreadyFav) {
          if (existingFav?.sourceId && existingFav.sourceId !== 'anilist') {
            // Already in library under a real source — stamp anilistId, keep local title/cover
            store.favorites[favIdx] = {
              ...existingFav,
              title:     existingFav.title || mangaObj.title,
              cover:     existingFav.cover || mangaObj.cover,
              anilistId: alId,
              updatedAt: new Date().toISOString(),
            };
          } else {
            // Existing anilist placeholder — refresh metadata
            store.favorites[favIdx] = {
              ...existingFav,
              ...mangaObj,
              sourceId:  'anilist',
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
          let targetKey   = alKey;
          let targetManga = { ...mangaObj, sourceId: 'anilist' };

          // Use the (possibly just-updated) favorite to resolve the correct key
          const updatedFav = store.favorites[favIdx];
          if (updatedFav?.id && updatedFav?.sourceId && updatedFav.sourceId !== 'anilist') {
            targetKey = `${updatedFav.id}:${updatedFav.sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
            targetManga = safeManga({
              id:    updatedFav.id,
              title: updatedFav.title || mangaObj.title,
              cover: updatedFav.cover || mangaObj.cover,
            });
            targetManga.sourceId = updatedFav.sourceId;
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
          // Real entry already exists: stamp anilistId, preserve local title/cover
          store.favorites[realFavIdx] = {
            ...store.favorites[realFavIdx],
            title:     store.favorites[realFavIdx].title || mangaObj.title,
            cover:     store.favorites[realFavIdx].cover || mangaObj.cover,
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

        // Copy reading status: anilist key -> real key (only if AniList entry is newer)
        const alKey   = `${anilistId}:anilist`;
        const realKey = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
        const alStatus = store.readingStatus[alKey];
        if (alStatus) {
          const existingSt = store.readingStatus[realKey];
          if (!existingSt || new Date(alStatus.updatedAt) >= new Date(existingSt.updatedAt || 0)) {
            store.readingStatus[realKey] = { ...alStatus, manga: { ...mangaObj, sourceId } };
          }
          delete store.readingStatus[alKey];
        }

        // Always remove the anilist placeholder - even if the real-source entry pre-existed
        const freshAlIdx = store.favorites.findIndex(m => m.id === anilistId && m.sourceId === 'anilist');
        if (freshAlIdx >= 0) store.favorites.splice(freshAlIdx, 1);

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
  //  2. Copies readingStatus from old key to new key
  //  3. Copies reviews/rating from old mangaId key to new mangaId key
  //  4. Replaces manga in all custom lists
  //  5. Removes the old favorite
  // Response includes a `migrations` array so the client can remap localStorage data.
  router.post('/api/library/migrate', asyncHandler(async (req, res) => {
    const { migrations } = req.body || {};
    if (!Array.isArray(migrations) || migrations.length === 0) {
      return res.status(400).json({ error: 'migrations array required' });
    }

    const store = await readStore();
    let migrated = 0, failed = 0;
    const migratedEntries = [];

    for (const m of migrations.slice(0, 500)) {
      try {
        const fromMangaId  = String(m.fromMangaId  || '').slice(0, 400);
        const fromSourceIdRaw = normSourceId(m.fromSourceId);
        const toMangaId    = String(m.toMangaId    || '').slice(0, 400);
        const toSourceId   = String(m.toSourceId   || '').slice(0, 100);
        const title        = String(m.title        || '').slice(0, 400);
        const cover        = String(m.cover        || '').slice(0, 2000);

        if (!fromMangaId || !toMangaId || !toSourceId) {
          console.warn('[MIGRATION][BACKEND] Skipped: missing ids', { fromMangaId, toMangaId, toSourceId });
          failed++; continue;
        }
        if (fromMangaId === toMangaId && fromSourceIdRaw === toSourceId) {
          console.warn('[MIGRATION][BACKEND] Skipped: same manga and source', { fromMangaId, toMangaId, fromSourceIdRaw, toSourceId });
          failed++; continue;
        }

        const mangaObj = { ...safeManga({ id: toMangaId, title, cover, sourceId: toSourceId }), sourceId: toSourceId };

        // 1. Upsert target-source favorite
        const oldFavIdx = store.favorites.findIndex(
          f => f.id === fromMangaId && normSourceId(f.sourceId) === fromSourceIdRaw
        );
        const oldFav    = oldFavIdx >= 0 ? store.favorites[oldFavIdx] : null;
        const newFavIdx = store.favorites.findIndex(f => f.id === toMangaId   && f.sourceId === toSourceId);

        // Preserve AniList linkage metadata for tracker continuity.
        const carriedAnilistId = oldFav?.anilistId || (newFavIdx >= 0 ? store.favorites[newFavIdx]?.anilistId : null);
        if (carriedAnilistId) mangaObj.anilistId = String(carriedAnilistId);

        if (newFavIdx >= 0) {
          store.favorites[newFavIdx] = { ...store.favorites[newFavIdx], ...mangaObj, updatedAt: new Date().toISOString() };
        } else {
          store.favorites.push({ ...mangaObj, addedAt: oldFav?.addedAt || new Date().toISOString() });
        }

        // 2. Copy reading status (old key → new key, overwrite to keep latest status)
        const newKey = safeStatusKey(toMangaId, toSourceId);
        const statusCandidates = _collectReadingStatusCandidates(store, fromMangaId, fromSourceIdRaw);
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

        // 3. Copy reviews / rating (keyed by mangaId only, not source)
        const oldReviewRawKey = String(fromMangaId).slice(0, 200);
        const oldReviewSafeKey = safeReviewKey(fromMangaId);
        const newReviewKey = safeReviewKey(toMangaId);
        const reviewSourceKeys = [...new Set([oldReviewRawKey, oldReviewSafeKey])]
          .filter(k => k && Array.isArray(store.reviews?.[k]) && store.reviews[k].length > 0);

        if (newReviewKey && reviewSourceKeys.length > 0) {
          let incoming = [];
          for (const k of reviewSourceKeys) incoming = incoming.concat(store.reviews[k] || []);
          store.reviews[newReviewKey] = _mergeReviewEntries(store.reviews[newReviewKey], incoming);

          for (const k of reviewSourceKeys) {
            if (k !== newReviewKey) delete store.reviews[k];
          }
        } else if (reviewSourceKeys.length === 0) {
          console.warn('[MIGRATION][BACKEND] No reviews to copy for manga:', fromMangaId);
        }

        // 4. Update category lists — replace the old manga entry with the new one
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

        // 4. Remove old favorite
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
    // Return only successful migrations so the client remaps local data safely.
    res.json({ ok: true, migrated, failed, migrations: migratedEntries });
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
