// ============================================================================
// SEARCH & MANGA DETAILS
// ============================================================================

let _liveSearchTimer = null;
const _chapterAnyTitleCache = new Map();

function _chapCacheKey(sourceId, mangaId) {
  return `${sourceId || ''}:${mangaId || ''}`;
}

function _limitMapSize(map, maxSize = 600) {
  if (!map || map.size <= maxSize) return;
  const firstKey = map.keys().next().value;
  if (firstKey !== undefined) map.delete(firstKey);
}

function _extractKnownChapterCount(manga) {
  const candidates = [manga?.chapterCount, manga?.chaptersCount, manga?.latestChapter, manga?.lastChapter, manga?.chapters];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(String(value).trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

async function _fetchChapterCount(sourceId, mangaId) {
  if (!sourceId || !mangaId) return 0;

  const key = _chapCacheKey(sourceId, mangaId);
  const cached = Number(state.chapterCountCache?.[key]);
  if (Number.isFinite(cached) && cached >= 0) return cached;

  try {
    const result = await api(`/api/source/${sourceId}/chapters`, {
      method: 'POST',
      body: JSON.stringify({ mangaId }),
    });
    const count = Array.isArray(result?.chapters) ? result.chapters.length : 0;
    state.chapterCountCache[key] = count;
    return count;
  } catch (_) {
    return 0;
  }
}

async function _findBestMangaIdByTitle(sourceId, title) {
  if (!sourceId || !title) return '';
  try {
    const result = await api(`/api/source/${sourceId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query: title, page: 1 }),
    });
    let best = null;
    for (const candidate of (result?.results || []).slice(0, 10)) {
      if (!candidate?.id) continue;
      const sim = _titleScore(title, candidate.title || '');
      if (sim < 0.7) continue;
      if (!best || sim > best.sim) best = { id: candidate.id, sim };
    }
    return best?.id || '';
  } catch (_) {
    return '';
  }
}

async function _hasAnySourceChapters(manga, preferredSourceId) {
  if (!manga?.id) return false;

  const knownCount = _extractKnownChapterCount(manga);
  if (Number.isFinite(knownCount) && knownCount > 0) return true;

  const currentCount = await _fetchChapterCount(preferredSourceId, manga.id);
  if (currentCount > 0) return true;

  const titleKey = _normalizeLookupTitle(manga.title || manga.id);
  if (titleKey && _chapterAnyTitleCache.has(titleKey)) return _chapterAnyTitleCache.get(titleKey) === true;

  const sourceIds = Object.keys(state.installedSources || {}).filter(sid => sid !== 'local' && sid !== preferredSourceId);
  for (const sid of sourceIds) {
    const matchId = await _findBestMangaIdByTitle(sid, manga.title || '');
    if (!matchId) continue;
    const count = await _fetchChapterCount(sid, matchId);
    if (count > 0) {
      if (titleKey) {
        _chapterAnyTitleCache.set(titleKey, true);
        _limitMapSize(_chapterAnyTitleCache);
      }
      return true;
    }
  }

  if (titleKey) {
    _chapterAnyTitleCache.set(titleKey, false);
    _limitMapSize(_chapterAnyTitleCache);
  }
  return false;
}

async function _filterMangaWithoutChapters(results, sourceId) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return [];

  const keep = new Array(list.length).fill(false);
  const workers = Math.min(4, list.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const idx = cursor++;
      const manga = list[idx];
      keep[idx] = await _hasAnySourceChapters(manga, sourceId);
    }
  };

  await Promise.all(Array.from({ length: workers }, worker));
  return list.filter((_, idx) => keep[idx]);
}

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
    const rawResults = result.results || [];
    const results = rawResults.filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
    const chapterFiltered = await _filterMangaWithoutChapters(results, state.currentSourceId);
    const hasNextPage = result.hasNextPage || false;
    state.searchHasNextPage = hasNextPage;
    if (!dropdown) return;
    if (!chapterFiltered.length) {
      dropdown.innerHTML = `<div class="muted" style="padding:1rem">No results found for "${escapeHtml(query)}"</div>`;
      $("searchStatus").textContent = "0 result(s) found";
      renderPagination("searchPagination", page, false, "searchGoToPage");
    } else {
      dropdown.innerHTML = chapterFiltered.map(m => mangaCardHTML(m)).join("");
      bindMangaCards(dropdown);
      $("searchStatus").textContent = `${chapterFiltered.length} result(s) found — Page ${page}`;
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
    const chapterFiltered = await _filterMangaWithoutChapters(results, sourceId);
    if (chapterFiltered.length === 0) {
      showToast("Not found", `"${title}" not found in ${state.installedSources[sourceId]?.name || sourceId}`, "info");
      return;
    }
    // Switch source globally and open first result
    state.currentSourceId = sourceId;
    const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
    selectors.forEach(s => { if (s) s.value = sourceId; });
    loadMangaDetails(chapterFiltered[0].id);
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

function _normalizeLookupTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _titleScore(a, b) {
  const aa = _normalizeLookupTitle(a);
  const bb = _normalizeLookupTitle(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.9;
  const sa = new Set(aa.split(' '));
  const sb = new Set(bb.split(' '));
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.max(sa.size || 1, sb.size || 1);
}

async function _resolveMangaByTitleAcrossSources(title, excludeSourceId) {
  const wanted = String(title || '').trim();
  if (!wanted) return null;

  const sourceIds = Object.keys(state.installedSources || {})
    .filter(sid => sid !== 'local' && sid !== excludeSourceId);

  let best = null;
  for (const sid of sourceIds) {
    try {
      const r = await api(`/api/source/${sid}/search`, {
        method: 'POST',
        body: JSON.stringify({ query: wanted, page: 1 }),
      });
      for (const c of (r?.results || []).slice(0, 8)) {
        if (!c?.id) continue;
        const sim = _titleScore(wanted, c.title || '');
        if (sim < 0.55) continue;
        if (!best || sim > best.sim) {
          best = { sourceId: sid, mangaId: c.id, title: c.title || wanted, sim };
        }
      }
    } catch (_) {
      // Ignore one failing source and continue trying the others.
    }
  }
  return best;
}

async function _resolveMangaInSourceByTitle(sourceId, title) {
  const wanted = String(title || '').trim();
  if (!sourceId || !wanted) return null;

  const r = await api(`/api/source/${sourceId}/search`, {
    method: 'POST',
    body: JSON.stringify({ query: wanted, page: 1 }),
  });

  let best = null;
  for (const c of (r?.results || []).slice(0, 10)) {
    if (!c?.id) continue;
    const sim = _titleScore(wanted, c.title || '');
    if (sim < 0.6) continue;
    if (!best || sim > best.sim) {
      best = {
        mangaId: c.id,
        title: c.title || wanted,
        cover: c.cover || '',
        sim,
      };
    }
  }
  return best;
}

function _getStoredMangaCover(mangaId, sourceId) {
  const overrideKey = `${String(mangaId)}:${String(sourceId || '')}`;
  return state.coverOverrides?.[overrideKey]
    || (state.favorites || []).find(m => String(m?.id) === String(mangaId) && String(m?.sourceId || '') === String(sourceId))?.cover
    || (state.history || []).find(m => String(m?.id) === String(mangaId) && String(m?.sourceId || '') === String(sourceId))?.cover
    || '';
}

function _coverPickerSourceIds(primarySourceId) {
  const sourceIds = Object.keys(state.installedSources || {}).filter(sid => sid !== 'local');
  const ordered = [];
  if (primarySourceId && sourceIds.includes(primarySourceId)) ordered.push(primarySourceId);
  for (const sid of sourceIds) {
    if (ordered.includes(sid)) continue;
    ordered.push(sid);
  }
  return ordered.slice(0, 4);
}

function _coverChoiceKey(choice) {
  return `${String(choice?.cover || '')}::${_normalizeLookupTitle(choice?.title || '')}::${String(choice?.sourceId || choice?.provider || '')}`;
}

function _applyCoverToCurrentDetailsView(mangaId, sourceId, coverUrl) {
  if (!coverUrl) return;
  if (String(state.currentManga?.id) !== String(mangaId) || String(state.currentSourceId || '') !== String(sourceId || '')) return;
  state.currentManga = { ...state.currentManga, cover: coverUrl };
  const coverImg = $("details")?.querySelector('.manga-cover img');
  if (coverImg) coverImg.src = coverUrl;
}

async function persistMangaCover(mangaId, sourceId, coverUrl) {
  const res = await api('/api/library/cover', {
    method: 'POST',
    body: JSON.stringify({ mangaId, sourceId, cover: coverUrl })
  });
  state.favorites = res.favorites || state.favorites;
  state.history = res.history || state.history;
  state.coverOverrides = res.coverOverrides || state.coverOverrides;
  state.readingStatus = res.readingStatus || state.readingStatus;
  renderLibrary();
  if (typeof renderHistoryView === 'function') renderHistoryView();
  _applyCoverToCurrentDetailsView(mangaId, sourceId, coverUrl);
  return res;
}

async function searchAniListCoverChoices(title, page = 1, perPage = 8) {
  const data = await anilistGQL(
    `query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          title { romaji english native }
          coverImage { extraLarge large medium }
        }
      }
    }`,
    { search: title, page, perPage }
  );
  return {
    items: (data?.data?.Page?.media || [])
      .map(item => ({
        id: item.id,
        title: item?.title?.english || item?.title?.romaji || item?.title?.native || title,
        cover: item?.coverImage?.extraLarge || item?.coverImage?.large || item?.coverImage?.medium || '',
        provider: 'AniList',
        sourceId: 'anilist',
      }))
      .filter(item => item.cover),
    hasNextPage: !!data?.data?.Page?.pageInfo?.hasNextPage,
  };
}

async function searchSourceCoverChoices(query, sourceId, page = 1) {
  const result = await api(`/api/source/${sourceId}/search`, {
    method: 'POST',
    body: JSON.stringify({ query, page })
  });
  return {
    items: (result?.results || [])
      .filter(item => item?.cover && !String(item.cover).endsWith('.pdf'))
      .map(item => ({
        id: item.id,
        title: item.title || query,
        cover: item.cover,
        provider: state.installedSources[sourceId]?.name || sourceId,
        sourceId,
      })),
    hasNextPage: !!result?.hasNextPage,
  };
}

async function searchCoverChoices(query, sourceId, page = 1, mode = 'sources') {
  const sourceIds = _coverPickerSourceIds(sourceId);
  const otherSourceIds = sourceIds.filter(sid => sid !== sourceId);

  if (mode === 'google') {
    const google = await searchGoogleCoverChoices(query, page, 14).catch(() => ({ items: [], hasNextPage: false }));
    return {
      items: google.items || [],
      hasNextPage: !!google.hasNextPage,
      sourceLabels: ['Google Images'],
    };
  }

  const jobs = [
    searchAniListCoverChoices(query, page, 8).catch(() => ({ items: [], hasNextPage: false })),
    ...otherSourceIds.map(sid => searchSourceCoverChoices(query, sid, page).catch(() => ({ items: [], hasNextPage: false }))),
  ];
  const results = await Promise.all(jobs);
  const deduped = [];
  const seen = new Set();
  for (const block of results) {
    for (const item of (block?.items || [])) {
      const key = _coverChoiceKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
  }
  return {
    items: deduped,
    hasNextPage: results.some(block => block?.hasNextPage),
    sourceLabels: ['AniList', ...otherSourceIds.map(sid => state.installedSources[sid]?.name || sid)],
  };
}

async function searchGoogleCoverChoices(query, page = 1, count = 14) {
  const start = Math.max(0, (page - 1) * count);
  const url = `/api/cover/google-images?q=${encodeURIComponent(query)}&start=${start}&count=${count}`;
  const result = await api(url);
  const items = Array.isArray(result?.items) ? result.items : [];
  return {
    items: items
      .filter(item => item && item.cover)
      .map(item => ({
        id: item.id,
        title: item.title || query,
        cover: item.cover,
        provider: item.provider || 'Google Images',
        sourceId: 'google-images',
      })),
    hasNextPage: !!result?.hasNextPage,
  };
}

function openMangaCoverPicker(manga, options = {}) {
  const mangaId = String(manga?.id || '');
  const sourceId = String(options.sourceId || manga?.sourceId || state.currentSourceId || '');
  const title = String(manga?.title || '').trim();
  const sourceCover = String(options.sourceCover || manga?._sourceCover || manga?.cover || '').trim();
  const currentCover = String(options.currentCover || manga?.cover || _getStoredMangaCover(mangaId, sourceId) || '').trim();

  if (!mangaId || !sourceId || !title) {
    showToast('Cover error', 'Missing manga data.', 'error');
    return;
  }

  document.getElementById('coverPickerModal')?.remove();
  document.documentElement.classList.remove('cover-picker-open');
  document.body.classList.remove('cover-picker-open');
  const modal = document.createElement('div');
  modal.id = 'coverPickerModal';
  modal.className = 'settings-modal';
  modal.innerHTML = `
    <div class="settings-content cover-picker-modal-content">
      <div class="settings-header">
        <h2>Choose Cover</h2>
        <button class="btn btn-secondary" id="coverPickerClose">Close</button>
      </div>
      <div class="cover-picker-body">
        <div class="cover-picker-column">
          <p class="cover-picker-label">Current cover</p>
          <div class="cover-picker-current">
            ${currentCover ? `<img src="${escapeHtml(currentCover)}" alt="${escapeHtml(title)}">` : `<div class="no-cover">?</div>`}
          </div>
          <div class="cover-picker-actions">
            ${sourceCover ? `<button class="btn btn-secondary" id="coverPickerUseSource">Use Source Cover</button>` : ''}
            <button class="btn btn-secondary" id="coverPickerSearchSources">Search other sources</button>
            <button class="btn btn-secondary" id="coverPickerGoogle">Search Google Images</button>
          </div>
        </div>
        <div class="cover-picker-column cover-picker-column-wide">
          <div class="cover-picker-search-bar">
            <input id="coverPickerSearchInput" class="input cover-picker-search-input" type="search" value="${escapeHtml(title)}" placeholder="Search covers...">
            <button class="btn" id="coverPickerSearchRun">Search</button>
          </div>
          <p class="cover-picker-label">Search results</p>
          <div class="cover-picker-search-meta muted" id="coverPickerSearchMeta"></div>
          <div class="cover-picker-grid muted" id="coverPickerSuggestions">Loading cover suggestions...</div>
          <div class="cover-picker-load-more-wrap">
            <button class="btn btn-secondary" id="coverPickerLoadMore">Load more</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.documentElement.classList.add('cover-picker-open');
  document.body.classList.add('cover-picker-open');

  const closePicker = () => {
    document.documentElement.classList.remove('cover-picker-open');
    document.body.classList.remove('cover-picker-open');
    modal.remove();
  };

  modal.onclick = (e) => { if (e.target === modal) closePicker(); };
  document.getElementById('coverPickerClose').onclick = closePicker;

  const closeAfterApply = async (coverUrl) => {
    if (!coverUrl) return;
    try {
      await persistMangaCover(mangaId, sourceId, coverUrl);
      closePicker();
      showToast('Cover updated', 'Saved to your library data.', 'success');
    } catch (e) {
      showToast('Cover error', e.message, 'error');
    }
  };

  const sourceBtn = document.getElementById('coverPickerUseSource');
  if (sourceBtn) sourceBtn.onclick = () => closeAfterApply(sourceCover);

  const gridEl = document.getElementById('coverPickerSuggestions');
  const metaEl = document.getElementById('coverPickerSearchMeta');
  const searchInput = document.getElementById('coverPickerSearchInput');
  const loadMoreBtn = document.getElementById('coverPickerLoadMore');
  const pickerState = {
    query: title,
    mode: 'sources',
    page: 1,
    seen: new Set(),
    hasNextPage: false,
    loading: false,
  };

  const renderChoiceCards = (choices, append = false) => {
    const html = choices.map(choice => `
      <button class="cover-choice-card" data-cover-url="${escapeHtml(choice.cover)}" title="${escapeHtml(choice.title)}">
        <span class="cover-choice-thumb"><img src="${escapeHtml(choice.cover)}" alt="${escapeHtml(choice.title)}" loading="lazy"></span>
        <span class="cover-choice-title">${escapeHtml(choice.title)}</span>
        <span class="cover-choice-source">${escapeHtml(choice.provider || '')}</span>
      </button>`).join('');
    if (!append) gridEl.innerHTML = html;
    else gridEl.insertAdjacentHTML('beforeend', html);
    gridEl.querySelectorAll('.cover-choice-card[data-cover-url]').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.onclick = () => closeAfterApply(btn.dataset.coverUrl || '');
    });
  };

  const updateLoadMoreVisibility = () => {
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = pickerState.hasNextPage ? '' : 'none';
    loadMoreBtn.disabled = pickerState.loading;
  };

  async function runCoverSearch(reset = false) {
    if (pickerState.loading) return;
    const nextQuery = (searchInput?.value || '').trim() || title;
    pickerState.loading = true;
    if (reset) {
      pickerState.query = nextQuery;
      pickerState.page = 1;
      pickerState.seen.clear();
      gridEl.classList.add('muted');
      gridEl.innerHTML = 'Searching covers...';
    } else {
      pickerState.page += 1;
    }
    const modeLabel = pickerState.mode === 'google' ? 'Google Images' : 'AniList + other sources';
    metaEl.textContent = `Searching ${modeLabel} for "${nextQuery}"...`;
    updateLoadMoreVisibility();
    try {
      const data = await searchCoverChoices(nextQuery, sourceId, pickerState.page, pickerState.mode);
      const fresh = (data.items || []).filter(choice => {
        const key = _coverChoiceKey(choice);
        if (pickerState.seen.has(key)) return false;
        pickerState.seen.add(key);
        return true;
      });
      pickerState.hasNextPage = !!data.hasNextPage;
      gridEl.classList.remove('muted');
      if (!fresh.length && pickerState.page === 1) {
        gridEl.innerHTML = '<p class="muted">No cover results found. Try a shorter title.</p>';
      } else if (!fresh.length) {
        showToast('Cover search', 'No more results found.', 'info');
      } else {
        renderChoiceCards(fresh, !reset && pickerState.page > 1);
      }
      metaEl.textContent = `${pickerState.seen.size} result(s) from ${data.sourceLabels.join(' + ')}.`;
    } catch (e) {
      pickerState.hasNextPage = false;
      gridEl.classList.remove('muted');
      gridEl.innerHTML = '<p class="muted">Could not load cover search results.</p>';
      metaEl.textContent = e.message || 'Cover search failed.';
    } finally {
      pickerState.loading = false;
      updateLoadMoreVisibility();
    }
  }

  document.getElementById('coverPickerGoogle').onclick = () => {
    pickerState.mode = 'google';
    const base = (searchInput?.value || title || '').trim();
    const q = /cover/i.test(base) ? base : `${base} manga cover`;
    if (searchInput) searchInput.value = q;
    runCoverSearch(true);
  };

  document.getElementById('coverPickerSearchSources').onclick = () => {
    pickerState.mode = 'sources';
    runCoverSearch(true);
  };

  document.getElementById('coverPickerSearchRun').onclick = () => runCoverSearch(true);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    runCoverSearch(true);
  });
  loadMoreBtn.onclick = () => runCoverSearch(false);
  runCoverSearch(true);
}

