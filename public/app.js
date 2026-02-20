// ============================================================================
// API HELPER
// ============================================================================

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ============================================================================
// APPLICATION STATE
// ============================================================================

const state = {
  repos: [],
  availableSources: [],
  installedSources: {},
  currentSourceId: null,
  currentManga: null,
  currentChapter: null,
  currentChapterIndex: 0,
  currentPageIndex: 0,
  favorites: [],
  history: [],
  readChapters: new Set(),
  allChapters: [],
  selectedGenres: new Set(),
  selectedStatuses: new Set(),
  sortBy: "relevance",
  settings: {
    language: "en",
    readingMode: "ltr",
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false
  },

  // --- New feature state ---
  readingStatus: {},        // { "mangaId:sourceId": { status, updatedAt, manga } }
  customLists: [],
  analytics: {},
  earnedAchievements: new Set(),
  previousView: "discover",  // tracks which view to return to from manga-details

  // Reader zoom (1.0 = 100%)
  zoomLevel: 1.0,
  readerSessionStart: null, // ms timestamp when chapter opened

  // AutoScroll
  autoScroll: { enabled: false, speed: 2 },

  advancedFilters: {
    orderBy: "relevance",
    statuses: new Set(),
    tags: new Set()
  }
};

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// Each achievement is checked client-side against analytics data
// ============================================================================

const ACHIEVEMENTS = [
  { id: 'first_read',     icon: '📖', label: 'First Steps',       desc: 'Read your first chapter',           check: (a) => a.totalChaptersRead >= 1 },
  { id: 'reader_10',      icon: '📚', label: 'Bookworm',           desc: 'Read 10 chapters',                  check: (a) => a.totalChaptersRead >= 10 },
  { id: 'reader_100',     icon: '🏆', label: 'Manga Addict',        desc: 'Read 100 chapters',                 check: (a) => a.totalChaptersRead >= 100 },
  { id: 'reader_500',     icon: '⭐', label: 'Legend',              desc: 'Read 500 chapters',                 check: (a) => a.totalChaptersRead >= 500 },
  { id: 'first_fav',      icon: '❤️', label: 'Collector',           desc: 'Add your first manga to library',   check: (a) => a.totalFavorites >= 1 },
  { id: 'fav_10',         icon: '📦', label: 'Hoarder',             desc: 'Have 10 manga in your library',     check: (a) => a.totalFavorites >= 10 },
  { id: 'completed_1',    icon: '✅', label: 'Completionist',       desc: 'Mark your first manga as completed',check: (a) => a.completedCount >= 1 },
  { id: 'completed_5',    icon: '🎖️', label: 'Veteran Reader',      desc: 'Complete 5 manga',                  check: (a) => a.completedCount >= 5 },
  { id: 'list_maker',     icon: '📋', label: 'Organizer',           desc: 'Create a custom list',              check: (a) => a.totalLists >= 1 },
  { id: 'night_owl',      icon: '🦉', label: 'Night Owl',           desc: 'Spend 1 hour reading total',        check: (a) => (a.totalTimeSpent || 0) >= 60 },
  { id: 'marathon',       icon: '🏃', label: 'Marathon Reader',     desc: 'Spend 5 hours reading total',       check: (a) => (a.totalTimeSpent || 0) >= 300 },
];

