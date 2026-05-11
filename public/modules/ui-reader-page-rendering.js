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

function applyReaderTurnButtonLayout(mode = state.settings.readingMode) {
  const readerEl = $("reader");
  if (!readerEl) return;
  const isWebtoon = mode === "webtoon";
  const buttonsEnabled = state.settings.webtoonTurnButtonsEnabled !== false;
  const showButtons = isWebtoon && buttonsEnabled;
  const placement = (state.settings.webtoonTurnButtonPlacement === "bottom") ? "bottom" : "corners";
  readerEl.classList.toggle("reader-webtoon-nav-visible", showButtons);
  readerEl.classList.toggle("reader-webtoon-nav-bottom", showButtons && placement === "bottom");
  readerEl.classList.toggle("reader-webtoon-nav-corners", showButtons && placement === "corners");
}

function showReader() {
  const readerEl = $("reader");
  readerEl.classList.remove("hidden");
  document.documentElement.classList.add("reader-open");
  document.body.classList.add("reader-open");
  applyReaderBackground();
  if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
  const mode = state.settings.readingMode;
  // Reading defaults: manga spreads at 120%, webtoon/manhwa/manhua at 100%.
  state.zoomLevel = (mode === "ltr" || mode === "rtl") ? 1.2 : 1.0;
  const chapterMeta = state.allChapters?.[state.currentChapterIndex];
  const chapterNumber = chapterMeta?.chapter;
  const chapterName = state.currentChapter?.name || "";
  const chapterLabel = chapterNumber ? `Chapter ${chapterNumber}` : (chapterName || "Chapter");
  $("readerTitle").textContent = `${state.currentManga?.title || ""} - ${chapterLabel}`;
  updateZoomUI();
  applyReaderTurnButtonLayout(mode);
  _bindReaderArrowProximity(readerEl);
}

async function hideReader() {
  if (typeof stopReaderNoise === 'function') stopReaderNoise();
  stopAutoScroll();
  if (typeof _unbindWebtoonAutoNext === "function") _unbindWebtoonAutoNext();
  await recordReadingSession();
  // Restore reading mode if it was auto-overridden by webtoon detection
  if (state._preAutoReadingMode != null) {
    state.settings.readingMode = state._preAutoReadingMode;
    state._preAutoReadingMode = null;
  }
  const readerEl = $("reader");
  readerEl.classList.add("hidden");
  document.documentElement.classList.remove("reader-open");
  document.body.classList.remove("reader-open");
  readerEl.classList.remove("reader-sidebar-collapsed", "reader-arrow-visible");
  _unbindReaderArrowProximity(readerEl);
}

// ============================================================================
// AUTO-SCROLL & PAGE RENDERING (Consolidated from ui-autoscroll-1.js)
// ============================================================================

let _autoScrollRAF = null;
const AUTOSCROLL_SPEEDS = [0.2, 0.5, 1.0, 2.0, 3.5]; // px per animation frame
const READER_PREFETCH_AHEAD = 6;
const READER_PREFETCH_BEHIND = 1;
const READER_PREFETCH_MAX_CACHE = 36;
const _readerPrefetchCache = new Map();
const WEBTOON_AUTO_NEXT_THRESHOLD = 120;

let _webtoonAutoNextHandler = null;
let _webtoonAutoNextLoading = false;
let _webtoonAutoNextLastFromIndex = -1;
let _webtoonAutoNextCooldownUntil = 0;

function _unbindWebtoonAutoNext() {
  const wrap = $("pageWrap");
  if (wrap && _webtoonAutoNextHandler) {
    wrap.removeEventListener("scroll", _webtoonAutoNextHandler);
  }
  _webtoonAutoNextHandler = null;
  _webtoonAutoNextLoading = false;
}

function _bindWebtoonAutoNext() {
  const wrap = $("pageWrap");
  if (!wrap) return;

  _unbindWebtoonAutoNext();

  _webtoonAutoNextHandler = () => {
    if (state.settings.autoLoadNextChapter !== true) return;
    if (_webtoonAutoNextLoading) return;
    if (Date.now() < _webtoonAutoNextCooldownUntil) return;

    const nearBottom = (wrap.scrollTop + wrap.clientHeight) >= (wrap.scrollHeight - WEBTOON_AUTO_NEXT_THRESHOLD);
    if (!nearBottom) return;

    if (state.currentChapterIndex === _webtoonAutoNextLastFromIndex) return;

    const nextIdx = getNextChapterIndex(state.currentChapterIndex);
    const total = state.allChapters?.length || 0;
    if (nextIdx < 0 || nextIdx >= total) return;

    const fromIndex = state.currentChapterIndex;
    _webtoonAutoNextLastFromIndex = fromIndex;
    _webtoonAutoNextLoading = true;
    Promise.resolve(goToNextChapter()).finally(() => {
      _webtoonAutoNextLoading = false;
      _webtoonAutoNextCooldownUntil = Date.now() + 1200;
      if (state.currentChapterIndex === fromIndex) {
        _webtoonAutoNextLastFromIndex = -1;
      }
    });
  };

  wrap.addEventListener("scroll", _webtoonAutoNextHandler, { passive: true });
}

