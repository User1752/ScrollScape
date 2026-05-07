// ============================================================================
// BOOK READER — RTL double-page spread with 3D page-flip
// ============================================================================

let _bookFlipAnimating = false;
const WIDE_PAGE_RATIO_THRESHOLD = 1.33;
const _bookImageMeta = new Map(); // src -> { width, height, isWide }

function _cacheBookImageMeta(src, imgLike) {
  if (!src || !imgLike?.naturalWidth || !imgLike?.naturalHeight) return;
  const ratio = imgLike.naturalWidth / Math.max(1, imgLike.naturalHeight);
  _bookImageMeta.set(src, {
    width: imgLike.naturalWidth,
    height: imgLike.naturalHeight,
    isWide: ratio >= WIDE_PAGE_RATIO_THRESHOLD,
  });
}

function _hydrateWideFlagFromCache(page) {
  if (!page || page.isWide || !page.img) return;
  const meta = _bookImageMeta.get(page.img);
  if (meta?.isWide) page.isWide = true;
}

function _prepareBookImages(root = document) {
  const imgs = root.querySelectorAll('img.book-page-img');
  imgs.forEach((img) => {
    img.decoding = 'async';
    img.loading = 'eager';
    if (img.dataset.prepared === '1') return;
    img.dataset.prepared = '1';

    const reveal = () => {
      _cacheBookImageMeta(img.currentSrc || img.src, img);
      img.classList.add('is-ready');
    };

    if (img.complete && img.naturalWidth > 0) {
      // Already available in memory/cache: reveal immediately to avoid black flashes.
      reveal();
      return;
    }

    img.addEventListener('load', () => {
      // Reveal as soon as it loads; decode can happen progressively after paint.
      reveal();
    }, { once: true });
  });
}

