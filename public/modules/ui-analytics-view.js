// ============================================================================
// ANALYTICS VIEW
// ============================================================================

// Genre colour palette — cycles through for pill backgrounds
const GENRE_COLOURS = [
  '#7c3aed','#2563eb','#0891b2','#059669','#d97706',
  '#dc2626','#db2777','#7c3aed','#4f46e5','#0284c7',
];

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

  const total = Object.values(dist).reduce((n, v) => n + v, 0) || 1;
  const rows = [
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On Hold' },
    { key: 'plan_to_read', label: 'Plan to Read' },
    { key: 'dropped', label: 'Dropped' },
  ];

  distEl.innerHTML = rows.map(r => `
    <div class="dist-row">
      <span class="dist-label">${r.label}</span>
      <div class="dist-bar-wrap">
        <div class="dist-bar dist-bar-${r.key}" style="width:${((dist[r.key] || 0) / total * 100).toFixed(1)}%"></div>
      </div>
      <span class="dist-count">${dist[r.key] || 0}</span>
    </div>`).join('');
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
    const barW = (count / maxCount * 100).toFixed(1);
    const colour = GENRE_COLOURS[i % GENRE_COLOURS.length];
    const rank = i + 1;
    return `
      <div class="genre-bar-row">
        <div class="genre-bar-meta">
          <span class="genre-rank">#${rank}</span>
          <span class="genre-bar-label">${escapeHtml(genre)}</span>
          <span class="genre-bar-count">${count}</span>
        </div>
        <div class="genre-bar-track">
          <div class="genre-bar-fill" style="width:${barW}%;--genre-colour:${colour}"></div>
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

function _renderRecentSessions(analytics) {
  const sessionsEl = $('recentSessions');
  if (!sessionsEl) return;

  const sessions = (analytics.readingSessions || []).slice(0, 10);
  if (!sessions.length) {
    sessionsEl.innerHTML = '<div class="muted">No reading sessions yet. Start reading!</div>';
    return;
  }

  const chapterText = (s) => {
    const number = String(s.chapterNumber || '').trim();
    const name = String(s.chapterName || '').trim();
    if (number) return `Chapter ${escapeHtml(number)}`;
    if (name) return escapeHtml(name);
    if (s.chapterId) return escapeHtml(String(s.chapterId));
    return 'Chapter unknown';
  };

  sessionsEl.innerHTML = sessions.map(s => `
    <div class="session-item">
      <div class="session-main">
        <span class="session-manga">${escapeHtml(s.mangaTitle || s.mangaId || 'Unknown')}</span>
        <span class="session-chapter">${chapterText(s)}</span>
      </div>
      <span class="session-duration">${formatTime(s.duration || 0)}</span>
      <span class="session-date">${new Date(s.date).toLocaleDateString()}</span>
    </div>`).join('');
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
    _renderRecentSessions(a);
  } catch (e) {
    dbg.error(dbg.ERR_ANALYTICS, 'Analytics error', e);
  }
}