// ============================================================================
// UTILITIES
// ============================================================================

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function statusLabel(status) {
  const map = {
    reading: '📖 Reading',
    completed: '✅ Completed',
    on_hold: '⏸️ On Hold',
    plan_to_read: '🗂️ Plan to Read',
    dropped: '❌ Dropped'
  };
  return map[status] || status;
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
  const saved = localStorage.getItem("manghuTheme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeToggleIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("manghuTheme", next);
  updateThemeToggleIcon(next);
}

function updateThemeToggleIcon(theme) {
  const moonIcon = document.querySelector(".icon-moon");
  const sunIcon  = document.querySelector(".icon-sun");
  if (!moonIcon || !sunIcon) return;
  if (theme === "dark") {
    moonIcon.style.display = "block";
    sunIcon.style.display  = "none";
  } else {
    moonIcon.style.display = "none";
    sunIcon.style.display  = "block";
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(title, message = "", type = "default") {
  const container = $("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ""}
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem("manghuSettings");
    if (saved) state.settings = { ...state.settings, ...JSON.parse(saved) };

    const readChaps = localStorage.getItem("manghuReadChapters");
    if (readChaps) state.readChapters = new Set(JSON.parse(readChaps));

    const progress = localStorage.getItem("manghuReadingProgress");
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
  localStorage.setItem("manghuSettings", JSON.stringify(state.settings));
  localStorage.setItem("manghuReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("manghuReadingProgress", JSON.stringify({
    pages: state.lastReadPages,
    chapters: state.lastReadChapter
  }));
}

function markChapterAsRead(mangaId, chapterId) {
  state.readChapters.add(`${mangaId}:${chapterId}`);
  saveSettings();
}

function isChapterRead(mangaId, chapterId) {
  return state.readChapters.has(`${mangaId}:${chapterId}`);
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

    const [libData, statusData, listsData] = await Promise.all([
      api("/api/library"),
      api("/api/user/status"),
      api("/api/lists")
    ]);

    state.favorites     = libData.favorites || [];
    state.history       = libData.history   || [];
    state.readingStatus = statusData.readingStatus || {};
    state.customLists   = listsData.lists || [];

    renderSourceSelect();
    await Promise.all([
      loadPopularToday(),
      loadRecentlyAdded(),
      loadLatestUpdates()
    ]);
    await updateStats();
    renderLibrary();

    // Trigger recommendations if library has content
    if (state.favorites.length > 0) loadRecommendations();
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
    sel.onchange = () => { state.currentSourceId = sel.value; };
  }
}

// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    if (state.currentSourceId !== "mangadex") {
      row.innerHTML = `<div class="muted">Popular today unavailable for this source.</div>`;
      return;
    }
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1 })
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No popular manga today.</div>`; return; }
    row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
  } catch (e) {
    row.innerHTML = `<div class="muted">Error loading popular manga.</div>`;
  }
}

async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    if (state.currentSourceId !== "mangadex") { row.innerHTML = `<div class="muted">Unavailable.</div>`; return; }
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "createdAt" })
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No recently added manga.</div>`; return; }
    renderMangaGrid(row, list);
  } catch (e) {
    row.innerHTML = `<div class="muted">Error loading recently added.</div>`;
  }
}

async function loadLatestUpdates() {
  const row = $("latestUpdatesRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    if (state.currentSourceId !== "mangadex") { row.innerHTML = `<div class="muted">Unavailable.</div>`; return; }
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "latestUploadedChapter" })
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No recent updates.</div>`; return; }
    renderMangaGrid(row, list);
  } catch (e) {
    row.innerHTML = `<div class="muted">Error loading latest updates.</div>`;
  }
}

function mangaCardHTML(m) {
  const genres = (m.genres || []).slice(0, 3);
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}">
      <div class="manga-card-cover">
        ${m.cover
          ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy">`
          : '<div class="no-cover">?</div>'}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
  `;
}

function renderMangaGrid(container, mangaList) {
  container.innerHTML = mangaList.map(m => mangaCardHTML(m)).join("");
  bindMangaCards(container);
}

function bindMangaCards(container) {
  container.querySelectorAll("[data-manga-id]").forEach(el => {
    el.onclick = () => loadMangaDetails(el.dataset.mangaId);
  });
}

// ============================================================================
// RECOMMENDATIONS
// Based on genres of manga in user's library
// ============================================================================

async function loadRecommendations() {
  const section = $("recommendedSection");
  const row     = $("recommendedRow");
  if (!section || !row || !state.currentSourceId) return;

  // Build genre profile from library
  const genreProfile = new Map();
  for (const m of state.favorites) {
    for (const g of (m.genres || [])) {
      genreProfile.set(g.toLowerCase(), (genreProfile.get(g.toLowerCase()) || 0) + 1);
    }
  }
  if (genreProfile.size === 0) return;

  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "followedCount" })
    });

    const libraryIds = new Set(state.favorites.map(m => m.id));
    const scored = (result.results || [])
      .filter(m => !libraryIds.has(m.id))
      .map(m => {
        const score = (m.genres || []).reduce((n, g) => n + (genreProfile.get(g.toLowerCase()) || 0), 0);
        return { ...m, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (scored.length === 0) return;
    section.style.display = "block";
    row.innerHTML = scored.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
  } catch (e) {
    // Recommendations failing silently is acceptable
  }
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

  if ($("libraryCount")) {
    $("libraryCount").textContent = `${favs.length} manga`;
  }

  if (favs.length === 0) {
    grid.innerHTML = `<div class="muted">No manga found. Add your favorites or change the filter!</div>`;
    return;
  }

  grid.innerHTML = favs.map(manga => {
    const key    = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    const statusBadge = status
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    return `
      <div class="library-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || state.currentSourceId)}">
        <div class="library-card-cover">
          ${manga.cover ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy">` : '<div class="no-cover">?</div>'}
          ${statusBadge}
          <div class="library-card-overlay">
            <button class="btn-read">📖 Continue Reading</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${status ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : ""}
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".library-card").forEach(card => {
    const mangaId  = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    card.onclick = async (e) => {
      // Preserve source context when opening from library
      const prevSource = state.currentSourceId;
      state.currentSourceId = sourceId;
      await loadMangaDetails(mangaId, "library");
      if (!state.currentSourceId) state.currentSourceId = prevSource;
    };
  });
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
        <option value="reading"      ${current === "reading"       ? "selected" : ""}>📖 Reading</option>
        <option value="completed"    ${current === "completed"     ? "selected" : ""}>✅ Completed</option>
        <option value="on_hold"      ${current === "on_hold"       ? "selected" : ""}>⏸️ On Hold</option>
        <option value="plan_to_read" ${current === "plan_to_read"  ? "selected" : ""}>🗂️ Plan to Read</option>
        <option value="dropped"      ${current === "dropped"       ? "selected" : ""}>❌ Dropped</option>
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

async function search() {
  const query = $("searchInput").value.trim();
  const dropdown = $("searchDropdown");
  if (!state.currentSourceId) { $("searchStatus").textContent = "Select a source first."; return; }
  if (!query) {
    if (dropdown) dropdown.innerHTML = "";
    $("searchStatus").textContent = "";
    return;
  }

  $("searchStatus").textContent = "Searching...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, page: 1 })
    });
    const results = result.results || [];
    if (!dropdown) return;
    if (!results.length) {
      dropdown.innerHTML = `<div class="muted" style="padding:1rem">No results found for "${escapeHtml(query)}"</div>`;
      $("searchStatus").textContent = "0 result(s) found";
    } else {
      dropdown.innerHTML = results.map(m => mangaCardHTML(m)).join("");
      bindMangaCards(dropdown);
      $("searchStatus").textContent = `${results.length} result(s) found`;
    }
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

