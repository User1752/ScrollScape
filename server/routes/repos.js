/**
 * routes/repos.js — Source repository management endpoints
 *
 * Endpoints:
 *   GET    /api/state          — Returns installed sources, repos, available sources
 *   POST   /api/repos          — Add a repo by URL or inline JSON (SSRF-guarded)
 *   DELETE /api/repos?url=...  — Remove a repo by URL
 *
 * Security:
 *  • Repo URLs are SSRF-guarded via isSafeUrl() before any network request.
 *  • Only recognised repo formats are accepted ("jsrepo" or "tachiyomi").
 */

'use strict';

const { isSafeUrl, fetchJson, sha1Short } = require('../helpers');
const { readStore, writeStore } = require('../store');
const {
  listAvailableSourcesFromRepos,
  detectRepoKind,
  autoInstallLocalSources,
  loadSourceFromFile,
} = require('../sourceLoader');

/**
 * @param {import('express').Router} router
 */
function registerRepoRoutes(router) {
  // ── GET /api/state ─────────────────────────────────────────────────────────
  router.get('/api/state', async (req, res) => {
    try {
      // Keep installedSources in sync with files dropped into data/sources.
      await autoInstallLocalSources();
      const store     = await readStore();
      const available = await listAvailableSourcesFromRepos(store.repos);

      const installedSources = { ...(store.installedSources || {}) };
      for (const sid of Object.keys(installedSources)) {
        try {
          const mod = loadSourceFromFile(sid);
          installedSources[sid] = {
            ...installedSources[sid],
            capabilities: {
              trending: typeof mod.trending === 'function' && mod.meta?.supportsTrending !== false,
              recentlyAdded: typeof mod.recentlyAdded === 'function' && mod.meta?.supportsRecentlyAdded !== false,
              latestUpdates: typeof mod.latestUpdates === 'function' && mod.meta?.supportsLatestUpdates !== false,
              popularAllTime: mod.meta?.supportsPopularAllTime === true,
            },
          };
        } catch (_) {
          installedSources[sid] = {
            ...installedSources[sid],
            capabilities: {
              trending: false,
              recentlyAdded: false,
              latestUpdates: false,
              popularAllTime: false,
            },
          };
        }
      }

      res.json({
        repos:            store.repos,
        availableSources: available,
        installedSources,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/repos ────────────────────────────────────────────────────────
  router.post('/api/repos', async (req, res) => {
    try {
      const { url, repoJson } = req.body || {};
      let repoData, kind, repoUrl;

      if (typeof url === 'string' && url.startsWith('http')) {
        // SSRF guard: only allow public-internet URLs.
        if (!isSafeUrl(url)) return res.status(400).json({ error: 'URL is not allowed (private/loopback)' });
        repoData = await fetchJson(url);
        repoUrl  = url;
      } else if (repoJson) {
        repoData = repoJson;
        repoUrl  = `localrepo:${sha1Short(JSON.stringify(repoData))}`;
      } else {
        return res.status(400).json({ error: 'Valid URL or repoJson required' });
      }

      kind = detectRepoKind(repoData);
      if (kind === 'unknown') return res.status(400).json({ error: 'Unrecognised repo format' });

      const store = await readStore();
      if (!store.repos.some(r => r.url === repoUrl)) {
        const name = repoData?.name || (kind === 'tachiyomi' ? 'Tachiyomi Repo' : repoUrl);
        store.repos.push({ url: repoUrl, name, kind });
        await writeStore(store);
      }

      res.json({ ok: true, kind });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/repos ──────────────────────────────────────────────────────
  router.delete('/api/repos', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: 'url query parameter required' });
      const store    = await readStore();
      store.repos    = store.repos.filter(r => r.url !== url);
      await writeStore(store);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerRepoRoutes };
