'use strict';

const { readStore, writeStore, flushNow } = require('../store');

function registerSettingsRoutes(app) {
  app.get('/api/settings', async (req, res) => {
    try {
      const store = await readStore();
      res.json({ ok: true, data: store.settings || {} });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const updates = req.body || {};
      const store = await readStore();
      
      store.settings = store.settings || {};

      if (typeof updates.flaresolverrUrl === 'string') {
        store.settings.flaresolverrUrl = updates.flaresolverrUrl;
      }

      if (typeof updates.comicVineApiKey === 'string') {
        store.settings.comicVineApiKey = updates.comicVineApiKey;
      }

      await writeStore(store);
      // Settings are rare, deliberate writes (unlike high-frequency reading
      // progress) — flush to disk immediately rather than relying on the
      // debounced write. The launcher's restart/stop force-kills the process
      // on Windows, which skips the graceful-shutdown flush entirely, so a
      // save made just before a restart could otherwise be silently lost.
      flushNow();
      res.json({ ok: true, data: store.settings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerSettingsRoutes };
