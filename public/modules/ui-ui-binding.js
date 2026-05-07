// ============================================================================
// UI BINDING
// ============================================================================

function bindUI() {
  initAdvancedFilters();

  // Sidebar toggle (mobile)
  const toggle   = $("sidebarToggle");
  const backdrop = $("sidebarBackdrop");
  if (toggle)   toggle.onclick   = () => document.body.classList.toggle("sidebar-open");
  if (backdrop) backdrop.onclick = () => document.body.classList.remove("sidebar-open");

  // Nav links
  document.querySelectorAll(".nav-link[data-view]").forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      setView(link.dataset.view);
      document.body.classList.remove("sidebar-open");
    };
  });

  // Back buttons
  const backBtn = $("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const previous = navigationManager.goBack();
      if (previous) {
        // Restore specific view states
        if (previous.view === 'manga-details' && previous.context.mangaId && previous.context.sourceId) {
          // Temporarily set the source and load the manga details
          const prevSource = state.currentSourceId;
          state.currentSourceId = previous.context.sourceId;
          loadMangaDetails(previous.context.mangaId);
          // Note: loadMangaDetails will call setView internally
        } else {
          setView(previous.view, previous.context, true);
        }
      }
    };
  }

  // Search
  const searchBtn   = $("searchBtn");
  const searchInput = $("searchInput");
  if (searchBtn)   searchBtn.onclick = () => { clearTimeout(_liveSearchTimer); search(); };
  if (searchInput) {
    searchInput.onkeypress = (e) => { if (e.key === "Enter") { clearTimeout(_liveSearchTimer); search(); } };
    searchInput.oninput = () => {
      clearTimeout(_liveSearchTimer);
      _liveSearchTimer = setTimeout(() => search(), 450);
    };
  }

  // Theme toggle
  const themeBtn = $("themeToggle");
  if (themeBtn) themeBtn.onclick = toggleTheme;

  // Settings button (sidebar)
  const settingsBtnSidebar = $("btn-settings-sidebar");
  if (settingsBtnSidebar) settingsBtnSidebar.onclick = showSettings;

  const readerSettingsBtn = $("readerSettingsBtn");
  if (readerSettingsBtn) readerSettingsBtn.onclick = showSettings;
  const readerSidebarToggle = $("readerSidebarToggle");
  if (readerSidebarToggle) {
    readerSidebarToggle.onclick = () => {
      const reader = $("reader");
      if (reader) reader.classList.toggle("reader-sidebar-collapsed");
    };
  }

  // Reader controls
  const closeReader = $("closeReader");
  const prevPage    = $("prevPage");
  const nextPage    = $("nextPage");
  const prevPageCorner = $("prevPageCorner");
  const nextPageCorner = $("nextPageCorner");

  if (closeReader) closeReader.onclick = () => hideReader();

  const goPrevPage = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("backward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("backward"); return; }
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      state.currentPageIndex--;
      renderPage();
    }
  };

  const goNextPage = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("forward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("forward"); return; }
    if (state.currentPageIndex === (state.currentChapter?.pages?.length ?? 1) - 1) {
      goToNextChapter();
    } else {
      state.currentPageIndex++;
      renderPage();
    }
  };

  if (prevPage) prevPage.onclick = goPrevPage;
  if (nextPage) nextPage.onclick = goNextPage;
  if (prevPageCorner) prevPageCorner.onclick = () => goToPrevChapter();
  if (nextPageCorner) nextPageCorner.onclick = () => goToNextChapter();

  // Zoom controls
  const zoomIn    = $("zoomIn");
  const zoomOut   = $("zoomOut");
  const zoomReset = $("zoomReset");
  if (zoomIn)    zoomIn.onclick    = () => applyZoom(+0.1);
  if (zoomOut)   zoomOut.onclick   = () => applyZoom(-0.1);
  if (zoomReset) zoomReset.onclick = () => {
    const mode = state.settings.readingMode;
    state.zoomLevel = (mode === "ltr" || mode === "rtl") ? 1.2 : 1.0;
    updateZoomUI();
    renderPage();
  };

  // AutoScroll controls
  const autoScrollToggle = $("autoScrollToggle");
  const autoScrollSpeed  = $("autoScrollSpeed");
  if (autoScrollToggle) autoScrollToggle.onclick = toggleAutoScroll;
  if (autoScrollSpeed) {
    autoScrollSpeed.value = state.autoScroll.speed;
    autoScrollSpeed.oninput = (e) => {
      state.autoScroll.speed = parseInt(e.target.value, 10);
      const labels = ["Slow", "Medium", "Fast", "Faster", "Fastest"];
      const labelEl = $("autoScrollSpeedLabel");
      if (labelEl) labelEl.textContent = labels[state.autoScroll.speed - 1] || "Medium";
      if (state.autoScroll.enabled) { stopAutoScroll(); startAutoScroll(); }
    };
  }

  // Keyboard shortcuts in reader
  document.addEventListener("keydown", (e) => {
    if ($("reader")?.classList.contains("hidden")) return;
    const mode = state.settings.readingMode;
    if (e.key === "ArrowRight" || e.key === "d") {
      if (mode !== "webtoon") {
        if (mode === "rtl")      { navigateBook("backward"); }
        else if (mode === "ltr") { navigateLTR("forward"); }
        else { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
      }
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      if (mode !== "webtoon") {
        if (mode === "rtl")      { navigateBook("forward"); }
        else if (mode === "ltr") { navigateLTR("backward"); }
        else { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
      }
    } else if (e.key === "Escape") {
      hideReader();
    } else if (e.key === "+" || e.key === "=") {
      applyZoom(+0.1);
    } else if (e.key === "-" || e.key === "_") {
      applyZoom(-0.1);
    }
  });

  // Advanced search buttons
  const advBtn   = $("advancedSearchBtn");
  const advInput = $("advancedSearchInput");
  const randBtn  = $("randomMangaBtn");
  if (advBtn)   advBtn.onclick   = () => advancedSearch();
  if (advInput) advInput.onkeypress = (e) => { if (e.key === "Enter") advancedSearch(); };
  if (randBtn)  randBtn.onclick  = openRandomPickerDrawer;

  // Initialize advanced filters
  initAdvancedFilters();

  // Library status filter
  const libFilter = $("libraryStatusFilter");
  if (libFilter) libFilter.onchange = (e) => {
    // If triggered programmatically by setView to sync the custom select label, skip
    if (e.target.dataset.settingSync === "1") return;
    e.target.dataset.userChanged = "1";
    renderLibrary();
  };

  // Library category filter
  const libCatFilter = $("libraryCategoryFilter");
  if (libCatFilter) libCatFilter.onchange = renderLibrary;

  // Library text search
  const libSearchInput = $("librarySearchInput");
  if (libSearchInput) libSearchInput.oninput = renderLibrary;

  // Manage categories button
  const btnMgmtCat = $("btnManageCategories");
  if (btnMgmtCat) btnMgmtCat.onclick = () => showManageCategoriesModal();

  // Sort library button
  const btnSort = $("btnSortLibrary");
  if (btnSort) btnSort.onclick = () => openLibrarySortDrawer();

  // Migrate library button
  const btnMigrate = $("btnMigrateLibrary");
  if (btnMigrate) btnMigrate.onclick = () => showMigrateModal();

  // Language toggle button
  const langBtn = $("langToggleBtn");
  if (langBtn) {
    langBtn.textContent = currentLanguage.toUpperCase();
    langBtn.onclick = () => setLanguage(currentLanguage === 'en' ? 'pt' : 'en');
  }
}

// ============================================================================

// CUSTOMIZATION

// ============================================================================



const CUSTOM_PRESETS_KEY = 'scrollscape_custom_presets';

const CUSTOM_ACTIVE_KEY  = 'scrollscape_active_custom';
const CUSTOM_PRESETS_API = '/api/theme-presets';

const CUSTOM_FONT_OPTIONS = [
  { value: '', label: 'System UI' },
  { value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", label: 'Segoe UI' },
  { value: "'Trebuchet MS', 'Segoe UI', sans-serif", label: 'Trebuchet MS' },
  { value: "'Georgia', 'Times New Roman', serif", label: 'Georgia' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Orbitron', sans-serif", label: 'Orbitron' }
];

// Shared callback so initColorPicker can trigger livePreview
var _cpLivePreviewCb = null;
// Tracks whether we are currently editing an existing preset
var _editingPresetId = null;
var _customPresetSyncTimer = null;

async function _fetchCustomPresetsFromDisk() {
  try {
    var res = await fetch(CUSTOM_PRESETS_API, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    return Array.isArray(data && data.presets) ? data.presets : [];
  } catch (_) {
    return null;
  }
}

function _refreshPresetViewsIfVisible() {
  var customizeView = document.getElementById('view-customize');
  if (customizeView && !customizeView.classList.contains('hidden')) {
    renderCustomizeView();
  }
  var themesView = document.getElementById('view-themes');
  if (themesView && !themesView.classList.contains('hidden') && typeof renderThemesView === 'function') {
    renderThemesView();
  }
}

function _queueCustomPresetDiskSave(arr) {
  if (_customPresetSyncTimer) clearTimeout(_customPresetSyncTimer);
  _customPresetSyncTimer = setTimeout(async function() {
    _customPresetSyncTimer = null;
    try {
      await fetch(CUSTOM_PRESETS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: Array.isArray(arr) ? arr : [] }),
      });
    } catch (_) {
      // Keep UX resilient when disk sync fails; localStorage remains source of truth.
    }
  }, 180);
}

async function syncCustomPresetsFromDisk() {
  var local = getCustomPresets();
  var remote = await _fetchCustomPresetsFromDisk();
  if (remote === null) return;

  if (remote.length > 0) {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(remote));
    _refreshPresetViewsIfVisible();
    return;
  }

  if (local.length > 0) {
    _queueCustomPresetDiskSave(local);
  }
}



function getCustomPresets() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]'); } catch (e) { return []; }

}

function saveCustomPresets(arr) {

  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(arr));
  _queueCustomPresetDiskSave(arr);

}

function getActiveCustom() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_ACTIVE_KEY) || 'null'); } catch (e) { return null; }

}

function setActiveCustom(cfg) {

  if (cfg) localStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(cfg));

  else     localStorage.removeItem(CUSTOM_ACTIVE_KEY);

}

function resetBaseThemeForCustomActivation() {
  if (typeof window.getActiveTheme !== 'function' || typeof window.applyTheme !== 'function') return;
  var current = window.getActiveTheme();
  if (current && current !== 'default') {
    localStorage.setItem('scrollscape_active_theme', 'default');
    window.applyTheme('default');
  }
}



// ── Palette colour helpers ───────────────────────────────────────────────────
function _hexToHsv(hex) {
  var r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, h=0, s=max===0?0:d/max, v=max;
  if(max!==min){switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h*=60;}
  return {h:h,s:s,v:v};
}
function _hsvToHex(h,s,v){
  h=((h%360)+360)%360;
  var i=Math.floor(h/60)%6,f=h/60-Math.floor(h/60);
  var p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  var rgb=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
  return '#'+rgb.map(function(x){return Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0');}).join('');
}
function _derivePalette(hex){
  var c=_hexToHsv(hex);
  return {
    primary: hex,
    dark:  _hsvToHex(c.h, Math.min(1,c.s*1.05), c.v*0.62),
    light: _hsvToHex(c.h, Math.max(0,c.s*0.55), Math.min(1,c.v+0.18))
  };
}

function _sanitizeCustomFontFamily(value) {
  var raw = String(value || '');
  var found = CUSTOM_FONT_OPTIONS.find(function(opt) { return opt.value === raw; });
  return found ? found.value : '';
}

function _sanitizeCustomPercent(value, fallback) {
  var num = Number(value);
  if (!isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function applyCustomization(cfg) {

  ['custom-char', 'custom-corner', 'custom-bg-layer', 'custom-header-layer'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { if (el._obs) el._obs.disconnect(); el.remove(); }
  });

  // Reset topbar inline styles set by a previous header image
  var _topbar = document.querySelector('.topbar');
  if (_topbar) { _topbar.style.minHeight = ''; _topbar.style.position = ''; _topbar.style.overflow = ''; }

  var styleEl = document.getElementById('custom-live-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-live-style';
    document.head.appendChild(styleEl);
  }
  var palStyleEl = document.getElementById('custom-palette-style');
  if (!palStyleEl) {
    palStyleEl = document.createElement('style');
    palStyleEl.id = 'custom-palette-style';
    document.head.appendChild(palStyleEl);
  }

  if (!cfg) { styleEl.textContent = ''; palStyleEl.textContent = ''; return; }

  var bgUrl      = cfg.bgUrl      || '';
  var bgDim      = cfg.bgDim      != null ? cfg.bgDim      : 0;
  var bgOpac     = cfg.bgOpac     != null ? cfg.bgOpac     : 0;
  var headerUrl  = cfg.headerUrl  || '';
  var headerDim  = cfg.headerDim  != null ? cfg.headerDim  : 0;
  var headerOpac = cfg.headerOpac != null ? cfg.headerOpac : 0;
  var headerPosX = _sanitizeCustomPercent(cfg.headerPosX, 50);
  var headerPosY = _sanitizeCustomPercent(cfg.headerPosY, 50);
  var charUrl    = cfg.charUrl    || '';
  var charDim    = cfg.charDim    != null ? cfg.charDim    : 0;
  var charDark   = cfg.charDark   != null ? cfg.charDark   : 0;
  var cornerUrl  = cfg.cornerUrl  || '';
  var cornerDim  = cfg.cornerDim  != null ? cfg.cornerDim  : 0;
  var cornerDark = cfg.cornerDark != null ? cfg.cornerDark : 0;
  var fontFamily = _sanitizeCustomFontFamily(cfg.fontFamily);

  var css = '';
  if (fontFamily) {
    css += "body, .sidebar-brand-text, .brand, .section-title, h1, h2, h3, h4, h5, h6 { font-family:" + fontFamily + " !important; }\n";
  }
  styleEl.textContent = css;

  if (headerUrl) {
    var hdrLayer = document.createElement('div');
    hdrLayer.id = 'custom-header-layer';
    hdrLayer.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;' +
        "background:linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")),url('" + headerUrl + "') " + headerPosX + "% " + headerPosY + "%/cover no-repeat;" +
      'opacity:' + ((100 - headerOpac) / 100);
    var topbarEl = document.querySelector('.topbar');
    if (topbarEl) {
      topbarEl.style.position = 'relative';
      topbarEl.style.overflow = 'hidden';
      topbarEl.appendChild(hdrLayer);
    }
  }

  if (bgUrl) {
    var bgLayer = document.createElement('div');
    bgLayer.id = 'custom-bg-layer';
    bgLayer.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;' +
      "background:linear-gradient(rgba(0,0,0," + (bgDim/100) + "),rgba(0,0,0," + (bgDim/100) + ")),url('" + bgUrl + "') center/cover fixed;" +
      'opacity:' + ((100 - bgOpac) / 100);
    document.body.appendChild(bgLayer);
  }

  function _mkOverlay(id, wrapCss, imgCss, opac, src, brightness) {
    var w = document.createElement('div');
    w.id = id; w.style.cssText = wrapCss + ';opacity:' + opac;
    var i = document.createElement('img');
    i.src = src; i.alt = ''; i.style.cssText = imgCss;
    if (brightness != null) i.style.filter = 'brightness(' + brightness + ')';
    w.appendChild(i); document.body.appendChild(w);
    var re = document.getElementById('reader');
    if (re) {
      var sv = function() { w.style.display = re.classList.contains('hidden') ? '' : 'none'; };
      var ob = new MutationObserver(sv);
      ob.observe(re, { attributes: true, attributeFilter: ['class'] });
      w._obs = ob; sv();
    }
  }

  // Both overlays at left:0 (left edge of screen).
  // z-index must exceed the sidebar (100) so they are visible.
  // pointer-events:none is already set, so sidebar/content clicks pass through.
  // Left Column (z-index:102) appears on top of Corner Card (z-index:101).

  if (charUrl) {
    _mkOverlay(
      'custom-char',
      'position:fixed;bottom:0;left:0;width:240px;height:100vh;pointer-events:none;overflow:hidden;z-index:102;-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 100%);mask-image:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 100%)',
      'position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:90vh;width:auto;object-fit:contain',
      (100 - charDim) / 100, charUrl, 1 - charDark / 100
    );
  }

  if (cornerUrl) {
    _mkOverlay(
      'custom-corner',
      'position:fixed;bottom:0;left:0;width:240px;height:210px;border-radius:0 12px 0 0;pointer-events:none;overflow:hidden;z-index:101;background:rgba(0,0,0,0.18);-webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 42%);mask-image:linear-gradient(to bottom,transparent 0%,black 42%)',
      'position:absolute;bottom:0;left:0;width:100%;height:100%;object-fit:cover',
      (100 - cornerDim) / 100, cornerUrl, 1 - cornerDark / 100
    );
  }

  // Apply custom palette colours directly on the root element as inline style —
  // inline styles have higher priority than any stylesheet rule (including active themes).
  var paletteColor = cfg.paletteColor || '';
  var buttonColor  = cfg.buttonColor  || '';
  if (paletteColor && /^#[0-9a-f]{6}$/i.test(paletteColor)) {
    var pal = _derivePalette(paletteColor);
    document.documentElement.style.setProperty('--primary',       pal.primary);
    document.documentElement.style.setProperty('--primary-dark',  pal.dark);
    document.documentElement.style.setProperty('--primary-light', pal.light);
  } else {
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--primary-dark');
    document.documentElement.style.removeProperty('--primary-light');
  }
  if (buttonColor && /^#[0-9a-f]{6}$/i.test(buttonColor)) {
    palStyleEl.textContent = '.btn { --btn-color: ' + buttonColor + ' !important; } .btn:hover:not(:disabled) { background: color-mix(in srgb, ' + buttonColor + ' 80%, white) !important; }';
  } else {
    palStyleEl.textContent = '';
  }

}



function renderCustomizeView() {
  var tr = function(key) { return t(key); };

  var presets = getCustomPresets();
  var presetThemeIds = new Set(typeof getThemePresetIds === 'function' ? getThemePresetIds() : []);

  var active  = getActiveCustom() || {};



  var presetsHtml = presets.length

    ? presets.map(function(p) {
        var inThemes = presetThemeIds.has(p.id);

        return '<div class="custom-preset-card" id="preset-card-' + p.id + '">' +

          '<div class="custom-preset-info"><span class="custom-preset-name">' + escapeHtml(p.name) + '</span></div>' +

          '<div class="custom-preset-actions">' +

            '<button id="preset-theme-btn-' + p.id + '" class="btn secondary ' + (inThemes ? 'is-added-theme' : '') + '" onclick="togglePresetInThemes(\'' + p.id + '\')">' + escapeHtml(inThemes ? tr('action.addedToThemes') : tr('action.addToThemes')) + '</button>' +

            '<button class="btn secondary" onclick="applyCustomPreset(\'' + p.id + '\')">' + escapeHtml(tr('action.apply')) + '</button>' +

            '<button class="btn secondary" onclick="editCustomPreset(\'' + p.id + '\')">' + escapeHtml(tr('action.edit')) + '</button>' +

            '<button class="btn danger" onclick="deleteCustomPreset(\'' + p.id + '\')">' + escapeHtml(tr('action.remove')) + '</button>' +

          '</div></div>';

      }).join('')

    : '<p class="muted" style="text-align:center;padding:1rem">' + escapeHtml(tr('customization.noSavedPresets')) + '</p>';



  var bgu = escapeHtml(active.bgUrl || '');

  var bd  = active.bgDim     || 0;

  var cu  = escapeHtml(active.charUrl   || '');

  var cd  = active.charDim   || 0;

  var hu  = escapeHtml(active.headerUrl || '');

  var hd  = active.headerDim || 0;

  var hpx = _sanitizeCustomPercent(active.headerPosX, 50);

  var hpy = _sanitizeCustomPercent(active.headerPosY, 50);

  var cou = escapeHtml(active.cornerUrl || '');

  var cod = active.cornerDim || 0;

  var bgo  = active.bgOpac     || 0;

  var chd  = active.charDark   || 0;

  var ho   = active.headerOpac || 0;

  var cod2 = active.cornerDark || 0;



  var prevBg  = bgu ? "background:linear-gradient(rgba(0,0,0," + (bd/100) + "),rgba(0,0,0," + (bd/100) + ")),url('" + bgu + "') center/cover"  : '';

  var prevCh  = cu  ? "background:url('" + cu + "') center top/contain no-repeat" : '';

  var prevHdr = hu  ? "background:linear-gradient(rgba(0,0,0," + (hd/100) + "),rgba(0,0,0," + (hd/100) + ")),url('" + hu + "') " + hpx + "% " + hpy + "%/cover no-repeat" : '';

  var prevCor = cou ? "background:url('" + cou + "') center/cover no-repeat" : '';
  var activeFont = _sanitizeCustomFontFamily(active.fontFamily);
  var fontOptionsHtml = CUSTOM_FONT_OPTIONS.map(function(opt) {
    var selected = opt.value === activeFont ? ' selected' : '';
    return '<option value="' + escapeHtml(opt.value) + '"' + selected + '>' + escapeHtml(opt.label) + '</option>';
  }).join('');



  document.getElementById('view-customize').innerHTML = '' +

    '<div class="customize-page">' +

      '<div class="ach-page-header">' +

        '<div>' +

          '<h2 class="ach-page-title">' + escapeHtml(tr('nav.customize')) + '</h2>' +

          '<p class="ach-page-subtitle">' + escapeHtml(tr('customization.subtitle')) + '</p>' +

        '</div>' +

        '<button class="btn secondary" id="customResetBtn">' + escapeHtml(tr('action.resetAll')) + '</button>' +

      '</div>' +

      '<div class="customize-grid">' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.background.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.background.desc')) + '</p>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.imageUrl')) + '</label>' +
          '<input id="customBgUrl" class="input customize-input" type="url" placeholder="https://..." value="' + bgu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewBg" style="' + prevBg + '"></div></div>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.darkness')) + ': <span id="customBgDimVal">' + bd + '</span>%</label>' +
          '<input id="customBgDim" class="customize-slider" type="range" min="0" max="95" value="' + bd + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.transparency')) + ': <span id="customBgOpacVal">' + bgo + '</span>%</label>' +
          '<input id="customBgOpac" class="customize-slider" type="range" min="0" max="95" value="' + bgo + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.leftColumn.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.leftColumn.desc')) + '</p>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.imageUrl')) + '</label>' +
          '<input id="customCharUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewChar" style="' + prevCh + '"></div></div>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.darkness')) + ': <span id="customCharDarkVal">' + chd + '</span>%</label>' +
          '<input id="customCharDark" class="customize-slider" type="range" min="0" max="95" value="' + chd + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.transparency')) + ': <span id="customCharDimVal">' + cd + '</span>%</label>' +
          '<input id="customCharDim" class="customize-slider" type="range" min="0" max="95" value="' + cd + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.header.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.header.desc')) + '</p>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.imageUrl')) + '</label>' +
          '<input id="customHeaderUrl" class="input customize-input" type="url" placeholder="https://..." value="' + hu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewHeader" style="' + prevHdr + '"></div></div>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.darkness')) + ': <span id="customHeaderDimVal">' + hd + '</span>%</label>' +
          '<input id="customHeaderDim" class="customize-slider" type="range" min="0" max="95" value="' + hd + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.transparency')) + ': <span id="customHeaderOpacVal">' + ho + '</span>%</label>' +
          '<input id="customHeaderOpac" class="customize-slider" type="range" min="0" max="95" value="' + ho + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.header.focusX')) + ': <span id="customHeaderPosXVal">' + hpx + '</span>%</label>' +
          '<input id="customHeaderPosX" class="customize-slider" type="range" min="0" max="100" value="' + hpx + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.header.focusY')) + ': <span id="customHeaderPosYVal">' + hpy + '</span>%</label>' +
          '<input id="customHeaderPosY" class="customize-slider" type="range" min="0" max="100" value="' + hpy + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.corner.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.corner.desc')) + '</p>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.imageUrl')) + '</label>' +
          '<input id="customCornerUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cou + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewCorner" style="' + prevCor + ';border-radius:8px"></div></div>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.darkness')) + ': <span id="customCornerDarkVal">' + cod2 + '</span>%</label>' +
          '<input id="customCornerDark" class="customize-slider" type="range" min="0" max="95" value="' + cod2 + '">' +
          '<label class="customize-label">' + escapeHtml(tr('customization.transparency')) + ': <span id="customCornerDimVal">' + cod + '</span>%</label>' +
          '<input id="customCornerDim" class="customize-slider" type="range" min="0" max="95" value="' + cod + '">' +
        '</div>' +

        '<div class="customize-card palette-card">' +
          '<div class="cp-card-header">' +
            '<h3 class="customize-card-title">' + escapeHtml(tr('customization.palette.title')) + '</h3>' +
          '</div>' +
          '<div class="cp-collapsible" id="cpCollapsible">' +
            '<p class="customize-card-desc">' + escapeHtml(tr('customization.palette.desc')) + '</p>' +
            '<canvas id="cpSB" class="cp-sb" width="260" height="130"></canvas>' +
            '<canvas id="cpHue" class="cp-hue" width="260" height="14"></canvas>' +
            '<div class="cp-swatches">' +
              '<div class="cp-swatch-group"><div id="cpSwPrimary" class="cp-swatch"></div><span class="customize-label">' + escapeHtml(tr('customization.primary')) + '</span></div>' +
              '<div class="cp-swatch-group"><div id="cpSwDark" class="cp-swatch"></div><span class="customize-label">' + escapeHtml(tr('customization.dark')) + '</span></div>' +
              '<div class="cp-swatch-group"><div id="cpSwLight" class="cp-swatch"></div><span class="customize-label">' + escapeHtml(tr('customization.light')) + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.4rem">' +
              '<label class="customize-label" style="flex:0 0 auto">' + escapeHtml(tr('customization.hex')) + '</label>' +
              '<input id="cpHexInput" class="input customize-input" type="text" placeholder="#913FE2" maxlength="7" value="' + escapeHtml(active.paletteColor||'') + '" style="flex:1">' +
              ('EyeDropper' in window ? '<button class="btn secondary cp-eyedropper" id="cpEyedropper" title="Pipeta" style="padding:0.4rem 0.6rem;font-size:1rem;line-height:1">&#x1F489;</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.font.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.font.desc')) + '</p>' +
          '<label class="customize-label">' + escapeHtml(tr('customization.font.familyLabel')) + '</label>' +
          '<select id="customFontFamily" class="input customize-input">' + fontOptionsHtml + '</select>' +
        '</div>' +

        '<div class="customize-card">' +
          '<h3 class="customize-card-title">' + escapeHtml(tr('customization.button.title')) + '</h3>' +
          '<p class="customize-card-desc">' + escapeHtml(tr('customization.button.desc')) + '</p>' +
          '<canvas id="btnCpSB" class="cp-sb" width="260" height="130"></canvas>' +
          '<canvas id="btnCpHue" class="cp-hue" width="260" height="14"></canvas>' +
          '<div class="cp-swatches" style="margin-top:0.5rem">' +
            '<div class="cp-swatch-group"><div id="btnCpSwatch" class="cp-swatch" style="background:' + escapeHtml(active.buttonColor || '#913fe2') + '"></div><span class="customize-label">' + escapeHtml(tr('customization.button.previewPrimary')) + '</span></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">' +
            '<label class="customize-label" style="flex:0 0 auto">' + escapeHtml(tr('customization.hex')) + '</label>' +
            '<input id="btnCpHexInput" class="input customize-input" type="text" placeholder="#913FE2" maxlength="7" value="' + escapeHtml(active.buttonColor || '') + '" style="flex:1">' +
            ('EyeDropper' in window ? '<button class="btn secondary cp-eyedropper" id="btnCpEyedropper" title="Pipeta" style="padding:0.4rem 0.6rem;font-size:1rem;line-height:1">&#x1F489;</button>' : '') +
            '<button class="btn secondary" id="customBtnColorClear" style="padding:0.4rem 0.75rem;font-size:0.8rem">' + escapeHtml(tr('action.reset')) + '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div class="customize-save-bar">' +

        '<input id="customPresetName" class="input" style="flex:1;min-width:160px" placeholder="' + escapeHtml(tr('customization.presetNamePlaceholder')) + '" maxlength="40">' +

        '<button class="btn primary" id="customSaveBtn">' + escapeHtml(tr('action.savePreset')) + '</button>' +

        '<button class="btn secondary" id="customEditPresetsBtn">' + escapeHtml(tr('action.editPresets')) + '</button>' +

        '<button class="btn secondary" id="customExportPresetsBtn">Export Presets</button>' +

        '<button class="btn secondary" id="customImportPresetsBtn">Import Presets</button>' +

        '<input id="customImportPresetsInput" type="file" accept="application/json" style="display:none">' +

      '</div>' +

      '<div class="customize-presets-section">' +

        '<h3 class="section-title">' + escapeHtml(tr('customization.savedPresets')) + '</h3>' +

        '<div id="customPresetsList">' + presetsHtml + '</div>' +

      '</div>' +

    '</div>';



  function livePreview() {
    var bgUrl      = document.getElementById('customBgUrl').value.trim();
    var bgDim      = +document.getElementById('customBgDim').value;
    var bgOpac     = +document.getElementById('customBgOpac').value;
    var charUrl    = document.getElementById('customCharUrl').value.trim();
    var charDark   = +document.getElementById('customCharDark').value;
    var charDim    = +document.getElementById('customCharDim').value;
    var headerUrl  = document.getElementById('customHeaderUrl').value.trim();
    var headerDim  = +document.getElementById('customHeaderDim').value;
    var headerOpac = +document.getElementById('customHeaderOpac').value;
    var headerPosX = _sanitizeCustomPercent(document.getElementById('customHeaderPosX').value, 50);
    var headerPosY = _sanitizeCustomPercent(document.getElementById('customHeaderPosY').value, 50);
    var cornerUrl  = document.getElementById('customCornerUrl').value.trim();
    var cornerDark = +document.getElementById('customCornerDark').value;
    var cornerDim  = +document.getElementById('customCornerDim').value;
    var paletteColor = (document.getElementById('cpHexInput') ? document.getElementById('cpHexInput').value.trim() : '') || '';
    var fontFamily = _sanitizeCustomFontFamily(document.getElementById('customFontFamily').value);
    var btnHexEl   = document.getElementById('btnCpHexInput');
    var buttonColor = (btnHexEl ? btnHexEl.value.trim() : '') || '';

    document.getElementById('customBgDimVal').textContent      = bgDim;
    document.getElementById('customBgOpacVal').textContent     = bgOpac;
    document.getElementById('customCharDarkVal').textContent   = charDark;
    document.getElementById('customCharDimVal').textContent    = charDim;
    document.getElementById('customHeaderDimVal').textContent  = headerDim;
    document.getElementById('customHeaderOpacVal').textContent = headerOpac;
    document.getElementById('customHeaderPosXVal').textContent = headerPosX;
    document.getElementById('customHeaderPosYVal').textContent = headerPosY;
    document.getElementById('customCornerDarkVal').textContent = cornerDark;
    document.getElementById('customCornerDimVal').textContent  = cornerDim;

    var p = function(n) { return document.getElementById(n); };
    p('previewBg').style.background     = bgUrl ? "linear-gradient(rgba(0,0,0," + (bgDim/100) + "),rgba(0,0,0," + (bgDim/100) + ")),url('" + bgUrl + "') center/cover" : '';

    // Left Column — apply darkness (brightness filter) and transparency (opacity)
    var charPrev = p('previewChar');
    charPrev.style.background = charUrl ? "url('" + charUrl + "') center top/contain no-repeat" : '';
    charPrev.style.opacity    = charUrl ? String((100 - charDim)  / 100) : '';
    charPrev.style.filter     = charUrl ? 'brightness(' + (1 - charDark / 100) + ')' : '';

    p('previewHeader').style.background = headerUrl ? "linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")),url('" + headerUrl + "') " + headerPosX + "% " + headerPosY + "%/cover no-repeat" : '';

    // Corner Card — apply darkness (brightness filter) and transparency (opacity)
    var cornerPrev = p('previewCorner');
    cornerPrev.style.background = cornerUrl ? "url('" + cornerUrl + "') center/cover no-repeat" : '';
    cornerPrev.style.opacity    = cornerUrl ? String((100 - cornerDim)  / 100) : '';
    cornerPrev.style.filter     = cornerUrl ? 'brightness(' + (1 - cornerDark / 100) + ')' : '';

    var cfg = { bgUrl: bgUrl, bgDim: bgDim, bgOpac: bgOpac, charUrl: charUrl, charDark: charDark, charDim: charDim, headerUrl: headerUrl, headerDim: headerDim, headerOpac: headerOpac, headerPosX: headerPosX, headerPosY: headerPosY, cornerUrl: cornerUrl, cornerDark: cornerDark, cornerDim: cornerDim, paletteColor: paletteColor, fontFamily: fontFamily, buttonColor: buttonColor };

    // Auto-apply every change from customization controls.
    setActiveCustom(cfg);
    applyCustomization(cfg);

    return cfg;
  }

  // Register live-preview callback so initColorPicker can trigger it
  _cpLivePreviewCb = livePreview;
  _editingPresetId = null;



  ['customBgUrl','customBgDim','customBgOpac','customCharUrl','customCharDark','customCharDim','customHeaderUrl','customHeaderDim','customHeaderOpac','customHeaderPosX','customHeaderPosY','customCornerUrl','customCornerDark','customCornerDim','customFontFamily','btnCpHexInput'].forEach(function(id) {

    var el = document.getElementById(id);

    if (el) {
      var evtName = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evtName, livePreview);
    }

  });

  // Button colour clear button
  var btnClear = document.getElementById('customBtnColorClear');
  if (btnClear) {
    btnClear.addEventListener('click', function() {
      var hexEl = document.getElementById('btnCpHexInput');
      if (hexEl) { hexEl.value = ''; }
      var swatch = document.getElementById('btnCpSwatch');
      if (swatch) swatch.style.background = 'transparent';
      livePreview();
    });
  }

  initColorPicker();
  initBtnColorPicker();

  // Eyedropper buttons (only present if browser supports EyeDropper API)
  function _attachEyedropper(btnId, hexInputId) {
    var btn = document.getElementById(btnId);
    if (!btn || !('EyeDropper' in window)) return;
    btn.addEventListener('click', function() {
      new window.EyeDropper().open().then(function(result) {
        var hexEl = document.getElementById(hexInputId);
        if (hexEl) {
          hexEl.value = result.sRGBHex;
          hexEl.dispatchEvent(new Event('input'));
        }
      }).catch(function() {}); // user cancelled
    });
  }
  _attachEyedropper('cpEyedropper',    'cpHexInput');
  _attachEyedropper('btnCpEyedropper', 'btnCpHexInput');



  document.getElementById('customSaveBtn').onclick = function() {

    var cfg = livePreview();

    var name = document.getElementById('customPresetName').value.trim() || t('customization.defaultPresetName');

    var list = getCustomPresets();

    if (_editingPresetId) {
      // Update existing preset in-place
      list = list.map(function(item) {
        return item.id === _editingPresetId ? Object.assign({}, item, cfg, { name: name }) : item;
      });
      _editingPresetId = null;
    } else {
      list.push(Object.assign({ id: 'custom-' + Date.now(), name: name }, cfg));
    }

    saveCustomPresets(list);

    showToast(t('customization.toastPresetSaved'), name, 'success');

    renderCustomizeView();

  };

  document.getElementById('customEditPresetsBtn').onclick = function() {
    var section = document.querySelector('.customize-presets-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  var exportBtn = document.getElementById('customExportPresetsBtn');
  if (exportBtn) {
    exportBtn.onclick = function() {
      var presets = getCustomPresets();
      var payload = {
        app: 'ScrollScape',
        version: 1,
        exportedAt: new Date().toISOString(),
        presets: presets,
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'scrollscape-theme-presets.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Presets exported', presets.length + ' preset(s)', 'success');
    };
  }

  var importBtn = document.getElementById('customImportPresetsBtn');
  var importInput = document.getElementById('customImportPresetsInput');
  if (importBtn && importInput) {
    importBtn.onclick = function() { importInput.click(); };
    importInput.onchange = function() {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var parsed = JSON.parse(String(reader.result || '{}'));
          var incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.presets) ? parsed.presets : []);
          if (!incoming.length) throw new Error('No presets found');

          var current = getCustomPresets();
          var byId = {};
          current.forEach(function(p) { if (p && p.id) byId[p.id] = p; });
          incoming.forEach(function(p) { if (p && p.id) byId[p.id] = p; });

          var merged = Object.values(byId).slice(0, 200);
          saveCustomPresets(merged);
          renderCustomizeView();
          if (typeof renderThemesView === 'function') {
            var themesView = document.getElementById('view-themes');
            if (themesView && !themesView.classList.contains('hidden')) renderThemesView();
          }
          showToast('Presets imported', incoming.length + ' preset(s)', 'success');
        } catch (e) {
          showToast('Import failed', e && e.message ? e.message : 'Invalid preset file', 'warning');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file, 'utf-8');
    };
  }

  document.getElementById('customResetBtn').onclick = function() {

    setActiveCustom(null);

    applyCustomization(null);

    showToast(t('customization.toastReset'), '', 'info');

    renderCustomizeView();

  };

}