async function loadMangaDetails(mangaId, fromView = "discover") {
  state.previousView = fromView;
  $("searchStatus").textContent = "Loading details...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const isFavorited = state.favorites.some(m => m.id === result.id && m.sourceId === state.currentSourceId);
    const hasProgress = state.lastReadChapter?.[result.id];

    setView("manga-details");

    // Render detail card
    $("details").innerHTML = `
      <div class="manga-details">
        ${result.cover ? `
          <div class="manga-cover">
            <a href="${escapeHtml(`https://anilist.co/search/manga?search=${encodeURIComponent(result.title)}`)}" target="_blank" rel="noopener noreferrer" class="cover-anilist-link" title="View on AniList" onclick="event.stopPropagation()">
              <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
              <div class="cover-anilist-hint">View on AniList</div>
            </a>
          </div>` : ""}
        <div class="manga-info">
          <h2 class="manga-title">${escapeHtml(result.title)}</h2>
          ${result.altTitle ? `<p class="manga-alt-title">${escapeHtml(result.altTitle)}</p>` : ""}
          ${result.author  ? `<p class="manga-author">✍️ ${escapeHtml(result.author)}</p>` : ""}
          <div class="manga-meta">
            ${result.status ? `<span class="badge badge-${result.status === 'ongoing' ? 'success' : 'secondary'}">${escapeHtml(result.status)}</span>` : ""}
            ${result.year   ? `<span class="badge">📅 ${escapeHtml(String(result.year))}</span>` : ""}
          </div>
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
              ${isFavorited ? "❤️ Remove from Library" : "⭐ Add to Library"}
            </button>
            ${hasProgress ? `<button class="btn btn-continue" id="continueReadingBtn">📖 Continue</button>` : ""}
            <button class="btn btn-secondary" id="addToListBtn">📋 Add to List</button>
          </div>
        </div>
      </div>
    `;

    // Favorites toggle
    $("addFavBtn").onclick = async () => {
      try {
        const res = await api("/api/favorites/toggle", {
          method: "POST",
          body: JSON.stringify({ mangaId: result.id, sourceId: state.currentSourceId, manga: result })
        });
        $("addFavBtn").textContent = res.isFavorite ? "❤️ Remove from Library" : "⭐ Add to Library";
        state.favorites = res.favorites;
        showToast(res.isFavorite ? "Added to Library" : "Removed from Library", result.title, res.isFavorite ? "success" : "info");
        renderLibrary();
        await updateStats();
        await checkAndUnlockAchievements();
      } catch (e) { showToast("Error", e.message, "error"); }
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

    // Add to custom list
    $("addToListBtn").onclick = () => showAddToListModal(result);

    // Render reading status
    renderReadingStatusSection(result.id, state.currentSourceId);
    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

// ============================================================================
// ADD TO LIST MODAL
// ============================================================================

function showAddToListModal(manga) {
  if (state.customLists.length === 0) {
    showToast("No lists yet", "Create a list first from My Lists.", "info");
    return;
  }
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>📋 Add to List</h2>
        <button class="btn secondary" id="closeAddToList">✕</button>
      </div>
      <div class="settings-body">
        ${state.customLists.map(l => `
          <button class="btn btn-secondary" style="width:100%;margin-bottom:0.5rem;text-align:left" data-list-id="${escapeHtml(l.id)}">
            ${escapeHtml(l.name)} <span style="color:var(--text-secondary);font-size:0.8rem">(${l.mangaItems.length} manga)</span>
          </button>`).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $("closeAddToList").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelectorAll("[data-list-id]").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/lists/${btn.dataset.listId}/manga`, {
          method: "POST",
          body: JSON.stringify({ mangaData: manga })
        });
        state.customLists = (await api("/api/lists")).lists;
        showToast("Added to list!", manga.title, "success");
        modal.remove();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });
}

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
    let displayChapters = state.allChapters;
    if (state.settings.skipReadChapters) {
      displayChapters = state.allChapters.filter(ch => !isChapterRead(state.currentManga.id, ch.id));
    }
    if (!displayChapters.length) {
      chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "All chapters read" : "No chapters found"}</div>`;
      return;
    }
    chapDiv.innerHTML = `
      <div class="chapters-header">
        <strong>${displayChapters.length} Chapter${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Unread" : "Available"}</strong>
      </div>
      <div class="chapters-list">
        ${displayChapters.map((ch, i) => {
          const isRead    = isChapterRead(state.currentManga.id, ch.id);
          const realIndex = state.allChapters.findIndex(c => c.id === ch.id);
          return `
            <div class="chapter-item ${isRead ? 'chapter-read' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
              <div class="chapter-info">
                <div class="chapter-name">${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</div>
                ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</div>` : ""}
              </div>
              <div class="chapter-action">
                ${isRead ? `<span class="read-badge">✓</span>` : ""}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>`;
        }).join("")}
      </div>`;

    chapDiv.querySelectorAll("[data-chapter-id]").forEach(el => {
      el.onclick = () => loadChapter(
        el.dataset.chapterId,
        el.dataset.chapterName,
        parseInt(el.dataset.chapterIndex)
      );
    });

  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
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

    const maxIndex = Math.max((result.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);
    state.zoomLevel = 1.0;

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
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex + 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex + 1; i < state.allChapters.length; i++) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex + 1;
}

function getPrevChapterIndex(currentIndex) {
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex - 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex - 1;
}

async function goToNextChapter() {
  const next = getNextChapterIndex(state.currentChapterIndex);
  if (next >= state.allChapters.length) { showToast("Last chapter reached", "", "info"); return; }
  await recordReadingSession();
  const ch = state.allChapters[next];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || next + 1}`, next);
}

