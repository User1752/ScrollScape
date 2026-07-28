// ============================================================================
// ANALYTICS VIEW
// ============================================================================

/**
 * Genre bar colour — a single hue scale anchored to the active theme's
 * primary colour instead of an arbitrary rainbow, so the chart reads as
 * one coherent gradient (top genres brightest, tapering down by rank).
 */
function _genreColour(rank, count) {
  const style = getComputedStyle(document.documentElement);
  const primary = (style.getPropertyValue('--primary') || '#913FE2').trim();
  const light = (style.getPropertyValue('--primary-light') || '#a78bfa').trim();
  const t = Math.min(1, rank / 11); // 0 (top rank) -> 1 (bottom rank)
  return `color-mix(in srgb, ${light} ${((1 - t) * 100).toFixed(0)}%, ${primary})`;
}

function _mangaAnalyticsKey(m) {
  if (!m || typeof m !== 'object') return '';
  const sourceId = String(m.sourceId || '').trim().toLowerCase();
  const id = String(m.id || '').trim().toLowerCase();
  const title = String(m.title || '').trim().toLowerCase();
  if (sourceId && id) return `${sourceId}::${id}`;
  if (id) return id;
  return title;
}

function _collectUniqueMangaForGenres(favorites, history) {
  const merged = [
    ...(Array.isArray(favorites) ? favorites : []),
    ...Object.values(history || {}).map(h => h?.manga || h),
  ];

  const seen = new Set();
  const unique = [];
  for (const m of merged) {
    const key = _mangaAnalyticsKey(m);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }
  return unique;
}

function _renderStatCards(data, analytics, dist) {
  const el = (id, val) => {
    const e = $(id);
    if (e) e.textContent = val;
  };

  el('anaChapters', analytics.totalChaptersRead || 0);
  el('anaTime', formatTime(analytics.totalTimeSpent || 0));
  el('anaMeanScore', data.meanScore != null ? data.meanScore.toFixed(2) : '—');
  el('anaLibrary', data.totalFavorites || 0);

  const statusTotal = Math.max(1, Object.values(dist).reduce((n, v) => n + (Number(v) || 0), 0));
  const completionRate = ((Number(dist.completed) || 0) / statusTotal) * 100;
  const dropoffRate = ((Number(dist.dropped) || 0) / statusTotal) * 100;
  el('anaCompletionRate', `${completionRate.toFixed(1)}%`);
  el('anaDropoffRate', `${dropoffRate.toFixed(1)}%`);

  if (typeof feather !== 'undefined') feather.replace();
}

function _renderStatusDistribution(dist) {
  const distEl = $('statusDistribution');
  if (!distEl) return;

  const rows = [
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On Hold' },
    { key: 'plan_to_read', label: 'Plan to Read' },
    { key: 'dropped', label: 'Dropped' },
  ];

  const counts = rows.map(r => Number(dist[r.key]) || 0);
  const total = counts.reduce((n, v) => n + v, 0) || 1;

  const segments = rows
    .map((r, i) => ({ ...r, count: counts[i] }))
    .filter(r => r.count > 0)
    .map(r => `<div class="status-seg status-seg-${r.key}" style="flex:${r.count} 0 0" title="${r.label}: ${r.count}"></div>`)
    .join('');

  const legend = rows.map(r => {
    const count = counts[rows.findIndex(row => row.key === r.key)];
    const pct = ((count / total) * 100).toFixed(1);
    return `
      <div class="status-legend-item${count === 0 ? ' is-empty' : ''}">
        <span class="status-legend-dot status-seg-${r.key}"></span>
        <span class="status-legend-label">${r.label}</span>
        <span class="status-legend-count">${count}</span>
        <span class="status-legend-pct">${count > 0 ? `${pct}%` : ''}</span>
      </div>`;
  }).join('');

  distEl.innerHTML = `
    <div class="status-seg-bar">${segments || '<div class="status-seg-empty"></div>'}</div>
    <div class="status-legend">${legend}</div>
  `;
}

function _renderGenreOverview() {
  const genreEl = $('genreOverview');
  if (!genreEl) return;

  const genreCount = {};
  const allManga = _collectUniqueMangaForGenres(state.favorites, state.history);
  for (const m of allManga) {
    const genres = m?.genres || m?.genre || [];
    for (const g of genres) {
      if (g && typeof g === 'string') genreCount[g] = (genreCount[g] || 0) + 1;
    }
  }

  const sorted = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    genreEl.innerHTML = '<p class="muted">No genre data yet.</p>';
    return;
  }

  const total = sorted.reduce((s, [, c]) => s + c, 0);
  const maxCount = sorted[0][1];
  const top = sorted.slice(0, 8);
  const bottom = sorted.length > 8 ? sorted.slice(-Math.min(4, sorted.length - 8)).reverse() : [];

  const barRow = ([genre, count], i) => {
    const barW = Math.max(8, count / maxCount * 100).toFixed(1); // floor width so the count pill always fits
    const colour = _genreColour(i, count);
    const rank = i + 1;
    return `
      <div class="genre-bar-row">
        <span class="genre-rank">#${rank}</span>
        <span class="genre-bar-label">${escapeHtml(genre)}</span>
        <div class="genre-bar-track">
          <div class="genre-bar-fill" style="width:${barW}%;--genre-colour:${colour}">
            <span class="genre-bar-count">${count}</span>
          </div>
        </div>
      </div>`;
  };

  genreEl.innerHTML = `
    <p class="genre-section-title">Most read</p>
    ${top.map((entry, i) => barRow(entry, i)).join('')}
    ${bottom.length ? `
    <p class="genre-section-title genre-section-title--least">Least read</p>
    ${bottom.map((entry, i) => barRow(entry, i + top.length)).join('')}` : ''}
  `;
}

const ACTIVITY_HEATMAP_WEEKS = 20;

function _activityDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * GitHub-style contribution heatmap of reading activity, built from
 * analytics.readingSessions (each session already carries a date + how
 * many chapters were read in it — no new endpoint needed).
 */
function _renderReadingActivityHeatmap(analytics) {
  const el = $('readingActivityHeatmap');
  if (!el) return;

  const chaptersByDay = new Map();
  for (const s of (analytics.readingSessions || [])) {
    const d = new Date(s.date);
    if (isNaN(d)) continue;
    const key = _activityDateKey(d);
    chaptersByDay.set(key, (chaptersByDay.get(key) || 0) + (Number(s.chaptersRead) || 1));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start on the Sunday of (today - N weeks) so columns are full weeks.
  const start = new Date(today);
  start.setDate(start.getDate() - (ACTIVITY_HEATMAP_WEEKS * 7 - 1) - today.getDay());

  const maxCount = Math.max(1, ...chaptersByDay.values());
  const levelOf = (count) => {
    if (!count) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weeks = [];
  const monthLabels = [];
  let cursor = new Date(start);
  let lastMonth = -1;

  for (let w = 0; w < ACTIVITY_HEATMAP_WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const inRange = cursor <= today;
      const key = _activityDateKey(cursor);
      const count = chaptersByDay.get(key) || 0;
      days.push({ date: new Date(cursor), key, count, inRange });
      cursor.setDate(cursor.getDate() + 1);
    }
    const firstOfWeek = days[0].date;
    monthLabels.push(firstOfWeek.getMonth() !== lastMonth ? monthNames[firstOfWeek.getMonth()] : '');
    lastMonth = firstOfWeek.getMonth();
    weeks.push(days);
  }

  const totalChapters = [...chaptersByDay.values()].reduce((s, v) => s + v, 0);
  const activeDays = chaptersByDay.size;

  const gridColumns = `repeat(${ACTIVITY_HEATMAP_WEEKS}, 1fr)`;

  el.innerHTML = `
    <div class="heatmap-months" style="grid-template-columns:${gridColumns}">${monthLabels.map(m => `<span>${m}</span>`).join('')}</div>
    <div class="heatmap-grid" style="grid-template-columns:${gridColumns}">
      ${weeks.map(week => week.map(day => day.inRange
        ? `<div class="heatmap-cell" data-level="${levelOf(day.count)}" title="${day.count} chapter${day.count === 1 ? '' : 's'} on ${day.date.toLocaleDateString()}"></div>`
        : `<div class="heatmap-cell heatmap-cell--void"></div>`
      ).join('')).join('')}
    </div>
    <div class="heatmap-footer">
      <span class="heatmap-summary">${totalChapters} chapters read across ${activeDays} active day${activeDays === 1 ? '' : 's'} (last ${ACTIVITY_HEATMAP_WEEKS} weeks)</span>
      <div class="heatmap-legend">
        <span>Less</span>
        ${[0, 1, 2, 3, 4].map(l => `<span class="heatmap-cell" data-level="${l}"></span>`).join('')}
        <span>More</span>
      </div>
    </div>
  `;
}

async function renderAnalyticsView() {
  try {
    const data = await api("/api/analytics");
    state.analytics = data;
    const a    = data.analytics || {};
    const dist = data.statusDistribution || {};

    _renderStatCards(data, a, dist);
    _renderStatusDistribution(dist);
    _renderGenreOverview();
    _renderReadingActivityHeatmap(a);
  } catch (e) {
    dbg.error(dbg.ERR_ANALYTICS, 'Analytics error', e);
  }
}

