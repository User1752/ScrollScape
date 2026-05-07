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

  if (closeReader) closeReader.onclick = () => hideReader();

  if (prevPage) prevPage.onclick = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("backward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("backward"); return; }
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      state.currentPageIndex--;
      renderPage();
    }
  };

  if (nextPage) nextPage.onclick = () => {
    if (state.settings.readingMode === "rtl") { navigateBook("forward"); return; }
    if (state.settings.readingMode === "ltr") { navigateLTR("forward"); return; }
    if (state.currentPageIndex === (state.currentChapter?.pages?.length ?? 1) - 1) {
      goToNextChapter();
    } else {
      state.currentPageIndex++;
      renderPage();
    }
  };

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

// Shared callback so initColorPicker can trigger livePreview
var _cpLivePreviewCb = null;
// Tracks whether we are currently editing an existing preset
var _editingPresetId = null;



function getCustomPresets() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]'); } catch (e) { return []; }

}

function saveCustomPresets(arr) {

  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(arr));

}

function getActiveCustom() {

  try { return JSON.parse(localStorage.getItem(CUSTOM_ACTIVE_KEY) || 'null'); } catch (e) { return null; }

}

function setActiveCustom(cfg) {

  if (cfg) localStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(cfg));

  else     localStorage.removeItem(CUSTOM_ACTIVE_KEY);

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

function applyCustomization(cfg) {

  ['custom-char', 'custom-corner', 'custom-bg-layer'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { if (el._obs) el._obs.disconnect(); el.remove(); }
  });

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
  var charUrl    = cfg.charUrl    || '';
  var charDim    = cfg.charDim    != null ? cfg.charDim    : 0;
  var charDark   = cfg.charDark   != null ? cfg.charDark   : 0;
  var cornerUrl  = cfg.cornerUrl  || '';
  var cornerDim  = cfg.cornerDim  != null ? cfg.cornerDim  : 0;
  var cornerDark = cfg.cornerDark != null ? cfg.cornerDark : 0;

  var css = '';
  if (headerUrl) css += ".topbar { background: linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")), url('" + headerUrl + "') center/cover !important; opacity:" + ((100-headerOpac)/100) + " !important; }\n";
  styleEl.textContent = css;

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
  palStyleEl.textContent = '';

}



