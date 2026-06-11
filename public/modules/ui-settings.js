// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

// Expose settings functions globally for non-module scripts
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;
function deepMerge(target, source) {
  for (const key in source) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object'
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function loadSettings() {
  try {
    const saved = localStorage.getItem("scrollscapeSettings");
    if (saved) deepMerge(state.settings, JSON.parse(saved));
    if (state.settings.displayMode === 'comfortable') state.settings.displayMode = 'detailed';
    if (typeof state.settings.showCompactInfo !== 'boolean') state.settings.showCompactInfo = false;
    if (typeof state.settings.hideLibraryStatusAndChapters !== 'boolean') state.settings.hideLibraryStatusAndChapters = false;
    if (typeof state.settings.mangasPerRow !== 'number' || state.settings.mangasPerRow < 5 || state.settings.mangasPerRow > 14) {
      state.settings.mangasPerRow = 6;
    }
    if (typeof state.settings.showHomeSearch !== 'boolean') state.settings.showHomeSearch = true;
    if (state.settings.homeSourceMode !== 'selected') state.settings.homeSourceMode = 'all';
    if (!Array.isArray(state.settings.homeSelectedSourceIds)) state.settings.homeSelectedSourceIds = [];
    const speedDefaults = [0.2, 0.5, 1.0, 2.0, 3.5];
    const savedSpeeds = Array.isArray(state.settings.autoScrollPointSpeeds)
      ? state.settings.autoScrollPointSpeeds
      : speedDefaults;
    state.settings.autoScrollPointSpeeds = speedDefaults.map((fallback, idx) => {
      const n = Number(savedSpeeds[idx]);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(12, Math.max(0.05, n));
    });

    const readChaps = localStorage.getItem("scrollscapeReadChapters");
    if (readChaps) state.readChapters = new Set(JSON.parse(readChaps));

    const flaggedChaps = localStorage.getItem("scrollscapeFlaggedChapters");
    if (flaggedChaps) state.flaggedChapters = new Set(JSON.parse(flaggedChaps));

    const progress = localStorage.getItem("scrollscapeReadingProgress");
    if (progress) {
      const p = JSON.parse(progress);
      state.lastReadPages = p.pages || {};
      state.lastReadChapter = p.chapters || {};
      state.highestReadChapter = p.highestChapter || {};
      state.lastReadPageTotals = p.pageTotals || {};
    } else {
      state.lastReadPages = {};
      state.lastReadChapter = {};
      state.highestReadChapter = {};
      state.lastReadPageTotals = {};
    }
    const chCounts = localStorage.getItem("scrollscapeChapterCounts");
    if (chCounts) state.chapterCountCache = JSON.parse(chCounts);
  } catch (e) {
    dbg.warn(dbg.ERR_SETTINGS, 'Failed to load settings', e);
    state.lastReadPages = {};
    state.lastReadChapter = {};
    state.highestReadChapter = {};
    state.lastReadPageTotals = {};
  }
}

function saveSettings() {
  localStorage.setItem("scrollscapeSettings", JSON.stringify(state.settings));
  localStorage.setItem("scrollscapeChapterCounts", JSON.stringify(state.chapterCountCache));
  localStorage.setItem("scrollscapeReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("scrollscapeFlaggedChapters", JSON.stringify([...state.flaggedChapters]));
  localStorage.setItem("scrollscapeReadingProgress", JSON.stringify({
    pages: state.lastReadPages,
    chapters: state.lastReadChapter,
    highestChapter: state.highestReadChapter,
    pageTotals: state.lastReadPageTotals
  }));
}

function markChapterAsRead(mangaId, chapterId) {
  state.readChapters.add(`${mangaId}:${chapterId}`);
  saveSettings();
}

function unmarkChapterAsRead(mangaId, chapterId) {
  state.readChapters.delete(`${mangaId}:${chapterId}`);
  saveSettings();
}

function isChapterRead(mangaId, chapterId) {
  return state.readChapters.has(`${mangaId}:${chapterId}`);
}

function toggleFlagChapter(mangaId, chapterId) {
  const key = `${mangaId}:${chapterId}`;
  if (state.flaggedChapters.has(key)) state.flaggedChapters.delete(key);
  else state.flaggedChapters.add(key);
  saveSettings();
}

function showChapterContextMenu(e, chapterId, mangaId, options = {}) {
  document.querySelectorAll(".chapter-ctx-menu").forEach(m => m.remove());

  const chapterIds = Array.isArray(options.chapterIds) && options.chapterIds.length
    ? [...new Set(options.chapterIds.map(id => String(id)))]
    : [String(chapterId)];
  const isBulk = chapterIds.length > 1;
  const allFlagged = chapterIds.every(id => state.flaggedChapters.has(`${mangaId}:${id}`));
  const canSaveOffline = !!options.canSaveOffline;
  const chapterEntries = Array.isArray(options.chapterEntries) && options.chapterEntries.length
    ? options.chapterEntries
    : chapterIds.map(id => ({ id, name: `Chapter ${id}` }));

  const _afterAction = () => {
    if (typeof options.onAction === 'function') options.onAction();
    else loadChapters();
  };

  const menu = document.createElement("div");
  menu.className = "context-menu chapter-ctx-menu";
  menu.innerHTML = `
    <button class="context-item" id="ctxMarkRead">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ${isBulk ? 'Mark Selected as Read' : 'Mark as Read'}
    </button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxMarkUnread">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      ${isBulk ? 'Mark Selected as Unread' : 'Mark as Unread'}
    </button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxFlag">
      &#x1F6A9; ${allFlagged ? (isBulk ? 'Remove Flag from Selected' : 'Remove Flag') : (isBulk ? 'Add Flag to Selected' : 'Add Flag')}
    </button>
    ${canSaveOffline ? `<div class="context-divider"></div>
    <button class="context-item" id="ctxSaveOffline">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      ${isBulk ? 'Save Selected Offline' : 'Save Offline'}
    </button>` : ''}
  `;

  document.body.appendChild(menu);
  const { clientX: x, clientY: y } = e;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = (x + mw > window.innerWidth  ? window.innerWidth  - mw - 8 : x) + "px";
  menu.style.top  = (y + mh > window.innerHeight ? window.innerHeight - mh - 8 : y) + "px";

  menu.querySelector("#ctxMarkRead").onclick = () => {
    if (typeof options.markReadBackwards === 'function') {
      for (const id of chapterIds) options.markReadBackwards(id);
    } else {
      for (const id of chapterIds) markChapterAsRead(mangaId, id);
    }
    menu.remove();
    _afterAction();
  };

  menu.querySelector("#ctxMarkUnread").onclick = () => {
    for (const id of chapterIds) unmarkChapterAsRead(mangaId, id);
    menu.remove();
    _afterAction();
  };
  menu.querySelector("#ctxFlag").onclick = () => {
    for (const id of chapterIds) {
      const key = `${mangaId}:${id}`;
      if (allFlagged) state.flaggedChapters.delete(key);
      else state.flaggedChapters.add(key);
    }
    saveSettings();
    menu.remove();
    _afterAction();
  };

  const saveBtn = menu.querySelector("#ctxSaveOffline");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      menu.remove();
      if (chapterEntries.length > 1) {
        await saveBulkOffline(chapterEntries.map(ch => ({ id: String(ch.id), name: String(ch.name || `Chapter ${ch.id}`) })));
      } else {
        const ch = chapterEntries[0];
        if (ch?.id) await saveChapterOffline(String(ch.id), String(ch.name || `Chapter ${ch.id}`));
      }
      _afterAction();
    };
  }

  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", dismiss, true); }
  };
  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}

function updateReadingProgress(mangaId, chapterId, pageIndex) {
  if (!mangaId || !chapterId) return;
  const key = `${mangaId}:${chapterId}`;
  state.lastReadPages[key] = pageIndex;
  state.lastReadChapter[mangaId] = chapterId;
  const total = Number(state.currentChapter?.pages?.length || 0);
  if (Number.isFinite(total) && total > 0) state.lastReadPageTotals[key] = total;
  saveSettings();
}

