// ============================================================================
// PDF READER
// ============================================================================
async function initPDFChapter(pdfUrl) {
  if (!window.pdfjsLib) { state.currentChapter.pages = []; return; }
  try {
    state.pdfDocument = await pdfjsLib.getDocument(pdfUrl).promise;
    const n = state.pdfDocument.numPages;
    state.currentChapter.pages = Array.from({ length: n }, (_, i) => ({ pdfPage: i + 1 }));
  } catch (e) {
    dbg.error(dbg.ERR_PDF, 'PDF load error', e);
    state.currentChapter.pages = [];
    state.pdfDocument = null;
  }
}

async function renderPDFWebtoon() {
  const pageWrap = $('pageWrap');
  if (!state.pdfDocument || !pageWrap) return;
  const pdf = state.pdfDocument;
  const total = pdf.numPages;
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : '';

  pageWrap.className = 'reader-content reading-mode-webtoon';
  pageWrap.innerHTML = `<div class="page-zoom-wrap webtoon-wrap" id="pdfWebtoonWrap" ${zoomStyle}></div>`;
  const wrap = pageWrap.querySelector('#pdfWebtoonWrap');

  $('pageCounter').textContent = `Webtoon Mode — ${total} pages`;
  $('prevPage').style.display = 'none';
  $('nextPage').style.display = 'none';
  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);

  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdf.getPage(i);
      const scale    = Math.max(state.zoomLevel, 1) * 1.5;
      const viewport = page.getViewport({ scale });
      const canvas   = document.createElement('canvas');
      canvas.className = 'webtoon-page';
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      // Abort if user navigated away
      if (pageWrap !== $('pageWrap') || !pageWrap.querySelector('#pdfWebtoonWrap')) return;
      wrap.appendChild(canvas);
    } catch (e) {
      dbg.warn(dbg.ERR_PDF, `PDF webtoon page ${i} error`, e);
    }
  }

  // Append chapter-end banner
  const nextIdx  = getNextChapterIndex(state.currentChapterIndex);
  const nextCh   = (nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
  const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
  pageWrap.insertAdjacentHTML('beforeend', `
    <div class="chapter-end-wrap">
      ${nextLabel
        ? `<p class="chapter-end-label">Next Chapter</p>
           <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
           <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
        : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
    </div>`);
}

async function renderPDFPageToCanvas(pageNum) {
  const pageWrap = $("pageWrap");
  if (!state.pdfDocument || !pageWrap) return;
  try {
    const pdf  = state.pdfDocument;
    const page = await pdf.getPage(pageNum);
    const scale    = Math.max(state.zoomLevel, 1) * 1.5;
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.className = 'page-img';
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const isLast   = pageNum === pdf.numPages;
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : '';

    pageWrap.className = 'reader-content' + _sharpClass();
    pageWrap.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'page-zoom-wrap';
    if (state.zoomLevel !== 1.0) wrap.style.cssText = `transform:scale(${state.zoomLevel});transform-origin:top center;`;
    wrap.appendChild(canvas);
    pageWrap.appendChild(wrap);
    if (endBanner) pageWrap.insertAdjacentHTML('beforeend', endBanner);

    $("pageCounter").textContent = `${pageNum} / ${pdf.numPages}`;
    $("prevPage").style.display = 'block';
    $("nextPage").style.display = 'block';
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    pageWrap.scrollTop = 0;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, pageNum - 1);
  } catch (e) {
    dbg.error(dbg.ERR_PDF, 'PDF render error', e);
  }
}

function updateZoomUI() {
  const el = $("zoomLevel");
  if (el) el.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

// PDF book-spread renderer for RTL (manga) and LTR modes.
// noFade=true when called right after the flip animation (flip itself is the transition)
async function renderPDFSpread(isRTL, noFade = false) {
  const pageWrap = $('pageWrap');
  if (!state.pdfDocument || !pageWrap) return;
  const pdf   = state.pdfDocument;
  const total = pdf.numPages;
  const idx   = state.currentPageIndex;
  const pNum1 = idx + 1;
  const pNum2 = idx + 2;

  const pv = $('prevPage'), nx = $('nextPage');
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0
    && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = 'block'; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = 'block'; nx.disabled = pNum1 >= total && !hasNextCh; }
  $('pageCounter').textContent = pNum2 <= total
    ? `${pNum1}-${pNum2} / ${total}`
    : `${pNum1} / ${total}`;

  pageWrap.className = `reader-content ${isRTL ? 'reading-mode-rtl' : 'reading-mode-ltr'}` + _sharpClass();
  pageWrap.style.overflow = '';
  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap">
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left"  id="bookLeft"></div>
        ${state.settings.showBookSpine !== false ? '<div class="book-spine"></div>' : ''}
        <div class="book-side book-right" id="bookRight"></div>
      </div>
    </div>`;

  if (pNum1 >= total) {
    const nextIdx   = getNextChapterIndex(state.currentChapterIndex);
    const nextCh    = (nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    pageWrap.insertAdjacentHTML('beforeend', `
      <div class="chapter-end-wrap">
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>`);
  }

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();

  const scale = Math.max(state.zoomLevel, 1) * 1.5;

  // Pre-render both pages offscreen, then inject in one shot to avoid blank-panel flash
  async function renderToCanvas(pdfPageNum) {
    if (pdfPageNum < 1 || pdfPageNum > total) return null;
    try {
      const p   = await pdf.getPage(pdfPageNum);
      const vp  = p.getViewport({ scale });
      const cvs = document.createElement('canvas');
      cvs.className = 'book-page-img';
      cvs.width  = vp.width;
      cvs.height = vp.height;
      cvs.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      await p.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
      return cvs;
    } catch (e) { dbg.warn(dbg.ERR_PDF, 'PDF spread render error', e); return null; }
  }

  const [cvs1, cvs2] = await Promise.all([ renderToCanvas(pNum1), renderToCanvas(pNum2) ]);
  if (!$('bookSpread')) return; // reader closed while rendering

  const sL = $('bookLeft'), sR = $('bookRight');
  if (!noFade) {
    if (sL) sL.style.opacity = '0';
    if (sR) sR.style.opacity = '0';
  }
  if (isRTL) {
    if (cvs1 && sR) sR.appendChild(cvs1);
    if (cvs2 && sL) sL.appendChild(cvs2);
  } else {
    if (cvs1 && sL) sL.appendChild(cvs1);
    if (cvs2 && sR) sR.appendChild(cvs2);
  }
  if (!noFade) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (sL) { sL.style.transition = 'opacity 0.18s ease'; sL.style.opacity = '1'; }
      if (sR) { sR.style.transition = 'opacity 0.18s ease'; sR.style.opacity = '1'; }
    }));
  }
  // Restore zoom (bookSpread DOM was rebuilt so transform must be re-applied)
  _applyBookZoom();
}

