// ── Manga Spine Assets & Picker ──────────────────────────────────────────────
// Book-spine/bookshelf cover visualization for the library grid: loading the
// spine asset manifest, resolving which spine image(s) a manga should show,
// the spine-picker popover, and the per-manga stable fallback spine color
// used when no real spine art exists. Self-contained — only touches its own
// state (window._mangaSpineManifest, _spineColorMap) plus a handful of
// globals defined elsewhere in ui-library.js (getMangaKey, normalizeLibraryId,
// renderLibrary), which work the same from any deferred script since they
// all share one global scope.
window._mangaSpineManifest = null;

async function loadMangaSpineManifest() {
  try {
    const res = await fetch('/assets/manga-spines/manifest.json');
    if (!res.ok) return; // fail gracefully
    const data = await res.json();
    window._mangaSpineManifest = data;

    // Trigger re-render if library is currently visible
    if (typeof renderLibrary === 'function' && document.getElementById('library') && document.getElementById('library').children.length > 0) {
      renderLibrary();
    }
  } catch (err) {
    if (window.SCROLLSCAPE_DEBUG_SPINES) {
      console.error('Failed to load manga spine manifest:', err);
    }
  }
}

// Call the loader immediately
loadMangaSpineManifest();

// getMangaKey() lives in state.js (loads first) — see note in ui-discover.js.

function getSelectedMangaSpine(manga) {
  try {
    const saved = JSON.parse(localStorage.getItem('scrollscape.selectedMangaSpines'));
    if (saved && typeof saved === 'object') {
      const key = getMangaKey(manga);
      return saved[key] || null;
    }
  } catch (_) { }
  return null;
}

function setSelectedMangaSpine(manga, spineData) {
  try {
    let saved = JSON.parse(localStorage.getItem('scrollscape.selectedMangaSpines'));
    if (!saved || typeof saved !== 'object') saved = {};
    const key = getMangaKey(manga);
    saved[key] = spineData;
    localStorage.setItem('scrollscape.selectedMangaSpines', JSON.stringify(saved));
  } catch (_) { }
}

function getAvailableMangaSpines(manga) {
  if (!window._mangaSpineManifest || !window._mangaSpineManifest.spines) return [];
  const key = getMangaKey(manga);
  let spines = window._mangaSpineManifest.spines[key];
  if (!spines && !manga.sourceId) {
    const partialKey = `:${manga.id || manga.mangaId}`;
    const foundKey = Object.keys(window._mangaSpineManifest.spines).find(k => k.endsWith(partialKey));
    if (foundKey) spines = window._mangaSpineManifest.spines[foundKey];
  }
  if (!spines && manga.title) {
    const titleSlug = String(manga.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const titleKey = `title:${titleSlug}`;
    if (window._mangaSpineManifest.spines[titleKey]) {
      spines = window._mangaSpineManifest.spines[titleKey];
    }
  }
  return spines || [];
}

function getAvailableMangaBookshelf(manga) {
  if (!window._mangaSpineManifest || !window._mangaSpineManifest.bookshelves) return null;
  const key = getMangaKey(manga);
  let bs = window._mangaSpineManifest.bookshelves[key];
  if (!bs && !manga.sourceId) {
    const partialKey = `:${manga.id || manga.mangaId}`;
    const foundKey = Object.keys(window._mangaSpineManifest.bookshelves).find(k => k.endsWith(partialKey));
    if (foundKey) bs = window._mangaSpineManifest.bookshelves[foundKey];
  }
  if (!bs && manga.title) {
    const titleSlug = String(manga.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const titleKey = `title:${titleSlug}`;
    if (window._mangaSpineManifest.bookshelves[titleKey]) {
      bs = window._mangaSpineManifest.bookshelves[titleKey];
    }
  }
  return bs || null;
}

function shouldUseSpineStrip(manga, availableSpines, spineWidth) {
  if (!availableSpines || availableSpines.length < 2) return false;
  const chapterCount = Number(manga.chapters || manga.chapterCount || manga.totalChapters || 0);
  if (spineWidth >= 90) return true;
  if (chapterCount >= 200) return true;
  return false;
}

function shouldUseBookshelfMode(manga, bookshelf, slotElement) {
  if (!bookshelf || !Array.isArray(bookshelf.items) || bookshelf.items.length < 2) return false;
  const chapterCount = Number(manga.chapters || manga.chapterCount || manga.totalChapters || 0);
  // Re-use spineWidth as the "slotWidth" equivalent for now. It's passed as spineWidth
  const slotWidth = slotElement || 0;
  if (slotWidth >= 90) return true;
  if (chapterCount >= 200) return true;
  return false;
}

function resolveMangaSpineImages(manga, spineWidth) {
  const spines = getAvailableMangaSpines(manga);
  const bookshelf = getAvailableMangaBookshelf(manga);
  if (!spines.length && !bookshelf) return [];

  let mode = 'auto';
  let selectedId = null;
  let stripIds = [];
  let bookshelfId = null;

  const saved = getSelectedMangaSpine(manga);
  if (saved) {
    if (typeof saved === 'string') {
      selectedId = saved;
      mode = 'single';
    } else if (typeof saved === 'object') {
      mode = saved.mode || 'auto';
      selectedId = saved.selectedSpineId;
      stripIds = saved.stripSpineIds || [];
      bookshelfId = saved.bookshelfId;
    }
  }

  if (mode === 'auto') {
    if (bookshelf && Array.isArray(bookshelf.items) && bookshelf.items.length >= 2) {
      mode = shouldUseBookshelfMode(manga, bookshelf, spineWidth) ? 'bookshelf' : 'single';
    } else if (spines.length >= 2) {
      mode = shouldUseSpineStrip(manga, spines, spineWidth) ? 'strip' : 'single';
    } else {
      mode = 'single';
    }
  }

  if (mode === 'bookshelf' && bookshelf && Array.isArray(bookshelf.items)) {
    return bookshelf.items.map(i => i.src);
  } else if (mode === 'strip') {
    if (stripIds.length > 0) {
      return stripIds.map(id => spines.find(s => s.id === id)?.src).filter(Boolean);
    }
    return spines.map(s => s.src);
  } else {
    if (selectedId) {
      const selectedSpine = spines.find(s => s.id === selectedId) || (bookshelf && bookshelf.items ? bookshelf.items.find(s => s.id === selectedId) : null);
      if (selectedSpine) return [selectedSpine.src];
    }
    return spines.length > 0 ? [spines[0].src] : (bookshelf && bookshelf.items && bookshelf.items.length > 0 ? [bookshelf.items[0].src] : []);
  }
}

window.openMangaSpinePicker = function({ manga, spines, anchorEvent }) {
  const existing = document.getElementById('spine-picker-popover');
  if (existing) existing.remove();

  const popover = document.createElement('div');
  popover.id = 'spine-picker-popover';
  popover.style.position = 'fixed';
  popover.style.zIndex = '10000';
  popover.style.background = 'var(--bg-secondary)';
  popover.style.border = '1px solid var(--border-color)';
  popover.style.borderRadius = '8px';
  popover.style.padding = '1rem';
  popover.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
  popover.style.width = '260px';
  popover.style.maxHeight = '400px';
  popover.style.display = 'flex';
  popover.style.flexDirection = 'column';
  popover.style.gap = '10px';

  const tFunc = typeof window.t === 'function' ? window.t : (k) => k.split('.').pop();

  const titleEl = document.createElement('h3');
  titleEl.textContent = tFunc('library.spine.change');
  titleEl.style.margin = '0';
  titleEl.style.fontSize = '1rem';
  titleEl.style.color = 'var(--text-primary)';
  popover.appendChild(titleEl);

  const subEl = document.createElement('div');
  subEl.textContent = manga.title || tFunc('library.unknownTitle');
  subEl.style.fontSize = '0.75rem';
  subEl.style.color = 'var(--text-secondary)';
  subEl.style.marginBottom = '4px';
  subEl.style.overflow = 'hidden';
  subEl.style.textOverflow = 'ellipsis';
  subEl.style.whiteSpace = 'nowrap';
  popover.appendChild(subEl);

  const saved = getSelectedMangaSpine(manga);
  const bookshelf = getAvailableMangaBookshelf(manga);
  let currentMode = 'auto';
  let currentSelected = null;
  let currentBookshelfId = null;
  if (saved) {
    if (typeof saved === 'string') {
      currentMode = 'single';
      currentSelected = saved;
    } else if (typeof saved === 'object') {
      currentMode = saved.mode || 'auto';
      currentSelected = saved.selectedSpineId;
      currentBookshelfId = saved.bookshelfId;
    }
  }

  const modeContainer = document.createElement('div');
  modeContainer.style.display = 'flex';
  modeContainer.style.justifyContent = 'space-between';
  modeContainer.style.alignItems = 'center';
  modeContainer.style.marginBottom = '12px';

  const modeLabel = document.createElement('label');
  modeLabel.textContent = tFunc('library.spine.mode');
  modeLabel.style.fontSize = '0.85rem';
  modeLabel.style.color = 'var(--text-secondary)';

  const modeSelect = document.createElement('select');
  modeSelect.style.background = 'var(--surface-2)';
  modeSelect.style.color = 'var(--text-primary)';
  modeSelect.style.border = '1px solid var(--border-color)';
  modeSelect.style.borderRadius = '4px';
  modeSelect.style.padding = '4px';
  modeSelect.style.fontSize = '0.85rem';

  const optAuto = document.createElement('option');
  optAuto.value = 'auto';
  optAuto.textContent = tFunc('library.spine.auto');

  const optSingle = document.createElement('option');
  optSingle.value = 'single';
  optSingle.textContent = tFunc('library.spine.single');

  const optStrip = document.createElement('option');
  optStrip.value = 'strip';
  optStrip.textContent = tFunc('library.spine.strip');

  modeSelect.appendChild(optAuto);
  modeSelect.appendChild(optSingle);
  modeSelect.appendChild(optStrip);
  if (bookshelf) {
    const optBookshelf = document.createElement('option');
    optBookshelf.value = 'bookshelf';
    optBookshelf.textContent = tFunc('library.spine.bookshelf');
    modeSelect.appendChild(optBookshelf);
  }
  modeSelect.value = currentMode;

  modeSelect.onchange = (e) => {
    const newMode = e.target.value;
    const stripSpineIds = spines.map(s => s.id);
    setSelectedMangaSpine(manga, {
      mode: newMode,
      selectedSpineId: currentSelected || spines[0].id,
      stripSpineIds: stripSpineIds,
      bookshelfId: bookshelf ? bookshelf.id : null
    });
    const msgKey = newMode === 'bookshelf' ? 'library.spine.bookshelfUpdated' : 'library.spine.stripUpdated';
    if (typeof showToast === 'function') showToast('Spine', tFunc(msgKey), 'success');
    if (typeof renderLibrary === 'function') renderLibrary();
    popover.remove();
  };

  modeContainer.appendChild(modeLabel);
  modeContainer.appendChild(modeSelect);
  popover.appendChild(modeContainer);

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(40px, 1fr))';
  grid.style.gap = '8px';
  grid.style.overflowY = 'auto';
  grid.style.paddingRight = '4px';

  spines.forEach(spine => {
    const item = document.createElement('div');
    const isSelected = (currentSelected === spine.id) || (!currentSelected && spine === spines[0]);
    item.style.width = '100%';
    item.style.aspectRatio = '4/15'; // spine ratio
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.style.overflow = 'hidden';
    item.style.backgroundColor = 'var(--bg-primary, #000)'; // neutral dark background behind image
    item.style.borderRadius = '4px';
    item.style.cursor = 'pointer';
    item.style.border = isSelected ? '2px solid var(--primary)' : '1px solid transparent';
    item.style.transition = 'transform 0.1s, border-color 0.1s';

    const img = document.createElement('img');
    img.src = spine.src;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.display = 'block';
    item.appendChild(img);

    item.title = spine.label || spine.id;

    item.onmouseover = () => { if (!isSelected) item.style.transform = 'scale(1.05)'; };
    item.onmouseout = () => { item.style.transform = 'scale(1)'; };

    item.onclick = (e) => {
      e.stopPropagation();
      setSelectedMangaSpine(manga, {
        mode: 'single',
        selectedSpineId: spine.id,
        stripSpineIds: spines.map(s => s.id),
        bookshelfId: bookshelf ? bookshelf.id : null
      });
      popover.remove();
      if (typeof showToast === 'function') showToast('Spine', tFunc('library.spine.updated'), 'success');
      if (typeof renderLibrary === 'function') renderLibrary();
    };
    grid.appendChild(item);
  });

  popover.appendChild(grid);

  document.body.appendChild(popover);

  const rect = popover.getBoundingClientRect();
  let left = anchorEvent.clientX;
  let top = anchorEvent.clientY;

  if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
  if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 10;

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  const closeFn = (e) => {
    if (!popover.contains(e.target)) {
      popover.remove();
      document.removeEventListener('click', closeFn);
      document.removeEventListener('contextmenu', closeFn);
    }
  };

  const keyFn = (e) => {
    if (e.key === 'Escape') {
      popover.remove();
      document.removeEventListener('keydown', keyFn);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeFn);
    document.addEventListener('contextmenu', closeFn);
    document.addEventListener('keydown', keyFn);
  }, 10);
};

