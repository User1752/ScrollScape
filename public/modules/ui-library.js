// ── Library Settings Helpers ────────────────────────────────────────────────
function getDefaultLibraryCardSettings() {
  return {
    showSource: true,
    showTags: false,
    showDescription: false,
    showChaptersRead: false,
    showChaptersUnread: true,
    showTotalChapters: true,
    showRating: true,
    showStatus: true,
    showContinueBtn: true,
    showCategoryBtn: false,
    coverSizeDesktop: 'medium',
    coverSizeMobile: 'large'
  };
}

function loadLibraryCardSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('scrollscape.libraryCardSettings'));
    if (saved && typeof saved === 'object') {
      return { ...getDefaultLibraryCardSettings(), ...saved };
    }
  } catch (e) {
    // Ignore parse errors
  }
  return getDefaultLibraryCardSettings();
}

function saveLibraryCardSettings(settings) {
  localStorage.setItem('scrollscape.libraryCardSettings', JSON.stringify(settings));
}

let currentBookshelf25dPanelManga = null;

// ── Manga Spine Assets & Picker ──────────────────────────────────────────────
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

function getMangaKey(manga) {
  const sourceId = String(manga?.sourceId || manga?.source || '');
  const mangaId = String(manga?.id || manga?.mangaId || '');
  return `${sourceId}:${mangaId}`;
}

function getSelectedMangaSpine(manga) {
  try {
    const saved = JSON.parse(localStorage.getItem('scrollscape.selectedMangaSpines'));
    if (saved && typeof saved === 'object') {
      const key = getMangaKey(manga);
      return saved[key] || null;
    }
  } catch (e) { }
  return null;
}

function setSelectedMangaSpine(manga, spineData) {
  try {
    let saved = JSON.parse(localStorage.getItem('scrollscape.selectedMangaSpines'));
    if (!saved || typeof saved !== 'object') saved = {};
    const key = getMangaKey(manga);
    saved[key] = spineData;
    localStorage.setItem('scrollscape.selectedMangaSpines', JSON.stringify(saved));
  } catch (e) { }
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


function normalizeLibraryId(value) {
  return String(value ?? '');
}


function resolveLibraryManga({ mangaId, sourceId, title, allowLocal = true }) {
  const normMangaId = normalizeLibraryId(mangaId);
  const normSourceId = normalizeLibraryId(sourceId);
  
  if (allowLocal && normSourceId === 'local') {
    let manga = (state.localManga || []).find(m => normalizeLibraryId(m.id) === normMangaId);
    if (manga) return { ...manga, sourceId: 'local' };
  }
  
  if (normSourceId && normSourceId !== 'local') {
    let manga = (state.favorites || []).find(m => 
      normalizeLibraryId(m.id) === normMangaId && 
      normalizeLibraryId(m.sourceId || '') === normSourceId
    );
    if (manga) return manga;
  }
  
  let matches = (state.favorites || []).filter(m => normalizeLibraryId(m.id) === normMangaId);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1 && title) {
    let titleMatch = matches.find(m => m.title === title);
    if (titleMatch) return titleMatch;
  }
  
  if (allowLocal && (!normSourceId || normSourceId === 'local')) {
    let manga = (state.localManga || []).find(m => normalizeLibraryId(m.id) === normMangaId);
    if (manga) return { ...manga, sourceId: 'local' };
  }
  
  return null;
}