async function goToPrevChapter() {
  const prev = getPrevChapterIndex(state.currentChapterIndex);
  if (prev < 0) { showToast("First chapter reached", "", "info"); return; }
  await recordReadingSession();
  const ch = state.allChapters[prev];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || prev + 1}`, prev);
}

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

function showReader() {
  $("reader").classList.remove("hidden");
  const chapterName = state.currentChapter?.name || "Chapter";
  $("readerTitle").textContent = `${state.currentManga?.title || ""} — ${chapterName}`;
  updateZoomUI();
}

async function hideReader() {
  stopAutoScroll();
  await recordReadingSession();
  $("reader").classList.add("hidden");
}

// ============================================================================
// AUTOSCROLL
// ============================================================================

let _autoScrollRAF = null;
const AUTOSCROLL_SPEEDS = [0.5, 1.5, 3.0, 5.0, 8.0]; // px per animation frame

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
  const pages   = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const idx     = state.currentPageIndex;
  const mode    = state.settings.readingMode;

  // Reset zoom on new chapter
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : "";

  if (mode === "webtoon") {
    pageWrap.className = "reader-content reading-mode-webtoon";
    const validPages = pages.filter(p => p.img);
    pageWrap.innerHTML = `
      <div class="page-zoom-wrap webtoon-wrap" ${zoomStyle}>
        ${validPages.map((p, i) => `<img src="${escapeHtml(p.img)}" alt="Page ${i + 1}" class="webtoon-page" loading="lazy">`).join("")}
      </div>`;
    $("pageCounter").textContent = `Webtoon Mode — ${validPages.length} pages`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);
  } else {
    pageWrap.className = "reader-content";
    if (idx < 0 || idx >= pages.length) return;
    const page = pages[idx];
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    pageWrap.innerHTML = page.img
      ? `<div class="page-zoom-wrap" ${zoomStyle}><img src="${escapeHtml(page.img)}" alt="Page ${idx + 1}" class="${imgClass}"></div>`
      : `<div class="muted">Page not available</div>`;

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  }
}

function applyZoom(delta) {
  state.zoomLevel = Math.min(3.0, Math.max(0.5, Math.round((state.zoomLevel + delta) * 10) / 10));
  updateZoomUI();
  renderPage();
}

function updateZoomUI() {
  const el = $("zoomLevel");
  if (el) el.textContent = `${Math.round(state.zoomLevel * 100)}%`;
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
        <h2>⚙️ Settings</h2>
        <button class="btn secondary" id="closeSettings">✕</button>
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
  $("clearReadBtn").onclick = () => {
    if (confirm("Clear all reading history?")) {
      state.readChapters.clear();
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
      showToast("Reading history cleared", "", "info");
    }
  };
}

// ============================================================================
// CUSTOM LISTS VIEW
// ============================================================================

async function refreshLists() {
  try {
    const data = await api("/api/lists");
    state.customLists = data.lists || [];
  } catch (e) { /* non-fatal */ }
}

function renderListsView() {
  const grid = $("listsGrid");
  if (!grid) return;
  if (!state.customLists.length) {
    grid.innerHTML = `<div class="muted">No lists yet. Create one with the button above!</div>`;
    return;
  }
  grid.innerHTML = state.customLists.map(l => `
    <div class="list-card" data-list-id="${escapeHtml(l.id)}">
      <div class="list-card-actions">
        <button class="btn-icon btn-icon-edit" data-action="edit" title="Edit">✏️</button>
        <button class="btn-icon btn-icon-delete" data-action="delete" title="Delete">🗑️</button>
      </div>
      <div class="list-card-title">${escapeHtml(l.name)}</div>
      <div class="list-card-desc">${escapeHtml(l.description || "No description")}</div>
      <div class="list-card-meta">
        <span class="list-card-count">${l.mangaItems.length} manga</span>
        <span>${new Date(l.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".list-card").forEach(card => {
    const listId = card.dataset.listId;
    card.onclick = (e) => {
      if (e.target.closest("[data-action]")) return; // handled below
      renderListDetail(listId);
    };
    card.querySelector("[data-action='edit']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showCreateListModal(state.customLists.find(l => l.id === listId));
    });
    card.querySelector("[data-action='delete']")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete list "${state.customLists.find(l => l.id === listId)?.name}"?`)) return;
      try {
        await api(`/api/lists/${listId}`, { method: "DELETE" });
        await refreshLists();
        renderListsView();
        showToast("List deleted", "", "info");
      } catch (err) { showToast("Error", err.message, "error"); }
    });
  });
}

function renderListDetail(listId) {
  const list = state.customLists.find(l => l.id === listId);
  if (!list) return;

  setView("list-detail");
  const content = $("listDetailContent");
  content.innerHTML = `
    <div class="list-detail-header">
      <div class="list-detail-info">
        <h2>${escapeHtml(list.name)}</h2>
        <p>${escapeHtml(list.description || "No description")}</p>
      </div>
      <div class="manga-actions">
        <span class="library-stats">${list.mangaItems.length} manga</span>
      </div>
    </div>
    <div class="results-grid" id="listDetailGrid">
      ${list.mangaItems.length === 0
        ? `<div class="muted">This list is empty. Add manga from their detail pages.</div>`
        : list.mangaItems.map(m => `
          <div class="manga-card" data-manga-id="${escapeHtml(m.id)}" data-source-id="${escapeHtml(m.sourceId || state.currentSourceId || 'mangadex')}">
            <div class="manga-card-cover">
              ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy">` : '<div class="no-cover">?</div>'}
              <div style="position:absolute;top:4px;right:4px">
                <button class="btn-icon btn-icon-delete" data-remove-id="${escapeHtml(m.id)}" style="opacity:0.8" title="Remove from list">✕</button>
              </div>
            </div>
            <div class="manga-card-info">
              <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
              <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
            </div>
          </div>`).join("")}
    </div>
  `;

  const grid = $("listDetailGrid");
  if (grid) {
    grid.querySelectorAll("[data-manga-id]").forEach(el => {
      const mangaId  = el.dataset.mangaId;
      const sourceId = el.dataset.sourceId;
      el.onclick = (e) => {
        if (e.target.closest("[data-remove-id]")) return;
        state.currentSourceId = sourceId || state.currentSourceId;
        loadMangaDetails(mangaId);
      };
      el.querySelector("[data-remove-id]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await api(`/api/lists/${listId}/manga/${mangaId}`, { method: "DELETE" });
          await refreshLists();
          renderListDetail(listId);
          showToast("Removed from list", "", "info");
        } catch (err) { showToast("Error", err.message, "error"); }
      });
    });
  }
}

