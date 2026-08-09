// ============================================================================
// EPUB READER (local book import)
// ============================================================================
// Separate from the manga/PDF reader (#reader) on purpose: EPUB content
// reflows to the viewport/font size instead of being discrete page images,
// so it's rendered by epub.js into its own view (#epubReader) rather than
// being forced into the page-counter/spread engine built for fixed images.
// epub.js/JSZip are loaded from a CDN (see index.html), same convention as
// PDF.js — see _waitForEpubJs() below for the same "give the CDN script a
// few seconds" pattern already used for PDF.js in ui-local-import.js.

let _epubBook = null;
let _epubRendition = null;
let _epubToc = [];
let _epubKeyHandlerBound = false;

const EPUB_PROGRESS_KEY   = 'scrollscapeEpubProgress';
const EPUB_FONT_SIZE_KEY  = 'scrollscapeEpubFontSize';
const EPUB_THEME_KEY      = 'scrollscapeEpubTheme';

function _epubProgressStore() {
  try { return JSON.parse(localStorage.getItem(EPUB_PROGRESS_KEY) || '{}') || {}; }
  catch { return {}; }
}

function _saveEpubProgress(mangaId, cfi) {
  if (!mangaId || !cfi) return;
  const store = _epubProgressStore();
  store[mangaId] = cfi;
  localStorage.setItem(EPUB_PROGRESS_KEY, JSON.stringify(store));
}

function _getEpubProgress(mangaId) {
  return mangaId ? (_epubProgressStore()[mangaId] || null) : null;
}

async function _waitForEpubJs() {
  if (window.ePub) return true;
  await new Promise(resolve => {
    let waited = 0;
    const iv = setInterval(() => {
      waited += 250;
      if (window.ePub || waited >= 10000) { clearInterval(iv); resolve(); }
    }, 250);
  });
  return !!window.ePub;
}

async function openEpubReader(epubUrl) {
  if (!(await _waitForEpubJs())) {
    showToast("Error", "EPUB reader failed to load. Check your internet connection.", "error");
    return;
  }

  const readerEl = $("epubReader");
  const viewerEl = $("epubViewer");
  if (!readerEl || !viewerEl) return;

  readerEl.classList.remove("hidden");
  document.documentElement.classList.add("reader-open");
  document.body.classList.add("reader-open");
  if ($("epubReaderTitle")) $("epubReaderTitle").textContent = state.currentManga?.title || "";
  viewerEl.innerHTML = "";

  _epubBook = ePub(epubUrl);
  _epubRendition = _epubBook.renderTo(viewerEl, {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "auto",
  });

  const savedFontPct = parseInt(localStorage.getItem(EPUB_FONT_SIZE_KEY) || '100', 10) || 100;
  _epubRendition.themes.fontSize(`${savedFontPct}%`);
  if ($("epubFontLevel")) $("epubFontLevel").textContent = `${savedFontPct}%`;

  _epubRendition.themes.register('epub-light', { body: { background: '#f4f1ea', color: '#222' } });
  _epubRendition.themes.register('epub-dark',  { body: { background: '#1b1b1f', color: '#ddd' } });
  _epubRendition.themes.select(localStorage.getItem(EPUB_THEME_KEY) || 'epub-dark');

  const mangaId = state.currentManga?.id;
  const savedCfi = _getEpubProgress(mangaId);
  try {
    await _epubRendition.display(savedCfi || undefined);
  } catch (e) {
    dbg.error(dbg.ERR_EPUB, 'EPUB display error', e);
    showToast("Error", "Could not open this EPUB file.", "error");
  }

  _epubRendition.on('relocated', (location) => {
    const pct = Math.round((location?.start?.percentage || 0) * 100);
    if ($("epubProgress")) $("epubProgress").textContent = `${pct}%`;
    // location.start.cfi's own type isn't nailed down in epub.js's public
    // docs (its JSDoc just says "EpubCFI") — coerce to a plain string
    // rather than assume, since that's what rendition.display() needs
    // back on resume either way.
    const cfi = location?.start?.cfi ? String(location.start.cfi) : null;
    if (mangaId && cfi) {
      _saveEpubProgress(mangaId, cfi);
      updateReadingProgress(mangaId, state.currentChapter?.id, 0);
    }
  });

  try {
    const nav = await _epubBook.loaded.navigation;
    _epubToc = nav?.toc || [];
  } catch (_) {
    _epubToc = [];
  }
  _renderEpubToc();
  _bindEpubControls();

  // Percentage in the 'relocated' event only works once book.locations has
  // been populated — it's what maps a CFI to a location index and back.
  // Generated in the background (walks every spine section) so it doesn't
  // delay the initial page render; reportLocation() re-emits 'relocated'
  // once it's ready so the % shown catches up to wherever the reader
  // already landed.
  _epubBook.locations.generate(1024).then(() => {
    _epubRendition?.reportLocation();
  }).catch(() => {});
}

