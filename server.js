/* eslint-disable no-console */
/**
 * server.js — ScrollScape application entry point (thin orchestrator)
 *
 * This file is intentionally kept small.  All business logic lives in the
 * modules under server/:
 *
 *   server/helpers.js              — safeId, safeManga, isSafeUrl, fetch helpers
 *   server/store.js                — in-memory store + debounced disk persistence
 *   server/sourceLoader.js         — source module loading, caching, and seeding
 *   server/middleware/security.js  — security headers + IP-based rate limiter
 *   server/routes/proxy.js         — image proxy (/api/proxy-image)
 *   server/routes/repos.js         — repository management (/api/repos, /api/state)
 *   server/routes/sources.js       — source install/uninstall + generic dispatcher
 *   server/routes/local.js         — local manga (CBZ/CBR/ZIP/PDF/EPUB) import + reader
 *   server/routes/library.js       — favorites, history, reading status
 *   server/routes/downloads.js     — CBZ chapter/bulk downloads
 *   server/routes/reviews.js       — per-manga user reviews and ratings
 *   server/routes/lists.js         — custom manga lists
 *   server/routes/analytics.js     — reading analytics aggregation
 *   server/routes/achievements.js  — achievement unlock/query
 *   server/routes/mangaupdates.js  — MangaUpdates metadata lookup
 *
 * Platform support:
 *   • Windows:  standalone exe (pkg) or `node server.js`
 *   • Linux:    `node server.js`, Docker (see docker/), or Termux on Android
 *   • macOS:    `node server.js`
 *   • Android:  Termux — `node server.js`
 *
 * The only OS-specific code path is openBrowser(), which dispatches to the
 * correct system command for each platform.  All other logic is cross-platform.
 */

'use strict';

const express     = require('express');
const compression = require('compression');
const multer      = require('multer');
const path        = require('path');
const fs          = require('fs');
const fsp         = fs.promises;

// ── Path constants ────────────────────────────────────────────────────────────
// When bundled as an exe via pkg, __dirname is the read-only snapshot root.
// User-writable data (store, cache, downloads) must sit next to the exe.
const IS_PKG           = typeof process.pkg !== 'undefined';
const USER_ROOT        = IS_PKG ? path.dirname(process.execPath) : __dirname;
const DATA_DIR         = path.join(USER_ROOT, 'data');
// User-writable sources — drop/replace .js files here without rebuilding.
const SOURCES_DIR      = path.join(DATA_DIR, 'sources');
// Bundled snapshot sources — read-only, seeded into SOURCES_DIR on first run.
const SNAP_SOURCES_DIR = path.join(__dirname, 'data', 'sources');
const STORE_PATH       = path.join(DATA_DIR, 'store.json');
const CACHE_DIR        = path.join(DATA_DIR, 'cache');
const LOCAL_DIR        = path.join(USER_ROOT, 'Local');
const TMP_DIR          = path.join(DATA_DIR, 'tmp');
const THEME_PRESETS_DIR = path.join(DATA_DIR, 'theme-presets');
const PORT             = process.env.PORT || 4000;

// ── Configure submodules ─────────────────────────────────────────────────────
// Modules must be configured with path constants BEFORE routes are registered.

const storeModule = require('./server/store');
storeModule.configure(STORE_PATH);

const limits = require('./server/config/limits');

const sourceLoader = require('./server/sourceLoader');
sourceLoader.configure({ sourcesDir: SOURCES_DIR, snapSourcesDir: SNAP_SOURCES_DIR, isPkg: IS_PKG });

const localRoutes = require('./server/routes/local');
const upload = multer({ dest: TMP_DIR, limits: { fileSize: limits.maxUploadSizeBytes } });
localRoutes.configure({ localDir: LOCAL_DIR, upload });

const opdsRoutes = require('./server/routes/opds');
opdsRoutes.configure({ localDir: LOCAL_DIR });

const mihonImportRoutes = require('./server/routes/mihon-import');
mihonImportRoutes.configure({ upload });

const themePresetRoutes = require('./server/routes/theme-presets');
themePresetRoutes.configure({ presetsDir: THEME_PRESETS_DIR });