function showCreateListModal(existingList = null) {
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>${existingList ? "Edit List" : "Create New List"}</h2>
        <button class="btn secondary" id="closeListModal">✕</button>
      </div>
      <div class="settings-body">
        <div class="setting-group">
          <label>List Name *</label>
          <input type="text" class="input" id="listNameInput" value="${escapeHtml(existingList?.name || "")}" maxlength="100" placeholder="My Favorites...">
        </div>
        <div class="setting-group">
          <label>Description</label>
          <textarea class="review-textarea" id="listDescInput" maxlength="500" placeholder="Optional description...">${escapeHtml(existingList?.description || "")}</textarea>
        </div>
        <button class="btn" id="saveListBtn">${existingList ? "Save Changes" : "Create List"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $("closeListModal").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  $("saveListBtn").onclick = async () => {
    const name = $("listNameInput").value.trim();
    const desc = $("listDescInput").value.trim();
    if (!name) { showToast("Name is required", "", "error"); return; }
    try {
      if (existingList) {
        await api(`/api/lists/${existingList.id}`, { method: "PUT", body: JSON.stringify({ name, description: desc }) });
        showToast("List updated", name, "success");
      } else {
        await api("/api/lists", { method: "POST", body: JSON.stringify({ name, description: desc }) });
        showToast("List created!", name, "success");
      }
      await refreshLists();
      renderListsView();
      modal.remove();
      await checkAndUnlockAchievements();
    } catch (e) { showToast("Error", e.message, "error"); }
  };
}

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
    el("anaChapters", a.totalChaptersRead || 0);
    el("anaTime",     formatTime(a.totalTimeSpent || 0));
    el("anaStreak",   a.dailyStreak || 0);
    el("anaLibrary",  data.totalFavorites || 0);

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

    // Achievements
    await renderAchievementsGrid();

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
    const [anaData, achievData] = await Promise.all([
      api("/api/analytics"),
      api("/api/achievements")
    ]);

    const earned = new Set(achievData.achievements || []);
    const a = anaData.analytics || {};
    const stats = {
      totalChaptersRead: a.totalChaptersRead || state.readChapters.size,
      totalTimeSpent:    a.totalTimeSpent || 0,
      totalFavorites:    (anaData.totalFavorites || 0),
      completedCount:    (anaData.statusDistribution?.completed || 0),
      totalLists:        (anaData.totalLists || 0),
    };

    for (const ach of ACHIEVEMENTS) {
      if (!earned.has(ach.id) && ach.check(stats)) {
        const result = await api("/api/achievements/unlock", {
          method: "POST",
          body: JSON.stringify({ achievementId: ach.id })
        });
        if (result.isNew) {
          showToast(`Achievement Unlocked! ${ach.icon}`, `${ach.label}: ${ach.desc}`, "success");
        }
        earned.add(ach.id);
      }
    }
    state.earnedAchievements = earned;
  } catch (e) { /* non-fatal */ }
}

