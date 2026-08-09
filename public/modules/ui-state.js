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
    state.coverOverrides = libData.coverOverrides || {};
    state.mangaTags      = libData.mangaTags || {};
    state.readingStatus = statusData.readingStatus || {};

    // Load custom lists (categories) and AniList sync metadata
    try {
      const listsData = await api('/api/lists');
      state.customLists = listsData.lists || [];
    } catch (_) { state.customLists = []; }

    try {
      const syncMeta = await api('/api/anilist/sync-meta');
      state.anilistSync = syncMeta;
    } catch (_) { state.anilistSync = null; }

    try {
      const localData = await api("/api/local/list");
      state.localManga = localData.localManga || [];
      // Generate covers for any PDF/EPUB manga that still has a raw-file cover
      generateMissingPDFCovers();
      generateMissingEpubCovers();
    } catch (_) { state.localManga = []; }

    try {
      const ratingsData = await api("/api/ratings");
      state.ratings = ratingsData.ratings || {};
    } catch (_) { state.ratings = {}; }

    renderSourceSelect();
    if (typeof syncProgressionWithServer === 'function') syncProgressionWithServer();
    if (typeof applyHomeSearchVisibility === 'function') applyHomeSearchVisibility();
    if (window._homeSeenManga) window._homeSeenManga.clear();
    if (typeof renderContinueReading === 'function') renderContinueReading();
    await Promise.all([
      loadPopularToday(),
      loadRecentlyAdded(),
      loadLatestUpdates()
    ]);
    await updateStats();
    renderLibrary();

    // Trigger recommendations if there's any reading history or library content
    if (state.favorites.length > 0 || state.history.length > 0) loadRecommendations();
  } catch (e) {
    dbg.error(dbg.ERR_STATE, 'Failed to load state', e);
  }
}

// Beta sources (meta.beta === true, from server/modules/repos/service.js's
// getState()) are hidden from every source-picking UI unless the user opts
// in via the "Show beta sources" toggle — there are many freshly-ported
// sources and not enough time to vet them all up front, so they stay
// invisible-by-default rather than surprising users with untested results.
// Manga a user already added from a beta source keep working regardless
// (lookups by a *known* sourceId are untouched) — this only filters the
// lists a user picks a *new* source from.
function getSelectableSources() {
  const all = Object.values(state.installedSources || {});
  return state.settings?.showBetaSources ? all : all.filter(s => !s.beta);
}
function getSelectableSourceIds() {
  return getSelectableSources().map(s => s.id);
}
window.getSelectableSources = getSelectableSources;
window.getSelectableSourceIds = getSelectableSourceIds;

function renderSourceSelect() {
  const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
  const installed = getSelectableSources();

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
    if (!state.currentSourceId || !installed.some(s => s.id === state.currentSourceId)) {
      state.currentSourceId = installed[0].id;
    }
    sel.value = state.currentSourceId;
    sel.onchange = () => { 
      state.currentSourceId = sel.value;
      state._advAcc = null; // invalidate filter accumulator on source change
      if (typeof updateAdvancedSearchFilterVisibility === 'function') {
        updateAdvancedSearchFilterVisibility(sel.value);
      }
      // Keep both selectors in sync
      for (const other of selectors) { if (other && other !== sel) other.value = sel.value; }
      if (state.currentView !== 'advanced-search') {
        // Reload homepage content when source changes
        if (window._homeSeenManga) window._homeSeenManga.clear();
        loadPopularToday();
        loadRecentlyAdded();
        loadLatestUpdates();
      }
      // In advanced-search: user changes source manually and clicks search themselves
    };
  }

  if (typeof updateAdvancedSearchFilterVisibility === 'function') {
    updateAdvancedSearchFilterVisibility(state.currentSourceId);
  }
}

