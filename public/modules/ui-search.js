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
  // The original implementation made a /chapters API call for every search result,
  // and if 0, searched every other source. This causes the UI to hang on "Searching..."
  // for minutes or hours due to massive backend API spam and timeouts.
  return Array.isArray(results) ? results : [];
}

// ── Pagination helper ───────────────────────────────────────────────────────
// Only a handful of sources can report a real, query-specific total page
// count (MangaDex via its own `total` field, KingOfShojo/MangaKatana via
// their "1 2 3 … N" numbered pagination) — everyone else only ever knows
// "is there a next page", so `totalPages` is undefined for them and this
// just falls back to the plain "Page X" it always showed.
function formatLoadedStatus(loadedCount) {
  return `${loadedCount} result(s) loaded`;
}

// ── Infinite-scroll "load more" controller ──────────────────────────────────
// Replaces numbered Prev/Next pagination for search results: a small
// sentinel element sits where the pagination controls used to be, and an
// IntersectionObserver fires the caller's onLoadMore() once it scrolls near
// the bottom. One instance is created per results host (search vs advanced
// search) and reused across searches — attach()/showEnd()/clear() all
// tear down any previous observer first, so switching searches never leaves
// a stale observer watching a detached sentinel.
function createLoadMoreController(hostId) {
  let observer = null;
  let loading = false;

  function disconnect() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  function clear() {
    disconnect();
    const host = $(hostId);
    if (host) host.innerHTML = "";
  }

  function showEnd(message = "No more results.") {
    disconnect();
    const host = $(hostId);
    if (host) host.innerHTML = `<div class="load-more-status load-more-end">${escapeHtml(message)}</div>`;
  }

  async function trigger(onLoadMore) {
    if (loading) return;
    loading = true;
    const statusEl = $(hostId)?.querySelector(".load-more-status");
    if (statusEl) statusEl.textContent = "Loading more…";
    try {
      await onLoadMore();
    } catch (_) {
      showEnd("Could not load more results.");
    } finally {
      loading = false;
    }
  }

  function attach(onLoadMore) {
    const host = $(hostId);
    if (!host) return;
    disconnect();
    host.innerHTML = `<div class="load-more-sentinel"><span class="load-more-status"></span></div>`;
    const sentinel = host.querySelector(".load-more-sentinel");
    // Start loading a bit before the sentinel is actually on screen so
    // scrolling doesn't visibly stall waiting for the network.
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) trigger(onLoadMore);
    }, { rootMargin: "400px 0px 0px 0px" });
    observer.observe(sentinel);
  }

  return {
    show(hasNextPage, onLoadMore) {
      if (!hasNextPage) { showEnd(); return; }
      attach(onLoadMore);
    },
    clear,
  };
}

const _searchLoadMore = createLoadMoreController("searchPagination");