function _renderEpubToc() {
  const tocEl = $("epubToc");
  if (!tocEl) return;
  if (!_epubToc.length) {
    tocEl.innerHTML = '<p class="muted" style="margin:0">No table of contents.</p>';
    return;
  }
  tocEl.innerHTML = _epubToc.map(item =>
    `<button type="button" class="epub-toc-item" data-href="${escapeHtml(item.href || '')}">${escapeHtml((item.label || '').trim())}</button>`
  ).join('');
  tocEl.querySelectorAll('.epub-toc-item').forEach(btn => {
    btn.onclick = () => _epubRendition?.display(btn.dataset.href);
  });
}

function _adjustEpubFontSize(deltaPct) {
  const levelEl = $("epubFontLevel");
  const current = parseInt((levelEl?.textContent || '100').replace('%', ''), 10) || 100;
  const next = Math.min(200, Math.max(60, current + deltaPct));
  _epubRendition?.themes.fontSize(`${next}%`);
  if (levelEl) levelEl.textContent = `${next}%`;
  localStorage.setItem(EPUB_FONT_SIZE_KEY, String(next));
}

function _setEpubTheme(theme) {
  _epubRendition?.themes.select(theme);
  localStorage.setItem(EPUB_THEME_KEY, theme);
}

function _epubKeyHandler(e) {
  if ($("epubReader")?.classList.contains("hidden")) return;
  if (e.key === 'ArrowRight') _epubRendition?.next();
  else if (e.key === 'ArrowLeft') _epubRendition?.prev();
  else if (e.key === 'Escape') closeEpubReader();
}

function _bindEpubControls() {
  const prev = () => _epubRendition?.prev();
  const next = () => _epubRendition?.next();
  if ($("epubPrevBtn"))    $("epubPrevBtn").onclick = prev;
  if ($("epubNextBtn"))    $("epubNextBtn").onclick = next;
  if ($("epubPrevCorner")) $("epubPrevCorner").onclick = prev;
  if ($("epubNextCorner")) $("epubNextCorner").onclick = next;

  if ($("epubFontDown")) $("epubFontDown").onclick = () => _adjustEpubFontSize(-10);
  if ($("epubFontUp"))   $("epubFontUp").onclick   = () => _adjustEpubFontSize(10);
  if ($("epubThemeLight")) $("epubThemeLight").onclick = () => _setEpubTheme('epub-light');
  if ($("epubThemeDark"))  $("epubThemeDark").onclick  = () => _setEpubTheme('epub-dark');

  if ($("closeEpubReader")) $("closeEpubReader").onclick = closeEpubReader;
  if ($("epubSidebarToggle")) {
    $("epubSidebarToggle").onclick = () => {
      $("epubReader")?.classList.toggle("reader-sidebar-collapsed");
      // Rendition's paginated layout is sized to the viewer's current
      // width — force it to recompute now that the sidebar changed that.
      setTimeout(() => _epubRendition?.resize(), 200);
    };
  }

  if (!_epubKeyHandlerBound) {
    _epubKeyHandlerBound = true;
    document.addEventListener('keydown', _epubKeyHandler);
  }
}

async function closeEpubReader() {
  const readerEl = $("epubReader");
  if (readerEl) readerEl.classList.add("hidden");
  document.documentElement.classList.remove("reader-open");
  document.body.classList.remove("reader-open");

  await recordReadingSession().catch(() => {});

  if (_epubBook) {
    try { _epubBook.destroy(); } catch (_) { /* already gone */ }
  }
  _epubBook = null;
  _epubRendition = null;
  _epubToc = [];
}
