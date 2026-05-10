// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings() {
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="btn secondary" id="closeSettings">&#x2715;</button>
      </div>
      <div class="settings-layout">

        <!-- ── Sidebar nav ── -->
        <nav class="settings-nav">
          <button class="settings-nav-item active" data-tab="tab-reading">Reading</button>
          <button class="settings-nav-item" data-tab="tab-library">Library</button>
          <button class="settings-nav-item" data-tab="tab-tracking">Tracking</button>
          <button class="settings-nav-item" data-tab="tab-advanced">Advanced</button>
        </nav>

        <!-- ── Content panels ── -->
        <div class="settings-panel-wrap">

          <!-- Reading tab -->
          <div class="settings-tab active" id="tab-reading">
            <div class="settings-section-card">
              <p class="settings-section-title">Reading Mode</p>
              <div class="setting-group">
                <label>Default reading direction</label>
                <select id="modeSelect" class="input">
                  <option value="ltr"     ${state.settings.readingMode === "ltr"     ? "selected" : ""}>Left to Right</option>
                  <option value="rtl"     ${state.settings.readingMode === "rtl"     ? "selected" : ""}>Right to Left (Manga)</option>
                  <option value="webtoon" ${state.settings.readingMode === "webtoon" ? "selected" : ""}>Webtoon (Vertical Scroll)</option>
                </select>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Auto-detect Manhwa / Manhua</span>
                  <input type="checkbox" id="autoWebtoonToggle" ${state.settings.autoWebtoonDetect !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Automatically switches to Webtoon mode for Korean and Chinese comics.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Auto-load next chapter (Webtoon)</span>
                  <input type="checkbox" id="autoLoadNextChapterToggle" ${state.settings.autoLoadNextChapter ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Automatically opens the next chapter when you scroll to the end.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Webtoon page-turn buttons</span>
                  <input type="checkbox" id="webtoonTurnButtonsToggle" ${state.settings.webtoonTurnButtonsEnabled !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-group">
                <label>Webtoon button placement</label>
                <select id="webtoonTurnButtonPlacementSelect" class="input">
                  <option value="bottom"  ${(state.settings.webtoonTurnButtonPlacement || 'corners') === 'bottom' ? 'selected' : ''}>Bottom center</option>
                  <option value="corners" ${(state.settings.webtoonTurnButtonPlacement || 'corners') === 'corners' ? 'selected' : ''}>Bottom corners</option>
                </select>
                <p class="setting-description">Only applies to Webtoon mode.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Page flip animation</span>
                  <input type="checkbox" id="pageFlipAnimationToggle" ${state.settings.pageFlipAnimation !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">3D page-turn effect in Book (RTL/LTR) mode.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Pan wide images</span>
                  <input type="checkbox" id="panWideToggle" ${state.settings.panWideImages ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Allows horizontal scrolling on double-page spreads.</p>
              </div>
              <div class="setting-group">
                <label>Line Sharpness</label>
                <select id="sharpnessSelect" class="input">
                  <option value="0" ${(state.settings.lineSharpness||0) === 0 ? 'selected' : ''}>Off</option>
                  <option value="1" ${(state.settings.lineSharpness||0) === 1 ? 'selected' : ''}>Subtle</option>
                  <option value="2" ${(state.settings.lineSharpness||0) === 2 ? 'selected' : ''}>Strong</option>
                  <option value="3" ${(state.settings.lineSharpness||0) === 3 ? 'selected' : ''}>Max</option>
                </select>
                <p class="setting-description">Increases contrast to make manga lines crisper.</p>
              </div>
            </div>

            <div class="settings-section-card">
              <p class="settings-section-title">Reader Appearance</p>
              <div class="setting-group" id="readerBgColorGroup" style="${state.settings.readerNoiseEnabled ? 'display:none' : ''}">
                <label>Background colour</label>
                <select id="readerBgSelect" class="input">
                  <option value="black" ${(state.settings.readerBackground||'black') === 'black' ? 'selected' : ''}>Black</option>
                  <option value="dark"  ${(state.settings.readerBackground||'black') === 'dark'  ? 'selected' : ''}>Dark</option>
                  <option value="gray"  ${(state.settings.readerBackground||'black') === 'gray'  ? 'selected' : ''}>Gray</option>
                  <option value="sepia" ${(state.settings.readerBackground||'black') === 'sepia' ? 'selected' : ''}>Sepia</option>
                  <option value="white" ${(state.settings.readerBackground||'black') === 'white' ? 'selected' : ''}>White</option>
                </select>
                <p class="setting-description">Background colour shown behind pages while reading.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Animated wallpaper</span>
                  <input type="checkbox" id="readerNoiseToggle" ${state.settings.readerNoiseEnabled ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Replaces the background colour with an animated wallpaper.</p>
              </div>
              <div id="readerWallpaperOptions" style="${state.settings.readerNoiseEnabled ? '' : 'display:none'}">
                <div class="setting-group">
                  <label>Wallpaper type</label>
                  <select id="readerNoiseSourceSelect" class="input">
                    <option value="generated" ${(state.settings.readerNoiseSource||'generated')==='generated'?'selected':''}>Film grain (generated)</option>
                    <option value="gif"        ${(state.settings.readerNoiseSource||'generated')==='gif'       ?'selected':''}>GIF / image file</option>
                  </select>
                </div>
                <div class="setting-group" id="readerNoiseGifGroup" style="${(state.settings.readerNoiseSource||'generated')==='gif'?'':'display:none'}">
                  <label>Wallpaper file</label>
                  <select id="readerNoiseGifFileSelect" class="input">
                    <option value="">— loading… —</option>
                  </select>
                  <p class="setting-description">Place GIF / WebP files in the <code>public/</code> folder.</p>
                </div>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Chapter Behaviour</p>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Hide read chapters</span>
                  <input type="checkbox" id="skipReadToggle" ${state.settings.skipReadChapters ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Hides chapters you've already finished reading</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Skip duplicate chapters</span>
                  <input type="checkbox" id="skipDuplicatesToggle" ${state.settings.skipDuplicates ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Automatically advances past duplicates of the same chapter number</p>
              </div>
            </div>
          </div>

          <!-- Library tab -->
          <div class="settings-tab" id="tab-library">
            <div class="settings-section-card">
              <p class="settings-section-title">Appearance</p>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Show source on library cards</span>
                  <input type="checkbox" id="showLibrarySourceToggle" ${state.settings.showLibrarySourceBadge !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Displays the source name in the bottom-right corner of each library cover</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Show search panel on Home</span>
                  <input type="checkbox" id="showHomeSearchToggle" ${state.settings.showHomeSearch !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Shows or hides the Search Manga panel at the top of the Home page.</p>
              </div>
              <div class="setting-group">
                <label>Home page source mode</label>
                <select id="homeSourceModeSelect" class="input">
                  <option value="all" ${state.settings.homeSourceMode !== 'selected' ? 'selected' : ''}>Show all installed sources</option>
                  <option value="selected" ${state.settings.homeSourceMode === 'selected' ? 'selected' : ''}>Only selected sources</option>
                </select>
                <p class="setting-description">Controls which sources are used in Home rows (Most Popular Today, Recently Added and Latest Updates)</p>
              </div>
              <div class="setting-group" id="homeSourceSelectionGroup" style="${state.settings.homeSourceMode === 'selected' ? '' : 'display:none'}">
                <label>Sources visible on Home</label>
                <div id="homeSourceSelectionList">
                  ${(() => {
                    const ids = new Set(Array.isArray(state.settings.homeSelectedSourceIds) ? state.settings.homeSelectedSourceIds : []);
                    const sources = Object.values(state.installedSources || {});
                    if (!sources.length) return '<p class="muted" style="margin:0">No installed sources</p>';
                    return sources.map(s => `
                      <label class="home-source-check">
                        <input type="checkbox" class="home-source-option" value="${escapeHtml(s.id)}" ${ids.size === 0 || ids.has(s.id) ? 'checked' : ''}>
                        <span class="home-source-check-label">${escapeHtml(s.name || s.id)}</span>
                      </label>
                    `).join('');
                  })()}
                </div>
                <p class="setting-description">If no source is selected, ScrollScape falls back to showing all.</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Hide NSFW</span>
                  <input type="checkbox" id="hideNsfwToggle" ${state.settings.hideNsfw ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Hides NSFW-related filters in Advanced Search and excludes NSFW-tagged titles from Library</p>
              </div>
              <div class="setting-group">
                <label>Reading status badge location</label>
                <select id="statusBadgeLocationSelect" class="input">
                  <option value="cover" ${(state.settings.statusBadgeLocation || 'cover') === 'cover' ? 'selected' : ''}>On cover (top-left)</option>
                  <option value="info" ${state.settings.statusBadgeLocation === 'info' ? 'selected' : ''}>Below title</option>
                  <option value="both" ${state.settings.statusBadgeLocation === 'both' ? 'selected' : ''}>Both</option>
                </select>
                <p class="setting-description">Controls where the Reading/Completed/etc. badge appears on each library card</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">3D Bookshelf</span>
                  <input type="checkbox" id="libraryBookshelf3dToggle" ${state.settings.libraryBookshelf3d ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Shows library cards in a 3D bookshelf with depth effect</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Mostrar capítulos em falta</span>
                  <input type="checkbox" id="showChaptersLeftToggle" ${state.settings.showChaptersLeft ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Mostra quantos capítulos faltam por ler em cada carta da biblioteca (requer ter aberto o manga pelo menos uma vez)</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Defaults</p>
              <div class="setting-group">
                <label>Default status filter when opening Library</label>
                <select id="libraryDefaultStatusFilterSelect" class="input">
                  <option value="all" ${state.settings.libraryDefaultStatusFilter === 'all' ? 'selected' : ''}>All Manga</option>
                  <option value="reading" ${state.settings.libraryDefaultStatusFilter === 'reading' ? 'selected' : ''}>Reading</option>
                  <option value="completed" ${state.settings.libraryDefaultStatusFilter === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="on_hold" ${state.settings.libraryDefaultStatusFilter === 'on_hold' ? 'selected' : ''}>On Hold</option>
                  <option value="plan_to_read" ${state.settings.libraryDefaultStatusFilter === 'plan_to_read' ? 'selected' : ''}>Plan to Read</option>
                  <option value="dropped" ${state.settings.libraryDefaultStatusFilter === 'dropped' ? 'selected' : ''}>Dropped</option>
                </select>
                <p class="setting-description">When you open Library, this filter is selected automatically</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Data</p>
              <div class="setting-group">
                <button class="btn secondary" id="clearReadBtn">Clear Reading History</button>
                <p class="setting-description">Removes all reading history, last-read pages, and chapter flags</p>
              </div>
            </div>
          </div>

          <!-- Tracking tab -->
          <div class="settings-tab" id="tab-tracking">
            <div class="settings-section-card">
              <p class="settings-section-title">AniList</p>
              <div id="anilist-loggedout" ${_alToken() ? 'style="display:none"' : ''}>
                <div class="setting-group">
                  <label>AniList Client ID</label>
                  <input type="text" id="anilistClientIdInput" class="input" value="${escapeHtml(_alClientId())}" placeholder="e.g. 23361" autocomplete="off" spellcheck="false">
                  <p class="setting-description">
                    Register a free app at <strong>anilist.co/settings/developer</strong> and set the
                    redirect URI to <code>${escapeHtml(window.location.origin)}</code>.
                  </p>
                </div>
                <div class="setting-group">
                  <button class="btn primary" id="btnAniListConnect">Connect AniList</button>
                </div>
              </div>
              <div id="anilist-loggedin" ${_alToken() ? '' : 'style="display:none"'}>
                <div class="setting-group">
                  <div class="anilist-user-card" id="anilistUserCard">
                    ${(() => {
                      const u = _alUser();
                      if (!u) return '<span class="muted" style="padding:0">Loading…</span>';
                      return `${u.avatar ? `<img src="${escapeHtml(u.avatar)}" alt="" class="anilist-avatar">` : ''}
                              <span class="anilist-username">${escapeHtml(u.name)}</span>`;
                    })()}
                  </div>
                </div>
                <div class="setting-group">
                  <label class="toggle-label">
                    <span class="toggle-text">Auto-sync progress</span>
                    <input type="checkbox" id="anilistAutoSyncToggle" ${state.settings.anilistAutoSync ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                  <p class="setting-description">Automatically updates your AniList chapter progress when you read</p>
                </div>
                <div class="setting-group">
                  <label class="toggle-label">
                    <span class="toggle-text">Auto-import on connect</span>
                    <input type="checkbox" id="anilistAutoImportToggle" ${state.settings.anilistAutoImportOnConnect ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                  <p class="setting-description">Imports your AniList manga library automatically when you connect your account</p>
                </div>
                <div class="setting-group">
                  <label class="toggle-label">
                    <span class="toggle-text">Auto-categorize on import</span>
                    <input type="checkbox" id="anilistAutoCategorizeToggle" ${state.settings.anilistAutoCategorize ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                  <p class="setting-description">Automatically adds completed manga to a "Read" category when importing</p>
                </div>
                <div class="setting-group" style="display:flex;gap:8px;flex-wrap:wrap">
                  <button class="btn primary" id="btnAniListImportNow">Import Library Now</button>
                  <button class="btn secondary" id="btnAniListDisconnect">Disconnect</button>
                </div>
                <div id="anilistImportProgressWrap" class="anilist-import-progress hidden">
                  <div class="anilist-import-progress-bar">
                    <div id="anilistImportProgressFill" class="anilist-import-progress-fill"></div>
                  </div>
                  <p id="anilistImportProgressText" class="setting-description">Waiting to start import…</p>
                </div>
                ${(() => {
                  const sync = state.anilistSync;
                  if (!sync?.lastImportAt) return '<p id="anilistLastImportLabel" class="setting-description" style="margin-top:4px;display:none"></p>';
                  const d = new Date(sync.lastImportAt).toLocaleString();
                  return `<p id="anilistLastImportLabel" class="setting-description" style="margin-top:4px">Last import: <strong>${escapeHtml(d)}</strong> &mdash; ${sync.importedCount || 0} new, ${sync.overwriteCount || 0} updated</p>`;
                })()}
              </div>
            </div>
          </div>

          <!-- Advanced tab -->
          <div class="settings-tab" id="tab-advanced">
            <div class="settings-section-card">
              <p class="settings-section-title">Commands</p>
              <div class="setting-group">
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="text" id="cheatInput" class="input" placeholder="Enter command…" autocomplete="off" autocorrect="off" spellcheck="false" style="flex:1;font-family:monospace">
                  <button class="btn primary" id="cheatRunBtn">Run</button>
                </div>
                <p class="setting-description">Available: <code>cls</code> — reset all AP &amp; achievements &nbsp;·&nbsp; <code>godmode</code> — add 500 AP &nbsp;·&nbsp; <code>lcls</code> — clear library</p>
              </div>
            </div>
          </div>

        </div><!-- end panel-wrap -->
      </div><!-- end layout -->
    </div><!-- end content -->
  `;
  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  // Tab switching
  modal.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
      modal.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      modal.querySelector('#' + btn.dataset.tab)?.classList.add('active');
      // Re-init custom selects inside newly visible tab
      if (window.initCustomSelects) initCustomSelects();
    };
  });

  $("modeSelect").onchange = (e) => {
    state.settings.readingMode = e.target.value;
    saveSettings();
    if (state.currentChapter) { showReader(); renderPage(); }
  };
  const webtoonTurnBtnSelect = $("webtoonTurnButtonPlacementSelect");
  if (webtoonTurnBtnSelect) {
    webtoonTurnBtnSelect.onchange = (e) => {
      state.settings.webtoonTurnButtonPlacement = e.target.value === 'bottom' ? 'bottom' : 'corners';
      saveSettings();
      if (state.currentChapter) { showReader(); renderPage(); }
    };
  }
  const webtoonTurnButtonsToggle = $("webtoonTurnButtonsToggle");
  if (webtoonTurnButtonsToggle) {
    webtoonTurnButtonsToggle.onchange = (e) => {
      state.settings.webtoonTurnButtonsEnabled = e.target.checked;
      saveSettings();
      if (state.currentChapter) { showReader(); renderPage(); }
    };
  }
  const autoLoadNextChapterToggle = $("autoLoadNextChapterToggle");
  if (autoLoadNextChapterToggle) {
    autoLoadNextChapterToggle.onchange = (e) => {
      state.settings.autoLoadNextChapter = e.target.checked;
      saveSettings();
      if (state.currentChapter) { showReader(); renderPage(); }
    };
  }
  $("sharpnessSelect").onchange = (e) => {
    state.settings.lineSharpness = parseInt(e.target.value, 10);
    saveSettings();
    const pw = $("pageWrap");
    if (pw) {
      pw.classList.remove('sharp-1', 'sharp-2', 'sharp-3');
      if (state.settings.lineSharpness > 0) pw.classList.add(`sharp-${state.settings.lineSharpness}`);
    }
  };
  $("skipReadToggle").onchange = (e) => {
    state.settings.skipReadChapters = e.target.checked;
    saveSettings();
    if (state.currentManga) loadChapters();
  };
  $("skipDuplicatesToggle").onchange = (e) => {
    state.settings.skipDuplicates = e.target.checked;
    saveSettings();
  };
  $("panWideToggle").onchange = (e) => {
    state.settings.panWideImages = e.target.checked;
    saveSettings();
    if (state.currentChapter) renderPage();
  };  const autoWebtoonToggle = $('autoWebtoonToggle');
  if (autoWebtoonToggle) {
    autoWebtoonToggle.onchange = (e) => {
      state.settings.autoWebtoonDetect = e.target.checked;
      saveSettings();
    };
  }  const pageFlipAnimationToggle = $('pageFlipAnimationToggle');
  if (pageFlipAnimationToggle) {
    pageFlipAnimationToggle.onchange = (e) => {
      state.settings.pageFlipAnimation = e.target.checked;
      saveSettings();
    };
  }

  const readerBgSelect = $('readerBgSelect');
  if (readerBgSelect) {
    readerBgSelect.onchange = (e) => {
      state.settings.readerBackground = e.target.value;
      saveSettings();
      applyReaderBackground();
    };
  }

  const readerNoiseToggle = $('readerNoiseToggle');
  if (readerNoiseToggle) {
    readerNoiseToggle.onchange = (e) => {
      state.settings.readerNoiseEnabled = e.target.checked;
      saveSettings();
      const bgGroup  = $('readerBgColorGroup');
      const wpOpts   = $('readerWallpaperOptions');
      if (bgGroup)  bgGroup.style.display  = e.target.checked ? 'none' : '';
      if (wpOpts)   wpOpts.style.display   = e.target.checked ? '' : 'none';
      if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
    };
  }

  const readerNoiseSourceSelect = $('readerNoiseSourceSelect');
  if (readerNoiseSourceSelect) {
    readerNoiseSourceSelect.onchange = (e) => {
      state.settings.readerNoiseSource = e.target.value;
      saveSettings();
      const gifGroup = $('readerNoiseGifGroup');
      if (gifGroup) gifGroup.style.display = e.target.value === 'gif' ? '' : 'none';
      if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
    };
  }

  // Populate wallpaper file list
  (async () => {
    const fileSelect = $('readerNoiseGifFileSelect');
    if (!fileSelect) return;
    try {
      const data = await fetch('/api/reader-wallpapers').then(r => r.json());
      const files = data.files || [];
      const current = state.settings.readerNoiseGifFile || '';
      if (files.length === 0) {
        fileSelect.innerHTML = '<option value="">— no GIF/WebP files found in public/ —</option>';
      } else {
        fileSelect.innerHTML = files.map(f =>
          `<option value="${f}" ${f === current ? 'selected' : ''}>${f}</option>`
        ).join('');
        if (!current && files.length > 0) {
          state.settings.readerNoiseGifFile = files[0];
          saveSettings();
        }
      }
    } catch { /* server may not be updated yet */ }
    fileSelect.onchange = (e) => {
      state.settings.readerNoiseGifFile = e.target.value;
      saveSettings();
      if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
    };
  })();

  const sourceBadgeToggle = $("showLibrarySourceToggle");
  if (sourceBadgeToggle) {
    sourceBadgeToggle.onchange = (e) => {
      state.settings.showLibrarySourceBadge = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }

  const showHomeSearchToggle = $("showHomeSearchToggle");
  if (showHomeSearchToggle) {
    showHomeSearchToggle.onchange = (e) => {
      state.settings.showHomeSearch = e.target.checked;
      saveSettings();
      if (typeof applyHomeSearchVisibility === 'function') applyHomeSearchVisibility();
    };
  }

  const refreshHomeRows = () => {
    if (typeof loadPopularToday === 'function') loadPopularToday();
    if (typeof loadRecentlyAdded === 'function') loadRecentlyAdded();
    if (typeof loadLatestUpdates === 'function') loadLatestUpdates();
  };

  const homeSourceModeSelect = $("homeSourceModeSelect");
  const homeSourceSelectionGroup = $("homeSourceSelectionGroup");
  if (homeSourceModeSelect) {
    homeSourceModeSelect.onchange = (e) => {
      state.settings.homeSourceMode = e.target.value === 'selected' ? 'selected' : 'all';
      saveSettings();
      if (homeSourceSelectionGroup) {
        homeSourceSelectionGroup.style.display = state.settings.homeSourceMode === 'selected' ? '' : 'none';
      }
      refreshHomeRows();
    };
  }

  modal.querySelectorAll('.home-source-option').forEach(cb => {
    cb.onchange = () => {
      const selected = [...modal.querySelectorAll('.home-source-option:checked')].map(el => el.value);
      state.settings.homeSelectedSourceIds = [...new Set(selected)];
      saveSettings();
      if (state.settings.homeSourceMode === 'selected') refreshHomeRows();
    };
  });

  const hideNsfwToggle = $("hideNsfwToggle");
  if (hideNsfwToggle) {
    hideNsfwToggle.onchange = (e) => {
      state.settings.hideNsfw = e.target.checked;
      saveSettings();

      let advChanged = false;
      if (typeof applyAdvancedSearchNsfwVisibility === 'function') {
        advChanged = applyAdvancedSearchNsfwVisibility();
      }

      const advView = document.querySelector("#view-advanced-search");
      if (advView && !advView.classList.contains("hidden") && advChanged) {
        advancedSearch(1);
      }

      renderLibrary();
    };
  }

  const bookshelf3dToggle = $("libraryBookshelf3dToggle");
  if (bookshelf3dToggle) {
    bookshelf3dToggle.onchange = (e) => {
      state.settings.libraryBookshelf3d = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }

  const showChaptersLeftToggle = $("showChaptersLeftToggle");
  if (showChaptersLeftToggle) {
    showChaptersLeftToggle.onchange = (e) => {
      state.settings.showChaptersLeft = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }

  const libraryDefaultStatusSel = $("libraryDefaultStatusFilterSelect");
  if (libraryDefaultStatusSel) {
    libraryDefaultStatusSel.onchange = (e) => {
      state.settings.libraryDefaultStatusFilter = e.target.value || 'all';
      saveSettings();
    };
  }

  const statusBadgeLocSel = $("statusBadgeLocationSelect");
  if (statusBadgeLocSel) {
    statusBadgeLocSel.onchange = (e) => {
      state.settings.statusBadgeLocation = e.target.value || 'cover';
      saveSettings();
      renderLibrary();
    };
  }
  async function runCheatCommand(cmd) {
    switch ((cmd || '').trim().toLowerCase()) {
      case 'cls':
        achievementManager.reset();
        localStorage.setItem('scrollscape_ap_bonus', '0');
        localStorage.setItem('scrollscape_ap_spent', '0');
        updateApBadge();
        showToast('Reset complete', 'All AP and achievements cleared.', 'info');
        break;
      case 'godmode':
        addBonusAP(500);
        updateApBadge();
        showToast('Godmode activated', '+500 AP added to your wallet.', 'success');
        break;
      case 'lcls':
        try {
          const res = await fetch('/api/library/clear', { method: 'DELETE' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          state.favorites = [];
          state.readingStatus = {};
          state.customLists = [];
          renderLibrary();
          showToast('Library cleared', 'Favorites, reading status and lists were removed.', 'success');
        } catch (e) {
          showToast('Clear failed', e?.message || 'Could not clear library.', 'warning');
        }
        break;
      default:
        showToast('Unknown command', `"${cmd}" is not a valid command.`, 'warning');
    }
  }
  $('cheatRunBtn').onclick = async () => {
    const inp = $('cheatInput');
    await runCheatCommand(inp.value);
    inp.value = '';
  };
  $('cheatInput').onkeydown = async (e) => {
    if (e.key === 'Enter') { await runCheatCommand($('cheatInput').value); $('cheatInput').value = ''; }
  };

  $("clearReadBtn").onclick = async () => {
    if (confirm("Clear all reading history?")) {
      try { await fetch("/api/history/clear", { method: "DELETE" }); } catch (_) {}
      state.history = [];
      state.readChapters.clear();
      state.flaggedChapters.clear();
      state.lastReadPages = {};
      state.lastReadChapter = {};
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
      renderLibrary();
      showToast("Reading history cleared", "", "info");
    }
  };

  // ── AniList settings handlers ──────────────────────────────────────────────
  const alClientInput = $('anilistClientIdInput');
  if (alClientInput) {
    alClientInput.oninput = () => _alSetClientId(alClientInput.value.trim());
  }
  const btnConnect = $('btnAniListConnect');
  if (btnConnect) {
    btnConnect.onclick = () => {
      if (alClientInput) _alSetClientId(alClientInput.value.trim());
      anilistOAuthConnect();
    };
  }
  const btnDisconnect = $('btnAniListDisconnect');
  if (btnDisconnect) {
    btnDisconnect.onclick = () => {
      _alDisconnect();
      $('anilist-loggedin').style.display = 'none';
      $('anilist-loggedout').style.display = '';
      showToast('AniList', 'Disconnected.', 'info');
    };
  }
  const alAutoToggle = $('anilistAutoSyncToggle');
  if (alAutoToggle) {
    alAutoToggle.onchange = (e) => {
      state.settings.anilistAutoSync = e.target.checked;
      saveSettings();
    };
  }
  const alAutoImportToggle = $('anilistAutoImportToggle');
  if (alAutoImportToggle) {
    alAutoImportToggle.onchange = (e) => {
      state.settings.anilistAutoImportOnConnect = e.target.checked;
      saveSettings();
    };
  }
  const alAutoCatToggle = $('anilistAutoCategorizeToggle');
  if (alAutoCatToggle) {
    alAutoCatToggle.onchange = (e) => {
      state.settings.anilistAutoCategorize = e.target.checked;
      saveSettings();
    };
  }
  const btnImportNow = $('btnAniListImportNow');
  if (btnImportNow) {
    btnImportNow.onclick = (e) => {
      if ($('anilistImportMenu')) {
        $('anilistImportMenu').remove();
        return;
      }

      const menu = document.createElement('div');
      menu.id = 'anilistImportMenu';
      menu.className = 'context-menu';
      menu.style.position = 'absolute';
      menu.style.zIndex = '9999';
      menu.style.padding = '12px';
      
      menu.innerHTML = `
        <div style="font-weight:600;margin-bottom:8px;font-size:0.9rem">Select Statuses to Import:</div>
        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer"><input type="checkbox" class="import-status-cb" value="CURRENT" checked style="margin-right:8px"> Reading</label>
        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer"><input type="checkbox" class="import-status-cb" value="COMPLETED" checked style="margin-right:8px"> Completed</label>
        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer"><input type="checkbox" class="import-status-cb" value="DROPPED" checked style="margin-right:8px"> Dropped</label>
        <label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer"><input type="checkbox" class="import-status-cb" value="PAUSED" checked style="margin-right:8px"> On Hold</label>
        <label style="display:flex;align-items:center;margin-bottom:12px;cursor:pointer"><input type="checkbox" class="import-status-cb" value="PLANNING" checked style="margin-right:8px"> Plan to Read</label>
        <button class="btn primary" id="btnConfirmImport" style="width:100%;font-size:0.85rem;padding:6px">Start Import</button>
      `;

      document.body.appendChild(menu);
      const rect = btnImportNow.getBoundingClientRect();
      menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
      menu.style.left = (rect.left + window.scrollX) + 'px';

      const closeMenu = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== btnImportNow) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);

      menu.querySelector('#btnConfirmImport').onclick = async () => {
        const selectedStatuses = [...menu.querySelectorAll('.import-status-cb:checked')].map(cb => cb.value);
        menu.remove();
        document.removeEventListener('click', closeMenu);

        if (selectedStatuses.length === 0) {
          showToast('Import', 'Please select at least one status to import.', 'warning');
          return;
        }

        const progressWrap = $('anilistImportProgressWrap');
        const progressFill = $('anilistImportProgressFill');
        const progressText = $('anilistImportProgressText');
        const setProgress = (pct, txt) => {
          if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
          if (progressText && txt) progressText.textContent = txt;
        };

        btnImportNow.disabled = true;
        btnImportNow.textContent = 'Importing...';
        if (progressWrap) progressWrap.classList.remove('hidden');
        setProgress(0, 'Starting AniList import…');

        try {
          const r = await anilistImportLibrary({
            statuses: selectedStatuses,
            onProgress: ({ percent, label }) => {
              setProgress(percent, label || 'Importing…');
            }
          });

          if (r?.ok) {
            setProgress(100, 'Import complete.');
          } else {
            setProgress(100, `Import stopped: ${r?.error || 'unable to complete'}`);
          }

          const sync = state.anilistSync;
          if (sync?.lastImportAt) {
            const d = new Date(sync.lastImportAt).toLocaleString();
            const syncLine = `Last import: <strong>${escapeHtml(d)}</strong> &mdash; ${sync.importedCount || 0} new, ${sync.overwriteCount || 0} updated`;
            const label = $('anilistLastImportLabel');
            if (label) {
              label.innerHTML = syncLine;
              label.style.display = '';
            }
          }
        } finally {
          btnImportNow.disabled = false;
          btnImportNow.textContent = '↓ Import Library Now';
        }
      };
    };
  }
}

