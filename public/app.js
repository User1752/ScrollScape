// ============================================================================
// app.js    ScrollScape frontend application
//
// Foundational modules loaded (in order) before this file by index.html:
//   modules/api.js         api() fetch helper
//   modules/i18n.js        translations, t(), setLanguage(), applyTranslations()
//   modules/state.js       global state object
//   modules/navigation.js  NavigationManager, navigationManager, achievementManager
//   modules/utils.js       \, escapeHtml(), formatTime(), statusLabel(),
//                           initTheme(), toggleTheme(), showToast()
// ============================================================================

// ============================================================================
// THEME SHOP — definitions & AP helpers
// ============================================================================

const _BASE_THEMES = [
  { id: 'default', name: 'Default', desc: 'Classic purple theme', cost: 0, primary: '#913FE2', primaryDark: '#6F2598', primaryLight: '#A855F7', preview: 'linear-gradient(135deg,#913FE2,#A855F7)' },
];
// Merge any community themes registered in themes.js (loaded before this file)
const SHOP_THEMES = [..._BASE_THEMES, ...(window.COMMUNITY_THEMES || [])];

function getSpentAP()   { return parseInt(localStorage.getItem('scrollscape_ap_spent')  || '0', 10); }
function getBonusAP()   { return parseInt(localStorage.getItem('scrollscape_ap_bonus')  || '0', 10); }
function addBonusAP(n)  { localStorage.setItem('scrollscape_ap_bonus', getBonusAP() + n); }
function spendAP(n)     { localStorage.setItem('scrollscape_ap_spent', Math.max(0, getSpentAP() + n)); }
function getAvailableAP() { return Math.max(0, achievementManager.unlockedAchievements.size + getBonusAP() - getSpentAP()); }

function getPurchasedThemes() {
  try { return JSON.parse(localStorage.getItem('scrollscape_purchased_themes') || '["default"]'); }
  catch { return ['default']; }
}
function addPurchasedTheme(id) {
  const p = getPurchasedThemes();
  if (!p.includes(id)) { p.push(id); localStorage.setItem('scrollscape_purchased_themes', JSON.stringify(p)); }
}
function getActiveTheme() { return localStorage.getItem('scrollscape_active_theme') || 'default'; }
function setActiveTheme(id) { localStorage.setItem('scrollscape_active_theme', id); applyTheme(id); }
function applyTheme(id) {
  // Call onRemove for the previously active community theme
  const prevId = document.documentElement.getAttribute('data-color-theme') || '';
  if (prevId && prevId !== id) {
    const prev = (window.COMMUNITY_THEMES || []).find(t => t.id === prevId);
    if (prev?.onRemove) prev.onRemove();
  }
  const t = SHOP_THEMES.find(x => x.id === id) || SHOP_THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary',       t.primary);
  root.style.setProperty('--primary-dark',  t.primaryDark);
  root.style.setProperty('--primary-light', t.primaryLight);
  root.setAttribute('data-color-theme', id === 'default' ? '' : id);
  // Call onApply for the newly activated community theme
  const next = (window.COMMUNITY_THEMES || []).find(t => t.id === id);
  if (next?.onApply) next.onApply();
}
function updateApBadge() {
  const ap = getAvailableAP();
  const badge = document.getElementById('sidebarApBadge');
  if (badge) badge.textContent = `${ap} AP`;
  const achEl  = document.getElementById('achPageApBalance');
  const shopEl = document.getElementById('shopApBalance');
  if (achEl)  achEl.textContent  = ap;
  if (shopEl) shopEl.textContent = ap;
}

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// Loaded dynamically from data/achievements.json via AchievementManager
// Legacy hardcoded achievements kept for backwards compatibility
// ============================================================================

const ACHIEVEMENTS = [
  { id: 'first_read',     icon: 'book-open', label: 'First Steps',       desc: 'Read your first chapter',           check: (a) => a.totalChaptersRead >= 1 },
  { id: 'reader_10',      icon: 'book',       label: 'Bookworm',           desc: 'Read 10 chapters',                  check: (a) => a.totalChaptersRead >= 10 },
  { id: 'reader_100',     icon: 'award',      label: 'Manga Addict',        desc: 'Read 100 chapters',                 check: (a) => a.totalChaptersRead >= 100 },
  { id: 'reader_500',     icon: 'star',       label: 'Legend',              desc: 'Read 500 chapters',                 check: (a) => a.totalChaptersRead >= 500 },
  { id: 'first_fav',      icon: 'heart', label: 'Collector',           desc: 'Add your first manga to library',   check: (a) => a.totalFavorites >= 1 },
  { id: 'fav_10',         icon: 'package', label: 'Hoarder',             desc: 'Have 10 manga in your library',     check: (a) => a.totalFavorites >= 10 },
  { id: 'completed_1',    icon: 'check-circle', label: 'Completionist',       desc: 'Mark your first manga as completed',check: (a) => a.completedCount >= 1 },
  { id: 'completed_5',    icon: 'award', label: 'Veteran Reader',      desc: 'Complete 5 manga',                  check: (a) => a.completedCount >= 5 },
  { id: 'list_maker',     icon: 'clipboard', label: 'Organizer',           desc: 'Create a custom list',              check: (a) => a.totalLists >= 1 },
  { id: 'night_owl',      icon: 'moon', label: 'Night Owl',           desc: 'Spend 1 hour reading total',        check: (a) => (a.totalTimeSpent || 0) >= 60 },
  { id: 'marathon',       icon: 'activity', label: 'Marathon Reader',     desc: 'Spend 5 hours reading total',       check: (a) => (a.totalTimeSpent || 0) >= 300 },
];

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem("scrollscapeSettings");
    if (saved) state.settings = { ...state.settings, ...JSON.parse(saved) };

    const readChaps = localStorage.getItem("scrollscapeReadChapters");
    if (readChaps) state.readChapters = new Set(JSON.parse(readChaps));

    const flaggedChaps = localStorage.getItem("scrollscapeFlaggedChapters");
    if (flaggedChaps) state.flaggedChapters = new Set(JSON.parse(flaggedChaps));

    const progress = localStorage.getItem("scrollscapeReadingProgress");
    if (progress) {
      const p = JSON.parse(progress);
      state.lastReadPages = p.pages || {};
      state.lastReadChapter = p.chapters || {};
    } else {
      state.lastReadPages = {};
      state.lastReadChapter = {};
    }
  } catch (e) {
    console.warn("Failed to load settings:", e);
    state.lastReadPages = {};
    state.lastReadChapter = {};
  }
}

function saveSettings() {
  localStorage.setItem("scrollscapeSettings", JSON.stringify(state.settings));
  localStorage.setItem("scrollscapeReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("scrollscapeFlaggedChapters", JSON.stringify([...state.flaggedChapters]));
  localStorage.setItem("scrollscapeReadingProgress", JSON.stringify({
    pages: state.lastReadPages,
    chapters: state.lastReadChapter
  }));
}

function markChapterAsRead(mangaId, chapterId) {
  state.readChapters.add(`${mangaId}:${chapterId}`);
  saveSettings();
}

function unmarkChapterAsRead(mangaId, chapterId) {
  state.readChapters.delete(`${mangaId}:${chapterId}`);
  saveSettings();
}

function isChapterRead(mangaId, chapterId) {
  return state.readChapters.has(`${mangaId}:${chapterId}`);
}

function toggleFlagChapter(mangaId, chapterId) {
  const key = `${mangaId}:${chapterId}`;
  if (state.flaggedChapters.has(key)) state.flaggedChapters.delete(key);
  else state.flaggedChapters.add(key);
  saveSettings();
}

function showChapterContextMenu(e, chapterId, mangaId) {
  document.querySelectorAll(".chapter-ctx-menu").forEach(m => m.remove());

  const isRead    = isChapterRead(mangaId, chapterId);
  const isFlagged = state.flaggedChapters.has(`${mangaId}:${chapterId}`);

  const menu = document.createElement("div");
  menu.className = "context-menu chapter-ctx-menu";
  menu.innerHTML = `
    <button class="context-item" id="ctxMarkRead">
      ${isRead
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Mark as Unread'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark as Read'}
    </button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxFlag">
      &#x1F6A9; ${isFlagged ? 'Remove Flag' : 'Add Flag'}
    </button>
  `;

  document.body.appendChild(menu);
  const { clientX: x, clientY: y } = e;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = (x + mw > window.innerWidth  ? window.innerWidth  - mw - 8 : x) + "px";
  menu.style.top  = (y + mh > window.innerHeight ? window.innerHeight - mh - 8 : y) + "px";

  menu.querySelector("#ctxMarkRead").onclick = () => {
    if (isRead) unmarkChapterAsRead(mangaId, chapterId);
    else        markChapterAsRead(mangaId, chapterId);
    menu.remove();
    loadChapters();
  };
  menu.querySelector("#ctxFlag").onclick = () => {
    toggleFlagChapter(mangaId, chapterId);
    menu.remove();
    loadChapters();
  };

  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", dismiss, true); }
  };
  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}

function updateReadingProgress(mangaId, chapterId, pageIndex) {
  if (!mangaId || !chapterId) return;
  state.lastReadPages[`${mangaId}:${chapterId}`] = pageIndex;
  state.lastReadChapter[mangaId] = chapterId;
  saveSettings();
}

// ============================================================================
// STATE & RENDERING
// ============================================================================

async function refreshState() {
  try {
    const data = await api("/api/state");
    state.installedSources = data.installedSources || {};

    const [libData, statusData] = await Promise.all([
      api("/api/library"),
      api("/api/user/status")
    ]);

    state.favorites     = libData.favorites || [];
    state.history       = libData.history   || [];
    state.readingStatus = statusData.readingStatus || {};

    try {
      const localData = await api("/api/local/list");
      state.localManga = localData.localManga || [];
      // Generate covers for any PDF manga that still has a .pdf cover
      generateMissingPDFCovers();
    } catch (_) { state.localManga = []; }

    try {
      const ratingsData = await api("/api/ratings");
      state.ratings = ratingsData.ratings || {};
    } catch (_) { state.ratings = {}; }

    renderSourceSelect();
    await Promise.all([
      loadAllTimePopular(),
      loadPopularToday(),
      loadRecentlyAdded(),
      loadLatestUpdates()
    ]);
    await updateStats();
    renderLibrary();

    // Trigger recommendations if there's any reading history or library content
    if (state.favorites.length > 0 || state.history.length > 0) loadRecommendations();
  } catch (e) {
    console.error("Failed to load state:", e);
  }
}

function renderSourceSelect() {
  const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
  const installed = Object.values(state.installedSources);

  for (const sel of selectors) {
    if (!sel) continue;
    sel.innerHTML = "";
    if (installed.length === 0) {
      sel.innerHTML = `<option value="">(Install a source first)</option>`;
      continue;
    }
    for (const s of installed) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    }
    if (!state.currentSourceId || !state.installedSources[state.currentSourceId]) {
      state.currentSourceId = installed[0].id;
    }
    sel.value = state.currentSourceId;
    sel.onchange = () => { 
      state.currentSourceId = sel.value;
      // Keep both selectors in sync
      for (const other of selectors) { if (other && other !== sel) other.value = sel.value; }
      if (state.currentView !== 'advanced-search') {
        // Reload homepage content when source changes
        loadPopularToday();
        loadRecentlyAdded();
        loadLatestUpdates();
      }
      // In advanced-search: user changes source manually and clicks search themselves
    };
  }
}

// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

async function loadAllTimePopular() {
  const row = $("allTimePopularRow");
  if (!row) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api("/api/popular-all");
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.map(m => {
      const genres = (m.genres || []).slice(0, 2);
      const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
      return `
        <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
          <div class="manga-card-cover">
            ${m.cover && !m.cover.endsWith('.pdf')
              ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
              : `<div class="no-cover">?</div>`}
            ${m.sourceName ? `<span class="all-pop-source-badge">${escapeHtml(m.sourceName)}</span>` : ""}
          </div>
          <div class="manga-card-info">
            <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
            <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
            ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
            <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
          </div>
        </div>`;
    }).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading all-time popular:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/trending`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.slice(0, 10).map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading popular manga:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/recentlyAdded`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading recently added:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadLatestUpdates() {
  const row = $("latestUpdatesRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/latestUpdates`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading latest updates:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

function mangaCardHTML(m) {
  const genres = (m.genres || []).slice(0, 3);
  const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
      <div class="manga-card-cover">
        ${m.cover && !m.cover.endsWith('.pdf')
          ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          : (m.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
      </div>
    </div>
  `;
}

async function startReading(mangaId) {
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  await loadMangaDetails(mangaId);
  if (!state.allChapters?.length) { showToast("No chapters found", "", "info"); return; }
  // Chapters are sorted newest-first; last index = chapter 1
  const firstIdx = state.allChapters.length - 1;
  const ch = state.allChapters[firstIdx];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
}

async function continueReading(mangaId, sourceId) {
  if (!mangaId) return;
  // Switch source if needed
  if (sourceId && state.installedSources[sourceId] && sourceId !== state.currentSourceId) {
    state.currentSourceId = sourceId;
    renderSourceSelect();
  }
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }

  const lastChapterId = state.lastReadChapter?.[mangaId];
  if (!lastChapterId) {
    // No progress yet — fall back to start reading
    await startReading(mangaId);
    return;
  }

  const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
  try {
    showToast("Resuming...", "", "info");
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.allChapters = cr.chapters || [];
    const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
    if (idx >= 0) {
      const ch = state.allChapters[idx];
      await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
    } else {
      await loadMangaDetails(mangaId);
    }
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

// ============================================================================
// HISTORY VIEW
// ============================================================================

function renderHistoryView() {
  const container = $("historyList");
  if (!container) return;
  const history = state.history || [];
  if (!history.length) {
    container.innerHTML = `<div class="muted" style="text-align:center;padding:3rem 0">No reading history yet.</div>`;
    return;
  }
  container.innerHTML = history.map(m => {
    const genres = (m.genres || []).slice(0, 3);
    const date   = m.readAt ? new Date(m.readAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "";
    return `
      <div class="history-item" data-manga-id="${escapeHtml(m.id)}" data-source-id="${escapeHtml(m.sourceId || "")}">
        <div class="history-cover">
          ${m.cover && !m.cover.endsWith('.pdf') ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async">` : (m.cover ? `<div class="no-cover">&#128196;</div>` : `<div class="no-cover">?</div>`)}
        </div>
        <div class="history-info">
          <h3 class="history-title">${escapeHtml(m.title)}</h3>
          ${m.author ? `<p class="history-author">${escapeHtml(m.author)}</p>` : ""}
          ${genres.length ? `<div class="history-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
          ${date ? `<p class="history-date">${date}</p>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn history-view-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">View Details</button>
          <button class="btn btn-start-reading-detail history-read-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">${state.lastReadChapter?.[m.id] ? '&#9654; Continue Reading' : '&#9654; Start Reading'}</button>
          <button class="history-delete-btn" title="Remove from history" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">[x]</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".history-view-btn").forEach(btn => {
    btn.onclick = () => {
      const sid = btn.dataset.sid;
      if (sid && state.installedSources[sid]) {
        state.currentSourceId = sid;
        renderSourceSelect();
      }
      loadMangaDetails(btn.dataset.mid);
    };
  });
  container.querySelectorAll(".history-read-btn").forEach(btn => {
    btn.onclick = () => continueReading(btn.dataset.mid, btn.dataset.sid);
  });
  container.querySelectorAll(".history-delete-btn").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api("/api/history/remove", {
          method: "POST",
          body: JSON.stringify({ mangaId: btn.dataset.mid, sourceId: btn.dataset.sid })
        });
        state.history = state.history.filter(m => !(m.id === btn.dataset.mid && m.sourceId === (btn.dataset.sid || m.sourceId)));
        renderHistoryView();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });
}

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
      const cover   = rel.manga?.cover ? escapeHtml(rel.manga.cover) : '';
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
      const cover       = rel.manga?.cover ? escapeHtml(rel.manga.cover) : "";
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
      const cover = m.cover ? escapeHtml(m.cover) : "";
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

  const libraryIds = new Set([
    ...state.favorites.map(m => m.id),
    ...state.history.map(m => m.id)
  ]);

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
          .filter(m => !libraryIds.has(m.id))
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

// ============================================================================
// ROW AUTO-SCROLL + DRAG
// ============================================================================

function initRowAutoScroll(row) {
  if (row._autoScrollId) cancelAnimationFrame(row._autoScrollId);

  const SPEED = 0.4; // px per frame
  let pos = 0;

  row.style.scrollSnapType = "none";

  function tick() {
    if (!row._dragging) {
      pos += SPEED;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0) { row._autoScrollId = requestAnimationFrame(tick); return; }
      if (pos >= max) pos = 0;
      row.scrollLeft = pos;
    } else {
      pos = row.scrollLeft;
    }
    row._autoScrollId = requestAnimationFrame(tick);
  }
  row._autoScrollId = requestAnimationFrame(tick);

  initRowDrag(row);
}

function initRowDrag(row) {
  if (row._dragInit) return;
  row._dragInit = true;

  let startX    = 0;
  let startLeft = 0;
  let hasMoved  = false;

  row.style.cursor = "grab";

  row.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    startX    = e.clientX;
    startLeft = row.scrollLeft;
    hasMoved  = false;
    row.style.cursor = "grabbing";
  }, { passive: true });

  row.addEventListener("pointermove", e => {
    if (e.buttons !== 1) return;
    const dx = e.clientX - startX;
    if (!hasMoved && Math.abs(dx) < 5) return; // threshold: ignore tiny jitter
    hasMoved = true;
    row._dragging = true;
    row.scrollLeft = startLeft - dx;
  }, { passive: true });

  const stopDrag = () => { row._dragging = false; row.style.cursor = "grab"; };
  row.addEventListener("pointerup",     stopDrag);
  row.addEventListener("pointercancel", () => { hasMoved = false; stopDrag(); });

  // Block click from opening manga only if user actually dragged (not just clicked)
  row.addEventListener("click", e => {
    if (hasMoved) {
      e.stopPropagation();
      hasMoved = false;
    }
  }, true); // capture phase — fires before card onclick
}

// ============================================================================
// STATISTICS
// ============================================================================

async function updateStats() {
  try {
    const anaData = await api("/api/analytics");
    state.analytics = anaData;

    const totalLibrary = state.favorites.length;
    const completedCount = anaData.statusDistribution?.completed || 0;
    const chaptersRead = anaData.analytics?.totalChaptersRead || state.readChapters.size;
    const streak = anaData.analytics?.dailyStreak || 0;

    const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
    el("statTotalLibrary", totalLibrary);
    el("statCompleted", completedCount);
    el("statChaptersRead", chaptersRead);
    el("statReadingStreak", streak);
    if ($("libraryCount")) $("libraryCount").textContent = `${totalLibrary} manga`;
  } catch (e) {
    // Non-fatal
  }
}

// ============================================================================
// LIBRARY RENDERING
// ============================================================================

