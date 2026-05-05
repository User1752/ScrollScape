/**
 * store.js — In-memory store cache backed by disk persistence
 *
 * Refactored for:
 *  • Atomic writes: using a .tmp file and fs.rename/renameSync to prevent corruption on power loss.
 *  • Maintainability: cleaner event hooks and bounded flush logic.
 *  • Security: strict path configurations, safer parsing, and default state generation.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;

let STORE_PATH = null;
let _store = null;
let _flushTimer = null;
let _isShuttingDown = false; // Flag to prevent duplicate flushes during termination

// ── Public API ───────────────────────────────────────────────────────────────

function configure(storePath) {
  if (!storePath || typeof storePath !== 'string') {
    throw new Error('Invalid storePath provided to store.configure()');
  }
  STORE_PATH = storePath;
}

async function readStore() {
  if (!_store) {
    if (!STORE_PATH) throw new Error('Store accessed before configure() was called.');
    const raw = await fsp.readFile(STORE_PATH, 'utf8');
    _store = JSON.parse(raw);
    normaliseStore(_store);
  }
  return _store;
}

async function writeStore(store) {
  _store = store; // Synchronous in-memory update allows concurrent reads to see fresh state immediately
  _queueDebouncedFlush();
}

async function initStore() {
  if (!STORE_PATH) throw new Error('Store initialized before configure() was called.');
  if (!fs.existsSync(STORE_PATH)) return;

  try {
    const raw = await fsp.readFile(STORE_PATH, 'utf8');
    _store = JSON.parse(raw);
  } catch (e) {
    console.error(`[Store] Initialization failed: ${e.message}. Starting fresh.`);
    _store = {};
  }
  
  normaliseStore(_store);
}

function flushStoreSync() {
  if (!_store || _isShuttingDown || !STORE_PATH) return;
  _isShuttingDown = true; // Lock further async writes/flushes
  
  try {
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(_store, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH); // Safe atomic replacement
  } catch (e) {
    console.error(`[Store] Shutdown flush error: ${e.message}`);
  }
}

function normaliseStore(s) {
  if (!s || typeof s !== 'object') return;

  s.repos = Array.isArray(s.repos)
    ? s.repos.map(r => ({ ...r, kind: r.kind || 'jsrepo', name: r.name || r.url }))
    : [];

  s.installedSources = s.installedSources || {};
  s.history          = s.history || [];
  s.favorites        = s.favorites || [];
  s.readingStatus    = s.readingStatus || {};
  s.reviews          = s.reviews || {};
  s.customLists      = Array.isArray(s.customLists) ? s.customLists : [];
  s.achievements     = Array.isArray(s.achievements) ? s.achievements : [];

  // AniList import metadata
  s.anilistSync = s.anilistSync || {
    lastImportAt:   null,
    importedCount:  0,
    overwriteCount: 0,
    skippedCount:   0,
    failedCount:    0,
  };

  s.analytics = s.analytics || {
    totalChaptersRead: 0,
    totalTimeSpent:    0,
    readingSessions:   [],
    dailyStreak:       0,
    lastReadDate:      null,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function _queueDebouncedFlush() {
  if (_flushTimer) clearTimeout(_flushTimer);
  if (_isShuttingDown) return;

  _flushTimer = setTimeout(async () => {
    _flushTimer = null;
    if (_isShuttingDown || !_store || !STORE_PATH) return;

    const tmpPath = `${STORE_PATH}.tmp`;
    try {
      await fsp.writeFile(tmpPath, JSON.stringify(_store, null, 2), 'utf8');
      await fsp.rename(tmpPath, STORE_PATH); // Atomic overlay prevents truncation bugs
    } catch (e) {
      console.error(`[Store] Async write error: ${e.message}`);
    }
  }, 300);
}

// Graceful shutdown hooks
function handleTermination() {
  flushStoreSync();
  process.exit(0);
}

process.on('SIGINT', handleTermination);
process.on('SIGTERM', handleTermination);

module.exports = {
  configure,
  readStore,
  writeStore,
  initStore,
  flushStoreSync,
  normaliseStore
};
