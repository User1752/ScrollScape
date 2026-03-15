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
 *   server/routes/local.js         — local manga (CBZ/CBR/PDF) import + reader
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
const LOCAL_DIR        = path.join(DATA_DIR, 'local');
const TMP_DIR          = path.join(DATA_DIR, 'tmp');
const PORT             = process.env.PORT || 3000;

// ── Configure submodules ─────────────────────────────────────────────────────
// Modules must be configured with path constants BEFORE routes are registered.

const storeModule = require('./server/store');
storeModule.configure(STORE_PATH);

const sourceLoader = require('./server/sourceLoader');
sourceLoader.configure({ sourcesDir: SOURCES_DIR, snapSourcesDir: SNAP_SOURCES_DIR, isPkg: IS_PKG });

const localRoutes = require('./server/routes/local');
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 500 * 1024 * 1024 } });
localRoutes.configure({ localDir: LOCAL_DIR, upload });

// ── Express application ──────────────────────────────────────────────────────
const app = express();
app.use(compression());                   // gzip all responses
app.use(express.json({ limit: '5mb' })); // parse JSON bodies

// ── Security middleware ───────────────────────────────────────────────────────
const { applySecurityHeaders, rateLimiter } = require('./server/middleware/security');
applySecurityHeaders(app);
// Rate-limit API endpoints: 600 requests / 10 minutes per IP.
// Static assets are excluded so the UI loads without restriction.
app.use('/api', rateLimiter(600_000, 600));

// ── Route registration ────────────────────────────────────────────────────────
// ORDER MATTERS:
//  • /api/source/local/* (virtual source) must be registered BEFORE the
//    generic /api/source/:id/:method handler or the "local" ID matches the
//    generic pattern and is passed to loadSourceFromFile, which throws.
//  • Static files are always last so they never shadow API routes.
const { registerProxyRoutes }        = require('./server/routes/proxy');
const { registerRepoRoutes }         = require('./server/routes/repos');
const { registerLocalRoutes }        = require('./server/routes/local');   // ← before sources
const { registerSourceRoutes }       = require('./server/routes/sources');
const { registerLibraryRoutes }      = require('./server/routes/library');
const { registerDownloadRoutes }     = require('./server/routes/downloads');
const { registerReviewRoutes }       = require('./server/routes/reviews');
const { registerListRoutes }         = require('./server/routes/lists');
const { registerAnalyticsRoutes }    = require('./server/routes/analytics');
const { registerAchievementRoutes }  = require('./server/routes/achievements');
const { registerMangaUpdatesRoutes } = require('./server/routes/mangaupdates');
const { registerCalendarRoutes }     = require('./server/routes/calendar');

registerProxyRoutes(app);
registerRepoRoutes(app);
registerLocalRoutes(app);
registerSourceRoutes(app);
registerLibraryRoutes(app);
registerDownloadRoutes(app);
registerReviewRoutes(app);
registerListRoutes(app);
registerAnalyticsRoutes(app);
registerAchievementRoutes(app);
registerMangaUpdatesRoutes(app);
registerCalendarRoutes(app);

// ── Static file serving ───────────────────────────────────────────────────────
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

// ── Startup helpers ───────────────────────────────────────────────────────────

/**
 * Creates required directories and initialises a blank store.json if absent.
 */
async function ensureDirs() {
  for (const dir of [DATA_DIR, SOURCES_DIR, CACHE_DIR, LOCAL_DIR, TMP_DIR]) {
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
  switch (process.platform) {
    case 'win32':  exec(`start ${url}`);    break;
    case 'darwin': exec(`open ${url}`);     break;
    default:       exec(`xdg-open ${url}`); break; // Linux & Android (Termux)
  }
}

// ── Bootstrap sequence ────────────────────────────────────────────────────────
ensureDirs()
  .then(() => storeModule.initStore())
  .then(() => sourceLoader.autoInstallLocalSources())
  .then(() => {
    // Standalone exe: bind only to loopback — never reachable from outside.
    // Docker / Termux / server: bind to all interfaces for port-mapping.
    const host = IS_PKG ? '127.0.0.1' : '0.0.0.0';
    app.listen(PORT, host, () => {
      console.log(`🎌 ScrollScape running on http://localhost:${PORT}`);
      console.log(`📚 Sources auto-installed!`);
      if (IS_PKG) openBrowser(`http://localhost:${PORT}`);
    });
  })
  .catch(e => {
    console.error('Fatal startup error:', e);
    process.exit(1);
  });
