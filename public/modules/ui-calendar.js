// ============================================================================
// CALENDAR VIEW
// ============================================================================

/** @type {{ year: number, month: number }} Persistent calendar navigation state */
const _calState = (() => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
})();

const _CAL_MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const _CAL_MONTH_NAMES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function _calMonthName(month) {
  const idx = month - 1;
  return currentLanguage === 'pt' ? _CAL_MONTH_NAMES_PT[idx] : _CAL_MONTH_NAMES_EN[idx];
}

async function renderCalendarView() {
  _calCloseDayPopover();
  const container = $("calendarContainer");
  if (!container) return;

  container.innerHTML = `<div class="cal-loading">${t("calendar.loading")}</div>`;

  let data;
  try {
    data = await api(`/api/calendar?year=${_calState.year}&month=${_calState.month}`);
  } catch (e) {
    container.innerHTML = `<div class="cal-error">${t("common.error")}: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const { year, month, days, noSchedule } = data;
  _calState.days = days;
  const today = new Date();
  const todayDay    = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : -1;
  const upcomingMax = todayDay > 0 ? todayDay + 3 : -1; // next 3 days

  // Build the grid
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayLabels = [
    t("calendar.days.sun"), t("calendar.days.mon"), t("calendar.days.tue"),
    t("calendar.days.wed"), t("calendar.days.thu"), t("calendar.days.fri"),
    t("calendar.days.sat")
  ];

  // Build upcoming strip (releases in the next 7 days from today)
  const upcomingItems = [];
  if (todayDay > 0) {
    for (let d = todayDay; d <= Math.min(todayDay + 7, daysInMonth); d++) {
      for (const rel of ((days || {})[d] || [])) {
        const daysAway = d - todayDay;
        upcomingItems.push({ ...rel, daysAway, day: d });
      }
    }
    upcomingItems.sort((a, b) => a.daysAway - b.daysAway);
  }

  let html = `
    <div class="cal-topbar">
      <button class="btn-cal-nav" id="calPrevBtn" aria-label="Previous month">&#8592;</button>
      <div class="cal-month-label">${_calMonthName(month)} ${year}</div>
      <button class="btn-cal-nav" id="calNextBtn" aria-label="Next month">&#8594;</button>
    </div>`;
  // Upcoming strip — max 3 chips + overflow indicator
  if (upcomingItems.length) {
    const CHIP_LIMIT = 3;
    const shown = upcomingItems.slice(0, CHIP_LIMIT);
    const extra = upcomingItems.length - CHIP_LIMIT;
    html += `<div class="cal-upcoming-strip">`;
    for (const rel of shown) {
      const title   = escapeHtml(rel.manga?.title || '?');
      const cover   = rel.manga?.cover ? escapeHtml(normalizeImageUrl(rel.manga.cover)) : '';
      const mid     = escapeHtml(rel.manga?.id || '');
      const sid     = escapeHtml(rel.manga?.sourceId || '');
      const chap    = escapeHtml(rel.chapter || '?');
      const whenLbl = rel.daysAway === 0 ? 'Today' : rel.daysAway === 1 ? 'Tomorrow' : `In ${rel.daysAway}d`;
      const chapLbl = rel.predicted ? `~Ch.${chap}` : `Ch.${chap}`;
      html += `<div class="cal-upcoming-chip" data-mid="${mid}" data-sid="${sid}" title="${escapeHtml(rel.manga?.title || '')}">
        ${cover ? `<img src="${cover}" alt="">` : ''}
        <span class="cal-upcoming-chip-title">${title}</span>
        <span class="cal-upcoming-chip-when">${escapeHtml(whenLbl)}</span>
        <span class="cal-upcoming-chip-chap">${chapLbl}</span>
      </div>`;
    }
    if (extra > 0) html += `<span class="cal-upcoming-more">+${extra} more</span>`;
    html += `</div>`;
  }

  // Legend — single compact inline line
  html += `<div class="cal-legend">
    <span class="cal-legend-item"><span class="cal-legend-swatch cal-legend-swatch--confirmed"></span>Confirmed</span>
    <span class="cal-legend-item"><span class="cal-legend-swatch cal-legend-swatch--predicted"></span>Predicted</span>
    <span class="cal-legend-item"><span class="cal-legend-swatch cal-legend-swatch--low"></span>Low conf.</span>
    <span class="cal-legend-divider">·</span>
    <span class="cal-legend-conf"><span style="color:#4caf50">&#11044;</span> high <span style="color:#ff9800">&#9681;</span> med <span style="color:#f44336">&#9675;</span> low</span>
  </div>`;

  html += `<div class="cal-grid">
      ${dayLabels.map(d => `<div class="cal-day-header">${d}</div>`).join("")}`;

  // Empty cells before first day
  for (let i = 0; i < firstDow; i++) {
    html += `<div class="cal-cell cal-cell--empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const releases = (days || {})[d] || [];
    const isToday    = d === todayDay;
    const isUpcoming = !isToday && todayDay > 0 && d > todayDay && d <= upcomingMax;
    html += `<div class="cal-cell${isToday ? " cal-cell--today" : ""}${isUpcoming ? " cal-cell--upcoming" : ""}${releases.length ? " cal-cell--has-releases" : ""}">`;
    html += `<span class="cal-day-num">${d}${isToday ? `<span class="cal-today-dot"></span>` : ""}</span>`;
    html += `<div class="cal-releases">`;
    const MAX_VISIBLE = 2;
    const overflow = releases.length - MAX_VISIBLE;
    for (let ri = 0; ri < releases.length; ri++) {
      const rel         = releases[ri];
      const title       = escapeHtml(rel.manga?.title || "?");
      const cover       = rel.manga?.cover ? escapeHtml(normalizeImageUrl(rel.manga.cover)) : "";
      const chap        = escapeHtml(rel.chapter || "?");
      const mid         = escapeHtml(rel.manga?.id || "");
      const sid         = escapeHtml(rel.manga?.sourceId || "");
      const isPredicted = rel.predicted === true;
      const confidence  = rel.confidence || 'low';
      const chapLabel   = isPredicted ? `~ ${t("calendar.chapter")}${chap}` : `${t("calendar.chapter")}${chap}`;
      const confClass   = isPredicted ? ` cal-release-item--predicted cal-release-item--conf-${confidence}` : '';
      const hiddenClass = ri >= MAX_VISIBLE ? ' cal-release-hidden' : '';
      const itemClass   = `cal-release-item${confClass}${hiddenClass}`;
      const confLabel   = isPredicted ? { high: '●', medium: '◑', low: '○' }[confidence] : '';
      const tooltip     = isPredicted
        ? `${title} — ${chapLabel} (${t("calendar.estimated")} · ${confidence} confidence)`
        : `${title} — ${chapLabel}`;
      html += `<div class="${itemClass}" title="${tooltip}" data-mid="${mid}" data-sid="${sid}">
        ${cover ? `<img src="${cover}" alt="" class="cal-cover" loading="lazy" decoding="async">` : `<div class="cal-cover cal-cover--fallback">?</div>`}
        <span class="cal-release-title">${title}</span>
        <span class="cal-release-chap">${chapLabel}${confLabel ? ` <span class="cal-conf-dot">${confLabel}</span>` : ''}</span>
      </div>`;
    }
    if (overflow > 0) html += `<button class="cal-more-btn" data-day="${d}">+${overflow} more</button>`;
    html += `</div></div>`;
  }

  html += `</div>`;

  // ── Non-MangaDex releasing manga (no date info available) ─────────────────
  if (noSchedule && noSchedule.length > 0) {
    html += `<div class="cal-no-schedule-section">
      <div class="cal-no-schedule-title">${t("calendar.releasing")}</div>
      <div class="cal-no-schedule-list">`;
    for (const m of noSchedule) {
      const title = escapeHtml(m.title || "?");
      const cover = m.cover ? escapeHtml(normalizeImageUrl(m.cover)) : "";
      const mid   = escapeHtml(m.id || "");
      const sid   = escapeHtml(m.sourceId || "");
      html += `<div class="cal-no-schedule-item" data-mid="${mid}" data-sid="${sid}">
        ${cover ? `<img src="${cover}" alt="${title}" class="cal-ns-cover" loading="lazy" decoding="async">` : `<div class="cal-ns-cover cal-cover--fallback">?</div>`}
        <span class="cal-ns-title">${title}</span>
      </div>`;
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;

  // Wire +N more badges → inline expand (reveal hidden items in the same cell)
  container.querySelectorAll('.cal-more-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const cell = btn.closest('.cal-cell');
      cell.querySelectorAll('.cal-release-hidden').forEach(el => el.classList.remove('cal-release-hidden'));
      btn.remove();
    };
  });

  // Bind click: navigate to manga details (calendar items + upcoming chips + no-schedule)
  container.querySelectorAll(".cal-release-item[data-mid], .cal-no-schedule-item[data-mid], .cal-upcoming-chip[data-mid]").forEach(el => {
    el.onclick = () => {
      const mid = el.dataset.mid;
      const sid = el.dataset.sid;
      if (!mid || !sid) return;
      if (state.installedSources[sid]) {
        state.currentSourceId = sid;
        renderSourceSelect();
      }
      loadMangaDetails(mid);
    };
  });

  // Wire navigation buttons (re-bind every render because innerHTML is replaced)
  const prevBtn = $("calPrevBtn");
  const nextBtn = $("calNextBtn");
  if (prevBtn) prevBtn.onclick = () => {
    _calState.month--;
    if (_calState.month < 1) { _calState.month = 12; _calState.year--; }
    renderCalendarView();
  };
  if (nextBtn) nextBtn.onclick = () => {
    _calState.month++;
    if (_calState.month > 12) { _calState.month = 1; _calState.year++; }
    renderCalendarView();
  };
}

