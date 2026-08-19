'use strict';

const { seededHash, analyseIntervals } = require('./prediction-math');
const { createMangaDexDatesService } = require('./mangadex-dates');
const { createNativeDatesService } = require('./native-dates');
const { fetchOtakuCalendarReleases } = require('./otaku-calendar');

const EXCLUDED_USER_STATUSES = new Set(['completed', 'on_hold', 'dropped']);
const RELEASING_STATUSES = new Set([
  'ongoing', 'publishing', 'releasing', 'serializing', 'new', 'active', 'in progress',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DAY_MS = 86_400_000;
const MAX_PREDICTIONS = 8;
const MIN_INTERVAL_HOURS = 12;

// Sources whose own chapters() response includes a real, parseable
// publishAt/date per chapter — verified by fetching real pages for each,
// not just reading the code:
//   - comichubfree, weebcentral: already parsed a real date.
//   - kingofshojo: .chapterdate text turned out to be an actual date
//     ("August 9, 2026") once parsed with new Date(), not relative text.
//   - mangakatana: each row's .update_time ("Aug-09-2026") is a real date,
//     just wasn't being read at all before.
//   - vortexscans: its serialized-state extractor already captured a real
//     createdAt ISO timestamp — it just wasn't in this allowlist yet.
//   - asurascans: shows relative text for recent chapters ("4 days ago",
//     "last week") and an absolute date for older ones ("Jul 4, 2026") —
//     added parseAsuraTimeText() to handle both forms.
// Manga that can't be resolved to a MangaDex UUID would otherwise get no
// calendar entry at all; for these sources only, fall back to computing
// the release interval straight from the source's own chapter history
// instead. BatCave and MangaPill still have no chapter-level date data
// anywhere (verified live) and AllManga's only per-chapter date field
// requires one extra GraphQL call per chapter (too expensive to fetch for
// interval math) — those three still land in noSchedule when MangaDex
// resolution fails.
const NATIVE_DATE_SOURCES = new Set(['comichubfree', 'weebcentral', 'kingofshojo', 'mangakatana', 'vortexscans', 'asurascans']);

function createCalendarService({ readStore, loadSourceFromFile }) {
  const { resolveMangaDexId, fetchBatchMangaChapters } = createMangaDexDatesService();
  const { fetchNativeDatedChaptersBatch, fetchSourceLatestChapNum } = createNativeDatesService({ loadSourceFromFile });

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
      // Guards against corrupted/legacy favorite records that are missing
      // required fields (e.g. saved before addToLibrary/toggleFavorite
      // validated payloads) — skip them instead of crashing the whole page.
      if (!m || !m.id || !m.title) return false;
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
        // MangaDex resolution failed — fall back to the manga's own source
        // history if (and only if) that source is known to carry real
        // chapter dates (see NATIVE_DATE_SOURCES).
        const useNative = mdId === null && NATIVE_DATE_SOURCES.has(manga.sourceId);
        return { manga, mdId, useNative };
      })
    );
    // Manga with neither a MangaDex match nor a native-date source have no
    // date data anywhere to build a calendar entry from — they still end
    // up in noSchedule below, same as before.
    const processable = resolved.filter(e => e.mdId !== null || e.useNative);

    const [chaptersMap, nativeChaptersMap, sourceChapResults, otakuReleasesByDay] = await Promise.all([
      fetchBatchMangaChapters(processable.filter(e => e.mdId !== null).map(e => e.mdId)),
      fetchNativeDatedChaptersBatch(processable.filter(e => e.useNative).map(e => e.manga)),
      Promise.all(processable.map(({ manga, useNative }) => (
        // Only meaningful for the MangaDex path, to correct for MangaDex's
        // chapter numbering lagging behind the real source (see chapOffset
        // below) — native entries already use the source's own numbering.
        (!useNative && manga.sourceId !== 'mangadex') ? fetchSourceLatestChapNum(manga) : Promise.resolve(null)
      ))),
      fetchOtakuCalendarReleases(year, month, releasing),
    ]);

    // Merge OtakuCalendar volumes into the days object early
    for (const [dayStr, volReleases] of Object.entries(otakuReleasesByDay)) {
      const d = parseInt(dayStr, 10);
      if (!days[d]) days[d] = [];
      days[d].push(...volReleases);
    }

    for (let i = 0; i < processable.length; i++) {
      const { manga, mdId, useNative } = processable[i];
      const dated = useNative
        ? (nativeChaptersMap.get(`${manga.sourceId}:${manga.id}`) || [])
        : (chaptersMap.get(mdId) || []);
      const sourceLatestChap = sourceChapResults[i];

      if (!dated.length) continue;

      const mdLastChapNum = parseFloat(dated[dated.length - 1].chapter);
      let chapOffset = 0;
      if (!useNative && sourceLatestChap !== null && isFinite(sourceLatestChap) &&
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