window.openMangaCoverPicker = openMangaCoverPicker;

async function loadMangaDetails(mangaId, fromView = "discover", fallbackTitle = "", skipFallback = false, forcedSourceId = "") {
  if (forcedSourceId && forcedSourceId !== state.currentSourceId) {
    state.currentSourceId = forcedSourceId;
    try { renderSourceSelect(); } catch (_) {}
  }
  $("searchStatus").textContent = "Loading details...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    result._sourceCover = result.cover || "";
    const storedCover = _getStoredMangaCover(result.id, state.currentSourceId);
    if (storedCover) result.cover = storedCover;
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
            <button type="button" class="cover-anilist-link cover-picker-trigger" title="Change cover">
              <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
              <div class="cover-anilist-hint">Change Cover</div>
            </button>
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
            <div class="manga-description" data-expanded="false">
              <p>${escapeHtml(result.description)}</p>
              <button class="btn-expand-description" title="Show full description">Read More</button>
            </div>` : ""}
          <div class="manga-actions">
            <button class="btn" id="addFavBtn">
              ${isFavorited ? "Remove from Library" : "Add to Library"}
            </button>
            <button class="btn btn-start-reading-detail" id="startReadingBtn">&#9654; Start Reading</button>
            <button class="btn btn-tracker" id="trackerBtn">Tracker</button>
            <button class="btn btn-secondary" id="manageCategoriesBtn">&#128194; Categories</button>
            ${hasProgress ? `<button class="btn btn-continue" id="continueReadingBtn">Continue</button>` : ""}
            ${fromView === 'random' ? `<button class="btn btn-reroll" id="rerollBtn" title="Pick another random manga">Reroll</button>` : ""}
          </div>
          <div id="detailRatingWrap" class="detail-rating-wrap"></div>
        </div>
      </div>
    `;

    // Reroll random
    if ($('rerollBtn')) $('rerollBtn').onclick = () => openRandomPickerDrawer();

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
          state.chapterCountCache[result.id] = state.allChapters.length;
          saveSettings();
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

    // Description expand/collapse
    const descDiv = $("details").querySelector(".manga-description[data-expanded]");
    if (descDiv) {
      const expandBtn = descDiv.querySelector(".btn-expand-description");
      if (expandBtn) {
        expandBtn.onclick = (e) => {
          e.preventDefault();
          const isExpanded = descDiv.dataset.expanded === "true";
          descDiv.dataset.expanded = !isExpanded ? "true" : "false";
          expandBtn.textContent = !isExpanded ? "Show Less" : "Read More";
        };
      }
    }

    // Tracker button
    $("trackerBtn").onclick = () => showTrackerModal(result);
    const detailCoverTrigger = $("details")?.querySelector('.cover-picker-trigger');
    if (detailCoverTrigger) {
      detailCoverTrigger.title = 'Left click or right click to change cover';
      detailCoverTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMangaCoverPicker(result, {
          sourceId: state.currentSourceId,
          sourceCover: result._sourceCover,
          currentCover: result.cover,
        });
      });
      detailCoverTrigger.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMangaCoverPicker(result, {
          sourceId: state.currentSourceId,
          sourceCover: result._sourceCover,
          currentCover: result.cover,
        });
      });
    }

    // Categories button
    $("manageCategoriesBtn").onclick = () => {
      const manga = { ...result, sourceId: state.currentSourceId };
      showCategoryModal(manga);
    };

    if (_alGetLink(result.id) && _alToken()) {
      $("trackerBtn").innerHTML = 'Tracker \u2713';
      $("trackerBtn").classList.add('btn-tracker--tracked');
    }

    // Rating widget
    renderDetailRating(result.id);

    // Render reading status
    renderReadingStatusSection(result.id, state.currentSourceId);
    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    if (!skipFallback && fromView === 'library') {
      const sourceId = forcedSourceId || state.currentSourceId;
      const wantedTitle = String(fallbackTitle || '').trim();
      if (sourceId && wantedTitle) {
        try {
          const fixed = await _resolveMangaInSourceByTitle(sourceId, wantedTitle);
          if (fixed?.mangaId && String(fixed.mangaId) !== String(mangaId)) {
            const migrateRes = await api('/api/library/migrate', {
              method: 'POST',
              body: JSON.stringify({
                migrations: [{
                  fromMangaId: mangaId,
                  fromSourceId: sourceId,
                  toMangaId: fixed.mangaId,
                  toSourceId: sourceId,
                  title: fixed.title || wantedTitle,
                  cover: fixed.cover || '',
                }]
              }),
            });

            if (Array.isArray(migrateRes?.migrations) && migrateRes.migrations.length > 0 && typeof _migrateRemapLocalStorage === 'function') {
              _migrateRemapLocalStorage(migrateRes.migrations);
            }

            try {
              const libData = await fetch('/api/library').then(r => r.json());
              state.favorites = libData.favorites || state.favorites;
              state.coverOverrides = libData.coverOverrides || state.coverOverrides;
              const statusData = await fetch('/api/user/status').then(r => r.json());
              state.readingStatus = statusData.readingStatus || state.readingStatus;
              const ratingsData = await fetch('/api/ratings').then(r => r.json());
              state.ratings = ratingsData.ratings || state.ratings;
              renderLibrary();
            } catch (_) {}

            showToast('Library repaired', `${wantedTitle} ID was fixed in ${state.installedSources[sourceId]?.name || sourceId}.`, 'warning');
            return loadMangaDetails(fixed.mangaId, fromView, wantedTitle, true);
          }
        } catch (_) {
          // Continue with original error message.
        }
      }
    }

    $("searchStatus").textContent = `Error: ${e.message}`;
    showToast("Error", e.message, "error");
  }
}