function renderCustomizeView() {

  var presets = getCustomPresets();

  var active  = getActiveCustom() || {};



  var presetsHtml = presets.length

    ? presets.map(function(p) {

        return '<div class="custom-preset-card" id="preset-card-' + p.id + '">' +

          '<div class="custom-preset-info"><span class="custom-preset-name">' + escapeHtml(p.name) + '</span></div>' +

          '<div class="custom-preset-actions">' +

            '<button class="btn secondary" onclick="applyCustomPreset(\'' + p.id + '\')">Apply</button>' +

            '<button class="btn secondary" onclick="editCustomPreset(\'' + p.id + '\')">&#9998; Edit</button>' +

            '<button class="btn danger" onclick="deleteCustomPreset(\'' + p.id + '\')">Remove</button>' +

          '</div></div>';

      }).join('')

    : '<p class="muted" style="text-align:center;padding:1rem">No saved presets yet</p>';



  var bgu = escapeHtml(active.bgUrl     || '');

  var bd  = active.bgDim     || 0;

  var cu  = escapeHtml(active.charUrl   || '');

  var cd  = active.charDim   || 0;

  var hu  = escapeHtml(active.headerUrl || '');

  var hd  = active.headerDim || 0;

  var cou = escapeHtml(active.cornerUrl || '');

  var cod = active.cornerDim || 0;

  var bgo  = active.bgOpac     || 0;

  var chd  = active.charDark   || 0;

  var ho   = active.headerOpac || 0;

  var cod2 = active.cornerDark || 0;



  var prevBg  = bgu ? "background:linear-gradient(rgba(0,0,0," + (bd/100) + "),rgba(0,0,0," + (bd/100) + ")),url('" + bgu + "') center/cover"  : '';

  var prevCh  = cu  ? "background:url('" + cu + "') center top/contain no-repeat" : '';

  var prevHdr = hu  ? "background:linear-gradient(rgba(0,0,0," + (hd/100) + "),rgba(0,0,0," + (hd/100) + ")),url('" + hu + "') center/cover" : '';

  var prevCor = cou ? "background:url('" + cou + "') center/cover no-repeat" : '';



  document.getElementById('view-customize').innerHTML = '' +

    '<div class="customize-page">' +

      '<div class="ach-page-header">' +

        '<div>' +

          '<h2 class="ach-page-title">&#127912; Customization</h2>' +

          '<p class="ach-page-subtitle">Personalise your interface with custom images</p>' +

        '</div>' +

        '<button class="btn secondary" id="customResetBtn">&#10006; Reset All</button>' +

      '</div>' +

      '<div class="customize-grid">' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#128444;</div>' +
          '<h3 class="customize-card-title">Background</h3>' +
          '<p class="customize-card-desc">Full-page wallpaper</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customBgUrl" class="input customize-input" type="url" placeholder="https://..." value="' + bgu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewBg" style="' + prevBg + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customBgDimVal">' + bd + '</span>%</label>' +
          '<input id="customBgDim" class="customize-slider" type="range" min="0" max="95" value="' + bd + '">' +
          '<label class="customize-label">Transparency: <span id="customBgOpacVal">' + bgo + '</span>%</label>' +
          '<input id="customBgOpac" class="customize-slider" type="range" min="0" max="95" value="' + bgo + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9612;</div>' +
          '<h3 class="customize-card-title">Left Column</h3>' +
          '<p class="customize-card-desc">Character art along the left sidebar</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customCharUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewChar" style="' + prevCh + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customCharDarkVal">' + chd + '</span>%</label>' +
          '<input id="customCharDark" class="customize-slider" type="range" min="0" max="95" value="' + chd + '">' +
          '<label class="customize-label">Transparency: <span id="customCharDimVal">' + cd + '</span>%</label>' +
          '<input id="customCharDim" class="customize-slider" type="range" min="0" max="95" value="' + cd + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9644;</div>' +
          '<h3 class="customize-card-title">Header</h3>' +
          '<p class="customize-card-desc">Image in the top bar</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customHeaderUrl" class="input customize-input" type="url" placeholder="https://..." value="' + hu + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewHeader" style="' + prevHdr + '"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customHeaderDimVal">' + hd + '</span>%</label>' +
          '<input id="customHeaderDim" class="customize-slider" type="range" min="0" max="95" value="' + hd + '">' +
          '<label class="customize-label">Transparency: <span id="customHeaderOpacVal">' + ho + '</span>%</label>' +
          '<input id="customHeaderOpac" class="customize-slider" type="range" min="0" max="95" value="' + ho + '">' +
        '</div>' +

        '<div class="customize-card">' +
          '<div class="customize-card-icon">&#9724;</div>' +
          '<h3 class="customize-card-title">Corner Card</h3>' +
          '<p class="customize-card-desc">Small card at bottom-left corner</p>' +
          '<label class="customize-label">Image URL</label>' +
          '<input id="customCornerUrl" class="input customize-input" type="url" placeholder="https://..." value="' + cou + '">' +
          '<div class="customize-preview-wrap"><div class="customize-preview" id="previewCorner" style="' + prevCor + ';border-radius:8px"></div></div>' +
          '<label class="customize-label">Darkness: <span id="customCornerDarkVal">' + cod2 + '</span>%</label>' +
          '<input id="customCornerDark" class="customize-slider" type="range" min="0" max="95" value="' + cod2 + '">' +
          '<label class="customize-label">Transparency: <span id="customCornerDimVal">' + cod + '</span>%</label>' +
          '<input id="customCornerDim" class="customize-slider" type="range" min="0" max="95" value="' + cod + '">' +
        '</div>' +

        '<div class="customize-card palette-card">' +
          '<div class="cp-card-header">' +
            '<div class="customize-card-icon">&#127912;</div>' +
            '<h3 class="customize-card-title">Colour Palette</h3>' +
            '<button class="btn cp-toggle-btn" id="cpToggleBtn" title="Toggle colour picker">&#9650;</button>' +
          '</div>' +
          '<div class="cp-collapsible" id="cpCollapsible">' +
            '<p class="customize-card-desc">Accent colours used across the interface</p>' +
            '<canvas id="cpSB" class="cp-sb" width="260" height="130"></canvas>' +
            '<canvas id="cpHue" class="cp-hue" width="260" height="14"></canvas>' +
            '<div class="cp-swatches">' +
              '<div class="cp-swatch-group"><div id="cpSwPrimary" class="cp-swatch"></div><span class="customize-label">Primary</span></div>' +
              '<div class="cp-swatch-group"><div id="cpSwDark" class="cp-swatch"></div><span class="customize-label">Dark</span></div>' +
              '<div class="cp-swatch-group"><div id="cpSwLight" class="cp-swatch"></div><span class="customize-label">Light</span></div>' +
            '</div>' +
            '<label class="customize-label">Hex</label>' +
            '<input id="cpHexInput" class="input customize-input" type="text" placeholder="#913FE2" maxlength="7" value="' + escapeHtml(active.paletteColor||'') + '">' +
          '</div>' +
        '</div>' +

        '<div class="customize-card icp-card">' +
          '<div class="customize-card-icon">&#128065;</div>' +
          '<h3 class="customize-card-title">Image Colour Sampler</h3>' +
          '<p class="customize-card-desc">Load an image, hover to preview, click to pick a colour into the palette</p>' +
          '<div class="icp-load-row">' +
            '<input id="icpUrlInput" class="input customize-input" type="url" placeholder="Paste image URL and press Enter...">' +
            '<button class="btn secondary icp-load-btn" id="icpLoadBtn">Load</button>' +
          '</div>' +
          '<label class="customize-label">or upload a file</label>' +
          '<input id="icpFileInput" type="file" accept="image/*" class="icp-file-input">' +
          '<div class="icp-canvas-wrap" id="icpCanvasWrap">' +
            '<canvas id="icpCanvas"></canvas>' +
            '<div class="icp-placeholder" id="icpPlaceholder">&#128444; No image loaded</div>' +
            '<div class="icp-mag-wrap" id="icpMagWrap">' +
              '<canvas id="icpMagnifier"></canvas>' +
              '<span class="icp-mag-hex" id="icpMagHex"></span>' +
            '</div>' +
          '</div>' +
          '<div class="icp-recent-row">' +
            '<span class="customize-label">Recent picks</span>' +
            '<div class="icp-recent" id="icpRecent"></div>' +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div class="customize-save-bar">' +

        '<input id="customPresetName" class="input" style="flex:1;min-width:160px" placeholder="Preset name..." maxlength="40">' +

        '<button class="btn primary" id="customSaveBtn">&#128190; Save Preset</button>' +

        '<button class="btn secondary" id="customApplyBtn">&#9654; Apply Now</button>' +

        '<button class="btn secondary" id="customEditPresetsBtn">&#9998; Edit Presets</button>' +

      '</div>' +

      '<div class="customize-presets-section">' +

        '<h3 class="section-title">Saved Presets</h3>' +

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
    var cornerUrl  = document.getElementById('customCornerUrl').value.trim();
    var cornerDark = +document.getElementById('customCornerDark').value;
    var cornerDim  = +document.getElementById('customCornerDim').value;
    var paletteColor = (document.getElementById('cpHexInput') ? document.getElementById('cpHexInput').value.trim() : '') || '';

    document.getElementById('customBgDimVal').textContent      = bgDim;
    document.getElementById('customBgOpacVal').textContent     = bgOpac;
    document.getElementById('customCharDarkVal').textContent   = charDark;
    document.getElementById('customCharDimVal').textContent    = charDim;
    document.getElementById('customHeaderDimVal').textContent  = headerDim;
    document.getElementById('customHeaderOpacVal').textContent = headerOpac;
    document.getElementById('customCornerDarkVal').textContent = cornerDark;
    document.getElementById('customCornerDimVal').textContent  = cornerDim;

    var p = function(n) { return document.getElementById(n); };
    p('previewBg').style.background     = bgUrl     ? "linear-gradient(rgba(0,0,0," + (bgDim/100) + "),rgba(0,0,0," + (bgDim/100) + ")),url('" + bgUrl + "') center/cover" : '';

    // Left Column — apply darkness (brightness filter) and transparency (opacity)
    var charPrev = p('previewChar');
    charPrev.style.background = charUrl ? "url('" + charUrl + "') center top/contain no-repeat" : '';
    charPrev.style.opacity    = charUrl ? String((100 - charDim)  / 100) : '';
    charPrev.style.filter     = charUrl ? 'brightness(' + (1 - charDark / 100) + ')' : '';

    p('previewHeader').style.background = headerUrl ? "linear-gradient(rgba(0,0,0," + (headerDim/100) + "),rgba(0,0,0," + (headerDim/100) + ")),url('" + headerUrl + "') center/cover" : '';

    // Corner Card — apply darkness (brightness filter) and transparency (opacity)
    var cornerPrev = p('previewCorner');
    cornerPrev.style.background = cornerUrl ? "url('" + cornerUrl + "') center/cover no-repeat" : '';
    cornerPrev.style.opacity    = cornerUrl ? String((100 - cornerDim)  / 100) : '';
    cornerPrev.style.filter     = cornerUrl ? 'brightness(' + (1 - cornerDark / 100) + ')' : '';

    return { bgUrl: bgUrl, bgDim: bgDim, bgOpac: bgOpac, charUrl: charUrl, charDark: charDark, charDim: charDim, headerUrl: headerUrl, headerDim: headerDim, headerOpac: headerOpac, cornerUrl: cornerUrl, cornerDark: cornerDark, cornerDim: cornerDim, paletteColor: paletteColor };
  }

  // Register live-preview callback so initColorPicker can trigger it
  _cpLivePreviewCb = livePreview;
  _editingPresetId = null;



  ['customBgUrl','customBgDim','customBgOpac','customCharUrl','customCharDark','customCharDim','customHeaderUrl','customHeaderDim','customHeaderOpac','customCornerUrl','customCornerDark','customCornerDim'].forEach(function(id) {

    var el = document.getElementById(id);

    if (el) el.addEventListener('input', livePreview);

  });

  initColorPicker();
  initImageColorSampler();

  document.getElementById('customApplyBtn').onclick = function() {

    var cfg = livePreview();

    setActiveCustom(cfg);

    applyCustomization(cfg);

    showToast('Customization applied', '', 'success');

  };



  document.getElementById('customSaveBtn').onclick = function() {

    var cfg = livePreview();

    var name = document.getElementById('customPresetName').value.trim() || 'My Preset';

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

    setActiveCustom(cfg);

    applyCustomization(cfg);

    showToast('Preset saved!', name, 'success');

    renderCustomizeView();

  };

  document.getElementById('customEditPresetsBtn').onclick = function() {
    var section = document.querySelector('.customize-presets-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };



  document.getElementById('customResetBtn').onclick = function() {

    setActiveCustom(null);

    applyCustomization(null);

    showToast('Customization reset', '', 'info');

    renderCustomizeView();

  };

}



// ── Canvas colour picker ─────────────────────────────────────────────────────
function initColorPicker() {
  var sbCv  = document.getElementById('cpSB');
  var hueCv = document.getElementById('cpHue');
  var hexIn = document.getElementById('cpHexInput');
  if (!sbCv || !hueCv || !hexIn) return;

  // Fit canvases to actual rendered width
  var W = sbCv.parentElement.clientWidth - 2;
  if (W > 40) { sbCv.width = W; hueCv.width = W; }

  var sbCtx  = sbCv.getContext('2d');
  var hueCtx = hueCv.getContext('2d');
  var S = { h: 270, s: 0.68, v: 0.88 }; // default purple

  // Load saved colour
  var saved = hexIn.value.trim();
  if (/^#[0-9a-f]{6}$/i.test(saved)) {
    var hsv = _hexToHsv(saved);
    S.h = hsv.h; S.s = hsv.s; S.v = hsv.v;
  }

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
    var pal = _derivePalette(hex);
    var ps=document.getElementById('cpSwPrimary'), pd=document.getElementById('cpSwDark'), pl=document.getElementById('cpSwLight');
    if(ps) ps.style.background=pal.primary;
    if(pd) pd.style.background=pal.dark;
    if(pl) pl.style.background=pal.light;
    // Apply inline CSS vars directly on <html> — overrides any stylesheet/theme.
    document.documentElement.style.setProperty('--primary',       pal.primary);
    document.documentElement.style.setProperty('--primary-dark',  pal.dark);
    document.documentElement.style.setProperty('--primary-light', pal.light);
    // Persist palette colour into the active customisation immediately so
    // a page reload restores the chosen colour even without clicking Apply.
    var _cur = getActiveCustom() || {};
    _cur.paletteColor = hex;
    setActiveCustom(_cur);
    // Sync the rest of the live preview (sliders, other cards)
    if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();
  }

  function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x));}

  // Hue slider
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

  // SB square
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

  // Hex input
  hexIn.addEventListener('input',function(){
    var v=hexIn.value.trim();
    if(/^#[0-9a-f]{6}$/i.test(v)){
      var c=_hexToHsv(v); S.h=c.h; S.s=c.s; S.v=c.v;
      drawHue(); drawSB(); commit();
    }
  });

  drawHue(); drawSB(); commit();

  // Toggle button
  var toggleBtn  = document.getElementById('cpToggleBtn');
  var collapsible = document.getElementById('cpCollapsible');
  if (toggleBtn && collapsible) {
    toggleBtn.addEventListener('click', function() {
      var collapsed = collapsible.classList.toggle('cp-collapsed');
      toggleBtn.innerHTML = collapsed ? '&#9660;' : '&#9650;';
    });
  }
}

