'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const { guessImageExt } = require('../common/cbz-builder');

const SAVE_JOB_TTL = 15 * 60 * 1000;

// Manages chapters downloaded from OTHER sources and stored locally for
// offline reading: saving individual/bulk chapters (with an SSE-friendly
// job-progress queue), listing/deleting what's been saved, and serving as
// the "synthetic" fallback local.js/opds.js reach for when a manga's real
// source is unreachable but offline copies of its chapters exist.
function createOfflineDownloadService({
  LOCAL_DIR,
  safeId,
  loadSourceFromFile,
  sha1Short,
  fetchImageBuffer,
  resolvePageUrl,
  safeName,
  crypto,
}) {
  const saveJobs = new Map();

  async function findLocalMangaDir(sourceId, mangaId) {
    const sid = safeId(sourceId);
    if (!sid || !mangaId) return null;

    // Check old hash format
    const oldId = `local-dl-${sha1Short(sid + ':' + mangaId)}`;
    if (fs.existsSync(path.join(LOCAL_DIR, oldId, 'meta.json'))) {
      return path.join(LOCAL_DIR, oldId);
    }

    if (!fs.existsSync(LOCAL_DIR)) return null;

    // Search existing folders
    const dirs = await fsp.readdir(LOCAL_DIR);
    for (const d of dirs) {
      const p = path.join(LOCAL_DIR, d);
      const metaPath = path.join(p, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
          if (meta.originalSourceId === sid && meta.originalMangaId === String(mangaId)) {
            return p;
          }
        } catch(e) {}
      }
    }
    return null;
  }

  async function saveChapter({ sourceId, chapterId, chapterName, mangaTitle, mangaId, cover } = {}) {
    const sid = safeId(sourceId);
    if (!sid || !chapterId || !mangaId) {
      const err = new Error('Missing required fields');
      err.statusCode = 400;
      throw err;
    }

    const source = loadSourceFromFile(sid);
    const result = await source.pages(chapterId);
    const pages = result.pages || [];

    let mangaDir = await findLocalMangaDir(sid, mangaId);
    let localId;
    let isNewManga = false;
    if (mangaDir) {
      localId = path.basename(mangaDir);
    } else {
      localId = safeName(mangaTitle) || `manga-${Date.now()}`;
      mangaDir = path.join(LOCAL_DIR, localId);
      let counter = 1;
      while (fs.existsSync(mangaDir)) {
        localId = `${safeName(mangaTitle)} (${counter})`;
        mangaDir = path.join(LOCAL_DIR, localId);
        counter++;
      }
      isNewManga = true;
      await fsp.mkdir(mangaDir, { recursive: true });
    }

    const metaPath = path.join(mangaDir, 'meta.json');
    let meta;
    if (!isNewManga && fs.existsSync(metaPath)) {
      meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    } else {
      meta = {
        id: localId,
        title: mangaTitle,
        originalSourceId: sid,
        originalMangaId: String(mangaId),
        cover: '',
        type: 'cbz',
        sourceId: 'local',
        description: `Downloaded from ${sid}`,
        genres: [],
        author: '',
        chapters: [],
      };
      await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    }

    const chapDir = path.join(mangaDir, 'images', safeName(chapterName));
    await fsp.mkdir(chapDir, { recursive: true });

    const imgPaths = [];
    for (let i = 0; i < pages.length; i++) {
      const resolved = resolvePageUrl(pages[i]);
      if (!resolved) continue;
      const { url: imgUrl, referer } = resolved;
      try {
        const buf = await fetchImageBuffer(imgUrl, referer);
        const ext = guessImageExt(imgUrl);
        const fname = `${String(i + 1).padStart(4, '0')}.${ext}`;
        await fsp.writeFile(path.join(chapDir, fname), buf);
        imgPaths.push(`/local-media/${localId}/images/${safeName(chapterName)}/${fname}`);
      } catch (e) {
        console.warn(`[save-offline] skipped page ${i + 1}: ${e.message}`);
      }
    }

    if (imgPaths.length > 0) {
      meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      const alreadySaved = meta.chapters.some((c) => c.sourceChapterId === chapterId);
      if (!alreadySaved) {
        meta.chapters.push({
          id: `${localId}:${meta.chapters.length}`,
          sourceChapterId: chapterId,
          name: chapterName,
          date: new Date().toISOString(),
          isPDF: false,
          pdfUrl: null,
          pages: imgPaths,
        });
        if (!meta.cover) meta.cover = imgPaths[0] || '';
        await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      }
    } else {
      try { await fsp.rm(chapDir, { recursive: true, force: true }); } catch (e) {}
    }

    return { success: true, localId };
  }

  async function processSaveJob(jobId, chapters, sourceId, mangaTitle, mangaId, cover) {
    const job = saveJobs.get(jobId);
    if (!job) return;
    job.status = 'running';
    let localId = null;

    const notify = (ev, data) => {
      const line = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const w of job.listeners) {
        try { w(line); } catch (_) {}
      }
    };

    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      job.done = ci;
      notify('progress', { done: ci, total: chapters.length, chapter: ch.name });

      try {
        const result = await saveChapter({ sourceId, chapterId: ch.id, chapterName: ch.name, mangaTitle, mangaId, cover });
        localId = result.localId;
      } catch (e) {
        console.warn(`[save-bulk] failed ${ch.name}: ${e.message}`);
      }
    }

    job.done = chapters.length;
    job.localId = localId;
    job.status = 'done';
    notify('progress', { done: chapters.length, total: chapters.length, chapter: '' });
    notify('done', { localId });
    setTimeout(() => saveJobs.delete(jobId), SAVE_JOB_TTL);
  }

  async function startBulkSave({ sourceId, chapters, mangaTitle, mangaId, cover } = {}) {
    const sid = safeId(sourceId);
    if (!sid || !Array.isArray(chapters) || chapters.length === 0 || !mangaId) {
      const err = new Error('Missing required fields');
      err.statusCode = 400;
      throw err;
    }

    const jobId = crypto.randomBytes(8).toString('hex');
    saveJobs.set(jobId, { status: 'pending', done: 0, total: chapters.length, listeners: [], localId: null });
    processSaveJob(jobId, chapters, sid, mangaTitle, mangaId, cover);
    return { jobId };
  }

  async function getOfflineChapterIds({ sourceId, mangaId } = {}) {
    const mangaDir = await findLocalMangaDir(sourceId, mangaId);
    if (!mangaDir) return [];
    try {
      const metaPath = path.join(mangaDir, 'meta.json');
      if (!fs.existsSync(metaPath)) return [];
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      return meta.chapters.map(c => c.sourceChapterId).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function deleteOfflineChapters({ sourceId, mangaId, chapterIds } = {}) {
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) return { success: false };
    const mangaDir = await findLocalMangaDir(sourceId, mangaId);
    if (!mangaDir) return { success: false };
    const metaPath = path.join(mangaDir, 'meta.json');
    if (!fs.existsSync(metaPath)) return { success: true };

    const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    let modified = false;

    for (const chId of chapterIds) {
      const idx = meta.chapters.findIndex(c => c.sourceChapterId === chId);
      if (idx >= 0) {
        const chapter = meta.chapters[idx];
        const chapDir = path.join(mangaDir, 'images', safeName(chapter.name));
        if (fs.existsSync(chapDir)) {
          await fsp.rm(chapDir, { recursive: true, force: true });
        }
        meta.chapters.splice(idx, 1);
        modified = true;
      }
    }

    if (modified) {
      if (meta.chapters.length === 0) {
        await fsp.rm(mangaDir, { recursive: true, force: true });
      } else {
        await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      }
    }
    return { success: true };
  }

  async function getSyntheticMangaDetails(sourceId, mangaId) {
    const mangaDir = await findLocalMangaDir(sourceId, mangaId);
    if (!mangaDir) return null;
    try {
      const metaPath = path.join(mangaDir, 'meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      return {
        id: mangaId,
        title: meta.title,
        cover: meta.cover,
        description: `(Offline) ${meta.description}`,
        status: 'unknown',
        genres: meta.genres || [],
        author: meta.author || '',
      };
    } catch {
      return null;
    }
  }

  async function getSyntheticChapters(sourceId, mangaId) {
    const mangaDir = await findLocalMangaDir(sourceId, mangaId);
    if (!mangaDir) return null;
    try {
      const metaPath = path.join(mangaDir, 'meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      return {
        chapters: meta.chapters.map((ch, i) => ({
          id: ch.sourceChapterId,
          name: ch.name,
          chapter: String(i + 1),
          date: ch.date || new Date().toISOString()
        }))
      };
    } catch {
      return null;
    }
  }

  async function getOfflinePages(sourceId, mangaId, chapterId) {
    if (!chapterId) return null;
    const mangaDir = await findLocalMangaDir(sourceId, mangaId);
    if (!mangaDir) return null;
    try {
      const metaPath = path.join(mangaDir, 'meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      const ch = meta.chapters.find(c => c.sourceChapterId === String(chapterId));
      if (!ch) return null;
      return { pages: ch.pages.map(img => ({ img })) };
    } catch {
      return null;
    }
  }

  function getBulkJob(jobId) {
    return saveJobs.get(jobId) || null;
  }

  function addBulkListener(jobId, write) {
    const job = saveJobs.get(jobId);
    if (!job) return;
    job.listeners.push(write);
  }

  function removeBulkListener(jobId, write) {
    const job = saveJobs.get(jobId);
    if (!job) return;
    job.listeners = job.listeners.filter((listener) => listener !== write);
  }

  return {
    saveChapter,
    startBulkSave,
    getBulkJob,
    addBulkListener,
    removeBulkListener,
    getOfflineChapterIds,
    deleteOfflineChapters,
    getSyntheticMangaDetails,
    getSyntheticChapters,
    getOfflinePages,
  };
}

module.exports = { createOfflineDownloadService };
