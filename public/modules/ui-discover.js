// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

const _genreHydrationCache = new Map();
const _genreHydrationRequestQueue = [];
const _genreHydrationInFlight = new Map();
let _genreHydrationActive = 0;
const GENRE_HYDRATION_MAX_CONCURRENT = 2;
const _homeRowRequestSeq = {
  popularToday: 0,
  recentlyAdded: 0,
  latestUpdates: 0,
};

const HOME_SOURCE_TIMEOUT_MS = 3500;

function _homeRequestTimeout() {
  return new Promise(resolve => setTimeout(() => resolve(null), HOME_SOURCE_TIMEOUT_MS));
}

function _pumpGenreHydrationQueue() {
  while (_genreHydrationActive < GENRE_HYDRATION_MAX_CONCURRENT && _genreHydrationRequestQueue.length > 0) {
    const task = _genreHydrationRequestQueue.shift();
    _genreHydrationActive++;
    Promise.resolve()
      .then(task)
      .finally(() => {
        _genreHydrationActive = Math.max(0, _genreHydrationActive - 1);
        _pumpGenreHydrationQueue();
      });
  }
}

function _queueMangaDetailsFetch(sourceId, mangaId) {
  const key = `${sourceId}:${mangaId}`;
  if (_genreHydrationInFlight.has(key)) return _genreHydrationInFlight.get(key);

  const p = new Promise((resolve) => {
    _genreHydrationRequestQueue.push(async () => {
      try {
        const details = await api(`/api/source/${sourceId}/mangaDetails`, {
          method: 'POST',
          body: JSON.stringify({ mangaId })
        });
        resolve(details);
      } catch (_) {
        resolve(null);
      } finally {
        _genreHydrationInFlight.delete(key);
      }
    });
    _pumpGenreHydrationQueue();
  });

  _genreHydrationInFlight.set(key, p);
  return p;
}