// ── Canvas colour picker ─────────────────────────────────────────────────────
// Generic canvas picker. Pass {sbId, hueId, hexId, defaultHex, onCommit}.
function _initCanvasPicker(opts) {
  var sbCv  = document.getElementById(opts.sbId);
  var hueCv = document.getElementById(opts.hueId);
  var hexIn = document.getElementById(opts.hexId);
  if (!sbCv || !hueCv || !hexIn) return;

  var W = sbCv.parentElement.clientWidth - 2;
  if (W > 40) { sbCv.width = W; hueCv.width = W; }

  var sbCtx  = sbCv.getContext('2d');
  var hueCtx = hueCv.getContext('2d');
  var def    = opts.defaultHex || '#913fe2';
  var saved  = hexIn.value.trim();
  var initHsv = _hexToHsv(/^#[0-9a-f]{6}$/i.test(saved) ? saved : def);
  var S = { h: initHsv.h, s: initHsv.s, v: initHsv.v };

  function drawHue() {
    var g = hueCtx.createLinearGradient(0,0,hueCv.width,0);
    for (var i=0;i<=1;i+=1/36) g.addColorStop(i,'hsl('+(i*360)+',100%,50%)');
    hueCtx.fillStyle = g;
    hueCtx.fillRect(0,0,hueCv.width,hueCv.height);
    var tx = Math.max(7, Math.min(hueCv.width-7, (S.h/360)*hueCv.width));
    hueCtx.beginPath();
    hueCtx.arc(tx, hueCv.height/2, Math.max(5, hueCv.height/2-1), 0, Math.PI*2);
    hueCtx.strokeStyle='#fff'; hueCtx.lineWidth=2; hueCtx.stroke();
  }

  function drawSB() {
    var gH = sbCtx.createLinearGradient(0,0,sbCv.width,0);
    gH.addColorStop(0,'#fff');
    gH.addColorStop(1,'hsl('+S.h+',100%,50%)');
    sbCtx.fillStyle = gH; sbCtx.fillRect(0,0,sbCv.width,sbCv.height);
    var gV = sbCtx.createLinearGradient(0,0,0,sbCv.height);
    gV.addColorStop(0,'rgba(0,0,0,0)');
    gV.addColorStop(1,'rgba(0,0,0,1)');
    sbCtx.fillStyle = gV; sbCtx.fillRect(0,0,sbCv.width,sbCv.height);
    var cx = S.s * sbCv.width;
    var cy = (1-S.v) * sbCv.height;
    sbCtx.beginPath();
    sbCtx.arc(cx, cy, 7, 0, Math.PI*2);
    sbCtx.strokeStyle='#fff'; sbCtx.lineWidth=2; sbCtx.stroke();
  }

  function commit() {
    var hex = _hsvToHex(S.h, S.s, S.v);
    hexIn.value = hex;
    if (opts.onCommit) opts.onCommit(hex);
  }

  function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x));}

  var hDrag=false;
  function onHue(e){
    e.preventDefault();
    var rect=hueCv.getBoundingClientRect();
    var cx=e.touches?e.touches[0].clientX:e.clientX;
    S.h = clamp((cx-rect.left)/rect.width,0,1)*360;
    drawHue(); drawSB(); commit();
  }
  hueCv.addEventListener('mousedown',function(e){hDrag=true;onHue(e);});
  document.addEventListener('mousemove',function(e){if(hDrag)onHue(e);});
  document.addEventListener('mouseup',function(){hDrag=false;});
  hueCv.addEventListener('touchstart',onHue,{passive:false});
  hueCv.addEventListener('touchmove',onHue,{passive:false});

  var sbDrag=false;
  function onSB(e){
    e.preventDefault();
    var rect=sbCv.getBoundingClientRect();
    var cx=e.touches?e.touches[0].clientX:e.clientX;
    var cy=e.touches?e.touches[0].clientY:e.clientY;
    S.s = clamp((cx-rect.left)/rect.width,0,1);
    S.v = clamp(1-(cy-rect.top)/rect.height,0,1);
    drawSB(); commit();
  }
  sbCv.addEventListener('mousedown',function(e){sbDrag=true;onSB(e);});
  document.addEventListener('mousemove',function(e){if(sbDrag)onSB(e);});
  document.addEventListener('mouseup',function(){sbDrag=false;});
  sbCv.addEventListener('touchstart',onSB,{passive:false});
  sbCv.addEventListener('touchmove',onSB,{passive:false});

  hexIn.addEventListener('input',function(){
    var v=hexIn.value.trim();
    if(/^#[0-9a-f]{6}$/i.test(v)){
      var c=_hexToHsv(v); S.h=c.h; S.s=c.s; S.v=c.v;
      drawHue(); drawSB(); commit();
    }
  });

  drawHue(); drawSB(); commit();
}

