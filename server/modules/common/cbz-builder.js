'use strict';

// The "guess a file extension from an image URL" one-liner used to be
// copy-pasted verbatim in downloads/service.js (x2), local/service.js, and
// routes/opds.js — small, but a bug fix (e.g. supporting .avif) previously
// had to be applied in four places to actually take effect everywhere.
function guessImageExt(url) {
  return ((String(url || '').match(/\.(jpe?g|png|webp|gif)/i) || ['', 'jpg'])[1]).replace(/jpeg/i, 'jpg');
}

/**
 * Fetches each already-resolved page ({ url, referer }) and adds it to
 * `zip`, 1-indexed and zero-padded, optionally under `folder` — the same
 * "fetch pages -> zip.addFile" loop that used to be its own copy inside
 * downloads/service.js's downloadChapter, inside its processBulkJob (once
 * per chapter, with a folder prefix), and inside routes/opds.js's on-demand
 * CBZ endpoint. A page that fails to fetch is skipped, not fatal — one bad
 * page shouldn't fail the whole archive; pass `onSkip(index, error)` to log it.
 *
 * @returns {Promise<number>} how many pages were actually added
 */
async function addPagesToZip(zip, resolvedPages, { fetchImageBuffer, folder = '', pad = 3, onSkip } = {}) {
  let added = 0;
  for (let i = 0; i < resolvedPages.length; i++) {
    const page = resolvedPages[i];
    if (!page) continue;
    const { url: imgUrl, referer } = page;
    try {
      const buf = await fetchImageBuffer(imgUrl, referer);
      const ext = guessImageExt(imgUrl);
      const name = `${String(i + 1).padStart(pad, '0')}.${ext}`;
      zip.addFile(folder ? `${folder}/${name}` : name, buf);
      added++;
    } catch (e) {
      if (onSkip) onSkip(i, e);
    }
  }
  return added;
}

module.exports = { guessImageExt, addPagesToZip };