function _normalizeGenres(raw, max = 3) {
  if (Array.isArray(raw)) {
    return raw
      .map(g => String(g || '').trim())
      .filter(Boolean)
      .slice(0, max);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[|,\/]/)
      .map(g => g.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

function _extractGenresFromDetails(details, max = 3) {
  const candidates = [
    details?.genres,
    details?.genre,
    details?.tags,
    details?.tag,
    details?.categories,
  ];
  for (const c of candidates) {
    const parsed = _normalizeGenres(c, max);
    if (parsed.length) return parsed;
  }
  return [];
}

async function _hydrateMissingGenres(container) {
  if (!container) return;
  const cards = [...container.querySelectorAll('.manga-card')];
  if (!cards.length) return;

  const targets = cards.filter(card => {
    const box = card.querySelector('.manga-card-genres[data-missing-genres="1"]');
    if (!box) return false;
    const mangaId = card.dataset.mangaId || '';
    const sourceId = card.dataset.sourceId || state.currentSourceId || '';
    return !!(mangaId && sourceId);
  });
  if (!targets.length) return;

  let cursor = 0;
  // Keep hydration gentle: some sources (e.g. KingOfShojo) throttle bursts.
  const workers = Math.min(2, targets.length);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchGenresForCard(sourceId, mangaId) {
    const details = await _queueMangaDetailsFetch(sourceId, mangaId);
    return _extractGenresFromDetails(details, 3);
  }

  async function worker() {
    while (cursor < targets.length) {
      const idx = cursor++;
      const card = targets[idx];
      const mangaId = card.dataset.mangaId || '';
      const sourceId = card.dataset.sourceId || state.currentSourceId || '';
      const key = `${sourceId}:${mangaId}`;
      const box = card.querySelector('.manga-card-genres[data-missing-genres="1"]');
      if (!box) continue;

      try {
        let genres = _genreHydrationCache.get(key);
        if (!genres || genres.length === 0) {
          genres = await fetchGenresForCard(sourceId, mangaId);
          if (!genres.length) {
            // One quick retry helps when the source temporarily rate-limits.
            await sleep(180);
            genres = await fetchGenresForCard(sourceId, mangaId);
          }

          // Cache only successful non-empty hydration so transient failures can retry.
          if (genres.length > 0) {
            _genreHydrationCache.set(key, genres);
          } else {
            _genreHydrationCache.delete(key);
          }
        }

        if (genres.length > 0) {
          box.removeAttribute('data-missing-genres');
          box.innerHTML = genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join('');
        }

        await sleep(120);
      } catch (_) {
        _genreHydrationCache.delete(key);
        // Keep fallback label when detail lookup fails.
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
}

function genreBadgesHTML(rawGenres, max = 3, fallbackTag = '', sourceId = '') {
  const genres = _normalizeGenres(rawGenres, max);
  const sid = String(sourceId || '').toLowerCase();

  // For KingOfShojo, card/list pages often only provide a generic type badge
  // (e.g. "Manhwa"). Keep showing it, but still mark for async hydration.
  const isGenericSingle = genres.length === 1 && ['manhwa', 'manhua', 'manga', 'webtoon'].includes(String(genres[0]).toLowerCase());
  const shouldHydrate = !genres.length || (sid === 'kingofshojo' && isGenericSingle);

  if (shouldHydrate) {
    const tag = fallbackTag || genres[0] || '';
    if (!tag) {
      return `<div class="manga-card-genres" data-missing-genres="1"></div>`;
    }
    return `<div class="manga-card-genres" data-missing-genres="1"><span class="manga-card-genre">${escapeHtml(tag)}</span></div>`;
  }

  return `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>`;
}

function _getHomeSourceIds() {
  const installedIds = Object.keys(state.installedSources || {});
  if (!installedIds.length) return [];

  if (state.settings.homeSourceMode !== 'selected') return installedIds;

  const selected = Array.isArray(state.settings.homeSelectedSourceIds)
    ? state.settings.homeSelectedSourceIds.filter(id => installedIds.includes(id))
    : [];

  return selected.length ? selected : installedIds;
}

function _sourceSupportsMethod(sourceId, method) {
  const caps = state.installedSources?.[sourceId]?.capabilities;
  if (!caps || typeof caps !== 'object') {
    if (method === 'recentlyAdded' && sourceId === 'allmanga') return false;
    return true;
  }
  if (!(method in caps)) return true;
  return caps[method] !== false;
}

function applyHomeSearchVisibility() {
  const section = $("homeSearchSection") || document.querySelector('#view-discover .search-section');
  if (!section) return;
  section.style.display = state.settings.showHomeSearch === false ? 'none' : '';
}

async function _loadMultiSourceHomeList(method, perSourceLimit = 7, totalLimit = 24) {
  const sourceIds = _getHomeSourceIds().filter(sid => _sourceSupportsMethod(sid, method));
  if (!sourceIds.length) return [];

  const settled = await Promise.allSettled(sourceIds.map(async (sid) => {
    try {
      const result = await Promise.race([
        api(`/api/source/${sid}/${method}`, {
        method: "POST",
        body: JSON.stringify({})
        }),
        _homeRequestTimeout(),
      ]);
      if (!result) return [];
      const blacklist = state.settings.genreBlacklist || [];
      return (result.results || [])
        .filter(m => {
          if (state.settings.hideNsfw && isNsfwManga(m)) return false;
          if (blacklist.length > 0 && Array.isArray(m.genres)) {
            const lowerGenres = m.genres.map(g => typeof g === 'string' ? g.toLowerCase() : '');
            if (lowerGenres.some(g => blacklist.includes(g))) return false;
          }
          return true;
        })
        .slice(0, perSourceLimit)
        .map(m => ({
          ...m,
          sourceId: sid,
          sourceName: state.installedSources?.[sid]?.name || sid,
        }));
    } catch (_) {
      return [];
    }
  }));

  const buckets = settled
    .filter(s => s.status === 'fulfilled')
    .map(s => s.value);

  const seen = new Set();
  const merged = [];
  const maxLen = Math.max(...buckets.map(b => b.length), 0);

  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i >= bucket.length) continue;
      const key = String(bucket[i].title || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(bucket[i]);
      if (merged.length >= totalLimit) return merged;
    }
  }

  return merged;
}

window.loadPopularToday = async function loadPopularToday() {
  const reqSeq = ++_homeRowRequestSeq.popularToday;
  const row = $("popularRow");
  if (!row) return;
  const section = row.closest('.popular-section');
  const enabledSourceIds = _getHomeSourceIds().filter(sid => _sourceSupportsMethod(sid, 'trending'));
  if (!enabledSourceIds.length) {
    if (section) section.style.display = 'none';
    row.innerHTML = '';
    return;
  }
  if (section) section.style.display = '';
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const list = await _loadMultiSourceHomeList('trending', 26, 28);
    if (reqSeq !== _homeRowRequestSeq.popularToday) return;

    if (!list.length) {
      if (section) section.style.display = 'none';
      row.innerHTML = '';
      return;
    }
    if (section) section.style.display = '';
    row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    _hydrateMissingGenres(row);
    initRowAutoScroll(row);
  } catch (e) {
    if (reqSeq !== _homeRowRequestSeq.popularToday) return;
    dbg.error(dbg.ERR_SOURCE, 'Error loading popular manga', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

window.loadRecentlyAdded = async function loadRecentlyAdded() {
  const reqSeq = ++_homeRowRequestSeq.recentlyAdded;
  const row = $("recentlyAddedRow");
  if (!row) return;
  const section = row.closest('.recent-section');
  const enabledSourceIds = _getHomeSourceIds().filter(sid => _sourceSupportsMethod(sid, 'recentlyAdded'));
  if (!enabledSourceIds.length) {
    if (section) section.style.display = 'none';
    row.innerHTML = '';
    return;
  }
  if (section) section.style.display = '';
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const list = await _loadMultiSourceHomeList('recentlyAdded', 26, 40);
    if (reqSeq !== _homeRowRequestSeq.recentlyAdded) return;
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    _hydrateMissingGenres(row);
    initRowAutoScroll(row);
  } catch (e) {
    if (reqSeq !== _homeRowRequestSeq.recentlyAdded) return;
    dbg.error(dbg.ERR_SOURCE, 'Error loading recently added', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

window.loadLatestUpdates = async function loadLatestUpdates() {
  const reqSeq = ++_homeRowRequestSeq.latestUpdates;
  const row = $("latestUpdatesRow");
  if (!row) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const list = await _loadMultiSourceHomeList('latestUpdates', 26, 28);
    if (reqSeq !== _homeRowRequestSeq.latestUpdates) return;
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    _hydrateMissingGenres(row);
    initRowAutoScroll(row);
  } catch (e) {
    if (reqSeq !== _homeRowRequestSeq.latestUpdates) return;
    dbg.error(dbg.ERR_SOURCE, 'Error loading latest updates', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

function mangaCardHTML(m) {
  const resolvedSourceId = m.sourceId || state.currentSourceId || "";
  const fallbackTag = resolvedSourceId === 'kingofshojo' ? 'Manhwa' : '';
  const sourceAttr = resolvedSourceId ? ` data-source-id="${escapeHtml(resolvedSourceId)}"` : "";
  const sourceLabel = m.sourceName || (resolvedSourceId ? (state.installedSources?.[resolvedSourceId]?.name || resolvedSourceId) : "");
  const coverUrl = normalizeImageUrl(m.cover);
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
      <div class="manga-card-cover">
        ${coverUrl && !coverUrl.endsWith('.pdf')
          ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          : (m.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
        ${sourceLabel ? `<span class="all-pop-source-badge">${escapeHtml(sourceLabel)}</span>` : ""}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        ${genreBadgesHTML(m.genres, 3, fallbackTag, resolvedSourceId)}
        <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}', '${escapeHtml(resolvedSourceId)}')">▶ Start Reading</button>
      </div>
    </div>
  `;
}

async function startReading(mangaId, sourceId = "") {
  if (sourceId && state.installedSources[sourceId] && sourceId !== state.currentSourceId) {
    state.currentSourceId = sourceId;
    renderSourceSelect();
  }
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
    state.chapterCountCache[mangaId] = state.allChapters.length;
    saveSettings();
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

