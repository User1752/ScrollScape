// ============================================================================
// ADVANCED SEARCH
// ============================================================================

const ADV_PAGE_SIZE = 50;
const ADV_MAX_API_PAGES = 20; // safety limit per user-page

// Capability matrix based on practical API smoke tests per source.
// Only filters that are known to work are shown/enabled in the UI.
const ADV_SOURCE_CAPABILITIES = {
  default: {
    orderBy: true,
    publicationStatus: true,
    contentRating: false,
    format: true,
    genres: true,
  },
  mangadex: {
    orderBy: true,
    publicationStatus: true,
    contentRating: true,
    format: true,
    genres: true,
  },
  mangapill: {
    orderBy: true,
    publicationStatus: true,
    contentRating: false,
    format: true,
    genres: true,
  },
  mangakatana: {
    orderBy: true,
    publicationStatus: true,
    contentRating: false,
    format: true,
    genres: true,
  },
  allmanga: {
    orderBy: true,
    publicationStatus: true,
    contentRating: true,
    format: true,
    genres: true,
  },
};

function getAdvancedSourceCapabilities(sourceId) {
  return { ...ADV_SOURCE_CAPABILITIES.default, ...(ADV_SOURCE_CAPABILITIES[sourceId] || {}) };
}

function updateAdvancedSearchFilterVisibility(sourceId = state.currentSourceId) {
  const caps = getAdvancedSourceCapabilities(sourceId);

  const toggleGroupBySelectId = (selectId, enabled) => {
    const sel = $(selectId);
    const group = sel?.closest('.filter-group');
    if (group) group.style.display = enabled ? '' : 'none';
    if (!enabled && sel) {
      sel.value = (selectId === 'advancedOrderBy') ? 'relevance' : '';
    }
  };

  toggleGroupBySelectId('advancedOrderBy', caps.orderBy);
  toggleGroupBySelectId('advancedFormat', caps.format);
  toggleGroupBySelectId('advancedPublicationStatus', caps.publicationStatus);

  const contentRatingGroup = $('advancedContentRatingGroup');
  if (contentRatingGroup) contentRatingGroup.style.display = caps.contentRating ? '' : 'none';
  const contentRatingSel = $('advancedContentRating');
  if (!caps.contentRating && contentRatingSel) contentRatingSel.value = '';

  const genreGroup = $('genreFilterGroup');
  if (genreGroup) genreGroup.style.display = caps.genres ? '' : 'none';
  if (!caps.genres) {
    document.querySelectorAll('#genreGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
  }

  // Source capability changes can affect pagination/fill-up cache validity.
  state._advAcc = null;

  // Keep NSFW hiding rules on top of capability visibility.
  applyAdvancedSearchNsfwVisibility();
}

function applyAdvancedSearchNsfwVisibility() {
  const hideNsfw = state.settings.hideNsfw === true;
  let changed = false;

  const contentRatingGroup = $("advancedContentRatingGroup");
  if (contentRatingGroup) {
    const caps = getAdvancedSourceCapabilities(state.currentSourceId);
    contentRatingGroup.style.display = (hideNsfw || !caps.contentRating) ? "none" : "";
  }

  const contentRatingSel = $("advancedContentRating");
  if (hideNsfw && contentRatingSel && contentRatingSel.value) {
    contentRatingSel.value = "";
    changed = true;
  }

  document.querySelectorAll('#genreGrid .genre-check[data-nsfw="1"]').forEach(label => {
    label.style.display = hideNsfw ? "none" : "";
    const cb = label.querySelector('input[type="checkbox"]');
    if (hideNsfw && cb?.checked) {
      cb.checked = false;
      changed = true;
    }
  });

  return changed;
}

function _normalizeFormat(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return '';
  if (raw.includes('one') && raw.includes('shot')) return 'oneshot';
  if (raw.includes('manhwa') || raw.includes('webtoon')) return 'manhwa';
  if (raw.includes('manhua')) return 'manhua';
  if (raw.includes('doujin')) return 'doujinshi';
  if (raw.includes('manga')) return 'manga';
  return raw;
}

function _inferFormat(manga) {
  const fromField = _normalizeFormat(manga?.format);
  if (fromField) return fromField;
  const genres = Array.isArray(manga?.genres) ? manga.genres : [];
  for (const g of genres) {
    const n = _normalizeFormat(g);
    if (['manga', 'manhwa', 'manhua', 'doujinshi', 'oneshot'].includes(n)) return n;
  }
  return '';
}

function _inferContentRating(manga) {
  const explicit = String(manga?.contentRating || '').toLowerCase();
  if (['safe', 'suggestive', 'erotica', 'pornographic'].includes(explicit)) return explicit;

  const tags = new Set((Array.isArray(manga?.genres) ? manga.genres : []).map(g => String(g).toLowerCase()));
  if (tags.has('hentai') || tags.has('smut') || tags.has('mature') || tags.has('adult') || tags.has('ecchi')) return 'erotica';
  if (tags.has('suggestive')) return 'suggestive';
  return 'safe';
}

function _normalizeStatus(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('ongoing') || s.includes('publishing') || s.includes('releasing')) return 'ongoing';
  if (s.includes('complet') || s.includes('finished')) return 'completed';
  if (s.includes('hiatus')) return 'hiatus';
  if (s.includes('cancel')) return 'cancelled';
  return s;
}

