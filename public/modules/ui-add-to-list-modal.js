// ============================================================================
// ADD TO LIST MODAL
// ============================================================================
// CHAPTERS MANAGEMENT
// ============================================================================

const _chapterPrefetchCache = new Map();
const _chapterPrefetchInFlight = new Set();

function _ensureChapterSelectionState() {
  if (!state._chapterSelection || state._chapterSelectionMangaId !== state.currentManga?.id) {
    state._chapterSelection = new Set();
    state._chapterSelectionMangaId = state.currentManga?.id || null;
    state._chapterSelectionAnchorId = null;
  }
}

function _chaptersOldestFirst(chapters) {
  const list = Array.isArray(chapters) ? chapters.filter(ch => ch?.id) : [];
  if (list.length <= 1) return list;

  const parseNum = (ch) => {
    const raw = String(ch?.chapter ?? ch?.name ?? '').trim();
    if (!raw) return null;
    const m = raw.match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  const rows = list.map((c, i) => ({ c, i, n: parseNum(c) }));
  const numeric = rows.filter(r => r.n !== null).length;
  const mostlyNumeric = numeric >= Math.max(2, Math.floor(list.length * 0.5));

  if (mostlyNumeric) {
    return rows
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map(r => r.c);
  }
  return list.reverse();
}

function _isNewestFirstByIndex(chapters) {
  const list = Array.isArray(chapters) ? chapters : [];
  if (list.length < 2) return true;

  const parseNum = (ch) => {
    const raw = String(ch?.chapter ?? ch?.name ?? '').trim();
    if (!raw) return null;
    const m = raw.match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  const firstNum = parseNum(list[0]);
  const lastNum = parseNum(list[list.length - 1]);
  if (firstNum !== null && lastNum !== null) {
    return firstNum >= lastNum;
  }
  // Most adapters return newest-first.
  return true;
}

function _markReadBackwardsToChapterIndex(mangaId, chapterIndex, chapterIdFallback = null) {
  const list = Array.isArray(state.allChapters) ? state.allChapters.filter(ch => ch?.id) : [];
  if (!list.length || !Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= list.length) {
    if (chapterIdFallback) markChapterAsRead(mangaId, chapterIdFallback);
    return;
  }

  const newestFirst = _isNewestFirstByIndex(list);
  if (newestFirst) {
    // Newest -> oldest: everything after current index is older.
    for (let i = chapterIndex; i < list.length; i++) {
      state.readChapters.add(`${mangaId}:${list[i].id}`);
    }
  } else {
    // Oldest -> newest: everything before current index is older.
    for (let i = 0; i <= chapterIndex; i++) {
      state.readChapters.add(`${mangaId}:${list[i].id}`);
    }
  }

  const curr = list[chapterIndex];
  if (curr?.id) state.lastReadChapter[mangaId] = curr.id;
  saveSettings();
}

function _markReadBackwardsToChapterId(mangaId, chapterId) {
  const idx = (state.allChapters || []).findIndex(ch => String(ch?.id) === String(chapterId));
  if (idx >= 0) {
    _markReadBackwardsToChapterIndex(mangaId, idx, chapterId);
    return;
  }

  // Fallback for stale/partial chapter lists.
  const oldest = _chaptersOldestFirst(state.allChapters || []);
  if (!oldest.length || !chapterId) {
    markChapterAsRead(mangaId, chapterId);
    return;
  }
  const oldIdx = oldest.findIndex(ch => String(ch.id) === String(chapterId));
  if (oldIdx < 0) {
    markChapterAsRead(mangaId, chapterId);
    return;
  }
  for (let i = 0; i <= oldIdx; i++) state.readChapters.add(`${mangaId}:${oldest[i].id}`);
  state.lastReadChapter[mangaId] = chapterId;
  saveSettings();
}

function prefetchNextReaderChapters(ahead = 2) {
  const total = state.allChapters?.length || 0;
  if (!total || !state.currentSourceId) return;

  let idx = state.currentChapterIndex;
  for (let i = 0; i < ahead; i++) {
    idx = getNextChapterIndex(idx);
    if (idx < 0 || idx >= total) break;
    const ch = state.allChapters[idx];
    if (!ch?.id) continue;
    if (_chapterPrefetchCache.has(ch.id) || _chapterPrefetchInFlight.has(ch.id)) continue;

    _chapterPrefetchInFlight.add(ch.id);
    api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId: ch.id })
    }).then((result) => {
      if (result) _chapterPrefetchCache.set(ch.id, result);
    }).catch(() => {
      // Ignore prefetch errors; normal load path still works.
    }).finally(() => {
      _chapterPrefetchInFlight.delete(ch.id);
      while (_chapterPrefetchCache.size > 6) {
        const oldest = _chapterPrefetchCache.keys().next().value;
        _chapterPrefetchCache.delete(oldest);
      }
    });
  }
}

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
    _repairMangaChapterProgressIfNeeded(state.currentManga.id, state.allChapters);
    state.chapterCountCache[state.currentManga.id] = state.allChapters.length;
    saveSettings();
    state.chaptersReversed = false;
    renderChaptersList();
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

