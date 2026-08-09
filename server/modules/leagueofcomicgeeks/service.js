/**
 * leagueofcomicgeeks/service.js — Fallback cover/publisher lookup for Western
 * comics (e.g. BatCave) against League of Comic Geeks, used only when
 * ComicVine (the primary source) has no confident match.
 *
 * LOCG has no public API, so this scrapes its search results page. Unlike
 * ComicVine, LOCG sits behind Cloudflare, so requests go through fetchText()
 * — the same FlareSolverr-backed helper BatCave itself uses — which
 * transparently solves the challenge once per domain and reuses the session
 * cookie for subsequent lookups.
 *
 * Matching carries the same risk as the ComicVine lookup (a mismatch would
 * silently attach the WRONG comic's cover), so it reuses the exact same
 * exact-name + year-disambiguation rule — see comics-metadata/title-matching.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const cheerio = require('cheerio');
const { fetchText } = require('../network/fetch-utils');
const { parseTitle, pickBestMatch } = require('../comics-metadata/title-matching');
const { withTimeout } = require('../common/async-utils');
const { LOCG_REQUEST_FAILED } = require('../errors/error-codes');
const { recordError } = require('../error-logger');

const SEARCH_URL = 'https://leagueofcomicgeeks.com/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // cover/publisher data rarely changes
const SAVE_DEBOUNCE_MS = 2_000;

// fetchText() here goes through FlareSolverr (LOCG sits behind Cloudflare),
// and a cold solve can take ~15-20s — unlike ComicVine's plain API call,
// which is already safely bounded by its own 10s REQUEST_TIMEOUT_MS. Without
// a cap here, a cold lookup plus BatCave's own page fetch can together
// exceed the app's global 30s API timeout (limits.sourceCallTimeoutMs) and
// fail the whole search instead of just this optional enrichment step.
// Giving up early and returning null (BatCave's own cover) is always safe;
// the FlareSolverr session still finishes warming up in the background, so
// the next lookup is fast.
const LOOKUP_TIMEOUT_MS = 12_000;

const cache = new Map();
let cacheFilePath = null;
let cacheLoaded = false;
let saveTimer = null;

/**
 * @param {{ cacheFilePath: string }} options
 */
function configure({ cacheFilePath: filePath } = {}) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid cacheFilePath provided to leagueofcomicgeeks.configure()');
  }
  cacheFilePath = filePath;
}

// Same rationale as comicvine/service.js: restarts are frequent during
// development, and every lookup here also costs a lot more than a ComicVine
// call when it can't reuse a warm FlareSolverr session — persisting to disk
// keeps that cost from being repaid on every restart.
async function ensureCacheLoaded() {
  if (cacheLoaded || !cacheFilePath) return;
  cacheLoaded = true;
  try {
    const raw = await fsp.readFile(cacheFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [key, entry] of Object.entries(parsed)) {
      cache.set(key, entry);
    }
  } catch {
    // No cache file yet (first run) or it's unreadable — start fresh.
  }
}

function scheduleCacheSave() {
  if (!cacheFilePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      const tmpPath = `${cacheFilePath}.tmp`;
      await fsp.writeFile(tmpPath, JSON.stringify(Object.fromEntries(cache)), 'utf8');
      await fsp.rename(tmpPath, cacheFilePath);
    } catch (_) {
      // Best-effort — worst case we just re-fetch a few titles next time.
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Parses LOCG's /search results page into series-level candidates.
 * Each result <li> carries the series title/link, a cover <img> (lazy-loaded
 * via data-src, falling back to src for already-loaded images), and a
 * "Publisher · Year[ - Year|- Present]" meta line.
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const candidates = [];

  $('li').each((_, el) => {
    const titleLink = $(el).find('.title a.link-collection-series').first();
    if (!titleLink.length) return;
    const name = titleLink.text().replace(/\s+/g, ' ').trim();
    if (!name) return;

    const img = $(el).find('.cover img').first();
    const cover = img.attr('data-src') || img.attr('src') || '';

    const metaText = $(el).find('.copy-really-small').first().text().replace(/\s+/g, ' ').trim();
    const metaMatch = metaText.match(/^(.+?)\s*·\s*(\d{4})/);

    candidates.push({
      name,
      cover,
      publisher: metaMatch ? metaMatch[1].trim() : '',
      year: metaMatch ? Number(metaMatch[2]) : null,
    });
  });

  return candidates;
}

/**
 * Looks up a comic series on League of Comic Geeks by title.
 *
 * @param {{ title: string, year?: number }} args `year`, when given,
 *   overrides whatever parseTitle() would otherwise guess from the title
 *   string itself — see comicvine/service.js's lookupCover for why.
 * @returns {Promise<{ cover: string, publisher: string } | null>}
 *   null when lookup fails or has no confident match.
 */
async function lookupCover({ title, year: explicitYear } = {}) {
  const { cleanTitle, year: titleYear } = parseTitle(title);
  const year = explicitYear ?? titleYear;
  if (!cleanTitle) return null;

  await ensureCacheLoaded();

  const cacheKey = `${cleanTitle.toLowerCase()}|${year || ''}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = `${SEARCH_URL}?keyword=${encodeURIComponent(cleanTitle)}`;
    const html = await withTimeout(fetchText(url), LOOKUP_TIMEOUT_MS, `LOCG lookup exceeded ${LOOKUP_TIMEOUT_MS}ms`);
    const candidates = parseSearchResults(html);

    const match = pickBestMatch(candidates, cleanTitle, year, c => c.name, c => c.year);
    const cover = match && /^https?:\/\//.test(match.cover) ? match.cover : '';
    const result = cover ? { cover, publisher: match.publisher || '' } : null;

    cache.set(cacheKey, { value: result, at: Date.now() });
    scheduleCacheSave();
    return result;
  } catch (err) {
    await recordError({
      code: LOCG_REQUEST_FAILED,
      area: 'leagueofcomicgeeks',
      message: err.message,
      details: { title: cleanTitle },
    }).catch(() => {});
    return null;
  }
}

module.exports = { configure, lookupCover };
