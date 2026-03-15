/**
 * routes/calendar.js — Release-calendar endpoint
 *
 * GET /api/calendar?year=YYYY&month=MM
 *
 * Strategy (identical to Mihon "Upcoming"):
 *   Fetch the last 60 days of chapters for each library manga from MangaDex,
 *   compute the MEDIAN interval between consecutive releases, then project
 *   forward from the most-recent chapter to predict the next release dates.
 *
 *   - Chapters that already released this month  → predicted:false (exact date)
 *   - Future dates derived from the interval     → predicted:true  (estimated)
 *
 *   Non-MangaDex manga are resolved to a MangaDex UUID via title search
 *   (cached per process) so the same interval logic applies universally.
 *
 *   Manga that produced no calendar entries appear in `noSchedule`.
 *
 * Security:
 *   • year/month validated as finite integers in safe ranges.
 *   • UUID format validated before URL interpolation.
 *   • All external fetches are time-boxed with AbortSignal.timeout.
 */

'use strict';

const { readStore }        = require('../store');
const { loadSourceFromFile } = require('../sourceLoader');

const EXCLUDED_USER_STATUSES = new Set(['completed', 'on_hold', 'dropped']);
const RELEASING_STATUSES = new Set([
  'ongoing', 'publishing', 'releasing', 'serializing', 'new', 'active', 'in progress',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MD_TIMEOUT_MS      = 20_000;
const DAY_MS             = 86_400_000;
const CHAPTERS_PER_FEED  = 96;   // history window for interval calculation
const MAX_INTERVALS      = 8;    // use only the most recent N intervals
const MAX_PREDICTIONS    = 8;
const MIN_INTERVAL_HOURS = 12;   // ignore gaps < 12 h (duplicate/batch uploads)

const _titleCache     = new Map();  // title → MangaDex UUID | null
const _sourceChapCache = new Map(); // `${sourceId}:${id}` → { num, ts }
const SOURCE_CHAP_TTL  = 30 * 60_000; // 30 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return the latest chapter number reported by the manga's own source.
 * Cached for SOURCE_CHAP_TTL per manga to avoid repeated scraping.
 */
async function fetchSourceLatestChapNum(manga) {
  const cacheKey = `${manga.sourceId}:${manga.id}`;
  const cached = _sourceChapCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < SOURCE_CHAP_TTL) return cached.num;
  try {
    const src = loadSourceFromFile(manga.sourceId);
    const result = await Promise.race([
      src.chapters(manga.id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
    ]);
    const chaps = result?.chapters || [];
    if (!chaps.length) { _sourceChapCache.set(cacheKey, { num: null, ts: Date.now() }); return null; }
    const raw   = String(chaps[0]?.chapter || chaps[0]?.name || '');
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    const num   = match ? parseFloat(match[1]) : null;
    _sourceChapCache.set(cacheKey, { num, ts: Date.now() });
    return num;
  } catch (err) {
    console.error('[calendar] source chap error:', manga.title, err.message);
    _sourceChapCache.set(cacheKey, { num: null, ts: Date.now() });
    return null;
  }
}

async function resolveMangaDexId(title) {
  const key = title.trim().toLowerCase();
  if (_titleCache.has(key)) return _titleCache.get(key);
  try {
    const params = new URLSearchParams({ title: title.trim().slice(0, 100), limit: '10', 'order[relevance]': 'desc' });
    for (const r of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', r);
    const res = await fetch(`https://api.mangadex.org/manga?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { _titleCache.set(key, null); return null; }
    const json    = await res.json();
    const results = json.data || [];
    if (!results.length) { _titleCache.set(key, null); return null; }
    let bestId = results[0].id;
    for (const manga of results) {
      const all = [
        ...Object.values(manga.attributes.title || {}),
        ...(manga.attributes.altTitles || []).flatMap(a => Object.values(a)),
      ].map(t => t.trim().toLowerCase());
      if (all.includes(key)) { bestId = manga.id; break; }
    }
    _titleCache.set(key, bestId);
    return bestId;
  } catch (err) {
    console.error('[calendar] resolve error:', title, err.message);
    _titleCache.set(key, null);
    return null;
  }
}

/**
 * Fetch recent chapters for multiple MangaDex UUIDs in parallel.
 * Each manga gets its own /manga/{id}/feed call, all fired simultaneously.
 * Returns a Map<uuid, [{date, chapter, id}]> sorted ascending per manga.
 */
async function fetchBatchMangaChapters(uuids) {
  const results = await Promise.all(uuids.map(async (uuid) => {
    try {
      const params = new URLSearchParams({
        limit:               String(CHAPTERS_PER_FEED),
        'order[publishAt]':  'desc',
        includeExternalUrl:  '0',
      });
      for (const r of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', r);

      const res = await fetch(
        `https://api.mangadex.org/manga/${encodeURIComponent(uuid)}/feed?${params}`,
        { signal: AbortSignal.timeout(MD_TIMEOUT_MS) }
      );
      if (!res.ok) return { uuid, chapters: [] };
      const data = await res.json();
      const chapters = (data.data || [])
        .map(ch => ({
          date:    new Date(ch.attributes.publishAt || ch.attributes.readableAt || 0),
          chapter: String(ch.attributes.chapter || '?').trim().slice(0, 20),
          id:      ch.id,
        }))
        .filter(c => !isNaN(c.date.getTime()) && c.date.getTime() > 0)
        .sort((a, b) => a.date - b.date);
      return { uuid, chapters };
    } catch (err) {
      console.error('[calendar] feed error:', uuid, err.message);
      return { uuid, chapters: [] };
    }
  }));
  return new Map(results.map(r => [r.uuid, r.chapters]));
}

