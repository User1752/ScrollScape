// ============================================================================
// ADVANCED SEARCH
// ============================================================================

// Every source module now internally stitches its own native pages up to
// a fixed size per dispatch call — 50 for all sources except BatCave,
// which is capped at 20 (2 native pages) because 50 there means 5 native
// pages each carrying its own ComicVine/LOCG enrichment pass, measured
// live at ~91s, well past the server's 30s per-call timeout (see
// data/sources/batcave.js's APP_PAGE_SIZE comment). Matching this value to
// the *largest* single-call size (50) means the fast path (no client-side
// filter active) needs exactly one dispatch call per app-page for 9 of the
// 10 sources, and the fill-up path below only needs extra iterations for
// BatCave or when a client-side filter is actually removing items.
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
  kingofshojo: {
    orderBy: false,
    publicationStatus: false,
    contentRating: false,
    format: false,
    genres: true,
  },
  vortexscans: {
    orderBy: false,
    publicationStatus: false,
    contentRating: false,
    format: false,
    genres: false,
  },
  batcave: {
    // BatCave's own site-native "sort by" widget doesn't work (confirmed by
    // replaying its exact form submit through a real browser — the result
    // order never changes). orderBy IS enabled here, but only for the two
    // values backed by real, distinct data from BatCave's own homepage
    // widgets — see applyOrderByOptionsForSource, which swaps in a reduced
    // option list so the other generic values (title, year, follows...)
    // — which have no BatCave-side data — are never shown as decoration.
    orderBy: true,
    publicationStatus: false,
    contentRating: false,
    format: false,
    genres: true,
  },
  weebcentral: {
    // Genuinely supported server-side (data/sources/weebcentral.js's
    // mapOrderBy/mapFilters) — orderBy uses a reduced option list (see
    // WEEBCENTRAL_ORDER_BY_OPTIONS) since Year Asc/Desc has no analogue.
    orderBy: true,
    publicationStatus: true,
    contentRating: false,
    format: true,
    genres: true,
  },
  asurascans: {
    // /browse has no sort/status/format query params — only q/genre/page —
    // so those controls would silently do nothing if left enabled.
    orderBy: false,
    publicationStatus: false,
    contentRating: false,
    format: false,
    genres: true,
  },
  comichubfree: {
    // No query-param-driven sort or status/format filtering on this site
    // (popular-comic/new-comic/search-comic/{genre}-comic are the only
    // listing endpoints, none of them take a sort/status/format param).
    orderBy: false,
    publicationStatus: false,
    contentRating: false,
    format: false,
    genres: true,
  },
};

// BatCave's own genre taxonomy (comics, not manga) — swapped in for the
// generic manga genre list below while it's the selected source, since most
// of those manga-specific tags (Doujinshi, Isekai, Shounen, ...) don't exist
// on BatCave and several of its own (Superhero, Zombies, Robots, ...) aren't
// in the generic list at all.
const BATCAVE_GENRES = [
  'Action', 'Adventure', 'Anthology', 'Anthropomorphic', 'Biography', 'Children',
  'Comedy', 'Crime', 'Drama', 'Family', 'Fantasy', 'Fighting', 'Graphic Novels',
  'Historical', 'Horror', 'Leading Ladies', 'LGBTQ', 'Literature', 'Manga',
  'Martial Arts', 'Mature', 'Military', 'Mini-Series', 'Movies & TV', 'Music',
  'Mystery', 'Mythology', 'Personal', 'Political', 'Post-Apocalyptic',
  'Psychological', 'Pulp', 'Religious', 'Robots', 'Romance', 'Satire',
  'School Life', 'Sci-Fi', 'Slice of Life', 'Sport', 'Spy', 'Superhero',
  'Supernatural', 'Suspense', 'Teen', 'Thriller', 'Vampires', 'Video Games',
  'War', 'Western', 'Zombies',
];

const NSFW_BATCAVE_GENRES = new Set(['Mature']);

let _defaultGenreGridHtml = null;
let _genreGridSource = null; // which list is currently rendered: 'batcave', 'default', or 'merged'