function initColorPicker() {
  _initCanvasPicker({
    sbId:  'cpSB',
    hueId: 'cpHue',
    hexId: 'cpHexInput',
    defaultHex: '#913fe2',
    onCommit: function(hex) {
      var pal = _derivePalette(hex);
      var ps=document.getElementById('cpSwPrimary'), pd=document.getElementById('cpSwDark'), pl=document.getElementById('cpSwLight');
      if(ps) ps.style.background=pal.primary;
      if(pd) pd.style.background=pal.dark;
      if(pl) pl.style.background=pal.light;
      document.documentElement.style.setProperty('--primary',       pal.primary);
      document.documentElement.style.setProperty('--primary-dark',  pal.dark);
      document.documentElement.style.setProperty('--primary-light', pal.light);
      var _cur = getActiveCustom() || {};
      _cur.paletteColor = hex;
      setActiveCustom(_cur);
      if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();
    }
  });
}

function initBtnColorPicker() {
  _initCanvasPicker({
    sbId:  'btnCpSB',
    hueId: 'btnCpHue',
    hexId: 'btnCpHexInput',
    defaultHex: '#913fe2',
    onCommit: function(hex) {
      var swatch = document.getElementById('btnCpSwatch');
      if (swatch) swatch.style.background = hex;
      var _cur = getActiveCustom() || {};
      _cur.buttonColor = hex;
      setActiveCustom(_cur);
      if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();
    }
  });
}