function renderDetailRating(mangaId) {
  const wrap = $("detailRatingWrap");
  if (!wrap) return;
  const ratingKey = String(mangaId || '').replace(/[^a-z0-9:_-]/gi, '_');
  const current = state.ratings[ratingKey] || 0;
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
      const newScore = state.ratings[ratingKey] === score ? null : score;
      try {
        if (newScore) {
          await api("/api/reviews", { method: "POST", body: JSON.stringify({ mangaId, rating: newScore, text: "" }) });
          state.ratings[ratingKey] = newScore;
          // Sync score to AniList if this manga is linked
          const _alId = _alGetLink(mangaId);
          if (_alId && _alToken()) {
            anilistGQL(
              'mutation ($m: Int, $sc: Float) { SaveMediaListEntry(mediaId: $m, score: $sc) { id } }',
              { m: _alId, sc: newScore }
            ).catch(e => dbg.warn(dbg.ERR_ANILIST, 'Score sync failed', e));
          }
        } else {
          await api('/api/ratings/clear', { method: 'POST', body: JSON.stringify({ mangaId }) });
          delete state.ratings[ratingKey];
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
        await api('/api/ratings/clear', { method: 'POST', body: JSON.stringify({ mangaId }) });
        delete state.ratings[ratingKey];
        renderDetailRating(mangaId);
        renderLibrary();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  }
}

