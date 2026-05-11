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

const { createAsyncHandler } = require('../modules/http/async-handler');
const { createCalendarService } = require('../modules/calendar/service');
const { readStore } = require('../store');
const { loadSourceFromFile } = require('../sourceLoader');

const asyncHandler = createAsyncHandler('CALENDAR');
const calendarService = createCalendarService({ readStore, loadSourceFromFile });

// ── Route ─────────────────────────────────────────────────────────────────────

function registerCalendarRoutes(router) {
  router.get('/api/calendar', asyncHandler(async (req, res) => {
    res.json(await calendarService.getCalendar(req.query || {}));
  }));
}

module.exports = { registerCalendarRoutes };
