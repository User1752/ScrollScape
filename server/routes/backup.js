'use strict';

const { readStore, writeStore, flushNow, normaliseStore } = require('../store');

/**
 * Full-library backup: exports/imports the entire server-side store
 * (library, history, custom lists, achievements, AniList sync stats,
 * settings, etc). The AniList OAuth token itself and per-browser UI state
 * live in localStorage, not here — the client combines both into one file
 * (see public/modules/ui-backup.js).
 */
function registerBackupRoutes(app) {
  app.get('/api/backup/export', async (req, res) => {
    try {
      const store = await readStore();
      res.json({ ok: true, store });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/backup/import', async (req, res) => {
    try {
      const incoming = req.body && req.body.store;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return res.status(400).json({ ok: false, error: 'Invalid backup file: missing store data.' });
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
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerBackupRoutes };
