'use strict';

/**
 * Imports a Tachiyomi/Mihon library backup (.tachibk — gzip-compressed
 * protobuf) into ScrollScape's own library.
 *
 * Honest scope limit, surfaced in the import summary rather than hidden:
 * Tachiyomi/Mihon's `source` field is a numeric id specific to *its own*
 * extension ecosystem — there is no general way to map that to one of
 * ScrollScape's own scraper plugin ids. This importer:
 *   1. Resolves a source NAME from the backup's own source list
 *      (BackupSource: {name, sourceId}) for whichever numeric id a manga
 *      references.
 *   2. Tries to match that name against a currently-installed ScrollScape
 *      source by name (case-insensitive), and — only for sources where the
 *      URL scheme is known to carry the same id (currently just MangaDex's
 *      UUID-based URLs) — extracts a working manga id from it.
 *   3. Everything else imports as metadata-only, sourceId 'unknown' — the
 *      same tolerated state the app's own favorites-source-inference code
 *      already handles elsewhere (see inferSourceIdForFavorite in
 *      library/content-service.js). Title, cover, author, description,
 *      genres, reading status (heuristic — see below) and categories all
 *      still come across; only "read the next chapter directly" needs the
 *      user to re-link it to a live source afterward (the existing Migrate
 *      feature already does exactly that).
 *
 * Tachiyomi/Mihon has no direct "user reading status" field — that's a
 * per-user library-organisation concept (categories/shelves) that varies
 * per install. Status here is approximated from chapter read state:
 * all read -> completed, some read -> reading, none read -> plan_to_read.
 */

const zlib = require('zlib');
const path = require('path');
const protobuf = require('protobufjs');

let backupRoot = null;
async function getBackupType() {
  if (!backupRoot) {
    backupRoot = await protobuf.load(path.join(__dirname, 'backup.proto'));
  }
  return backupRoot.lookupType('tachiyomi.Backup');
}

const MANGADEX_UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

// Tachiyomi's own SManga status constants (0=unknown .. 6=on hiatus).
const PUBLICATION_STATUS = { 1: 'ongoing', 2: 'completed', 3: 'ongoing', 4: 'completed', 5: 'cancelled', 6: 'ongoing' };

function resolveSourceIdForManga(backupSourceName, installedSources) {
  if (!backupSourceName) return null;
  const needle = backupSourceName.trim().toLowerCase();
  for (const [sid, info] of Object.entries(installedSources || {})) {
    const name = String(info?.name || '').trim().toLowerCase();
    if (name && (name === needle || name.includes(needle) || needle.includes(name))) return sid;
  }
  return null;
}

function extractWorkingMangaId(sourceId, url) {
  if (sourceId === 'mangadex') {
    const m = MANGADEX_UUID_RE.exec(String(url || ''));
    if (m) return m[1];
  }
  return null;
}

function computeReadingStatus(chapters) {
  const total = chapters.length;
  if (total === 0) return null;
  const readCount = chapters.filter((c) => c.read).length;
  if (readCount === 0) return 'plan_to_read';
  if (readCount >= total) return 'completed';
  return 'reading';
}

function createMihonImportService({ readStore, writeStore, safeManga, sha1Short }) {
  async function parseBackupBuffer(rawBuffer) {
    // .tachibk is gzip-compressed; a raw .proto dump (rare, but some tools
    // export uncompressed) starts with a protobuf tag byte instead of the
    // gzip magic number (0x1f 0x8b) — try gunzip first, fall back to raw.
    let buffer = rawBuffer;
    try {
      buffer = zlib.gunzipSync(rawBuffer);
    } catch (_) {
      // Not gzipped — assume it's already a raw protobuf buffer.
    }

    const BackupType = await getBackupType();
    const decoded = BackupType.decode(buffer);
    return BackupType.toObject(decoded, { longs: Number, enums: Number, defaults: true });
  }

  async function importMihonBackup(rawBuffer) {
    const backup = await parseBackupBuffer(rawBuffer);

    const sourcesById = new Map((backup.backupSources || []).map((s) => [Number(s.sourceId), s.name]));
    const categoriesById = new Map((backup.backupCategories || []).map((c) => [Number(c.id), c.name]));

    const store = await readStore();
    const installedSources = store.installedSources || {};

    let imported = 0;
    let unresolvedSource = 0;
    let categoriesCreated = 0;
    const errors = [];

    for (const bm of (backup.backupManga || [])) {
      try {
        if (bm.favorite === false) continue; // backups can carry non-library history entries too
        if (!bm.title) continue;

        const backupSourceName = sourcesById.get(Number(bm.source)) || '';
        const matchedSourceId = resolveSourceIdForManga(backupSourceName, installedSources);
        const workingId = matchedSourceId ? extractWorkingMangaId(matchedSourceId, bm.url) : null;

        const sourceId = workingId ? matchedSourceId : 'unknown';
        if (!workingId) unresolvedSource++;

        // No live id to key on — derive a stable one from the backup's own
        // (source, url) pair so re-importing the same backup twice updates
        // the same entry instead of duplicating it.
        const mangaId = workingId || `mihon-${sha1Short(`${bm.source}:${bm.url}`)}`;

        const genres = Array.isArray(bm.genre) ? bm.genre.filter(Boolean) : [];
        const chapters = Array.isArray(bm.chapters) ? bm.chapters : [];

        const mangaEntry = {
          ...safeManga({
            id: mangaId,
            title: bm.title,
            cover: bm.thumbnailUrl || '',
            author: [bm.author, bm.artist].filter(Boolean).join(', '),
            description: bm.notes || '',
            status: PUBLICATION_STATUS[Number(bm.status)] || '',
            url: bm.url || '',
            genres,
          }),
          id: mangaId,
          sourceId,
          addedAt: bm.dateAdded ? new Date(Number(bm.dateAdded)).toISOString() : new Date().toISOString(),
        };

        const existingIdx = store.favorites.findIndex((f) => f.id === mangaId && f.sourceId === sourceId);
        if (existingIdx >= 0) store.favorites[existingIdx] = { ...store.favorites[existingIdx], ...mangaEntry };
        else store.favorites.push(mangaEntry);

        const readingStatus = computeReadingStatus(chapters);
        if (readingStatus) {
          const key = `${mangaId}:${sourceId}`.replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);
          store.readingStatus[key] = { status: readingStatus, updatedAt: new Date().toISOString(), manga: safeManga(mangaEntry) };
        }

        // Categories -> ScrollScape custom lists (created on first use).
        for (const catId of (bm.categories || [])) {
          const catName = categoriesById.get(Number(catId));
          if (!catName) continue;
          let list = store.customLists.find((l) => l.name.toLowerCase() === catName.toLowerCase());
          if (!list) {
            list = { id: `list_${Date.now()}_${store.customLists.length}`, name: catName.slice(0, 100), description: '', mangaItems: [], isDynamic: false, filterQuery: null, createdAt: new Date().toISOString() };
            store.customLists.push(list);
            categoriesCreated++;
          }
          if (!list.mangaItems.some((m) => m.id === mangaId)) {
            list.mangaItems.push({ ...safeManga(mangaEntry), sourceId, addedAt: new Date().toISOString() });
          }
        }

        imported++;
      } catch (err) {
        errors.push({ title: bm?.title || 'unknown', error: err.message });
      }
    }

    await writeStore(store);
    return { ok: true, imported, unresolvedSource, categoriesCreated, totalInBackup: (backup.backupManga || []).length, errors };
  }

  return { importMihonBackup, parseBackupBuffer };
}

module.exports = { createMihonImportService };
