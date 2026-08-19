'use strict';

const { addPagesToZip } = require('../common/cbz-builder');

function createDownloadService({ loadSourceFromFile, safeId, safeName, resolvePageUrl, fetchImageBuffer, AdmZip, crypto }) {
  const JOB_TTL = 15 * 60 * 1000;
  const bulkJobs = new Map();

  function jobNotify(job, event, data) {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const write of job.listeners) {
      try {
        write(line);
      } catch (_) {
        // disconnected
      }
    }
  }

  async function processBulkJob(jobId, mangaTitle, chapters, sid) {
    const job = bulkJobs.get(jobId);
    if (!job) return;

    try {
      const source = loadSourceFromFile(sid);
      const zip = new AdmZip();
      job.total = chapters.length;
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
        const resolvedPages = pages.map(resolvePageUrl);
        await addPagesToZip(zip, resolvedPages, {
          fetchImageBuffer,
          folder,
          onSkip: (i, e) => console.warn(`[bulk-dl] skipped ${ch.name} p${i + 1}: ${e.message}`),
        });
      }

      job.cbzBuffer = zip.toBuffer();
      job.filename = `${safeName(mangaTitle)} - ${chapters.length} chapters.cbz`;
      job.done = chapters.length;
      job.status = 'done';
      jobNotify(job, 'progress', { done: chapters.length, total: chapters.length, chapter: '' });
      jobNotify(job, 'done', { jobId });

      setTimeout(() => bulkJobs.delete(jobId), JOB_TTL);
    } catch (e) {
      job.status = 'error';
      job.error = e.message;
      jobNotify(job, 'error', { error: e.message });
    }
  }

  async function downloadChapter({ mangaTitle, chapterName, pages } = {}) {
    if (!Array.isArray(pages) || pages.length === 0) {
      const err = new Error('No pages provided');
      err.statusCode = 400;
      throw err;
    }

    const resolvedPages = pages.map(resolvePageUrl).filter(Boolean);
    if (resolvedPages.length === 0) {
      const err = new Error('No valid page URLs');
      err.statusCode = 400;
      throw err;
    }

    const zip = new AdmZip();
    await addPagesToZip(zip, resolvedPages, {
      fetchImageBuffer,
      onSkip: (i, e) => console.warn(`[download] skipped page ${i + 1}: ${e.message}`),
    });

    return {
      filename: `${safeName(mangaTitle)} - ${safeName(chapterName)}.cbz`,
      buffer: zip.toBuffer(),
    };
  }

  async function startBulkDownload({ mangaTitle, chapters, sourceId } = {}) {
    if (!Array.isArray(chapters) || chapters.length === 0) {
      const err = new Error('No chapters provided');
      err.statusCode = 400;
      throw err;
    }

    const sid = safeId(sourceId);
    if (!sid) {
      const err = new Error('Invalid sourceId');
      err.statusCode = 400;
      throw err;
    }

    const jobId = crypto.randomBytes(8).toString('hex');
    bulkJobs.set(jobId, {
      status: 'pending', done: 0, total: chapters.length, listeners: [],
      cbzBuffer: null, filename: null, error: null,
      mangaTitle: String(mangaTitle || '').slice(0, 300),
      startedAt: new Date().toISOString(),
    });

    processBulkJob(jobId, mangaTitle, chapters, sid);
    return { jobId };
  }

  function getBulkJob(jobId) {
    return bulkJobs.get(jobId) || null;
  }

  // Lightweight summary of every job still tracked (running or recently
  // finished, until JOB_TTL sweeps it) — lets a caller discover jobs without
  // already knowing a jobId, e.g. a monitoring dashboard polling for
  // "what's downloading right now".
  function listBulkJobs() {
    return [...bulkJobs.entries()].map(([jobId, job]) => ({
      jobId,
      status: job.status,
      done: job.done,
      total: job.total,
      mangaTitle: job.mangaTitle || '',
      startedAt: job.startedAt || null,
      error: job.error || null,
    }));
  }

  function addBulkListener(jobId, write) {
    const job = bulkJobs.get(jobId);
    if (!job) return null;
    job.listeners.push(write);
    return job;
  }

  function removeBulkListener(jobId, write) {
    const job = bulkJobs.get(jobId);
    if (!job) return;
    job.listeners = job.listeners.filter(listener => listener !== write);
  }

  function deleteBulkJob(jobId) {
    bulkJobs.delete(jobId);
  }

  // JOB_TTL, bulkJobs (the raw Map), jobNotify and processBulkJob are
  // internal to this module on purpose — bulkJobs in particular used to be
  // exported directly, which would let a caller mutate job state behind
  // this module's back with no offsetting benefit (nothing outside this
  // file ever actually read them). Sibling job queue in local/service.js
  // already kept its equivalent Map private; this now matches.
  return {
    downloadChapter,
    startBulkDownload,
    getBulkJob,
    listBulkJobs,
    addBulkListener,
    removeBulkListener,
    deleteBulkJob,
  };
}

module.exports = { createDownloadService };