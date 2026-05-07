// ============================================================================
// ADD TO LIST MODAL
// ============================================================================
// CHAPTERS MANAGEMENT
// ============================================================================

const _chapterPrefetchCache = new Map();
const _chapterPrefetchInFlight = new Set();

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
    state.chapterCountCache[state.currentManga.id] = state.allChapters.length;
    saveSettings();
    state.chaptersReversed = false;
    renderChaptersList();
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

function renderChaptersList() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");

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
        const isRead    = isChapterRead(state.currentManga.id, ch.id);
        const realIndex = state.allChapters.findIndex(c => c.id === ch.id);
        const isFlagged = state.flaggedChapters.has(`${state.currentManga.id}:${ch.id}`);
        return `
          <div class="chapter-item ${isRead ? 'chapter-read' : ''} ${isFlagged ? 'chapter-flagged' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
            <div class="chapter-info">
              <div class="chapter-name">${isFlagged ? '<span class="chapter-flag-icon">&#x1F6A9;</span> ' : ''}${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</div>
              ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</div>` : ""}
            </div>
            <div class="chapter-action">
              ${isRead ? `<span class="read-badge">&#x2713;</span>` : ""}
              ${state.currentSourceId !== 'local' ? `<button class="btn-save-offline" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}" title="Save for offline reading" onclick="event.stopPropagation();"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>` : ''}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  chapDiv.querySelectorAll(".chapter-item[data-chapter-id]").forEach(el => {
    el.onclick = () => loadChapter(
      el.dataset.chapterId,
      el.dataset.chapterName,
      parseInt(el.dataset.chapterIndex)
    );
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showChapterContextMenu(e, el.dataset.chapterId, state.currentManga?.id);
    });
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
    markChapterAsRead(state.currentManga.id, chapterId);
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
        chapterId
      })
    }).then(() => {
      // Keep in-memory history in sync (with full manga object including genres)
      const existing = state.history.findIndex(
        m => m.id === state.currentManga.id && m.sourceId === state.currentSourceId
      );
      const entry = { ...state.currentManga, sourceId: state.currentSourceId, chapterId, readAt: new Date().toISOString() };
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

