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
    dbg.error(dbg.ERR_STATE, 'Failed to load state', e);
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
      state._advAcc = null; // invalidate filter accumulator on source change
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

