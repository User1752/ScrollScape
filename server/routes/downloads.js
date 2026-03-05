/**
 * routes/downloads.js — Chapter and bulk download endpoints
 *
 * Endpoints:
 *   POST /api/download/chapter          — Download a single chapter as a CBZ archive
 *   POST /api/download/bulk/start       — Start an async bulk download job → { jobId }
 *   GET  /api/download/bulk/progress/:id — SSE stream of real download progress
 *   GET  /api/download/bulk/file/:id    — Retrieve the finished CBZ file
 */

'use strict';

const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { safeId, isSafeUrl, fetchImageBuffer, resolvePageUrl, safeName } = require('../helpers');
const { loadSourceFromFile } = require('../sourceLoader');

/** How long to keep a finished job in memory before auto-cleanup (ms). */
const JOB_TTL = 15 * 60 * 1000;

/** In-memory job store: jobId → job object */
const bulkJobs = new Map();

/** Notify all SSE listeners of a job event. */
function jobNotify(job, event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const write of job.listeners) {
    try { write(line); } catch (_) { /* disconnected */ }
  }
}

/** Run the bulk download job asynchronously, streaming progress via SSE. */
async function processBulkJob(jobId, mangaTitle, chapters, sid) {
  const job = bulkJobs.get(jobId);
  if (!job) return;

  try {
    const source = loadSourceFromFile(sid);
    const zip    = new AdmZip();
    job.total  = chapters.length;
    job.status = 'running';

    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      job.done = ci;
      jobNotify(job, 'progress', { done: ci, total: chapters.length, chapter: ch.name });

      let pages = [];
      try {
        const result = await source.pages(ch.id);
        pages = result.pages || [];
      } catch (e) {
        console.warn(`[bulk-dl] pages() failed for ${ch.name}: ${e.message}`);
        continue;
      }

      const folder = safeName(ch.name);
      for (let i = 0; i < pages.length; i++) {
        const resolved = resolvePageUrl(pages[i]);
        if (!resolved) continue;
        const { url: imgUrl, referer } = resolved;
        try {
          const buf = await fetchImageBuffer(imgUrl, referer);
          const ext = ((imgUrl.match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1]).replace('jpeg', 'jpg');
          zip.addFile(`${folder}/${String(i + 1).padStart(3, '0')}.${ext}`, buf);
        } catch (e) {
          console.warn(`[bulk-dl] skipped ${ch.name} p${i + 1}: ${e.message}`);
        }
      }
    }

    job.cbzBuffer = zip.toBuffer();
    job.filename  = `${safeName(mangaTitle)} - ${chapters.length} chapters.cbz`;
    job.done      = chapters.length;
    job.status    = 'done';
    jobNotify(job, 'progress', { done: chapters.length, total: chapters.length, chapter: '' });
    jobNotify(job, 'done', { jobId });

    // Auto-cleanup
    setTimeout(() => bulkJobs.delete(jobId), JOB_TTL);
  } catch (e) {
    job.status = 'error';
    job.error  = e.message;
    jobNotify(job, 'error', { error: e.message });
  }
}

/**
 * @param {import('express').Router} router
 */
function registerDownloadRoutes(router) {
  // ── POST /api/download/chapter ─────────────────────────────────────────────
  router.post('/api/download/chapter', async (req, res) => {
    try {
      const { mangaTitle, chapterName, pages } = req.body || {};
      if (!Array.isArray(pages) || pages.length === 0)
        return res.status(400).json({ error: 'No pages provided' });

      const resolvedPages = pages.map(resolvePageUrl).filter(Boolean);
      if (resolvedPages.length === 0)
        return res.status(400).json({ error: 'No valid page URLs' });

      const zip = new AdmZip();
      for (let i = 0; i < resolvedPages.length; i++) {
        const { url: imgUrl, referer } = resolvedPages[i];
        try {
          const buf = await fetchImageBuffer(imgUrl, referer);
          const ext = ((imgUrl.match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1]).replace('jpeg', 'jpg');
          zip.addFile(`${String(i + 1).padStart(3, '0')}.${ext}`, buf);
        } catch (e) {
          console.warn(`[download] skipped page ${i + 1}: ${e.message}`);
        }
      }

      const filename = `${safeName(mangaTitle)} - ${safeName(chapterName)}.cbz`;
      res.setHeader('Content-Type', 'application/vnd.comicbook+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(zip.toBuffer());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/download/bulk/start ──────────────────────────────────────────
  router.post('/api/download/bulk/start', async (req, res) => {
    try {
      const { mangaTitle, chapters, sourceId } = req.body || {};
      if (!Array.isArray(chapters) || chapters.length === 0)
        return res.status(400).json({ error: 'No chapters provided' });

      const sid = safeId(sourceId);
      if (!sid) return res.status(400).json({ error: 'Invalid sourceId' });

      const jobId = crypto.randomBytes(8).toString('hex');
      bulkJobs.set(jobId, { status: 'pending', done: 0, total: chapters.length, listeners: [], cbzBuffer: null, filename: null, error: null });

      processBulkJob(jobId, mangaTitle, chapters, sid);

      res.json({ jobId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/download/bulk/progress/:jobId (SSE) ───────────────────────────
  router.get('/api/download/bulk/progress/:jobId', (req, res) => {
    const job = bulkJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Disable compression for this endpoint — gzip buffers the stream and
    // prevents SSE events from reaching the browser until the connection closes.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const write = (line) => {
      res.write(line);
      // flush() is added by the compression middleware; call it so each
      // event is immediately pushed to the client rather than buffered.
      if (typeof res.flush === 'function') res.flush();
    };

    // Send current state immediately
    write(`event: progress\ndata: ${JSON.stringify({ done: job.done, total: job.total, chapter: '' })}\n\n`);

    if (job.status === 'done') {
      write(`event: done\ndata: ${JSON.stringify({ jobId: req.params.jobId })}\n\n`);
      res.end();
      return;
    }
    if (job.status === 'error') {
      write(`event: error\ndata: ${JSON.stringify({ error: job.error })}\n\n`);
      res.end();
      return;
    }

    job.listeners.push(write);
    req.on('close', () => {
      job.listeners = job.listeners.filter(l => l !== write);
    });
  });

  // ── GET /api/download/bulk/file/:jobId ─────────────────────────────────────
  router.get('/api/download/bulk/file/:jobId', (req, res) => {
    const job = bulkJobs.get(req.params.jobId);
    if (!job || job.status !== 'done' || !job.cbzBuffer)
      return res.status(404).json({ error: 'File not ready' });

    res.setHeader('Content-Type', 'application/vnd.comicbook+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    res.send(job.cbzBuffer);

    // Cleanup shortly after serving
    setTimeout(() => bulkJobs.delete(req.params.jobId), 10_000);
  });
}

module.exports = { registerDownloadRoutes };