// ── Image Colour Sampler ─────────────────────────────────────────────────────
function initImageColorSampler() {
  var canvas     = document.getElementById('icpCanvas');
  var magCanvas  = document.getElementById('icpMagnifier');
  var magWrap    = document.getElementById('icpMagWrap');
  var magHex     = document.getElementById('icpMagHex');
  var placeholder = document.getElementById('icpPlaceholder');
  var urlInput   = document.getElementById('icpUrlInput');
  var loadBtn    = document.getElementById('icpLoadBtn');
  var fileInput  = document.getElementById('icpFileInput');
  var recentRow  = document.getElementById('icpRecent');
  if (!canvas || !magCanvas) return;

  var ctx    = canvas.getContext('2d');
  var magCtx = magCanvas.getContext('2d');
  var imgLoaded = false;
  var recentColors = [];
  var MAG_SIZE  = 88;   // magnifier canvas px
  var MAG_ZOOM  = 9;    // pixels zoomed per canvas pixel
  var MAG_HALF  = Math.floor(MAG_SIZE / MAG_ZOOM / 2);
  magCanvas.width  = MAG_SIZE;
  magCanvas.height = MAG_SIZE;

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function(v) {
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  function loadSrc(src) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      imgLoaded = true;
      var wrap   = document.getElementById('icpCanvasWrap');
      var maxW   = (wrap ? wrap.clientWidth : 400) - 4;
      var maxH   = 340;
      var ratio  = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      canvas.width  = Math.round(img.naturalWidth  * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.style.display  = 'block';
      canvas.style.cursor   = 'crosshair';
      if (placeholder) placeholder.style.display = 'none';
    };
    img.onerror = function() {
      showToast('Sampler', 'Could not load image (check URL / CORS)', 'warning');
    };
    img.src = src;
  }

  function drawMagnifier(x, y) {
    if (!imgLoaded || !magWrap) return;
    var sx = Math.max(0, Math.min(canvas.width  - 1, x - MAG_HALF));
    var sy = Math.max(0, Math.min(canvas.height - 1, y - MAG_HALF));
    var sw = Math.min(MAG_HALF * 2 + 1, canvas.width  - sx);
    var sh = Math.min(MAG_HALF * 2 + 1, canvas.height - sy);
    magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
    magCtx.imageSmoothingEnabled = false;
    magCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, MAG_SIZE, MAG_SIZE);
    // Crosshair
    var cx = MAG_SIZE / 2;
    magCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    magCtx.lineWidth = 1.5;
    magCtx.beginPath(); magCtx.moveTo(cx - 8, cx); magCtx.lineTo(cx + 8, cx); magCtx.stroke();
    magCtx.beginPath(); magCtx.moveTo(cx, cx - 8); magCtx.lineTo(cx, cx + 8); magCtx.stroke();
    // Border ring with current color
    var px = ctx.getImageData(Math.min(x, canvas.width - 1), Math.min(y, canvas.height - 1), 1, 1).data;
    var hex = rgbToHex(px[0], px[1], px[2]);
    magCtx.strokeStyle = hex;
    magCtx.lineWidth = 4;
    magCtx.beginPath();
    magCtx.arc(MAG_SIZE/2, MAG_SIZE/2, MAG_SIZE/2 - 2, 0, Math.PI * 2);
    magCtx.stroke();
    if (magHex) magHex.textContent = hex;
    magWrap.style.display = 'flex';
    return hex;
  }

  function pushRecent(hex) {
    recentColors = recentColors.filter(function(c) { return c !== hex; });
    recentColors.unshift(hex);
    if (recentColors.length > 12) recentColors.length = 12;
    if (!recentRow) return;
    recentRow.innerHTML = recentColors.map(function(c) {
      return '<div class="icp-recent-swatch" title="' + c + '" style="background:' + c + '"' +
        ' onclick="(function(){var h=document.getElementById(\'cpHexInput\');if(h){h.value=\'' + c + '\';h.dispatchEvent(new Event(\'input\'));}})()">' +
        '</div>';
    }).join('');
  }

  function sendToColorPicker(hex) {
    var hexIn = document.getElementById('cpHexInput');
    if (hexIn) {
      hexIn.value = hex;
      hexIn.dispatchEvent(new Event('input'));
    }
    pushRecent(hex);
    showToast('Colour picked', hex, 'info');
  }

  canvas.addEventListener('mousemove', function(e) {
    if (!imgLoaded) return;
    var rect = canvas.getBoundingClientRect();
    drawMagnifier(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top));
  });

  canvas.addEventListener('mouseleave', function() {
    if (magWrap) magWrap.style.display = 'none';
  });

  canvas.addEventListener('click', function(e) {
    if (!imgLoaded) return;
    var rect = canvas.getBoundingClientRect();
    var x = Math.min(Math.round(e.clientX - rect.left), canvas.width  - 1);
    var y = Math.min(Math.round(e.clientY - rect.top),  canvas.height - 1);
    var px = ctx.getImageData(x, y, 1, 1).data;
    sendToColorPicker(rgbToHex(px[0], px[1], px[2]));
  });

  // Touch support
  canvas.addEventListener('touchmove', function(e) {
    if (!imgLoaded) return;
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.touches[0];
    drawMagnifier(Math.round(t.clientX - rect.left), Math.round(t.clientY - rect.top));
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    if (!imgLoaded) return;
    var rect = canvas.getBoundingClientRect();
    var t = e.changedTouches[0];
    var x = Math.min(Math.round(t.clientX - rect.left), canvas.width  - 1);
    var y = Math.min(Math.round(t.clientY - rect.top),  canvas.height - 1);
    var px = ctx.getImageData(x, y, 1, 1).data;
    sendToColorPicker(rgbToHex(px[0], px[1], px[2]));
    if (magWrap) magWrap.style.display = 'none';
  });

  if (loadBtn) {
    loadBtn.onclick = function() {
      var url = urlInput ? urlInput.value.trim() : '';
      if (url) loadSrc(url);
    };
  }

  if (urlInput) {
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var url = urlInput.value.trim();
        if (url) loadSrc(url);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) { loadSrc(ev.target.result); };
      reader.readAsDataURL(file);
    });
  }
}