/**
 * Apply client-side filters to a batch of results.
 * Returns only items that pass all active filter criteria.
 */
function _applyAdvFilters(results, query, selectedGenres, publicationStatus, contentRating, format) {
  let out = results;
  const hideNsfw = state.settings.hideNsfw === true;

  if (hideNsfw) {
    out = out.filter(m => !isNsfwManga(m));
  }

  if (query) {
    const q = query.toLowerCase();
    out = out.filter(m => (m.title || "").toLowerCase().includes(q));
  }
  if (selectedGenres.length > 0) {
    const wanted = new Set(selectedGenres.map(g => String(g).toLowerCase()));
    out = out.filter(m => {
      const genres = Array.isArray(m.genres) ? m.genres.map(g => String(g).toLowerCase()) : [];
      return genres.some(g => wanted.has(g));
    });
  }
  if (publicationStatus) {
    const targetStatus = _normalizeStatus(publicationStatus);
    out = out.filter(m => _normalizeStatus(m.status) === targetStatus);
  }
  if (contentRating) {
    out = out.filter(m => _inferContentRating(m) === contentRating.toLowerCase());
  }
  if (format) {
    const target = _normalizeFormat(format);
    out = out.filter(m => _inferFormat(m) === target);
  }
  return out;
}

async function advancedSearch(page = 1) {
  updateAdvancedSearchFilterVisibility(state.currentSourceId);

  const caps = getAdvancedSourceCapabilities(state.currentSourceId);
  const query   = $("advancedSearchInput").value.trim();
  const orderBy = caps.orderBy ? $("advancedOrderBy").value : "relevance";
  const publicationStatus = caps.publicationStatus ? ($("advancedPublicationStatus")?.value || "") : "";
  const contentRating = (caps.contentRating && !state.settings.hideNsfw) ? ($("advancedContentRating")?.value || "") : "";
  const format = caps.format ? ($("advancedFormat")?.value || "") : "";
  let selectedGenres = caps.genres
    ? Array.from(document.querySelectorAll('#genreGrid input[type="checkbox"]:checked')).map(cb => cb.value)
    : [];
  if (state.settings.hideNsfw) {
    selectedGenres = selectedGenres.filter(g => !isNsfwTag(g));
  }

  // "local" is not a plugin source — fall back to the dropdown value or first installed source
  if (!state.currentSourceId || !state.installedSources[state.currentSourceId]) {
    const sel = $("advancedSourceSelect");
    const installed = Object.keys(state.installedSources);
    const fallback = (sel && state.installedSources[sel.value]) ? sel.value : installed[0];
    if (!fallback) {
      $("advancedSearchStatus").textContent = "Select a source first.";
      return;
    }
    state.currentSourceId = fallback;
    if (sel) sel.value = fallback;
    const mainSel = $("sourceSelect");
    if (mainSel) mainSel.value = fallback;
  }

  state.advSearchPage = page;
  $("advancedSearchStatus").textContent = "Searching...";

  // Determine if any client-side filter is active
  const needsClientFilter = !!(publicationStatus || contentRating || format || selectedGenres.length > 0);

  // ── Fast path: no client filtering, use native API pagination ────────────
  if (!needsClientFilter) {
    state._advAcc = null; // invalidate accumulator cache
    try {
      let result;
      if (selectedGenres.length > 0) {
        result = await api(`/api/source/${state.currentSourceId}/byGenres`, {
          method: "POST",
          body: JSON.stringify({ genres: selectedGenres, page, orderBy, publicationStatus, contentRating, format })
        });
      } else {
        result = await api(`/api/source/${state.currentSourceId}/search`, {
          method: "POST",
          body: JSON.stringify({ query: query || "", page, orderBy, publicationStatus, contentRating, format })
        });
      }
      const results = await _filterMangaWithoutChapters(result.results || [], state.currentSourceId);
      const hasNextPage = result.hasNextPage || false;
      state.advSearchHasNextPage = hasNextPage;
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
    return;
  }

  // ── Fill-up path: accumulate filtered results across API pages ────────────
  // Cache key: invalidate accumulator when source or any filter changes.
  const filterKey = [state.currentSourceId, query, selectedGenres.join(','), publicationStatus, contentRating, format, orderBy].join('|');

  // Reset accumulator when filters change or navigating back to page 1
  if (!state._advAcc || state._advAcc.filterKey !== filterKey || page === 1) {
    state._advAcc = { results: [], apiPage: 0, hasMore: true, filterKey };
  }

  const acc = state._advAcc;
  const target = page * ADV_PAGE_SIZE;
  let fetchError = null;

  // Keep fetching API pages until we have enough filtered results (or run out)
  while (acc.results.length < target && acc.hasMore && acc.apiPage < ADV_MAX_API_PAGES) {
    acc.apiPage++;
    try {
      let result;
      if (selectedGenres.length > 0) {
        result = await api(`/api/source/${state.currentSourceId}/byGenres`, {
          method: "POST",
          body: JSON.stringify({ genres: selectedGenres, page: acc.apiPage, orderBy, publicationStatus, contentRating, format })
        });
        acc.hasMore = result.hasNextPage || false;
      } else {
        result = await api(`/api/source/${state.currentSourceId}/search`, {
          method: "POST",
          body: JSON.stringify({ query: query || "", page: acc.apiPage, orderBy, publicationStatus, contentRating, format })
        });
        acc.hasMore = result.hasNextPage || false;
      }
      const filteredBatch = _applyAdvFilters(result.results || [], query, selectedGenres, publicationStatus, contentRating, format);
      const batch = await _filterMangaWithoutChapters(filteredBatch, state.currentSourceId);
      acc.results.push(...batch);
    } catch (e) {
      fetchError = e;
      break;
    }
  }

  if (fetchError && acc.results.length === 0) {
    $("advancedSearchStatus").textContent = `Error: ${fetchError.message}`;
    renderPagination("advancedSearchPagination", page, false, "advSearchGoToPage");
    return;
  }

  const pageResults = acc.results.slice((page - 1) * ADV_PAGE_SIZE, page * ADV_PAGE_SIZE);
  const hasNextPage = acc.hasMore || acc.results.length > page * ADV_PAGE_SIZE;
  state.advSearchHasNextPage = hasNextPage;

  const resultsDiv = $("advancedResults");
  if (!pageResults.length) {
    resultsDiv.innerHTML = `<div class="muted">No results found</div>`;
    $("advancedSearchStatus").textContent = "0 result(s) found";
    renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
    return;
  }
  renderMangaGrid(resultsDiv, pageResults);
  $("advancedSearchStatus").textContent = `${pageResults.length} result(s) found — Page ${page}`;
  renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
}

async function randomManga(options = {}) {
  const sourceIds = Object.keys(state.installedSources).filter(id => id !== 'local');
  const statusEl = $('advancedSearchStatus');
  const mode = options.mode || 'mixed'; // mixed | library | sources
  const selectedSourceIds = (options.sourceIds || []).filter(id => sourceIds.includes(id));
  const poolSourceIds = selectedSourceIds.length ? selectedSourceIds : sourceIds;

  // Build a combined pool: library + online results from selected sources
  let pool = [];

  // Add library when enabled in mode
  if (mode !== 'sources') {
    for (const m of (state.favorites || [])) {
      if (!m.sourceId || m.sourceId === 'local') continue;
      if (mode === 'library' || poolSourceIds.includes(m.sourceId)) {
        pool.push({ id: m.id, sourceId: m.sourceId });
      }
    }
  }

  // Add online results from a random selected source on a random page
  if (mode !== 'library' && poolSourceIds.length > 0) {
    const src = poolSourceIds[Math.floor(Math.random() * poolSourceIds.length)];
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

function closeRandomPickerDrawer() {
  document.getElementById('randomPickerBackdrop')?.remove();
  document.getElementById('randomPickerDrawer')?.remove();
}

function openRandomPickerDrawer() {
  closeRandomPickerDrawer();

  const sourceIds = Object.keys(state.installedSources).filter(id => id !== 'local');
  const sourceItems = sourceIds.map(id => {
    const label = state.installedSources[id]?.name || id;
    return `
      <label class="random-picker-source-item">
        <input type="checkbox" class="random-picker-source" value="${escapeHtml(id)}" checked>
        <span>${escapeHtml(label)}</span>
      </label>`;
  }).join('');

  const backdrop = document.createElement('div');
  backdrop.id = 'randomPickerBackdrop';
  backdrop.className = 'random-picker-backdrop';

  const drawer = document.createElement('div');
  drawer.id = 'randomPickerDrawer';
  drawer.className = 'random-picker-drawer';
  drawer.innerHTML = `
    <div class="random-picker-head">
      <h3>Random Manga</h3>
      <button class="btn secondary" id="randomPickerClose">\u2715</button>
    </div>
    <div class="random-picker-body">
      <div class="random-picker-mode-group">
        <label><input type="radio" name="randomMode" value="mixed" checked> Library + Sources</label>
        <label><input type="radio" name="randomMode" value="sources"> Sources only</label>
        <label><input type="radio" name="randomMode" value="library"> Library only</label>
      </div>
      <div class="random-picker-subtitle">Sources</div>
      <div class="random-picker-source-list">${sourceItems || '<div class="muted">No online sources installed.</div>'}</div>
      <div class="random-picker-actions">
        <button class="btn primary" id="randomPickerGo">Pick Random</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  backdrop.onclick = closeRandomPickerDrawer;
  drawer.querySelector('#randomPickerClose').onclick = closeRandomPickerDrawer;

  drawer.querySelector('#randomPickerGo').onclick = async () => {
    const mode = drawer.querySelector('input[name="randomMode"]:checked')?.value || 'mixed';
    const selected = [...drawer.querySelectorAll('.random-picker-source:checked')].map(el => el.value);
    closeRandomPickerDrawer();
    await randomManga({ mode, sourceIds: selected });
  };
}

function initAdvancedFilters() {
  updateAdvancedSearchFilterVisibility(state.currentSourceId);

  const advSourceSel = $("advancedSourceSelect");
  if (advSourceSel) {
    advSourceSel.addEventListener("change", () => {
      updateAdvancedSearchFilterVisibility(advSourceSel.value);
    });
  }

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

  // Genre section collapse toggle — persisted in localStorage
  const genreToggle = $("genreFilterToggle");
  const genreGroup  = $("genreFilterGroup");
  if (genreToggle && genreGroup) {
    // Restore saved state
    if (localStorage.getItem("genreFilterCollapsed") === "1") {
      genreGroup.classList.add("collapsed");
    }
    genreToggle.onclick = (e) => {
      if (e.target.closest('#clearGenresBtn')) return; // don't collapse when clearing
      genreGroup.classList.toggle("collapsed");
      localStorage.setItem("genreFilterCollapsed", genreGroup.classList.contains("collapsed") ? "1" : "0");
    };
  }
}