function applyGenreGridForSource(sourceId) {
  const grid = $('genreGrid');
  if (!grid) return;

  if (_defaultGenreGridHtml === null) {
    _defaultGenreGridHtml = grid.innerHTML;
    _genreGridSource = 'default';
  }

  // advancedSearch() calls this on every search (not just on source
  // change) to keep filters in sync — rebuilding the list unconditionally
  // would wipe out whatever the user had just checked a moment earlier,
  // right before those checkboxes get read.
  const targetSource = sourceId === 'batcave' ? 'batcave' : 'default';
  if (_genreGridSource === targetSource) return;

  if (targetSource === 'batcave') {
    grid.innerHTML = BATCAVE_GENRES.map(name => {
      const nsfwAttr = NSFW_BATCAVE_GENRES.has(name) ? ' data-nsfw="1"' : '';
      return `<label class="genre-check"${nsfwAttr}><input type="checkbox" value="${escapeHtml(name)}"><span>${escapeHtml(name)}</span></label>`;
    }).join('');
  } else {
    grid.innerHTML = _defaultGenreGridHtml;
  }
  _genreGridSource = targetSource;
}

// Parses the cached default genre grid HTML into a plain list instead of
// hardcoding a second copy of index.html's genre checkboxes that could
// silently drift out of sync with the markup there.
function getDefaultGenreList() {
  if (_defaultGenreGridHtml === null) return [];
  const tmp = document.createElement('div');
  tmp.innerHTML = _defaultGenreGridHtml;
  return [...tmp.querySelectorAll('.genre-check')]
    .map(label => ({ name: label.querySelector('input')?.value || '', nsfw: label.dataset.nsfw === '1' }))
    .filter(g => g.name);
}

// The two taxonomies a genre value can belong to. Only BatCave has its own
// (comics, not manga) — every other installed source shares the default
// manga list, so this doesn't need a per-source lookup table.
function getSourceGenreTaxonomy(sourceId) {
  return sourceId === 'batcave'
    ? BATCAVE_GENRES
    : getDefaultGenreList().map(g => g.name);
}