function getContextMenuPoint(event) {
  if (!event) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  
  if (event.touches && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (event.changedTouches && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  
  if (event.target && event.target.getBoundingClientRect) {
    const rect = event.target.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }
  
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

// ── Sources Modal ─────────────────────────────────────────────────────────
function showSourcesModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const allSources = Object.values(state.installedSources || {});
  const visible = Array.isArray(state.settings.visibleSources)
    ? state.settings.visibleSources
    : allSources.map(s => s.id);

  modal.innerHTML = `
    <div class="import-modal-box" style="max-width:400px">
      <div class="modal-header">
        <h3>Visible Sources</h3>
        <button class="btn-close-modal" id="closeSourcesModal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="sourcesForm" style="display:flex;flex-direction:column;gap:0.4rem">
          ${allSources.length === 0
            ? '<p style="color:var(--muted);text-align:center">No sources installed.</p>'
            : allSources.map(src => `
            <label class="home-source-check">
              <input type="checkbox" class="home-source-option" name="sources" value="${escapeHtml(src.id)}" ${visible.includes(src.id) ? 'checked' : ''}>
              <span class="home-source-check-label">${escapeHtml(src.name || src.id)}</span>
            </label>
          `).join('')}
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" id="cancelSourcesModal">Cancel</button>
        <button class="btn primary"   id="saveSourcesModal">Save</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.getElementById('closeSourcesModal').onclick  = () => modal.remove();
  document.getElementById('cancelSourcesModal').onclick = e => { e.preventDefault(); modal.remove(); };
  document.getElementById('saveSourcesModal').onclick   = e => {
    e.preventDefault();
    const checked = Array.from(modal.querySelectorAll('input[name="sources"]:checked')).map(cb => cb.value);
    state.settings.visibleSources = checked;
    if (typeof saveSettings === 'function') saveSettings();
    modal.remove();
    renderLibrary();
    if (typeof window.loadPopularToday === 'function')   window.loadPopularToday();
    if (typeof window.loadRecentlyAdded === 'function')  window.loadRecentlyAdded();
    if (typeof window.loadLatestUpdates === 'function')  window.loadLatestUpdates();
  };
}
// Add event listener for the Sources button after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSources')?.addEventListener('click', showSourcesModal);
  
  const btnEditPage = document.getElementById('btnEditPage');
  if (btnEditPage) {
    btnEditPage.addEventListener('click', () => {
      const modal = document.getElementById('customizeLibraryCardModal');
      if (!modal) return;
      
      const settings = loadLibraryCardSettings();
      
      // Setup UI
      const safeCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
      const safeRadioSet = (name, val) => {
        const els = document.querySelectorAll(`input[name="${name}"]`);
        els.forEach(el => { el.checked = (el.value === val); });
      };
      
      safeCheck('libCustSource', settings.showSource);
      safeCheck('libCustTags', settings.showTags);
      safeCheck('libCustDesc', settings.showDescription);
      safeCheck('libCustChapRead', settings.showChaptersRead);
      safeCheck('libCustChapUnread', settings.showChaptersUnread);
      safeCheck('libCustChapTotal', settings.showTotalChapters);
      safeCheck('libCustRating', settings.showRating);
      safeCheck('libCustStatus', settings.showStatus);
      safeCheck('libCustBtnContinue', settings.showContinueBtn);
      safeCheck('libCustBtnCategory', settings.showCategoryBtn);
      
      safeRadioSet('libCustCoverDesktop', settings.coverSizeDesktop);
      safeRadioSet('libCustCoverMobile', settings.coverSizeMobile);
      
      modal.classList.remove('hidden');
    });
  }

  const closeCustModal = () => {
    const modal = document.getElementById('customizeLibraryCardModal');
    if (modal) modal.classList.add('hidden');
  };

  document.getElementById('btnCustomizeCardClose')?.addEventListener('click', closeCustModal);
  document.getElementById('btnCustomizeCardCancel')?.addEventListener('click', closeCustModal);
  
  document.getElementById('btnCustomizeCardSave')?.addEventListener('click', () => {
    const safeGetCheck = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
    const safeGetRadio = (name, def) => {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : def;
    };
    
    const newSettings = {
      showSource: safeGetCheck('libCustSource'),
      showTags: safeGetCheck('libCustTags'),
      showDescription: safeGetCheck('libCustDesc'),
      showChaptersRead: safeGetCheck('libCustChapRead'),
      showChaptersUnread: safeGetCheck('libCustChapUnread'),
      showTotalChapters: safeGetCheck('libCustChapTotal'),
      showRating: safeGetCheck('libCustRating'),
      showStatus: safeGetCheck('libCustStatus'),
      showContinueBtn: safeGetCheck('libCustBtnContinue') || safeGetCheck('libCustBtn'), // fallback
      showCategoryBtn: safeGetCheck('libCustBtnCategory'),
      coverSizeDesktop: safeGetRadio('libCustCoverDesktop', 'medium'),
      coverSizeMobile: safeGetRadio('libCustCoverMobile', 'large')
    };
    
    saveLibraryCardSettings(newSettings);
    closeCustModal();
    
    // Refresh library layout if active
    const activeLayout = document.querySelector('.library-grid-bookshelf-25d .bookshelf25d-layout');
    if (activeLayout) {
      renderLibrary(); // Re-render to update the panel sizes and info
    }
  });
});
// ============================================================================
// LIBRARY RENDERING
// ============================================================================

const LIBRARY_SORT_MODES = [
  { key: "added",          label: "Date Added"      },
  { key: "az",             label: "A \u2192 Z"      },
  { key: "za",             label: "Z \u2192 A"      },
  { key: "total-chapters", label: "Total Chapters"  },
  { key: "last-read",      label: "Last Read"       },
  { key: "unread-count",   label: "Unread Count"    },
  { key: "tracker-score",  label: "Tracker Score"   },
  { key: "rating",         label: "Rating"          },
  { key: "random",         label: "Random"          },
];
let _libSortMode = "added";
let _librarySelectedKeys = new Set(); // key = "mangaId::sourceId"

function _libSourceId(sourceId) {
  return String(sourceId || '');
}

function _libMangaKey(mangaId, sourceId) {
  return `${String(mangaId)}::${_libSourceId(sourceId)}`;
}

function _libStoreKeyPart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_');
}

function _libStatusKey(mangaId, sourceId) {
  return `${_libStoreKeyPart(mangaId)}:${_libStoreKeyPart(sourceId || 'unknown')}`;
}

function _libRatingKey(mangaId) {
  return _libStoreKeyPart(mangaId);
}

function _syncLibrarySelectionWithFavorites() {
  const valid = new Set((state.favorites || []).map(m => _libMangaKey(m.id, m.sourceId)));
  _librarySelectedKeys = new Set([..._librarySelectedKeys].filter(k => valid.has(k)));
}

function _setLibraryCardSelection(card, selected) {
  if (!card) return;
  card.classList.toggle('library-card-selected', !!selected);
}

function _toggleLibraryCardSelection(card) {
  if (!card) return false;
  const key = _libMangaKey(card.dataset.mangaId, card.dataset.sourceId);
  if (_librarySelectedKeys.has(key)) {
    _librarySelectedKeys.delete(key);
    _setLibraryCardSelection(card, false);
    return false;
  }
  _librarySelectedKeys.add(key);
  _setLibraryCardSelection(card, true);
  return true;
}

function _clearLibrarySelection(grid) {
  _librarySelectedKeys.clear();
  const root = grid || document;
  root.querySelectorAll?.('.library-card.library-card-selected').forEach(card => {
    card.classList.remove('library-card-selected');
  });
}

function _getLibraryActionTargets(clickedManga) {
  const clickedKey = _libMangaKey(clickedManga?.id, clickedManga?.sourceId);
  if (_librarySelectedKeys.size > 1 && _librarySelectedKeys.has(clickedKey)) {
    const selected = (state.favorites || []).filter(m => _librarySelectedKeys.has(_libMangaKey(m.id, m.sourceId)));
    if (selected.length) return selected;
  }
  return clickedManga ? [clickedManga] : [];
}

function _updateLibrarySortLabel() {
  const labelEl = $("libSortLabel");
  if (!labelEl) return;
  const mode = LIBRARY_SORT_MODES.find(m => m.key === _libSortMode);
  labelEl.textContent = mode?.label || 'Sort';
}

function setLibrarySortMode(modeKey) {
  if (!LIBRARY_SORT_MODES.some(m => m.key === modeKey)) return;
  _libSortMode = modeKey;
  _updateLibrarySortLabel();
  renderLibrary();
}

function closeLibrarySortDrawer() {
  document.getElementById('librarySortBackdrop')?.remove();
  document.getElementById('librarySortDrawer')?.remove();
}

function openLibrarySortDrawer() {
  closeLibrarySortDrawer();

  const options = LIBRARY_SORT_MODES.map(m => `
    <button type="button" class="library-sort-option${m.key === _libSortMode ? ' active' : ''}" data-sort-key="${escapeHtml(m.key)}">
      <span>${escapeHtml(m.label)}</span>
      ${m.key === _libSortMode ? '<span class="library-sort-check">\u2713</span>' : ''}
    </button>`).join('');

  const backdrop = document.createElement('div');
  backdrop.id = 'librarySortBackdrop';
  backdrop.className = 'library-sort-backdrop';

  const drawer = document.createElement('div');
  drawer.id = 'librarySortDrawer';
  drawer.className = 'library-sort-drawer';
  drawer.innerHTML = `
    <div class="library-sort-head">
      <h3>Sort Library</h3>
      <button class="btn secondary" id="librarySortClose">\u2715</button>
    </div>
    <div class="library-sort-body">
      <div class="library-sort-options">${options}</div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  // Position the drawer to the left of the sort button, vertically centred on it.
  const sortBtn = document.getElementById('btnSortLibrary');
  if (sortBtn) {
    const btnRect   = sortBtn.getBoundingClientRect();
    const gap       = 8;
    const dw        = drawer.offsetWidth  || 220;
    const dh        = drawer.offsetHeight || 300;
    let left = btnRect.left - dw - gap;
    if (left < 8) left = 8;
    let top  = btnRect.top + btnRect.height / 2 - dh / 2;
    if (top + dh > window.innerHeight - 8) top = window.innerHeight - dh - 8;
    if (top < 8) top = 8;
    drawer.style.top  = `${top}px`;
    drawer.style.left = `${left}px`;
  }

  backdrop.onclick = closeLibrarySortDrawer;
  drawer.querySelector('#librarySortClose').onclick = closeLibrarySortDrawer;
  drawer.querySelectorAll('.library-sort-option').forEach(btn => {
    btn.onclick = () => {
      setLibrarySortMode(btn.dataset.sortKey || 'added');
      closeLibrarySortDrawer();
    };
  });
}

function _sortLibrary(favs) {
  const title  = m => String(m.title || '').toLowerCase();
  const rating = m => state.ratings[_libRatingKey(m.id)] || 0;
  const totalChapters = m => Number(state.chapterCountCache?.[m.id]) || 0;
  const readCount = m => [...(state.readChapters || [])].filter(k => k.startsWith(`${m.id}:`)).length;
  const unreadCount = m => Math.max(0, totalChapters(m) - readCount(m));
  const historyIndex = m => {
    const idx = (state.history || []).findIndex(h => String(h.id) === String(m.id));
    return idx >= 0 ? idx : Infinity;
  };
  const trackerScore = m => Number(m.score) || 0;
  switch (_libSortMode) {
    case "az":             return [...favs].sort((a, b) => title(a).localeCompare(title(b)));
    case "za":             return [...favs].sort((a, b) => title(b).localeCompare(title(a)));
    case "rating":         return [...favs].sort((a, b) => rating(b) - rating(a));
    case "total-chapters": return [...favs].sort((a, b) => totalChapters(b) - totalChapters(a) || title(a).localeCompare(title(b)));
    case "last-read":      return [...favs].sort((a, b) => historyIndex(a) - historyIndex(b));
    case "unread-count":   return [...favs].sort((a, b) => unreadCount(b) - unreadCount(a) || title(a).localeCompare(title(b)));
    case "tracker-score":  return [...favs].sort((a, b) => trackerScore(b) - trackerScore(a) || title(a).localeCompare(title(b)));
    case "random":         { const arr = [...favs]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
    default: {
      try {
        const savedOrder = JSON.parse(localStorage.getItem('bookshelfCustomOrder'));
        if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
          const byKey = new Map(favs.map(m => [`${m.id}:${m.sourceId || ''}`, m]));
          const used = new Set();
          const ordered = [];
          
          for (const key of savedOrder) {
            const manga = byKey.get(key);
            if (manga) {
              ordered.push(manga);
              used.add(key);
            }
          }
          
          for (const manga of favs) {
            const key = `${manga.id}:${manga.sourceId || ''}`;
            if (!used.has(key)) {
              ordered.push(manga);
            }
          }
          return ordered;
        }
      } catch(e) {}
      return favs;
    }
  }
}

function resolveSyntheticSpineData(manga, sourceId = '') {
  const seedStr = `${String(manga?.id || '')}:${String(sourceId || '')}`;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    seed = (seed * 33 + seedStr.charCodeAt(i)) % 15401;
  }

  const rawTitle = String(manga?.title || 'Untitled').trim() || 'Untitled';
  const shortTitle = rawTitle.length > 34 ? `${rawTitle.slice(0, 34)}...` : rawTitle;
  const sourceName = sourceId === 'local'
    ? 'LOCAL'
    : (state.installedSources[sourceId]?.name || sourceId || 'MANGA').toUpperCase();
  const chapterCount = Number(state.chapterCountCache?.[manga?.id]);
  const chapterMeta = Number.isFinite(chapterCount) && chapterCount > 0
    ? `${chapterCount} CH`
    : 'SHELF';
  const accentHue = 14 + (seed % 28);

  return {
    title: shortTitle.toUpperCase(),
    source: sourceName.slice(0, 10),
    meta: chapterMeta,
    accent: `hsl(${accentHue} 72% 58%)`
  };
}


function cycleLibrarySort() {
  const idx = LIBRARY_SORT_MODES.findIndex(m => m.key === _libSortMode);
  setLibrarySortMode(LIBRARY_SORT_MODES[(idx + 1) % LIBRARY_SORT_MODES.length].key);
}

function renderLibrary() {
  const grid = $("library");
  if (!grid) return;
  const bookshelf3dEnabled = state.settings.libraryBookshelf3d === true;
  const isBookshelf25d  = bookshelf3dEnabled;
  grid.classList.toggle('library-grid-bookshelf-25d', isBookshelf25d);

  // === Display Mode & Grid Columns ===
  const displayMode = state.settings.displayMode || 'detailed';
  const mangasPerRow = state.settings.mangasPerRow || 6;
  grid.classList.remove('library-grid-compact', 'library-grid-detailed', 'library-grid-list', 'library-grid-compact-show-info');
  if (displayMode === 'compact') {
    grid.classList.add('library-grid-compact');
    if (state.settings.showCompactInfo) {
      grid.classList.add('library-grid-compact-show-info');
    }
  } else {
    grid.classList.add('library-grid-detailed');
  }
  if (isBookshelf25d) {
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(32px, 58px))';
  } else {
    grid.style.gridTemplateColumns = `repeat(${mangasPerRow}, minmax(0, 1fr))`;
  }

  _syncLibrarySelectionWithFavorites();
  _updateLibrarySortLabel();

  const sourceNameFor = (sourceId) => {
    const sid = sourceId || '';
    if (!sid) return 'No source';
    if (sid === 'anilist') return 'AniList';
    if (sid === 'local') return 'Local';
    return state.installedSources[sid]?.name || sid;
  };

  const filterVal      = $("libraryStatusFilter")?.value    || "all";
  const categoryFilter = $("libraryCategoryFilter")?.value  || "all";
  const trackerFilter  = $("libraryTrackerFilter")?.value   || "all";
  const searchQuery    = ($("librarySearchInput")?.value || "").trim().toLowerCase();
  const hideNsfw = state.settings.hideNsfw === true;

  if (window.SCROLLSCAPE_DEBUG_LIBRARY_MEMBERSHIP) {
    const onePieceObj = state.favorites.find(m => m.title && String(m.title).toLowerCase().includes('one piece'));
    console.log({
      source: "library-render",
      favoritesCount: state.favorites.length,
      mangaKeys: state.favorites.map(m => getMangaKey(m)),
      onePieceFound: !!onePieceObj,
      onePieceObject: onePieceObj,
      activeFilters: { filterVal, categoryFilter, trackerFilter, searchQuery }
    });
  }

  // Build a genres enrichment map from history (history entries have full genre data,
  // while favorites added via import often have genres: []).
  // Keyed as "id:sourceId" for direct lookup.
  let _histGenresMap = null;
  function _getEnrichedGenres(manga) {
    if ((manga.genres || []).length > 0) return manga.genres;
    if (!_histGenresMap) {
      _histGenresMap = new Map();
      for (const h of (state.history || [])) {
        if ((h.genres || []).length > 0) {
          _histGenresMap.set(`${h.id}:${h.sourceId || ''}`, h.genres);
          // also index by anilistId if present
          if (h.anilistId) _histGenresMap.set(`anilist:${h.anilistId}`, h.genres);
        }
      }
      // also pull from readingStatus manga entries
      for (const rs of Object.values(state.readingStatus || {})) {
        const rsm = rs.manga;
        if (rsm && (rsm.genres || []).length > 0) {
          _histGenresMap.set(`${rsm.id}:${rsm.sourceId || ''}`, rsm.genres);
        }
      }
    }
    const key = `${manga.id}:${manga.sourceId || ''}`;
    if (_histGenresMap.has(key)) return _histGenresMap.get(key);
    // For AniList-sourced entries, also try matching by anilistId
    if (manga.anilistId) {
      const aKey = `anilist:${manga.anilistId}`;
      if (_histGenresMap.has(aKey)) return _histGenresMap.get(aKey);
    }
    return [];
  }
  function _isNsfwEnriched(manga) {
    if (!manga) return false;
    const enrichedGenres = _getEnrichedGenres(manga);
    if (enrichedGenres.length > 0) {
      const enriched = Object.assign({}, manga, { genres: enrichedGenres });
      return isNsfwManga(enriched);
    }
    return isNsfwManga(manga);
  }

  // Build a reverse-index: mangaId -> [listId, ...]
  const mangaCategories = {};
  for (const list of (state.customLists || [])) {
    for (const item of (list.mangaItems || [])) {
      if (!item.id) continue;
      const key = `${item.id}:${item.sourceId || ''}`;
      if (!mangaCategories[key]) mangaCategories[key] = [];
      mangaCategories[key].push(list.id);
    }
  }

  function normalizeLibraryManga(raw, index) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const id = String(raw.id || raw.mangaId || '').trim();
    const sourceId = String(raw.sourceId || raw.source || '').trim();
    const title = String(raw.title || raw.name || '').trim();

    if (!id || !title) {
      return null;
    }

    return {
      ...raw,
      id,
      sourceId,
      title,
      cover: raw.cover || raw.image || raw.coverUrl || '',
      status: raw.status || 'reading'
    };
  }

  function isValidLibraryManga(manga) {
    return !!(
      manga &&
      typeof manga === 'object' &&
      String(manga.id || manga.mangaId || '').trim() &&
      String(manga.title || manga.name || '').trim()
    );
  }

  const rawFavs = state.favorites || [];
  const validFavs = [];
  const invalidFavs = [];
  
  for (let i = 0; i < rawFavs.length; i++) {
    const norm = normalizeLibraryManga(rawFavs[i], i);
    if (isValidLibraryManga(norm)) {
      validFavs.push(norm);
    } else {
      invalidFavs.push(rawFavs[i]);
    }
  }

  if (window.SCROLLSCAPE_DEBUG_LIBRARY_RENDER) {
    const onePieceObj = validFavs.find(m => m.title && m.title.toLowerCase().includes('one piece'));
    console.log({
      source: "library-normalize",
      rawCount: rawFavs.length,
      validCount: validFavs.length,
      invalidCount: invalidFavs.length,
      invalidEntries: invalidFavs,
      onePieceFound: !!onePieceObj,
      onePieceObject: onePieceObj,
      activeViewMode: state.settings.displayMode,
      bookshelfEnabled: state.settings.libraryBookshelf3d
    });
  }

  const visibleSources = Array.isArray(state.settings.visibleSources)
    ? state.settings.visibleSources
    : null;

  let favs = validFavs.filter(manga => {
    let hideReason = null;
    
    if (visibleSources !== null && manga.sourceId && !visibleSources.includes(manga.sourceId)) {
      hideReason = `Source not visible: ${manga.sourceId}`;
    } else if (hideNsfw && typeof _isNsfwEnriched === 'function' && _isNsfwEnriched(manga)) {
      hideReason = `NSFW hidden`;
    } else if (filterVal !== "all") {
      const key = _libStatusKey(manga.id, manga.sourceId);
      const status = state.readingStatus[key]?.status;
      if (status !== filterVal) hideReason = `Status mismatch: ${status} !== ${filterVal}`;
    } else if (categoryFilter !== "all") {
      const primaryKey = `${manga.id}:${manga.sourceId || ''}`;
      const legacyKey = `${manga.id}:`;
      const cats = Array.from(new Set([
        ...(mangaCategories[primaryKey] || []),
        ...(mangaCategories[legacyKey] || []),
      ]));
      if (!cats.includes(categoryFilter)) hideReason = `Category mismatch: ${categoryFilter}`;
    } else if (trackerFilter === 'anilist') {
      if (typeof _alGetLink !== 'function' || !_alGetLink(manga.id)) hideReason = `No AniList link`;
    } else if (searchQuery && !String(manga.title || '').toLowerCase().includes(searchQuery)) {
      hideReason = `Search mismatch`;
    }
    
    if (hideReason) {
      if (window.SCROLLSCAPE_DEBUG_LIBRARY_MEMBERSHIP) {
        console.log({
          stage: "library-render",
          title: manga.title,
          id: manga.id,
          sourceId: manga.sourceId,
          mangaKey: `${manga.sourceId || ''}:${manga.id || ''}`,
          renderable: false,
          filteredOutReason: hideReason
        });
      }
      return false;
    }
    return true;
  });

  // Apply sort
  favs = _sortLibrary(favs);

  const filteredLocalManga = state.localManga.filter(manga => {
    if (hideNsfw && _isNsfwEnriched(manga)) return false;
    if (searchQuery && !String(manga.title || '').toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  const totalCount = favs.length + (filterVal === "all" && categoryFilter === "all" && trackerFilter === "all" ? filteredLocalManga.length : 0);
  if ($("libraryCount")) {
    $("libraryCount").textContent = `${totalCount} manga`;
  }

  // Populate category filter dropdown
  const catSelect = $("libraryCategoryFilter");
  if (catSelect) {
    const prev = catSelect.value;
    catSelect.innerHTML = `<option value="all">All Categories</option>` +
      (state.customLists || []).map(l =>
        `<option value="${escapeHtml(l.id)}" ${prev === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`
      ).join('');
    if (prev && prev !== 'all') catSelect.value = prev;
  }

  // Repair local AniList tracker links for previously migrated items.
  try {
    const raw = localStorage.getItem('scrollscape_al_links');
    const links = raw ? JSON.parse(raw) : {};
    if (links && typeof links === 'object') {
      let changed = false;
      for (const manga of favs) {
        const id = String(manga?.id || '');
        const ani = String(manga?.anilistId || '');
        if (!id || !ani) continue;
        if (!links[id]) {
          links[id] = ani;
          changed = true;
        }
      }
      if (changed) localStorage.setItem('scrollscape_al_links', JSON.stringify(links));
    }
  } catch (_) {
    // Non-fatal.
  }

  const favHTML = favs.map((manga, index) => {
    const key    = _libStatusKey(manga.id, manga.sourceId);
    const status = state.readingStatus[key]?.status;
    const badgeLoc = state.settings.statusBadgeLocation || 'cover';
    // Overlay toggles
    const overlays = state.settings.overlays || {};
    const cachedChapterTotal = Number(state.chapterCountCache?.[manga.id]) || 0;
    const readCount = cachedChapterTotal
      ? [...state.readChapters].filter(key => key.startsWith(`${manga.id}:`)).length
      : 0;
    const chaptersLeft = cachedChapterTotal ? Math.max(0, cachedChapterTotal - readCount) : null;
    // Downloaded Chapters overlay (exemplo: badge se houver capítulos baixados)
    let downloadedBadge = '';
    if (overlays.downloaded !== false && manga.downloadedChapters && manga.downloadedChapters.length > 0) {
      downloadedBadge = `<div class="library-card-overlay-badge downloaded" title="Downloaded Chapters">DL</div>`;
    }
    // Unread Chapters overlay (exemplo: badge se houver capítulos não lidos)
    let unreadBadge = '';
    if (overlays.unread !== false && chaptersLeft && chaptersLeft > 0 && !state.settings.hideLibraryStatusAndChapters) {
      unreadBadge = `<div class="library-card-overlay-badge unread" title="Unread Chapters">${chaptersLeft}</div>`;
    }
    // Local Source overlay (exemplo: badge se for local)
    let localBadge = '';
    if (overlays.local !== false && manga.sourceId === 'local') {
      localBadge = `<div class="library-card-overlay-badge local" title="Local Source">LOCAL</div>`;
    }
    const statusBadge = status && badgeLoc !== 'info' && !state.settings.hideLibraryStatusAndChapters
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    const currentRating = state.ratings[_libRatingKey(manga.id)] || 0;
    const lastChapterId = state.lastReadChapter?.[manga.id];
    const btnLabel = lastChapterId ? "Continue Reading" : "Start Reading";
    const sourceLabel = state.settings.showLibrarySourceBadge !== false
      ? `<span class="library-source-badge">${escapeHtml(sourceNameFor(manga.sourceId))}</span>`
      : '';
    const chaptersLeftBadge = state.settings.showChaptersLeft && chaptersLeft !== null && !state.settings.hideLibraryStatusAndChapters
      ? `<div class="library-card-chapters-count ${chaptersLeft === 0 ? 'library-card-chapters-count--done' : ''}" aria-label="${chaptersLeft} chapters left">${chaptersLeft}</div>`
      : '';

    // Category chips
    const primaryKey = `${manga.id}:${manga.sourceId || ''}`;
    const legacyKey  = `${manga.id}:`;
    const catIds = Array.from(new Set([
      ...(mangaCategories[primaryKey] || []),
      ...(mangaCategories[legacyKey] || []),
    ]));
    const catChips = catIds.length
      ? catIds.map(id => {
          const list = (state.customLists || []).find(l => l.id === id);
          return list ? `<span class="category-chip">${escapeHtml(list.name)}</span>` : '';
        }).join('')
      : '';

    const isSelected = _librarySelectedKeys.has(_libMangaKey(manga.id, manga.sourceId));
    const coverUrl = normalizeImageUrl(manga.cover);
    let bookshelfStyle = '';
    let spineWidth = 38; // default for unknown chapter count
    if (isBookshelf25d) {
      spineWidth = getBookshelfSpineWidth(manga, cachedChapterTotal);
      // Inject per-manga stable color and spine width as CSS variables
      const spineColor = getStableSpineColor(manga);
      bookshelfStyle = ` style="--book25d-spine-width: ${spineWidth}px; --book-spine-color: ${spineColor};"`;
      // Optional debug logging
      if (window.SCROLLSCAPE_DEBUG_BOOKSHELF_WIDTH) {
        const detectedChapters = getMangaChapterCount(manga) || cachedChapterTotal;
        console.debug('[Bookshelf25d]', { title: manga.title, sourceId: manga.sourceId, mangaId: manga.id, detectedChapters, spineWidth });
      }
    }
    const spineData = resolveSyntheticSpineData(manga, manga.sourceId || '');
    const realSpineImages = resolveMangaSpineImages(manga, spineWidth);
    let spineImgNode = '';
    if (realSpineImages.length > 0) {
      if (realSpineImages.length === 1) {
        spineImgNode = `<img src="${escapeHtml(realSpineImages[0])}" style="width:100%; height:100%; object-fit:contain; object-position:center; border-radius:inherit; position:absolute; top:0; left:0; z-index:2; pointer-events:none;" onerror="this.style.display='none'">`;
      } else {
        const stripContent = realSpineImages.map(src => `<img src="${escapeHtml(src)}" style="height:100%; width:auto; max-width:none; object-fit:contain; object-position:center; flex:0 0 auto; display:block;" onerror="this.style.display='none'">`).join('');
        spineImgNode = `<div class="manga-spine-strip" style="position:absolute; inset:0; display:flex; align-items:stretch; justify-content:center; overflow:hidden; z-index:2; pointer-events:none; border-radius:inherit;">${stripContent}</div>`;
      }
    }
    const coverImgMarkup = coverUrl && !coverUrl.endsWith('.pdf')
      ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">`
      : (manga.cover
          ? '<div class="book3d-placeholder"><span class="book3d-placeholder-icon">&#128196;</span><span class="book3d-placeholder-label">NO COVER</span></div>'
          : '<div class="book3d-placeholder"><span class="book3d-placeholder-icon">?</span><span class="book3d-placeholder-label">UNKNOWN</span></div>');

    // Bookshelf 2.5D markup: calibre style spine resting, cover on hover
    const shelf25dCoverMarkup = coverUrl && !coverUrl.endsWith('.pdf')
      ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">`
      : `<div class="book25d-no-cover"><span>?</span></div>`;
    const shelf25dMarkup = `
      <div class="book25d">
        <div class="book25d-spine" style="position:relative">${spineImgNode}</div>
        <div class="book25d-cover-preview" aria-hidden="true">
          ${shelf25dCoverMarkup}
        </div>
      </div>
      <div class="book25d-source-label" aria-hidden="true">${escapeHtml(spineData.source)}</div>`;

    return `
      <div class="library-card${isSelected ? ' library-card-selected' : ''}${isBookshelf25d ? ' library-card-bookshelf-25d' : ''}" data-book-index="${index}" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || '')}" data-title="${escapeHtml(manga.title || '')}" title="${escapeHtml(manga.title || '')}"${bookshelfStyle}>
        <div class="library-card-cover">
          ${isBookshelf25d ? shelf25dMarkup : (coverUrl && !coverUrl.endsWith('.pdf') ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">` : (manga.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>'))}
          ${isBookshelf25d ? '' : statusBadge}
          ${isBookshelf25d ? '' : chaptersLeftBadge}
          ${isBookshelf25d ? '' : sourceLabel}
          ${isBookshelf25d ? '' : `<div class="library-card-overlay">
            ${downloadedBadge}
            ${unreadBadge}
            ${localBadge}
            <button class="btn-read">${btnLabel}</button>
          </div>`}
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${(status && badgeLoc !== 'cover' && !state.settings.hideLibraryStatusAndChapters ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : "")}
          ${catChips ? `<div class="category-chips">${catChips}</div>` : ''}
          ${currentRating ? `<span class="card-score-badge">${currentRating}<span class="card-score-badge-max">/10</span></span>` : ""}
        </div>
      </div>`;
  }).join("");

  // Local manga section
  const localHTML = (filterVal === "all" && categoryFilter === "all" && trackerFilter === "all" && filteredLocalManga.length > 0)
    ? `<div class="local-section-header">&#128193; Local Manga</div>` +
      filteredLocalManga.map((manga, index) => {
        const localRating = state.ratings[_libRatingKey(manga.id)] || 0;
        const localLastChapter = state.lastReadChapter?.[manga.id];
        const localBtnLabel = localLastChapter ? 'Continue Reading' : 'Read';
        const cachedChapterTotal = Number(state.chapterCountCache?.[manga.id]) || 1;
        let bookshelfStyle = '';
        let spineWidth = 38; // default for unknown chapter count
        if (isBookshelf25d) {
          spineWidth = getBookshelfSpineWidth(manga, cachedChapterTotal);
          // Inject per-manga stable color and spine width as CSS variables
          const spineColor = getStableSpineColor({ ...manga, sourceId: 'local' });
          bookshelfStyle = ` style="--book25d-spine-width: ${spineWidth}px; --book-spine-color: ${spineColor};"`;
          // Optional debug logging
          if (window.SCROLLSCAPE_DEBUG_BOOKSHELF_WIDTH) {
            const detectedChapters = getMangaChapterCount(manga) || cachedChapterTotal;
            console.debug('[Bookshelf25d/local]', { title: manga.title, mangaId: manga.id, detectedChapters, spineWidth });
          }
        }
        const localTypeLabel = escapeHtml((manga.type || 'local').toUpperCase());
        const localSpineData = resolveSyntheticSpineData(manga, 'local');
        const realSpineImagesLocal = resolveMangaSpineImages({ ...manga, sourceId: 'local' }, spineWidth);
        let localSpineImgNode = '';
        if (realSpineImagesLocal.length > 0) {
          if (realSpineImagesLocal.length === 1) {
            localSpineImgNode = `<img src="${escapeHtml(realSpineImagesLocal[0])}" style="width:100%; height:100%; object-fit:contain; object-position:center; border-radius:inherit; position:absolute; top:0; left:0; z-index:2; pointer-events:none;" onerror="this.style.display='none'">`;
          } else {
            const stripContent = realSpineImagesLocal.map(src => `<img src="${escapeHtml(src)}" style="height:100%; width:auto; max-width:none; object-fit:contain; object-position:center; flex:0 0 auto; display:block;" onerror="this.style.display='none'">`).join('');
            localSpineImgNode = `<div class="manga-spine-strip" style="position:absolute; inset:0; display:flex; align-items:stretch; justify-content:center; overflow:hidden; z-index:2; pointer-events:none; border-radius:inherit;">${stripContent}</div>`;
          }
        }
        const localBtnLabel2 = localLastChapter ? '▶ Continuar' : '▶ Ler';

        const local25dMarkup = `
          <div class="book25d">
            <div class="book25d-spine" style="position:relative">${localSpineImgNode}</div>
            <div class="book25d-cover-preview" aria-hidden="true">
              <img src="/api/local/${escapeHtml(manga.id)}/thumb" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="book25d-no-cover" style="display:none"><span>&#128196;</span></div>
            </div>
          </div>
          <div class="book25d-source-label" aria-hidden="true">LOCAL</div>`;
        return `
        <div class="library-card local-manga-card${isBookshelf25d ? ' library-card-bookshelf-25d' : ''}" data-book-index="${index}" data-manga-id="${escapeHtml(manga.id)}" data-source-id="local" title="${escapeHtml(manga.title || '')}"${bookshelfStyle}>
          <div class="library-card-cover">
            ${isBookshelf25d
              ? local25dMarkup
              : `<img src="/api/local/${escapeHtml(manga.id)}/thumb" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="no-cover" style="display:none">&#128196;</div>`}
            ${isBookshelf25d ? '' : `<div class="local-badge">${localTypeLabel}</div>`}
            ${isBookshelf25d ? '' : `<button class="local-delete-btn" data-manga-id="${escapeHtml(manga.id)}" title="Delete local manga">&#128465;</button>`}
            ${isBookshelf25d ? '' : `<div class="library-card-overlay"><button class="btn-read">${localBtnLabel}</button></div>`}
          </div>
          <div class="library-card-info">
            <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
            <p class="library-card-author">${localTypeLabel}</p>

            ${localRating ? `<span class="card-score-badge">${localRating}<span class="card-score-badge-max">/10</span></span>` : ""}
          </div>
        </div>`;
      }).join("")
    : "";

  if (favs.length === 0 && !localHTML) {
    grid.innerHTML = `<div class="muted">${t('library.noMangaFound')}</div>`;
    return;
  }

  if (isBookshelf25d) {
    grid.innerHTML = `
      <div class="bookshelf25d-layout">
        <div class="bookshelf25d-shelves">
          ${favHTML + localHTML}
        </div>
        <aside class="bookshelf25d-details-panel" id="bookshelf25d-panel">
          <div class="bookshelf25d-detail-placeholder">${t('library.selectManga')}</div>
        </aside>
      </div>
    `;
    const layout = grid.querySelector('.bookshelf25d-layout');
    const updatePanel = (card) => {
      const mangaId = card.dataset.mangaId;
      const sourceId = card.dataset.sourceId;
      const manga = resolveLibraryManga({ mangaId, sourceId, title: card.dataset.title });
      if (!manga) return;
      
      const panel = layout.querySelector('.bookshelf25d-details-panel');
      if (!panel) return;
      
      currentBookshelf25dPanelManga = manga;

      const settings = loadLibraryCardSettings();

      const coverUrl = sourceId === 'local' ? `/api/local/${escapeHtml(manga.id)}/thumb` : normalizeImageUrl(manga.cover);
      const title = escapeHtml(manga.title || t('library.unknownTitle'));
      const sourceName = sourceId === 'local' ? t('library.local') : (state.installedSources[sourceId]?.name || sourceId || 'MANGA');
      const cachedChapterTotal = Number(state.chapterCountCache?.[manga.id]) || 0;
      
      const readCount = cachedChapterTotal
          ? [...state.readChapters].filter(key => key.startsWith(`${manga.id}:`)).length
          : 0;
      const chaptersLeft = cachedChapterTotal ? Math.max(0, cachedChapterTotal - readCount) : null;
      const currentRating = state.ratings[_libRatingKey(manga.id)] || 0;
      const lastChapterId = state.lastReadChapter?.[manga.id];
      const btnLabel = lastChapterId ? t("library.customize.continueReadingButton") : t("library.card.openMangaPage");
      
      let metaHtml = '';
      if (settings.showChaptersRead && readCount > 0) metaHtml += `<div class="bookshelf25d-detail-meta-item">${t('library.read') || 'Read:'} <b>${readCount}</b></div>`;
      if (settings.showChaptersUnread && chaptersLeft !== null && chaptersLeft > 0) metaHtml += `<div class="bookshelf25d-detail-meta-item">${t('library.unread')} <b>${chaptersLeft}</b></div>`;
      if (settings.showTotalChapters && cachedChapterTotal) metaHtml += `<div class="bookshelf25d-detail-meta-item">${t('library.chapters')} <b>${cachedChapterTotal}</b></div>`;
      if (settings.showRating && currentRating) metaHtml += `<div class="bookshelf25d-detail-meta-item">${t('library.rating')} <b>${currentRating}/10</b></div>`;
      
      const statusKey = _libStatusKey(manga.id, manga.sourceId);
      const status = state.readingStatus[statusKey]?.status;
      if (settings.showStatus && status) {
         const i18nStatusMap = {
            reading: 'reading',
            completed: 'completed',
            on_hold: 'onHold',
            plan_to_read: 'planToRead',
            dropped: 'dropped'
         };
         metaHtml += `<div class="bookshelf25d-detail-meta-item">${t('library.status')} <b>${t('library.' + (i18nStatusMap[status] || status))}</b></div>`;
      }
      
      // Determine tags
      let tagsHtml = '';
      if (settings.showTags) {
        const rawTags = manga.categories || manga.tags || manga.genres || [];
        const tags = Array.isArray(rawTags) ? rawTags : [];
        if (tags.length > 0) {
          tagsHtml = `<div class="bookshelf25d-detail-tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
        }
      }

      // Determine description
      let descHtml = '';
      if (settings.showDescription) {
        const desc = manga.description || manga.synopsis || '';
        if (desc) {
          descHtml = `<div class="bookshelf25d-detail-desc">${escapeHtml(desc)}</div>`;
        }
      }
      
      const coverClass = `bookshelf25d-detail-cover size-desktop-${settings.coverSizeDesktop || 'medium'}`;

      const tFunc = typeof window.t === 'function' ? window.t : (k) => k.split('.').pop();
      
      const coverMarkup = coverUrl && !coverUrl.endsWith('.pdf') 
        ? `<img src="${escapeHtml(coverUrl)}" class="${coverClass} interactive-cover" alt="Cover" title="${escapeHtml(tFunc('library.card.openMangaPage'))}" style="cursor: pointer" onerror="this.style.display='none'">` 
        : `<div class="${coverClass} no-cover interactive-cover" title="${escapeHtml(tFunc('library.card.openMangaPage'))}" style="cursor: pointer"><span>?</span></div>`;

      let buttonsHtml = '';
      if (settings.showContinueBtn || settings.showCategoryBtn) {
        buttonsHtml = '<div class="bookshelf25d-detail-action" style="display:flex;flex-direction:column;gap:0.5rem">';
        if (settings.showContinueBtn) {
          buttonsHtml += `<button class="btn-read" id="bookshelf25d-panel-btn">${btnLabel}</button>`;
        }
        if (settings.showCategoryBtn) {
          buttonsHtml += `<button class="btn-read" id="bookshelf25d-panel-category-btn" style="background:var(--surface-3);color:var(--text-primary);box-shadow:none;border:1px solid var(--border-color);">${escapeHtml(tFunc('library.card.category') === 'category' ? 'Category' : tFunc('library.card.category'))}</button>`;
        }
        buttonsHtml += '</div>';
      }

      panel.innerHTML = `
        ${coverMarkup}
        <h3 class="bookshelf25d-detail-title">${title}</h3>
        ${settings.showSource ? `<div class="bookshelf25d-detail-source">${escapeHtml(sourceName)}</div>` : ''}
        ${tagsHtml}
        ${descHtml}
        ${metaHtml ? `<div class="bookshelf25d-detail-meta">${metaHtml}</div>` : ''}
        ${buttonsHtml}
      `;
      
      const readBtn = panel.querySelector('#bookshelf25d-panel-btn');
      if (readBtn) {
        readBtn.onclick = async (e) => {
          e.stopPropagation();
          const opened = await _openShelfMangaDirectly(mangaId, sourceId || 'local', manga.title);
          if (!opened) {
            if (typeof loadMangaDetails === 'function') loadMangaDetails(mangaId, "library", manga.title, false, sourceId || 'local');
            else if (typeof setView === 'function') setView("manga-details", { mangaId, sourceId });
          }
        };
      }

      const catBtn = panel.querySelector('#bookshelf25d-panel-category-btn');
      if (catBtn) {
        catBtn.onclick = (e) => {
          e.stopPropagation();
          showLibraryContextMenu(catBtn, currentBookshelf25dPanelManga, mangaCategories);
        };
      }

      const coverEl = panel.querySelector('.interactive-cover');
      if (coverEl) {
        coverEl.onclick = async (e) => {
          e.stopPropagation();
          const sourceForOpen = normalizeLibraryId(currentBookshelf25dPanelManga.sourceId) || 'local';
          const opened = await _openShelfMangaDirectly(currentBookshelf25dPanelManga.id, sourceForOpen, currentBookshelf25dPanelManga.title);
          if (!opened) {
            if (typeof loadMangaDetails === 'function') loadMangaDetails(currentBookshelf25dPanelManga.id, "library", currentBookshelf25dPanelManga.title, false, sourceForOpen);
            else if (typeof setView === 'function') setView("manga-details", { mangaId: currentBookshelf25dPanelManga.id, sourceId: sourceForOpen });
          }
        };
        coverEl.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.openMangaCoverPicker === 'function') {
            window.openMangaCoverPicker(currentBookshelf25dPanelManga, { 
              sourceId: currentBookshelf25dPanelManga.sourceId,
              sourceCover: currentBookshelf25dPanelManga._sourceCover || currentBookshelf25dPanelManga.cover,
              currentCover: currentBookshelf25dPanelManga.cover 
            });
          } else {
            showToast('Cover Picker', 'Cover picker is not available.', 'error');
          }
        };
      }

      // Single delegated context menu for the panel
      panel.oncontextmenu = (e) => {
        if (e.target.closest('.interactive-cover')) return;
        e.preventDefault();
        if (currentBookshelf25dPanelManga) {
          showLibraryContextMenu(e, currentBookshelf25dPanelManga, mangaCategories);
        }
      };
    };
    
    layout.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.library-card-bookshelf-25d');
      if (card) updatePanel(card);
    });
    layout.addEventListener('focusin', (e) => {
      const card = e.target.closest('.library-card-bookshelf-25d');
      if (card) updatePanel(card);
    });

    // Drag and Drop ordering
    let draggedCard = null;
    const cards = grid.querySelectorAll('.library-card-bookshelf-25d');
    cards.forEach(card => {
      card.setAttribute('draggable', 'true');
      
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => card.style.opacity = '0.5', 0);
      });
      
      card.addEventListener('dragend', () => {
        draggedCard = null;
        card.style.opacity = '1';
        cards.forEach(c => c.style.outline = '');
      });
      
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedCard && card !== draggedCard) {
          card.style.outline = '2px dashed var(--primary)';
        }
      });
      
      card.addEventListener('dragleave', () => {
        card.style.outline = '';
      });
      
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.outline = '';
        if (draggedCard && draggedCard !== card) {
          const id1 = draggedCard.dataset.mangaId;
          const src1 = draggedCard.dataset.sourceId;
          const id2 = card.dataset.mangaId;
          const src2 = card.dataset.sourceId;
          
          if (src1 === 'local' || src2 === 'local') return; // Exclude local manga for simplicity
          
          const key1 = `${id1}:${src1 || ''}`;
          const key2 = `${id2}:${src2 || ''}`;
          
          let fullOrder = [];
          try {
            fullOrder = JSON.parse(localStorage.getItem('bookshelfCustomOrder'));
          } catch(err) {}
          
          if (!fullOrder || !Array.isArray(fullOrder) || fullOrder.length === 0) {
            fullOrder = state.favorites.map(m => `${m.id}:${m.sourceId || ''}`);
          } else {
            // Ensure any new favorites missing from local order are appended
            state.favorites.forEach(m => {
              const k = `${m.id}:${m.sourceId || ''}`;
              if (!fullOrder.includes(k)) fullOrder.push(k);
            });
          }
          
          const idx1 = fullOrder.indexOf(key1);
          const idx2 = fullOrder.indexOf(key2);
          
          if (idx1 !== -1 && idx2 !== -1) {
            const temp = fullOrder[idx1];
            fullOrder[idx1] = fullOrder[idx2];
            fullOrder[idx2] = temp;
            
            localStorage.setItem('bookshelfCustomOrder', JSON.stringify(fullOrder));
            
            if (_libSortMode !== 'added') {
              setLibrarySortMode('added'); // Changes sort mode and triggers renderLibrary
            } else {
              renderLibrary();
            }
          }
        }
      });
    });
    const firstCard = grid.querySelector('.library-card-bookshelf-25d');
    if (firstCard) updatePanel(firstCard);
  } else {
    grid.innerHTML = favHTML + localHTML;
  }

  async function _openShelfMangaDirectly(mangaId, sourceForOpen, cardTitle = '') {
    const lastChapterId = state.lastReadChapter?.[mangaId];
    const lastPageIndex = lastChapterId
      ? (state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0)
      : 0;
    try {
      showToast(lastChapterId ? 'Resuming...' : 'Opening...', '', 'info');
      const result = await api(`/api/source/${sourceForOpen}/mangaDetails`, {
        method: 'POST',
        body: JSON.stringify({ mangaId })
      });
      state.currentManga = result;

      const cr = await api(`/api/source/${sourceForOpen}/chapters`, {
        method: 'POST',
        body: JSON.stringify({ mangaId })
      });
      state.allChapters = cr.chapters || [];
      state.chapterCountCache[mangaId] = state.allChapters.length;
      saveSettings();

      if (!state.allChapters.length) return false;

      let idx = -1;
      if (lastChapterId) idx = state.allChapters.findIndex(c => c.id === lastChapterId);
      if (idx < 0) idx = 0;

      const ch = state.allChapters[idx];
      await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, idx === 0 ? 0 : lastPageIndex);
      return true;
    } catch (err) {
      showToast('Error', err.message, 'error');
      return false;
    }
  }

  grid.querySelectorAll(".library-card").forEach(card => {
    let pressTimer = null;
    let startX = 0, startY = 0;

    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mangaId = card.dataset.mangaId;
      const sourceId = card.dataset.sourceId;
      
      const manga = resolveLibraryManga({ mangaId, sourceId, title: card.dataset.title });
      if (manga) {
        const isSpineClick = e.target.closest('.book3d-spine, .book25d-spine');
        if (isSpineClick) {
          const spines = getAvailableMangaSpines(manga);
          if (spines.length > 1) {
            if (typeof window.openMangaSpinePicker === 'function') {
              window.openMangaSpinePicker({ manga, spines, anchorEvent: e });
            }
            return;
          } else if (spines.length === 1) {
            const tFunc = typeof window.t === 'function' ? window.t : (k) => k.split('.').pop();
            if (typeof showToast === 'function') showToast('Spine', tFunc('library.spine.onlyOne'), 'info');
            return;
          }
        }
        showLibraryContextMenu(e, manga, mangaCategories);
      }
    };

    card.addEventListener('contextmenu', handleContextMenu);

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        handleContextMenu(e);
      }, 600);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!pressTimer) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }, { passive: true });

    const cancelTouch = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    card.addEventListener('touchend', cancelTouch);
    card.addEventListener('touchcancel', cancelTouch);
  });

  grid.querySelectorAll(".library-card:not(.local-manga-card)").forEach(card => {
    const mangaId  = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    const cardTitle = card.dataset.title || '';

    card.onclick = async (e) => {
      // Don't navigate if the click was on or inside the context menu
      if (e.target.closest('#libraryContextMenu')) return;

      // Ctrl + left-click: toggle multi-selection for bulk actions
      if (e.ctrlKey && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        _toggleLibraryCardSelection(card);
        return;
      }

      // Normal click clears multi-selection and keeps default navigation behavior
      if (_librarySelectedKeys.size) {
        _clearLibrarySelection(grid);
      }

      const prevSource = state.currentSourceId;
      const fav = (state.favorites || []).find(m => String(m.id) === String(mangaId) && String(m.title || '') === String(cardTitle || m.title || ''));
      const resolvedSourceId = sourceId || fav?.sourceId || '';

      if (resolvedSourceId && resolvedSourceId !== state.currentSourceId) {
        state.currentSourceId = resolvedSourceId;
        renderSourceSelect();
        const srcName = state.installedSources[resolvedSourceId]?.name || resolvedSourceId;
        showToast("Source switched", srcName, "info");
      }

      const sourceForOpen = resolvedSourceId || state.currentSourceId;
      const clickedReadButton = !!e.target.closest('.btn-read');
      const shouldTryDirectOpen = clickedReadButton || isStripeShelf;
      if (shouldTryDirectOpen) {
        const opened = await _openShelfMangaDirectly(mangaId, sourceForOpen, cardTitle);
        if (opened) return;
      }

      await loadMangaDetails(mangaId, "library", cardTitle, false, sourceForOpen);
      if (!state.currentSourceId) state.currentSourceId = prevSource;
    };
  });

  grid.querySelectorAll(".local-manga-card").forEach(card => {
    const mangaId = card.dataset.mangaId;
    card.onclick = async (e) => {
      if (e.target.closest(".local-delete-btn")) return;
      state.currentSourceId = "local";

      const clickedReadButton = !!e.target.closest('.btn-read');
      const shouldTryDirectOpen = clickedReadButton || isStripeShelf;
      if (shouldTryDirectOpen) {
        const opened = await _openShelfMangaDirectly(mangaId, 'local');
        if (opened) return;
      }

      await loadMangaDetails(mangaId, "library");
    };
  });

  grid.querySelectorAll(".local-delete-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const mangaId = btn.dataset.mangaId;
      if (!confirm("Delete this local manga?")) return;
      await deleteLocalManga(mangaId);
    };
  });
}

