/**
 * routes/local.js — Local manga (CBZ / CBR / PDF) import and virtual-source endpoints
 *
 * This module handles:
 *  1. Virtual "local" source endpoints used by the reader:
 *       POST /api/source/local/search
 *       POST /api/source/local/mangaDetails
 *       POST /api/source/local/chapters
 *       POST /api/source/local/pages
 *  2. Management endpoints:
 *       GET    /api/local/list
 *       GET    /api/local/:mangaId/thumb
 *       POST   /api/local/:mangaId/cover
 *       DELETE /api/local/:mangaId
 *       POST   /api/local/import          (multipart file upload)
 *
 * Security:
 *  • All manga IDs coming from URLs or request bodies are validated with
 *    safeId() before any filesystem operation.
 *  • Archive extraction uses an extension allowlist (jpg, png, gif, webp)
 *    so a crafted ZIP/CBR cannot write executable files (.js, .php…) to
 *    the images directory.
 *  • Uploaded files are written to a temp directory by multer and are
 *    always cleaned up in the `finally` block even if processing fails.
 *  • Cover uploads are restricted to image/* MIME types (5 MB limit via
 *    express.raw).
 *
 * Platform note (Android/Linux):
 *  The /local-media static middleware and all file I/O use path.join() with
 *  an injected LOCAL_DIR so the same code works correctly on Windows, Linux,
 *  and Android (via Termux / Node.js for Mobile).
 */

'use strict';

const crypto = require('crypto');
const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');
const express  = require('express');
const AdmZip   = require('adm-zip');
const { safeId, sha1Short, isSafeUrl, fetchImageBuffer, resolvePageUrl, safeName } = require('../helpers');
const { loadSourceFromFile } = require('../sourceLoader');

// Injected via configure()
let LOCAL_DIR = '';
let upload    = null; // multer instance (configured with TMP_DIR)

/**
 * @param {{ localDir: string, upload: import('multer').Multer }} opts
 */
function configure(opts) {
  LOCAL_DIR = opts.localDir;
  upload    = opts.upload;
}

// Allowed image extensions inside archives.
const IMG_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;

/** Map "jpeg" → "jpg" for consistency. */
const normaliseExt = (e) => e.replace(/^jpeg$/i, 'jpg');

/**
 * Saves a single chapter from any source into the local library.
 * Finds or creates a local manga folder keyed by sourceId+mangaId so all
 * chapters from the same manga land in the same folder.
 *
 * @param {{ sourceId, chapterId, chapterName, mangaTitle, mangaId, cover }} opts
 * @returns {Promise<string>} localMangaId
 */
async function saveChapterToLocal({ sourceId, chapterId, chapterName, mangaTitle, mangaId, cover }) {
  const source = loadSourceFromFile(sourceId);
  const result = await source.pages(chapterId);
  const pages  = result.pages || [];

  // Stable folder name so all chapters from the same manga share one entry
  const localId  = `local-dl-${sha1Short(sourceId + ':' + mangaId)}`;
  const mangaDir = path.join(LOCAL_DIR, localId);
  const chapDir  = path.join(mangaDir, 'images', safeName(chapterName));
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

  // Create or update meta.json
  const metaPath = path.join(mangaDir, 'meta.json');
  let meta;
  if (fs.existsSync(metaPath)) {
    meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
  } else {
    // Determine cover — use provided cover URL or first page
    let localCover = imgPaths[0] || '';
    // If cover URL is an external URL, try to fetch and save it
    if (cover && isSafeUrl(cover)) {
      try {
        const covBuf = await fetchImageBuffer(cover);
        const covPath = path.join(mangaDir, 'cover.jpg');
        await fsp.writeFile(covPath, covBuf);
        localCover = `/local-media/${localId}/cover.jpg`;
      } catch (_) { /* use first page as cover */ }
    }
    meta = {
      id:          localId,
      title:       mangaTitle,
      cover:       localCover,
      type:        'cbz',
      sourceId:    'local',
      description: `Downloaded from ${sourceId}`,
      genres:      [],
      author:      '',
      chapters:    [],
    };
  }

  // Skip if this chapter was already saved
  const alreadySaved = meta.chapters.some(c => c.sourceChapterId === chapterId);
  if (!alreadySaved && imgPaths.length > 0) {
    const chIndex = meta.chapters.length;
    meta.chapters.push({
      id:              `${localId}:${chIndex}`,
      sourceChapterId: chapterId,
      name:            chapterName,
      date:            new Date().toISOString(),
      isPDF:           false,
      pdfUrl:          null,
      pages:           imgPaths,
    });
    // Update cover from first available chapter
    if (!meta.cover) meta.cover = imgPaths[0] || '';
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  return localId;
}

/** In-memory save-bulk job store */
const saveJobs = new Map();
const SAVE_JOB_TTL = 15 * 60 * 1000;

async function processSaveJob(jobId, chapters, sourceId, mangaTitle, mangaId, cover) {
  const job = saveJobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  let localId = null;

  // Defined once here; reused for progress ticks and for the final done event.
  const notify = (ev, data) => {
    const line = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const w of job.listeners) { try { w(line); } catch (_) {} }
  };

  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    job.done = ci;
    notify('progress', { done: ci, total: chapters.length, chapter: ch.name });

    try {
      localId = await saveChapterToLocal({ sourceId, chapterId: ch.id, chapterName: ch.name, mangaTitle, mangaId, cover });
    } catch (e) {
      console.warn(`[save-bulk] failed ${ch.name}: ${e.message}`);
    }
  }

  job.done      = chapters.length;
  job.localId   = localId;
  job.status    = 'done';
  notify('progress', { done: chapters.length, total: chapters.length, chapter: '' });
  notify('done', { localId });
  setTimeout(() => saveJobs.delete(jobId), SAVE_JOB_TTL);
}

