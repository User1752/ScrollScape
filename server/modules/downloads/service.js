'use strict';

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
    bulkJobs.set(jobId, { status: 'pending', done: 0, total: chapters.length, listeners: [], cbzBuffer: null, filename: null, error: null });

    processBulkJob(jobId, mangaTitle, chapters, sid);
    return { jobId };
  }

  function getBulkJob(jobId) {
    return bulkJobs.get(jobId) || null;
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

  return {
    JOB_TTL,
    bulkJobs,
    jobNotify,
    processBulkJob,
    downloadChapter,
    startBulkDownload,
    getBulkJob,
    addBulkListener,
    removeBulkListener,
    deleteBulkJob,
  };
}

module.exports = { createDownloadService };