/**
 * Deterministic hash of a string → unsigned 32-bit integer.
 * Same seed always produces the same number, so predictions are stable
 * across requests (no Math.random).
 */
function seededHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Classify cadence and compute confidence from a set of intervals (in ms).
 * Uses the last MAX_INTERVALS intervals only.
 */
function analyseIntervals(allIntervals) {
  const recent = allIntervals.slice(-MAX_INTERVALS);
  if (!recent.length) return { intervalMs: null, cadence: 'irregular', confidence: 'low' };

  const intervalMs = median(recent);

  // Cadence classification by scoring
  const DAY = 86_400_000;
  let scoreWeekly = 0, scoreBiweekly = 0, scoreMonthly = 0;
  for (const ms of recent) {
    const d = ms / DAY;
    if (d >= 6  && d <= 8)  scoreWeekly++;
    if (d >= 12 && d <= 16) scoreBiweekly++;
    if (d >= 26 && d <= 35) scoreMonthly++;
  }
  const threshold = Math.ceil(recent.length * 0.6);
  let cadence = 'irregular';
  if      (scoreWeekly    >= threshold) cadence = 'weekly';
  else if (scoreBiweekly  >= threshold) cadence = 'biweekly';
  else if (scoreMonthly   >= threshold) cadence = 'monthly';

  // Confidence based on standard deviation of recent intervals
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const stdDev = Math.sqrt(recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length);
  const stdDevDays = stdDev / DAY;
  let confidence = stdDevDays <= 1 ? 'high' : stdDevDays <= 4 ? 'medium' : 'low';
  if (cadence === 'irregular') confidence = 'low';

  return { intervalMs, cadence, confidence };
}

// ── Route ─────────────────────────────────────────────────────────────────────