/**
 * @param {import('express').Router} router  The app-level router
 */
function registerLocalRoutes(router) {
  // Serve extracted images and PDFs from the LOCAL_DIR as static assets.
  // NOTE: this must be registered before the API routes so that the
  // static handler does not intercept /api/local/* paths.
  router.use('/local-media', express.static(LOCAL_DIR));

  // ── Virtual source: search ─────────────────────────────────────────────────
  // Local manga has no searchable index — return empty results.
  router.post('/api/source/local/search', (_req, res) => {
    res.json({ results: [], hasNextPage: false });
  });

  // ── Virtual source: mangaDetails ──────────────────────────────────────────
  router.post('/api/source/local/mangaDetails', async (req, res) => {
    try {
      const { mangaId } = req.body || {};
      const sid      = safeId(mangaId);
      if (!sid) return res.status(400).json({ error: 'Invalid ID' });
      const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
      if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      res.json({
        id:          meta.id,
        title:       meta.title,
        cover:       meta.cover,
        description: meta.description || 'Local manga',
        status:      'completed',
        genres:      meta.genres || [],
        author:      meta.author || '',
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Virtual source: chapters ───────────────────────────────────────────────
  router.post('/api/source/local/chapters', async (req, res) => {
    try {
      const { mangaId } = req.body || {};
      const sid      = safeId(mangaId);
      if (!sid) return res.status(400).json({ error: 'Invalid ID' });
      const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
      if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
      const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      res.json({
        chapters: meta.chapters.map((ch, i) => ({
          id:      ch.id,
          name:    ch.name,
          chapter: String(i + 1),
          date:    ch.date || new Date().toISOString(),
        })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Virtual source: pages ──────────────────────────────────────────────────
  router.post('/api/source/local/pages', async (req, res) => {
    try {
      const { chapterId } = req.body || {};
      const lastColon    = String(chapterId).lastIndexOf(':');
      if (lastColon < 0) return res.status(400).json({ error: 'Invalid chapterId' });
      const mangaId  = chapterId.slice(0, lastColon);
      const chIndex  = parseInt(chapterId.slice(lastColon + 1), 10);
      const sid      = safeId(mangaId);
      if (!sid) return res.status(400).json({ error: 'Invalid ID' });
      const metaPath = path.join(LOCAL_DIR, sid, 'meta.json');
      if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
      const meta    = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      const chapter = meta.chapters[chIndex];
      if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
      if (chapter.isPDF) {
        res.json({ isPDF: true, pdfUrl: chapter.pdfUrl, pages: [] });
      } else {
        res.json({ pages: chapter.pages.map(img => ({ img })) });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/local/list ────────────────────────────────────────────────────
  router.get('/api/local/list', async (_req, res) => {
    try {
      if (!fs.existsSync(LOCAL_DIR)) return res.json({ localManga: [] });
      const dirs       = await fsp.readdir(LOCAL_DIR);
      const localManga = [];
      for (const dir of dirs) {
        const metaPath = path.join(LOCAL_DIR, dir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
            localManga.push({ id: meta.id, title: meta.title, cover: meta.cover, type: meta.type, sourceId: 'local' });
          } catch (_) { /* skip corrupt entries */ }
        }
      }
      res.json({ localManga });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/local/:mangaId/thumb ──────────────────────────────────────────
  router.get('/api/local/:mangaId/thumb', async (req, res) => {
    try {
      const sid      = safeId(req.params.mangaId);
      if (!sid) return res.status(400).end();
      const mangaDir = path.join(LOCAL_DIR, sid);

      // 1. Prefer an explicit cover.jpg if it exists.
      const coverJpg = path.join(mangaDir, 'cover.jpg');
      if (fs.existsSync(coverJpg)) return res.redirect(`/local-media/${sid}/cover.jpg`);

      // 2. Fall back to the first image in the images/ directory.
      const imagesDir = path.join(mangaDir, 'images');
      if (fs.existsSync(imagesDir)) {
        const files = (await fsp.readdir(imagesDir))
          .filter(f => IMG_EXT_RE.test(f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (files.length) return res.redirect(`/local-media/${sid}/images/${files[0]}`);
      }
      res.status(404).end();
    } catch (e) {
      res.status(500).end();
    }
  });

  // ── POST /api/local/:mangaId/cover ─────────────────────────────────────────
  router.post(
    '/api/local/:mangaId/cover',
    express.raw({ type: 'image/*', limit: '5mb' }),
    async (req, res) => {
      try {
        const sid      = safeId(req.params.mangaId);
        if (!sid) return res.status(400).json({ error: 'Invalid ID' });
        const mangaDir = path.join(LOCAL_DIR, sid);
        const metaPath = path.join(mangaDir, 'meta.json');
        if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Not found' });
        const coverPath = path.join(mangaDir, 'cover.jpg');
        await fsp.writeFile(coverPath, req.body);
        const meta   = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
        meta.cover   = `/local-media/${sid}/cover.jpg`;
        await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
        res.json({ success: true, cover: meta.cover });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── DELETE /api/local/:mangaId ─────────────────────────────────────────────
  router.delete('/api/local/:mangaId', async (req, res) => {
    try {
      const sid      = safeId(req.params.mangaId);
      if (!sid) return res.status(400).json({ error: 'Invalid ID' });
      const mangaDir = path.join(LOCAL_DIR, sid);
      if (fs.existsSync(mangaDir)) await fsp.rm(mangaDir, { recursive: true, force: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/local/import ────────────────────────────────────────────────
  // Accepts a single CBZ / CBR / PDF file via multipart/form-data.
  router.post('/api/local/import', upload.single('file'), async (req, res) => {
    const tmpPath = req.file?.path;
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const origName  = req.file.originalname || 'manga';
      const ext       = path.extname(origName).toLowerCase();
      const titleBase = (req.body.title || path.basename(origName, path.extname(origName)))
        .replace(/[_-]+/g, ' ').trim() || 'Local Manga';

      if (!['.cbz', '.cbr', '.pdf'].includes(ext))
        return res.status(400).json({ error: 'Unsupported format. Use CBZ, CBR or PDF.' });

      const mangaId   = `local-${sha1Short(titleBase + Date.now())}`;
      const mangaDir  = path.join(LOCAL_DIR, mangaId);
      const imagesDir = path.join(mangaDir, 'images');
      await fsp.mkdir(imagesDir, { recursive: true });

      let pages = [], chapterIsPDF = false, pdfUrl = '';

      if (ext === '.pdf') {
        // PDF: copy to manga dir and reference it directly.
        const destPdf = path.join(mangaDir, 'original.pdf');
        await fsp.copyFile(tmpPath, destPdf);
        chapterIsPDF = true;
        pdfUrl       = `/local-media/${mangaId}/original.pdf`;
      } else {
        let extracted = false;

        // ── Try as ZIP (CBZ and RAR-disguised-as-CBZ) ─────────────────────
        try {
          const zip     = new AdmZip(tmpPath);
          const entries = zip.getEntries()
            .filter(e => !e.isDirectory && IMG_EXT_RE.test(e.entryName))
            .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));

          if (entries.length > 0) {
            for (const [i, entry] of entries.entries()) {
              // Extension allowlist: prevent writing executable extensions.
              const rawExt = path.extname(entry.name).toLowerCase();
              const imgExt = IMG_EXT_RE.test(rawExt) ? normaliseExt(rawExt.slice(1)) : 'jpg';
              const fname  = `${String(i + 1).padStart(4, '0')}.${imgExt}`;
              await fsp.writeFile(path.join(imagesDir, fname), entry.getData());
              pages.push(`/local-media/${mangaId}/images/${fname}`);
            }
            extracted = true;
          }
        } catch (_) { /* fall through to RAR handler */ }

        // ── Fall back to true RAR using node-unrar-js (WASM) ──────────────
        if (!extracted) {
          const { createExtractorFromData } = await import('node-unrar-js');
          const buffer    = await fsp.readFile(tmpPath);
          const extractor = await createExtractorFromData({ data: buffer.buffer });
          const list      = extractor.getFileList();
          const imageHeaders = [...list.fileHeaders]
            .filter(h => IMG_EXT_RE.test(h.fileHeader.name))
            .sort((a, b) => a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true, sensitivity: 'base' }));

          if (imageHeaders.length === 0)
            return res.status(400).json({ error: 'No images found in CBR/RAR file.' });

          const extractedFiles = [
            ...extractor.extract({ files: imageHeaders.map(h => h.fileHeader.name) }).files,
          ];
          for (const [i, file] of extractedFiles.entries()) {
            const rawExt = path.extname(file.fileHeader.name).toLowerCase();
            const imgExt = IMG_EXT_RE.test(rawExt) ? normaliseExt(rawExt.slice(1)) : 'jpg';
            const fname  = `${String(i + 1).padStart(4, '0')}.${imgExt}`;
            await fsp.writeFile(path.join(imagesDir, fname), Buffer.from(file.extraction));
            pages.push(`/local-media/${mangaId}/images/${fname}`);
          }
        }

        if (pages.length === 0)
          return res.status(400).json({ error: 'No images found in the file.' });
      }

      const cover = pages[0] || (chapterIsPDF ? pdfUrl : '');
      const meta  = {
        id:          mangaId,
        title:       titleBase,
        cover,
        type:        ext.slice(1),
        sourceId:    'local',
        description: `Imported on ${new Date().toLocaleDateString()}`,
        genres:      [],
        author:      '',
        chapters:    [{
          id:      `${mangaId}:0`,
          name:    titleBase,
          date:    new Date().toISOString(),
          isPDF:   chapterIsPDF,
          pdfUrl:  pdfUrl || null,
          pages:   chapterIsPDF ? [] : pages,
        }],
      };
      await fsp.writeFile(path.join(mangaDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      res.json({ success: true, manga: { id: meta.id, title: meta.title, cover: meta.cover, type: meta.type, sourceId: 'local' } });
    } catch (e) {
      console.error('Local import error:', e);
      res.status(500).json({ error: e.message });
    } finally {
      // Always clean up the temporary upload file.
      if (tmpPath) fsp.unlink(tmpPath).catch(() => {});
    }
  });

  // ── POST /api/local/save-chapter ───────────────────────────────────────────
  // Saves a single online chapter into the local library so it can be read offline.
  router.post('/api/local/save-chapter', async (req, res) => {
    try {
      const { sourceId, chapterId, chapterName, mangaTitle, mangaId, cover } = req.body || {};
      const sid = safeId(sourceId);
      if (!sid || !chapterId || !mangaId)
        return res.status(400).json({ error: 'Missing required fields' });

      const localId = await saveChapterToLocal({ sourceId: sid, chapterId, chapterName, mangaTitle, mangaId, cover });
      res.json({ success: true, localId });
    } catch (e) {
      console.error('[save-chapter]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/local/save-bulk/start ────────────────────────────────────────
  router.post('/api/local/save-bulk/start', async (req, res) => {
    try {
      const { sourceId, chapters, mangaTitle, mangaId, cover } = req.body || {};
      const sid = safeId(sourceId);
      if (!sid || !Array.isArray(chapters) || chapters.length === 0 || !mangaId)
        return res.status(400).json({ error: 'Missing required fields' });

      const jobId = crypto.randomBytes(8).toString('hex');
      saveJobs.set(jobId, { status: 'pending', done: 0, total: chapters.length, listeners: [], localId: null });
      processSaveJob(jobId, chapters, sid, mangaTitle, mangaId, cover);
      res.json({ jobId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/local/save-bulk/progress/:jobId (SSE) ─────────────────────────
  router.get('/api/local/save-bulk/progress/:jobId', (req, res) => {
    const job = saveJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const write = (line) => { res.write(line); if (typeof res.flush === 'function') res.flush(); };
    write(`event: progress\ndata: ${JSON.stringify({ done: job.done, total: job.total, chapter: '' })}\n\n`);

    if (job.status === 'done') {
      write(`event: done\ndata: ${JSON.stringify({ localId: job.localId })}\n\n`);
      res.end();
      return;
    }
    job.listeners.push(write);
    req.on('close', () => { job.listeners = job.listeners.filter(l => l !== write); });
  });
}

module.exports = { configure, registerLocalRoutes };
