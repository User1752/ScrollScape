'use strict';

const CHAPTERS_PER_FEED = 96;
const MAX_INTERVALS = 8;

const EXCLUDED_USER_STATUSES = new Set(['completed', 'on_hold', 'dropped']);
const RELEASING_STATUSES = new Set([
  'ongoing', 'publishing', 'releasing', 'serializing', 'new', 'active', 'in progress',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MD_TIMEOUT_MS = 20_000;
const DAY_MS = 86_400_000;
const MAX_PREDICTIONS = 8;
const MIN_INTERVAL_HOURS = 12;

function createCalendarService({ readStore, loadSourceFromFile }) {
  const sourceChapCache = new Map();
  const titleCache = new Map();
  const SOURCE_CHAP_TTL = 30 * 60_000;

  function seededHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  function analyseIntervals(allIntervals) {
    const recent = allIntervals.slice(-MAX_INTERVALS);
    if (!recent.length) return { intervalMs: null, cadence: 'irregular', confidence: 'low' };

    const intervalMs = median(recent);
    const dayMs = 86_400_000;
    let scoreWeekly = 0;
    let scoreBiweekly = 0;
    let scoreMonthly = 0;

    for (const ms of recent) {
      const days = ms / dayMs;
      if (days >= 6 && days <= 8) scoreWeekly++;
      if (days >= 12 && days <= 16) scoreBiweekly++;
      if (days >= 26 && days <= 35) scoreMonthly++;
    }

    const threshold = Math.ceil(recent.length * 0.6);
    let cadence = 'irregular';
    if (scoreWeekly >= threshold) cadence = 'weekly';
    else if (scoreBiweekly >= threshold) cadence = 'biweekly';
    else if (scoreMonthly >= threshold) cadence = 'monthly';

    const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const stdDev = Math.sqrt(recent.reduce((sum, value) => sum + (value - mean) ** 2, 0) / recent.length);
    const stdDevDays = stdDev / dayMs;
    let confidence = stdDevDays <= 1 ? 'high' : stdDevDays <= 4 ? 'medium' : 'low';
    if (cadence === 'irregular') confidence = 'low';

    return { intervalMs, cadence, confidence };
  }

  async function resolveMangaDexId(title) {
    const key = title.trim().toLowerCase();
    if (titleCache.has(key)) return titleCache.get(key);
    try {
      const params = new URLSearchParams({ title: title.trim().slice(0, 100), limit: '10', 'order[relevance]': 'desc' });
      for (const rating of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', rating);
      const res = await fetch(`https://api.mangadex.org/manga?${params}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        titleCache.set(key, null);
        return null;
      }

      const json = await res.json();
      const results = json.data || [];
      if (!results.length) {
        titleCache.set(key, null);
        return null;
      }

      let bestId = results[0].id;
      for (const manga of results) {
        const allTitles = [
          ...Object.values(manga.attributes.title || {}),
          ...(manga.attributes.altTitles || []).flatMap(entry => Object.values(entry)),
        ].map(value => value.trim().toLowerCase());
        if (allTitles.includes(key)) {
          bestId = manga.id;
          break;
        }
      }

      titleCache.set(key, bestId);
      return bestId;
    } catch (err) {
      console.error('[calendar] resolve error:', title, err.message);
      titleCache.set(key, null);
      return null;
    }
  }

  async function fetchBatchMangaChapters(uuids) {
    const results = await Promise.all(uuids.map(async (uuid) => {
      try {
        const params = new URLSearchParams({
          limit: String(CHAPTERS_PER_FEED),
          'order[publishAt]': 'desc',
          includeExternalUrl: '0',
        });
        for (const rating of ['safe', 'suggestive', 'erotica', 'pornographic']) params.append('contentRating[]', rating);

        const res = await fetch(
          `https://api.mangadex.org/manga/${encodeURIComponent(uuid)}/feed?${params}`,
          { signal: AbortSignal.timeout(MD_TIMEOUT_MS) }
        );
        if (!res.ok) return { uuid, chapters: [] };

        const data = await res.json();
        const chapters = (data.data || [])
          .map(chapter => ({
            date: new Date(chapter.attributes.publishAt || chapter.attributes.readableAt || 0),
            chapter: String(chapter.attributes.chapter || '?').trim().slice(0, 20),
            id: chapter.id,
          }))
          .filter(chapter => !isNaN(chapter.date.getTime()) && chapter.date.getTime() > 0)
          .sort((a, b) => a.date - b.date);
        return { uuid, chapters };
      } catch (err) {
        console.error('[calendar] feed error:', uuid, err.message);
        return { uuid, chapters: [] };
      }
    }));

    return new Map(results.map(result => [result.uuid, result.chapters]));
  }

  async function fetchSourceLatestChapNum(manga) {
    const cacheKey = `${manga.sourceId}:${manga.id}`;
    const cached = sourceChapCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < SOURCE_CHAP_TTL) return cached.num;
    try {
      const src = loadSourceFromFile(manga.sourceId);
      let timerId;
      const result = await Promise.race([
        src.chapters(manga.id),
        new Promise((_, reject) => { timerId = setTimeout(() => reject(new Error('timeout')), MD_TIMEOUT_MS); }),
      ]);
      clearTimeout(timerId);
      const chaps = result?.chapters || [];
      if (!chaps.length) {
        sourceChapCache.set(cacheKey, { num: null, ts: Date.now() });
        return null;
      }
      const raw = String(chaps[0]?.chapter || chaps[0]?.name || '');
      const match = raw.match(/(\d+(?:\.\d+)?)/);
      const num = match ? parseFloat(match[1]) : null;
      sourceChapCache.set(cacheKey, { num, ts: Date.now() });
      return num;
    } catch (err) {
      console.error('[calendar] source chap error:', manga.title, err.message);
      sourceChapCache.set(cacheKey, { num: null, ts: Date.now() });
      return null;
    }
  }

  async function getCalendar(query = {}) {
    const now = new Date();
    const year = parseInt(query.year, 10) || now.getFullYear();
    const month = parseInt(query.month, 10) || (now.getMonth() + 1);

    if (!Number.isFinite(year) || year < 2000 || year > 2100 ||
        !Number.isFinite(month) || month < 1 || month > 12) {
      const err = new Error('Invalid year or month');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    const favorites = store.favorites || [];
    const readingStatus = store.readingStatus || {};

    const releasing = favorites.filter(m => {
      const userStatus = readingStatus[`${m.id}:${m.sourceId}`]?.status;
      if (EXCLUDED_USER_STATUSES.has(userStatus)) return false;
      const pub = (m.status || '').toLowerCase().trim();
      return pub === '' || RELEASING_STATUSES.has(pub);
    });

    const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
    const monthEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const MIN_MS = MIN_INTERVAL_HOURS * 3_600_000;
    const days = {};

    const resolved = await Promise.all(
      releasing.map(async (manga) => {
        const mdId = (manga.sourceId === 'mangadex' && UUID_RE.test(manga.id))
          ? manga.id
          : await resolveMangaDexId(manga.title);
        return { manga, mdId };
      })
    );
    const valid = resolved.filter(e => e.mdId !== null);

    const [chaptersMap, sourceChapResults] = await Promise.all([
      fetchBatchMangaChapters(valid.map(e => e.mdId)),
      Promise.all(valid.map(({ manga }) => (
        manga.sourceId !== 'mangadex' ? fetchSourceLatestChapNum(manga) : Promise.resolve(null)
      ))),
    ]);

    for (let i = 0; i < valid.length; i++) {
      const { manga, mdId } = valid[i];
      const dated = chaptersMap.get(mdId) || [];
      const sourceLatestChap = sourceChapResults[i];

      if (!dated.length) continue;

      const mdLastChapNum = parseFloat(dated[dated.length - 1].chapter);
      let chapOffset = 0;
      if (sourceLatestChap !== null && isFinite(sourceLatestChap) &&
          isFinite(mdLastChapNum) && sourceLatestChap > mdLastChapNum) {
        chapOffset = Math.round(sourceLatestChap - mdLastChapNum);
      }

      const applyOffset = (chapStr) => {
        if (!chapOffset) return chapStr;
        const n = parseFloat(chapStr);
        return isFinite(n) ? String(Math.round(n + chapOffset)) : chapStr;
      };

      const actualByDay = new Map();
      for (const c of dated) {
        if (c.date < monthStartDate || c.date > monthEndDate) continue;
        const day = c.date.getUTCDate();
        if (!actualByDay.has(day) || parseFloat(c.chapter) > parseFloat(actualByDay.get(day).chapter)) {
          actualByDay.set(day, c);
        }
      }
      for (const [day, c] of actualByDay) {
        if (!days[day]) days[day] = [];
        if (!days[day].some(e => e.manga?.id === manga.id)) {
          days[day].push({
            chapterId: c.id,
            chapter: applyOffset(c.chapter),
            publishAt: c.date.toISOString(),
            predicted: false,
            manga: { id: manga.id, title: manga.title, cover: manga.cover, sourceId: manga.sourceId },
          });
        }
      }

      const intervals = [];
      for (let j = 1; j < dated.length; j++) {
        const diff = dated[j].date - dated[j - 1].date;
        if (diff >= MIN_MS) intervals.push(diff);
      }
      const { intervalMs, cadence, confidence } = analyseIntervals(intervals);
      if (!intervalMs || intervalMs <= 0) continue;

      const lastEntry = dated[dated.length - 1];
      const lastChapNum = isFinite(mdLastChapNum) ? mdLastChapNum + chapOffset : NaN;
      let nextDate = new Date(lastEntry.date.getTime() + intervalMs);

      let predOffset = 0;
      while (nextDate < monthStartDate) {
        predOffset++;
        nextDate = new Date(nextDate.getTime() + intervalMs);
      }

      let count = 0;
      const jitterRange = cadence === 'weekly' ? 1 : cadence === 'biweekly' ? 2 : cadence === 'monthly' ? 4 : 3;
      const breakMod = confidence === 'low' ? 5 : confidence === 'medium' ? 10 : 0;

      while (nextDate <= monthEndDate && count < MAX_PREDICTIONS) {
        predOffset++;
        const seed = `${manga.id}:${predOffset}`;

        if (breakMod > 0 && seededHash(seed + ':break') % breakMod === 0) {
          nextDate = new Date(nextDate.getTime() + intervalMs);
          continue;
        }

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
            const chapNum = isFinite(lastChapNum)
              ? String(Math.round(lastChapNum + count + 1))
              : (sourceLatestChap ? String(Math.round(sourceLatestChap + count + 1)) : null);
            days[day].push({
              chapterId: null,
              chapter: chapNum || '~',
              publishAt: displayDate.toISOString(),
              predicted: true,
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

    const coveredIds = new Set();
    for (const entries of Object.values(days)) for (const e of entries) if (e.manga?.id) coveredIds.add(e.manga.id);

    const noSchedule = releasing
      .filter(m => !coveredIds.has(m.id))
      .map(m => ({ id: m.id, title: m.title, cover: m.cover, status: m.status, sourceId: m.sourceId }));

    return { year, month, days, noSchedule, releasingCount: releasing.length };
  }

  return { getCalendar };
}

module.exports = { createCalendarService };