function registerCalendarRoutes(router) {
  router.get('/api/calendar', async (req, res) => {
    try {
      const now   = new Date();
      const year  = parseInt(req.query.year,  10) || now.getFullYear();
      const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

      if (!Number.isFinite(year) || year < 2000 || year > 2100 ||
          !Number.isFinite(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid year or month' });
      }

      const store         = await readStore();
      const favorites     = store.favorites     || [];
      const readingStatus = store.readingStatus || {};

      const releasing = favorites.filter(m => {
        const userStatus = readingStatus[`${m.id}:${m.sourceId}`]?.status;
        if (EXCLUDED_USER_STATUSES.has(userStatus)) return false;
        const pub = (m.status || '').toLowerCase().trim();
        return pub === '' || RELEASING_STATUSES.has(pub);
      });

      const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
      const monthEndDate   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      const MIN_MS         = MIN_INTERVAL_HOURS * 3_600_000;
      const days           = {};

      // ── 1. Resolve all MangaDex UUIDs in parallel ────────────────────────────
      const resolved = await Promise.all(
        releasing.map(async (manga) => {
          const mdId = (manga.sourceId === 'mangadex' && UUID_RE.test(manga.id))
            ? manga.id
            : await resolveMangaDexId(manga.title);
          return { manga, mdId };
        })
      );
      const valid = resolved.filter(e => e.mdId !== null);

      // ── 2. One batch chapter call + all source chapter lookups in parallel ───
      const [chaptersMap, sourceChapResults] = await Promise.all([
        fetchBatchMangaChapters(valid.map(e => e.mdId)),
        Promise.all(valid.map(({ manga }) =>
          manga.sourceId !== 'mangadex'
            ? fetchSourceLatestChapNum(manga)
            : Promise.resolve(null)
        )),
      ]);

      // ── 3. Build calendar days ────────────────────────────────────────────────
      for (let i = 0; i < valid.length; i++) {
        const { manga, mdId } = valid[i];
        const dated           = chaptersMap.get(mdId) || [];
        const sourceLatestChap = sourceChapResults[i];

        if (!dated.length) continue;

        // ── Compute chapter offset to correct MangaDex's stale numbers ─────────
        // e.g. MangaDex has ch.1077 but MangaPill has ch.1148 → offset = +71
        const mdLastChapNum = parseFloat(dated[dated.length - 1].chapter);
        let chapOffset = 0;
        if (sourceLatestChap !== null && isFinite(sourceLatestChap) &&
            isFinite(mdLastChapNum) && sourceLatestChap > mdLastChapNum) {
          chapOffset = Math.round(sourceLatestChap - mdLastChapNum);
        }

        // ── Actual releases this month ────────────────────────────────────────
        const applyOffset = (chapStr) => {
          if (!chapOffset) return chapStr;
          const n = parseFloat(chapStr);
          return isFinite(n) ? String(Math.round(n + chapOffset)) : chapStr;
        };

        const actualByDay = new Map();
        for (const c of dated) {
          if (c.date < monthStartDate || c.date > monthEndDate) continue;
          const day = c.date.getUTCDate();
          // Keep the highest chapter number if multiple uploaded same day
          if (!actualByDay.has(day) || parseFloat(c.chapter) > parseFloat(actualByDay.get(day).chapter)) {
            actualByDay.set(day, c);
          }
        }
        for (const [day, c] of actualByDay) {
          if (!days[day]) days[day] = [];
          if (!days[day].some(e => e.manga?.id === manga.id)) {
            days[day].push({
              chapterId: c.id,
              chapter:   applyOffset(c.chapter),
              publishAt: c.date.toISOString(),
              predicted: false,
              manga: { id: manga.id, title: manga.title, cover: manga.cover, sourceId: manga.sourceId },
            });
          }
        }

        // ── Interval analysis (last 8, mediana + confidence) ─────────────────
        const intervals = [];
        for (let j = 1; j < dated.length; j++) {
          const diff = dated[j].date - dated[j - 1].date;
          if (diff >= MIN_MS) intervals.push(diff);
        }
        const { intervalMs, cadence, confidence } = analyseIntervals(intervals);
        if (!intervalMs || intervalMs <= 0) continue;

        const lastEntry   = dated[dated.length - 1];
        const lastChapNum = isFinite(mdLastChapNum) ? mdLastChapNum + chapOffset : NaN;
        let   nextDate    = new Date(lastEntry.date.getTime() + intervalMs);

        // Count how many steps until we enter the requested month
        let predOffset = 0;
        while (nextDate < monthStartDate) {
          predOffset++;
          nextDate = new Date(nextDate.getTime() + intervalMs);
        }

        let count = 0;
        // Jitter range per cadence so predictions feel organic, not robotic
        const jitterRange = cadence === 'weekly' ? 1 : cadence === 'biweekly' ? 2 : cadence === 'monthly' ? 4 : 3;
        // Break probability: ~20% for low, ~10% for medium, 0% for high
        const breakMod    = confidence === 'low' ? 5 : confidence === 'medium' ? 10 : 0;

        while (nextDate <= monthEndDate && count < MAX_PREDICTIONS) {
          predOffset++;
          const seed = `${manga.id}:${predOffset}`;

          // Occasional simulated break (deterministic)
          if (breakMod > 0 && seededHash(seed + ':break') % breakMod === 0) {
            nextDate = new Date(nextDate.getTime() + intervalMs);
            continue;
          }

          // Small date jitter to look organic (e.g. ±1 day for weekly)
          const jitterDays = (seededHash(seed + ':jitter') % (2 * jitterRange + 1)) - jitterRange;
          const displayDate = new Date(nextDate.getTime() + jitterDays * DAY_MS);
          if (displayDate < monthStartDate || displayDate > monthEndDate) {
            nextDate = new Date(nextDate.getTime() + intervalMs);
            continue;
          }

          const day = displayDate.getUTCDate();
          if (!actualByDay.has(day)) {
            if (!days[day]) days[day] = [];
            if (!days[day].some(e => e.manga?.id === manga.id)) {
              // Chapter increments by 1 per prediction placed (not per interval skipped)
              const chapNum = isFinite(lastChapNum)
                ? String(Math.round(lastChapNum + count + 1))
                : (sourceLatestChap ? String(Math.round(sourceLatestChap + count + 1)) : null);
              days[day].push({
                chapterId:  null,
                chapter:    chapNum || '~',
                publishAt:  displayDate.toISOString(),
                predicted:  true,
                cadence,
                confidence,
                manga: { id: manga.id, title: manga.title, cover: manga.cover, sourceId: manga.sourceId },
              });
              count++;
            }
          }
          nextDate = new Date(nextDate.getTime() + intervalMs);
        }
      }

      // ── noSchedule: releasing manga with zero calendar entries ──────────────
      const coveredIds = new Set();
      for (const entries of Object.values(days)) for (const e of entries) if (e.manga?.id) coveredIds.add(e.manga.id);

      const noSchedule = releasing
        .filter(m => !coveredIds.has(m.id))
        .map(m => ({ id: m.id, title: m.title, cover: m.cover, status: m.status, sourceId: m.sourceId }));

      res.json({ year, month, days, noSchedule, releasingCount: releasing.length });
    } catch (e) {
      console.error('[calendar] unhandled error:', e);
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerCalendarRoutes };
