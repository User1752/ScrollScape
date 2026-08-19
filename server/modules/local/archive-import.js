'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const IMG_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
const normaliseExt = (e) => e.replace(/^jpeg$/i, 'jpg');

// Imports a user-uploaded CBZ/CBR/ZIP/PDF/EPUB as a new local manga entry
// under LOCAL_DIR, extracting page images (or storing the file whole, for
// PDF/EPUB) and writing the meta.json a source-plugin-shaped reader expects.
function createArchiveImporter({ LOCAL_DIR, sha1Short, AdmZip }) {
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

      if (!['.cbz', '.cbr', '.zip', '.pdf', '.epub'].includes(ext)) {
        const err = new Error('Unsupported format. Use CBZ, CBR, ZIP, PDF or EPUB.');
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
      let chapterIsEpub = false;
      let epubUrl = '';

      if (ext === '.pdf') {
        const destPdf = path.join(mangaDir, 'original.pdf');
        await fsp.copyFile(tmpPath, destPdf);
        chapterIsPDF = true;
        pdfUrl = `/local-media/${mangaId}/original.pdf`;
      } else if (ext === '.epub') {
        // EPUB is handled entirely client-side by epub.js (public/modules/
        // ui-epub-reader.js), the same "store the whole file, let a
        // dedicated JS library render it" approach already used for PDF —
        // unlike CBZ/CBR, there are no discrete page images to extract:
        // EPUB content reflows per the reader's own viewport/font size.
        const destEpub = path.join(mangaDir, 'original.epub');
        await fsp.copyFile(tmpPath, destEpub);
        chapterIsEpub = true;
        epubUrl = `/local-media/${mangaId}/original.epub`;
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

      const cover = pages[0] || (chapterIsPDF ? pdfUrl : '') || (chapterIsEpub ? epubUrl : '');
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
          isEpub: chapterIsEpub,
          epubUrl: epubUrl || null,
          pages: (chapterIsPDF || chapterIsEpub) ? [] : pages,
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

  return { importArchive };
}

module.exports = { createArchiveImporter, IMG_EXT_RE };