const comicVineService = require('./server/modules/comicvine/service');
comicVineService.configure({ cacheFilePath: path.join(CACHE_DIR, 'comicvine.json') });

const leagueOfComicGeeksService = require('./server/modules/leagueofcomicgeeks/service');
leagueOfComicGeeksService.configure({ cacheFilePath: path.join(CACHE_DIR, 'leagueofcomicgeeks.json') });

// ── Express application ──────────────────────────────────────────────────────
const app = express();
app.use(compression());                   // gzip all responses
app.use(express.json({ limit: limits.jsonBodyLimit })); // parse JSON bodies

// Resource monitor (CPU/RAM/network footprint of this process, for the
// terminal dashboard) — attached this early so its middleware sees every
// request, including ones a later route rejects or rate-limits. The route
// that actually exposes getSnapshot() lives in server/routes/system-health.js,
// alongside the rest of the diagnostic API.
const { createResourceMonitor } = require('./server/modules/system-health/resource-monitor');
const resourceMonitor = createResourceMonitor();
app.use(resourceMonitor.middleware);
require('./server/routes/system-health').configure({ getResourceSnapshot: resourceMonitor.getSnapshot });

// ── Security middleware ───────────────────────────────────────────────────────
const { applySecurityHeaders, rateLimiter, apiTimeout } = require('./server/middleware/security');
applySecurityHeaders(app);
// Rate-limit API endpoints: configured in limits.js
// Static assets are excluded so the UI loads without restriction.
app.use('/api', rateLimiter(limits.apiRateLimitWindowMs, limits.apiRateLimitMaxRequests));
app.use('/api', apiTimeout(limits.sourceCallTimeoutMs || 30000));
// /opds/* sits outside /api (see server/routes/opds.js) specifically so a
// slow chapter-zip request isn't cut off by apiTimeout — but that also means
// it skips the /api rate limiter above. /opds/download in particular builds
// a real CBZ (or fetches N page images from an external source) per request,
// so it gets its own, stricter limit rather than being left uncapped.
app.use('/opds/download', rateLimiter(60_000, 20));

// Optional single-password gate — off by default (see
// server/modules/auth/service.js). Only guards /api/*; static assets stay
// reachable so the SPA shell can load and render its own login screen.
const { createAuthService } = require('./server/modules/auth/service');
const { createAuthGate } = require('./server/middleware/auth-gate');
const authService = createAuthService({ readStore: storeModule.readStore, writeStore: storeModule.writeStore });
app.use('/api', createAuthGate(authService));

// ── Route registration ────────────────────────────────────────────────────────
// ORDER MATTERS:
//  • /api/source/local/* (virtual source) must be registered BEFORE the
//    generic /api/source/:id/:method handler or the "local" ID matches the
//    generic pattern and is passed to loadSourceFromFile, which throws.
//  • Static files are always last so they never shadow API routes.
const { registerAppRoutes } = require('./server/routes/bootstrap');

registerAppRoutes(app);

