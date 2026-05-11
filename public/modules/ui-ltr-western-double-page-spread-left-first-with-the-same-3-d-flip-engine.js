// ============================================================================
// LTR — Western double-page spread (left-first) with the same 3-D flip engine
// ============================================================================

let _ltrFlipAnimating = false;

function renderLTRSpread() {
  if (!state.currentChapter?.pages) return;
  // PDF: use canvas-based spread
  if (state.currentChapter.isPDF && state.pdfDocument) { renderPDFSpread(false); return; }
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getLTRSpread(idx, pages);
  const { left: leftImg, right: rightImg, isWide, wideSide, wideSrc } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-ltr' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = _spreadStep(idx, pages);
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const l = idx + 1, r = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${l} / ${total}`
    : (r <= total ? `${l}-${r} / ${total}` : `${l} / ${total}`);

  const wrapZoomStyle = '';

  // Wide pages: panels stay blank and full-spread overlay is injected.
  const leftHtml = (!isWide && leftImg)
    ? `<img class="book-page-img" src="${escapeHtml(leftImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const rightHtml = (!isWide && rightImg)
    ? `<img class="book-page-img" src="${escapeHtml(rightImg)}" alt="Page ${idx + 2}">`
    : `<div class="book-page-blank"></div>`;
  const overlayHtml = isWide && wideSrc
    ? `<div class="book-wide-overlay visible ${wideSide === 'left' ? 'wide-left' : 'wide-right'}" id="bookWideOverlay"><img src="${escapeHtml(wideSrc)}" id="wideOverlayImg"></div>`
    : '';

  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap" ${wrapZoomStyle}>
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left" id="bookLeft">${leftHtml}</div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight">${rightHtml}</div>
        ${overlayHtml}
      </div>
    </div>
  `;

  if (typeof _prepareBookImages === 'function') _prepareBookImages(pageWrap);

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  if (!isWide) _applyWideSplitIfNeeded(idx, pages);
}

function navigateLTR(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  // PDF: use canvas-capture flip animation
  if (state.currentChapter?.isPDF && state.pdfDocument) {
    if (_ltrFlipAnimating) return;
    if (direction === 'forward') {
      if (idx + 2 >= total) { goToNextChapter(); return; }
      newIdx = idx + 2;
    } else {
      if (idx === 0) { goToPrevChapter(); return; }
      newIdx = Math.max(0, idx - 2);
    }
    _ltrFlipAnimating = true;
    playPDFFlip(false, direction, idx, newIdx, () => {
      state.currentPageIndex = newIdx;
      _ltrFlipAnimating = false;
      renderPDFSpread(false, true); // noFade: flip was already the animation
      const pNum1 = newIdx + 1, pNum2 = newIdx + 2;
      const ctr = $("pageCounter");
      if (ctr) ctr.textContent = pNum2 <= total ? `${pNum1}-${pNum2} / ${total}` : `${pNum1} / ${total}`;
      const pv2 = $("prevPage"), nx2 = $("nextPage");
      const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
      if (nx2) nx2.disabled = newIdx + 2 >= total && !hasNextCh2;
      attachBookDragEvents();
    });
    return;
  }

  if (direction === "forward") {
    const step = _spreadStep(idx, pages);
    if (idx + step >= total) { _ltrFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _ltrFlipAnimating = false; goToPrevChapter(); return; }
    newIdx = Math.max(0, idx - _backStep(idx, pages));
  }

  if (_ltrFlipAnimating) return;

  // Sync-probe destination page — catches images already in browser cache
  _syncProbeWide(pages[newIdx]);

  // No-animation mode: just re-render instantly.
  if (state.settings.pageFlipAnimation === false) {
    state.currentPageIndex = newIdx;
    renderLTRSpread();
    return;
  }

  _ltrFlipAnimating = true;
  playBookFlip(direction, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _ltrFlipAnimating = false;
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = _spreadStep(newIdx, pages);
    const l = newIdx + 1, r = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${l} / ${total2}` : (r <= total2 ? `${l}-${r} / ${total2}` : `${l} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideForCurrentPage(newIdx, pages);
  }, getLTRSpread);
}

function applyZoom(delta) {
  state.zoomLevel = Math.min(3.0, Math.max(0.5, Math.round((state.zoomLevel + delta) * 10) / 10));
  updateZoomUI();

  const mode = state.settings.readingMode;
  if (mode === 'rtl' || mode === 'ltr') {
    _applyBookZoom();
    return;
  }
  if (mode === 'webtoon') {
    _applyWebtoonZoom();
    return;
  }
  // Single-page mode: just scale the existing wrap in-place
  _applySinglePageZoom();
}

// Update zoom on the webtoon wrap in-place (preserves scroll position & loaded images)
function _applyWebtoonZoom() {
  const wrap = document.querySelector('#pageWrap .page-zoom-wrap');
  if (!wrap) { renderPage(); return; }
  const pageWrap = $('pageWrap');
  const zoom = state.zoomLevel ?? 1.0;

  // Find the first page element that is visible (or nearest to viewport top)
  // We'll use it as a stable anchor so the user stays on the same page after zoom.
  const pages = Array.from(wrap.querySelectorAll('.webtoon-page, canvas'));
  let anchor = null, anchorRectBefore = null;
  if (pageWrap && pages.length) {
    const vpTop = pageWrap.getBoundingClientRect().top;
    for (const el of pages) {
      const r = el.getBoundingClientRect();
      // Pick the first element whose bottom is below the viewport top (i.e. at least partially visible)
      if (r.bottom > vpTop) { anchor = el; anchorRectBefore = r; break; }
    }
    if (!anchor) { anchor = pages[0]; anchorRectBefore = anchor.getBoundingClientRect(); }
  }

  wrap.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
  wrap.style.transformOrigin = 'top center';

  // After the browser paints the new transform, shift scroll so the anchor
  // element returns to exactly where it was relative to the viewport.
  if (anchor && anchorRectBefore && pageWrap) {
    requestAnimationFrame(() => {
      const anchorRectAfter = anchor.getBoundingClientRect();
      const delta = anchorRectAfter.top - anchorRectBefore.top;
      pageWrap.scrollTop += delta;
    });
  }
}

// Update zoom on a single-page wrap in-place
function _applySinglePageZoom() {
  const wrap = document.querySelector('#pageWrap .page-zoom-wrap');
  if (!wrap) { renderPage(); return; }
  const zoom = state.zoomLevel ?? 1.0;
  wrap.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
  wrap.style.transformOrigin = 'top center';
}

// Apply zoom transform to bookSpread only (overflow:hidden on container = no scrollbars)
function _applyBookZoom() {
  const spread = document.getElementById('bookSpread');
  const zoom = state.zoomLevel ?? 1.0;
  if (spread) {
    spread.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
    spread.style.transformOrigin = 'center center';
  }
}

// Returns the CSS class suffix for the current sharpness level
function _sharpClass() {
  const s = state.settings.lineSharpness || 0;
  return s > 0 ? ` sharp-${s}` : '';
}