function renderLibrary() {
  const grid = $("library"); // Fixed: was "library-grid", correct ID is "library"
  if (!grid) return;

  const filterVal = $("libraryStatusFilter")?.value || "all";
  const favs = state.favorites.filter(manga => {
    if (filterVal === "all") return true;
    const key = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    return status === filterVal;
  });

  const totalCount = favs.length + (filterVal === "all" ? state.localManga.length : 0);
  if ($("libraryCount")) {
    $("libraryCount").textContent = `${totalCount} manga`;
  }

  const favHTML = favs.map(manga => {
    const key    = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    const statusBadge = status
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    const currentRating = state.ratings[manga.id] || 0;
    const lastChapterId = state.lastReadChapter?.[manga.id];
    const btnLabel = lastChapterId ? "Continue Reading" : "Start Reading";
    return `
      <div class="library-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || state.currentSourceId)}">
        <div class="library-card-cover">
          ${manga.cover && !manga.cover.endsWith('.pdf') ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">` : (manga.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
          ${statusBadge}
          <div class="library-card-overlay">
            <button class="btn-read">${btnLabel}</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${status ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : ""}
          ${currentRating ? `<span class="card-score-badge">${currentRating}<span class="card-score-badge-max">/10</span></span>` : ""}
        </div>
      </div>`;
  }).join("");

  // Local manga section
  const localHTML = (filterVal === "all" && state.localManga.length > 0)
    ? `<div class="local-section-header">&#128193; Local Manga</div>` +
      state.localManga.map(manga => {
        const localRating = state.ratings[manga.id] || 0;
        const localLastChapter = state.lastReadChapter?.[manga.id];
        const localBtnLabel = localLastChapter ? 'Continue Reading' : 'Read';
        return `
        <div class="library-card local-manga-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="local">
          <div class="library-card-cover">
            <img src="/api/local/${escapeHtml(manga.id)}/thumb" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="no-cover" style="display:none">&#128196;</div>
            <div class="local-badge">${escapeHtml((manga.type || 'local').toUpperCase())}</div>
            <button class="local-delete-btn" data-manga-id="${escapeHtml(manga.id)}" title="Delete local manga">&#128465;</button>
            <div class="library-card-overlay"><button class="btn-read">${localBtnLabel}</button></div>
          </div>
          <div class="library-card-info">
            <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
            <p class="library-card-author">${escapeHtml((manga.type || 'local').toUpperCase())}</p>
            ${localRating ? `<span class="card-score-badge">${localRating}<span class="card-score-badge-max">/10</span></span>` : ""}
          </div>
        </div>`;
      }).join("")
    : "";

  if (favs.length === 0 && !localHTML) {
    grid.innerHTML = `<div class="muted">No manga found. Add favorites or import local files!</div>`;
    return;
  }

  grid.innerHTML = favHTML + localHTML;

  grid.querySelectorAll(".library-card:not(.local-manga-card)").forEach(card => {
    const mangaId  = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    card.onclick = async (e) => {
      const prevSource = state.currentSourceId;
      if (sourceId && sourceId !== state.currentSourceId) {
        state.currentSourceId = sourceId;
        renderSourceSelect();
        const srcName = state.installedSources[sourceId]?.name || sourceId;
        showToast("Source switched", srcName, "info");
      }

      // "Continue Reading" overlay button — jump directly to last chapter + page
      if (e.target.closest(".btn-read") && state.lastReadChapter?.[mangaId]) {
        const lastChapterId = state.lastReadChapter[mangaId];
        const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
        try {
          showToast("Resuming...", "", "info");
          // Load manga details silently so state.currentManga is populated
          const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.currentManga = result;
          // Load chapters so state.allChapters is populated
          const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.allChapters = cr.chapters || [];
          const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
          if (idx >= 0) {
            const ch = state.allChapters[idx];
            await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
          } else {
            // Chapter no longer exists — fall back to detail page
            await loadMangaDetails(mangaId, "library");
          }
        } catch (err) {
          showToast("Error", err.message, "error");
        }
        return;
      }

      await loadMangaDetails(mangaId, "library");
      if (!state.currentSourceId) state.currentSourceId = prevSource;
    };
  });

  grid.querySelectorAll(".local-manga-card").forEach(card => {
    const mangaId = card.dataset.mangaId;
    card.onclick = async (e) => {
      if (e.target.closest(".local-delete-btn")) return;
      state.currentSourceId = "local";

      // "Continue Reading" — jump directly to last chapter + page
      if (e.target.closest(".btn-read") && state.lastReadChapter?.[mangaId]) {
        const lastChapterId = state.lastReadChapter[mangaId];
        const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
        try {
          showToast("Resuming...", "", "info");
          const result = await api(`/api/source/local/mangaDetails`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.currentManga = result;
          const cr = await api(`/api/source/local/chapters`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.allChapters = cr.chapters || [];
          const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
          if (idx >= 0) {
            const ch = state.allChapters[idx];
            await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
          } else {
            await loadMangaDetails(mangaId, "library");
          }
        } catch (err) {
          showToast("Error", err.message, "error");
        }
        return;
      }

      await loadMangaDetails(mangaId, "library");
    };
  });

  grid.querySelectorAll(".local-delete-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const mangaId = btn.dataset.mangaId;
      if (!confirm("Delete this local manga?")) return;
      await deleteLocalManga(mangaId);
    };
  });
}

async function loadLocalManga() {
  try {
    const data = await api("/api/local/list");
    state.localManga = data.localManga || [];
  } catch (_) { state.localManga = []; }
}

async function deleteLocalManga(mangaId) {
  try {
    await api(`/api/local/${mangaId}`, { method: "DELETE" });
    state.localManga = state.localManga.filter(m => m.id !== mangaId);
    renderLibrary();
    showToast("Deleted", "Local manga removed", "info");
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

// ============================================================================
// LOCAL MANGA IMPORT MODAL
// ============================================================================
let _importFile = null;

function showImportModal() {
  _importFile = null;
  if ($("importTitleInput"))  $("importTitleInput").value  = "";
  if ($("importFileName"))   { $("importFileName").textContent = ""; $("importFileName").classList.add("hidden"); }
  if ($("importProgress"))   $("importProgress").classList.add("hidden");
  if ($("importError"))      { $("importError").textContent = ""; $("importError").classList.add("hidden"); }
  if ($("importSubmitBtn"))  $("importSubmitBtn").disabled = true;
  if ($("importFileInput"))  $("importFileInput").value = "";
  $("importLocalModal").classList.remove("hidden");

  // Drag and drop
  const zone = $("importDropZone");
  if (zone && !zone._ddBound) {
    zone._ddBound = true;
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drop-active"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop-active"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("drop-active");
      const file = e.dataTransfer.files[0];
      if (file) setImportFile(file);
    });
  }
}

function closeImportModal() {
  $("importLocalModal").classList.add("hidden");
  _importFile = null;
}

function onImportFileSelected(event) {
  const file = event.target.files[0];
  if (file) setImportFile(file);
}

function setImportFile(file) {
  const allowed = ['.cbz', '.cbr', '.pdf'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    if ($("importError")) { $("importError").textContent = "Unsupported format. Use CBZ, CBR or PDF."; $("importError").classList.remove("hidden"); }
    return;
  }
  _importFile = file;
  if ($("importFileName"))  { $("importFileName").textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`; $("importFileName").classList.remove("hidden"); }
  if ($("importError"))     $("importError").classList.add("hidden");
  if ($("importSubmitBtn")) $("importSubmitBtn").disabled = false;
  // Pre-fill title from filename if empty
  const titleInput = $("importTitleInput");
  if (titleInput && !titleInput.value) {
    titleInput.value = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[_\-]+/g, ' ');
  }
}

async function submitImport() {
  if (!_importFile) return;
  const title = $("importTitleInput")?.value?.trim() || "";
  const submitBtn = $("importSubmitBtn");
  const progressEl = $("importProgress");
  const errorEl   = $("importError");
  const fillEl    = $("importProgressFill");
  const labelEl   = $("importProgressLabel");

  if (submitBtn) submitBtn.disabled = true;
  if (errorEl)  { errorEl.textContent = ""; errorEl.classList.add("hidden"); }
  if (progressEl) progressEl.classList.remove("hidden");
  if (fillEl)   fillEl.style.width = "10%";
  if (labelEl)  labelEl.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("file", _importFile);
    if (title) formData.append("title", title);

    // Simulate progress while uploading
    let pct = 10;
    const progTimer = setInterval(() => {
      pct = Math.min(pct + 5, 85);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (labelEl) labelEl.textContent = pct < 50 ? "Uploading..." : "Extracting...";
    }, 400);

    const resp = await fetch("/api/local/import", { method: "POST", body: formData });
    clearInterval(progTimer);

    if (fillEl)   fillEl.style.width = "100%";
    if (labelEl)  labelEl.textContent = "Done!";

    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || "Import failed");

    state.localManga.push(data.manga);

    // For PDFs, render page 1 via PDF.js and upload as cover image
    if (_importFile.name.toLowerCase().endsWith('.pdf') && window.pdfjsLib && data.manga?.id) {
      try {
        if (labelEl) labelEl.textContent = "Generating cover...";
        const fileUrl = URL.createObjectURL(_importFile);
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        URL.revokeObjectURL(fileUrl);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
        if (blob) {
          const coverResp = await fetch(`/api/local/${data.manga.id}/cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          });
          if (coverResp.ok) {
            const coverData = await coverResp.json();
            data.manga.cover = coverData.cover;
            const idx = state.localManga.findIndex(m => m.id === data.manga.id);
            if (idx !== -1) state.localManga[idx].cover = coverData.cover;
          }
        }
      } catch (coverErr) {
        console.warn('Cover generation failed:', coverErr);
      }
    }

    showToast("Imported!", data.manga.title, "success");
    setTimeout(() => {
      closeImportModal();
      renderLibrary();
    }, 600);
  } catch (e) {
    if (progressEl) progressEl.classList.add("hidden");
    if (errorEl)    { errorEl.textContent = e.message; errorEl.classList.remove("hidden"); }
    if (submitBtn)  submitBtn.disabled = false;
  }
}

async function generateMissingPDFCovers() {
  // Wait up to 10 s for PDF.js to load from CDN
  if (!window.pdfjsLib) {
    await new Promise(resolve => {
      let waited = 0;
      const iv = setInterval(() => {
        waited += 250;
        if (window.pdfjsLib || waited >= 10000) { clearInterval(iv); resolve(); }
      }, 250);
    });
  }
  if (!window.pdfjsLib) return;
  const pending = state.localManga.filter(m => m.cover && m.cover.endsWith('.pdf'));
  for (const manga of pending) {
    try {
      const pdf = await pdfjsLib.getDocument(manga.cover).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) continue;
      const resp = await fetch(`/api/local/${manga.id}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob
      });
      if (resp.ok) {
        const data = await resp.json();
        manga.cover = data.cover;
      }
    } catch (e) {
      console.warn(`Cover generation failed for ${manga.id}:`, e);
    }
  }
  if (pending.length > 0) renderLibrary();
}

// ============================================================================
// READING STATUS
// ============================================================================

async function loadReadingStatus() {
  try {
    const data = await api("/api/user/status");
    state.readingStatus = data.readingStatus || {};
  } catch (e) { /* non-fatal */ }
}

function getMangaStatus(mangaId, sourceId) {
  return state.readingStatus[`${mangaId}:${sourceId}`]?.status || null;
}

function renderReadingStatusSection(mangaId, sourceId) {
  const section = $("readingStatusSection");
  if (!section) return;
  const current = getMangaStatus(mangaId, sourceId);
  section.innerHTML = `
    <div class="status-selector-section">
      <span class="status-selector-label">Reading Status:</span>
      <select class="status-select" id="mangaStatusSelect">
        <option value="none" ${!current ? "selected" : ""}>— Not Set —</option>
        <option value="reading"      ${current === "reading"       ? "selected" : ""}>Reading</option>
        <option value="completed"    ${current === "completed"     ? "selected" : ""}>Completed</option>
        <option value="on_hold"      ${current === "on_hold"       ? "selected" : ""}>On Hold</option>
        <option value="plan_to_read" ${current === "plan_to_read"  ? "selected" : ""}>Plan to Read</option>
        <option value="dropped"      ${current === "dropped"       ? "selected" : ""}>Dropped</option>
      </select>
      ${current ? `<span class="status-badge status-badge-${current}">${statusLabel(current)}</span>` : ""}
    </div>
  `;
  $("mangaStatusSelect").onchange = async (e) => {
    const newStatus = e.target.value;
    try {
      await api("/api/user/status", {
        method: "POST",
        body: JSON.stringify({
          mangaId, sourceId, status: newStatus,
          mangaData: state.currentManga || {}
        })
      });
      state.readingStatus[`${mangaId}:${sourceId}`] = newStatus !== "none"
        ? { status: newStatus, updatedAt: new Date().toISOString() }
        : undefined;
      if (newStatus === "none") delete state.readingStatus[`${mangaId}:${sourceId}`];
      showToast("Status Updated", statusLabel(newStatus), "success");
      renderReadingStatusSection(mangaId, sourceId);
      renderLibrary();
      await checkAndUnlockAchievements();
    } catch (err) {
      showToast("Error", err.message, "error");
    }
  };
}

// ============================================================================
// SEARCH & MANGA DETAILS
// ============================================================================

let _liveSearchTimer = null;

// ── Pagination helper ───────────────────────────────────────────────────────
function renderPagination(containerId, currentPage, hasNextPage, callbackName) {
  const container = $(containerId);
  if (!container) return;
  if (currentPage === 1 && !hasNextPage) {
    container.innerHTML = "";
    return;
  }
  const btn = (page, label, active = false, disabled = false) =>
    active
      ? `<button class="pagination-number active">${label}</button>`
      : `<button class="pagination-number${disabled ? " disabled" : ""}" ${
          disabled ? "disabled" : `onclick="${callbackName}(${page})"`
        }>${label}</button>`;

  let nums = "";
  if (currentPage > 2) nums += btn(1, "1");
  if (currentPage > 3) nums += `<span class="pagination-ellipsis">…</span>`;
  if (currentPage > 1) nums += btn(currentPage - 1, currentPage - 1);
  nums += btn(currentPage, currentPage, true);
  if (hasNextPage) nums += btn(currentPage + 1, currentPage + 1);

  container.innerHTML = `
    <div class="pagination">
      <button class="pagination-btn" ${
        currentPage <= 1 ? "disabled" : `onclick="${callbackName}(${currentPage - 1})"`
      }>← Prev</button>
      <div class="pagination-numbers">${nums}</div>
      <button class="pagination-btn" ${
        !hasNextPage ? "disabled" : `onclick="${callbackName}(${currentPage + 1})"`
      }>Next →</button>
    </div>
  `;
}

function searchGoToPage(page) {
  state.searchPage = page;
  window.scrollTo({ top: 0, behavior: "smooth" });
  search(page);
}

function advSearchGoToPage(page) {
  state.advSearchPage = page;
  window.scrollTo({ top: 0, behavior: "smooth" });
  advancedSearch(page);
}

// ── Main search ─────────────────────────────────────────────────────────────
async function search(page = 1) {
  const query = $("searchInput").value.trim();
  const dropdown = $("searchDropdown");
  if (!state.currentSourceId) { $("searchStatus").textContent = "Select a source first."; return; }
  if (!query) {
    if (dropdown) dropdown.innerHTML = "";
    $("searchStatus").textContent = "";
    const pg = $("searchPagination"); if (pg) pg.innerHTML = "";
    return;
  }

  state.searchQuery = query;
  state.searchPage = page;
  $("searchStatus").textContent = "Searching...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, page })
    });
    const results = result.results || [];
    const hasNextPage = result.hasNextPage || false;
    state.searchHasNextPage = hasNextPage;
    if (!dropdown) return;
    if (!results.length) {
      dropdown.innerHTML = `<div class="muted" style="padding:1rem">No results found for "${escapeHtml(query)}"</div>`;
      $("searchStatus").textContent = "0 result(s) found";
      renderPagination("searchPagination", page, false, "searchGoToPage");
    } else {
      dropdown.innerHTML = results.map(m => mangaCardHTML(m)).join("");
      bindMangaCards(dropdown);
      $("searchStatus").textContent = `${results.length} result(s) found — Page ${page}`;
      renderPagination("searchPagination", page, hasNextPage, "searchGoToPage");
    }
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
    const pg = $("searchPagination"); if (pg) pg.innerHTML = "";
  }
}

function toggleSourceSwitchDropdown(e) {
  e.stopPropagation();
  const dropdown = $("sourceSwitchDropdown");
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  // Close any other open ones first
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
  if (isHidden) {
    // Rebuild items in case sources changed
    const installed = Object.values(state.installedSources).filter(s => s.id !== state.currentSourceId);
    if (installed.length === 0) { showToast("No other sources installed", "", "info"); return; }
    const title = state.currentManga?.title || "";
    dropdown.innerHTML = installed.map(s =>
      `<button class="source-switch-item" onclick="switchToSourceSearch('${escapeHtml(s.id)}','${escapeHtml(title.replace(/'/g, "\\'"))}')">${escapeHtml(s.name)}</button>`
    ).join("");
    dropdown.classList.remove("hidden");
    setTimeout(() => document.addEventListener("click", _closeSrcDropdown, { once: true }), 0);
  }
}

function _closeSrcDropdown() {
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
}

async function switchToSourceSearch(sourceId, title) {
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
  if (!title) return;
  showToast(`Searching in ${state.installedSources[sourceId]?.name || sourceId}...`, title, "info");
  try {
    const result = await api(`/api/source/${sourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: title, page: 1 })
    });
    const results = result.results || [];
    if (results.length === 0) {
      showToast("Not found", `"${title}" not found in ${state.installedSources[sourceId]?.name || sourceId}`, "info");
      return;
    }
    // Switch source globally and open first result
    state.currentSourceId = sourceId;
    const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
    selectors.forEach(s => { if (s) s.value = sourceId; });
    loadMangaDetails(results[0].id);
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

async function loadMangaDetails(mangaId, fromView = "discover") {
  $("searchStatus").textContent = "Loading details...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const isFavorited = state.favorites.some(m => m.id === result.id && m.sourceId === state.currentSourceId);
    const hasProgress = state.lastReadChapter?.[result.id];

    // Navigate with context
    setView("manga-details", {
      mangaId: mangaId,
      sourceId: state.currentSourceId,
      scrollPosition: 0
    });

    // Render detail card
    $("details").innerHTML = `
      <div class="manga-details">
        ${result.cover && !result.cover.endsWith('.pdf') ? `
          <div class="manga-cover">
            <a href="${escapeHtml(`https://anilist.co/search/manga?search=${encodeURIComponent(result.title)}`)}" target="_blank" rel="noopener noreferrer" class="cover-anilist-link" title="View on AniList" onclick="event.stopPropagation()">
              <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
              <div class="cover-anilist-hint">View on AniList</div>
            </a>
          </div>` : (result.cover ? `<div class="manga-cover"><div class="no-cover" style="height:100%;font-size:4rem;">&#128196;</div></div>` : "")}
        <div class="manga-info">
          <h2 class="manga-title">${escapeHtml(result.title)}</h2>
          ${result.altTitle ? `<p class="manga-alt-title">${escapeHtml(result.altTitle)}</p>` : ""}
          ${result.author  ? `<p class="manga-author"><span class="author-link" data-author="${escapeHtml(result.author)}" onclick="searchByAuthor(this.dataset.author)">${escapeHtml(result.author)}</span></p>` : ""}
          <div class="manga-meta">
            ${result.status ? `<span class="badge badge-${result.status === 'ongoing' ? 'success' : 'secondary'}">${escapeHtml(result.status)}</span>` : ""}
            ${result.year   ? `<span class="badge">${escapeHtml(String(result.year))}</span>` : ""}
            <span class="source-switch-wrap">
              <span class="badge badge-source source-switch-btn" id="sourceSwitchBtn" onclick="toggleSourceSwitchDropdown(event)" title="Switch source">${escapeHtml(state.installedSources[state.currentSourceId]?.name || state.currentSourceId)} ▾</span>
              <div class="source-switch-dropdown hidden" id="sourceSwitchDropdown">
                ${Object.values(state.installedSources).filter(s => s.id !== state.currentSourceId).map(s =>
                  `<button class="source-switch-item" onclick="switchToSourceSearch('${escapeHtml(s.id)}','${escapeHtml(result.title.replace(/'/g, "\\'"))}')">${escapeHtml(s.name)}</button>`
                ).join('')}
              </div>
            </span>
            <span class="badge badge-adaptation-check" id="adaptationCheckBtn" onclick="checkAnimeAdaptation('${escapeHtml(result.title.replace(/'/g, "\\'"))}')">Check</span>
          </div>
          <div id="adaptationResult"></div>
          ${result.genres?.length ? `
            <div class="manga-genres">
              ${result.genres.map(g => `<span class="genre-tag" data-genre="${escapeHtml(g)}" title="Search: ${escapeHtml(g)}">${escapeHtml(g)}</span>`).join("")}
            </div>` : ""}
          ${result.description ? `
            <div class="manga-description">
              <p>${escapeHtml(result.description)}</p>
            </div>` : ""}
          <div class="manga-actions">
            <button class="btn" id="addFavBtn">
              ${isFavorited ? "Remove from Library" : "Add to Library"}
            </button>
            <button class="btn btn-start-reading-detail" id="startReadingBtn">&#9654; Start Reading</button>
            ${hasProgress ? `<button class="btn btn-continue" id="continueReadingBtn">Continue</button>` : ""}
            ${fromView === 'random' ? `<button class="btn btn-reroll" id="rerollBtn" title="Pick another random manga">Reroll</button>` : ""}
          </div>
          <div id="detailRatingWrap" class="detail-rating-wrap"></div>
        </div>
      </div>
    `;

    // Reroll random
    if ($('rerollBtn')) $('rerollBtn').onclick = () => randomManga();

    // Favorites toggle
    $("addFavBtn").onclick = async () => {
      try {
        const res = await api("/api/favorites/toggle", {
          method: "POST",
          body: JSON.stringify({ mangaId: result.id, sourceId: state.currentSourceId, manga: result })
        });
        $("addFavBtn").textContent = res.isFavorite ? "Remove from Library" : "Add to Library";
        state.favorites = res.favorites;
        showToast(res.isFavorite ? "Added to Library" : "Removed from Library", result.title, res.isFavorite ? "success" : "info");
        renderLibrary();
        await updateStats();
        await checkAndUnlockAchievements();
      } catch (e) { showToast("Error", e.message, "error"); }
    };

    // Start reading (first chapter)
    $("startReadingBtn").onclick = async () => {
      if (!state.allChapters?.length) {
        showToast("Loading chapters...", "", "info");
        return;
      }
      const firstIdx = state.allChapters.length - 1;
      const ch = state.allChapters[firstIdx];
      await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
    };

    // Continue reading
    if (hasProgress) {
      $("continueReadingBtn").onclick = async () => {
        const lastChapterId = state.lastReadChapter[result.id];
        const lastPageIndex = state.lastReadPages[`${result.id}:${lastChapterId}`] || 0;
        try {
          const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
            method: "POST",
            body: JSON.stringify({ mangaId: result.id })
          });
          state.allChapters = cr.chapters || [];
          const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
          if (idx >= 0) {
            const ch = state.allChapters[idx];
            await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
          } else {
            showToast("Chapter not found", "It may have been removed.", "error");
          }
        } catch (e) { showToast("Error", e.message, "error"); }
      };
    }

    // Genre tag navigation
    $("details").querySelectorAll(".genre-tag[data-genre]").forEach(tag => {
      tag.onclick = (e) => { e.stopPropagation(); searchByGenre(tag.dataset.genre); };
    });

    // Rating widget
    renderDetailRating(result.id);

    // Render reading status
    renderReadingStatusSection(result.id, state.currentSourceId);
    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

function renderDetailRating(mangaId) {
  const wrap = $("detailRatingWrap");
  if (!wrap) return;
  const current = state.ratings[mangaId] || 0;
  wrap.innerHTML = `
    <div class="detail-rating-row" data-manga-id="${escapeHtml(mangaId)}">
      <span class="detail-rating-label">Rating</span>
      <div class="detail-rating-btns">
        ${Array.from({length: 10}, (_, i) => {
          const v = i + 1;
          return `<button class="card-score-btn detail-score-btn${v <= current ? ' active' : ''}" data-score="${v}">${v}</button>`;
        }).join("")}
      </div>
      ${current ? `<span class="detail-rating-current">${current}<span class="detail-rating-max">/10</span></span>` : ""}
      ${current ? `<button class="detail-rating-clear" title="Clear rating">\u2715</button>` : ""}
    </div>
  `;
  const row = wrap.querySelector(".detail-rating-row");
  row.querySelectorAll(".detail-score-btn").forEach(btn => {
    btn.onmouseenter = () => {
      const v = Number(btn.dataset.score);
      row.querySelectorAll(".detail-score-btn").forEach(b => b.classList.toggle("hover", Number(b.dataset.score) <= v));
    };
    btn.onmouseleave = () => row.querySelectorAll(".detail-score-btn").forEach(b => b.classList.remove("hover"));
    btn.onclick = async () => {
      const score = Number(btn.dataset.score);
      const newScore = state.ratings[mangaId] === score ? null : score;
      try {
        if (newScore) {
          await api("/api/reviews", { method: "POST", body: JSON.stringify({ mangaId, rating: newScore, text: "" }) });
          state.ratings[mangaId] = newScore;
        } else {
          await api(`/api/ratings/${mangaId}`, { method: "DELETE" });
          delete state.ratings[mangaId];
        }
        renderDetailRating(mangaId);
        renderLibrary();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });
  const clearBtn = wrap.querySelector(".detail-rating-clear");
  if (clearBtn) {
    clearBtn.onclick = async () => {
      try {
        await api(`/api/ratings/${mangaId}`, { method: "DELETE" });
        delete state.ratings[mangaId];
        renderDetailRating(mangaId);
        renderLibrary();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  }
}

// ============================================================================
// ADD TO LIST MODAL
// ============================================================================
// CHAPTERS MANAGEMENT
// ============================================================================

async function loadChapters() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");
  chapDiv.innerHTML = `<div class="muted">Loading chapters...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId: state.currentManga.id })
    });
    state.allChapters = result.chapters || [];
    state.chaptersReversed = false;
    renderChaptersList();
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

function renderChaptersList() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");

  let displayChapters = state.allChapters;
  if (state.settings.skipReadChapters) {
    displayChapters = state.allChapters.filter(ch => !isChapterRead(state.currentManga.id, ch.id));
  }
  if (state.chaptersReversed) {
    displayChapters = [...displayChapters].reverse();
  }

  if (!displayChapters.length) {
    chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "All chapters read" : "No chapters found"}</div>`;
    return;
  }

  const reverseIcon = state.chaptersReversed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;

  chapDiv.innerHTML = `
    <div class="chapters-header">
      <strong>${displayChapters.length} Chapter${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Unread" : "Available"}</strong>
      <div class="chapters-header-actions">
        <button class="btn-reverse-chapters ${state.chaptersReversed ? 'btn-reverse-active' : ''}" id="reverseChaptersBtn" title="${state.chaptersReversed ? 'Oldest first (reversed)' : 'Newest first (default)'}">
          ${reverseIcon}
          ${state.chaptersReversed ? "Oldest First" : "Newest First"}
        </button>
        <button class="btn-check-integrity" id="checkIntegrityBtn" title="Check Chapter Integrity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Check Integrity
        </button>
        ${state.currentSourceId !== 'local' ? `<button class="btn-download-bulk" id="downloadBulkBtn" title="Save chapters for offline reading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Offline
        </button>` : ''}
      </div>
    </div>
    <div id="integrityReport"></div>
    <div class="chapters-list">
      ${displayChapters.map((ch, i) => {
        const isRead    = isChapterRead(state.currentManga.id, ch.id);
        const realIndex = state.allChapters.findIndex(c => c.id === ch.id);
        const isFlagged = state.flaggedChapters.has(`${state.currentManga.id}:${ch.id}`);
        return `
          <div class="chapter-item ${isRead ? 'chapter-read' : ''} ${isFlagged ? 'chapter-flagged' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
            <div class="chapter-info">
              <div class="chapter-name">${isFlagged ? '<span class="chapter-flag-icon">&#x1F6A9;</span> ' : ''}${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</div>
              ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</div>` : ""}
            </div>
            <div class="chapter-action">
              ${isRead ? `<span class="read-badge">&#x2713;</span>` : ""}
              ${state.currentSourceId !== 'local' ? `<button class="btn-save-offline" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}" title="Save for offline reading" onclick="event.stopPropagation();"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>` : ''}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  chapDiv.querySelectorAll(".chapter-item[data-chapter-id]").forEach(el => {
    el.onclick = () => loadChapter(
      el.dataset.chapterId,
      el.dataset.chapterName,
      parseInt(el.dataset.chapterIndex)
    );
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showChapterContextMenu(e, el.dataset.chapterId, state.currentManga?.id);
    });
  });

  // Save individual chapters for offline reading
  chapDiv.querySelectorAll(".btn-save-offline").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await saveChapterOffline(btn.dataset.chapterId, btn.dataset.chapterName);
    };
  });

  // Reverse order button
  const reverseBtn = $("reverseChaptersBtn");
  if (reverseBtn) {
    reverseBtn.onclick = () => {
      state.chaptersReversed = !state.chaptersReversed;
      renderChaptersList();
    };
  }

  // Bulk download button
  const bulkBtn = $("downloadBulkBtn");
  if (bulkBtn) {
    bulkBtn.onclick = () => showBulkDownloadModal(displayChapters);
  }

  // Check integrity button
  const integrityBtn = $("checkIntegrityBtn");
  if (integrityBtn) {
    integrityBtn.onclick = () => checkChapterIntegrity(state.allChapters);
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
  _bookFlipAnimating = false;
  _ltrFlipAnimating  = false;
  $("searchStatus").textContent = "Loading chapter...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });
    state.currentChapter      = result;
    state.currentChapter.name = chapterName;
    state.currentChapter.id   = chapterId;
    state.currentChapterIndex = chapterIndex;

    // PDF: load via PDF.js to get page count, build synthetic pages array
    if (result.isPDF && result.pdfUrl) {
      await initPDFChapter(result.pdfUrl);
    }

    const maxIndex = Math.max((state.currentChapter.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);
    // Keep zoom level between chapters — only reset if it was never set

    markChapterAsRead(state.currentManga.id, chapterId);
    state.readerSessionStart = Date.now();

    api("/api/history/add", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga.id,
        sourceId: state.currentSourceId,
        manga: state.currentManga,
        chapterId
      })
    }).then(() => {
      // Keep in-memory history in sync (with full manga object including genres)
      const existing = state.history.findIndex(
        m => m.id === state.currentManga.id && m.sourceId === state.currentSourceId
      );
      const entry = { ...state.currentManga, sourceId: state.currentSourceId, chapterId, readAt: new Date().toISOString() };
      if (existing >= 0) state.history.splice(existing, 1);
      state.history.unshift(entry);
      state.history = state.history.slice(0, 100);
      // Refresh recommendations so "Based on:" label reflects updated consumption
      loadRecommendations();
    }).catch(() => {});

    showReader();
    renderPage();
    $("searchStatus").textContent = "";
    loadChapters();
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

// ============================================================================
// CHAPTER NAVIGATION
// ============================================================================

function getNextChapterIndex(currentIndex) {
  // Chapters are sorted newest-first, so "next" chapter = lower index
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex - 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex - 1;
}

function getPrevChapterIndex(currentIndex) {
  // Chapters are sorted newest-first, so "prev" chapter = higher index
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex + 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex + 1; i < state.allChapters.length; i++) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex + 1;
}

async function goToNextChapter() {
  const next = getNextChapterIndex(state.currentChapterIndex);
  if (next < 0 || next >= (state.allChapters?.length || 0)) {
    showToast("Last chapter reached", "", "info"); return;
  }
  const ch = state.allChapters[next];
  if (!ch) { showToast("Last chapter reached", "", "info"); return; }
  await recordReadingSession();
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || next + 1}`, next);
}

async function goToPrevChapter() {
  const prev = getPrevChapterIndex(state.currentChapterIndex);
  if (prev >= state.allChapters.length) { showToast("First chapter reached", "", "info"); return; }
  await recordReadingSession();
  const ch = state.allChapters[prev];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || prev + 1}`, prev);
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

async function downloadChapter(chapterId, chapterName) {
  try {
    showToast("Download Started", `Downloading ${chapterName}...`, "info");

    // Get chapter pages
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });

    if (!result.pages || result.pages.length === 0) {
      showToast("Error", "No pages found for this chapter", "error");
      return;
    }

    // Request CBZ from server (binary response)
    const resp = await fetch("/api/download/chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        chapterName,
        chapterId,
        sourceId: state.currentSourceId,
        pages: result.pages
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast("Error", err.error || "Download failed", "error");
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const filename = (resp.headers.get("Content-Disposition") || "").match(/filename="(.+?)"/)?.at(1)
      || `${chapterName}.cbz`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Download Complete", `${chapterName} downloaded as CBZ!`, "success");
  } catch (e) {
    showToast("Error", `Download failed: ${e.message}`, "error");
  }
}

function showBulkDownloadModal(chapters) {
  // Create modal HTML
  const modalHtml = `
    <div class="modal-overlay" id="bulkDownloadModal">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>Save Chapters Offline</h2>
          <button class="modal-close" onclick="closeBulkDownloadModal()">&#x2715;</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Select chapters to save for offline reading:</p>
          <div class="bulk-download-controls">
            <button class="btn btn-sm" onclick="selectAllChapters()">Select All</button>
            <button class="btn btn-sm" onclick="deselectAllChapters()">Deselect All</button>
            <span class="selected-count">0 selected</span>
          </div>
          <div class="bulk-chapters-list" id="bulkChaptersList">
            ${chapters.map((ch, i) => `
              <label class="bulk-chapter-item">
                <input type="checkbox" class="bulk-chapter-checkbox" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
                <span>${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeBulkDownloadModal()">Cancel</button>
          <button class="btn btn-save-bulk-offline" id="confirmBulkSaveOffline">Save Selected</button>
        </div>
      </div>
    </div>
  `;

  // Add modal to page
  const existing = $("bulkDownloadModal");
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Update count on checkbox change
  const updateCount = () => {
    const checked = document.querySelectorAll('.bulk-chapter-checkbox:checked').length;
    document.querySelector('.selected-count').textContent = `${checked} selected`;
  };

  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => {
    cb.addEventListener('change', updateCount);
  });

  // Confirm save offline button
  $("confirmBulkSaveOffline").onclick = async () => {
    const selected = Array.from(document.querySelectorAll('.bulk-chapter-checkbox:checked'))
      .map(cb => ({ id: cb.dataset.chapterId, name: cb.dataset.chapterName }));

    if (selected.length === 0) {
      showToast("No Selection", "Please select at least one chapter", "warning");
      return;
    }

    closeBulkDownloadModal();
    await saveBulkOffline(selected);
  };
}

window.closeBulkDownloadModal = function() {
  const modal = $("bulkDownloadModal");
  if (modal) modal.remove();
};

window.selectAllChapters = function() {
  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => cb.checked = true);
  const count = document.querySelectorAll('.bulk-chapter-checkbox').length;
  document.querySelector('.selected-count').textContent = `${count} selected`;
};

window.deselectAllChapters = function() {
  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => cb.checked = false);
  document.querySelector('.selected-count').textContent = `0 selected`;
};

async function downloadBulkChapters(selectedChapters) {
  // Step 1 — start the job on the server
  let jobId;
  try {
    const startResp = await fetch("/api/download/bulk/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        sourceId: state.currentSourceId,
        chapters: selectedChapters
      })
    });
    if (!startResp.ok) {
      const err = await startResp.json().catch(() => ({}));
      showToast("Error", err.error || "Could not start download", "error");
      return;
    }
    ({ jobId } = await startResp.json());
  } catch (e) {
    showToast("Error", `Bulk download failed: ${e.message}`, "error");
    return;
  }

  // Step 2 — show progress modal and listen to SSE
  showBulkProgressModal(selectedChapters.length);

  await new Promise((resolve) => {
    const es = new EventSource(`/api/download/bulk/progress/${jobId}`);

    es.addEventListener('progress', (e) => {
      const { done, total, chapter } = JSON.parse(e.data);
      updateBulkProgress(done, total, chapter);
    });

    es.addEventListener('done', async () => {
      es.close();
      updateBulkProgress(selectedChapters.length, selectedChapters.length, '');

      // Step 3 — trigger file download
      const link = document.createElement('a');
      link.href = `/api/download/bulk/file/${jobId}`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => closeBulkProgressModal(), 800);
      showToast("Download Complete", `${selectedChapters.length} chapters saved as CBZ!`, "success");
      resolve();
    });

    es.addEventListener('error', (e) => {
      es.close();
      const msg = e.data ? JSON.parse(e.data).error : 'Unknown error';
      closeBulkProgressModal();
      showToast("Error", msg || "Bulk download failed", "error");
      resolve();
    });
  });
}

function showBulkProgressModal(total) {
  const existing = $("bulkProgressModal");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="bulkProgressModal">
      <div class="modal-content bulk-progress-modal">
        <div class="modal-header">
          <h2>Downloading...</h2>
        </div>
        <div class="modal-body">
          <div class="bulk-progress-chapter" id="bulkProgressChapter">Starting...</div>
          <div class="bulk-progress-bar-wrap">
            <div class="bulk-progress-bar" id="bulkProgressBar" style="width:0%"></div>
          </div>
          <div class="bulk-progress-count" id="bulkProgressCount">0 / ${total}</div>
        </div>
      </div>
    </div>
  `);
}

function updateBulkProgress(done, total, chapter) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = $("bulkProgressBar");
  const count = $("bulkProgressCount");
  const chEl = $("bulkProgressChapter");
  if (bar) bar.style.width = pct + '%';
  if (count) count.textContent = `${done} / ${total}`;
  if (chEl && chapter) chEl.textContent = chapter;
}

window.closeBulkProgressModal = function() {
  const m = $("bulkProgressModal");
  if (m) m.remove();
};

// ============================================================================
// OFFLINE SAVE
// ============================================================================

async function saveChapterOffline(chapterId, chapterName) {
  showToast("Saving...", `Saving "${chapterName}" for offline reading`, "info");
  try {
    const resp = await fetch("/api/local/save-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: state.currentSourceId,
        chapterId,
        chapterName,
        mangaTitle: state.currentManga?.title || "Unknown",
        mangaId: state.currentManga?.id || "",
        cover: state.currentManga?.cover || ""
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast("Error", err.error || "Could not save chapter offline", "error");
      return;
    }
    const data = await resp.json();
    if (data.skipped) {
      showToast("Already Saved", `"${chapterName}" is already in your offline library`, "info");
    } else {
      showToast("Saved Offline", `"${chapterName}" saved. Open the Library tab to read it offline.`, "success");
    }
  } catch (e) {
    showToast("Error", `Save offline failed: ${e.message}`, "error");
  }
}

async function saveBulkOffline(selectedChapters) {
  // Step 1 — start the save job on the server
  let jobId;
  try {
    const startResp = await fetch("/api/local/save-bulk/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: state.currentSourceId,
        mangaTitle: state.currentManga?.title || "Unknown",
        mangaId: state.currentManga?.id || "",
        cover: state.currentManga?.cover || "",
        chapters: selectedChapters
      })
    });
    if (!startResp.ok) {
      const err = await startResp.json().catch(() => ({}));
      showToast("Error", err.error || "Could not start offline save", "error");
      return;
    }
    ({ jobId } = await startResp.json());
  } catch (e) {
    showToast("Error", `Offline save failed: ${e.message}`, "error");
    return;
  }

  // Step 2 — show progress modal and listen to SSE
  showBulkProgressModal(selectedChapters.length);
  const saveModal = $("bulkProgressModal");
  if (saveModal) {
    const h2 = saveModal.querySelector("h2");
    if (h2) h2.textContent = "Saving Offline...";
  }

  await new Promise((resolve) => {
    const es = new EventSource(`/api/local/save-bulk/progress/${jobId}`);

    es.addEventListener('progress', (e) => {
      const { done, total, chapter } = JSON.parse(e.data);
      updateBulkProgress(done, total, chapter);
    });

    es.addEventListener('done', () => {
      es.close();
      updateBulkProgress(selectedChapters.length, selectedChapters.length, '');
      setTimeout(() => closeBulkProgressModal(), 800);
      showToast("Saved to Library", `${selectedChapters.length} chapter(s) saved. Open the Library tab to read offline.`, "success");
      resolve();
    });

    es.addEventListener('error', (e) => {
      es.close();
      const msg = e.data ? JSON.parse(e.data).error : 'Unknown error';
      closeBulkProgressModal();
      showToast("Error", msg || "Offline save failed", "error");
      resolve();
    });
  });
}

// ============================================================================
// CHAPTER INTEGRITY CHECK
// ============================================================================

function checkChapterIntegrity(chapters) {
  if (!chapters || chapters.length === 0) {
    showToast("No Chapters", "No chapters available to check", "info");
    return;
  }

  analyzeChapterIntegrityWithMangaUpdates(chapters, state.currentManga);
}

async function analyzeChapterIntegrityWithMangaUpdates(chapters, mangaDetails = null) {
  const report = analyzeChapterIntegrity(chapters, mangaDetails);
  
  // If no external data, try to fetch from MangaUpdates
  if (!mangaDetails?.lastChapter && state.currentManga?.title) {
    try {
      const response = await api("/api/mangaupdates/search", {
        method: "POST",
        body: JSON.stringify({ title: state.currentManga.title })
      });
      
      if (response.found && response.latestChapter) {
        // Re-analyze with MangaUpdates data
        const enhancedMangaDetails = {
          ...mangaDetails,
          lastChapter: response.latestChapter,
          status: response.status,
          mangaUpdatesUrl: response.url
        };
        const enhancedReport = analyzeChapterIntegrity(chapters, enhancedMangaDetails);
        displayIntegrityReport(enhancedReport, response);
        return;
      }
    } catch (e) {
      console.warn("MangaUpdates lookup failed:", e.message);
    }
  }
  
  displayIntegrityReport(report);
}

function analyzeChapterIntegrity(chapters, mangaDetails = null) {
  const issues = [];
  const warnings = [];
  const info = [];

  // Extract chapter numbers (handles numeric strings and "Chapter X" style names)
  const chapterNumbers = chapters
    .map(ch => {
      const direct = parseFloat(ch.chapter);
      if (!isNaN(direct)) return direct;
      // Fallback: extract the first number from strings like "Chapter 1191"
      const match = String(ch.chapter || ch.name || '').match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : NaN;
    })
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b);

  if (chapterNumbers.length === 0) {
    issues.push("No valid chapter numbers found");
    return { issues, warnings, info, stats: {} };
  }

  // Statistics
  const stats = {
    total: chapters.length,
    withNumbers: chapterNumbers.length,
    minChapter: Math.min(...chapterNumbers),
    maxChapter: Math.max(...chapterNumbers),
    range: Math.max(...chapterNumbers) - Math.min(...chapterNumbers) + 1
  };

  // Use external data if available (from manga details)
  const expectedTotalChapters = mangaDetails?.lastChapter 
    ? parseFloat(mangaDetails.lastChapter) 
    : null;

  info.push(`Total chapters available: ${stats.total}`);
  info.push(`Chapter range: ${stats.minChapter} - ${stats.maxChapter}`);
  
  if (expectedTotalChapters) {
    info.push(`Expected total chapters: ${expectedTotalChapters} (from source)`);
  }

  // Check for duplicates
  const duplicates = chapterNumbers.filter((num, idx) => 
    chapterNumbers.indexOf(num) !== idx
  );
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    warnings.push(`${uniqueDuplicates.length} duplicate chapter(s): ${uniqueDuplicates.slice(0, 5).join(', ')}${uniqueDuplicates.length > 5 ? '...' : ''}`);
  }

  // Check for gaps in sequence
  const gaps = [];
  for (let i = 0; i < chapterNumbers.length - 1; i++) {
    const current = chapterNumbers[i];
    const next = chapterNumbers[i + 1];
    const diff = next - current;
    
    if (diff > 1.5) { // Allow for .5 chapters
      const missingStart = Math.ceil(current + 0.5);
      const missingEnd = Math.floor(next - 0.5);
      if (missingStart <= missingEnd) {
        gaps.push({ start: missingStart, end: missingEnd });
      }
    }
  }

  if (gaps.length > 0) {
    const gapCount = gaps.reduce((sum, g) => sum + (g.end - g.start + 1), 0);
    issues.push(`${gapCount} missing chapter(s) detected in ${gaps.length} gap(s)`);
    gaps.slice(0, 3).forEach(g => {
      if (g.start === g.end) {
        warnings.push(`   Missing: Chapter ${g.start}`);
      } else {
        warnings.push(`   Missing: Chapters ${g.start}-${g.end}`);
      }
    });
    if (gaps.length > 3) {
      warnings.push(`   ... and ${gaps.length - 3} more gap(s)`);
    }
  } else {
    info.push(`No gaps detected in available sequence`);
  }

  // Check for expected completeness
  const actualUnique = new Set(chapterNumbers).size;
  let completeness;
  let completenessBase;

  if (expectedTotalChapters && expectedTotalChapters > 0) {
    // Use external data for accurate completeness
    completenessBase = expectedTotalChapters;
    completeness = (actualUnique / expectedTotalChapters * 100).toFixed(1);
  } else {
    // Fallback to local range-based calculation
    completenessBase = stats.maxChapter - stats.minChapter + 1;
    completeness = (actualUnique / completenessBase * 100).toFixed(1);
    warnings.push(`Using local range for completeness (no external data)`);
  }

  if (completeness >= 95) {
    info.push(`${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  } else if (completeness >= 80) {
    warnings.push(`${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  } else {
    issues.push(`Only ${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  }

  // Additional warnings if using external data
  if (expectedTotalChapters && stats.maxChapter < expectedTotalChapters) {
    const missingFromEnd = expectedTotalChapters - stats.maxChapter;
    warnings.push(`Missing latest ${missingFromEnd} chapter(s) (up to ${expectedTotalChapters})`);
  }

  return { issues, warnings, info, stats, gaps, duplicates: uniqueDuplicates, completeness: parseFloat(completeness) };
}

function displayIntegrityReport(report, mangaUpdatesData = null) {
  const reportDiv = $("integrityReport");
  if (!reportDiv) return;

  const { issues, warnings, info } = report;
  const hasIssues = issues.length > 0;
  const hasWarnings = warnings.length > 0;

  let statusClass = "integrity-good";
  let statusIcon = "&#x2705;";
  let statusText = "All Good";

  if (hasIssues) {
    statusClass = "integrity-error";
    statusIcon = "&#x274C;";
    statusText = "Issues Found";
  } else if (hasWarnings) {
    statusClass = "integrity-warning";
    statusIcon = "!";
    statusText = "Warnings";
  }

  let mangaUpdatesSection = "";
  if (mangaUpdatesData && mangaUpdatesData.found) {
    mangaUpdatesSection = `
      <div class="integrity-section integrity-mangaupdates">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">MangaUpdates Data:</div>
        <div>Latest Chapter: ${mangaUpdatesData.latestChapter || "Unknown"}</div>
        <div>Status: ${mangaUpdatesData.status || "Unknown"}</div>
        ${mangaUpdatesData.url ? `<div><a href="${mangaUpdatesData.url}" target="_blank" style="color: var(--primary);">View on MangaUpdates →</a></div>` : ''}
      </div>
    `;
  }

  reportDiv.innerHTML = `
    <div class="integrity-report ${statusClass}">
      <div class="integrity-header">
        <span class="integrity-icon">${statusIcon}</span>
        <strong>Integrity Check: ${statusText}</strong>
        <button class="btn-close-report" onclick="closeIntegrityReport()">&#x2715;</button>
      </div>
      <div class="integrity-body">
        ${mangaUpdatesSection}
        ${issues.length > 0 ? `
          <div class="integrity-section integrity-issues">
            ${issues.map(issue => `<div>${issue}</div>`).join('')}
          </div>
        ` : ''}
        ${warnings.length > 0 ? `
          <div class="integrity-section integrity-warnings">
            ${warnings.map(warning => `<div>${warning}</div>`).join('')}
          </div>
        ` : ''}
        ${info.length > 0 ? `
          <div class="integrity-section integrity-info">
            ${info.map(i => `<div>${i}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  reportDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.closeIntegrityReport = function() {
  const reportDiv = $("integrityReport");
  if (reportDiv) reportDiv.innerHTML = '';
};

// ============================================================================
// ANIME / FILM ADAPTATION CHECK (via AniList GraphQL)
// ============================================================================
window.checkAnimeAdaptation = async function(title) {
  const btn       = $("adaptationCheckBtn");
  const resultDiv = $("adaptationResult");
  if (!resultDiv) return;

  if (btn) { btn.textContent = "Checking..."; btn.classList.add("badge-adaptation-loading"); }

  // Dual query:
  // 1. Look up the manga entry and follow its ADAPTATION relations to anime
  // 2. Directly search AniList for anime with the same title (catches cases
  //    where the manga<->anime relation isn't populated on AniList)
  // Use Page for the manga lookup so that a missing manga returns [] instead of
  // causing AniList to return HTTP 400 (non-nullable Media field = null), which
  // would kill the animeDirect results too.
  const query = `
    query ($search: String) {
      mangaPage: Page(perPage: 1) {
        media(search: $search, type: MANGA) {
          id
          relations {
            edges {
              relationType
              node {
                id type format status
                title { romaji english native }
                siteUrl
                coverImage { medium }
              }
            }
          }
        }
      }
      animeDirect: Page(perPage: 6) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id format status
          title { romaji english native }
          siteUrl
          coverImage { medium }
        }
      }
    }
  `;

  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } })
    });
    const data = await res.json();

    // --- Source 1: ADAPTATION relations from the manga entry ---
    const mangaEntry = (data?.data?.mangaPage?.media || [])[0] || null;
    const relationEdges = mangaEntry?.relations?.edges || [];
    const fromRelations = relationEdges
      .filter(e => e.relationType === "ADAPTATION" && e.node.type === "ANIME")
      .map(e => e.node);

    // --- Source 2: Direct anime search ---
    const directAnime = data?.data?.animeDirect?.media || [];

    // Merge, deduplicate by AniList ID — relation entries take priority
    const seen = new Set(fromRelations.map(n => n.id));
    const merged = [
      ...fromRelations,
      ...directAnime.filter(n => !seen.has(n.id))
    ];

    if (merged.length === 0) {
      resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">No anime or film adaptations found on AniList.</div>`;
    } else {
      resultDiv.innerHTML = `
        <div class="adaptation-result">
          <div class="adaptation-result-title">Adaptations found (${merged.length})</div>
          <div class="adaptation-list">
            ${merged.map(n => {
              const t    = n.title.english || n.title.romaji || n.title.native || "Unknown";
              const fmt  = n.format ? n.format.replace(/_/g, ' ') : '';
              const st   = n.status  ? n.status.replace(/_/g, ' ')  : '';
              const meta = [fmt, st].filter(Boolean).join(' · ');
              return `<a class="adaptation-item" href="${escapeHtml(n.siteUrl)}" target="_blank" rel="noopener noreferrer">
                ${n.coverImage?.medium
                  ? `<img src="${escapeHtml(n.coverImage.medium)}" alt="" class="adaptation-cover">`
                  : `<div class="adaptation-cover-placeholder">TV</div>`}
                <div class="adaptation-item-info">
                  <span class="adaptation-item-name">${escapeHtml(t)}</span>
                  ${meta ? `<span class="adaptation-item-meta">${escapeHtml(meta)}</span>` : ''}
                </div>
              </a>`;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">Error checking adaptations: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.textContent = "Check"; btn.classList.remove("badge-adaptation-loading"); }
  }
};

// Record session duration when navigating away from chapter
async function recordReadingSession() {
  if (!state.readerSessionStart) return;
  const duration = (Date.now() - state.readerSessionStart) / 60000; // convert to minutes
  state.readerSessionStart = null;
  try {
    await api("/api/analytics/session", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga?.id,
        chapterId: state.currentChapter?.id,
        duration: Math.round(duration * 10) / 10
      })
    });
    await checkAndUnlockAchievements();
  } catch (e) { /* non-fatal */ }
}

// ============================================================================
// READER & PAGE RENDERING
// ============================================================================

// ── Auto-hide header state ──────────────────────────────────────────────────
let _headerHideTimer = null;

function _readerMouseMove(e) {
  const readerEl = $("reader");
  if (!readerEl) return;
  const SHOW_ZONE = 72; // px from top of viewport
  if (e.clientY <= SHOW_ZONE) {
    // Mouse is in the header zone — show and cancel any pending hide
    readerEl.classList.remove("header-hidden");
    clearTimeout(_headerHideTimer);
    _headerHideTimer = null;
  } else {
    // Mouse left the zone — schedule hide if not already pending
    if (!_headerHideTimer && !readerEl.classList.contains("header-hidden")) {
      _headerHideTimer = setTimeout(() => {
        readerEl.classList.add("header-hidden");
        _headerHideTimer = null;
      }, 2000);
    }
  }
}

function showReader() {
  const readerEl = $("reader");
  readerEl.classList.remove("hidden", "header-hidden");
  const chapterName = state.currentChapter?.name || "Chapter";
  $("readerTitle").textContent = `${state.currentManga?.title || ""} — ${chapterName}`;
  updateZoomUI();
  // Auto-hide header after 3 s of inactivity and on mouse position
  clearTimeout(_headerHideTimer);
  _headerHideTimer = setTimeout(() => { readerEl.classList.add("header-hidden"); _headerHideTimer = null; }, 3000);
  readerEl.addEventListener("mousemove", _readerMouseMove);
}

async function hideReader() {
  stopAutoScroll();
  await recordReadingSession();
  const readerEl = $("reader");
  readerEl.classList.add("hidden");
  readerEl.classList.remove("header-hidden");
  readerEl.removeEventListener("mousemove", _readerMouseMove);
  clearTimeout(_headerHideTimer);
  _headerHideTimer = null;
}

// ============================================================================
// AUTOSCROLL
// ============================================================================

let _autoScrollRAF = null;
const AUTOSCROLL_SPEEDS = [0.2, 0.5, 1.0, 2.0, 3.5]; // px per animation frame

function startAutoScroll() {
  stopAutoScroll();
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  function tick() {
    const speedPx = AUTOSCROLL_SPEEDS[state.autoScroll.speed - 1] || 1.5;
    pageWrap.scrollTop += speedPx;
    _autoScrollRAF = requestAnimationFrame(tick);
  }
  _autoScrollRAF = requestAnimationFrame(tick);
}

function stopAutoScroll() {
  if (_autoScrollRAF !== null) {
    cancelAnimationFrame(_autoScrollRAF);
    _autoScrollRAF = null;
  }
}

function toggleAutoScroll() {
  state.autoScroll.enabled = !state.autoScroll.enabled;
  const btn   = $("autoScrollToggle");
  const bar   = $("autoScrollBar");
  if (btn) {
    btn.classList.toggle("active", state.autoScroll.enabled);
    btn.title = state.autoScroll.enabled ? "Stop AutoScroll" : "Start AutoScroll";
  }
  if (bar) bar.classList.toggle("hidden", !state.autoScroll.enabled);
  if (state.autoScroll.enabled) startAutoScroll();
  else stopAutoScroll();
}

function renderPage() {
  if (!state.currentChapter?.pages) return;

  // PDF mode: delegate to async PDF.js renderer (respects reading mode)
  if (state.currentChapter.isPDF && state.pdfDocument) {
    const _mode = state.settings.readingMode;
    if (_mode === 'webtoon')    renderPDFWebtoon();
    else if (_mode === 'rtl')   renderPDFSpread(true);
    else if (_mode === 'ltr')   renderPDFSpread(false);
    else                        renderPDFPageToCanvas(state.currentPageIndex + 1);
    return;
  }

  const pages   = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const idx     = state.currentPageIndex;
  const mode    = state.settings.readingMode;

  // Reset zoom on new chapter
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : "";

  if (mode === "webtoon") {
    pageWrap.className = "reader-content reading-mode-webtoon";
    const validPages = pages.filter(p => p.img);
    const nextWIdx = getNextChapterIndex(state.currentChapterIndex);
    const nextWCh  = (nextWIdx >= 0 && nextWIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextWIdx] : null;
    const nextWLabel = nextWCh ? (nextWCh.name || `Chapter ${nextWCh.chapter || nextWIdx + 1}`) : null;
    pageWrap.innerHTML = `
      <div class="page-zoom-wrap webtoon-wrap" ${zoomStyle}>
        ${validPages.map((p, i) => `<img src="${escapeHtml(p.img)}" alt="Page ${i + 1}" class="webtoon-page" loading="eager">`).join("")}
      </div>
      <div class="chapter-end-wrap">
        ${nextWLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextWLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
      </div>`;
    $("pageCounter").textContent = `Webtoon Mode — ${validPages.length} pages`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);
  } else if (mode === "rtl") {
    renderBookSpread();
    return;
  } else if (mode === "ltr") {
    renderLTRSpread();
    return;
  } else {
    pageWrap.className = "reader-content";
    if (idx < 0 || idx >= pages.length) return;
    const page     = pages[idx];
    const isLast   = idx === pages.length - 1;
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        <div class="chapter-end-divider"></div>
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : "";
    pageWrap.innerHTML = page.img
      ? `<div class="page-zoom-wrap" ${zoomStyle}><img src="${escapeHtml(page.img)}" alt="Page ${idx + 1}" class="${imgClass}"></div>${endBanner}`
      : `<div class="muted">Page not available</div>`;
    // Scroll to top on new page (not when same chapter end-banner update)
    if (!isLast) pageWrap.scrollTop = 0;
    else pageWrap.scrollTo({ top: 0, behavior: "smooth" });

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  }
}

// ============================================================================
// BOOK READER — RTL double-page spread with 3D page-flip
// ============================================================================

let _bookFlipAnimating = false;

function getBookSpread(idx, pages) {
  const page = pages[idx];
  // Wide (double-page scan): same image fills both panels, each showing one half
  if (page?.isWide) {
    return { right: page.img || null, left: page.img || null, isWide: true };
  }
  return {
    right: pages[idx]?.img     || null,
    left:  pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// LTR (Western) spread: left = pages[idx], right = pages[idx+1]
function getLTRSpread(idx, pages) {
  const page = pages[idx];
  if (page?.isWide) {
    return { left: page.img || null, right: page.img || null, isWide: true };
  }
  return {
    left:  pages[idx]?.img     || null,
    right: pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// After rendering a spread, check whether the idx page image is a wide double-page scan.
// RTL: pages[idx] is on the right panel. LTR: pages[idx] is on the left panel.
// If wide, mutate both panels in-place to show left/right halves of the same source.
// After rendering a spread, probe both panel images.
// If either is landscape (wider than tall) it is a double-page scan —
// overlay it as ONE full-spread image covering both panels.
function _applyWideSplitIfNeeded(idx, pages) {
  const spread = $('bookSpread');
  if (!spread) return;

  let applied = false;

  const imgs = [
    document.querySelector('#bookRight img.book-page-img'),
    document.querySelector('#bookLeft  img.book-page-img'),
  ].filter(Boolean);

  imgs.forEach(imgEl => {
    const check = () => {
      if (applied) return;
      if (state.currentPageIndex !== idx) return;
      if (imgEl.naturalWidth <= imgEl.naturalHeight) return; // portrait, skip

      applied = true;
      const src = imgEl.src;
      if (pages[idx]) pages[idx].isWide = true;

      // Remove any previous overlay
      const old = document.getElementById('bookWideOverlay');
      if (old) old.remove();

      // Full-spread overlay with the wide image shown at natural aspect ratio
      const overlay = document.createElement('div');
      overlay.className = 'book-wide-overlay';
      overlay.id = 'bookWideOverlay';
      const wImg = document.createElement('img');
      wImg.src = src;
      overlay.appendChild(wImg);
      spread.appendChild(overlay);

      // Fade in only once the image is decoded — no flash of blank overlay
      const showOverlay = () => requestAnimationFrame(() => overlay.classList.add('visible'));
      if (wImg.complete) showOverlay();
      else wImg.addEventListener('load', showOverlay, { once: true });

      // Fix counter (1 page consumed) and nav buttons
      const total = pages.length;
      const ctr = $('pageCounter');
      if (ctr) ctr.textContent = `${idx + 1} / ${total}`;
      const nx = $('nextPage');
      const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      if (nx) nx.disabled = idx + 1 >= total && !hasNextCh;
    };

    if (imgEl.complete && imgEl.naturalWidth > 0) check();
    else imgEl.addEventListener('load', check, { once: true });
  });
}

function renderBookSpread() {
  if (!state.currentChapter?.pages) return;
  // PDF: use canvas-based spread
  if (state.currentChapter.isPDF && state.pdfDocument) { renderPDFSpread(true); return; }
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getBookSpread(idx, pages);
  const { right: rightImg, left: leftImg, isWide } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-rtl' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = isWide ? 1 : 2;
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const r = idx + 1, l = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${r} / ${total}`
    : (l <= total ? `${r}-${l} / ${total}` : `${r} / ${total}`);

  const wrapZoomStyle = '';

  // RTL: right panel reads first. For wide page: right half on right, left half on left.
  const rightHtml = rightImg
    ? `<img class="book-page-img${isWide ? ' wide-split-right' : ''}" src="${escapeHtml(rightImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const leftHtml = leftImg
    ? `<img class="book-page-img${isWide ? ' wide-split-left' : ''}" src="${escapeHtml(leftImg)}" alt="Page ${isWide ? idx + 1 : idx + 2}">`
    : `<div class="book-page-blank"></div>`;

  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap" ${wrapZoomStyle}>
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left" id="bookLeft">${leftHtml}</div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight">${rightHtml}</div>
      </div>
    </div>
  `;

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  _applyWideSplitIfNeeded(idx, pages);
}

function attachBookDragEvents() {
  const spread = $("bookSpread");
  if (!spread || spread.dataset.dragAttached) return;
  spread.dataset.dragAttached = "1";

  let startX = 0;
  let dragSide = null;
  let active   = false;

  spread.addEventListener("pointerdown", e => {
    if (e.button && e.pointerType === "mouse") return;
    const rect = spread.getBoundingClientRect();
    dragSide = (e.clientX - rect.left) > rect.width / 2 ? "right" : "left";
    startX   = e.clientX;
    active   = true;
    spread.setPointerCapture(e.pointerId);
  }, { passive: true });

  spread.addEventListener("pointerup", e => {
    if (!active) return;
    active = false;
    const dx = e.clientX - startX;
    const tap = Math.abs(dx) < 12;
    const isRTL = state.settings.readingMode === "rtl";
    const _navigate = state.settings.readingMode === "ltr" ? navigateLTR : navigateBook;
    // RTL (manga): left side = next pages, right side = previous pages
    // LTR: right side = next pages, left side = previous pages
    if (dragSide === "right" && (dx < -50 || tap))  _navigate(isRTL ? "backward" : "forward");
    if (dragSide === "left"  && (dx >  50 || tap))  _navigate(isRTL ? "forward"  : "backward");
  });
}

function navigateBook(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  // PDF: use canvas-capture flip animation
  if (state.currentChapter?.isPDF && state.pdfDocument) {
    if (_bookFlipAnimating) return;
    if (direction === 'forward') {
      if (idx + 2 >= total) { goToNextChapter(); return; }
      newIdx = idx + 2;
    } else {
      if (idx === 0) { goToPrevChapter(); return; }
      newIdx = Math.max(0, idx - 2);
    }
    _bookFlipAnimating = true;
    playPDFFlip(true, direction, idx, newIdx, () => {
      state.currentPageIndex = newIdx;
      _bookFlipAnimating = false;
      renderPDFSpread(true, true); // noFade: flip was already the animation
      const pNum1 = newIdx + 1, pNum2 = newIdx + 2;
      const ctr = $("pageCounter");
      if (ctr) ctr.textContent = pNum2 <= total ? `${pNum1}-${pNum2} / ${total}` : `${pNum1} / ${total}`;
      const pv2 = $("prevPage"), nx2 = $("nextPage");
      const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
      if (nx2) nx2.disabled = newIdx + 2 >= total && !hasNextCh2;
      attachBookDragEvents();
    });
    return;
  }

  if (direction === "forward") {
    const step = pages[idx]?.isWide ? 1 : 2;
    if (idx + step >= total) { _bookFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _bookFlipAnimating = false; goToPrevChapter(); return; }
    // Step back by 1 if the preceding page is a wide page, else by 2
    const backStep = pages[idx - 1]?.isWide ? 1 : 2;
    newIdx = Math.max(0, idx - backStep);
  }

  if (_bookFlipAnimating) return;

  _bookFlipAnimating = true;
  // RTL (manga): spine is on the right. "forward" = left page flips rightward → invert animation direction
  const animDir = direction === "forward" ? "backward" : "forward";
  playBookFlip(animDir, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _bookFlipAnimating = false;
    // Update counter + nav buttons in-place — no DOM rebuild, no flash
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = isWide2 ? 1 : 2;
    const r = newIdx + 1, l = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${r} / ${total2}` : (l <= total2 ? `${r}-${l} / ${total2}` : `${r} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideSplitIfNeeded(newIdx, pages);
  });
}

function playBookFlip(direction, oldIdx, newIdx, pages, onComplete, getSpread = getBookSpread) {
  const spread = $("bookSpread");
  if (!spread) { onComplete(); return; }

  // Remove any wide-page overlay from the previous spread immediately
  const prevOverlay = document.getElementById('bookWideOverlay');
  if (prevOverlay) prevOverlay.remove();

  const { right: newRight, left: newLeft } = getSpread(newIdx, pages);
  const isForward = direction === "forward";

  const sL = document.getElementById("bookLeft");
  const sR = document.getElementById("bookRight");

  // ── Helper ─────────────────────────────────────────────────────────────────
  const mkImg = (src, extraClass = '') =>
    src ? `<img class="book-page-img${extraClass ? ' ' + extraClass : ''}" src="${escapeHtml(src)}">` : `<div class="book-page-blank"></div>`;

  const newSpread = getSpread(newIdx, pages);
  const newIsWide = newSpread.isWide;
  // Recompute newRight/newLeft from the spread (already done above for the non-wide case)
  const nRight = newSpread.right;
  const nLeft  = newSpread.left;

  // Clone the existing rendered <img> from the panel that is about to flip.
  // Cloning guarantees the image is already loaded — no fetch needed, no blank frame.
  const flipPanel   = isForward ? sR : sL;
  const existingImg = flipPanel?.querySelector("img");
  const frontClone  = existingImg ? existingImg.cloneNode() : null;

  // Panel UNDER the flipper: set to the new destination page immediately.
  // It is fully hidden by the flipper at t=0 so the image can load silently.
  if (isForward) {
    if (sR) sR.innerHTML = mkImg(newRight);
  } else {
    if (sL) sL.innerHTML = mkImg(newLeft);
  }

  const w = spread.offsetWidth / 2;
  const h = spread.offsetHeight;

  // ── FLIPPER ────────────────────────────────────────────────────────────────
  const flipper = document.createElement("div");
  Object.assign(flipper.style, {
    position:        "absolute",
    top:             "0",
    width:           w + "px",
    height:          h + "px",
    transformStyle:  "preserve-3d",
    zIndex:          "20",
    left:            isForward ? w + "px" : "0px",
    transformOrigin: isForward ? "left center" : "right center",
    willChange:      "transform",
  });

  // ── Front face: the currently visible page (cloned → always loaded) ─────────
  const front = document.createElement("div");
  front.className = "book-flipper-face book-flipper-front";
  if (frontClone) {
    frontClone.className = "book-page-img";
    front.appendChild(frontClone);
  } else {
    front.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on front face (darkens toward the fold seam)
  const curlShadow = document.createElement("div");
  curlShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);"
      : "background:linear-gradient(to left,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);",
  ].join("");
  front.appendChild(curlShadow);

  // ── Back face: the new incoming page (shown as the page lands) ──────────────
  // Forward: flipper sweeps right→left, back face lands on LEFT → show nLeft
  // Backward: flipper sweeps left→right, back face lands on RIGHT → show nRight
  const backSrc   = isForward ? nLeft  : nRight;
  const backClass = isForward ? (newIsWide ? 'wide-split-left' : '') : (newIsWide ? 'wide-split-right' : '');
  const back = document.createElement("div");
  back.className = "book-flipper-face book-flipper-back";
  if (backSrc) {
    const bi = new Image();
    bi.className = `book-page-img${backClass ? ' ' + backClass : ''}`;
    bi.src = backSrc;
    back.appendChild(bi);
  } else {
    back.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on back face (mirrored direction)
  const backShadow = document.createElement("div");
  backShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to left,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);"
      : "background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);",
  ].join("");
  back.appendChild(backShadow);

  flipper.appendChild(front);
  flipper.appendChild(back);

  // ── Cast-shadow on the stationary page ─────────────────────────────────────
  const castShadow = document.createElement("div");
  Object.assign(castShadow.style, {
    position:      "absolute",
    top:           "0",
    width:         w + "px",
    height:        h + "px",
    left:          isForward ? "0px" : w + "px",
    zIndex:        "19",
    pointerEvents: "none",
    opacity:       "0",
    background:    isForward
      ? "linear-gradient(to left,rgba(0,0,0,0.55) 0%,transparent 65%)"
      : "linear-gradient(to right,rgba(0,0,0,0.55) 0%,transparent 65%)",
  });
  spread.appendChild(castShadow);
  spread.appendChild(flipper);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const DURATION = 520;
  let startTime  = null;
  let done       = false;
  let midUpdated = false; // flag: update opposite panel once at ~50% (hidden by flipper)

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(ts) {
    if (done) return;
    if (!startTime) startTime = ts;

    const raw = Math.min((ts - startTime) / DURATION, 1);
    const et  = ease(raw);
    const angle = isForward ? -180 * et : 180 * et;

    flipper.style.transform = `rotateY(${angle}deg)`;

    // At ~50% the flipper is edge-on and covers the opposite panel completely.
    // Update it now so the image has the remaining ~260ms to decode before reveal.
    if (!midUpdated && raw >= 0.48) {
      midUpdated = true;
      if (isForward) {
        if (sL) sL.innerHTML = mkImg(nLeft,  newIsWide ? 'wide-split-left'  : '');
      } else {
        if (sR) sR.innerHTML = mkImg(nRight, newIsWide ? 'wide-split-right' : '');
      }
    }

    // Shadow intensity peaks at 90° fold (sin curve)
    const peak = Math.sin(et * Math.PI);
    curlShadow.style.opacity = (peak * 0.90).toFixed(3);
    backShadow.style.opacity = (peak * 0.82).toFixed(3);
    castShadow.style.opacity = (peak * 0.68).toFixed(3);

    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      finish();
    }
  }

  function finish() {
    if (done) return;
    done = true;
    flipper.remove();
    castShadow.remove();
    // Ensure both panels show correct content before handing back
    if (!midUpdated) {
      if (isForward) { if (sL) sL.innerHTML = mkImg(nLeft,  newIsWide ? 'wide-split-left'  : ''); }
      else           { if (sR) sR.innerHTML = mkImg(nRight, newIsWide ? 'wide-split-right' : ''); }
    }
    onComplete();
  }

  requestAnimationFrame(frame);
  setTimeout(finish, DURATION + 300); // safety fallback
}

// ============================================================================
// PDF page-flip animation — same 3-D flip engine, but sources come from
// PDF.js canvas captures / offscreen renders instead of <img src=...>
// ============================================================================
async function playPDFFlip(isRTL, direction, oldIdx, newIdx, onComplete) {
  const pdf = state.pdfDocument;
  const spread = document.getElementById('bookSpread');
  if (!spread || !pdf) { onComplete(); return; }

  // In RTL (manga) mode the animation direction is inverted relative to
  // the navigation direction (same inversion as in navigateBook → playBookFlip).
  const isAnimForward = isRTL ? direction !== 'forward' : direction === 'forward';

  const sL = document.getElementById('bookLeft');
  const sR = document.getElementById('bookRight');

  // ── Capture an existing panel canvas as a dataURL ──────────────────────────
  async function capturePanel(panel) {
    const canvas = panel?.querySelector('canvas');
    if (!canvas) return null;
    try { return canvas.toDataURL(); } catch (e) { return null; }
  }

  // ── Render one PDF page to an offscreen canvas and return its dataURL ───────
  async function pdfPageToDataURL(pageNum) {
    if (pageNum < 1 || pageNum > pdf.numPages) return null;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const c = document.createElement('canvas');
      c.width = viewport.width; c.height = viewport.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
      return c.toDataURL();
    } catch (e) { return null; }
  }

  // Back-face page number (the new page revealed as the flipper lands).
  // Formula derived from spread layout:
  //   RTL: right=pages[idx], left=pages[idx+1]  → 1-based: right=idx+1, left=idx+2
  //   LTR: left=pages[idx], right=pages[idx+1]  → 1-based: left=idx+1, right=idx+2
  // isAnimForward=true  → flipper sweeps from right panel, back lands on LEFT
  //   RTL backward : new left = newIdx+2
  //   LTR forward  : new left = newIdx+1
  // isAnimForward=false → flipper sweeps from left panel, back lands on RIGHT
  //   RTL forward  : new right = newIdx+1
  //   LTR backward : new right = newIdx+2
  const backPageNum = (isAnimForward === isRTL) ? newIdx + 2 : newIdx + 1;

  // Gather dataURLs in parallel
  const flipPanel = isAnimForward ? sR : sL;
  const [frontDataURL, backDataURL] = await Promise.all([
    capturePanel(flipPanel),
    pdfPageToDataURL(backPageNum),
  ]);

  const mkImgEl = (dataURL) => {
    if (!dataURL) { const d = document.createElement('div'); d.className = 'book-page-blank'; return d; }
    const img = new Image(); img.src = dataURL; img.className = 'book-page-img'; return img;
  };

  // Pre-fill the panel under the flipper with the back-face content so it is
  // ready the instant the flipper is removed.
  if (isAnimForward) {
    if (sR) { sR.innerHTML = ''; sR.appendChild(mkImgEl(backDataURL)); }
  } else {
    if (sL) { sL.innerHTML = ''; sL.appendChild(mkImgEl(backDataURL)); }
  }

  const w = spread.offsetWidth / 2;
  const h = spread.offsetHeight;

  // ── Flipper element ─────────────────────────────────────────────────────────
  const flipper = document.createElement('div');
  Object.assign(flipper.style, {
    position: 'absolute', top: '0', width: w + 'px', height: h + 'px',
    transformStyle: 'preserve-3d', zIndex: '20',
    left: isAnimForward ? w + 'px' : '0px',
    transformOrigin: isAnimForward ? 'left center' : 'right center',
    willChange: 'transform',
  });

  // Front face — currently visible panel (captured as dataURL → always loaded)
  const front = document.createElement('div');
  front.className = 'book-flipper-face book-flipper-front';
  if (frontDataURL) front.appendChild(mkImgEl(frontDataURL));
  else front.innerHTML = '<div class="book-page-blank"></div>';

  const curlShadow = document.createElement('div');
  curlShadow.style.cssText = [
    'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:3;opacity:0;',
    isAnimForward
      ? 'background:linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);'
      : 'background:linear-gradient(to left,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);',
  ].join('');
  front.appendChild(curlShadow);

  // Back face — incoming page
  const back = document.createElement('div');
  back.className = 'book-flipper-face book-flipper-back';
  back.appendChild(mkImgEl(backDataURL));

  const backShadow = document.createElement('div');
  backShadow.style.cssText = [
    'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:3;opacity:0;',
    isAnimForward
      ? 'background:linear-gradient(to left,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);'
      : 'background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);',
  ].join('');
  back.appendChild(backShadow);

  flipper.appendChild(front);
  flipper.appendChild(back);

  // Cast shadow on the stationary side
  const castShadow = document.createElement('div');
  Object.assign(castShadow.style, {
    position: 'absolute', top: '0', width: w + 'px', height: h + 'px',
    left: isAnimForward ? '0px' : w + 'px',
    zIndex: '19', pointerEvents: 'none', opacity: '0',
    background: isAnimForward
      ? 'linear-gradient(to left,rgba(0,0,0,0.55) 0%,transparent 65%)'
      : 'linear-gradient(to right,rgba(0,0,0,0.55) 0%,transparent 65%)',
  });
  spread.appendChild(castShadow);
  spread.appendChild(flipper);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const DURATION = 520;
  let startTime = null, done = false;

  function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  function frame(ts) {
    if (done) return;
    if (!startTime) startTime = ts;
    const raw = Math.min((ts - startTime) / DURATION, 1);
    const et  = ease(raw);
    flipper.style.transform = `rotateY(${isAnimForward ? -180 * et : 180 * et}deg)`;
    const peak = Math.sin(et * Math.PI);
    curlShadow.style.opacity = (peak * 0.90).toFixed(3);
    backShadow.style.opacity = (peak * 0.82).toFixed(3);
    castShadow.style.opacity = (peak * 0.68).toFixed(3);
    if (raw < 1) requestAnimationFrame(frame); else finish();
  }

  function finish() {
    if (done) return;
    done = true;
    flipper.remove();
    castShadow.remove();
    onComplete();
  }

  requestAnimationFrame(frame);
  setTimeout(finish, DURATION + 300); // safety fallback
}

// Pre-fetch images for the next 3 spreads (6 pages) and 1 previous spread
function preloadBookPages(idx, pages) {
  const srcs = new Set();
  for (let offset = -2; offset <= 8; offset += 2) {
    const si = idx + offset;
    if (si < 0 || si >= pages.length) continue;
    const { right, left } = getBookSpread(si, pages);
    if (right) srcs.add(right);
    if (left)  srcs.add(left);
  }
  srcs.forEach(src => { const img = new Image(); img.src = src; });
}

// ============================================================================
// LTR — Western double-page spread (left-first) with the same 3-D flip engine
// ============================================================================

let _ltrFlipAnimating = false;

function renderLTRSpread() {
  if (!state.currentChapter?.pages) return;
  // PDF: use canvas-based spread
  if (state.currentChapter.isPDF && state.pdfDocument) { renderPDFSpread(false); return; }
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getLTRSpread(idx, pages);
  const { left: leftImg, right: rightImg, isWide } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-ltr' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = isWide ? 1 : 2;
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const l = idx + 1, r = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${l} / ${total}`
    : (r <= total ? `${l}-${r} / ${total}` : `${l} / ${total}`);

  const wrapZoomStyle = '';

  const leftHtml = leftImg
    ? `<img class="book-page-img${isWide ? ' wide-split-left' : ''}" src="${escapeHtml(leftImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const rightHtml = rightImg
    ? `<img class="book-page-img${isWide ? ' wide-split-right' : ''}" src="${escapeHtml(rightImg)}" alt="Page ${isWide ? idx + 1 : idx + 2}">`
    : `<div class="book-page-blank"></div>`;

  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap" ${wrapZoomStyle}>
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left" id="bookLeft">${leftHtml}</div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight">${rightHtml}</div>
      </div>
    </div>
  `;

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  _applyWideSplitIfNeeded(idx, pages);
}

function navigateLTR(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  // PDF: use canvas-capture flip animation
  if (state.currentChapter?.isPDF && state.pdfDocument) {
    if (_ltrFlipAnimating) return;
    if (direction === 'forward') {
      if (idx + 2 >= total) { goToNextChapter(); return; }
      newIdx = idx + 2;
    } else {
      if (idx === 0) { goToPrevChapter(); return; }
      newIdx = Math.max(0, idx - 2);
    }
    _ltrFlipAnimating = true;
    playPDFFlip(false, direction, idx, newIdx, () => {
      state.currentPageIndex = newIdx;
      _ltrFlipAnimating = false;
      renderPDFSpread(false, true); // noFade: flip was already the animation
      const pNum1 = newIdx + 1, pNum2 = newIdx + 2;
      const ctr = $("pageCounter");
      if (ctr) ctr.textContent = pNum2 <= total ? `${pNum1}-${pNum2} / ${total}` : `${pNum1} / ${total}`;
      const pv2 = $("prevPage"), nx2 = $("nextPage");
      const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
      if (nx2) nx2.disabled = newIdx + 2 >= total && !hasNextCh2;
      attachBookDragEvents();
    });
    return;
  }

  if (direction === "forward") {
    const step = pages[idx]?.isWide ? 1 : 2;
    if (idx + step >= total) { _ltrFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _ltrFlipAnimating = false; goToPrevChapter(); return; }
    const backStep = pages[idx - 1]?.isWide ? 1 : 2;
    newIdx = Math.max(0, idx - backStep);
  }

  if (_ltrFlipAnimating) return;

  _ltrFlipAnimating = true;
  playBookFlip(direction, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _ltrFlipAnimating = false;
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = isWide2 ? 1 : 2;
    const l = newIdx + 1, r = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${l} / ${total2}` : (r <= total2 ? `${l}-${r} / ${total2}` : `${l} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideSplitIfNeeded(newIdx, pages);
  }, getLTRSpread);
}

function applyZoom(delta) {
  state.zoomLevel = Math.min(3.0, Math.max(0.5, Math.round((state.zoomLevel + delta) * 10) / 10));
  updateZoomUI();

  const mode = state.settings.readingMode;
  if (mode === 'rtl' || mode === 'ltr') {
    _applyBookZoom();
    return;
  }
  if (mode === 'webtoon') {
    _applyWebtoonZoom();
    return;
  }
  // Single-page mode: just scale the existing wrap in-place
  _applySinglePageZoom();
}

// Update zoom on the webtoon wrap in-place (preserves scroll position & loaded images)
function _applyWebtoonZoom() {
  const wrap = document.querySelector('#pageWrap .page-zoom-wrap');
  if (!wrap) { renderPage(); return; }
  const pageWrap = $('pageWrap');
  const zoom = state.zoomLevel ?? 1.0;

  // Find the first page element that is visible (or nearest to viewport top)
  // We'll use it as a stable anchor so the user stays on the same page after zoom.
  const pages = Array.from(wrap.querySelectorAll('.webtoon-page, canvas'));
  let anchor = null, anchorRectBefore = null;
  if (pageWrap && pages.length) {
    const vpTop = pageWrap.getBoundingClientRect().top;
    for (const el of pages) {
      const r = el.getBoundingClientRect();
      // Pick the first element whose bottom is below the viewport top (i.e. at least partially visible)
      if (r.bottom > vpTop) { anchor = el; anchorRectBefore = r; break; }
    }
    if (!anchor) { anchor = pages[0]; anchorRectBefore = anchor.getBoundingClientRect(); }
  }

  wrap.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
  wrap.style.transformOrigin = 'top center';

  // After the browser paints the new transform, shift scroll so the anchor
  // element returns to exactly where it was relative to the viewport.
  if (anchor && anchorRectBefore && pageWrap) {
    requestAnimationFrame(() => {
      const anchorRectAfter = anchor.getBoundingClientRect();
      const delta = anchorRectAfter.top - anchorRectBefore.top;
      pageWrap.scrollTop += delta;
    });
  }
}

// Update zoom on a single-page wrap in-place
function _applySinglePageZoom() {
  const wrap = document.querySelector('#pageWrap .page-zoom-wrap');
  if (!wrap) { renderPage(); return; }
  const zoom = state.zoomLevel ?? 1.0;
  wrap.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
  wrap.style.transformOrigin = 'top center';
}

// Apply zoom transform to bookSpread only (overflow:hidden on container = no scrollbars)
function _applyBookZoom() {
  const spread = document.getElementById('bookSpread');
  const zoom = state.zoomLevel ?? 1.0;
  if (spread) {
    spread.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
    spread.style.transformOrigin = 'center center';
  }
}

// Returns the CSS class suffix for the current sharpness level
function _sharpClass() {
  const s = state.settings.lineSharpness || 0;
  return s > 0 ? ` sharp-${s}` : '';
}

// ============================================================================
// PDF READER
// ============================================================================
async function initPDFChapter(pdfUrl) {
  if (!window.pdfjsLib) { state.currentChapter.pages = []; return; }
  try {
    state.pdfDocument = await pdfjsLib.getDocument(pdfUrl).promise;
    const n = state.pdfDocument.numPages;
    state.currentChapter.pages = Array.from({ length: n }, (_, i) => ({ pdfPage: i + 1 }));
  } catch (e) {
    console.error('PDF load error:', e);
    state.currentChapter.pages = [];
    state.pdfDocument = null;
  }
}

async function renderPDFWebtoon() {
  const pageWrap = $('pageWrap');
  if (!state.pdfDocument || !pageWrap) return;
  const pdf = state.pdfDocument;
  const total = pdf.numPages;
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : '';

  pageWrap.className = 'reader-content reading-mode-webtoon';
  pageWrap.innerHTML = `<div class="page-zoom-wrap webtoon-wrap" id="pdfWebtoonWrap" ${zoomStyle}></div>`;
  const wrap = pageWrap.querySelector('#pdfWebtoonWrap');

  $('pageCounter').textContent = `Webtoon Mode — ${total} pages`;
  $('prevPage').style.display = 'none';
  $('nextPage').style.display = 'none';
  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);

  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdf.getPage(i);
      const scale    = Math.max(state.zoomLevel, 1) * 1.5;
      const viewport = page.getViewport({ scale });
      const canvas   = document.createElement('canvas');
      canvas.className = 'webtoon-page';
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      // Abort if user navigated away
      if (pageWrap !== $('pageWrap') || !pageWrap.querySelector('#pdfWebtoonWrap')) return;
      wrap.appendChild(canvas);
    } catch (e) {
      console.warn(`PDF webtoon page ${i} error:`, e);
    }
  }

  // Append chapter-end banner
  const nextIdx  = getNextChapterIndex(state.currentChapterIndex);
  const nextCh   = (nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
  const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
  pageWrap.insertAdjacentHTML('beforeend', `
    <div class="chapter-end-wrap">
      ${nextLabel
        ? `<p class="chapter-end-label">Next Chapter</p>
           <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
           <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
        : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
    </div>`);
}

async function renderPDFPageToCanvas(pageNum) {
  const pageWrap = $("pageWrap");
  if (!state.pdfDocument || !pageWrap) return;
  try {
    const pdf  = state.pdfDocument;
    const page = await pdf.getPage(pageNum);
    const scale    = Math.max(state.zoomLevel, 1) * 1.5;
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.className = 'page-img';
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const isLast   = pageNum === pdf.numPages;
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : '';

    pageWrap.className = 'reader-content' + _sharpClass();
    pageWrap.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'page-zoom-wrap';
    if (state.zoomLevel !== 1.0) wrap.style.cssText = `transform:scale(${state.zoomLevel});transform-origin:top center;`;
    wrap.appendChild(canvas);
    pageWrap.appendChild(wrap);
    if (endBanner) pageWrap.insertAdjacentHTML('beforeend', endBanner);

    $("pageCounter").textContent = `${pageNum} / ${pdf.numPages}`;
    $("prevPage").style.display = 'block';
    $("nextPage").style.display = 'block';
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    pageWrap.scrollTop = 0;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, pageNum - 1);
  } catch (e) {
    console.error('PDF render error:', e);
  }
}

function updateZoomUI() {
  const el = $("zoomLevel");
  if (el) el.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

// PDF book-spread renderer for RTL (manga) and LTR modes.
// noFade=true when called right after the flip animation (flip itself is the transition)
async function renderPDFSpread(isRTL, noFade = false) {
  const pageWrap = $('pageWrap');
  if (!state.pdfDocument || !pageWrap) return;
  const pdf   = state.pdfDocument;
  const total = pdf.numPages;
  const idx   = state.currentPageIndex;
  const pNum1 = idx + 1;
  const pNum2 = idx + 2;

  const pv = $('prevPage'), nx = $('nextPage');
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0
    && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = 'block'; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = 'block'; nx.disabled = pNum1 >= total && !hasNextCh; }
  $('pageCounter').textContent = pNum2 <= total
    ? `${pNum1}-${pNum2} / ${total}`
    : `${pNum1} / ${total}`;

  pageWrap.className = `reader-content ${isRTL ? 'reading-mode-rtl' : 'reading-mode-ltr'}` + _sharpClass();
  pageWrap.style.overflow = '';
  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap">
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left"  id="bookLeft"></div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight"></div>
      </div>
    </div>`;

  if (pNum1 >= total) {
    const nextIdx   = getNextChapterIndex(state.currentChapterIndex);
    const nextCh    = (nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    pageWrap.insertAdjacentHTML('beforeend', `
      <div class="chapter-end-wrap">
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>`);
  }

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();

  const scale = Math.max(state.zoomLevel, 1) * 1.5;

  // Pre-render both pages offscreen, then inject in one shot to avoid blank-panel flash
  async function renderToCanvas(pdfPageNum) {
    if (pdfPageNum < 1 || pdfPageNum > total) return null;
    try {
      const p   = await pdf.getPage(pdfPageNum);
      const vp  = p.getViewport({ scale });
      const cvs = document.createElement('canvas');
      cvs.className = 'book-page-img';
      cvs.width  = vp.width;
      cvs.height = vp.height;
      cvs.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      await p.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
      return cvs;
    } catch (e) { console.warn('PDF spread render error:', e); return null; }
  }

  const [cvs1, cvs2] = await Promise.all([ renderToCanvas(pNum1), renderToCanvas(pNum2) ]);
  if (!$('bookSpread')) return; // reader closed while rendering

  const sL = $('bookLeft'), sR = $('bookRight');
  if (!noFade) {
    if (sL) sL.style.opacity = '0';
    if (sR) sR.style.opacity = '0';
  }
  if (isRTL) {
    if (cvs1 && sR) sR.appendChild(cvs1);
    if (cvs2 && sL) sL.appendChild(cvs2);
  } else {
    if (cvs1 && sL) sL.appendChild(cvs1);
    if (cvs2 && sR) sR.appendChild(cvs2);
  }
  if (!noFade) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (sL) { sL.style.transition = 'opacity 0.18s ease'; sL.style.opacity = '1'; }
      if (sR) { sR.style.transition = 'opacity 0.18s ease'; sR.style.opacity = '1'; }
    }));
  }
  // Restore zoom (bookSpread DOM was rebuilt so transform must be re-applied)
  _applyBookZoom();
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings() {
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="btn secondary" id="closeSettings">&#x2715;</button>
      </div>
      <div class="settings-body">
        <div class="setting-group">
          <label>Reading Mode</label>
          <select id="modeSelect" class="input">
            <option value="ltr"     ${state.settings.readingMode === "ltr"     ? "selected" : ""}>Left to Right</option>
            <option value="rtl"     ${state.settings.readingMode === "rtl"     ? "selected" : ""}>Right to Left (Manga)</option>
            <option value="webtoon" ${state.settings.readingMode === "webtoon" ? "selected" : ""}>Webtoon (Vertical Scroll)</option>
          </select>
        </div>
        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Advanced Settings</h3>
        <div class="setting-group">
          <label>Line Sharpness</label>
          <select id="sharpnessSelect" class="input">
            <option value="0" ${(state.settings.lineSharpness||0) === 0 ? 'selected' : ''}>Off</option>
            <option value="1" ${(state.settings.lineSharpness||0) === 1 ? 'selected' : ''}>Subtle</option>
            <option value="2" ${(state.settings.lineSharpness||0) === 2 ? 'selected' : ''}>Strong</option>
            <option value="3" ${(state.settings.lineSharpness||0) === 3 ? 'selected' : ''}>Max</option>
          </select>
          <p class="setting-description">Increases contrast to make manga lines crisper</p>
        </div>
        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Hide read chapters</span>
            <input type="checkbox" id="skipReadToggle" ${state.settings.skipReadChapters ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Hides chapters you've already finished reading</p>
        </div>
        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Skip duplicate chapters</span>
            <input type="checkbox" id="skipDuplicatesToggle" ${state.settings.skipDuplicates ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Automatically advances past duplicates of the same chapter number</p>
        </div>
        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Pan wide images</span>
            <input type="checkbox" id="panWideToggle" ${state.settings.panWideImages ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Allows horizontal scrolling on double-page spreads</p>
        </div>
        <div class="settings-divider"></div>
        <div class="setting-group">
          <button class="btn secondary" id="clearReadBtn">Clear Reading History</button>
        </div>
        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Commands</h3>
        <div class="setting-group">
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="cheatInput" class="input" placeholder="Enter command…" autocomplete="off" autocorrect="off" spellcheck="false" style="flex:1;font-family:monospace">
            <button class="btn primary" id="cheatRunBtn">Run</button>
          </div>
          <p class="setting-description" style="margin-top:6px">Available: <code>cls</code> — reset all AP &amp; achievements &nbsp;·&nbsp; <code>godmode</code> — add 500 AP</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  $("modeSelect").onchange = (e) => {
    state.settings.readingMode = e.target.value;
    saveSettings();
    if (state.currentChapter) { showReader(); renderPage(); }
  };
  $("sharpnessSelect").onchange = (e) => {
    state.settings.lineSharpness = parseInt(e.target.value, 10);
    saveSettings();
    const pw = $("pageWrap");
    if (pw) {
      pw.classList.remove('sharp-1', 'sharp-2', 'sharp-3');
      if (state.settings.lineSharpness > 0) pw.classList.add(`sharp-${state.settings.lineSharpness}`);
    }
  };
  $("skipReadToggle").onchange = (e) => {
    state.settings.skipReadChapters = e.target.checked;
    saveSettings();
    if (state.currentManga) loadChapters();
  };
  $("skipDuplicatesToggle").onchange = (e) => {
    state.settings.skipDuplicates = e.target.checked;
    saveSettings();
  };
  $("panWideToggle").onchange = (e) => {
    state.settings.panWideImages = e.target.checked;
    saveSettings();
    if (state.currentChapter) renderPage();
  };
  function runCheatCommand(cmd) {
    switch ((cmd || '').trim().toLowerCase()) {
      case 'cls':
        achievementManager.reset();
        localStorage.setItem('scrollscape_ap_bonus', '0');
        localStorage.setItem('scrollscape_ap_spent', '0');
        updateApBadge();
        showToast('Reset complete', 'All AP and achievements cleared.', 'info');
        break;
      case 'godmode':
        addBonusAP(500);
        updateApBadge();
        showToast('Godmode activated', '+500 AP added to your wallet.', 'success');
        break;
      default:
        showToast('Unknown command', `"${cmd}" is not a valid command.`, 'warning');
    }
  }
  $('cheatRunBtn').onclick = () => {
    const inp = $('cheatInput');
    runCheatCommand(inp.value);
    inp.value = '';
  };
  $('cheatInput').onkeydown = (e) => {
    if (e.key === 'Enter') { runCheatCommand($('cheatInput').value); $('cheatInput').value = ''; }
  };

  $("clearReadBtn").onclick = async () => {
    if (confirm("Clear all reading history?")) {
      try { await fetch("/api/history/clear", { method: "DELETE" }); } catch (_) {}
      state.history = [];
      state.readChapters.clear();
      state.flaggedChapters.clear();
      state.lastReadPages = {};
      state.lastReadChapter = {};
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
      renderLibrary();
      showToast("Reading history cleared", "", "info");
    }
  };
}

// ============================================================================
// CUSTOM LISTS VIEW
// ============================================================================

// ============================================================================
// CUSTOM LISTS VIEW (REMOVED)
// ============================================================================

// ============================================================================
// ANALYTICS VIEW
// ============================================================================

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
    console.error("Analytics error:", e);
  }
}

// ============================================================================
// ACHIEVEMENTS SYSTEM
// ============================================================================

async function checkAndUnlockAchievements() {
  try {
    // Fetch current analytics data
    const anaData = await api("/api/analytics");
    const a = anaData.analytics || {};
    
    // Build analytics object for achievement checking
    const analytics = {
      totalChaptersRead: a.totalChaptersRead || state.readChapters.size,
      totalTimeSpent:    a.totalTimeSpent || 0,
      totalFavorites:    (anaData.totalFavorites || 0),
      completedCount:    (anaData.statusDistribution?.completed || 0),
      totalLists:        (anaData.totalLists || 0),
      statusDistribution: anaData.statusDistribution || {},
      dailyStreak:       a.dailyStreak || 0,
      libraryTitles:     (state.favorites || []).map(m => (m.title || '').toLowerCase())
    };

    // Check achievements using AchievementManager
    const newlyUnlocked = achievementManager.checkAchievements(analytics);
    
    // Send newly unlocked achievements to backend
    for (const achievementId of newlyUnlocked) {
      try {
        await api("/api/achievements/unlock", {
          method: "POST",
          body: JSON.stringify({ achievementId })
        });
        
        // Show toast notification
        const achievement = achievementManager.getAchievement(achievementId);
        if (achievement) {
          showToast(
            `Achievement Unlocked! `, 
            `${achievement.name}: ${achievement.description}`, 
            "success"
          );
        }
      } catch (err) {
        console.error(`Failed to sync achievement ${achievementId}:`, err);
      }
    }
    
    // Update state
    state.earnedAchievements = achievementManager.unlockedAchievements;
    updateApBadge();
  } catch (e) {
    console.error('Error checking achievements:', e);
  }
}

async function renderAchievementsGrid() {
  const grid = $("achievementsGrid");
  if (!grid) return;
  
  try {
    // Get achievement stats
    const stats = achievementManager.getStats();
    const countEl = $("achievementCount");
    if (countEl) countEl.textContent = `${stats.unlocked}/${stats.total}`;

    // Render achievements by category
    const html = achievementManager.categories.map(category => {
      const achievements = achievementManager.getAchievementsByCategory(category.id);
      
      return `
        <div class="achievement-category">
          <h3 class="achievement-category-title">${escapeHtml(category.name)}</h3>
          <p class="achievement-category-desc">${escapeHtml(category.description)}</p>
          <div class="achievement-category-grid">
            ${achievements.map(a => {
              const isUnlocked = achievementManager.isUnlocked(a.id);
              const rarityClass = a.rarity || 'common';
              
              return `
                <div class="achievement-item ${isUnlocked ? 'earned' : 'locked'} rarity-${rarityClass}">
                  <div class="achievement-icon">
                    <i data-feather="${escapeHtml(a.icon)}" ${isUnlocked ? '' : 'class="locked-icon"'}></i>
                  </div>
                  <div class="achievement-info">
                    <h4>${escapeHtml(a.name)}</h4>
                    <p>${escapeHtml(a.description)}</p>
                    ${a.points ? `<span class="achievement-points">+${a.points} pts</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html || '<div class="muted">No achievements available.</div>';
    
    // Initialize Feather icons if available
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
    
  } catch (e) {
    console.error('Error rendering achievements:', e);
    grid.innerHTML = `<div class="muted">Could not load achievements.</div>`;
  }
}

// ============================================================================
// DRAGON BALL EASTER EGG HELPERS
// ============================================================================

function dragonBallSVG(n) {
  return `<img src="/dragon-ball-${n}.png" class="db-sprite" draggable="false" alt="${n}-star Dragon Ball">`;
}

function summonShenlong() {
  addBonusAP(50);
  updateApBadge();
  const overlay = document.getElementById('shenlong-overlay');
  const gif = document.getElementById('shenlong-gif');
  if (overlay) {
    // Reset GIF src so it replays from frame 1 every time
    if (gif) {
      const src = gif.getAttribute('src');
      gif.setAttribute('src', '');
      requestAnimationFrame(() => gif.setAttribute('src', src));
    }
    overlay.classList.remove('hidden');
    overlay.classList.add('shenlong-show');
    setTimeout(() => {
      overlay.classList.add('shenlong-hide');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('shenlong-show', 'shenlong-hide');
      }, 800);
    }, 2800);
  }
  showToast('Shenlong appears!', 'Your wish is granted — +50 AP!', 'success');
}

// ============================================================================
// ACHIEVEMENTS PAGE VIEW
// ============================================================================

async function renderAchievementsView() {
  const content = document.getElementById('achPageContent');
  if (!content) return;
  updateApBadge();

  // If definitions haven't loaded yet (e.g., first navigation hit before async
  // startup finished, or the initial fetch failed), try once more.
  if (achievementManager.categories.length === 0) {
    try {
      content.innerHTML = '<div class="muted">Loading achievements…</div>';
      await achievementManager.loadAchievements();
    } catch (_) { /* fall through — will show "no achievements" */ }
  }

  // Secret Dragon Ball easter egg: collect all 7 dragon balls → Shenlong grants 50 AP
  const db = document.getElementById('achDragonBall');
  if (db) {
    if (!db.dataset.eggBound) {
      db.dataset.eggBound = '1';
      db.dataset.ball = '1';
      let eggTimer = null;
      db.addEventListener('click', () => {
        let ball = parseInt(db.dataset.ball || '1');
        db.style.transform = `scale(1.25) rotate(${ball * 52}deg)`;
        setTimeout(() => { db.style.transform = ''; }, 250);
        clearTimeout(eggTimer);
        if (ball === 7) {
          // All 7 balls collected — summon Shenlong!
          db.dataset.ball = '1';
          setTimeout(() => { db.innerHTML = dragonBallSVG(1); }, 3000);
          summonShenlong();
        } else {
          ball++;
          db.dataset.ball = ball;
          db.innerHTML = dragonBallSVG(ball);
          // Reset if idle for 3 seconds without reaching 7
          eggTimer = setTimeout(() => {
            db.dataset.ball = '1';
            db.innerHTML = dragonBallSVG(1);
          }, 3000);
        }
      });
    }
    // Render current ball if empty
    if (!db.innerHTML.trim()) db.innerHTML = dragonBallSVG(1);
  }
  const total    = achievementManager.achievements.length;
  const unlocked = achievementManager.unlockedAchievements.size;
  const countEl  = document.getElementById('achievementCount');
  if (countEl) countEl.textContent = `${unlocked}/${total}`;
  const html = achievementManager.categories.map(cat => {
    const achs = achievementManager.getAchievementsByCategory(cat.id);
    const catUnlocked = achs.filter(a => achievementManager.isUnlocked(a.id)).length;
    return `
      <div class="ach-page-category">
        <div class="ach-category-header">
          <h3>${escapeHtml(cat.name)}</h3>
          <span class="ach-category-count">${catUnlocked}/${achs.length}</span>
        </div>
        <div class="ach-category-grid">
          ${achs.map(a => {
            const isUnlocked = achievementManager.isUnlocked(a.id);
            return `
              <div class="ach-card ${isUnlocked ? 'ach-unlocked' : 'ach-locked'} ach-rarity-${escapeHtml(a.rarity || 'common')}" title="${escapeHtml(a.description)}">
                <div class="ach-card-icon"><i data-feather="${escapeHtml(a.icon)}"></i></div>
                <div class="ach-card-name">${escapeHtml(a.name)}</div>
                ${isUnlocked
                  ? `<div class="ach-card-ap">+1 AP</div>`
                  : `<div class="ach-card-locked-desc">${escapeHtml(a.description)}</div>`}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  content.innerHTML = html || '<div class="muted">No achievements yet.</div>';
  if (typeof feather !== 'undefined') feather.replace();
}

// ============================================================================
// SHOP VIEW
// ============================================================================

function renderShopView() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  updateApBadge();
  const ap        = getAvailableAP();
  const purchased = getPurchasedThemes();
  const active    = getActiveTheme();
  grid.innerHTML = SHOP_THEMES.map(t => {
    const owned    = purchased.includes(t.id);
    const isActive = active === t.id;
    const canAfford = ap >= t.cost;
    let btn, badge = '';
    if (isActive) {
      btn = `<button class="shop-btn shop-btn-active" disabled>Active</button>`;
      badge = `<span class="shop-active-badge">&#x2713; Active</span>`;
    } else if (owned) {
      btn = `<button class="shop-btn shop-btn-owned" onclick="setActiveTheme('${t.id}');renderShopView()">Apply</button>`;
    } else if (t.cost === 0) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="addPurchasedTheme('${t.id}');setActiveTheme('${t.id}');renderShopView()">Get Free</button>`;
    } else if (canAfford) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="buyTheme('${t.id}')">Buy</button>`;
    } else {
      btn = `<button class="shop-btn shop-btn-afford" disabled>Need ${t.cost} AP</button>`;
    }
    const costStr = t.cost === 0 ? '<span style="color:var(--success)">Free</span>' : `<span class="ap-star">&#x2B50;</span>${t.cost} AP`;
    return `
      <div class="shop-card ${isActive ? 'shop-active' : owned ? 'shop-owned' : ''}">
        <div class="shop-card-preview" style="background:${t.preview}"></div>
        <div class="shop-card-body">
          <div class="shop-card-name">${escapeHtml(t.name)}</div>
          <div class="shop-card-desc">${escapeHtml(t.desc)}</div>
          <div class="shop-card-footer">
            <span class="shop-card-cost">${costStr}</span>
            ${btn}
          </div>
          ${badge}
        </div>
      </div>`;
  }).join('');
}

