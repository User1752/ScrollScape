/**
 * comicvine/service.js — Optional cover/publisher lookup for Western comics
 * (e.g. BatCave) against the ComicVine database.
 *
 * ComicVine is comics-specific (not manga), so it's a much better source of
 * real cover art and publisher data than most manga-site scrapers, but a
 * title search across two different databases is inherently fuzzy — a
 * mismatch would silently attach the WRONG comic's cover. To keep that safe:
 *
 *  - only a case/punctuation-insensitive EXACT name match is used, never a
 *    "starts with" or partial match;
 *  - when a series title has a year (e.g. "(2026-)"), it's used to pick
 *    between same-named volumes rather than assuming the first result;
 *  - any failure (missing API key, network error, no confident match) simply
 *    returns null so the caller keeps whatever cover it already had.
 */

'use strict';

const { COMICVINE_REQUEST_FAILED } = require('../errors/error-codes');
const { recordError } = require('../error-logger');
const { parseTitle, pickBestMatch } = require('../comics-metadata/title-matching');
const { createTtlDiskCache } = require('../common/ttl-disk-cache');

const SEARCH_URL = 'https://comicvine.gamespot.com/api/search/';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // cover/publisher data rarely changes
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000; // ComicVine's own window is ~1h; this just stops us digging the hole deeper
const SAVE_DEBOUNCE_MS = 2_000;

const ttlCache = createTtlDiskCache({ saveDebounceMs: SAVE_DEBOUNCE_MS });
let rateLimitedUntil = 0;
// Only needed for getApiKey() below. Defaults to this project's own store,
// same lazy-fallback pattern as network/fetch-utils.js — keeps every
// existing caller working unconfigured, while letting this module (a
// self-contained "look up a comic's cover on ComicVine" service, otherwise
// unrelated to ScrollScape's own store shape) be pointed at a different
// store if it's ever reused elsewhere.
let _readStore = null;

/**
 * @param {{ cacheFilePath: string, readStore?: Function }} options
 */
function configure({ cacheFilePath, readStore } = {}) {
  ttlCache.configure({ cacheFilePath });
  if (typeof readStore === 'function') _readStore = readStore;
}

async function getApiKey() {
  try {
    if (!_readStore) _readStore = require('../../store').readStore;
    const store = await _readStore();
    return String(store?.settings?.comicVineApiKey || '').trim();
  } catch {
    return '';
  }
}

function pickImageUrl(volume) {
  const image = volume?.image;
  return image?.medium_url || image?.small_url || image?.original_url || '';
}

/**
 * Looks up a comic series on ComicVine by title.
 *
 * @param {{ title: string, year?: number }} args `year`, when given,
 *   overrides whatever parseTitle() would otherwise guess from the title
 *   string itself — useful when the caller has a more reliable year from
 *   elsewhere (e.g. BatCave's own page metadata for titles like "Crossed"
 *   that carry no year in their display title at all).
 * @returns {Promise<{ cover: string, publisher: string } | null>}
 *   null when lookup is disabled, fails, or has no confident match.
 */
async function lookupCover({ title, year: explicitYear } = {}) {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const { cleanTitle, year: titleYear } = parseTitle(title);
  const year = explicitYear ?? titleYear;
  if (!cleanTitle) return null;

  await ttlCache.ensureLoaded();

  const cacheKey = `${cleanTitle.toLowerCase()}|${year || ''}`;
  const cached = ttlCache.getFresh(cacheKey, CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  // A burst of lookups (a full page of search/browse results, each on its
  // own request) can exhaust ComicVine's hourly quota fast. Once that
  // happens, every further attempt would just fail anyway — skip the
  // network round-trip entirely for a while instead of hammering an API
  // that's already telling us to back off.
  if (Date.now() < rateLimitedUntil) return null;

  try {
    // A generous limit matters here: for a common title like "Batman" (2215
    // total ComicVine volumes share that exact name), the one same-year
    // volume that disambiguates it correctly can rank well outside the top
    // 25 by relevance — confirmed in testing: DC's own "Batman (2025)" sat
    // at position 42. 100 is ComicVine's own per-request max.
    const url = `${SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}` +
      `&format=json&resources=volume&limit=100` +
      `&query=${encodeURIComponent(cleanTitle)}`;

    const data = await fetchJsonWithUserAgent(url);

    if (data?.status_code !== 1 || !Array.isArray(data?.results)) {
      return null;
    }

    const match = pickBestMatch(data.results, cleanTitle, year, r => r?.name, r => r?.start_year);
    const cover = match ? pickImageUrl(match) : '';
    const result = cover
      ? { cover, publisher: match?.publisher?.name || '' }
      : null;

    ttlCache.set(cacheKey, result);
    return result;
  } catch (err) {
    await recordError({
      code: COMICVINE_REQUEST_FAILED,
      area: 'comicvine',
      message: err.message,
      details: { title: cleanTitle },
    }).catch(() => {});
    return null;
  }
}

// ComicVine requires a descriptive User-Agent and rejects generic/default
// ones — fetchJson() doesn't send custom headers, so this uses fetch
// directly with the same timeout convention as the rest of the app.
async function fetchJsonWithUserAgent(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ScrollScape/1.0 (+https://github.com/User1752/ScrollScape)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // ComicVine's rate-limit response ("...a tad bit gluttonous don't you
  // think?") comes back as HTTP 420. Stop trying for a while rather than
  // let every subsequent lookup this hour fail one at a time.
  if (res.status === 420) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    throw new Error('ComicVine rate limit reached');
  }
  if (!res.ok) throw new Error(`ComicVine HTTP ${res.status}`);
  return res.json();
}

module.exports = { configure, lookupCover };