async function loadLocalManga() {
  try {
    const data = await api("/api/local/list");
    state.localManga = data.localManga || [];
  } catch (_) { state.localManga = []; }
}

async function deleteLocalManga(mangaId) {
  try {
    await api(`/api/local/${mangaId}`, { method: "DELETE" });
    state.localManga = state.localManga.filter(m => m.id !== mangaId);
    renderLibrary();
    showToast("Deleted", "Local manga removed", "info");
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

// ── Library right-click context menu ─────────────────────────────────────────

function _closeLibraryContextMenu() {
  document.getElementById('libraryContextMenu')?.remove();
  document.removeEventListener('click', _ctxDocClickHandler, true);
  document.removeEventListener('keydown', _ctxMenuKeyHandler);
}

function _ctxMenuKeyHandler(e) {
  if (e.key === 'Escape') _closeLibraryContextMenu();
}

function _ctxDocClickHandler(e) {
  if (e?.target?.closest && e.target.closest('#libraryContextMenu')) return;
  _closeLibraryContextMenu();
}

async function showLibraryContextMenu(pointOrEvent, mangaInput, mangaCategories) {
  _closeLibraryContextMenu();

  // Try to cleanly resolve the manga context including the correct sourceId.
  const manga = resolveLibraryManga({
    mangaId: mangaInput.id,
    sourceId: mangaInput.sourceId,
    title: mangaInput.title
  }) || mangaInput; // fallback to input if resolution completely fails

  const actionMangas = _getLibraryActionTargets(manga);
  const isBulk = actionMangas.length > 1;
  const bulkPrefix = isBulk ? `Selected (${actionMangas.length})` : 'Current';

  const sourceId = normalizeLibraryId(manga.sourceId);
  if (!sourceId) {
    showToast('Categories', 'Could not resolve source for this manga.', 'warning');
    return;
  }
  const primaryKey = `${manga.id}:${sourceId}`;
  const legacyKey  = `${manga.id}:`;
  const currentCatIds = Array.from(new Set([
    ...(mangaCategories[primaryKey] || []),
    ...(mangaCategories[legacyKey] || []),
  ]));
  const statusKey = _libStatusKey(manga.id, sourceId);
  const currentStatus = state.readingStatus[statusKey]?.status || null;

  // Pre-fetch current categories from server for accuracy.
  // For bulk mode we keep the checkbox list empty by default to avoid accidental overwrite.
  let serverCatIds = [...currentCatIds];
  if (!isBulk) {
    try {
      const d = await api(`/api/lists/manga/${encodeURIComponent(manga.id)}/categories?sourceId=${encodeURIComponent(sourceId)}`);
      serverCatIds = d.categoryIds || currentCatIds;
    } catch (_) {}
  } else {
    serverCatIds = [];
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'libraryContextMenu';

  const _ico = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;

  const categoriesSection = (state.customLists || []).length > 0
    ? `<div class="context-divider"></div>
       <div class="ctx-categories-header">Categories</div>
       <div class="ctx-categories-list">
         ${(state.customLists || []).map(l => `
           <label class="ctx-cat-label">
             <input type="checkbox" class="ctx-cat-cb" value="${escapeHtml(l.id)}" ${serverCatIds.includes(l.id) ? 'checked' : ''}>
             <span>${escapeHtml(l.name)}</span>
           </label>`).join('')}
       </div>
       <div style="padding:0.35rem 0.55rem 0.6rem">
         <button class="btn primary ctx-save-cats-btn" style="width:100%;font-size:0.82rem;padding:0.42rem 0.75rem">${isBulk ? `Apply Categories to ${actionMangas.length}` : 'Save Categories'}</button>
       </div>`
    : `<div class="context-divider"></div>
       <div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">No categories — create one in the library bar</div>`;

  menu.innerHTML = `
    <div class="ctx-categories-header" style="padding-top:0.55rem;padding-bottom:0.35rem">${bulkPrefix} manga actions</div>
    <button class="context-item" id="ctxDownloadAll">${_ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')} ${isBulk ? `Download All Chapters (${actionMangas.length})` : 'Download All'}</button>
    <div class="context-divider"></div>
    ${!isBulk && sourceId !== 'local' ? `<button class="context-item" id="ctxChangeCover">${_ico('<rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>')} Change Cover</button><button class="context-item" id="ctxMigrateOne">${_ico('<path d="M8 7h13M13 3l4 4-4 4"/><path d="M16 17H3"/><path d="M7 13l-4 4 4 4"/>')} Migrate this manga</button><div class="context-divider"></div>` : ''}
    <button class="context-item ${currentStatus === 'completed' ? 'ctx-item-active' : ''}" id="ctxMarkCompleted">${_ico('<polyline points="20 6 9 17 4 12"/>')} ${isBulk ? 'Mark Selected as Completed' : 'Mark as Completed'}</button>
    <button class="context-item ${currentStatus === 'reading'   ? 'ctx-item-active' : ''}" id="ctxMarkReading">${_ico('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>')} ${isBulk ? 'Mark Selected as Reading' : 'Mark as Reading'}</button>
    <button class="context-item ${!currentStatus             ? 'ctx-item-active' : ''}" id="ctxRemoveStatus">${_ico('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>')} ${isBulk ? 'Mark Selected as Unread' : 'Mark as Unread'}</button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxRemoveFromLibrary">${_ico('<path d="M3 6h18M9 6v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6"/><path d="M10 11v6M14 11v6"/>')} ${isBulk ? 'Remove Selected from Library' : 'Remove from Library'}</button>
    ${sourceId !== 'local' ? categoriesSection : `<div class="context-divider"></div><div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">Categories not supported for local manga</div>`}`;

  document.body.appendChild(menu);

  // Position: avoid going off-screen
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 240, mh = menu.offsetHeight || 300;
  
  let { x, y } = getContextMenuPoint(pointOrEvent);

  if (x + mw > vw - 8) x = vw - mw - 8;
  if (y + mh > vh - 8) y = vh - mh - 8;
  if (y < 8) y = 8;
  if (x < 8) x = 8;
  
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  // ── Actions ────────────────────────────────────────────────────────────────

  // Remove from Library (single or bulk)
  menu.querySelector('#ctxRemoveFromLibrary').onclick = async () => {
    if (!actionMangas.length) return;
    if (!confirm(isBulk ? `Remove ${actionMangas.length} manga from your library?` : 'Remove this manga from your library?')) return;
    let ok = 0, fail = 0;
    for (const m of actionMangas) {
      try {
        await ensureMangaNotInLibrary(m.id, m.sourceId);
        
        // Remove reading status
        const key = _libStatusKey(m.id, m.sourceId);
        if (state.readingStatus) delete state.readingStatus[key];
        ok++;
      } catch (err) {
        fail++;
      }
    }
    _clearLibrarySelection();
    renderLibrary();
    showToast('Removed', ok ? `${ok} manga removed${fail ? `, ${fail} failed` : ''}` : 'No manga removed', fail ? 'warning' : 'info');
    _closeLibraryContextMenu();
  };

  const changeCoverBtn = menu.querySelector('#ctxChangeCover');
  if (changeCoverBtn) {
    changeCoverBtn.onclick = () => {
      _closeLibraryContextMenu();
      if (typeof window.openMangaCoverPicker === 'function') {
        window.openMangaCoverPicker(manga, {
          sourceId,
          sourceCover: manga._sourceCover || manga.cover,
          currentCover: manga.cover,
        });
      }
    };
  }

  const migrateOneBtn = menu.querySelector('#ctxMigrateOne');
  if (migrateOneBtn) {
    migrateOneBtn.onclick = () => {
      _closeLibraryContextMenu();
      if (typeof showMigrateModalForManga === 'function') {
        showMigrateModalForManga({ ...manga, sourceId });
      } else {
        showToast('Migration', 'Migration UI is not ready yet.', 'warning');
      }
    };
  }

  // Download All
  menu.querySelector('#ctxDownloadAll').onclick = async () => {
    _closeLibraryContextMenu();
    showToast('Download', isBulk ? `Preparing ${actionMangas.length} manga…` : 'Loading chapters…', 'info');

    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid || sid === 'local') { fail++; continue; }

      try {
        state.currentSourceId = sid;
        state.currentManga = item;
        const cr = await api(`/api/source/${sid}/chapters`, {
          method: 'POST', body: JSON.stringify({ mangaId: item.id })
        });
        const chapters = (cr.chapters || []).map((ch, i) => ({
          id: ch.id,
          name: ch.name || `Chapter ${ch.chapter || i + 1}`,
        }));

        if (!chapters.length) { fail++; continue; }

        if (typeof downloadBulkChapters === 'function') {
          await downloadBulkChapters(chapters);
          ok++;
        } else {
          showBulkDownloadModal(cr.chapters || []);
          ok++;
          break;
        }
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    showToast('Download', `${ok} manga processed${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  // Status helpers
  const setStatus = async (status) => {
    _closeLibraryContextMenu();
    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid) { fail++; continue; }
      try {
        const res = await api('/api/user/status', {
          method: 'POST',
          body: JSON.stringify({ mangaId: item.id, sourceId: sid, status, mangaData: item }),
        });
        state.readingStatus = res.readingStatus || state.readingStatus;
        ok++;
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    const msg = status === 'none' ? 'set to unread' : `marked as ${statusLabel(status).toLowerCase()}`;
    showToast('Status', `${ok} manga ${msg}${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  menu.querySelector('#ctxMarkCompleted').onclick = () => setStatus('completed');
  menu.querySelector('#ctxMarkReading').onclick   = () => setStatus('reading');
  menu.querySelector('#ctxRemoveStatus').onclick  = () => setStatus('none');

  // Save categories
  const saveCatsBtn = menu.querySelector('.ctx-save-cats-btn');
  if (saveCatsBtn) {
    saveCatsBtn.onclick = async (ev) => {
      ev.stopPropagation();
      const checked = [...menu.querySelectorAll('.ctx-cat-cb:checked')].map(cb => cb.value);
      saveCatsBtn.disabled = true;
      try {
        const payload = {
          mangaId: manga.id,
          sourceId,
          categoryIds: checked,
          mangaData: { ...manga, sourceId },
        };
        const applyForOne = async (oneManga) => {
          const oneSourceId = oneManga.sourceId
            || state.currentSourceId
            || (state.favorites || []).find(f => String(f.id) === String(oneManga.id))?.sourceId
            || '';
          if (!oneSourceId) throw new Error('Could not resolve source id for selected manga.');

          const onePayload = {
            mangaId: oneManga.id,
            sourceId: oneSourceId,
            categoryIds: checked,
            mangaData: { ...oneManga, sourceId: oneSourceId },
          };

          try {
            await api('/api/lists/manga-categories', {
              method: 'PUT',
              body: JSON.stringify(onePayload),
            });
          } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            const isRouteConflict = msg.includes('list not found') || msg.includes('category not found');
            if (!isRouteConflict) throw err;

            const current = await api(`/api/lists/manga/${encodeURIComponent(onePayload.mangaId)}/categories?sourceId=${encodeURIComponent(onePayload.sourceId)}`);
            const currentIds = new Set(current.categoryIds || []);
            const freshLists = await api('/api/lists');
            const validIds = new Set((freshLists.lists || []).map(l => l.id));
            const targetIds = new Set((onePayload.categoryIds || []).filter(id => validIds.has(id)));

            const toAdd = [...targetIds].filter(id => !currentIds.has(id));
            const toRemove = [...currentIds].filter(id => !targetIds.has(id));

            for (const listId of toAdd) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga`, {
                method: 'POST',
                body: JSON.stringify({ mangaData: onePayload.mangaData }),
              });
            }
            for (const listId of toRemove) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga/${encodeURIComponent(onePayload.mangaId)}`, {
                method: 'DELETE',
              });
            }
          }
        };

        let ok = 0;
        let fail = 0;
        for (const one of actionMangas) {
          try {
            await applyForOne(one);
            ok++;
          } catch (_) {
            fail++;
          }
        }

        await (async () => { try { const d = await api('/api/lists'); state.customLists = d.lists || []; } catch (_) {} })();
        _closeLibraryContextMenu();
        _clearLibrarySelection();
        renderLibrary();
        showToast('Categories', `${ok} manga updated${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
        saveCatsBtn.disabled = false;
      }
    };
  }

  // Prevent checkbox clicks from closing the menu
  menu.querySelectorAll('.ctx-cat-cb').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
  });
  menu.querySelectorAll('.ctx-cat-label').forEach(lbl => {
    lbl.addEventListener('click', e => e.stopPropagation());
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _ctxDocClickHandler, true);
    document.addEventListener('keydown', _ctxMenuKeyHandler);
  }, 0);
}

