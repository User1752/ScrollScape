// ============================================================================
// LIBRARY RENDERING
// ============================================================================

const LIBRARY_SORT_MODES = [
  { key: "added",     label: "Added"     },
  { key: "az",        label: "A \u2192 Z" },
  { key: "za",        label: "Z \u2192 A" },
  { key: "rating",    label: "Rating"    },
  { key: "ongoing",   label: "Ongoing"   },
  { key: "completed", label: "Completed" },
  { key: "source",    label: "Source"    },
];
let _libSortMode = "added";
let _librarySelectedKeys = new Set(); // key = "mangaId::sourceId"

function _libSourceId(sourceId) {
  return String(sourceId || '');
}

function _libMangaKey(mangaId, sourceId) {
  return `${String(mangaId)}::${_libSourceId(sourceId)}`;
}

function _libStoreKeyPart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_');
}

function _libStatusKey(mangaId, sourceId) {
  return `${_libStoreKeyPart(mangaId)}:${_libStoreKeyPart(sourceId || 'unknown')}`;
}

function _libRatingKey(mangaId) {
  return _libStoreKeyPart(mangaId);
}

function _syncLibrarySelectionWithFavorites() {
  const valid = new Set((state.favorites || []).map(m => _libMangaKey(m.id, m.sourceId)));
  _librarySelectedKeys = new Set([..._librarySelectedKeys].filter(k => valid.has(k)));
}

function _setLibraryCardSelection(card, selected) {
  if (!card) return;
  card.classList.toggle('library-card-selected', !!selected);
}

function _toggleLibraryCardSelection(card) {
  if (!card) return false;
  const key = _libMangaKey(card.dataset.mangaId, card.dataset.sourceId);
  if (_librarySelectedKeys.has(key)) {
    _librarySelectedKeys.delete(key);
    _setLibraryCardSelection(card, false);
    return false;
  }
  _librarySelectedKeys.add(key);
  _setLibraryCardSelection(card, true);
  return true;
}

function _clearLibrarySelection(grid) {
  _librarySelectedKeys.clear();
  const root = grid || document;
  root.querySelectorAll?.('.library-card.library-card-selected').forEach(card => {
    card.classList.remove('library-card-selected');
  });
}

function _getLibraryActionTargets(clickedManga) {
  const clickedKey = _libMangaKey(clickedManga?.id, clickedManga?.sourceId);
  if (_librarySelectedKeys.size > 1 && _librarySelectedKeys.has(clickedKey)) {
    const selected = (state.favorites || []).filter(m => _librarySelectedKeys.has(_libMangaKey(m.id, m.sourceId)));
    if (selected.length) return selected;
  }
  return clickedManga ? [clickedManga] : [];
}

function _updateLibrarySortLabel() {
  const labelEl = $("libSortLabel");
  if (!labelEl) return;
  const mode = LIBRARY_SORT_MODES.find(m => m.key === _libSortMode);
  labelEl.textContent = mode?.label || 'Sort';
}

function setLibrarySortMode(modeKey) {
  if (!LIBRARY_SORT_MODES.some(m => m.key === modeKey)) return;
  _libSortMode = modeKey;
  _updateLibrarySortLabel();
  renderLibrary();
}

function closeLibrarySortDrawer() {
  document.getElementById('librarySortBackdrop')?.remove();
  document.getElementById('librarySortDrawer')?.remove();
}