async function renderAchievementsGrid() {
  const grid = $("achievementsGrid");
  if (!grid) return;
  try {
    const data = await api("/api/achievements");
    const earned = new Set(data.achievements || []);
    state.earnedAchievements = earned;

    const total = ACHIEVEMENTS.length;
    const count = earned.size;
    const countEl = $("achievementCount");
    if (countEl) countEl.textContent = `${count}/${total}`;

    grid.innerHTML = ACHIEVEMENTS.map(a => `
      <div class="achievement-item ${earned.has(a.id) ? 'earned' : 'locked'}">
        <div class="achievement-emoji">${a.icon}</div>
        <div class="achievement-info">
          <h4>${escapeHtml(a.label)}</h4>
          <p>${escapeHtml(a.desc)}</p>
        </div>
      </div>`).join("");
  } catch (e) {
    grid.innerHTML = `<div class="muted">Could not load achievements.</div>`;
  }
}

// ============================================================================
// GENRE NAVIGATION
// ============================================================================

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

async function advancedSearch() {
  const query   = $("advancedSearchInput").value.trim();
  const orderBy = $("advancedOrderBy").value;

  if (!state.currentSourceId) {
    $("advancedSearchStatus").textContent = "Select a source first.";
    return;
  }

  $("advancedSearchStatus").textContent = "Searching...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({
        query: query || "*",
        page: 1,
        orderBy,
        statuses: Array.from(state.advancedFilters.statuses),
        tags:     Array.from(state.advancedFilters.tags)
      })
    });

    let results = result.results || [];
    if (state.advancedFilters.statuses.size > 0) {
      results = results.filter(m => state.advancedFilters.statuses.has(m.status?.toLowerCase()));
    }
    if (state.advancedFilters.tags.size > 0) {
      results = results.filter(m => {
        const mt = (m.genres || []).map(g => g.toLowerCase());
        return Array.from(state.advancedFilters.tags).some(t => mt.some(g => g.includes(t.toLowerCase())));
      });
    }

    const resultsDiv = $("advancedResults");
    if (!results.length) {
      resultsDiv.innerHTML = `<div class="muted">No results found</div>`;
      $("advancedSearchStatus").textContent = "0 result(s) found";
      return;
    }
    renderMangaGrid(resultsDiv, results);
    $("advancedSearchStatus").textContent = `${results.length} result(s) found`;
  } catch (e) {
    $("advancedSearchStatus").textContent = `Error: ${e.message}`;
  }
}