function _calCloseDayPopover() {
  const el = document.getElementById('calDayPopover');
  if (el) el.remove();
}

function renderMangaGrid(container, mangaList) {
  container.innerHTML = mangaList.map(m => mangaCardHTML(m)).join("");
  bindMangaCards(container);
}

function bindMangaCards(container) {
  container.querySelectorAll("[data-manga-id]").forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.sourceId;
      if (sid && sid !== state.currentSourceId && state.installedSources[sid]) {
        state.currentSourceId = sid;
        const sel = $("sourceSelect");
        if (sel) sel.value = sid;
      }
      loadMangaDetails(el.dataset.mangaId);
    };
  });
}

// ============================================================================
// RECOMMENDATIONS
// Based on genres of manga in user's library
// ============================================================================

async function loadRecommendations() {
  const section = $("recommendedSection");
  const row     = $("recommendedRow");
  if (!section || !row) return;

  const installedSourceIds = Object.keys(state.installedSources);
  if (installedSourceIds.length === 0) return;

  // Build genre profile from history (weighted 2x) + favorites (weighted 1x)
  const genreScore = new Map();
  const addGenres = (manga, weight) => {
    for (const g of (manga.genres || [])) {
      const key = g.toLowerCase();
      genreScore.set(key, (genreScore.get(key) || 0) + weight);
    }
  };
  for (const m of (state.history  || [])) addGenres(m, 2);
  for (const m of (state.favorites || [])) addGenres(m, 1);

  if (genreScore.size === 0) return;

  // Top 3 genres — these drive both the API query and the label
  const topGenres = [...genreScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g.charAt(0).toUpperCase() + g.slice(1));

  const topGenresLower = topGenres.map(g => g.toLowerCase());

  const normalizeTitle = (title = "") =>
    String(title).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);

  const favoriteIdsBySource = new Set(
    (state.favorites || []).map(m => `${_normSourceId(m.sourceId)}::${m.id}`)
  );
  const favoriteTitleKeys = new Set(
    (state.favorites || []).map(m => normalizeTitle(m.title || m.id)).filter(Boolean)
  );

  // Score a result by how many label genres it matches (used for sources that return genres)
  const genreMatchScore = m => {
    const mg = (m.genres || []).map(g => g.toLowerCase());
    return mg.length === 0
      ? 1 // source doesn't return genres (MangaPill) — treat as neutral match
      : topGenresLower.filter(g => mg.includes(g)).length;
  };

  // Fetch from every installed source in parallel using exactly the label genres
  const perSource = await Promise.all(
    installedSourceIds.map(async sid => {
      try {
        const result = await api(`/api/source/${sid}/byGenres`, {
          method: "POST",
          body: JSON.stringify({ genres: topGenres })
        });
        return (result.results || [])
          .filter(m => {
            const sourceKey = `${sid}::${m.id}`;
            const titleKey = normalizeTitle(m.title || m.id);
            return !favoriteIdsBySource.has(sourceKey) && !favoriteTitleKeys.has(titleKey);
          })
          .map(m => ({ ...m, sourceId: sid, _score: genreMatchScore(m) }))
          // Sort within each source: best genre match first
          .sort((a, b) => b._score - a._score);
      } catch (_) {
        return [];
      }
    })
  );

  // Interleave results from all sources for diversity, then deduplicate by normalised title
  const interleaved = [];
  const maxLen = Math.max(...perSource.map(a => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of perSource) {
      if (i < arr.length) interleaved.push(arr[i]);
    }
  }
  const seenTitles = new Set();
  const list = interleaved.filter(m => {
    const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  }).slice(0, 24);

  if (!list.length) return;
  section.style.display = "block";

  // Label: show top 3 genres with their relative consumption weight
  const labelEl = section.querySelector(".recommended-genres-label");
  if (labelEl) {
    const total = [...genreScore.values()].reduce((a, b) => a + b, 0) || 1;
    const labelGenres = topGenres.map(g => {
      const pct = Math.round((genreScore.get(g.toLowerCase()) || 0) / total * 100);
      return pct >= 5 ? `${g} (${pct}%)` : g;
    });
    labelEl.textContent = `Based on: ${labelGenres.join(", ")}`;
  }

  row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
  bindMangaCards(row);
  initRowAutoScroll(row);
}