function buyTheme(id) {
  const t  = SHOP_THEMES.find(x => x.id === id);
  if (!t) return;
  const ap = getAvailableAP();
  if (ap < t.cost) { showToast('Not enough AP', `You need ${t.cost} AP`, 'warning'); return; }
  spendAP(t.cost);
  addPurchasedTheme(id);
  setActiveTheme(id);
  showToast('Theme unlocked! ', t.name, 'success');
  renderShopView();
  updateApBadge();
}

// ============================================================================
// GENRE / AUTHOR NAVIGATION
// ============================================================================

async function searchByAuthor(author) {
  if (!author) return;
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  setView("advanced-search");
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  state.advancedFilters.tags.clear();
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(c => c.classList.remove("active"));
  const statusEl = $("advancedSearchStatus");
  const resultsDiv = $("advancedResults");
  if (statusEl) statusEl.textContent = `Searching author: "${author}"...`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/authorSearch`, {
      method: "POST",
      body: JSON.stringify({ authorName: author })
    });
    const results = result.results || [];
    if (!results.length) {
      if (resultsDiv) resultsDiv.innerHTML = `<div class="muted">No results found for author "${escapeHtml(author)}"</div>`;
      if (statusEl) statusEl.textContent = `0 result(s) for author "${author}"`;
      return;
    }
    renderMangaGrid(resultsDiv, results);
    if (statusEl) statusEl.textContent = `${results.length} result(s) for author "${author}"`;
  } catch (e) {
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

function searchByGenre(genre) {
  // Clear existing tag filters and add the selected genre
  state.advancedFilters.tags.clear();
  state.advancedFilters.tags.add(genre.toLowerCase());

  // Navigate to advanced search view
  setView("advanced-search");

  // Visually activate the matching genre chip in the advanced search UI
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(chip => {
    const chipTag = chip.dataset.tag || "";
    const isMatch = chipTag.toLowerCase() === genre.toLowerCase();
    chip.classList.toggle("active", isMatch);
    if (isMatch) state.advancedFilters.tags.add(chipTag);
  });

  // Pre-fill the search input and run the search
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  advancedSearch();
}

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

async function advancedSearch(page = 1) {
  const query   = $("advancedSearchInput").value.trim();
  const orderBy = $("advancedOrderBy").value;
  const publicationStatus = $("advancedPublicationStatus")?.value || "";
  const contentRating = $("advancedContentRating")?.value || "";
  const format = $("advancedFormat")?.value || "";
  const selectedGenres = Array.from(document.querySelectorAll('#genreGrid input[type="checkbox"]:checked')).map(cb => cb.value);

  if (!state.currentSourceId) {
    $("advancedSearchStatus").textContent = "Select a source first.";
    return;
  }

  state.advSearchPage = page;
  $("advancedSearchStatus").textContent = "Searching...";
  try {
    let result;
    if (selectedGenres.length > 0) {
      // Use byGenres endpoint so genres are resolved to real tag UUIDs on the backend
      result = await api(`/api/source/${state.currentSourceId}/byGenres`, {
        method: "POST",
        body: JSON.stringify({ genres: selectedGenres, orderBy })
      });
    } else {
      result = await api(`/api/source/${state.currentSourceId}/search`, {
        method: "POST",
        body: JSON.stringify({ query: query || "", page, orderBy })
      });
    }

    let results = result.results || [];
    const hasNextPage = result.hasNextPage || false;
    state.advSearchHasNextPage = hasNextPage;

    // Client-side filtering for additional criteria
    if (query && selectedGenres.length > 0) {
      const q = query.toLowerCase();
      results = results.filter(m => (m.title || "").toLowerCase().includes(q));
    }

    if (publicationStatus) {
      results = results.filter(m => m.status?.toLowerCase() === publicationStatus.toLowerCase());
    }

    if (contentRating) {
      results = results.filter(m => m.contentRating?.toLowerCase() === contentRating.toLowerCase());
    }

    const resultsDiv = $("advancedResults");
    if (!results.length) {
      resultsDiv.innerHTML = `<div class="muted">No results found</div>`;
      $("advancedSearchStatus").textContent = "0 result(s) found";
      renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
      return;
    }
    renderMangaGrid(resultsDiv, results);
    $("advancedSearchStatus").textContent = `${results.length} result(s) found — Page ${page}`;
    renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
  } catch (e) {
    $("advancedSearchStatus").textContent = `Error: ${e.message}`;
    renderPagination("advancedSearchPagination", page, false, "advSearchGoToPage");
  }
}

async function randomManga() {
  const sourceIds = Object.keys(state.installedSources).filter(id => id !== 'local');
  const statusEl = $('advancedSearchStatus');

  // Build a combined pool: library items (any source) + online search from a random source/page
  let pool = [];

  // Add library
  for (const m of (state.favorites || [])) {
    if (m.sourceId && m.sourceId !== 'local') pool.push({ id: m.id, sourceId: m.sourceId });
  }

  // Add online results from a random installed source on a random page
  if (sourceIds.length > 0) {
    const src = sourceIds[Math.floor(Math.random() * sourceIds.length)];
    const pg  = Math.floor(Math.random() * 15) + 1;
    if (statusEl) statusEl.textContent = 'Finding random manga...';
    try {
      const res = await api(`/api/source/${src}/search`, {
        method: 'POST',
        body: JSON.stringify({ query: '', page: pg })
      });
      for (const m of (res.results || [])) pool.push({ id: m.id, sourceId: src });
    } catch (_) { /* use library only if network fails */ }
  }

  if (!pool.length) {
    if (statusEl) statusEl.textContent = 'No manga found. Install a source or add manga to your library.';
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const prevSource = state.currentSourceId;
  state.currentSourceId = pick.sourceId;
  state._fromRandom = true;
  if (statusEl) statusEl.textContent = '';
  try {
    await loadMangaDetails(pick.id, 'random');
  } catch (e) {
    state.currentSourceId = prevSource;
    state._fromRandom = false;
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

function initAdvancedFilters() {
  // Auto-refresh on dropdown changes
  const dropdownFilters = [
    "advancedOrderBy",
    "advancedPublicationStatus",
    "advancedContentRating",
    "advancedFormat"
  ];

  dropdownFilters.forEach(id => {
    const el = $(id);
    if (el) {
      el.onchange = () => {
        const view = document.querySelector("#view-advanced-search");
        if (view && !view.classList.contains("hidden")) advancedSearch();
      };
    }
  });

  // Genre checkboxes — debounced auto-search
  const genreGrid = $("genreGrid");
  if (genreGrid) {
    genreGrid.addEventListener("change", () => {
      const view = document.querySelector("#view-advanced-search");
      if (view && !view.classList.contains("hidden")) advancedSearch();
    });
  }

  // Clear genres button
  const clearBtn = $("clearGenresBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      document.querySelectorAll('#genreGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
      const view = document.querySelector("#view-advanced-search");
      if (view && !view.classList.contains("hidden")) advancedSearch();
    };
  }
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

function setView(view, context = {}, replace = false) {
  // Update navigation manager
  navigationManager.navigateTo(view, context, replace);

  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "analytics", "history", "achievements", "shop", "customize", "calendar"];
  for (const v of ALL_VIEWS) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }

  // Sync sidebar active state
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle("active", linkView === view);
  });

  // On-enter actions per view
  if (view === "library") {
    renderLibrary();
  } else if (view === "analytics") {
    renderAnalyticsView();
  } else if (view === "history") {
    renderHistoryView();
  } else if (view === "achievements") {
    renderAchievementsView();
  } else if (view === "shop") {
    renderShopView();
  } else if (view === "customize") {
    renderCustomizeView();
  } else if (view === "calendar") {
    renderCalendarView();
  } else if (view === "manga-details") {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Restore context if available
    const ctx = navigationManager.getContext();
    if (ctx.mangaId && ctx.sourceId) {
      // Context is already set, renderMangaDetails will use it
    }
  }
}

// ============================================================================
// UI BINDING
// ============================================================================

function bindUI() {
  initAdvancedFilters();

  // Sidebar toggle (mobile)
  const toggle   = $("sidebarToggle");
  const backdrop = $("sidebarBackdrop");
  if (toggle)   toggle.onclick   = () => document.body.classList.toggle("sidebar-open");
  if (backdrop) backdrop.onclick = () => document.body.classList.remove("sidebar-open");

  // Nav links
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      setView(link.dataset.view);
      document.body.classList.remove("sidebar-open");
    };
  });

  // Back buttons
  const backBtn = $("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const previous = navigationManager.goBack();
      if (previous) {
        // Restore specific view states
        if (previous.view === 'manga-details' && previous.context.mangaId && previous.context.sourceId) {
          // Temporarily set the source and load the manga details
          const prevSource = state.currentSourceId;
          state.currentSourceId = previous.context.sourceId;
          loadMangaDetails(previous.context.mangaId);
          // Note: loadMangaDetails will call setView internally
        } else {
          setView(previous.view, previous.context, true);
        }
      }
    };
  }

  // Search
  const searchBtn   = $("searchBtn");
  const searchInput = $("searchInput");
  if (searchBtn)   searchBtn.onclick = () => { clearTimeout(_liveSearchTimer); search(); };
  if (searchInput) {
    searchInput.onkeypress = (e) => { if (e.key === "Enter") { clearTimeout(_liveSearchTimer); search(); } };
    searchInput.oninput = () => {
      clearTimeout(_liveSearchTimer);
      _liveSearchTimer = setTimeout(() => search(), 450);
    };
  }

  // Theme toggle
  const themeBtn = $("themeToggle");
  if (themeBtn) themeBtn.onclick = toggleTheme;

  // Settings button (sidebar)
  const settingsBtnSidebar = $("btn-settings-sidebar");
  if (settingsBtnSidebar) settingsBtnSidebar.onclick = showSettings;

  const readerSettingsBtn = $("readerSettingsBtn");
  if (readerSettingsBtn) readerSettingsBtn.onclick = showSettings;

  // Reader controls
  const closeReader = $("closeReader");
  const prevPage    = $("prevPage");
  const nextPage    = $("nextPage");

  if (closeReader) closeReader.onclick = () => hideReader();

  if (prevPage) prevPage.onclick = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("backward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("backward"); return; }
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      state.currentPageIndex--;
      renderPage();
    }
  };

  if (nextPage) nextPage.onclick = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("forward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("forward"); return; }
    if (state.currentPageIndex === (state.currentChapter?.pages?.length ?? 1) - 1) {
      goToNextChapter();
    } else {
      state.currentPageIndex++;
      renderPage();
    }
  };

  // Zoom controls
  const zoomIn    = $("zoomIn");
  const zoomOut   = $("zoomOut");
  const zoomReset = $("zoomReset");
  if (zoomIn)    zoomIn.onclick    = () => applyZoom(+0.1);
  if (zoomOut)   zoomOut.onclick   = () => applyZoom(-0.1);
  if (zoomReset) zoomReset.onclick = () => { state.zoomLevel = 1.0; updateZoomUI(); renderPage(); };

  // AutoScroll controls
  const autoScrollToggle = $("autoScrollToggle");
  const autoScrollSpeed  = $("autoScrollSpeed");
  if (autoScrollToggle) autoScrollToggle.onclick = toggleAutoScroll;
  if (autoScrollSpeed) {
    autoScrollSpeed.value = state.autoScroll.speed;
    autoScrollSpeed.oninput = (e) => {
      state.autoScroll.speed = parseInt(e.target.value, 10);
      const labels = ["Slow", "Medium", "Fast", "Faster", "Fastest"];
      const labelEl = $("autoScrollSpeedLabel");
      if (labelEl) labelEl.textContent = labels[state.autoScroll.speed - 1] || "Medium";
      if (state.autoScroll.enabled) { stopAutoScroll(); startAutoScroll(); }
    };
  }

  // Keyboard shortcuts in reader
  document.addEventListener("keydown", (e) => {
    if ($("reader")?.classList.contains("hidden")) return;
    const mode = state.settings.readingMode;
    if (e.key === "ArrowRight" || e.key === "d") {
      if (mode !== "webtoon") {
        if (mode === "rtl")      { navigateBook("backward"); }
        else if (mode === "ltr") { navigateLTR("forward"); }
        else { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
      }
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      if (mode !== "webtoon") {
        if (mode === "rtl")      { navigateBook("forward"); }
        else if (mode === "ltr") { navigateLTR("backward"); }
        else { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
      }
    } else if (e.key === "Escape") {
      hideReader();
    } else if (e.key === "+" || e.key === "=") {
      applyZoom(+0.1);
    } else if (e.key === "-" || e.key === "_") {
      applyZoom(-0.1);
    }
  });

  // Advanced search buttons
  const advBtn   = $("advancedSearchBtn");
  const advInput = $("advancedSearchInput");
  const randBtn  = $("randomMangaBtn");
  if (advBtn)   advBtn.onclick   = () => advancedSearch();
  if (advInput) advInput.onkeypress = (e) => { if (e.key === "Enter") advancedSearch(); };
  if (randBtn)  randBtn.onclick  = randomManga;

  // Initialize advanced filters
  initAdvancedFilters();

  // Library status filter
  const libFilter = $("libraryStatusFilter");
  if (libFilter) libFilter.onchange = renderLibrary;

  // Language toggle button
  const langBtn = $("langToggleBtn");
  if (langBtn) {
    langBtn.textContent = currentLanguage.toUpperCase();
    langBtn.onclick = () => setLanguage(currentLanguage === 'en' ? 'pt' : 'en');
  }
}

// ============================================================================

// CUSTOMIZATION

// ============================================================================



const CUSTOM_PRESETS_KEY = 'scrollscape_custom_presets';

const CUSTOM_ACTIVE_KEY  = 'scrollscape_active_custom';

// Shared callback so initColorPicker can trigger livePreview
var _cpLivePreviewCb = null;
// Tracks whether we are currently editing an existing preset
var _editingPresetId = null;



function getCustomPresets() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]'); } catch (e) { return []; }

}

function saveCustomPresets(arr) {

  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(arr));

}

function getActiveCustom() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_ACTIVE_KEY) || 'null'); } catch (e) { return null; }

}

function setActiveCustom(cfg) {

  if (cfg) localStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(cfg));

  else     localStorage.removeItem(CUSTOM_ACTIVE_KEY);

}



// ── Palette colour helpers ───────────────────────────────────────────────────
function _hexToHsv(hex) {
  var r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, h=0, s=max===0?0:d/max, v=max;
  if(max!==min){switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h*=60;}
  return {h:h,s:s,v:v};
}
function _hsvToHex(h,s,v){
  h=((h%360)+360)%360;
  var i=Math.floor(h/60)%6,f=h/60-Math.floor(h/60);
  var p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  var rgb=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
  return '#'+rgb.map(function(x){return Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0');}).join('');
}
function _derivePalette(hex){
  var c=_hexToHsv(hex);
  return {
    primary: hex,
    dark:  _hsvToHex(c.h, Math.min(1,c.s*1.05), c.v*0.62),
    light: _hsvToHex(c.h, Math.max(0,c.s*0.55), Math.min(1,c.v+0.18))
  };
}

function applyCustomization(cfg) {

  ['custom-char', 'custom-corner', 'custom-bg-layer'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { if (el._obs) el._obs.disconnect(); el.remove(); }
  });

  var styleEl = document.getElementById('custom-live-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-live-style';
    document.head.appendChild(styleEl);
  }
  var palStyleEl = document.getElementById('custom-palette-style');
  if (!palStyleEl) {
    palStyleEl = document.createElement('style');
    palStyleEl.id = 'custom-palette-style';
    document.head.appendChild(palStyleEl);
  }

  if (!cfg) { styleEl.textContent = ''; palStyleEl.textContent = ''; return; }

  var bgUrl      = cfg.bgUrl      || '';
  var bgDim      = cfg.bgDim      != null ? cfg.bgDim      : 0;
  var bgOpac     = cfg.bgOpac     != null ? cfg.bgOpac     : 0;
  var headerUrl  = cfg.headerUrl  || '';
  var headerDim  = cfg.headerDim  != null ? cfg.headerDim  : 0;
  var headerOpac = cfg.headerOpac != null ? cfg.headerOpac : 0;
  var charUrl    = cfg.charUrl    || '';
  var charDim    = cfg.charDim    != null ? cfg.charDim    : 0;
  var charDark   = cfg.charDark   != null ? cfg.charDark   : 0;
  var cornerUrl  = cfg.cornerUrl  || '';
  var cornerDim  = cfg.cornerDim  != null ? cfg.cornerDim  : 0;
  var cornerDark = cfg.cornerDark != null ? cfg.cornerDark : 0;

  var css = '';
  if (headerUrl) css += ".topbar { background: linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")), url('" + headerUrl + "') center/cover !important; opacity:" + ((100-headerOpac)/100) + " !important; }\n";
  styleEl.textContent = css;

  if (bgUrl) {
    var bgLayer = document.createElement('div');
    bgLayer.id = 'custom-bg-layer';
    bgLayer.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;' +
      "background:linear-gradient(rgba(0,0,0," + (bgDim/100) + "),rgba(0,0,0," + (bgDim/100) + ")),url('" + bgUrl + "') center/cover fixed;" +
      'opacity:' + ((100 - bgOpac) / 100);
    document.body.appendChild(bgLayer);
  }

  function _mkOverlay(id, wrapCss, imgCss, opac, src, brightness) {
    var w = document.createElement('div');
    w.id = id; w.style.cssText = wrapCss + ';opacity:' + opac;
    var i = document.createElement('img');
    i.src = src; i.alt = ''; i.style.cssText = imgCss;
    if (brightness != null) i.style.filter = 'brightness(' + brightness + ')';
    w.appendChild(i); document.body.appendChild(w);
    var re = document.getElementById('reader');
    if (re) {
      var sv = function() { w.style.display = re.classList.contains('hidden') ? '' : 'none'; };
      var ob = new MutationObserver(sv);
      ob.observe(re, { attributes: true, attributeFilter: ['class'] });
      w._obs = ob; sv();
    }
  }

  // Both overlays at left:0 (left edge of screen).
  // z-index must exceed the sidebar (100) so they are visible.
  // pointer-events:none is already set, so sidebar/content clicks pass through.
  // Left Column (z-index:102) appears on top of Corner Card (z-index:101).

  if (charUrl) {
    _mkOverlay(
      'custom-char',
      'position:fixed;bottom:0;left:0;width:240px;height:100vh;pointer-events:none;overflow:hidden;z-index:102;-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 100%);mask-image:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 100%)',
      'position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:90vh;width:auto;object-fit:contain',
      (100 - charDim) / 100, charUrl, 1 - charDark / 100
    );
  }

  if (cornerUrl) {
    _mkOverlay(
      'custom-corner',
      'position:fixed;bottom:0;left:0;width:240px;height:210px;border-radius:0 12px 0 0;pointer-events:none;overflow:hidden;z-index:101;background:rgba(0,0,0,0.18);-webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 42%);mask-image:linear-gradient(to bottom,transparent 0%,black 42%)',
      'position:absolute;bottom:0;left:0;width:100%;height:100%;object-fit:cover',
      (100 - cornerDim) / 100, cornerUrl, 1 - cornerDark / 100
    );
  }

  // Apply custom palette colours directly on the root element as inline style —
  // inline styles have higher priority than any stylesheet rule (including active themes).
  var paletteColor = cfg.paletteColor || '';
  if (paletteColor && /^#[0-9a-f]{6}$/i.test(paletteColor)) {
    var pal = _derivePalette(paletteColor);
    document.documentElement.style.setProperty('--primary',       pal.primary);
    document.documentElement.style.setProperty('--primary-dark',  pal.dark);
    document.documentElement.style.setProperty('--primary-light', pal.light);
  } else {
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--primary-dark');
    document.documentElement.style.removeProperty('--primary-light');
  }
  palStyleEl.textContent = '';

}



function renderCustomizeView() {

  var presets = getCustomPresets();

  var active  = getActiveCustom() || {};



  var presetsHtml = presets.length

    ? presets.map(function(p) {

        return '<div class="custom-preset-card" id="preset-card-' + p.id + '">' +

          '<div class="custom-preset-info"><span class="custom-preset-name">' + escapeHtml(p.name) + '</span></div>' +

          '<div class="custom-preset-actions">' +

            '<button class="btn secondary" onclick="applyCustomPreset(\'' + p.id + '\')">Apply</button>' +

            '<button class="btn secondary" onclick="editCustomPreset(\'' + p.id + '\')">&#9998; Edit</button>' +

            '<button class="btn danger" onclick="deleteCustomPreset(\'' + p.id + '\')">Remove</button>' +

          '</div></div>';

      }).join('')

    : '<p class="muted" style="text-align:center;padding:1rem">No saved presets yet</p>';



  var bgu = escapeHtml(active.bgUrl     || '');

  var bd  = active.bgDim     || 0;

  var cu  = escapeHtml(active.charUrl   || '');

  var cd  = active.charDim   || 0;

  var hu  = escapeHtml(active.headerUrl || '');

  var hd  = active.headerDim || 0;

  var cou = escapeHtml(active.cornerUrl || '');

  var cod = active.cornerDim || 0;

  var bgo  = active.bgOpac     || 0;

  var chd  = active.charDark   || 0;

  var ho   = active.headerOpac || 0;

  var cod2 = active.cornerDark || 0;



  var prevBg  = bgu ? "background:linear-gradient(rgba(0,0,0," + (bd/100) + "),rgba(0,0,0," + (bd/100) + ")),url('" + bgu + "') center/cover"  : '';

  var prevCh  = cu  ? "background:url('" + cu + "') center top/contain no-repeat" : '';

  var prevHdr = hu  ? "background:linear-gradient(rgba(0,0,0," + (hd/100) + "),rgba(0,0,0," + (hd/100) + ")),url('" + hu + "') center/cover" : '';

  var prevCor = cou ? "background:url('" + cou + "') center/cover no-repeat" : '';



  document.getElementById('view-customize').innerHTML = '' +

    '<div class="customize-page">' +

      '<div class="ach-page-header">' +

        '<div>' +

          '<h2 class="ach-page-title">&#127912; Customization</h2>' +

          '<p class="ach-page-subtitle">Personalise your interface with custom images</p>' +

        '</div>' +

        '<button class="btn secondary" id="customResetBtn">&#10006; Reset All</button>' +

      '</div>' +

      '<div class="customize-grid">' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#128444;</div>' +
          '<h3 class="customize-card-title">Background</h3>' +
          '<p class="customize-card-desc">Full-page wallpaper</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customBgUrl" class="input customize-input" type="url" placeholder="https://..." value="' + bgu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewBg" style="' + prevBg + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customBgDimVal">' + bd + '</span>%</label>' +
          '<input id="customBgDim" class="customize-slider" type="range" min="0" max="95" value="' + bd + '">' +
          '<label class="customize-label">Transparency: <span id="customBgOpacVal">' + bgo + '</span>%</label>' +
          '<input id="customBgOpac" class="customize-slider" type="range" min="0" max="95" value="' + bgo + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9612;</div>' +
          '<h3 class="customize-card-title">Left Column</h3>' +
          '<p class="customize-card-desc">Character art along the left sidebar</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customCharUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewChar" style="' + prevCh + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customCharDarkVal">' + chd + '</span>%</label>' +
          '<input id="customCharDark" class="customize-slider" type="range" min="0" max="95" value="' + chd + '">' +
          '<label class="customize-label">Transparency: <span id="customCharDimVal">' + cd + '</span>%</label>' +
          '<input id="customCharDim" class="customize-slider" type="range" min="0" max="95" value="' + cd + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9644;</div>' +
          '<h3 class="customize-card-title">Header</h3>' +
          '<p class="customize-card-desc">Image in the top bar</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customHeaderUrl" class="input customize-input" type="url" placeholder="https://..." value="' + hu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewHeader" style="' + prevHdr + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customHeaderDimVal">' + hd + '</span>%</label>' +
          '<input id="customHeaderDim" class="customize-slider" type="range" min="0" max="95" value="' + hd + '">' +
          '<label class="customize-label">Transparency: <span id="customHeaderOpacVal">' + ho + '</span>%</label>' +
          '<input id="customHeaderOpac" class="customize-slider" type="range" min="0" max="95" value="' + ho + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9724;</div>' +
          '<h3 class="customize-card-title">Corner Card</h3>' +
          '<p class="customize-card-desc">Small card at bottom-left corner</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customCornerUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cou + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewCorner" style="' + prevCor + ';border-radius:8px"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customCornerDarkVal">' + cod2 + '</span>%</label>' +
          '<input id="customCornerDark" class="customize-slider" type="range" min="0" max="95" value="' + cod2 + '">' +
          '<label class="customize-label">Transparency: <span id="customCornerDimVal">' + cod + '</span>%</label>' +
          '<input id="customCornerDim" class="customize-slider" type="range" min="0" max="95" value="' + cod + '">' +
        '</div>' +

        '<div class="customize-card palette-card">' +
          '<div class="customize-card-icon">&#127912;</div>' +
          '<h3 class="customize-card-title">Colour Palette</h3>' +
          '<p class="customize-card-desc">Accent colours used across the interface</p>' +
          '<canvas id="cpSB" class="cp-sb" width="260" height="130"></canvas>' +
          '<canvas id="cpHue" class="cp-hue" width="260" height="14"></canvas>' +
          '<div class="cp-swatches">' +
            '<div class="cp-swatch-group"><div id="cpSwPrimary" class="cp-swatch"></div><span class="customize-label">Primary</span></div>' +
            '<div class="cp-swatch-group"><div id="cpSwDark" class="cp-swatch"></div><span class="customize-label">Dark</span></div>' +
            '<div class="cp-swatch-group"><div id="cpSwLight" class="cp-swatch"></div><span class="customize-label">Light</span></div>' +
          '</div>' +
          '<label class="customize-label">Hex</label>' +
          '<input id="cpHexInput" class="input customize-input" type="text" placeholder="#913FE2" maxlength="7" value="' + escapeHtml(active.paletteColor||'') + '">' +
        '</div>' +

      '</div>' +
      '<div class="customize-save-bar">' +

        '<input id="customPresetName" class="input" style="flex:1;min-width:160px" placeholder="Preset name..." maxlength="40">' +

        '<button class="btn primary" id="customSaveBtn">&#128190; Save Preset</button>' +

        '<button class="btn secondary" id="customApplyBtn">&#9654; Apply Now</button>' +

        '<button class="btn secondary" id="customEditPresetsBtn">&#9998; Edit Presets</button>' +

      '</div>' +

      '<div class="customize-presets-section">' +

        '<h3 class="section-title">Saved Presets</h3>' +

        '<div id="customPresetsList">' + presetsHtml + '</div>' +

      '</div>' +

    '</div>';



  function livePreview() {
    var bgUrl      = document.getElementById('customBgUrl').value.trim();
    var bgDim      = +document.getElementById('customBgDim').value;
    var bgOpac     = +document.getElementById('customBgOpac').value;
    var charUrl    = document.getElementById('customCharUrl').value.trim();
    var charDark   = +document.getElementById('customCharDark').value;
    var charDim    = +document.getElementById('customCharDim').value;
    var headerUrl  = document.getElementById('customHeaderUrl').value.trim();
    var headerDim  = +document.getElementById('customHeaderDim').value;
    var headerOpac = +document.getElementById('customHeaderOpac').value;
    var cornerUrl  = document.getElementById('customCornerUrl').value.trim();
    var cornerDark = +document.getElementById('customCornerDark').value;
    var cornerDim  = +document.getElementById('customCornerDim').value;
    var paletteColor = (document.getElementById('cpHexInput') ? document.getElementById('cpHexInput').value.trim() : '') || '';

    document.getElementById('customBgDimVal').textContent      = bgDim;
    document.getElementById('customBgOpacVal').textContent     = bgOpac;
    document.getElementById('customCharDarkVal').textContent   = charDark;
    document.getElementById('customCharDimVal').textContent    = charDim;
    document.getElementById('customHeaderDimVal').textContent  = headerDim;
    document.getElementById('customHeaderOpacVal').textContent = headerOpac;
    document.getElementById('customCornerDarkVal').textContent = cornerDark;
    document.getElementById('customCornerDimVal').textContent  = cornerDim;

    var p = function(n) { return document.getElementById(n); };
    p('previewBg').style.background     = bgUrl     ? "linear-gradient(rgba(0,0,0," + (bgDim/100) + "),rgba(0,0,0," + (bgDim/100) + ")),url('" + bgUrl + "') center/cover" : '';

    // Left Column — apply darkness (brightness filter) and transparency (opacity)
    var charPrev = p('previewChar');
    charPrev.style.background = charUrl ? "url('" + charUrl + "') center top/contain no-repeat" : '';
    charPrev.style.opacity    = charUrl ? String((100 - charDim)  / 100) : '';
    charPrev.style.filter     = charUrl ? 'brightness(' + (1 - charDark / 100) + ')' : '';

    p('previewHeader').style.background = headerUrl ? "linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")),url('" + headerUrl + "') center/cover" : '';

    // Corner Card — apply darkness (brightness filter) and transparency (opacity)
    var cornerPrev = p('previewCorner');
    cornerPrev.style.background = cornerUrl ? "url('" + cornerUrl + "') center/cover no-repeat" : '';
    cornerPrev.style.opacity    = cornerUrl ? String((100 - cornerDim)  / 100) : '';
    cornerPrev.style.filter     = cornerUrl ? 'brightness(' + (1 - cornerDark / 100) + ')' : '';

    return { bgUrl: bgUrl, bgDim: bgDim, bgOpac: bgOpac, charUrl: charUrl, charDark: charDark, charDim: charDim, headerUrl: headerUrl, headerDim: headerDim, headerOpac: headerOpac, cornerUrl: cornerUrl, cornerDark: cornerDark, cornerDim: cornerDim, paletteColor: paletteColor };
  }

  // Register live-preview callback so initColorPicker can trigger it
  _cpLivePreviewCb = livePreview;
  _editingPresetId = null;



  ['customBgUrl','customBgDim','customBgOpac','customCharUrl','customCharDark','customCharDim','customHeaderUrl','customHeaderDim','customHeaderOpac','customCornerUrl','customCornerDark','customCornerDim'].forEach(function(id) {

    var el = document.getElementById(id);

    if (el) el.addEventListener('input', livePreview);

  });

  initColorPicker();



  document.getElementById('customApplyBtn').onclick = function() {

    var cfg = livePreview();

    setActiveCustom(cfg);

    applyCustomization(cfg);

    showToast('Customization applied', '', 'success');

  };



  document.getElementById('customSaveBtn').onclick = function() {

    var cfg = livePreview();

    var name = document.getElementById('customPresetName').value.trim() || 'My Preset';

    var list = getCustomPresets();

    if (_editingPresetId) {
      // Update existing preset in-place
      list = list.map(function(item) {
        return item.id === _editingPresetId ? Object.assign({}, item, cfg, { name: name }) : item;
      });
      _editingPresetId = null;
    } else {
      list.push(Object.assign({ id: 'custom-' + Date.now(), name: name }, cfg));
    }

    saveCustomPresets(list);

    setActiveCustom(cfg);

    applyCustomization(cfg);

    showToast('Preset saved!', name, 'success');

    renderCustomizeView();

  };

  document.getElementById('customEditPresetsBtn').onclick = function() {
    var section = document.querySelector('.customize-presets-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };



  document.getElementById('customResetBtn').onclick = function() {

    setActiveCustom(null);

    applyCustomization(null);

    showToast('Customization reset', '', 'info');

    renderCustomizeView();

  };

}



// ── Canvas colour picker ─────────────────────────────────────────────────────
function initColorPicker() {
  var sbCv  = document.getElementById('cpSB');
  var hueCv = document.getElementById('cpHue');
  var hexIn = document.getElementById('cpHexInput');
  if (!sbCv || !hueCv || !hexIn) return;

  // Fit canvases to actual rendered width
  var W = sbCv.parentElement.clientWidth - 2;
  if (W > 40) { sbCv.width = W; hueCv.width = W; }

  var sbCtx  = sbCv.getContext('2d');
  var hueCtx = hueCv.getContext('2d');
  var S = { h: 270, s: 0.68, v: 0.88 }; // default purple

  // Load saved colour
  var saved = hexIn.value.trim();
  if (/^#[0-9a-f]{6}$/i.test(saved)) {
    var hsv = _hexToHsv(saved);
    S.h = hsv.h; S.s = hsv.s; S.v = hsv.v;
  }

  function drawHue() {
    var g = hueCtx.createLinearGradient(0,0,hueCv.width,0);
    for (var i=0;i<=1;i+=1/36) g.addColorStop(i,'hsl('+(i*360)+',100%,50%)');
    hueCtx.fillStyle = g;
    hueCtx.fillRect(0,0,hueCv.width,hueCv.height);
    var tx = Math.max(7, Math.min(hueCv.width-7, (S.h/360)*hueCv.width));
    hueCtx.beginPath();
    hueCtx.arc(tx, hueCv.height/2, Math.max(5, hueCv.height/2-1), 0, Math.PI*2);
    hueCtx.strokeStyle='#fff'; hueCtx.lineWidth=2; hueCtx.stroke();
  }

  function drawSB() {
    var gH = sbCtx.createLinearGradient(0,0,sbCv.width,0);
    gH.addColorStop(0,'#fff');
    gH.addColorStop(1,'hsl('+S.h+',100%,50%)');
    sbCtx.fillStyle = gH; sbCtx.fillRect(0,0,sbCv.width,sbCv.height);
    var gV = sbCtx.createLinearGradient(0,0,0,sbCv.height);
    gV.addColorStop(0,'rgba(0,0,0,0)');
    gV.addColorStop(1,'rgba(0,0,0,1)');
    sbCtx.fillStyle = gV; sbCtx.fillRect(0,0,sbCv.width,sbCv.height);
    var cx = S.s * sbCv.width;
    var cy = (1-S.v) * sbCv.height;
    sbCtx.beginPath();
    sbCtx.arc(cx, cy, 7, 0, Math.PI*2);
    sbCtx.strokeStyle='#fff'; sbCtx.lineWidth=2; sbCtx.stroke();
  }

  function commit() {
    var hex = _hsvToHex(S.h, S.s, S.v);
    hexIn.value = hex;
    var pal = _derivePalette(hex);
    var ps=document.getElementById('cpSwPrimary'), pd=document.getElementById('cpSwDark'), pl=document.getElementById('cpSwLight');
    if(ps) ps.style.background=pal.primary;
    if(pd) pd.style.background=pal.dark;
    if(pl) pl.style.background=pal.light;
    // Apply inline CSS vars directly on <html> — overrides any stylesheet/theme.
    document.documentElement.style.setProperty('--primary',       pal.primary);
    document.documentElement.style.setProperty('--primary-dark',  pal.dark);
    document.documentElement.style.setProperty('--primary-light', pal.light);
    // Persist palette colour into the active customisation immediately so
    // a page reload restores the chosen colour even without clicking Apply.
    var _cur = getActiveCustom() || {};
    _cur.paletteColor = hex;
    setActiveCustom(_cur);
    // Sync the rest of the live preview (sliders, other cards)
    if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();
  }

  function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x));}

  // Hue slider
  var hDrag=false;
  function onHue(e){
    e.preventDefault();
    var rect=hueCv.getBoundingClientRect();
    var cx=e.touches?e.touches[0].clientX:e.clientX;
    S.h = clamp((cx-rect.left)/rect.width,0,1)*360;
    drawHue(); drawSB(); commit();
  }
  hueCv.addEventListener('mousedown',function(e){hDrag=true;onHue(e);});
  document.addEventListener('mousemove',function(e){if(hDrag)onHue(e);});
  document.addEventListener('mouseup',function(){hDrag=false;});
  hueCv.addEventListener('touchstart',onHue,{passive:false});
  hueCv.addEventListener('touchmove',onHue,{passive:false});

  // SB square
  var sbDrag=false;
  function onSB(e){
    e.preventDefault();
    var rect=sbCv.getBoundingClientRect();
    var cx=e.touches?e.touches[0].clientX:e.clientX;
    var cy=e.touches?e.touches[0].clientY:e.clientY;
    S.s = clamp((cx-rect.left)/rect.width,0,1);
    S.v = clamp(1-(cy-rect.top)/rect.height,0,1);
    drawSB(); commit();
  }
  sbCv.addEventListener('mousedown',function(e){sbDrag=true;onSB(e);});
  document.addEventListener('mousemove',function(e){if(sbDrag)onSB(e);});
  document.addEventListener('mouseup',function(){sbDrag=false;});
  sbCv.addEventListener('touchstart',onSB,{passive:false});
  sbCv.addEventListener('touchmove',onSB,{passive:false});

  // Hex input
  hexIn.addEventListener('input',function(){
    var v=hexIn.value.trim();
    if(/^#[0-9a-f]{6}$/i.test(v)){
      var c=_hexToHsv(v); S.h=c.h; S.s=c.s; S.v=c.v;
      drawHue(); drawSB(); commit();
    }
  });

  drawHue(); drawSB(); commit();
}

function applyCustomPreset(id) {

  var p = getCustomPresets().find(function(x) { return x.id === id; });

  if (!p) return;

  setActiveCustom(p);

  applyCustomization(p);

  showToast('Preset applied', p.name, 'success');

}

window.applyCustomPreset = applyCustomPreset;



function deleteCustomPreset(id) {

  saveCustomPresets(getCustomPresets().filter(function(x) { return x.id !== id; }));

  renderCustomizeView();

}

function editCustomPreset(id) {

  var preset = getCustomPresets().find(function(x) { return x.id === id; });

  if (!preset) return;

  _editingPresetId = id;

  function set(elId, val) { var el = document.getElementById(elId); if (el) el.value = (val != null ? val : ''); }

  set('customBgUrl',      preset.bgUrl      || '');
  set('customBgDim',      preset.bgDim      != null ? preset.bgDim      : 0);
  set('customBgOpac',     preset.bgOpac     != null ? preset.bgOpac     : 0);
  set('customCharUrl',    preset.charUrl    || '');
  set('customCharDark',   preset.charDark   != null ? preset.charDark   : 0);
  set('customCharDim',    preset.charDim    != null ? preset.charDim    : 0);
  set('customHeaderUrl',  preset.headerUrl  || '');
  set('customHeaderDim',  preset.headerDim  != null ? preset.headerDim  : 0);
  set('customHeaderOpac', preset.headerOpac != null ? preset.headerOpac : 0);
  set('customCornerUrl',  preset.cornerUrl  || '');
  set('customCornerDark', preset.cornerDark != null ? preset.cornerDark : 0);
  set('customCornerDim',  preset.cornerDim  != null ? preset.cornerDim  : 0);
  set('customPresetName', preset.name       || '');

  // Restore palette colour into the canvas picker
  var hexEl = document.getElementById('cpHexInput');
  if (hexEl && preset.paletteColor) {
    hexEl.value = preset.paletteColor;
    hexEl.dispatchEvent(new Event('input'));
  }

  // Trigger full live preview to refresh all sliders and miniatures
  if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();

  // Indicate editing state on the Save button
  var saveBtn = document.getElementById('customSaveBtn');
  if (saveBtn) saveBtn.innerHTML = '&#9998; Update Preset';

  document.getElementById('view-customize').scrollIntoView({ behavior: 'smooth' });

  showToast('Loaded for editing', preset.name, 'info');

}

window.editCustomPreset = editCustomPreset;

window.deleteCustomPreset = deleteCustomPreset;


// ============================================================================
// INITIALIZATION
// ============================================================================

(async function main() {
  initTheme();
  applyTranslations();
  loadSettings();
  applyTheme(getActiveTheme());
  applyCustomization(getActiveCustom());

  // Configure PDF.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  
  // Load achievements from JSON
  try {
    await achievementManager.loadAchievements();
  } catch (err) {
    console.error('Failed to load achievements:', err);
  }
  
  await refreshState();
  bindUI();
  
  // Initialize Feather icons for static HTML
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
  
  // Check achievements on startup based on existing data
  await checkAndUnlockAchievements();
})();