function applyCustomPreset(id) {

  var p = getCustomPresets().find(function(x) { return x.id === id; });

  if (!p) return;

  // Clean up any community theme's injected images (char, banner) without
  // changing CSS vars or localStorage — so the shop still shows the correct
  // base theme and its colour palette stays active unless overridden by preset.
  var _prevThemeId = document.documentElement.getAttribute('data-color-theme') || '';
  if (_prevThemeId) {
    var _prevTheme = (window.COMMUNITY_THEMES || []).find(function(t) { return t.id === _prevThemeId; });
    if (_prevTheme && _prevTheme.onRemove) _prevTheme.onRemove();
  }

  setActiveCustom(p);

  applyCustomization(p);

  showToast(t('customization.toastPresetApplied'), p.name, 'success');

}

window.applyCustomPreset = applyCustomPreset;



function deleteCustomPreset(id) {

  saveCustomPresets(getCustomPresets().filter(function(x) { return x.id !== id; }));

  renderCustomizeView();

}

function editCustomPreset(id) {

  var preset = getCustomPresets().find(function(x) { return x.id === id; });

  if (!preset) return;

  setActiveCustom(preset);
  renderCustomizeView();
  _editingPresetId = id;

  var nameInput = document.getElementById('customPresetName');
  if (nameInput) nameInput.value = preset.name || '';

  var saveBtn = document.getElementById('customSaveBtn');
  if (saveBtn) saveBtn.textContent = t('customization.updatePreset');

  var editPresetsBtn = document.getElementById('customEditPresetsBtn');
  if (editPresetsBtn) editPresetsBtn.style.display = 'none';

  document.getElementById('view-customize').scrollIntoView({ behavior: 'smooth' });

  showToast(t('customization.toastLoadedEditing'), preset.name, 'info');

}

window.editCustomPreset = editCustomPreset;

window.deleteCustomPreset = deleteCustomPreset;

// Load presets from disk folder on startup and keep localStorage mirrored.
syncCustomPresetsFromDisk();