let _spineColorMap = null;
const SPINE_COLOR_CLASSES = [
  '#6a4c4c', // brown/red
  '#4c5a6a', // blue
  '#4c6a54', // green
  '#6a634c', // yellow/brown
  '#5d4c6a', // purple
  '#4c6a6a', // cyan/teal
  '#6a5d4c'  // orange/brown
];

function loadSpineColors() {
  if (_spineColorMap) return;
  try {
    const saved = JSON.parse(localStorage.getItem('scrollscape.librarySpineColors'));
    _spineColorMap = saved && typeof saved === 'object' ? saved : {};
  } catch (e) {
    _spineColorMap = {};
  }
}

function saveSpineColorMap() {
  localStorage.setItem('scrollscape.librarySpineColors', JSON.stringify(_spineColorMap));
}

function getMangaIdentityKey(manga) {
  const sourceId = normalizeLibraryId(manga.sourceId || manga.source);
  const mangaId = normalizeLibraryId(manga.id || manga.mangaId);
  return `${sourceId}:${mangaId}`;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getStableSpineColor(manga) {
  loadSpineColors();
  const key = getMangaIdentityKey(manga);
  if (_spineColorMap[key]) return _spineColorMap[key];

  const color = SPINE_COLOR_CLASSES[hashString(key) % SPINE_COLOR_CLASSES.length];
  _spineColorMap[key] = color;
  saveSpineColorMap();
  return color;
}

// ── Spine Width Helpers ───────────────────────────────────────────────────────

/**
 * Safely parse a chapter value that may be a number, "123", "Ch.45", etc.
 * Returns 0 if the value cannot be interpreted as a positive finite number.
 */
function parseChapterNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const match = s.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Extract the most reliable chapter count from manga metadata.
 * Checks multiple property names used by different sources.
 */
function getMangaChapterCount(manga) {
  const directCandidates = [
    manga?.chapterCount,
    manga?.chaptersCount,
    manga?.totalChapters,
    manga?.latestChapter,
    manga?.latestChapterNumber,
    manga?.lastChapter
  ];
  for (const val of directCandidates) {
    const n = parseChapterNumber(val);
    if (n > 0) return n;
  }
  if (Array.isArray(manga?.chapters) && manga.chapters.length > 0) {
    return manga.chapters.length;
  }
  return 0;
}

/**
 * Map chapter count → spine width in pixels.
 * Long-running manga (Ippo ~1500 ch, One Piece ~1000 ch) get wider spines.
 * Width is clamped to 34–96 px.
 */
function getBookshelfSpineWidth(manga, cachedCount) {
  // Prefer live manga metadata; fall back to cached chapter count from state.
  let chapters = getMangaChapterCount(manga);
  if (chapters === 0 && cachedCount > 0) chapters = cachedCount;

  if (chapters >= 1400) return 92;
  if (chapters >= 1000) return 84;
  if (chapters >= 700)  return 76;
  if (chapters >= 400)  return 68;
  if (chapters >= 200)  return 58;
  if (chapters >= 100)  return 50;
  if (chapters >= 40)   return 44;
  return 38;
}