async function randomManga() {
  if (!state.currentSourceId) { alert("Select a source first."); return; }
  $("advancedSearchStatus").textContent = "Finding random manga...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "random" })
    });
    const results = result.results || [];
    if (results.length > 0) {
      await loadMangaDetails(results[Math.floor(Math.random() * results.length)].id);
    } else {
      $("advancedSearchStatus").textContent = "No manga found";
    }
  } catch (e) {
    $("advancedSearchStatus").textContent = `Error: ${e.message}`;
  }
}

function initAdvancedFilters() {
  document.querySelectorAll(".advanced-status-check").forEach(check => {
    check.onchange = (e) => {
      if (e.target.checked) state.advancedFilters.statuses.add(e.target.value);
      else                   state.advancedFilters.statuses.delete(e.target.value);
    };
  });
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(chip => {
    chip.onclick = () => {
      const tag = chip.dataset.tag;
      if (state.advancedFilters.tags.has(tag)) {
        state.advancedFilters.tags.delete(tag);
        chip.classList.remove("active");
      } else {
        state.advancedFilters.tags.add(tag);
        chip.classList.add("active");
      }
    };
  });
  const ob = $("advancedOrderBy");
  if (ob) ob.onchange = (e) => { state.advancedFilters.orderBy = e.target.value; };
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

function setView(view) {
  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "lists", "list-detail", "analytics"];
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
  } else if (view === "lists") {
    renderListsView();
  } else if (view === "analytics") {
    renderAnalyticsView();
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
  if (backBtn) backBtn.onclick = () => setView(state.previousView || "discover");

  const backToListsBtn = $("backToListsBtn");
  if (backToListsBtn) backToListsBtn.onclick = () => setView("lists");

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

  // Reader controls
  const closeReader = $("closeReader");
  const prevPage    = $("prevPage");
  const nextPage    = $("nextPage");

  if (closeReader) closeReader.onclick = () => hideReader();

  if (prevPage) prevPage.onclick = () => {
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      state.currentPageIndex += state.settings.readingMode === "rtl" ? 1 : -1;
      renderPage();
    }
  };

  if (nextPage) nextPage.onclick = () => {
    if (state.currentPageIndex === (state.currentChapter?.pages?.length ?? 1) - 1) {
      goToNextChapter();
    } else {
      state.currentPageIndex += state.settings.readingMode === "rtl" ? -1 : 1;
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
    const isRtl = state.settings.readingMode === "rtl";
    if (e.key === "ArrowRight" || e.key === "d") {
      if (state.settings.readingMode !== "webtoon") {
        if (isRtl) { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
        else        { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
      }
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      if (state.settings.readingMode !== "webtoon") {
        if (isRtl) { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
        else        { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
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
  if (advBtn)   advBtn.onclick   = advancedSearch;
  if (advInput) advInput.onkeypress = (e) => { if (e.key === "Enter") advancedSearch(); };
  if (randBtn)  randBtn.onclick  = randomManga;

  // Create list button
  const createListBtn = $("createListBtn");
  if (createListBtn) createListBtn.onclick = () => showCreateListModal();

  // Library status filter
  const libFilter = $("libraryStatusFilter");
  if (libFilter) libFilter.onchange = renderLibrary;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

(async function main() {
  initTheme();
  loadSettings();
  await refreshState();
  bindUI();
  // Check achievements on startup based on existing data
  await checkAndUnlockAchievements();
})();