function _repairMangaChapterProgressIfNeeded(mangaId, chapters) {
  try {
    const list = Array.isArray(chapters) ? chapters.filter(ch => ch?.id) : [];
    if (!mangaId || list.length === 0) return;

    const valid = new Set(list.map(ch => String(ch.id)));
    const readKeys = [...(state.readChapters || new Set())].filter(k => String(k).startsWith(`${mangaId}:`));
    const readIds = readKeys.map(k => String(k).slice(String(mangaId).length + 1));
    const validRead = readIds.filter(id => valid.has(String(id))).length;
    const invalidRead = readIds.length - validRead;

    const lastId = state.lastReadChapter?.[mangaId];
    const lastIsInvalid = !!lastId && !valid.has(String(lastId));
    if (!lastIsInvalid && invalidRead === 0) return;

    const parseNum = (ch) => {
      const raw = String(ch?.chapter ?? ch?.name ?? '').trim();
      const m = raw.match(/\d+(?:\.\d+)?/);
      if (!m) return null;
      const n = Number(m[0]);
      return Number.isFinite(n) ? n : null;
    };
    const rows = list.map((c, i) => ({ c, i, n: parseNum(c) }));
    const numeric = rows.filter(r => r.n !== null).length;
    const mostlyNumeric = numeric >= Math.max(2, Math.floor(rows.length * 0.5));
    const oldest = mostlyNumeric
      ? rows.sort((a, b) => (a.n - b.n) || (a.i - b.i)).map(r => r.c)
      : [...list].reverse();

    const highest = Number(state.highestReadChapter?.[mangaId] || 0);
    const target = Math.max(validRead, invalidRead + validRead, Number.isFinite(highest) ? Math.floor(highest) : 0);
    const clamped = Math.max(0, Math.min(target, oldest.length));

    for (const key of readKeys) state.readChapters.delete(key);
    for (let i = 0; i < clamped; i++) {
      state.readChapters.add(`${mangaId}:${oldest[i].id}`);
    }

    for (const k of Object.keys(state.lastReadPages || {})) {
      if (k.startsWith(`${mangaId}:`)) delete state.lastReadPages[k];
    }
    if (clamped > 0) {
      const lastMapped = oldest[clamped - 1];
      state.lastReadChapter[mangaId] = lastMapped.id;
      state.lastReadPages[`${mangaId}:${lastMapped.id}`] = 0;
      state.highestReadChapter[mangaId] = Math.max(Number(state.highestReadChapter[mangaId] || 0), clamped);
    } else {
      delete state.lastReadChapter[mangaId];
      delete state.highestReadChapter[mangaId];
    }
  } catch (_) {
    // Keep UI responsive; repair is best-effort.
  }
}

