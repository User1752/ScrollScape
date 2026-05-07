// ============================================================================
// ANALYTICS VIEW
// ============================================================================

// Genre colour palette — cycles through for pill backgrounds
const GENRE_COLOURS = [
  '#7c3aed','#2563eb','#0891b2','#059669','#d97706',
  '#dc2626','#db2777','#7c3aed','#4f46e5','#0284c7',
];

async function renderAnalyticsView() {
  try {
    const data = await api("/api/analytics");
    state.analytics = data;
    const a    = data.analytics || {};
    const dist = data.statusDistribution || {};

    // Stat cards
    const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
    el("anaChapters",  a.totalChaptersRead || 0);
    el("anaTime",      formatTime(a.totalTimeSpent || 0));
    el("anaMeanScore", data.meanScore != null ? data.meanScore.toFixed(2) : "—");
    el("anaLibrary",   data.totalFavorites || 0);

    // Re-render feather icons inside the cards
    if (typeof feather !== 'undefined') feather.replace();

    // Status distribution
    const distEl = $("statusDistribution");
    if (distEl) {
      const total = Object.values(dist).reduce((n, v) => n + v, 0) || 1;
      const rows = [
        { key: "reading",       label: "Reading" },
        { key: "completed",     label: "Completed" },
        { key: "on_hold",       label: "On Hold" },
        { key: "plan_to_read",  label: "Plan to Read" },
        { key: "dropped",       label: "Dropped" },
      ];
      distEl.innerHTML = rows.map(r => `
        <div class="dist-row">
          <span class="dist-label">${r.label}</span>
          <div class="dist-bar-wrap">
            <div class="dist-bar dist-bar-${r.key}" style="width:${((dist[r.key] || 0) / total * 100).toFixed(1)}%"></div>
          </div>
          <span class="dist-count">${dist[r.key] || 0}</span>
        </div>`).join("");
    }

    // Genre overview — computed from favorites + history genres
    const genreEl = $("genreOverview");
    if (genreEl) {
      const genreCount = {};
      const allManga = [
        ...(state.favorites || []),
        ...Object.values(state.history || {}).map(h => h.manga || h),
      ];
      for (const m of allManga) {
        const genres = m?.genres || m?.genre || [];
        for (const g of genres) {
          if (g && typeof g === 'string') genreCount[g] = (genreCount[g] || 0) + 1;
        }
      }
      const sorted = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 15);
      if (!sorted.length) {
        genreEl.innerHTML = `<p class="muted">No genre data yet.</p>`;
      } else {
        genreEl.innerHTML = sorted.map(([genre, count], i) => {
          const bg = GENRE_COLOURS[i % GENRE_COLOURS.length];
          return `<div class="genre-pill" style="background:${bg}">
            <span class="genre-pill-name">${escapeHtml(genre)}</span>
            <span class="genre-pill-count">${count} ${count === 1 ? 'Entry' : 'Entries'}</span>
          </div>`;
        }).join("");
      }
    }

    // Recent sessions
    const sessionsEl = $("recentSessions");
    if (sessionsEl) {
      const sessions = (a.readingSessions || []).slice(0, 10);
      if (!sessions.length) {
        sessionsEl.innerHTML = `<div class="muted">No reading sessions yet. Start reading!</div>`;
      } else {
        sessionsEl.innerHTML = sessions.map(s => `
          <div class="session-item">
            <span class="session-manga">${escapeHtml(s.mangaId || "Unknown")}</span>
            <span class="session-duration">${formatTime(s.duration || 0)}</span>
            <span class="session-date">${new Date(s.date).toLocaleDateString()}</span>
          </div>`).join("");
      }
    }
  } catch (e) {
    dbg.error(dbg.ERR_ANALYTICS, 'Analytics error', e);
  }
}

