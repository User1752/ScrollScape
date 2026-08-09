/**
 * routes/mihon-import.js — Import a Tachiyomi/Mihon library backup (.tachibk)
 *
 * See server/modules/mihon-import/service.js for the mapping rules and its
 * honest scope limits (source-id resolution is best-effort by name match;
 * unresolved sources import as metadata-only entries the user can re-link
 * via the existing Migrate feature).
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const { readStore, writeStore } = require('../store');
const { safeManga, sha1Short } = require('../helpers');
const { createMihonImportService } = require('../modules/mihon-import/service');
const { createAsyncHandler } = require('../modules/http/async-handler');

const mihonImportService = createMihonImportService({ readStore, writeStore, safeManga, sha1Short });

let upload = null;

/** @param {{ upload: import('multer').Multer }} opts */
function configure(opts) {
  upload = opts.upload;
}

const asyncHandler = createAsyncHandler('MIHON-IMPORT');

/** @param {import('express').Router} router */
function registerMihonImportRoutes(router) {
  router.post('/api/import/mihon', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
      const err = new Error('No file uploaded');
      err.statusCode = 400;
      throw err;
    }

    let result;
    try {
      const buffer = await fsp.readFile(req.file.path);
      result = await mihonImportService.importMihonBackup(buffer);
    } catch (err) {
      err.statusCode = err.statusCode || 400;
      err.message = `Could not read this file as a Tachiyomi/Mihon backup: ${err.message}`;
      throw err;
    } finally {
      if (req.file?.path) fsp.unlink(req.file.path).catch(() => {});
    }

    res.json(result);
  }));
}

module.exports = { configure, registerMihonImportRoutes };
