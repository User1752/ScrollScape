'use strict';

const { readStore, writeStore, flushNow, normaliseStore } = require('../store');
const { createAsyncHandler } = require('../modules/http/async-handler');

const asyncHandler = createAsyncHandler('BACKUP');

/**
 * Full-library backup: exports/imports the entire server-side store
 * (library, history, custom lists, achievements, AniList sync stats,
 * settings, etc). The AniList OAuth token itself and per-browser UI state
 * live in localStorage, not here — the client combines both into one file
 * (see public/modules/ui-backup.js).
 */
function registerBackupRoutes(app) {
  app.get('/api/backup/export', asyncHandler(async (req, res) => {
    const store = await readStore();
    res.json({ ok: true, store });
  }));

  app.post('/api/backup/import', asyncHandler(async (req, res) => {
    const incoming = req.body && req.body.store;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      const err = new Error('Invalid backup file: missing store data.');
      err.statusCode = 400;
      err.expected = true;
      throw err;
    }

    // Restoring replaces the entire library/settings/history wholesale —
    // normalise it through the same schema defaults used on a normal boot
    // so a partial/older backup doesn't leave the app with missing
    // fields other routes assume exist (e.g. store.favorites as array).
    normaliseStore(incoming);
    await writeStore(incoming);
    // Deliberate write, not a high-frequency one — flush immediately
    // rather than relying on the debounced save (mirrors settings.js).
    flushNow();

    res.json({ ok: true });
  }));
}

module.exports = { registerBackupRoutes };
