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
const express  = require('express');
const AdmZip   = require('adm-zip');
const { safeId, sha1Short, fetchImageBuffer, resolvePageUrl, safeName } = require('../helpers');
const { loadSourceFromFile } = require('../sourceLoader');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { streamJobProgress } = require('../modules/http/job-progress-sse');
const { createLocalService } = require('../modules/local/service');

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

const asyncHandler = createAsyncHandler('LOCAL');
let localService = null;

/**
 * @param {import('express').Router} router  The app-level router
 */
function registerLocalRoutes(router) {
  localService = createLocalService({
    LOCAL_DIR,
    safeId,
    loadSourceFromFile,
    sha1Short,
    fetchImageBuffer,
    resolvePageUrl,
    safeName,
    crypto,
    AdmZip,
  });

  // Serve extracted images and PDFs from the LOCAL_DIR as static assets.
  // NOTE: this must be registered before the API routes so that the
  // static handler does not intercept /api/local/* paths.
  router.use('/local-media', express.static(LOCAL_DIR));

  // ── Virtual source: search ─────────────────────────────────────────────────
  // Local manga has no searchable index — return empty results.
  router.post('/api/source/local/search', (_req, res) => {
    res.json(localService.search());
  });

  // ── Virtual source: mangaDetails ──────────────────────────────────────────
  router.post('/api/source/local/mangaDetails', asyncHandler(async (req, res) => {
    res.json(await localService.getMangaDetails(req.body || {}));
  }));

  // ── Virtual source: chapters ───────────────────────────────────────────────
  router.post('/api/source/local/chapters', asyncHandler(async (req, res) => {
    res.json(await localService.getChapters(req.body || {}));
  }));

  // ── Virtual source: pages ──────────────────────────────────────────────────
  router.post('/api/source/local/pages', asyncHandler(async (req, res) => {
    res.json(await localService.getPages(req.body || {}));
  }));

  // ── GET /api/local/list ────────────────────────────────────────────────────
  router.get('/api/local/list', asyncHandler(async (_req, res) => {
    res.json(await localService.listLocalManga());
  }));

  // ── GET /api/local/:mangaId/thumb ──────────────────────────────────────────
  router.get('/api/local/:mangaId/thumb', asyncHandler(async (req, res) => {
    const target = await localService.getThumbnailTarget(req.params.mangaId);
    if (!target) return res.status(404).end();
    res.redirect(target);
  }));

  // ── POST /api/local/:mangaId/cover ─────────────────────────────────────────
  router.post(
    '/api/local/:mangaId/cover',
    express.raw({ type: 'image/*', limit: '5mb' }),
    asyncHandler(async (req, res) => {
      res.json(await localService.updateLocalCover(req.params.mangaId, req.body));
    })
  );

  // ── DELETE /api/local/:mangaId ─────────────────────────────────────────────
  router.delete('/api/local/:mangaId', asyncHandler(async (req, res) => {
    res.json(await localService.deleteLocalManga(req.params.mangaId));
  }));

  // ── POST /api/local/import ────────────────────────────────────────────────
  // Accepts a single CBZ / CBR / PDF file via multipart/form-data.
  router.post('/api/local/import', upload.single('file'), asyncHandler(async (req, res) => {
    res.json(await localService.importArchive(req.file, req.body || {}));
  }));

  // ── POST /api/local/save-chapter ───────────────────────────────────────────
  // Saves a single online chapter into the local library so it can be read offline.
  router.post('/api/local/save-chapter', asyncHandler(async (req, res) => {
    res.json(await localService.saveChapter(req.body || {}));
  }));

  // ── POST /api/local/save-bulk/start ────────────────────────────────────────
  router.post('/api/local/save-bulk/start', asyncHandler(async (req, res) => {
    res.json(await localService.startBulkSave(req.body || {}));
  }));

  // ── GET /api/local/save-bulk/progress/:jobId (SSE) ─────────────────────────
  router.get('/api/local/save-bulk/progress/:jobId', (req, res) => {
    const job = localService.getBulkJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    streamJobProgress({
      req,
      res,
      job,
      addListener: (write) => localService.addBulkListener(req.params.jobId, write),
      removeListener: (write) => localService.removeBulkListener(req.params.jobId, write),
      doneData: (currentJob) => ({ localId: currentJob.localId }),
    });
  });
}

module.exports = { configure, registerLocalRoutes };
