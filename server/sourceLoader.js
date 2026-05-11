/**
 * sourceLoader.js — Loading, caching, and validation of manga source modules
 *
 * Sources are Node.js CommonJS modules dropped into SOURCES_DIR.  When bundled
 * as a standalone exe (pkg) a snapshot copy lives in SNAP_SOURCES_DIR; the
 * user-filesystem version always takes priority so scrapers can be updated
 * without rebuilding the exe.
 *
 * Security notes:
 *  • Path confinement: resolved paths are checked against the expected
 *    directory prefix before fs operations (directory traversal prevention).
 *  • Module interface validation: after require() we assert that the module
 *    exports the four required functions (search / mangaDetails / chapters /
 *    pages) and a valid meta.id field.  Missing exports abort early rather
 *    than letting callers hit a runtime "not a function" error.
 *  • Module cache invalidation: the require() cache is cleared before each
 *    fresh load so that a newly-dropped .js file is picked up immediately,
 *    and stale code is never served after an uninstall.
 *
 * Exports:
 *   configure(opts)          — Set SOURCES_DIR, SNAP_SOURCES_DIR, IS_PKG
 *   sourcePath(id)           — Resolve + confine the filesystem path for a source
 *   loadSourceFromFile(id)   — Load (and cache) a source module by ID
 *   clearSourceCache(id?)    — Evict one source (or all) from the module cache
 *   detectRepoKind(data)     — Detect "jsrepo" | "tachiyomi" | "unknown"
 *   getRepoDataWithCache(r)  — Fetch repo JSON with a 1 h in-process TTL
 *   listAvailableSourcesFromRepos(repos) — Enumerate installable sources
 *   autoInstallLocalSources()            — Register on-disk sources in the store
 */

'use strict';

const fs   = require('fs');
const { safeId, fetchJson } = require('./helpers');
const { readStore, writeStore } = require('./store');
const { createSourceLoaderCore } = require('./modules/source-loader/core');

const sourceLoaderCore = createSourceLoaderCore({
  safeId,
  fetchJson,
  readStore,
  writeStore,
});

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * @param {{ sourcesDir: string, snapSourcesDir: string, isPkg: boolean }} opts
 */
function configure(opts) {
  sourceLoaderCore.configure(opts);
}

// ── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Resolves the filesystem path for a source file, preferring the user-writable
 * directory over the bundled snapshot.
 *
 * Raises a path-traversal error if the resolved path escapes its parent dir.
 *
 * @param {string} id  A validated source ID (alphanumeric + hyphen/underscore)
 * @returns {string}   Absolute path (may not exist yet for install flows)
 */
function sourcePath(id) {
  return sourceLoaderCore.sourcePath(id);
}

// ── Module loading ───────────────────────────────────────────────────────────

/**
 * Loads and validates a source module, returning the cached copy on subsequent
 * calls.  Throws with a descriptive message if the module is missing, fails to
 * load, or does not export the required contract.
 *
 * @param {string} id
 * @returns {object}  The source module
 */
function loadSourceFromFile(id) {
  return sourceLoaderCore.loadSourceFromFile(id);
}

/**
 * Evicts a source (or all sources) from the in-process module cache.
 *
 * @param {string} [id]  If omitted, clears the entire cache.
 */
function clearSourceCache(id) {
  return sourceLoaderCore.clearSourceCache(id);
}

// ── Repo helpers ─────────────────────────────────────────────────────────────

/**
 * Detects the format of a fetched repo manifest.
 *
 * @param {unknown} data
 * @returns {'jsrepo'|'tachiyomi'|'unknown'}
 */
function detectRepoKind(data) {
  return sourceLoaderCore.detectRepoKind(data);
}

/**
 * Fetches a repo manifest with a 1-hour in-process TTL.
 * Falls back to the previous cached copy on network error.
 *
 * @param {{ url: string }} repo
 * @param {number} [ttl=3600000]  Cache TTL in ms (default 1 h)
 * @returns {Promise<object>}
 */
async function getRepoDataWithCache(repo, ttl = 3_600_000) {
  return sourceLoaderCore.getRepoDataWithCache(repo, ttl);
}

/**
 * Enumerates all installable JS sources from the given array of repos.
 *
 * @param {object[]} repos
 * @returns {Promise<object[]>}
 */
async function listAvailableSourcesFromRepos(repos) {
  return sourceLoaderCore.listAvailableSourcesFromRepos(repos);
}

/**
 * Scans SOURCES_DIR (and SNAP_SOURCES_DIR for pkg builds) and registers any
 * unregistered .js files as installed sources in the store.
 *
 * This enables "just drop a file" installation without going through the UI.
 */
async function autoInstallLocalSources() {
  return sourceLoaderCore.autoInstallLocalSources();
}

/**
 * Bundled sources live in the pkg snapshot as bytecode ("scripts").
 * sourcePath() already falls back to the snapshot path when no real-FS file exists,
 * so require(snapPath) loads them correctly — no need to copy anything to disk.
 * User-installed sources are downloaded directly to SOURCES_DIR by the install route.
 */
function seedSourcesFromSnapshot() {
  // intentionally empty — seeding is not needed and causes problems
  // (copying snapshot bytecode to disk makes require(realPath) fail)
}

module.exports = {
  configure,
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  detectRepoKind,
  getRepoDataWithCache,
  listAvailableSourcesFromRepos,
  autoInstallLocalSources,
  seedSourcesFromSnapshot,
};
