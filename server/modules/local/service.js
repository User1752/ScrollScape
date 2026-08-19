'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const { IMG_EXT_RE, createArchiveImporter } = require('./archive-import');
const { createOfflineDownloadService } = require('./offline-downloads');

function createLocalService({
  LOCAL_DIR,
  safeId,
  loadSourceFromFile,
  sha1Short,
  fetchImageBuffer,
  resolvePageUrl,
  safeName,
  crypto,
  AdmZip,
  readStore,
  writeStore,
}) {
  const { importArchive } = createArchiveImporter({ LOCAL_DIR, sha1Short, AdmZip });
  const offlineDownloads = createOfflineDownloadService({
    LOCAL_DIR,
    safeId,
    loadSourceFromFile,
    sha1Short,
    fetchImageBuffer,
    resolvePageUrl,
    safeName,
    crypto,
  });

  async function readMeta(rawMangaId) {
    const sid = safeId(rawMangaId);
    if (!sid) {
      const err = new Error('Invalid ID');
      err.statusCode = 400;
      throw err;
    }

    const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      const err = new Error('Not found');
      err.statusCode = 404;
      throw err;
    }

    return JSON.parse(await fsp.readFile(metaPath, 'utf8'));
  }

  function search() {
    return { results: [], hasNextPage: false };
  }

  async function getMangaDetails({ mangaId } = {}) {
    const meta = await readMeta(mangaId);
    return {
      id: meta.id,
      title: meta.title,
      cover: meta.cover,
      description: meta.description || 'Local manga',
      status: 'completed',
      genres: meta.genres || [],
      author: meta.author || '',
    };
  }

  async function getChapters({ mangaId } = {}) {
    const meta = await readMeta(mangaId);
    return {
      chapters: meta.chapters.map((ch, i) => ({
        id: ch.id,
        name: ch.name,
        chapter: String(i + 1),
        date: ch.date || new Date().toISOString(),
      })),
    };
  }

  async function getPages({ chapterId } = {}) {
    const lastColon = String(chapterId).lastIndexOf(':');
    if (lastColon < 0) {
      const err = new Error('Invalid chapterId');
      err.statusCode = 400;
      throw err;
    }

    const mangaId = chapterId.slice(0, lastColon);
    const chIndex = parseInt(chapterId.slice(lastColon + 1), 10);
    const meta = await readMeta(mangaId);
    const chapter = meta.chapters[chIndex];
    if (!chapter) {
      const err = new Error('Chapter not found');
      err.statusCode = 404;
      throw err;
    }

    if (chapter.isPDF) {
      return { isPDF: true, pdfUrl: chapter.pdfUrl, pages: [] };
    }

    if (chapter.isEpub) {
      return { isEpub: true, epubUrl: chapter.epubUrl, pages: [] };
    }

    return { pages: chapter.pages.map(img => ({ img })) };
  }

  async function listLocalManga() {
    if (!fs.existsSync(LOCAL_DIR)) return { localManga: [] };

    const dirs = await fsp.readdir(LOCAL_DIR);
    const localManga = [];
    for (const dir of dirs) {
      const metaPath = path.join(LOCAL_DIR, dir, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      try {
        const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
        localManga.push({ id: meta.id, title: meta.title, cover: meta.cover, type: meta.type, sourceId: 'local' });
      } catch (_) {
        // Skip corrupt entries.
      }
    }

    return { localManga };
  }

  async function getThumbnailTarget(rawMangaId) {
    const sid = safeId(rawMangaId);
    if (!sid) {
      const err = new Error('Invalid ID');
      err.statusCode = 400;
      throw err;
    }

    const mangaDir = path.join(LOCAL_DIR, sid);
    const coverJpg = path.join(mangaDir, 'cover.jpg');
    if (fs.existsSync(coverJpg)) return `/local-media/${sid}/cover.jpg`;

    const imagesDir = path.join(mangaDir, 'images');
    if (!fs.existsSync(imagesDir)) return null;

    const files = (await fsp.readdir(imagesDir))
      .filter(file => IMG_EXT_RE.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return files.length ? `/local-media/${sid}/images/${files[0]}` : null;
  }

  async function updateLocalCover(rawMangaId, coverBuffer) {
    const sid = safeId(rawMangaId);
    if (!sid) {
      const err = new Error('Invalid ID');
      err.statusCode = 400;
      throw err;
    }

    const mangaDir = path.join(LOCAL_DIR, sid);
    const metaPath = path.join(mangaDir, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      const err = new Error('Not found');
      err.statusCode = 404;
      throw err;
    }

    const coverPath = path.join(mangaDir, 'cover.jpg');
    await fsp.writeFile(coverPath, coverBuffer);
    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    meta.cover = `/local-media/${sid}/cover.jpg`;
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    // Local manga's cover of record lives in meta.json (above), but a
    // favorited/history/continue-reading entry for it is a separate
    // snapshot taken at add/read time — those need patching too, or the
    // old cover keeps showing up everywhere except the details page.
    if (typeof readStore === 'function' && typeof writeStore === 'function') {
      const store = await readStore();
      const matches = (m) => String(m?.id) === String(sid) && String(m?.sourceId || '') === 'local';

      let changed = false;
      if (Array.isArray(store.favorites)) {
        store.favorites = store.favorites.map((m) => {
          if (!matches(m)) return m;
          changed = true;
          return { ...m, cover: meta.cover };
        });
      }
      if (Array.isArray(store.history)) {
        store.history = store.history.map((m) => {
          if (!matches(m)) return m;
          changed = true;
          return { ...m, cover: meta.cover };
        });
      }
      for (const [key, value] of Object.entries(store.readingStatus || {})) {
        const sep = key.indexOf(':');
        if (sep < 0) continue;
        if (key.slice(0, sep) !== String(sid) || key.slice(sep + 1) !== 'local') continue;
        store.readingStatus[key] = { ...value, manga: { ...value?.manga, cover: meta.cover } };
        changed = true;
      }

      if (changed) await writeStore(store);
    }

    return { success: true, cover: meta.cover };
  }

  async function deleteLocalManga(rawMangaId) {
    const sid = safeId(rawMangaId);
    if (!sid) {
      const err = new Error('Invalid ID');
      err.statusCode = 400;
      throw err;
    }

    const mangaDir = path.join(LOCAL_DIR, sid);
    if (fs.existsSync(mangaDir)) {
      await fsp.rm(mangaDir, { recursive: true, force: true });
    }
    return { success: true };
  }

  return {
    search,
    getMangaDetails,
    getChapters,
    getPages,
    listLocalManga,
    getThumbnailTarget,
    updateLocalCover,
    deleteLocalManga,
    importArchive,
    saveChapter: offlineDownloads.saveChapter,
    startBulkSave: offlineDownloads.startBulkSave,
    getBulkJob: offlineDownloads.getBulkJob,
    addBulkListener: offlineDownloads.addBulkListener,
    removeBulkListener: offlineDownloads.removeBulkListener,
    getOfflineChapterIds: offlineDownloads.getOfflineChapterIds,
    deleteOfflineChapters: offlineDownloads.deleteOfflineChapters,
    getSyntheticMangaDetails: offlineDownloads.getSyntheticMangaDetails,
    getSyntheticChapters: offlineDownloads.getSyntheticChapters,
    getOfflinePages: offlineDownloads.getOfflinePages,
  };
}

module.exports = { createLocalService };
