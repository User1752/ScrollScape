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
    const rawResults = result.results || [];
    const results = rawResults.filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
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

    // Tracker button
    $("trackerBtn").onclick = () => showTrackerModal(result);

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