function applyCustomPreset(id) {

  var p = getCustomPresets().find(function(x) { return x.id === id; });

  if (!p) return;

  setActiveCustom(p);

  applyCustomization(p);

  showToast('Preset applied', p.name, 'success');

}

window.applyCustomPreset = applyCustomPreset;



function deleteCustomPreset(id) {

  saveCustomPresets(getCustomPresets().filter(function(x) { return x.id !== id; }));

  renderCustomizeView();

}

function editCustomPreset(id) {

  var preset = getCustomPresets().find(function(x) { return x.id === id; });

  if (!preset) return;

  _editingPresetId = id;

  function set(elId, val) { var el = document.getElementById(elId); if (el) el.value = (val != null ? val : ''); }

  set('customBgUrl',      preset.bgUrl      || '');
  set('customBgDim',      preset.bgDim      != null ? preset.bgDim      : 0);
  set('customBgOpac',     preset.bgOpac     != null ? preset.bgOpac     : 0);
  set('customCharUrl',    preset.charUrl    || '');
  set('customCharDark',   preset.charDark   != null ? preset.charDark   : 0);
  set('customCharDim',    preset.charDim    != null ? preset.charDim    : 0);
  set('customHeaderUrl',  preset.headerUrl  || '');
  set('customHeaderDim',  preset.headerDim  != null ? preset.headerDim  : 0);
  set('customHeaderOpac', preset.headerOpac != null ? preset.headerOpac : 0);
  set('customCornerUrl',  preset.cornerUrl  || '');
  set('customCornerDark', preset.cornerDark != null ? preset.cornerDark : 0);
  set('customCornerDim',  preset.cornerDim  != null ? preset.cornerDim  : 0);
  set('customPresetName', preset.name       || '');

  // Restore palette colour into the canvas picker
  var hexEl = document.getElementById('cpHexInput');
  if (hexEl && preset.paletteColor) {
    hexEl.value = preset.paletteColor;
    hexEl.dispatchEvent(new Event('input'));
  }

  // Trigger full live preview to refresh all sliders and miniatures
  if (typeof _cpLivePreviewCb === 'function') _cpLivePreviewCb();

  // Indicate editing state on the Save button
  var saveBtn = document.getElementById('customSaveBtn');
  if (saveBtn) saveBtn.innerHTML = '&#9998; Update Preset';

  document.getElementById('view-customize').scrollIntoView({ behavior: 'smooth' });

  showToast('Loaded for editing', preset.name, 'info');

}

window.editCustomPreset = editCustomPreset;

window.deleteCustomPreset = deleteCustomPreset;