function normalizeSourceSearchResult(raw, sourceId) {
  if (!raw || typeof raw !== 'object') return null;

  const url = String(raw.url || raw.href || raw.sourceUrl || '').trim();

  let id = String(
    raw.id ||
    raw.mangaId ||
    raw.slug ||
    ''
  ).trim();

  if (!id || id === 'undefined' || id === 'null') {
    const match = url.match(/\/manga\/([^/?#]+)/i);
    if (match) id = decodeURIComponent(match[1]);
  }

  const title = String(raw.title || raw.name || '').trim();

  if (!id || id === 'undefined' || !title) {
    if (window.SCROLLSCAPE_DEBUG_SOURCE_HEALTH) {
      console.warn('[ScrollScape] Dropping invalid search result', {
        sourceId,
        raw,
        resolvedId: id,
        title,
        url
      });
    }
    return null;
  }

  return {
    ...raw,
    id,
    mangaId: id,
    slug: String(raw.slug || id).trim(),
    sourceId: String(raw.sourceId || raw.source || sourceId || '').trim(),
    title,
    url
  };
}

// ── Main search ─────────────────────────────────────────────────────────────

// Shared by single-source search and searchAllSources(): normalizes raw
// source results, applies the NSFW/genre-blacklist filter, then drops
// manga with zero chapters. Pulled out of search() so both paths stay in
// sync instead of drifting apart.
async function _processSearchResults(rawResults, sourceId, query) {
  const normalizedResults = (rawResults || [])
    .map(m => normalizeSourceSearchResult(m, sourceId))
    .filter(Boolean);

  if (window.SCROLLSCAPE_DEBUG_SOURCE_HEALTH && normalizedResults.length === 0 && query && query !== '*') {
    console.log({
      area: sourceId,
      code: "NO_RESULTS",
      errorLabel: `${sourceId} search returned no results for valid query`,
      suggestedAction: "Check source site or try fallback.",
      cooldownUntil: null,
      retryAllowed: true,
      query: query,
      rawResultsLength: (rawResults || []).length
    });
  }

  const blacklist = state.settings.genreBlacklist || [];
  const results = normalizedResults.filter(m => {
    if (state.settings.hideNsfw && isNsfwManga(m)) return false;
    if (blacklist.length > 0 && Array.isArray(m.genres)) {
      const lowerGenres = m.genres.map(g => typeof g === 'string' ? g.toLowerCase() : '');
      if (lowerGenres.some(g => blacklist.includes(g))) return false;
    }
    return true;
  });
  return _filterMangaWithoutChapters(results, sourceId);
}

window.search = async function search(page = 1, isLoadMore = false) {
  const query = $("searchInput").value.trim();
  const dropdown = $("searchDropdown");
  const searchAllToggle = $("searchAllSourcesToggle");
  const allSources = !!(searchAllToggle && searchAllToggle.checked);

  if (!allSources && !state.currentSourceId) { $("searchStatus").textContent = "Select a source first."; return; }
  if (!query) {
    if (dropdown) { dropdown.innerHTML = ""; dropdown.classList.remove("grouped-by-source"); }
    $("searchStatus").textContent = "";
    _searchLoadMore.clear();
    return;
  }

  if (allSources) { _searchLoadMore.clear(); return searchAllSources(query); }

  state.searchQuery = query;
  state.searchPage = page;
  if (!isLoadMore) $("searchStatus").textContent = "Searching...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, page })
    });
    const chapterFiltered = await _processSearchResults(result.results, state.currentSourceId, query);
    const hasNextPage = result.hasNextPage || false;
    state.searchHasNextPage = hasNextPage;
    if (!dropdown) return;
    dropdown.classList.remove("grouped-by-source");

    if (!isLoadMore) {
      if (!chapterFiltered.length) {
        dropdown.innerHTML = `<div class="muted" style="padding:1rem">No results found for "${escapeHtml(query)}"</div>`;
        $("searchStatus").textContent = "0 result(s) found";
        _searchLoadMore.show(false);
        return;
      }
      dropdown.innerHTML = chapterFiltered.map(m => mangaCardHTML(m)).join("");
    } else if (chapterFiltered.length) {
      dropdown.insertAdjacentHTML("beforeend", chapterFiltered.map(m => mangaCardHTML(m)).join(""));
    }
    bindMangaCards(dropdown);
    if (typeof _hydrateMissingGenres === 'function') _hydrateMissingGenres(dropdown);
    const loadedCount = dropdown.querySelectorAll(".manga-card").length;
    $("searchStatus").textContent = formatLoadedStatus(loadedCount);
    _searchLoadMore.show(hasNextPage, () => search(page + 1, true));
  } catch (e) {
    if (!isLoadMore) {
      $("searchStatus").textContent = "Could not search manga.";
      _searchLoadMore.clear();
    } else {
      throw e; // let the load-more controller show its "could not load more" state
    }
  }
}

// How many results a source reveals at a time in "Search all sources" —
// not a hard cap: each source's group has its own "+N more" button once
// there's more to show, either already fetched-but-hidden or via the
// source's next native page. Switch the source dropdown to a single
// source for the full infinite-scroll experience instead.
const SEARCH_ALL_SOURCES_REVEAL_CHUNK = 20;
// How many sources are queried in parallel at once. Several installed
// sources share the same FlareSolverr instance to get past Cloudflare —
// firing all of them at once just queues them up behind each other, so a
// small worker pool (matching the pattern already used for genre
// hydration in ui-discover.js) keeps things moving without hammering it.
const SEARCH_ALL_SOURCES_CONCURRENCY = 3;

