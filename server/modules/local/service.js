'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const IMG_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
const SAVE_JOB_TTL = 15 * 60 * 1000;
const normaliseExt = (e) => e.replace(/^jpeg$/i, 'jpg');

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
}) {
  const saveJobs = new Map();

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

  async function importArchive(file, body = {}) {
    const tmpPath = file?.path;
    try {
      if (!file) {
        const err = new Error('No file uploaded');
        err.statusCode = 400;
        throw err;
      }

      const origName = file.originalname || 'manga';
      const ext = path.extname(origName).toLowerCase();
      const titleBase = (body.title || path.basename(origName, path.extname(origName)))
        .replace(/[_-]+/g, ' ').trim() || 'Local Manga';

      if (!['.cbz', '.cbr', '.pdf'].includes(ext)) {
        const err = new Error('Unsupported format. Use CBZ, CBR or PDF.');
        err.statusCode = 400;
        throw err;
      }

      const mangaId = `local-${sha1Short(titleBase + Date.now())}`;
      const mangaDir = path.join(LOCAL_DIR, mangaId);
      const imagesDir = path.join(mangaDir, 'images');
      await fsp.mkdir(imagesDir, { recursive: true });

      let pages = [];
      let chapterIsPDF = false;
      let pdfUrl = '';

      if (ext === '.pdf') {
        const destPdf = path.join(mangaDir, 'original.pdf');
        await fsp.copyFile(tmpPath, destPdf);
        chapterIsPDF = true;
        pdfUrl = `/local-media/${mangaId}/original.pdf`;
      } else {
        let extracted = false;

        try {
          const zip = new AdmZip(tmpPath);
          const entries = zip.getEntries()
            .filter((e) => !e.isDirectory && IMG_EXT_RE.test(e.entryName))
            .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

          if (entries.length > 0) {
            for (const [i, entry] of entries.entries()) {
              const rawExt = path.extname(entry.name).toLowerCase();
              const imgExt = IMG_EXT_RE.test(rawExt) ? normaliseExt(rawExt.slice(1)) : 'jpg';
              const fname = `${String(i + 1).padStart(4, '0')}.${imgExt}`;
              await fsp.writeFile(path.join(imagesDir, fname), entry.getData());
              pages.push(`/local-media/${mangaId}/images/${fname}`);
            }
            extracted = true;
          }
        } catch (_) {
          // Fall through to RAR handler.
        }

        if (!extracted) {
          const { createExtractorFromData } = await import('node-unrar-js');
          const buffer = await fsp.readFile(tmpPath);
          const extractor = await createExtractorFromData({ data: buffer.buffer });
          const list = extractor.getFileList();
          const imageHeaders = [...list.fileHeaders]
            .filter((h) => IMG_EXT_RE.test(h.fileHeader.name))
            .sort((a, b) => a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true, sensitivity: 'base' }));

          if (imageHeaders.length === 0) {
            const err = new Error('No images found in CBR/RAR file.');
            err.statusCode = 400;
            throw err;
          }

          const extractedFiles = [
            ...extractor.extract({ files: imageHeaders.map((h) => h.fileHeader.name) }).files,
          ];
          for (const [i, fileEntry] of extractedFiles.entries()) {
            const rawExt = path.extname(fileEntry.fileHeader.name).toLowerCase();
            const imgExt = IMG_EXT_RE.test(rawExt) ? normaliseExt(rawExt.slice(1)) : 'jpg';
            const fname = `${String(i + 1).padStart(4, '0')}.${imgExt}`;
            await fsp.writeFile(path.join(imagesDir, fname), Buffer.from(fileEntry.extraction));
            pages.push(`/local-media/${mangaId}/images/${fname}`);
          }
        }

        if (pages.length === 0) {
          const err = new Error('No images found in the file.');
          err.statusCode = 400;
          throw err;
        }
      }

      const cover = pages[0] || (chapterIsPDF ? pdfUrl : '');
      const meta = {
        id: mangaId,
        title: titleBase,
        cover,
        type: ext.slice(1),
        sourceId: 'local',
        description: `Imported on ${new Date().toLocaleDateString()}`,
        genres: [],
        author: '',
        chapters: [{
          id: `${mangaId}:0`,
          name: titleBase,
          date: new Date().toISOString(),
          isPDF: chapterIsPDF,
          pdfUrl: pdfUrl || null,
          pages: chapterIsPDF ? [] : pages,
        }],
      };
      await fsp.writeFile(path.join(mangaDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      return {
        success: true,
        manga: {
          id: meta.id,
          title: meta.title,
          cover: meta.cover,
          type: meta.type,
          sourceId: 'local',
        },
      };
    } finally {
      if (tmpPath) fsp.unlink(tmpPath).catch(() => {});
    }
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

    const localId = `local-dl-${sha1Short(sid + ':' + mangaId)}`;
    const mangaDir = path.join(LOCAL_DIR, localId);
    const chapDir = path.join(mangaDir, 'images', safeName(chapterName));
    await fsp.mkdir(chapDir, { recursive: true });

    const imgPaths = [];
    for (let i = 0; i < pages.length; i++) {
      const resolved = resolvePageUrl(pages[i]);
      if (!resolved) continue;
      const { url: imgUrl, referer } = resolved;
      try {
        const buf = await fetchImageBuffer(imgUrl, referer);
        const ext = ((imgUrl.match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1]).replace('jpeg', 'jpg');
        const fname = `${String(i + 1).padStart(4, '0')}.${ext}`;
        await fsp.writeFile(path.join(chapDir, fname), buf);
        imgPaths.push(`/local-media/${localId}/images/${safeName(chapterName)}/${fname}`);
      } catch (e) {
        console.warn(`[save-offline] skipped page ${i + 1}: ${e.message}`);
      }
    }

    const metaPath = path.join(mangaDir, 'meta.json');
    let meta;
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    } else {
      let localCover = imgPaths[0] || '';
      if (cover && typeof cover === 'string' && cover.trim()) {
        try {
          const covBuf = await fetchImageBuffer(cover);
          const covPath = path.join(mangaDir, 'cover.jpg');
          await fsp.writeFile(covPath, covBuf);
          localCover = `/local-media/${localId}/cover.jpg`;
        } catch (_) {
          // Use first page as cover.
        }
      }
      meta = {
        id: localId,
        title: mangaTitle,
        cover: localCover,
        type: 'cbz',
        sourceId: 'local',
        description: `Downloaded from ${sid}`,
        genres: [],
        author: '',
        chapters: [],
      };
    }

    const alreadySaved = meta.chapters.some((c) => c.sourceChapterId === chapterId);
    if (!alreadySaved && imgPaths.length > 0) {
      const chIndex = meta.chapters.length;
      meta.chapters.push({
        id: `${localId}:${chIndex}`,
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
    search,
    getMangaDetails,
    getChapters,
    getPages,
    listLocalManga,
    getThumbnailTarget,
    updateLocalCover,
    deleteLocalManga,
    importArchive,
    saveChapter,
    startBulkSave,
    getBulkJob,
    addBulkListener,
    removeBulkListener,
  };
}

module.exports = { createLocalService };