// Union of both taxonomies for "Search all sources", alphabetised so a
// merged ~70-entry list (default manga genres + BatCave's comic genres,
// overlapping ones like "Horror"/"Romance" collapsed into one) is actually
// browsable instead of two unrelated lists awkwardly concatenated.
function buildMergedGenreList() {
  const byKey = new Map(); // lowercase name -> { name, nsfw }
  const add = (name, nsfw) => {
    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.nsfw = existing.nsfw || nsfw;
    else byKey.set(key, { name, nsfw });
  };
  getDefaultGenreList().forEach(g => add(g.name, g.nsfw));
  BATCAVE_GENRES.forEach(name => add(name, NSFW_BATCAVE_GENRES.has(name)));
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function applyMergedGenreGrid() {
  const grid = $('genreGrid');
  if (!grid) return;
  // Guard against wiping out checkboxes the user already ticked, same
  // reasoning as applyGenreGridForSource (called on every search, not
  // just when the toggle is first switched on).
  if (_genreGridSource === 'merged') return;
  grid.innerHTML = buildMergedGenreList().map(g => {
    const nsfwAttr = g.nsfw ? ' data-nsfw="1"' : '';
    return `<label class="genre-check"${nsfwAttr}><input type="checkbox" value="${escapeHtml(g.name)}"><span>${escapeHtml(g.name)}</span></label>`;
  }).join('');
  _genreGridSource = 'merged';
}

// "Search all sources" doesn't have one real source to gate filter
// visibility by (updateAdvancedSearchFilterVisibility normally hides
// controls a single selected source doesn't support) — every control
// should stay available since different sources in the batch support
// different things.
function showAllAdvancedFilterControls() {
  ['advancedOrderBy', 'advancedFormat', 'advancedPublicationStatus'].forEach(id => {
    const group = $(id)?.closest('.filter-group');
    if (group) group.style.display = '';
  });
  const contentRatingGroup = $('advancedContentRatingGroup');
  if (contentRatingGroup) contentRatingGroup.style.display = state.settings.hideNsfw ? 'none' : '';
  const genreGroup = $('genreFilterGroup');
  if (genreGroup) genreGroup.style.display = '';
}

// The values here are the only ones batcave.js actually has real data for
// (see search() there) — BatCave's own site-native sort widget doesn't
// work, so the other generic options (Title, Year, Most Follows...) would
// just silently do nothing if left in the dropdown for this source.
const BATCAVE_ORDER_BY_OPTIONS = [
  { value: 'relevance', label: 'Best Match' },
  { value: 'latestUploadedChapter', label: 'Latest Upload' },
  { value: 'rating', label: 'Highest Rating' },
];

// WeebCentral genuinely supports server-side sorting (see data/sources/
// weebcentral.js's mapOrderBy) for exactly these values — Year Asc/Desc has
// no analogue on that site, so it's left out rather than silently no-op'ing.
const WEEBCENTRAL_ORDER_BY_OPTIONS = [
  { value: 'relevance', label: 'Best Match' },
  { value: 'latestUploadedChapter', label: 'Latest Updates' },
  { value: 'createdAt', label: 'Recently Added' },
  { value: 'followedCount', label: 'Most Subscribers' },
  { value: 'rating', label: 'Most Popular' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: '-title', label: 'Title (Z-A)' },
];

const CUSTOM_ORDER_BY_OPTIONS = {
  batcave: BATCAVE_ORDER_BY_OPTIONS,
  weebcentral: WEEBCENTRAL_ORDER_BY_OPTIONS,
};

let _defaultOrderByHtml = null;
let _orderBySource = null; // which option list is currently rendered: a key of CUSTOM_ORDER_BY_OPTIONS, or 'default'

function applyOrderByOptionsForSource(sourceId) {
  const select = $('advancedOrderBy');
  if (!select) return;

  if (_defaultOrderByHtml === null) {
    _defaultOrderByHtml = select.innerHTML;
    _orderBySource = 'default';
  }

  // Same reasoning as applyGenreGridForSource: this runs on every search,
  // not just on source change, so skip the rebuild once the right list is
  // already showing or it would reset whatever the user just picked.
  const targetSource = CUSTOM_ORDER_BY_OPTIONS[sourceId] ? sourceId : 'default';
  if (_orderBySource === targetSource) return;

  select.innerHTML = CUSTOM_ORDER_BY_OPTIONS[targetSource]
    ? CUSTOM_ORDER_BY_OPTIONS[targetSource].map(o => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('')
    : _defaultOrderByHtml;
  _orderBySource = targetSource;
}

function getAdvancedSourceCapabilities(sourceId) {
  return { ...ADV_SOURCE_CAPABILITIES.default, ...(ADV_SOURCE_CAPABILITIES[sourceId] || {}) };
}

function updateAdvancedSearchFilterVisibility(sourceId = state.currentSourceId) {
  const caps = getAdvancedSourceCapabilities(sourceId);
  applyGenreGridForSource(sourceId);
  applyOrderByOptionsForSource(sourceId);

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
  const blacklist = state.settings.genreBlacklist || [];
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

  document.querySelectorAll('#genreGrid .genre-check').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"]');
    const isNsfw = label.dataset.nsfw === "1";
    const val = (cb?.value || "").toLowerCase();
    const isBlacklisted = blacklist.includes(val);

    const shouldHide = (hideNsfw && isNsfw) || isBlacklisted;
    label.style.display = shouldHide ? "none" : "";

    if (shouldHide && cb?.checked) {
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

  const blacklist = state.settings.genreBlacklist || [];
  if (blacklist.length > 0) {
    out = out.filter(m => {
      if (!Array.isArray(m.genres)) return true;
      const lowerGenres = m.genres.map(g => typeof g === 'string' ? g.toLowerCase() : '');
      return !lowerGenres.some(g => blacklist.includes(g));
    });
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
  const advAllToggle = $("advancedSearchAllSourcesToggle");
  if (advAllToggle && advAllToggle.checked) {
    // Don't gate filter visibility/genre taxonomy by whichever single
    // source happens to be parked in the (now disabled) source dropdown —
    // show every control and the merged genre list instead.
    applyMergedGenreGrid();
    showAllAdvancedFilterControls();
    applyAdvancedSearchNsfwVisibility();
    return advancedSearchAllSources();
  }

  updateAdvancedSearchFilterVisibility(state.currentSourceId);
  $("advancedResults")?.classList.remove("grouped-by-source");

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
    const installed = getSelectableSourceIds();
    const fallback = (sel && installed.includes(sel.value)) ? sel.value : installed[0];
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
      const rawResults = result.results || [];
      const normalizedResults = typeof normalizeSourceSearchResult === 'function' ? rawResults.map(m => normalizeSourceSearchResult(m, state.currentSourceId)).filter(Boolean) : rawResults;
      const results = await _filterMangaWithoutChapters(normalizedResults, state.currentSourceId);
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
      $("advancedSearchStatus").textContent = formatPageStatus(results.length, page, result.totalPages);
      renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
    } catch (e) {
      $("advancedSearchStatus").textContent = "Could not search manga.";
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
    // Each iteration below can take several seconds (cover enrichment against
    // ComicVine/LOCG runs server-side per item) — without this, the status
    // text sits frozen on "Searching..." for that whole time and looks stuck.
    $("advancedSearchStatus").textContent = `A procurar resultados... (${acc.results.length}/${target})`;
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
      const rawResults = result.results || [];
      const normalizedResults = typeof normalizeSourceSearchResult === 'function' ? rawResults.map(m => normalizeSourceSearchResult(m, state.currentSourceId)).filter(Boolean) : rawResults;
      const filteredBatch = _applyAdvFilters(normalizedResults, query, selectedGenres, publicationStatus, contentRating, format);
      const batch = await _filterMangaWithoutChapters(filteredBatch, state.currentSourceId);
      acc.results.push(...batch);
    } catch (e) {
      fetchError = e;
      break;
    }
  }

  if (fetchError && acc.results.length === 0) {
    $("advancedSearchStatus").textContent = "Could not search manga.";
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

// Same "Search all sources" idea as the home search (see searchAllSources()
// in ui-search.js), adapted for Advanced Search's filters. Scoped down the
// same way: only the first native page per source (capped at
// ADV_ALL_SOURCES_PER_SOURCE_LIMIT results), not the multi-page "fill-up"
// accumulation advancedSearch() does for a single source — running that
// fill-up loop (up to ADV_MAX_API_PAGES native calls) across every source
// at once would be far too slow/heavy. Non-genre filters (sort, status,
// format) are sent as-is to every source — a source that doesn't support
// one already ignores it server-side (see ADV_SOURCE_CAPABILITIES).
// Genres are the one filter that isn't just "supported or not": the
// merged grid (see buildMergedGenreList) mixes two real taxonomies, so
// each source only gets sent the genres that actually exist in its own
// list (see getSourceGenreTaxonomy) — sources with none of the selected
// genres are skipped outright rather than queried with a wrong filter.
const ADV_ALL_SOURCES_PER_SOURCE_LIMIT = 20;
const ADV_ALL_SOURCES_CONCURRENCY = 3;

async function advancedSearchAllSources() {
  const resultsDiv = $("advancedResults");
  const pg = $("advancedSearchPagination");
  if (pg) pg.innerHTML = "";
  if (!resultsDiv) return;

  const sources = getSelectableSources();
  if (!sources.length) {
    $("advancedSearchStatus").textContent = "No installed sources to search.";
    resultsDiv.classList.remove("grouped-by-source");
    resultsDiv.innerHTML = "";
    return;
  }

  const query = $("advancedSearchInput").value.trim();
  const orderBy = $("advancedOrderBy")?.value || "relevance";
  const publicationStatus = $("advancedPublicationStatus")?.value || "";
  const contentRating = state.settings.hideNsfw ? "" : ($("advancedContentRating")?.value || "");
  const format = $("advancedFormat")?.value || "";
  let selectedGenres = Array.from(document.querySelectorAll('#genreGrid input[type="checkbox"]:checked')).map(cb => cb.value);
  if (state.settings.hideNsfw) selectedGenres = selectedGenres.filter(g => !isNsfwTag(g));
  const needsClientFilter = !!(publicationStatus || contentRating || format || selectedGenres.length > 0);

  state.advSearchPage = 1;
  state._advAcc = null; // all-sources mode doesn't use the single-source fill-up accumulator
  $("advancedSearchStatus").textContent = `Searching ${sources.length} source(s)...`;

  resultsDiv.classList.add("grouped-by-source");
  resultsDiv.innerHTML = sources.map(s => `
    <div class="search-source-group" data-source-id="${escapeHtml(s.id)}">
      <div class="search-source-group-header">
        <span class="search-source-group-name">${escapeHtml(s.name)}</span>
        <span class="search-source-group-status">Searching…</span>
      </div>
      <div class="search-source-group-grid"></div>
    </div>
  `).join("");

  let totalResults = 0;
  let doneCount = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor++];
      const groupEl = resultsDiv.querySelector(`.search-source-group[data-source-id="${source.id}"]`);
      const statusEl = groupEl?.querySelector(".search-source-group-status");
      const gridEl = groupEl?.querySelector(".search-source-group-grid");

      // The merged genre grid mixes two taxonomies (default manga genres +
      // BatCave's own comic genres) — only pass a source the genres that
      // actually exist in ITS taxonomy, so e.g. picking "Superhero" doesn't
      // get sent to MangaDex, which has no idea what that is.
      const sourceTaxonomy = selectedGenres.length ? new Set(getSourceGenreTaxonomy(source.id).map(g => g.toLowerCase())) : null;
      const sourceGenres = sourceTaxonomy ? selectedGenres.filter(g => sourceTaxonomy.has(g.toLowerCase())) : [];
      const genreMismatch = selectedGenres.length > 0 && sourceGenres.length === 0;

      if (genreMismatch) {
        if (statusEl) statusEl.textContent = "No matching genres";
        if (groupEl) groupEl.style.display = "none";
        doneCount++;
        $("advancedSearchStatus").textContent = doneCount < sources.length
          ? `Searching... (${doneCount}/${sources.length} sources done, ${totalResults} result(s) so far)`
          : `${totalResults} result(s) found across ${sources.length} source(s)`;
        continue;
      }

      try {
        let result;
        if (sourceGenres.length > 0) {
          result = await api(`/api/source/${source.id}/byGenres`, {
            method: "POST",
            body: JSON.stringify({ genres: sourceGenres, page: 1, orderBy, publicationStatus, contentRating, format })
          });
        } else {
          result = await api(`/api/source/${source.id}/search`, {
            method: "POST",
            body: JSON.stringify({ query: query || "", page: 1, orderBy, publicationStatus, contentRating, format })
          });
        }
        const rawResults = result.results || [];
        let normalizedResults = rawResults.map(m => normalizeSourceSearchResult(m, source.id)).filter(Boolean);
        if (needsClientFilter) {
          normalizedResults = _applyAdvFilters(normalizedResults, query, sourceGenres, publicationStatus, contentRating, format);
        }
        const filtered = (await _filterMangaWithoutChapters(normalizedResults, source.id)).slice(0, ADV_ALL_SOURCES_PER_SOURCE_LIMIT);

        totalResults += filtered.length;
        if (statusEl) statusEl.textContent = filtered.length ? `${filtered.length} result(s)` : "No results";
        if (filtered.length && gridEl) {
          renderMangaGrid(gridEl, filtered);
        } else if (groupEl) {
          groupEl.style.display = "none";
        }
      } catch (e) {
        if (statusEl) statusEl.textContent = "Unavailable";
        if (groupEl) groupEl.style.display = "none";
      }

      doneCount++;
      $("advancedSearchStatus").textContent = doneCount < sources.length
        ? `Searching... (${doneCount}/${sources.length} sources done, ${totalResults} result(s) so far)`
        : `${totalResults} result(s) found across ${sources.length} source(s)`;
    }
  }

  await Promise.all(Array.from({ length: Math.min(ADV_ALL_SOURCES_CONCURRENCY, sources.length) }, worker));
}

async function randomManga(options = {}) {
  const sourceIds = getSelectableSourceIds().filter(id => id !== 'local');
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
    if (statusEl) statusEl.textContent = "Could not load manga details.";
  }
}

function closeRandomPickerDrawer() {
  document.getElementById('randomPickerBackdrop')?.remove();
  document.getElementById('randomPickerDrawer')?.remove();
}

function openRandomPickerDrawer() {
  closeRandomPickerDrawer();

  const sourceIds = getSelectableSourceIds().filter(id => id !== 'local');
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