// ── "Search all sources" per-source reveal controller ───────────────────────
// Shared by searchAllSources() here and advancedSearchAllSources() in
// ui-advanced-search.js. Each source keeps an unbounded local pool of
// already-fetched-and-filtered results; clicking "+N more" reveals the next
// chunk from that pool first (no network needed) and only fetches the
// source's next native page once the pool is actually exhausted.
// fetchPage(nativePage) must resolve to { items, hasNextPage }, already
// normalized/filtered by the caller.
function _appendMangaCardsToGrid(gridEl, items) {
  if (!gridEl || !items.length) return;
  gridEl.insertAdjacentHTML("beforeend", items.map(m => mangaCardHTML(m)).join(""));
  bindMangaCards(gridEl);
  if (typeof _hydrateMissingGenres === 'function') _hydrateMissingGenres(gridEl);
}

// Bounds how many native pages ONE reveal (initial or "+N more" click) will
// fetch trying to fill a single chunk — a heavily filtered source could
// otherwise need many native pages to yield even one chunk-worth of
// matches. Same reasoning as advancedSearch()'s per-round fill-up cap.
const SOURCE_REVEAL_MAX_FETCH_ATTEMPTS = 20;

function createSourceRevealController({ groupEl, chunkSize, fetchPage }) {
  const statusEl = groupEl?.querySelector(".search-source-group-status");
  const gridEl = groupEl?.querySelector(".search-source-group-grid");
  const moreEl = groupEl?.querySelector(".search-source-group-more");

  let pool = [];
  let shown = 0;
  let nativePage = 0;
  let hasMoreNative = true;
  let loading = false;

  function renderMoreButton() {
    if (!moreEl) return;
    const hasMore = pool.length > shown || hasMoreNative;
    if (!hasMore) { moreEl.innerHTML = ""; return; }
    moreEl.innerHTML = `<button class="btn secondary search-source-load-more-btn" type="button">+${chunkSize} more</button>`;
    moreEl.querySelector("button").onclick = loadMore;
  }

  function revealNextChunk() {
    const chunk = pool.slice(shown, shown + chunkSize);
    _appendMangaCardsToGrid(gridEl, chunk);
    shown += chunk.length;
    if (statusEl) statusEl.textContent = shown ? `${shown} result(s)` : "No results";
    return chunk.length;
  }

  // Fetches native pages (bounded) until the pool has enough unshown items
  // for a full chunk, or the source is genuinely exhausted.
  async function ensurePoolHasChunk() {
    const target = shown + chunkSize;
    let attempts = 0;
    while (pool.length < target && hasMoreNative && attempts < SOURCE_REVEAL_MAX_FETCH_ATTEMPTS) {
      attempts++;
      nativePage += 1;
      const { items, hasNextPage } = await fetchPage(nativePage);
      pool.push(...items);
      hasMoreNative = hasNextPage;
    }
  }

  async function loadMore() {
    if (loading) return;
    loading = true;
    if (moreEl) moreEl.innerHTML = `<span class="load-more-status">Loading more…</span>`;
    try {
      await ensurePoolHasChunk();
      revealNextChunk();
    } catch (e) {
      if (moreEl) moreEl.innerHTML = `<span class="load-more-status">Could not load more results.</span>`;
      loading = false;
      return;
    }
    loading = false;
    renderMoreButton();
  }

  return {
    async loadFirstPage() {
      try {
        await ensurePoolHasChunk();
        const shownCount = revealNextChunk();
        if (shownCount === 0 && !hasMoreNative) {
          if (groupEl) groupEl.style.display = "none";
        } else {
          renderMoreButton();
        }
        return shownCount;
      } catch (e) {
        if (statusEl) statusEl.textContent = "Unavailable";
        if (groupEl) groupEl.style.display = "none";
        throw e;
      }
    },
  };
}

async function searchAllSources(query) {
  const dropdown = $("searchDropdown");
  const pg = $("searchPagination");
  if (pg) pg.innerHTML = "";
  if (!dropdown) return;

  const sources = getSelectableSources();
  if (!sources.length) {
    $("searchStatus").textContent = "No installed sources to search.";
    dropdown.classList.remove("grouped-by-source");
    dropdown.innerHTML = "";
    return;
  }

  state.searchQuery = query;
  state.searchPage = 1;
  $("searchStatus").textContent = `Searching ${sources.length} source(s)...`;

  dropdown.classList.add("grouped-by-source");
  dropdown.innerHTML = sources.map(s => `
    <div class="search-source-group" data-source-id="${escapeHtml(s.id)}">
      <div class="search-source-group-header">
        <span class="search-source-group-name">${escapeHtml(s.name)}</span>
        <span class="search-source-group-status">Searching…</span>
      </div>
      <div class="search-source-group-grid"></div>
      <div class="search-source-group-more"></div>
    </div>
  `).join("");

  let totalShown = 0;
  let doneCount = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor++];
      const groupEl = dropdown.querySelector(`.search-source-group[data-source-id="${source.id}"]`);

      const controller = createSourceRevealController({
        groupEl,
        chunkSize: SEARCH_ALL_SOURCES_REVEAL_CHUNK,
        fetchPage: async (nativePage) => {
          const result = await api(`/api/source/${source.id}/search`, {
            method: "POST",
            body: JSON.stringify({ query, page: nativePage })
          });
          const items = await _processSearchResults(result.results, source.id, query);
          return { items, hasNextPage: result.hasNextPage || false };
        },
      });

      try {
        totalShown += await controller.loadFirstPage();
      } catch (e) {
        // controller already set the "Unavailable" state on the group
      }

      doneCount++;
      $("searchStatus").textContent = doneCount < sources.length
        ? `Searching... (${doneCount}/${sources.length} sources done, ${totalShown} result(s) so far)`
        : `${totalShown} result(s) shown across ${sources.length} source(s)`;
    }
  }

  await Promise.all(Array.from({ length: Math.min(SEARCH_ALL_SOURCES_CONCURRENCY, sources.length) }, worker));
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
    const installed = getSelectableSources().filter(s => s.id !== state.currentSourceId);
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

function showSourceSwitchChoiceModal(sourceId, title, choices) {
  document.getElementById('sourceSwitchChoiceModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'sourceSwitchChoiceModal';
  modal.className = 'settings-modal';
  
  const rows = choices.map(c => `
    <div class="manga-choice-row" style="display:flex;align-items:center;gap:1rem;padding:0.75rem;border-bottom:1px solid color-mix(in srgb, var(--primary) 15%, transparent);cursor:pointer;transition:background-color .2s" onclick="
        document.getElementById('sourceSwitchChoiceModal').remove();
        state.currentSourceId = '${escapeHtml(sourceId)}';
        const selectors = [document.getElementById('sourceSelect'), document.getElementById('advancedSourceSelect')];
        selectors.forEach(s => { if (s) s.value = '${escapeHtml(sourceId)}'; });
        loadMangaDetails('${escapeHtml(c.id)}');
    " onmouseenter="this.style.backgroundColor='color-mix(in srgb, var(--primary) 10%, transparent)'" onmouseleave="this.style.backgroundColor=''">
       ${c.cover ? `<img src="${escapeHtml(c.cover)}" style="width:40px;height:56px;object-fit:cover;border-radius:4px">` : `<div style="width:40px;height:56px;background:color-mix(in srgb, var(--primary) 15%, transparent);border-radius:4px"></div>`}
       <div style="flex:1">
         <div style="font-weight:600;font-size:1rem">${escapeHtml(c.title)}</div>
         ${c.author ? `<div style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(c.author)}</div>` : ''}
       </div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="settings-content" style="max-width:500px">
      <div class="settings-header">
        <h2>Select Manga</h2>
        <button class="btn secondary" id="closeSourceSwitchChoice">&#x2715;</button>
      </div>
      <div class="settings-body" style="padding:0;max-height:60vh;overflow-y:auto">
        <div style="padding:1rem;font-size:0.9rem;color:var(--text-muted);border-bottom:1px solid color-mix(in srgb, var(--primary) 15%, transparent)">
          Multiple results found for "<strong>${escapeHtml(title)}</strong>". Please choose the correct one:
        </div>
        ${rows}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.getElementById('closeSourceSwitchChoice').onclick = () => modal.remove();
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
    const rawResults = result.results || [];
    const normalizedResults = typeof normalizeSourceSearchResult === 'function' ? rawResults.map(m => normalizeSourceSearchResult(m, sourceId)).filter(Boolean) : rawResults;
    const chapterFiltered = await _filterMangaWithoutChapters(normalizedResults, sourceId);
    if (chapterFiltered.length === 0) {
      showToast("Not found", `"${title}" not found in ${state.installedSources[sourceId]?.name || sourceId}`, "info");
      return;
    }
    
    if (chapterFiltered.length > 1) {
      showSourceSwitchChoiceModal(sourceId, title, chapterFiltered);
      return;
    }

    // Switch source globally and open first result
    state.currentSourceId = sourceId;
    const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
    selectors.forEach(s => { if (s) s.value = sourceId; });
    loadMangaDetails(chapterFiltered[0].id);
  } catch (e) {
    showToast("Error", "Could not load manga details.", "error");
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
      const rawResults = r?.results || [];
      const normResults = typeof normalizeSourceSearchResult === 'function' ? rawResults.map(m => normalizeSourceSearchResult(m, sid)).filter(Boolean) : rawResults;
      for (const c of normResults.slice(0, 8)) {
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

  const rawResults = r?.results || [];
  const normResults = typeof normalizeSourceSearchResult === 'function' ? rawResults.map(m => normalizeSourceSearchResult(m, sourceId)).filter(Boolean) : rawResults;
  let best = null;
  for (const c of normResults.slice(0, 10)) {
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

async function openAniListForManga(title) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) {
    showToast('Pop-up Blocked', 'Please allow pop-ups to open AniList.', 'error');
    return;
  }
  tab.document.write('<body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>Searching AniList...</h2></body>');
  try {
    const data = await anilistGQL(
      `query ($search: String) {
        Page(page: 1, perPage: 1) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
            id
          }
        }
      }`,
      { search: title }
    );
    const id = data?.data?.Page?.media?.[0]?.id;
    if (id) {
      tab.location.href = `https://anilist.co/manga/${id}`;
    } else {
      tab.location.href = `https://anilist.co/search/manga?search=${encodeURIComponent(title)}`;
    }
  } catch (e) {
    tab.location.href = `https://anilist.co/search/manga?search=${encodeURIComponent(title)}`;
  }
}
window.openAniListForManga = openAniListForManga;

