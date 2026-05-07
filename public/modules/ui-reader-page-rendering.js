// ============================================================================
// READER & PAGE RENDERING
// ============================================================================

let _readerArrowProximityListener = null;

function _bindReaderArrowProximity(readerEl) {
  if (!readerEl || _readerArrowProximityListener) return;
  _readerArrowProximityListener = (e) => {
    const arrow = $("readerSidebarToggle");
    if (!arrow) return;
    const r = arrow.getBoundingClientRect();
    const expand = 78;
    const nearArrow = (
      e.clientX >= (r.left - expand) &&
      e.clientX <= (r.right + expand) &&
      e.clientY >= (r.top - expand) &&
      e.clientY <= (r.bottom + expand)
    );
    readerEl.classList.toggle("reader-arrow-visible", nearArrow);
  };
  readerEl.addEventListener("mousemove", _readerArrowProximityListener);
}

function _unbindReaderArrowProximity(readerEl) {
  if (!readerEl || !_readerArrowProximityListener) return;
  readerEl.removeEventListener("mousemove", _readerArrowProximityListener);
  _readerArrowProximityListener = null;
}

function applyReaderBackground() {
  const colours = {
    black:  '#000000',
    dark:   '#111318',
    gray:   '#2a2a2e',
    sepia:  '#1e160c',
    white:  '#ffffff',
  };
  const bg = colours[state.settings.readerBackground] || colours.black;
  $('reader').style.backgroundColor = bg;
}

function showReader() {
  const readerEl = $("reader");
  readerEl.classList.remove("hidden");
  applyReaderBackground();
  const mode = state.settings.readingMode;
  if ((mode === "ltr" || mode === "rtl") && state.zoomLevel === 1.0) {
    state.zoomLevel = 1.2;
  }
  const chapterMeta = state.allChapters?.[state.currentChapterIndex];
  const chapterNumber = chapterMeta?.chapter;
  const chapterName = state.currentChapter?.name || "";
  const chapterLabel = chapterNumber ? `Chapter ${chapterNumber}` : (chapterName || "Chapter");
  $("readerTitle").textContent = `${state.currentManga?.title || ""} - ${chapterLabel}`;
  updateZoomUI();
  _bindReaderArrowProximity(readerEl);
}

async function hideReader() {
  stopAutoScroll();
  await recordReadingSession();
  // Restore reading mode if it was auto-overridden by webtoon detection
  if (state._preAutoReadingMode != null) {
    state.settings.readingMode = state._preAutoReadingMode;
    state._preAutoReadingMode = null;
  }
  const readerEl = $("reader");
  readerEl.classList.add("hidden");
  readerEl.classList.remove("reader-sidebar-collapsed", "reader-arrow-visible");
  _unbindReaderArrowProximity(readerEl);
}

