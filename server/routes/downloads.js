'use strict';

const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { safeId, resolvePageUrl, fetchImageBuffer, safeName } = require('../helpers');
const { loadSourceFromFile } = require('../sourceLoader');
const { createDownloadService } = require('../modules/downloads/service');
const { streamJobProgress } = require('../modules/http/job-progress-sse');

const downloadService = createDownloadService({
  loadSourceFromFile,
  safeId,
  safeName,
  resolvePageUrl,
  fetchImageBuffer,
  AdmZip,
  crypto,
});

function sendCbzResponse(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/vnd.comicbook+zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

/**
 * @param {import('express').Router} router
 */
function registerDownloadRoutes(router) {
  router.post('/api/download/chapter', async (req, res) => {
    try {
      const result = await downloadService.downloadChapter(req.body || {});
      sendCbzResponse(res, result.filename, result.buffer);
    } catch (e) {
      const status = Number(e?.statusCode) || 500;
      res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  });

  router.post('/api/download/bulk/start', async (req, res) => {
    try {
      res.json(await downloadService.startBulkDownload(req.body || {}));
    } catch (e) {
      const status = Number(e?.statusCode) || 500;
      res.status(status).json({ error: e?.message || 'Internal Server Error' });
    }
  });

  router.get('/api/download/bulk/progress/:jobId', (req, res) => {
    const job = downloadService.getBulkJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    streamJobProgress({
      req,
      res,
      job,
      addListener: (write) => downloadService.addBulkListener(req.params.jobId, write),
      removeListener: (write) => downloadService.removeBulkListener(req.params.jobId, write),
      doneData: () => ({ jobId: req.params.jobId }),
      errorData: (currentJob) => ({ error: currentJob.error }),
    });
  });

  router.get('/api/download/bulk/file/:jobId', (req, res) => {
    const job = downloadService.getBulkJob(req.params.jobId);
    if (!job || job.status !== 'done' || !job.cbzBuffer) {
      return res.status(404).json({ error: 'File not ready' });
    }

    sendCbzResponse(res, job.filename, job.cbzBuffer);

    setTimeout(() => downloadService.deleteBulkJob(req.params.jobId), 10_000);
  });
}

module.exports = { registerDownloadRoutes };