function _prefetchReaderImage(src) {
  if (!src || _readerPrefetchCache.has(src)) return;

  const img = new Image();
  img.decoding = "async";
  img.src = src;
  _readerPrefetchCache.set(src, img);

  while (_readerPrefetchCache.size > READER_PREFETCH_MAX_CACHE) {
    const oldestKey = _readerPrefetchCache.keys().next().value;
    _readerPrefetchCache.delete(oldestKey);
  }

  if (typeof img.decode === "function") {
    img.decode().catch(() => {});
  }
}

function prefetchReaderPages(pages, currentIdx) {
  if (!Array.isArray(pages) || !pages.length) return;

  const start = Math.max(0, currentIdx - READER_PREFETCH_BEHIND);
  const end = Math.min(pages.length - 1, currentIdx + READER_PREFETCH_AHEAD);
  for (let i = start; i <= end; i++) {
    const src = pages[i]?.img;
    if (src) _prefetchReaderImage(src);
  }
}

function startAutoScroll() {
  stopAutoScroll();
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  function tick() {
    const speedPx = AUTOSCROLL_SPEEDS[state.autoScroll.speed - 1] || 1.5;
    pageWrap.scrollTop += speedPx;
    _autoScrollRAF = requestAnimationFrame(tick);
  }
  _autoScrollRAF = requestAnimationFrame(tick);
}

function stopAutoScroll() {
  if (_autoScrollRAF !== null) {
    cancelAnimationFrame(_autoScrollRAF);
    _autoScrollRAF = null;
  }
}

function toggleAutoScroll() {
  state.autoScroll.enabled = !state.autoScroll.enabled;
  const btn   = $("autoScrollToggle");
  const bar   = $("autoScrollBar");
  if (btn) {
    btn.classList.toggle("active", state.autoScroll.enabled);
    btn.title = state.autoScroll.enabled ? "Stop AutoScroll" : "Start AutoScroll";
  }
  if (bar) bar.classList.toggle("is-disabled", !state.autoScroll.enabled);
  if (state.autoScroll.enabled) startAutoScroll();
  else stopAutoScroll();
}

function renderPage() {
  if (!state.currentChapter?.pages) return;

  if (state.currentChapter.isPDF && state.pdfDocument) {
    const _mode = state.settings.readingMode;
    if (_mode === 'webtoon')    renderPDFWebtoon();
    else if (_mode === 'rtl')   renderPDFSpread(true);
    else if (_mode === 'ltr')   renderPDFSpread(false);
    else                        renderPDFPageToCanvas(state.currentPageIndex + 1);
    return;
  }

  const pages   = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const idx     = state.currentPageIndex;
  const mode    = state.settings.readingMode;

  if (typeof applyReaderTurnButtonLayout === "function") {
    applyReaderTurnButtonLayout(mode);
  }

  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : "";

  if (mode === "webtoon") {
    pageWrap.className = "reader-content reading-mode-webtoon";
    const validPages = pages.filter(p => p.img);
    const nextWIdx = getNextChapterIndex(state.currentChapterIndex);
    const nextWCh  = (nextWIdx >= 0 && nextWIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextWIdx] : null;
    const nextWLabel = nextWCh ? (nextWCh.name || `Chapter ${nextWCh.chapter || nextWIdx + 1}`) : null;
    pageWrap.innerHTML = `
      <div class="page-zoom-wrap webtoon-wrap" ${zoomStyle}>
        ${validPages.map((p, i) => `<img src="${escapeHtml(p.img)}" alt="Page ${i + 1}" class="webtoon-page" loading="eager">`).join("")}
      </div>
      <div class="chapter-end-wrap">
        ${nextWLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextWLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
      </div>`;
    pageWrap.scrollTop = 0;
    $("pageCounter").textContent = `Webtoon Mode — ${validPages.length} pages`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
    _bindWebtoonAutoNext();
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);
  } else if (mode === "rtl") {
    _unbindWebtoonAutoNext();
    renderBookSpread();
    return;
  } else if (mode === "ltr") {
    _unbindWebtoonAutoNext();
    renderLTRSpread();
    return;
  } else {
    _unbindWebtoonAutoNext();
    pageWrap.className = "reader-content";
    if (idx < 0 || idx >= pages.length) return;
    prefetchReaderPages(pages, idx);
    const page     = pages[idx];
    const isLast   = idx === pages.length - 1;
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        <div class="chapter-end-divider"></div>
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : "";
    pageWrap.innerHTML = page.img
      ? `<div class="page-zoom-wrap" ${zoomStyle}><img src="${escapeHtml(page.img)}" alt="Page ${idx + 1}" class="${imgClass}"></div>${endBanner}`
      : `<div class="muted">Page not available</div>`;
    if (!isLast) pageWrap.scrollTop = 0;
    else pageWrap.scrollTo({ top: 0, behavior: "smooth" });

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  }
}