function renderChaptersList() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");
  _ensureChapterSelectionState();

  let displayChapters = state.allChapters;
  if (state.settings.skipReadChapters) {
    displayChapters = state.allChapters.filter(ch => !isChapterRead(state.currentManga.id, ch.id));
  }
  if (state.chaptersReversed) {
    displayChapters = [...displayChapters].reverse();
  }

  if (!displayChapters.length) {
    chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "All chapters read" : "No chapters found"}</div>`;
    return;
  }

  const reverseIcon = state.chaptersReversed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;

  chapDiv.innerHTML = `
    <div class="chapters-header">
      <strong>${displayChapters.length} Chapter${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Unread" : "Available"}</strong>
      <div class="chapters-header-actions">
        <span class="chapter-selected-count" id="chapterSelectedCount">${state._chapterSelection.size} selected</span>
        <button class="btn-reverse-chapters ${state.chaptersReversed ? 'btn-reverse-active' : ''}" id="reverseChaptersBtn" title="${state.chaptersReversed ? 'Oldest first (reversed)' : 'Newest first (default)'}">
          ${reverseIcon}
          ${state.chaptersReversed ? "Oldest First" : "Newest First"}
        </button>
        <button class="btn-check-integrity" id="checkIntegrityBtn" title="Check Chapter Integrity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Check Integrity
        </button>
        ${state.currentSourceId !== 'local' ? `<button class="btn-download-bulk" id="downloadBulkBtn" title="Save chapters for offline reading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Offline
        </button>` : ''}
      </div>
    </div>
    <div id="integrityReport"></div>
    <div class="chapters-list">
      ${displayChapters.map((ch, i) => {
        const lastReadId = String(state.lastReadChapter?.[state.currentManga.id] || '');
        const isRead    = isChapterRead(state.currentManga.id, ch.id);
        const realIndex = state.allChapters.findIndex(c => c.id === ch.id);
        const isFlagged = state.flaggedChapters.has(`${state.currentManga.id}:${ch.id}`);
        const isSelected = state._chapterSelection.has(String(ch.id));
        const isCurrentProgress = lastReadId && String(ch.id) === lastReadId;
        const progressKey = `${state.currentManga.id}:${ch.id}`;
        const rawSavedPage = Number(state.lastReadPages?.[progressKey]);
        const savedPage = Number.isFinite(rawSavedPage) && rawSavedPage >= 0 ? (Math.floor(rawSavedPage) + 1) : 1;
        const totalPages = Number(state.lastReadPageTotals?.[progressKey] || 0);
        const progressLabel = totalPages > 0 ? `${savedPage}/${totalPages}` : String(savedPage);
        return `
          <div class="chapter-item ${isRead ? 'chapter-read' : ''} ${isFlagged ? 'chapter-flagged' : ''} ${isSelected ? 'chapter-selected' : ''} ${isCurrentProgress ? 'chapter-current-progress' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-display-index="${i}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
            <div class="chapter-info">
              <div class="chapter-name">${isFlagged ? '<span class="chapter-flag-icon">&#x1F6A9;</span> ' : ''}${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</div>
              ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</div>` : ""}
              ${isCurrentProgress ? `<div class="chapter-progress-page">Parou na página ${progressLabel}</div>` : ""}
            </div>
            <div class="chapter-action">
              ${isRead ? `<span class="read-badge">&#x2713;</span>` : ""}
              ${state.currentSourceId !== 'local' ? `<button class="btn-save-offline" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}" title="Save for offline reading" onclick="event.stopPropagation();"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>` : ''}
              <button class="btn-open-chapter" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}" title="Open chapter" onclick="event.stopPropagation();">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  const _updateSelectedCount = () => {
    const countEl = $("chapterSelectedCount");
    if (countEl) countEl.textContent = `${state._chapterSelection.size} selected`;
  };

  const _displayIndexById = new Map((displayChapters || []).map((ch, i) => [String(ch.id), i]));

  const _selectChapterRange = (fromId, toId) => {
    const from = _displayIndexById.get(String(fromId));
    const to = _displayIndexById.get(String(toId));
    if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let i = lo; i <= hi; i++) {
      const ch = displayChapters[i];
      if (ch?.id) state._chapterSelection.add(String(ch.id));
    }
    return true;
  };

  chapDiv.querySelectorAll(".chapter-item[data-chapter-id]").forEach(el => {
    el.onclick = (ev) => {
      const id = String(el.dataset.chapterId || '');
      if (!id) return;

      if (ev.shiftKey && state._chapterSelectionAnchorId) {
        _selectChapterRange(state._chapterSelectionAnchorId, id);
      } else if (ev.ctrlKey || ev.metaKey) {
        if (state._chapterSelection.has(id)) state._chapterSelection.delete(id);
        else state._chapterSelection.add(id);
        state._chapterSelectionAnchorId = id;
      } else {
        if (state._chapterSelection.has(id)) state._chapterSelection.delete(id);
        else state._chapterSelection.add(id);
        state._chapterSelectionAnchorId = id;
      }

      chapDiv.querySelectorAll('.chapter-item[data-chapter-id]').forEach(node => {
        const nodeId = String(node.dataset.chapterId || '');
        node.classList.toggle('chapter-selected', state._chapterSelection.has(nodeId));
      });
      _updateSelectedCount();
    };
    el.ondblclick = () => loadChapter(
      el.dataset.chapterId,
      el.dataset.chapterName,
      parseInt(el.dataset.chapterIndex)
    );
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const clickedId = String(el.dataset.chapterId || '');
      if (!state._chapterSelection.has(clickedId)) {
        state._chapterSelection.clear();
        state._chapterSelection.add(clickedId);
        state._chapterSelectionAnchorId = clickedId;
        chapDiv.querySelectorAll('.chapter-item.chapter-selected').forEach(n => n.classList.remove('chapter-selected'));
        el.classList.add('chapter-selected');
      }
      _updateSelectedCount();

      const selectedIds = [...state._chapterSelection];
      const selectedEntries = (state.allChapters || [])
        .filter(ch => selectedIds.includes(String(ch.id)))
        .map(ch => ({ id: String(ch.id), name: ch.name || `Chapter ${ch.chapter || '?'}` }));

      showChapterContextMenu(e, clickedId, state.currentManga?.id, {
        chapterIds: selectedIds,
        chapterEntries: selectedEntries,
        canSaveOffline: state.currentSourceId !== 'local',
        markReadBackwards: (chapterId) => _markReadBackwardsToChapterId(state.currentManga.id, chapterId),
        onAction: () => {
          state._chapterSelection.clear();
          loadChapters();
        }
      });
    });
  });

  chapDiv.querySelectorAll(".btn-open-chapter").forEach(btn => {
    btn.onclick = () => loadChapter(
      btn.dataset.chapterId,
      btn.dataset.chapterName,
      parseInt(btn.dataset.chapterIndex)
    );
  });

  // Save individual chapters for offline reading
  chapDiv.querySelectorAll(".btn-save-offline").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await saveChapterOffline(btn.dataset.chapterId, btn.dataset.chapterName);
    };
  });

  // Reverse order button
  const reverseBtn = $("reverseChaptersBtn");
  if (reverseBtn) {
    reverseBtn.onclick = () => {
      state.chaptersReversed = !state.chaptersReversed;
      renderChaptersList();
    };
  }

  // Bulk download button
  const bulkBtn = $("downloadBulkBtn");
  if (bulkBtn) {
    bulkBtn.onclick = () => showBulkDownloadModal(displayChapters);
  }

  // Check integrity button
  const integrityBtn = $("checkIntegrityBtn");
  if (integrityBtn) {
    integrityBtn.onclick = () => checkChapterIntegrity(state.allChapters);
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
  _bookFlipAnimating = false;
  _ltrFlipAnimating  = false;
  $("searchStatus").textContent = "Loading chapter...";
  try {
    let result = _chapterPrefetchCache.get(chapterId);
    if (result) {
      _chapterPrefetchCache.delete(chapterId);
    } else {
      result = await api(`/api/source/${state.currentSourceId}/pages`, {
        method: "POST",
        body: JSON.stringify({ chapterId })
      });
    }
    state.currentChapter      = result;
    state.currentChapter.name = chapterName;
    state.currentChapter.id   = chapterId;
    state.currentChapterIndex = chapterIndex;

    // PDF: load via PDF.js to get page count, build synthetic pages array
    if (result.isPDF && result.pdfUrl) {
      await initPDFChapter(result.pdfUrl);
    }

    const maxIndex = Math.max((state.currentChapter.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);
    // Keep zoom level between chapters — only reset if it was never set

    // Track highest chapter number read (for AniList progress auto-fill)
    const chNum = state.allChapters?.[chapterIndex]?.chapter;
    if (chNum !== undefined && !isNaN(Number(chNum)) && Number(chNum) > 0) {
      const _mId = state.currentManga.id;
      state.highestReadChapter[_mId] = Math.max(state.highestReadChapter[_mId] || 0, Number(chNum));
    }
    _markReadBackwardsToChapterIndex(state.currentManga.id, chapterIndex, chapterId);
    state.readerSessionStart = Date.now();

    // AniList: sync progress when a chapter is loaded (treated as "read")
    if (chNum !== undefined && state.currentManga?.title) {
      const _linkedId = _alGetLink(state.currentManga.id);
      if (_linkedId && _alToken()) {
        // Direct update using saved link — no title search needed
        const _prog = parseInt(chNum, 10);
        if (!isNaN(_prog) && _prog > 0) {
          anilistGQL(
            'mutation ($m: Int, $p: Int) { SaveMediaListEntry(mediaId: $m, status: CURRENT, progress: $p) { id progress } }',
            { m: _linkedId, p: _prog }
          ).catch(e => dbg.warn(dbg.ERR_ANILIST, 'Auto-sync failed', e));
        }
      } else {
        anilistSyncProgress(state.currentManga.title, chNum).catch(() => {});
      }
    }

    api("/api/history/add", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga.id,
        sourceId: state.currentSourceId,
        manga: state.currentManga,
        chapterId,
        chapterName
      })
    }).then(() => {
      // Keep in-memory history in sync (with full manga object including genres)
      const existing = state.history.findIndex(
        m => m.id === state.currentManga.id && m.sourceId === state.currentSourceId
      );
      const entry = { ...state.currentManga, sourceId: state.currentSourceId, chapterId, chapterName, readAt: new Date().toISOString() };
      if (existing >= 0) state.history.splice(existing, 1);
      state.history.unshift(entry);
      state.history = state.history.slice(0, 100);
      // Refresh recommendations so "Based on:" label reflects updated consumption
      loadRecommendations();
    }).catch(() => {});

    showReader();
    // Auto-detect manhwa/manhua and switch to webtoon mode for this session
    if (state.settings.autoWebtoonDetect && state.currentManga) {
      if (isWebtoonFormat(state.currentManga)) {
        if (state.settings.readingMode !== 'webtoon') {
          state._preAutoReadingMode = state.settings.readingMode;
          state.settings.readingMode = 'webtoon';
        }
      } else if (state._preAutoReadingMode != null) {
        // Restore if we moved to a non-webtoon manga
        state.settings.readingMode = state._preAutoReadingMode;
        state._preAutoReadingMode = null;
      }
    }
    renderPage();
    prefetchNextReaderChapters(2);
    $("searchStatus").textContent = "";
    loadChapters();
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