// BatCave comics have no AniList presence (manga-only database). LOCG sits
// behind Cloudflare, so a precise-match lookup like openAniListForManga's
// can't be done directly from the browser here — this always opens LOCG's
// own search results and lets the user pick the right edition themselves.
function openLocgForComic(title) {
  // Strip BatCave's own trailing year annotation ("Title (2026-)", "Title
  // (1991 series)", "Title (2018-2019)") so the query is just the clean
  // series name — LOCG's own search ranks that higher than with the
  // annotation still attached.
  const cleanTitle = String(title || '').replace(/\s*\((?:\d{4}(?:-\d{4})?-?|\d{4}\s+series)\)\s*$/i, '').trim() || title;
  window.open(`https://leagueofcomicgeeks.com/search?keyword=${encodeURIComponent(cleanTitle)}`, '_blank');
}
window.openLocgForComic = openLocgForComic;

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
            ${currentCover ? `<img src="${escapeHtml(normalizeImageUrl(currentCover))}" alt="${escapeHtml(title)}">` : `<div class="no-cover">?</div>`}
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
          <div class="cover-picker-loading-bar" id="coverPickerLoadingBar"><div class="cover-picker-loading-bar-fill"></div></div>
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
      showToast('Cover error', 'Could not search covers.', 'error');
    }
  };

  const sourceBtn = document.getElementById('coverPickerUseSource');
  if (sourceBtn) sourceBtn.onclick = () => closeAfterApply(sourceCover);

  const gridEl = document.getElementById('coverPickerSuggestions');
  const metaEl = document.getElementById('coverPickerSearchMeta');
  const loadingBarEl = document.getElementById('coverPickerLoadingBar');
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
    if (loadingBarEl) loadingBarEl.classList.add('active');
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
      metaEl.textContent = 'Cover search failed.';
    } finally {
      pickerState.loading = false;
      if (loadingBarEl) loadingBarEl.classList.remove('active');
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

function normalizeLibraryMangaPayload(manga, activeSourceId) {
  const sourceId = String(
    manga?.sourceId ||
    manga?.source ||
    activeSourceId ||
    ''
  ).trim();

  const url = String(manga?.url || manga?.href || manga?.sourceUrl || '').trim();

  let id = String(
    manga?.id ||
    manga?.mangaId ||
    manga?.slug ||
    ''
  ).trim();

  if (id === 'undefined') id = '';

  if (!id && url) {
    const match = url.match(/\/manga\/([^/?#]+)/i);
    if (match) id = decodeURIComponent(match[1]);
  }

  const title = String(manga?.title || manga?.name || '').trim();

  return {
    ...manga,
    id,
    mangaId: id,
    slug: String(manga?.slug || id).trim(),
    sourceId,
    title,
    cover: manga?.cover || manga?.image || manga?.coverUrl || '',
    url
  };
}

function buildLibraryPayload(manga, activeSourceId) {
  const normalized = normalizeLibraryMangaPayload(manga, activeSourceId);
  if (!normalized.id || !normalized.sourceId || !normalized.title) {
    return null;
  }
  return normalized;
}

async function loadMangaDetails(rawMangaId, fromView = "discover", fallbackTitle = "", skipFallback = false, forcedSourceId = "") {
  // Normalize mangaId if needed
  let mangaId = String(rawMangaId || '').trim();
  if (mangaId === 'undefined') mangaId = '';

  if (!mangaId) {
    if (window.SCROLLSCAPE_DEBUG_SOURCE_HEALTH) {
      console.log({
        source: 'manga-details-error',
        message: 'Refusing to load details for undefined mangaId',
        rawMangaId
      });
    }
    showToast('Error', 'Cannot load details: Manga ID is missing', 'error');
    return;
  }

  if (forcedSourceId && forcedSourceId !== state.currentSourceId) {
    state.currentSourceId = forcedSourceId;
    try { renderSourceSelect(); } catch (_) {}
  }
  $("searchStatus").textContent = "Loading details...";
  try {
    let result;
    try {
      result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
        method: "POST",
        body: JSON.stringify({ mangaId })
      });
    } catch (err) {
      const activeSourceId = forcedSourceId || state.currentSourceId;
      const fav = (state.favorites || []).find(m => String(m.id) === String(mangaId) && String(m.sourceId) === String(activeSourceId))
               || (state.history || []).find(m => String(m.id) === String(mangaId) && String(m.sourceId) === String(activeSourceId));
      if (!fav) throw err;
      result = {
        id: fav.id,
        title: fav.title,
        cover: fav.cover,
        description: fav.description || "",
        status: fav.status || "unknown",
        genres: fav.genres || [],
        author: fav.author || "",
        altTitle: fav.altTitle || ""
      };
    }
    result._sourceCover = result.cover || "";
    const storedCover = _getStoredMangaCover(result.id, state.currentSourceId);
    if (storedCover) result.cover = storedCover;
    state.currentManga = result;
    const isFavorited = isMangaInLibrary(result, state.currentSourceId);
    const hasProgress = !!state.lastReadChapter?.[result.id];

    // Navigate with context
    setView("manga-details", {
      mangaId: mangaId,
      sourceId: state.currentSourceId,
      title: result.title || fallbackTitle || "",
      scrollPosition: 0
    });

    // Render detail card
    $("details").innerHTML = `
      <div class="manga-details">
        ${result.cover && !result.cover.endsWith('.pdf') ? `
          <div class="manga-cover">
            <button type="button" class="cover-anilist-link cover-picker-trigger" title="Change cover">
              <img src="${escapeHtml(normalizeImageUrl(result.cover))}" alt="${escapeHtml(result.title)}">
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
            <span class="badge" title="Current Source">${escapeHtml(state.installedSources[state.currentSourceId]?.name || state.currentSourceId)}</span>
            <span class="source-switch-wrap">
              <span class="badge badge-source source-switch-btn" id="sourceSwitchBtn" onclick="showMigrateModalForManga(state.currentManga)" title="Migrate this manga to another source">Migrate ▾</span>
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
            ${!hasProgress ? `<button class="btn btn-start-reading-detail" id="startReadingBtn">&#9654; Start Reading</button>` : ""}
            ${hasProgress ? `<button class="btn btn-continue" id="continueReadingBtn">Continue</button>` : ""}
            <button class="btn btn-tracker" id="trackerBtn">Tracker</button>
            <button class="btn btn-secondary" id="manageCategoriesBtn">&#128194; Categories</button>
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
        const safeManga = buildLibraryPayload(result, state.currentSourceId);

        if (!safeManga) {
          showToast("Error", "Could not update Library.", "error");
          if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
            console.log({
              source: "library-update-error",
              action: "add/remove",
              endpoint: "unknown",
              errorName: "Validation Error",
              errorMessage: "Invalid library payload: missing id, sourceId, or title after normalization",
              payload: result
            });
          }
          return;
        }

        const mangaIdStr = safeManga.id;
        const sourceIdStr = safeManga.sourceId;
        const mangaKey = getMangaKey(safeManga);
        const favsBefore = state.favorites.length;
        const isFavoritedBefore = isMangaInLibrary(safeManga, sourceIdStr);
        const action = isFavoritedBefore ? "remove" : "add";
        const endpoint = action === "add" ? "/api/library/add" : "/api/library/remove";
        
        if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
          console.log({
            source: "library-update-attempt",
            action: action,
            title: safeManga.title,
            id: safeManga.id,
            sourceId: safeManga.sourceId,
            mangaKey: mangaKey,
            payload: safeManga,
            endpoint: endpoint
          });
        }
        
        let res;
        let success = false;
        if (action === "add") {
          success = await ensureMangaInLibrary(safeManga, sourceIdStr);
          if (!success) throw new Error("Persistence verification failed.");
        } else {
          res = await ensureMangaNotInLibrary(safeManga.id, sourceIdStr);
          success = true;
        }

        if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
          console.log({
            source: "library-update-response",
            action,
            endpoint,
            status: 200,
            ok: success,
            favoritesCountBefore: favsBefore,
            favoritesCountAfter: state.favorites.length
          });
        }
        
        const saved = state.favorites.some(f => getMangaKey(f) === mangaKey);
        if (action === "add" && !saved) {
          throw new Error("Persistence verification failed.");
        }
        
        $("addFavBtn").textContent = saved ? (t("context.remove") || "Remove from Library") : (t("manga.addToLibrary") || "Add to Library");
        
        if (window.SCROLLSCAPE_DEBUG_LIBRARY_MEMBERSHIP) {
          console.log({
            stage: "post-add-verify",
            title: result.title,
            id: mangaIdStr,
            sourceId: sourceIdStr,
            mangaKey: mangaKey,
            persistenceResult: action,
            favoritesCountBefore: favsBefore,
            favoritesCountAfter: state.favorites.length,
            savedObject: safeManga
          });
        }
        
        showToast(saved ? "Added to Library" : "Removed from Library", result.title, saved ? "success" : "info");
        renderLibrary();
        await updateStats();
        await checkAndUnlockAchievements();
      } catch (e) {
        if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
          const action = isMangaInLibrary(result, state.currentSourceId) ? "remove" : "add";
          console.log({
            source: "library-update-error",
            action: action,
            endpoint: action === "add" ? "/api/library/add" : "/api/library/remove",
            errorName: e.name || "Error",
            errorMessage: e.message,
            payload: result
          });
        }
        console.error(e);
        showToast("Error", "Could not update Library.", "error");
      }
    };

    // Start reading (first chapter)
    const startBtn = $("startReadingBtn");
    if (startBtn) {
      startBtn.onclick = async () => {
        if (!state.allChapters?.length) {
          showToast("Loading chapters...", "", "info");
          return;
        }
        const firstIdx = state.allChapters.length - 1;
        const ch = state.allChapters[firstIdx];
        await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
      };
    }

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
        } catch (e) { showToast("Error", "Could not load source details.", "error"); }
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
      const isComicSource = state.currentSourceId === 'batcave';
      detailCoverTrigger.title = isComicSource
        ? 'Left click: LOCG | Right click: Change Cover'
        : 'Left click: AniList | Right click: Change Cover';
      const hint = detailCoverTrigger.querySelector('.cover-anilist-hint');
      if (hint) {
        hint.textContent = isComicSource ? 'LOCG (RMB: Cover)' : 'AniList (RMB: Cover)';
        hint.style.fontSize = '0.75rem';
      }
      detailCoverTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isComicSource) {
          openLocgForComic(result.title);
        } else if (typeof window.openAniListForManga === 'function') {
          window.openAniListForManga(result.title);
        } else {
          window.open('https://anilist.co/search/manga?search=' + encodeURIComponent(result.title), '_blank');
        }
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

    $("searchStatus").textContent = "Could not load manga details.";
    showToast("Error", "Could not load manga details.", "error");
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
      } catch (e) { showToast("Error", "Could not process rating.", "error"); }
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
      } catch (e) { showToast("Error", "Could not clear rating.", "error"); }
    };
  }
}