function openLibrarySortDrawer() {
  closeLibrarySortDrawer();

  const options = LIBRARY_SORT_MODES.map(m => `
    <button type="button" class="library-sort-option${m.key === _libSortMode ? ' active' : ''}" data-sort-key="${escapeHtml(m.key)}">
      <span>${escapeHtml(m.label)}</span>
      ${m.key === _libSortMode ? '<span class="library-sort-check">\u2713</span>' : ''}
    </button>`).join('');

  const backdrop = document.createElement('div');
  backdrop.id = 'librarySortBackdrop';
  backdrop.className = 'library-sort-backdrop';

  const drawer = document.createElement('div');
  drawer.id = 'librarySortDrawer';
  drawer.className = 'library-sort-drawer';
  drawer.innerHTML = `
    <div class="library-sort-head">
      <h3>Sort Library</h3>
      <button class="btn secondary" id="librarySortClose">\u2715</button>
    </div>
    <div class="library-sort-body">
      <div class="library-sort-options">${options}</div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  backdrop.onclick = closeLibrarySortDrawer;
  drawer.querySelector('#librarySortClose').onclick = closeLibrarySortDrawer;
  drawer.querySelectorAll('.library-sort-option').forEach(btn => {
    btn.onclick = () => {
      setLibrarySortMode(btn.dataset.sortKey || 'added');
      closeLibrarySortDrawer();
    };
  });
}

function _sortLibrary(favs) {
  const STATUS_ORDER = { reading: 0, plan_to_read: 1, on_hold: 2, completed: 3, dropped: 4 };
  const title  = m => String(m.title || '').toLowerCase();
  const rating = m => state.ratings[_libRatingKey(m.id)] || 0;
  const status = m => state.readingStatus[_libStatusKey(m.id, m.sourceId)]?.status || '';
  const source = m => String(m.sourceId || '').toLowerCase();
  switch (_libSortMode) {
    case "az":        return [...favs].sort((a, b) => title(a).localeCompare(title(b)));
    case "za":        return [...favs].sort((a, b) => title(b).localeCompare(title(a)));
    case "rating":    return [...favs].sort((a, b) => rating(b) - rating(a));
    case "ongoing":   return [...favs].sort((a, b) => (status(a) === 'reading' ? -1 : 1) - (status(b) === 'reading' ? -1 : 1));
    case "completed": return [...favs].sort((a, b) => (status(a) === 'completed' ? -1 : 1) - (status(b) === 'completed' ? -1 : 1));
    case "source":    return [...favs].sort((a, b) => source(a).localeCompare(source(b)) || title(a).localeCompare(title(b)));
    default:          return favs; // "added" — keep insertion order
  }
}

function cycleLibrarySort() {
  const idx = LIBRARY_SORT_MODES.findIndex(m => m.key === _libSortMode);
  setLibrarySortMode(LIBRARY_SORT_MODES[(idx + 1) % LIBRARY_SORT_MODES.length].key);
}

function renderLibrary() {
  const grid = $("library"); // Fixed: was "library-grid", correct ID is "library"
  if (!grid) return;

  _syncLibrarySelectionWithFavorites();

  _updateLibrarySortLabel();

  const sourceNameFor = (sourceId) => {
    const sid = sourceId || '';
    if (!sid) return 'No source';
    if (sid === 'anilist') return 'AniList';
    if (sid === 'local') return 'Local';
    return state.installedSources[sid]?.name || sid;
  };

  const filterVal    = $("libraryStatusFilter")?.value   || "all";
  const categoryFilter = $("libraryCategoryFilter")?.value || "all";
  const searchQuery  = ($("librarySearchInput")?.value || "").trim().toLowerCase();

  // Build a reverse-index: mangaId -> [listId, ...]
  const mangaCategories = {};
  for (const list of (state.customLists || [])) {
    for (const item of (list.mangaItems || [])) {
      if (!item.id) continue;
      const key = `${item.id}:${item.sourceId || ''}`;
      if (!mangaCategories[key]) mangaCategories[key] = [];
      mangaCategories[key].push(list.id);
    }
  }

  let favs = state.favorites.filter(manga => {
    if (filterVal !== "all") {
      const key    = _libStatusKey(manga.id, manga.sourceId);
      const status = state.readingStatus[key]?.status;
      if (status !== filterVal) return false;
    }
    if (categoryFilter !== "all") {
      const primaryKey = `${manga.id}:${manga.sourceId || ''}`;
      const legacyKey  = `${manga.id}:`;
      const cats = Array.from(new Set([
        ...(mangaCategories[primaryKey] || []),
        ...(mangaCategories[legacyKey] || []),
      ]));
      if (!cats.includes(categoryFilter)) return false;
    }
    if (searchQuery && !String(manga.title || '').toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // Apply sort
  favs = _sortLibrary(favs);

  const filteredLocalManga = state.localManga.filter(manga => {
    if (searchQuery && !String(manga.title || '').toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  const totalCount = favs.length + (filterVal === "all" && categoryFilter === "all" ? filteredLocalManga.length : 0);
  if ($("libraryCount")) {
    $("libraryCount").textContent = `${totalCount} manga`;
  }

  // Populate category filter dropdown
  const catSelect = $("libraryCategoryFilter");
  if (catSelect) {
    const prev = catSelect.value;
    catSelect.innerHTML = `<option value="all">All Categories</option>` +
      (state.customLists || []).map(l =>
        `<option value="${escapeHtml(l.id)}" ${prev === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
      ).join('');
    if (prev && prev !== 'all') catSelect.value = prev;
  }

  const favHTML = favs.map(manga => {
    const key    = _libStatusKey(manga.id, manga.sourceId);
    const status = state.readingStatus[key]?.status;
    const statusBadge = status
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    const currentRating = state.ratings[_libRatingKey(manga.id)] || 0;
    const lastChapterId = state.lastReadChapter?.[manga.id];
    const btnLabel = lastChapterId ? "Continue Reading" : "Start Reading";
    const sourceLabel = state.settings.showLibrarySourceBadge !== false
      ? `<span class="library-source-badge">${escapeHtml(sourceNameFor(manga.sourceId))}</span>`
      : '';

    // Category chips
    const primaryKey = `${manga.id}:${manga.sourceId || ''}`;
    const legacyKey  = `${manga.id}:`;
    const catIds = Array.from(new Set([
      ...(mangaCategories[primaryKey] || []),
      ...(mangaCategories[legacyKey] || []),
    ]));
    const catChips = catIds.length
      ? catIds.map(id => {
          const list = (state.customLists || []).find(l => l.id === id);
          return list ? `<span class="category-chip">${escapeHtml(list.name)}</span>` : '';
        }).join('')
      : '';

    const isSelected = _librarySelectedKeys.has(_libMangaKey(manga.id, manga.sourceId));

    return `
      <div class="library-card${isSelected ? ' library-card-selected' : ''}" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || '')}" data-title="${escapeHtml(manga.title || '')}">
        <div class="library-card-cover">
          ${manga.cover && !manga.cover.endsWith('.pdf') ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">` : (manga.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
          ${statusBadge}
          ${sourceLabel}
          <div class="library-card-overlay">
            <button class="btn-read">${btnLabel}</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${status ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : ""}
          ${catChips ? `<div class="category-chips">${catChips}</div>` : ''}
          ${currentRating ? `<span class="card-score-badge">${currentRating}<span class="card-score-badge-max">/10</span></span>` : ""}
        </div>
      </div>`;
  }).join("");

  // Local manga section
  const localHTML = (filterVal === "all" && categoryFilter === "all" && filteredLocalManga.length > 0)
    ? `<div class="local-section-header">&#128193; Local Manga</div>` +
      filteredLocalManga.map(manga => {
        const localRating = state.ratings[_libRatingKey(manga.id)] || 0;
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
    const cardTitle = card.dataset.title || '';

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const manga = state.favorites.find(m => m.id === mangaId && (m.sourceId === sourceId || !sourceId));
      if (manga) {
        const targets = _getLibraryActionTargets(manga);
        showLibraryContextMenu(e, manga, mangaCategories, targets);
      }
    });

    card.onclick = async (e) => {
      // Don't navigate if the click was on or inside the context menu
      if (e.target.closest('#libraryContextMenu')) return;

      // Ctrl + left-click: toggle multi-selection for bulk actions
      if (e.ctrlKey && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        _toggleLibraryCardSelection(card);
        return;
      }

      // Normal click clears multi-selection and keeps default navigation behavior
      if (_librarySelectedKeys.size) {
        _clearLibrarySelection(grid);
      }

      const prevSource = state.currentSourceId;
      const fav = (state.favorites || []).find(m => String(m.id) === String(mangaId) && String(m.title || '') === String(cardTitle || m.title || ''));
      const resolvedSourceId = sourceId || fav?.sourceId || '';

      if (resolvedSourceId && resolvedSourceId !== state.currentSourceId) {
        state.currentSourceId = resolvedSourceId;
        renderSourceSelect();
        const srcName = state.installedSources[resolvedSourceId]?.name || resolvedSourceId;
        showToast("Source switched", srcName, "info");
      }

      // "Continue Reading" overlay button — jump directly to last chapter + page
      if (e.target.closest(".btn-read") && state.lastReadChapter?.[mangaId]) {
        const lastChapterId = state.lastReadChapter[mangaId];
        const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
        try {
          showToast("Resuming...", "", "info");
          // Load manga details silently so state.currentManga is populated
          const sourceForOpen = resolvedSourceId || state.currentSourceId;
          const result = await api(`/api/source/${sourceForOpen}/mangaDetails`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.currentManga = result;
          // Load chapters so state.allChapters is populated
          const cr = await api(`/api/source/${sourceForOpen}/chapters`, {
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
            await loadMangaDetails(mangaId, "library", cardTitle, false, sourceForOpen);
          }
        } catch (err) {
          showToast("Error", err.message, "error");
        }
        return;
      }

      await loadMangaDetails(mangaId, "library", cardTitle, false, resolvedSourceId || state.currentSourceId);
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

// ── Library right-click context menu ─────────────────────────────────────────

function _closeLibraryContextMenu() {
  document.getElementById('libraryContextMenu')?.remove();
  document.removeEventListener('click', _ctxDocClickHandler, true);
  document.removeEventListener('keydown', _ctxMenuKeyHandler);
}

function _ctxMenuKeyHandler(e) {
  if (e.key === 'Escape') _closeLibraryContextMenu();
}

function _ctxDocClickHandler(e) {
  if (e?.target?.closest && e.target.closest('#libraryContextMenu')) return;
  _closeLibraryContextMenu();
}

async function showLibraryContextMenu(e, manga, mangaCategories) {
  _closeLibraryContextMenu();

  const actionMangas = _getLibraryActionTargets(manga);
  const isBulk = actionMangas.length > 1;
  const bulkPrefix = isBulk ? `Selected (${actionMangas.length})` : 'Current';

  const sourceId = manga.sourceId
    || state.currentSourceId
    || (state.favorites || []).find(f => String(f.id) === String(manga.id))?.sourceId
    || '';
  if (!sourceId) {
    showToast('Categories', 'Could not resolve source for this manga.', 'warning');
    return;
  }
  const primaryKey = `${manga.id}:${sourceId}`;
  const legacyKey  = `${manga.id}:`;
  const currentCatIds = Array.from(new Set([
    ...(mangaCategories[primaryKey] || []),
    ...(mangaCategories[legacyKey] || []),
  ]));
  const statusKey = _libStatusKey(manga.id, sourceId);
  const currentStatus = state.readingStatus[statusKey]?.status || null;

  // Pre-fetch current categories from server for accuracy.
  // For bulk mode we keep the checkbox list empty by default to avoid accidental overwrite.
  let serverCatIds = [...currentCatIds];
  if (!isBulk) {
    try {
      const d = await api(`/api/lists/manga/${encodeURIComponent(manga.id)}/categories?sourceId=${encodeURIComponent(sourceId)}`);
      serverCatIds = d.categoryIds || currentCatIds;
    } catch (_) {}
  } else {
    serverCatIds = [];
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'libraryContextMenu';

  const _ico = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;

  const categoriesSection = (state.customLists || []).length > 0
    ? `<div class="context-divider"></div>
       <div class="ctx-categories-header">Categories</div>
       <div class="ctx-categories-list">
         ${(state.customLists || []).map(l => `
           <label class="ctx-cat-label">
             <input type="checkbox" class="ctx-cat-cb" value="${escapeHtml(l.id)}" ${serverCatIds.includes(l.id) ? 'checked' : ''}>
             <span>${escapeHtml(l.name)}</span>
           </label>`).join('')}
       </div>
       <div style="padding:0.35rem 0.55rem 0.6rem">
         <button class="btn primary ctx-save-cats-btn" style="width:100%;font-size:0.82rem;padding:0.42rem 0.75rem">${isBulk ? `Apply Categories to ${actionMangas.length}` : 'Save Categories'}</button>
       </div>`
    : `<div class="context-divider"></div>
       <div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">No categories — create one in the library bar</div>`;

  menu.innerHTML = `
    <div class="ctx-categories-header" style="padding-top:0.55rem;padding-bottom:0.35rem">${bulkPrefix} manga actions</div>
    <button class="context-item" id="ctxDownloadAll">${_ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')} ${isBulk ? `Download All Chapters (${actionMangas.length})` : 'Download All'}</button>
    <div class="context-divider"></div>
    <button class="context-item ${currentStatus === 'completed' ? 'ctx-item-active' : ''}" id="ctxMarkCompleted">${_ico('<polyline points="20 6 9 17 4 12"/>')} ${isBulk ? 'Mark Selected as Completed' : 'Mark as Completed'}</button>
    <button class="context-item ${currentStatus === 'reading'   ? 'ctx-item-active' : ''}" id="ctxMarkReading">${_ico('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>')} ${isBulk ? 'Mark Selected as Reading' : 'Mark as Reading'}</button>
    <button class="context-item ${!currentStatus             ? 'ctx-item-active' : ''}" id="ctxRemoveStatus">${_ico('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>')} ${isBulk ? 'Mark Selected as Unread' : 'Mark as Unread'}</button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxRemoveFromLibrary">${_ico('<path d="M3 6h18M9 6v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6"/><path d="M10 11v6M14 11v6"/>')} ${isBulk ? 'Remove Selected from Library' : 'Remove from Library'}</button>
    ${categoriesSection}`;

  document.body.appendChild(menu);

  // Position: avoid going off-screen
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 240, mh = menu.offsetHeight || 300;
  let x = e.clientX, y = e.clientY;
  if (x + mw > vw - 8) x = vw - mw - 8;
  if (y + mh > vh - 8) y = vh - mh - 8;
  if (y < 8) y = 8;
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  // ── Actions ────────────────────────────────────────────────────────────────

  // Remove from Library (single or bulk)
  menu.querySelector('#ctxRemoveFromLibrary').onclick = async () => {
    if (!actionMangas.length) return;
    if (!confirm(isBulk ? `Remove ${actionMangas.length} manga from your library?` : 'Remove this manga from your library?')) return;
    let ok = 0, fail = 0;
    for (const m of actionMangas) {
      try {
        await api('/api/library/remove', {
          method: 'POST',
          body: JSON.stringify({ mangaId: m.id, sourceId: m.sourceId })
        });
        // Remove from state
        state.favorites = (state.favorites || []).filter(f => !(f.id === m.id && f.sourceId === m.sourceId));
        // Remove reading status
        const key = _libStatusKey(m.id, m.sourceId);
        if (state.readingStatus) delete state.readingStatus[key];
        ok++;
      } catch (err) {
        fail++;
      }
    }
    _clearLibrarySelection();
    renderLibrary();
    showToast('Removed', ok ? `${ok} manga removed${fail ? `, ${fail} failed` : ''}` : 'No manga removed', fail ? 'warning' : 'info');
    _closeLibraryContextMenu();
  };

  // Download All
  menu.querySelector('#ctxDownloadAll').onclick = async () => {
    _closeLibraryContextMenu();
    showToast('Download', isBulk ? `Preparing ${actionMangas.length} manga…` : 'Loading chapters…', 'info');

    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid || sid === 'local') { fail++; continue; }

      try {
        state.currentSourceId = sid;
        state.currentManga = item;
        const cr = await api(`/api/source/${sid}/chapters`, {
          method: 'POST', body: JSON.stringify({ mangaId: item.id })
        });
        const chapters = (cr.chapters || []).map((ch, i) => ({
          id: ch.id,
          name: ch.name || `Chapter ${ch.chapter || i + 1}`,
        }));

        if (!chapters.length) { fail++; continue; }

        if (typeof downloadBulkChapters === 'function') {
          await downloadBulkChapters(chapters);
          ok++;
        } else {
          showBulkDownloadModal(cr.chapters || []);
          ok++;
          break;
        }
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    showToast('Download', `${ok} manga processed${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  // Status helpers
  const setStatus = async (status) => {
    _closeLibraryContextMenu();
    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid) { fail++; continue; }
      try {
        const res = await api('/api/user/status', {
          method: 'POST',
          body: JSON.stringify({ mangaId: item.id, sourceId: sid, status, mangaData: item }),
        });
        state.readingStatus = res.readingStatus || state.readingStatus;
        ok++;
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    const msg = status === 'none' ? 'set to unread' : `marked as ${statusLabel(status).toLowerCase()}`;
    showToast('Status', `${ok} manga ${msg}${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  menu.querySelector('#ctxMarkCompleted').onclick = () => setStatus('completed');
  menu.querySelector('#ctxMarkReading').onclick   = () => setStatus('reading');
  menu.querySelector('#ctxRemoveStatus').onclick  = () => setStatus('none');

  // Save categories
  const saveCatsBtn = menu.querySelector('.ctx-save-cats-btn');
  if (saveCatsBtn) {
    saveCatsBtn.onclick = async (ev) => {
      ev.stopPropagation();
      const checked = [...menu.querySelectorAll('.ctx-cat-cb:checked')].map(cb => cb.value);
      saveCatsBtn.disabled = true;
      try {
        const payload = {
          mangaId: manga.id,
          sourceId,
          categoryIds: checked,
          mangaData: { ...manga, sourceId },
        };
        const applyForOne = async (oneManga) => {
          const oneSourceId = oneManga.sourceId
            || state.currentSourceId
            || (state.favorites || []).find(f => String(f.id) === String(oneManga.id))?.sourceId
            || '';
          if (!oneSourceId) throw new Error('Could not resolve source id for selected manga.');

          const onePayload = {
            mangaId: oneManga.id,
            sourceId: oneSourceId,
            categoryIds: checked,
            mangaData: { ...oneManga, sourceId: oneSourceId },
          };

          try {
            await api('/api/lists/manga-categories', {
              method: 'PUT',
              body: JSON.stringify(onePayload),
            });
          } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            const isRouteConflict = msg.includes('list not found') || msg.includes('category not found');
            if (!isRouteConflict) throw err;

            const current = await api(`/api/lists/manga/${encodeURIComponent(onePayload.mangaId)}/categories?sourceId=${encodeURIComponent(onePayload.sourceId)}`);
            const currentIds = new Set(current.categoryIds || []);
            const freshLists = await api('/api/lists');
            const validIds = new Set((freshLists.lists || []).map(l => l.id));
            const targetIds = new Set((onePayload.categoryIds || []).filter(id => validIds.has(id)));

            const toAdd = [...targetIds].filter(id => !currentIds.has(id));
            const toRemove = [...currentIds].filter(id => !targetIds.has(id));

            for (const listId of toAdd) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga`, {
                method: 'POST',
                body: JSON.stringify({ mangaData: onePayload.mangaData }),
              });
            }
            for (const listId of toRemove) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga/${encodeURIComponent(onePayload.mangaId)}`, {
                method: 'DELETE',
              });
            }
          }
        };

        let ok = 0;
        let fail = 0;
        for (const one of actionMangas) {
          try {
            await applyForOne(one);
            ok++;
          } catch (_) {
            fail++;
          }
        }

        await (async () => { try { const d = await api('/api/lists'); state.customLists = d.lists || []; } catch (_) {} })();
        _closeLibraryContextMenu();
        _clearLibrarySelection();
        renderLibrary();
        showToast('Categories', `${ok} manga updated${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
        saveCatsBtn.disabled = false;
      }
    };
  }

  // Prevent checkbox clicks from closing the menu
  menu.querySelectorAll('.ctx-cat-cb').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
  });
  menu.querySelectorAll('.ctx-cat-label').forEach(lbl => {
    lbl.addEventListener('click', e => e.stopPropagation());
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _ctxDocClickHandler, true);
    document.addEventListener('keydown', _ctxMenuKeyHandler);
  }, 0);
}