// ── Reader wallpapers: list GIF/WebP files from public/ ──────────────────────
app.get('/api/reader-wallpapers', (_req, res) => {
  const publicDir = path.join(__dirname, 'public');
  try {
    const files = require('fs').readdirSync(publicDir)
      .filter(f => /\.(gif|webp|mp4)$/i.test(f))
      .sort();
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});

// ── Static file serving ───────────────────────────────────────────────────────
// Suppress 404 for favicon.ico — the app has no favicon file.
app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.use('/', express.static(path.join(__dirname, 'public'), {
  maxAge:       process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag:         true,
  lastModified: true,
  setHeaders(res, filePath) {
    // CSS/JS/HTML: always revalidate so clients pick up updates immediately.
    if (/\.(css|js|html)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  },
}));

// ── SPA client-routing fallback ───────────────────────────────────────────────
// URLs like /manga/:sourceId/:id/:slug or /library are handled entirely
// client-side (see public/modules/router.js). Serve the app shell for any
// GET request that isn't an API call or an actual static file, so deep links
// and page refreshes on those routes work instead of 404ing.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next(); // real file requests (css/js/img/...) 404 normally
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Startup helpers ───────────────────────────────────────────────────────────

/**
 * Creates required directories and initialises a blank store.json if absent.
 */
async function ensureDirs() {
  const oldLocalDir = path.join(DATA_DIR, 'local');
  if (fs.existsSync(oldLocalDir) && !fs.existsSync(LOCAL_DIR)) {
    try {
      await fsp.rename(oldLocalDir, LOCAL_DIR);
    } catch(e) {
      console.log("Migration warning (old local dir to Local):", e.message);
    }
  }

  for (const dir of [DATA_DIR, SOURCES_DIR, CACHE_DIR, LOCAL_DIR, TMP_DIR, THEME_PRESETS_DIR]) {
    await fsp.mkdir(dir, { recursive: true });
  }
  // Bundled sources are loaded directly from the pkg snapshot; no seeding needed.
  if (!fs.existsSync(STORE_PATH)) {
    await fsp.writeFile(
      STORE_PATH,
      JSON.stringify({ repos: [], installedSources: {}, history: [], favorites: [] }, null, 2),
      'utf8',
    );
  }
}

/**
 * Opens the application URL in the OS default browser.
 * Supports Windows, macOS, Linux, and Android (Termux / xdg-open).
 *
 * @param {string} url
 */
function openBrowser(url) {
  const { exec } = require('child_process');
  const command = process.platform === 'win32' 
    ? `start ${url}`
    : process.platform === 'darwin' 
    ? `open ${url}`
    : `xdg-open ${url}`; // Linux & Android (Termux)
  
  exec(command, (err) => {
    if (err) {
      // Gracefully handle failures — not critical to operation
      console.log(`  (Auto-open failed; navigate manually to ${url})`);
    }
  });
}

/**
 * Fires one throwaway request to AniList in the background so its
 * connection isn't cold the first time a real feature needs it (e.g. the
 * cover picker's "Search other sources", which queries AniList directly).
 * The equivalent warm-up for each installed manga/comic source already
 * happens as a side effect of the startup health check below, which calls
 * search()/healthCheck() on every one of them — AniList isn't one of those
 * "sources" (it's a separate proxied API), so it needs its own nudge.
 * Errors are swallowed: this is purely a latency optimization, never
 * something that should affect startup or be treated as a real failure.
 */
function warmupAniListConnection() {
  const { createProxyService } = require('./server/modules/proxy/service');
  const { isSafeUrl } = require('./server/helpers');
  const proxyService = createProxyService({ isSafeUrl });
  proxyService
    .proxyAniList({ query: '{ Page(page: 1, perPage: 1) { media(type: MANGA) { id } } }' })
    .catch(() => {});
}

// ── Bootstrap sequence ────────────────────────────────────────────────────────
const { systemHealthService } = require('./server/routes/system-health');

ensureDirs()
  .then(() => storeModule.initStore())
  .then(() => sourceLoader.autoInstallLocalSources())
  // Fire-and-forget: log system health at startup without blocking the server.
  // (this also exercises search()/healthCheck() on every installed source,
  // which doubles as the warm-up described above for those sources.)
  .then(() => systemHealthService.logStartupHealth().catch(() => {}))
  .then(() => warmupAniListConnection())
  .then(() => {
    // Standalone exe: bind only to loopback — never reachable from outside.
    // Docker / Termux / server: bind to all interfaces for port-mapping.
    const host = IS_PKG ? '127.0.0.1' : '0.0.0.0';
    const maxPortAttempts = 20;

    function startServer(port, attempt = 0) {
      const server = app.listen(port, host, () => {
        console.log(`[OK] ScrollScape running on http://localhost:${port}`);
        console.log(`[OK] Sources auto-installed!`);
        if (IS_PKG) openBrowser(`http://localhost:${port}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < maxPortAttempts) {
          const nextPort = port + 1;
          console.log(`Port ${port} in use, trying ${nextPort}...`);
          startServer(nextPort, attempt + 1);
        } else {
          const msg = err.code === 'EADDRINUSE'
            ? `Could not find a free port in range ${PORT}–${PORT + maxPortAttempts}.`
            : `Server error: ${err.message}`;
          console.error(msg);
          process.exit(1);
        }
      });
    }

    startServer(Number(PORT));
  })
  .catch(e => {
    console.error('Fatal startup error:', e.message);
    process.exit(1);
  });
