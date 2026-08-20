/**
 * routes/opds.js — Read-only OPDS catalog feed
 *
 * Lets external e-reader apps (KOReader, Moon+ Reader, etc.) browse this
 * ScrollScape library and download chapters, without going through the
 * app's own UI. Three levels:
 *
 *   GET /opds                                        — one entry per favorite/local manga
 *   GET /opds/manga/:sourceId/:mangaId                — one entry per chapter
 *   GET /opds/download/:sourceId/:mangaId/:chapterId  — streams a CBZ (built on demand)
 *
 * Registered outside /api on purpose: the global /api rate limiter and 30s
 * apiTimeout (server.js) are mounted with app.use('/api', ...), so a route
 * living at /opds/* never passes through either — no override needed for
 * a chapter-zip request that might legitimately take longer than 30s.
 *
 * No auth: consistent with the rest of this self-hosted, single-user app,
 * which has no login system anywhere else either.
 *
 * mangaId/chapterId are opaque per-source strings that can contain slashes,
 * colons, etc. (confirmed in real library data, e.g. a mangapill id of
 * "8/kingdom") — never validated with safeId() (that's an alphanumeric-only
 * slug check meant for *source* ids). They're carried as URL-encoded path
 * segments and decoded back with decodeURIComponent(), the same trick any
 * REST API uses to fit an arbitrary string into one path segment.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { readStore } = require('../store');
const { safeId, sha1Short, safeName, fetchImageBuffer, resolvePageUrl } = require('../helpers');
const { loadSourceFromFile } = require('../sourceLoader');
const { createLocalService } = require('../modules/local/service');
const { createAsyncHandler } = require('../modules/http/async-handler');
const { guessImageExt, addPagesToZip } = require('../modules/common/cbz-builder');

let LOCAL_DIR = '';
let localService = null;

/**
 * @param {{ localDir: string }} opts
 */
function configure(opts) {
  LOCAL_DIR = opts.localDir;
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
}

const asyncHandler = createAsyncHandler('OPDS');

function xmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function absUrl(req, url) {
  const s = String(url || '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const origin = `${req.protocol}://${req.get('host')}`;
  return s.startsWith('/') ? `${origin}${s}` : `${origin}/${s}`;
}

function feedHeader({ id, title, selfHref, upHref }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>${xmlEscape(id)}</id>
  <title>${xmlEscape(title)}</title>
  <updated>${new Date().toISOString()}</updated>
  <author><name>ScrollScape</name></author>
  <link rel="self" href="${xmlEscape(selfHref)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>${
    upHref ? `\n  <link rel="up" href="${xmlEscape(upHref)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>` : ''
  }`;
}

function sendFeed(res, xmlBody) {
  res.setHeader('Content-Type', 'application/atom+xml;charset=utf-8');
  res.send(`${xmlBody}\n</feed>\n`);
}

function safeDate(value) {
  const d = new Date(value || Date.now());
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

/**
 * @param {import('express').Application} app
 */
function registerOpdsRoutes(app) {
  // ── Root catalog: every favorite + local manga ──────────────────────────────
  app.get('/opds', asyncHandler(async (req, res) => {
    const store = await readStore();
    const { localManga } = await localService.listLocalManga();
    const allManga = [
      ...(store.favorites || []).map((m) => ({ ...m, sourceId: m.sourceId || 'unknown' })),
      ...localManga,
    ];

    let body = feedHeader({ id: 'urn:scrollscape:root', title: 'ScrollScape Library', selfHref: '/opds' });
    for (const m of allManga) {
      if (!m?.id || !m?.title) continue;
      const mangaHref = `/opds/manga/${encodeURIComponent(m.sourceId)}/${encodeURIComponent(m.id)}`;
      const cover = absUrl(req, m.cover);
      body += `
  <entry>
    <id>urn:scrollscape:manga:${xmlEscape(m.sourceId)}:${xmlEscape(m.id)}</id>
    <title>${xmlEscape(m.title)}</title>
    <updated>${safeDate(m.updatedAt || m.addedAt)}</updated>${
      m.author ? `\n    <author><name>${xmlEscape(m.author)}</name></author>` : ''
    }
    <content type="text">${xmlEscape(m.sourceId === 'local' ? 'Local import' : m.sourceId)}</content>
    <link rel="subsection" href="${xmlEscape(mangaHref)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>${
      cover ? `\n    <link rel="http://opds-spec.org/image" href="${xmlEscape(cover)}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="${xmlEscape(cover)}" type="image/jpeg"/>` : ''
    }
  </entry>`;
    }
    sendFeed(res, body);
  }));

  // ── Per-manga chapter feed ───────────────────────────────────────────────────
  app.get('/opds/manga/:sourceId/:mangaId', asyncHandler(async (req, res) => {
    const sourceId = String(req.params.sourceId || '');
    const mangaId = decodeURIComponent(req.params.mangaId || '');
    if (!sourceId || !mangaId) return res.status(400).send('Missing sourceId/mangaId');

    let title = mangaId;
    let chapters = [];

    if (sourceId === 'local') {
      const details = await localService.getMangaDetails({ mangaId });
      title = details.title;
      const chData = await localService.getChapters({ mangaId });
      chapters = chData.chapters || [];
    } else {
      const sid = safeId(sourceId);
      if (!sid) return res.status(400).send('Invalid sourceId');
      const source = loadSourceFromFile(sid);
      const details = await source.mangaDetails(mangaId);
      title = details?.title || mangaId;
      const chData = await source.chapters(mangaId);
      chapters = chData?.chapters || [];
    }

    let body = feedHeader({
      id: `urn:scrollscape:manga:${sourceId}:${mangaId}`,
      title: `${title} — Chapters`,
      selfHref: `/opds/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}`,
      upHref: '/opds',
    });

    for (const ch of chapters) {
      const chapterId = String(ch.id ?? '');
      if (!chapterId) continue;

      let acquisitionHref = `/opds/download/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`;
      let type = 'application/vnd.comicbook+zip';

      // Local PDF/EPUB chapters have no page images to zip — link straight
      // at the original file instead of routing through the CBZ builder.
      if (sourceId === 'local') {
        const pageData = await localService.getPages({ chapterId });
        if (pageData.isPDF && pageData.pdfUrl) {
          acquisitionHref = absUrl(req, pageData.pdfUrl);
          type = 'application/pdf';
        } else if (pageData.isEpub && pageData.epubUrl) {
          acquisitionHref = absUrl(req, pageData.epubUrl);
          type = 'application/epub+zip';
        } else {
          acquisitionHref = absUrl(req, acquisitionHref);
        }
      } else {
        acquisitionHref = absUrl(req, acquisitionHref);
      }

      body += `
  <entry>
    <id>urn:scrollscape:chapter:${xmlEscape(sourceId)}:${xmlEscape(mangaId)}:${xmlEscape(chapterId)}</id>
    <title>${xmlEscape(ch.name || ch.chapter || chapterId)}</title>
    <updated>${safeDate(ch.publishAt || ch.date)}</updated>
    <link rel="http://opds-spec.org/acquisition" href="${xmlEscape(acquisitionHref)}" type="${type}"/>
  </entry>`;
    }
    sendFeed(res, body);
  }));

  // ── Chapter download: builds/streams a CBZ on demand ────────────────────────
  app.get('/opds/download/:sourceId/:mangaId/:chapterId', asyncHandler(async (req, res) => {
    const sourceId = String(req.params.sourceId || '');
    const mangaId = decodeURIComponent(req.params.mangaId || '');
    const chapterId = decodeURIComponent(req.params.chapterId || '');
    if (!sourceId || !mangaId || !chapterId) return res.status(400).json({ error: 'Missing identifiers' });

    const zip = new AdmZip();
    let filenameBase = chapterId;

    if (sourceId === 'local') {
      const pageData = await localService.getPages({ chapterId });
      if (pageData.isPDF || pageData.isEpub) {
        return res.status(400).json({ error: 'This chapter is a single file — use the acquisition link from the chapter feed directly.' });
      }
      const pages = pageData.pages || [];
      for (let i = 0; i < pages.length; i++) {
        // getPages() returns already-extracted images as /local-media/... paths —
        // read straight off disk instead of looping this request back through
        // its own static file server.
        const rel = String(pages[i]?.img || '').replace(/^\/local-media\//, '');
        if (!rel) continue;
        try {
          const buf = await fsp.readFile(path.join(LOCAL_DIR, rel));
          const ext = guessImageExt(rel);
          zip.addFile(`${String(i + 1).padStart(3, '0')}.${ext}`, buf);
        } catch (e) {
          console.warn(`[opds] skipped local page ${i + 1}: ${e.message}`);
        }
      }
      try {
        const details = await localService.getMangaDetails({ mangaId });
        filenameBase = `${details.title} - ${chapterId}`;
      } catch (_) { /* fall back to raw chapterId */ }
    } else {
      const sid = safeId(sourceId);
      if (!sid) return res.status(400).json({ error: 'Invalid sourceId' });
      const source = loadSourceFromFile(sid);
      const result = await source.pages(chapterId);
      const resolvedPages = (result?.pages || []).map(resolvePageUrl).filter(Boolean);

      await addPagesToZip(zip, resolvedPages, {
        fetchImageBuffer,
        onSkip: (i, e) => console.warn(`[opds] skipped page ${i + 1}: ${e.message}`),
      });

      try {
        const details = await source.mangaDetails(mangaId);
        filenameBase = `${details?.title || mangaId} - ${chapterId}`;
      } catch (_) { /* fall back to raw chapterId */ }
    }

    res.setHeader('Content-Type', 'application/vnd.comicbook+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filenameBase)}.cbz"`);
    res.send(zip.toBuffer());
  }));
}

module.exports = { configure, registerOpdsRoutes };