function getBookSpread(idx, pages) {
  _hydrateWideFlagFromCache(pages[idx]);
  const page = pages[idx];
  // Wide (double-page scan): same image fills both panels, each showing one half
  if (page?.isWide) {
    return { right: page.img || null, left: page.img || null, isWide: true };
  }
  return {
    right: pages[idx]?.img     || null,
    left:  pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// LTR (Western) spread: left = pages[idx], right = pages[idx+1]
function getLTRSpread(idx, pages) {
  _hydrateWideFlagFromCache(pages[idx]);
  const page = pages[idx];
  if (page?.isWide) {
    return { left: page.img || null, right: page.img || null, isWide: true };
  }
  return {
    left:  pages[idx]?.img     || null,
    right: pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// After rendering a spread, check whether the idx page image is a wide double-page scan.
// RTL: pages[idx] is on the right panel. LTR: pages[idx] is on the left panel.
// If wide, mutate both panels in-place to show left/right halves of the same source.
// After rendering a spread, probe both panel images.
// If either is landscape (wider than tall) it is a double-page scan —
// overlay it as ONE full-spread image covering both panels.
// Inject a full-spread overlay image for a wide (double-page scan) page.
// The overlay is position:absolute inset:0 on the book-spread, showing
// the image with object-fit:contain — no per-panel CSS math needed.
function _injectWideOverlay(src, idx, pages) {
  const spread = document.getElementById('bookSpread');
  if (!spread) return;
  // Blank both panels
  const sL = document.getElementById('bookLeft');
  const sR = document.getElementById('bookRight');
  if (sL) sL.innerHTML = '<div class="book-page-blank"></div>';
  if (sR) sR.innerHTML = '<div class="book-page-blank"></div>';
  if (sL) sL.className = sL.className.replace(/\bwide-source-\S+/g, '').trim();
  if (sR) sR.className = sR.className.replace(/\bwide-source-\S+/g, '').trim();
  document.getElementById('bookWideOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'bookWideOverlay';
  overlay.className = 'book-wide-overlay';
  const img = new Image();
  img.src = src;
  overlay.appendChild(img);
  spread.appendChild(overlay);
  const show = () => overlay.classList.add('visible');
  if (img.complete && img.naturalWidth > 0) requestAnimationFrame(show);
  else img.addEventListener('load', show, { once: true });
  const total = (pages || []).length;
  const ctr = $('pageCounter');
  if (ctr && total) ctr.textContent = `${idx + 1} / ${total}`;
}

// Called after a flip completes. If page is already known wide → inject overlay.
// If not yet known → probe image dimensions async and inject when ready.
function _applyWideForCurrentPage(idx, pages) {
  _hydrateWideFlagFromCache(pages[idx]);
  if (pages[idx]?.isWide) {
    if (!document.getElementById('bookWideOverlay')) {
      _injectWideOverlay(pages[idx].img, idx, pages);
    }
    return;
  }
  _applyWideSplitIfNeeded(idx, pages);
}

function _applyWideSplitIfNeeded(idx, pages) {
  if (pages[idx]?.isWide) return;
  const selector = state.settings.readingMode === 'ltr'
    ? '#bookLeft img.book-page-img'
    : '#bookRight img.book-page-img';
  const probe = document.querySelector(selector);
  if (!probe) return;
  let applied = false;
  const check = () => {
    if (applied) return;
    if (state.currentPageIndex !== idx) return;
    if (!probe.naturalWidth) return;
    const ratio = probe.naturalWidth / Math.max(1, probe.naturalHeight);
    if (ratio < WIDE_PAGE_RATIO_THRESHOLD) return;
    applied = true;
    if (pages[idx]) pages[idx].isWide = true;
    _cacheBookImageMeta(probe.src, probe);
    _injectWideOverlay(probe.src, idx, pages);
  };
  if (probe.complete && probe.naturalWidth > 0) check();
  else probe.addEventListener('load', check, { once: true });
}

function renderBookSpread() {
  if (!state.currentChapter?.pages) return;
  // PDF: use canvas-based spread
  if (state.currentChapter.isPDF && state.pdfDocument) { renderPDFSpread(true); return; }
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getBookSpread(idx, pages);
  const { right: rightImg, left: leftImg, isWide } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-rtl' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = isWide ? 1 : 2;
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const r = idx + 1, l = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${r} / ${total}`
    : (l <= total ? `${r}-${l} / ${total}` : `${r} / ${total}`);

  const wrapZoomStyle = '';

  // RTL: right panel reads first.
  // Wide pages: both panels blank, a full-spread overlay is shown instead.
  const rightHtml = (rightImg && !isWide)
    ? `<img class="book-page-img" src="${escapeHtml(rightImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const leftHtml = (leftImg && !isWide)
    ? `<img class="book-page-img" src="${escapeHtml(leftImg)}" alt="Page ${idx + 2}">`
    : `<div class="book-page-blank"></div>`;
  const overlayHtml = isWide && rightImg
    ? `<div class="book-wide-overlay visible" id="bookWideOverlay"><img src="${escapeHtml(rightImg)}"></div>`
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

  _prepareBookImages(pageWrap);

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  if (!isWide) _applyWideSplitIfNeeded(idx, pages);
}

function attachBookDragEvents() {
  const spread = $("bookSpread");
  if (!spread || spread.dataset.dragAttached) return;
  spread.dataset.dragAttached = "1";

  let startX = 0;
  let dragSide = null;
  let active   = false;

  spread.addEventListener("pointerdown", e => {
    if (e.button && e.pointerType === "mouse") return;
    const rect = spread.getBoundingClientRect();
    dragSide = (e.clientX - rect.left) > rect.width / 2 ? "right" : "left";
    startX   = e.clientX;
    active   = true;
    spread.setPointerCapture(e.pointerId);
  }, { passive: true });

  spread.addEventListener("pointerup", e => {
    if (!active) return;
    active = false;
    const dx = e.clientX - startX;
    const tap = Math.abs(dx) < 12;
    const isRTL = state.settings.readingMode === "rtl";
    const _navigate = state.settings.readingMode === "ltr" ? navigateLTR : navigateBook;
    // RTL (manga): left side = next pages, right side = previous pages
    // LTR: right side = next pages, left side = previous pages
    if (dragSide === "right" && (dx < -50 || tap))  _navigate(isRTL ? "backward" : "forward");
    if (dragSide === "left"  && (dx >  50 || tap))  _navigate(isRTL ? "forward"  : "backward");
  });
}

function navigateBook(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  // PDF: use canvas-capture flip animation
  if (state.currentChapter?.isPDF && state.pdfDocument) {
    if (_bookFlipAnimating) return;
    if (direction === 'forward') {
      if (idx + 2 >= total) { goToNextChapter(); return; }
      newIdx = idx + 2;
    } else {
      if (idx === 0) { goToPrevChapter(); return; }
      newIdx = Math.max(0, idx - 2);
    }
    _bookFlipAnimating = true;
    playPDFFlip(true, direction, idx, newIdx, () => {
      state.currentPageIndex = newIdx;
      _bookFlipAnimating = false;
      renderPDFSpread(true, true); // noFade: flip was already the animation
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
    const step = pages[idx]?.isWide ? 1 : 2;
    if (idx + step >= total) { _bookFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _bookFlipAnimating = false; goToPrevChapter(); return; }
    // Step back by 1 if the preceding page is a wide page, else by 2
    const backStep = pages[idx - 1]?.isWide ? 1 : 2;
    newIdx = Math.max(0, idx - backStep);
  }

  if (_bookFlipAnimating) return;

  // Sync-probe destination page — catches images already in browser cache
  // so playBookFlip sees the correct isWide flag without waiting for async load.
  _syncProbeWide(pages[newIdx]);

  // No-animation mode: just re-render instantly.
  if (state.settings.pageFlipAnimation === false) {
    state.currentPageIndex = newIdx;
    renderBookSpread();
    return;
  }

  _bookFlipAnimating = true;
  // RTL (manga): spine is on the right. "forward" = left page flips rightward → invert animation direction
  const animDir = direction === "forward" ? "backward" : "forward";
  playBookFlip(animDir, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _bookFlipAnimating = false;
    // Update counter + nav buttons in-place — no DOM rebuild, no flash
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = isWide2 ? 1 : 2;
    const r = newIdx + 1, l = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${r} / ${total2}` : (l <= total2 ? `${r}-${l} / ${total2}` : `${r} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideForCurrentPage(newIdx, pages);
  });
}

function playBookFlip(direction, oldIdx, newIdx, pages, onComplete, getSpread = getBookSpread) {
  const spread = $("bookSpread");
  if (!spread) { onComplete(); return; }

  // Remove any wide-page overlay from the previous spread immediately
  // Remove existing overlay before animating — panels need to be visible for the flip.
  document.getElementById('bookWideOverlay')?.remove();

  const newSpread = getSpread(newIdx, pages);
  const newIsWide = newSpread.isWide;
  const nRight = newSpread.right;
  const nLeft  = newSpread.left;
  const isForward = direction === "forward";

  const sL = document.getElementById("bookLeft");
  const sR = document.getElementById("bookRight");

  const mkImg = (src) =>
    src ? `<img class="book-page-img" src="${escapeHtml(src)}">` : `<div class="book-page-blank"></div>`;

  // Clone the existing rendered <img> from the panel that is about to flip.
  const flipPanel   = isForward ? sR : sL;
  const existingImg = flipPanel?.querySelector("img");
  const frontClone  = existingImg ? existingImg.cloneNode() : null;

  // Panel UNDER the flipper: hidden by flipper at t=0, loads silently.
  // For wide destination: keep blank — overlay will appear after flip via _applyWideForCurrentPage.
  if (isForward) {
    if (sR) sR.innerHTML = newIsWide ? '<div class="book-page-blank"></div>' : mkImg(nRight);
  } else {
    if (sL) sL.innerHTML = newIsWide ? '<div class="book-page-blank"></div>' : mkImg(nLeft);
  }
  _prepareBookImages(spread);

  const w = spread.offsetWidth / 2;
  const h = spread.offsetHeight;

  // ── FLIPPER ────────────────────────────────────────────────────────────────
  const flipper = document.createElement("div");
  Object.assign(flipper.style, {
    position:        "absolute",
    top:             "0",
    width:           w + "px",
    height:          h + "px",
    transformStyle:  "preserve-3d",
    zIndex:          "20",
    left:            isForward ? w + "px" : "0px",
    transformOrigin: isForward ? "left center" : "right center",
    willChange:      "transform",
  });

  // ── Front face: the currently visible page (cloned → always loaded) ─────────
  const front = document.createElement("div");
  front.className = "book-flipper-face book-flipper-front";
  if (frontClone) {
    frontClone.className = "book-page-img";
    front.appendChild(frontClone);
  } else {
    front.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on front face (darkens toward the fold seam)
  const curlShadow = document.createElement("div");
  curlShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);"
      : "background:linear-gradient(to left,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);",
  ].join("");
  front.appendChild(curlShadow);

  // ── Back face: the new incoming page (shown as the page lands) ──────────────
  // Forward: lands on LEFT; Backward: lands on RIGHT.
  // For wide pages: show blank on back face — overlay appears after flip.
  const backSrc = newIsWide ? null : (isForward ? nLeft : nRight);
  const back = document.createElement("div");
  back.className = "book-flipper-face book-flipper-back";
  if (backSrc) {
    const bi = new Image();
    bi.className = 'book-page-img is-ready';
    bi.src = backSrc;
    back.appendChild(bi);
  } else {
    back.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on back face (mirrored direction)
  const backShadow = document.createElement("div");
  backShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to left,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);"
      : "background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);",
  ].join("");
  back.appendChild(backShadow);

  flipper.appendChild(front);
  flipper.appendChild(back);

  // ── Cast-shadow on the stationary page ─────────────────────────────────────
  const castShadow = document.createElement("div");
  Object.assign(castShadow.style, {
    position:      "absolute",
    top:           "0",
    width:         w + "px",
    height:        h + "px",
    left:          isForward ? "0px" : w + "px",
    zIndex:        "19",
    pointerEvents: "none",
    opacity:       "0",
    background:    isForward
      ? "linear-gradient(to left,rgba(0,0,0,0.55) 0%,transparent 65%)"
      : "linear-gradient(to right,rgba(0,0,0,0.55) 0%,transparent 65%)",
  });
  spread.appendChild(castShadow);
  spread.appendChild(flipper);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const DURATION = 520;
  let startTime  = null;
  let done       = false;
  let midUpdated = false; // flag: update opposite panel once at ~50% (hidden by flipper)

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(ts) {
    if (done) return;
    if (!startTime) startTime = ts;

    const raw = Math.min((ts - startTime) / DURATION, 1);
    const et  = ease(raw);
    const angle = isForward ? -180 * et : 180 * et;

    flipper.style.transform = `rotateY(${angle}deg)`;

    // At ~50% the flipper is edge-on and covers the opposite panel completely.
    // Update it now so the image has the remaining ~260ms to decode before reveal.
    if (!midUpdated && raw >= 0.48) {
      midUpdated = true;
      if (!newIsWide) {
        // Normal page: update opposite panel mid-flip while hidden by flipper.
        if (isForward) { if (sL) sL.innerHTML = mkImg(nLeft); }
        else           { if (sR) sR.innerHTML = mkImg(nRight); }
        _prepareBookImages(spread);
      }
      // Wide page: leave panels blank — overlay appears after flip.
    }

    // Shadow intensity peaks at 90° fold (sin curve)
    const peak = Math.sin(et * Math.PI);
    curlShadow.style.opacity = (peak * 0.90).toFixed(3);
    backShadow.style.opacity = (peak * 0.82).toFixed(3);
    castShadow.style.opacity = (peak * 0.68).toFixed(3);

    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      finish();
    }
  }

  function finish() {
    if (done) return;
    done = true;
    flipper.remove();
    castShadow.remove();
    // Ensure opposite panel has correct content before handing back
    if (!midUpdated && !newIsWide) {
      if (isForward) { if (sL) sL.innerHTML = mkImg(nLeft); }
      else           { if (sR) sR.innerHTML = mkImg(nRight); }
    }
    _prepareBookImages(spread);
    onComplete();
  }

  requestAnimationFrame(frame);
  setTimeout(finish, DURATION + 300); // safety fallback
}

// ============================================================================
// PDF page-flip animation — same 3-D flip engine, but sources come from
// PDF.js canvas captures / offscreen renders instead of <img src=...>
// ============================================================================
async function playPDFFlip(isRTL, direction, oldIdx, newIdx, onComplete) {
  const pdf = state.pdfDocument;
  const spread = document.getElementById('bookSpread');
  if (!spread || !pdf) { onComplete(); return; }

  // In RTL (manga) mode the animation direction is inverted relative to
  // the navigation direction (same inversion as in navigateBook → playBookFlip).
  const isAnimForward = isRTL ? direction !== 'forward' : direction === 'forward';

  const sL = document.getElementById('bookLeft');
  const sR = document.getElementById('bookRight');

  // ── Capture an existing panel canvas as a dataURL ──────────────────────────
  async function capturePanel(panel) {
    const canvas = panel?.querySelector('canvas');
    if (!canvas) return null;
    try { return canvas.toDataURL(); } catch (e) { return null; }
  }

  // ── Render one PDF page to an offscreen canvas and return its dataURL ───────
  async function pdfPageToDataURL(pageNum) {
    if (pageNum < 1 || pageNum > pdf.numPages) return null;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const c = document.createElement('canvas');
      c.width = viewport.width; c.height = viewport.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
      return c.toDataURL();
    } catch (e) { return null; }
  }

  // Back-face page number (the new page revealed as the flipper lands).
  // Formula derived from spread layout:
  //   RTL: right=pages[idx], left=pages[idx+1]  → 1-based: right=idx+1, left=idx+2
  //   LTR: left=pages[idx], right=pages[idx+1]  → 1-based: left=idx+1, right=idx+2
  // isAnimForward=true  → flipper sweeps from right panel, back lands on LEFT
  //   RTL backward : new left = newIdx+2
  //   LTR forward  : new left = newIdx+1
  // isAnimForward=false → flipper sweeps from left panel, back lands on RIGHT
  //   RTL forward  : new right = newIdx+1
  //   LTR backward : new right = newIdx+2
  const backPageNum = (isAnimForward === isRTL) ? newIdx + 2 : newIdx + 1;

  // Gather dataURLs in parallel
  const flipPanel = isAnimForward ? sR : sL;
  const [frontDataURL, backDataURL] = await Promise.all([
    capturePanel(flipPanel),
    pdfPageToDataURL(backPageNum),
  ]);

  const mkImgEl = (dataURL) => {
    if (!dataURL) { const d = document.createElement('div'); d.className = 'book-page-blank'; return d; }
    const img = new Image(); img.src = dataURL; img.className = 'book-page-img'; return img;
  };

  // Pre-fill the panel under the flipper with the back-face content so it is
  // ready the instant the flipper is removed.
  if (isAnimForward) {
    if (sR) { sR.innerHTML = ''; sR.appendChild(mkImgEl(backDataURL)); }
  } else {
    if (sL) { sL.innerHTML = ''; sL.appendChild(mkImgEl(backDataURL)); }
  }

  const w = spread.offsetWidth / 2;
  const h = spread.offsetHeight;

  // ── Flipper element ─────────────────────────────────────────────────────────
  const flipper = document.createElement('div');
  Object.assign(flipper.style, {
    position: 'absolute', top: '0', width: w + 'px', height: h + 'px',
    transformStyle: 'preserve-3d', zIndex: '20',
    left: isAnimForward ? w + 'px' : '0px',
    transformOrigin: isAnimForward ? 'left center' : 'right center',
    willChange: 'transform',
  });

  // Front face — currently visible panel (captured as dataURL → always loaded)
  const front = document.createElement('div');
  front.className = 'book-flipper-face book-flipper-front';
  if (frontDataURL) front.appendChild(mkImgEl(frontDataURL));
  else front.innerHTML = '<div class="book-page-blank"></div>';

  const curlShadow = document.createElement('div');
  curlShadow.style.cssText = [
    'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:3;opacity:0;',
    isAnimForward
      ? 'background:linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);'
      : 'background:linear-gradient(to left,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);',
  ].join('');
  front.appendChild(curlShadow);

  // Back face — incoming page
  const back = document.createElement('div');
  back.className = 'book-flipper-face book-flipper-back';
  back.appendChild(mkImgEl(backDataURL));

  const backShadow = document.createElement('div');
  backShadow.style.cssText = [
    'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:3;opacity:0;',
    isAnimForward
      ? 'background:linear-gradient(to left,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);'
      : 'background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);',
  ].join('');
  back.appendChild(backShadow);

  flipper.appendChild(front);
  flipper.appendChild(back);

  // Cast shadow on the stationary side
  const castShadow = document.createElement('div');
  Object.assign(castShadow.style, {
    position: 'absolute', top: '0', width: w + 'px', height: h + 'px',
    left: isAnimForward ? '0px' : w + 'px',
    zIndex: '19', pointerEvents: 'none', opacity: '0',
    background: isAnimForward
      ? 'linear-gradient(to left,rgba(0,0,0,0.55) 0%,transparent 65%)'
      : 'linear-gradient(to right,rgba(0,0,0,0.55) 0%,transparent 65%)',
  });
  spread.appendChild(castShadow);
  spread.appendChild(flipper);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const DURATION = 520;
  let startTime = null, done = false;

  function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  function frame(ts) {
    if (done) return;
    if (!startTime) startTime = ts;
    const raw = Math.min((ts - startTime) / DURATION, 1);
    const et  = ease(raw);
    flipper.style.transform = `rotateY(${isAnimForward ? -180 * et : 180 * et}deg)`;
    const peak = Math.sin(et * Math.PI);
    curlShadow.style.opacity = (peak * 0.90).toFixed(3);
    backShadow.style.opacity = (peak * 0.82).toFixed(3);
    castShadow.style.opacity = (peak * 0.68).toFixed(3);
    if (raw < 1) requestAnimationFrame(frame); else finish();
  }

  function finish() {
    if (done) return;
    done = true;
    flipper.remove();
    castShadow.remove();
    onComplete();
  }

  requestAnimationFrame(frame);
  setTimeout(finish, DURATION + 300); // safety fallback
}

// Pre-fetch images for the next 3 spreads (6 pages) and 1 previous spread
function preloadBookPages(idx, pages) {
  const srcs = new Set();
  const markBySrc = new Map();
  for (let offset = -2; offset <= 8; offset += 2) {
    const si = idx + offset;
    if (si < 0 || si >= pages.length) continue;
    const { right, left } = getBookSpread(si, pages);
    const page = pages[si];
    if (right) {
      srcs.add(right);
      if (!markBySrc.has(right)) markBySrc.set(right, []);
      if (page) markBySrc.get(right).push(page);
    }
    if (left) {
      srcs.add(left);
      if (!markBySrc.has(left)) markBySrc.set(left, []);
      if (page) markBySrc.get(left).push(page);
    }
  }
  srcs.forEach(src => {
    const known = _bookImageMeta.get(src);
    if (known) {
      if (known.isWide) {
        (markBySrc.get(src) || []).forEach(p => { if (p) p.isWide = true; });
      }
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    // Synchronous path: image already in browser cache
    if (img.complete && img.naturalWidth > 0) {
      _cacheBookImageMeta(src, img);
      const meta = _bookImageMeta.get(src);
      if (meta?.isWide) {
        (markBySrc.get(src) || []).forEach(p => { if (p) p.isWide = true; });
      }
      return;
    }
    img.addEventListener('load', () => {
      _cacheBookImageMeta(src, img);
      const meta = _bookImageMeta.get(src);
      if (meta?.isWide) {
        (markBySrc.get(src) || []).forEach(p => { if (p) p.isWide = true; });
      }
    }, { once: true });
  });
}

// Synchronously probe a page's image for wide-detection using browser cache.
// If the image is in HTTP cache, new Image() resolves dimensions immediately.
function _syncProbeWide(page) {
  if (!page || page.isWide || !page.img) return;
  if (_bookImageMeta.has(page.img)) {
    _hydrateWideFlagFromCache(page);
    return;
  }
  const probe = new Image();
  probe.src = page.img;
  if (probe.complete && probe.naturalWidth > 0) {
    _cacheBookImageMeta(page.img, probe);
    _hydrateWideFlagFromCache(page);
  }
}

