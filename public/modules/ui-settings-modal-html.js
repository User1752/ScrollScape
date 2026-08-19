// ============================================================================
// SETTINGS MODAL — HTML TEMPLATE
// ============================================================================
// Pure function of global state/i18n: builds the settings modal's entire
// innerHTML as a string. No closure over the modal element or any of
// showSettings()'s local variables — every event listener is wired up
// separately, after this string is injected, in ui-settings-modal.js.
function buildSettingsModalHtml() {
  return `
    <div class="settings-content">
      <div class="settings-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <h2>Settings</h2>
          <span id="settingsSavedIndicator" style="opacity:0;transition:opacity 0.3s;color:var(--color-success);font-size:0.85em;font-weight:600">✓ Saved</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="text" id="settingsSearchInput" class="input" placeholder="Search settings..." autocomplete="off" style="padding:4px 8px;font-size:0.9em;width:160px">
          <button class="btn secondary" id="closeSettings">&#x2715;</button>
        </div>
      </div>
      <div class="settings-layout">

        <!-- ── Sidebar nav ── -->
        <nav class="settings-nav">
          <button class="settings-nav-item active" data-tab="tab-reading">Reading</button>
          <button class="settings-nav-item" data-tab="tab-library">Library</button>
          <button class="settings-nav-item" data-tab="tab-appearance">${t('settings.tabThemeAppearance')}</button>
          <button class="settings-nav-item" data-tab="tab-tracking">Tracking</button>
          <button class="settings-nav-item" data-tab="tab-advanced">Advanced</button>
        </nav>

        <!-- ── Content panels ── -->
        <div class="settings-panel-wrap">

          <!-- Reading tab -->
          <div class="settings-tab active" id="tab-reading">
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Reading Mode</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="readingMode,autoWebtoonDetect,autoLoadNextChapter,webtoonTurnButtonsEnabled,webtoonTurnButtonPlacement,pageFlipAnimation,panWideImages,lineSharpness">Reset</button>
              </div>
              <div class="setting-group">
                <label for="modeSelect">Default reading direction</label>
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
                <label for="webtoonTurnButtonPlacementSelect">Webtoon button placement</label>
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
                <label for="sharpnessSelect">Line Sharpness</label>
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
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Chapter Behaviour</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="skipReadChapters,skipDuplicates">Reset</button>
              </div>
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
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Auto Scroll</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="autoScrollPointSpeeds">Reset</button>
              </div>
              <div class="setting-group">
                <p class="setting-description" style="margin:0 0 0.5rem 0">Set the speed used by each auto-scroll level (points 1 to 5).</p>
                <div id="autoScrollPointSpeedGrid" class="auto-scroll-point-grid">
                  ${(() => {
                    const defaults = [0.2, 0.5, 1.0, 2.0, 3.5];
                    const raw = Array.isArray(state.settings.autoScrollPointSpeeds)
                      ? state.settings.autoScrollPointSpeeds
                      : defaults;
                    const speeds = defaults.map((fallback, idx) => {
                      const n = Number(raw[idx]);
                      return Number.isFinite(n) ? Math.min(12, Math.max(0.05, n)) : fallback;
                    });
                    return speeds.map((v, i) => `
                      <div class="auto-scroll-point-row">
                        <label for="autoScrollPointSpeed${i + 1}">Point ${i + 1}</label>
                        <input type="range" class="settings-speed-slider" id="autoScrollPointSpeed${i + 1}" min="0.05" max="12" step="0.05" value="${v.toFixed(2)}">
                        <span id="autoScrollPointSpeed${i + 1}Label" class="auto-scroll-point-speed-label">${v.toFixed(2)} px/f</span>
                      </div>
                    `).join('');
                  })()}
                </div>
              </div>
            </div>
          </div>

          <!-- Library tab -->
          <div class="settings-tab" id="tab-library">
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Appearance</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="displayMode,showCompactInfo,mangasPerRow,overlays,showLibrarySourceBadge,showHomeSearch,homeSourceMode,homeSelectedSourceIds,hideNsfw,statusBadgeLocation,showChaptersLeft,hideLibraryStatusAndChapters">Reset</button>
              </div>
              <div class="setting-group">
                <label for="displayModeSelect">Display mode</label>
                <select id="displayModeSelect" class="input">
                  <option value="detailed" ${state.settings.displayMode === 'detailed' ? 'selected' : ''}>Detailed Grid</option>
                  <option value="compact" ${state.settings.displayMode === 'compact' ? 'selected' : ''}>Compact Grid</option>
                </select>
                <p class="setting-description">Choose how manga are displayed in your library.</p>
              </div>
              <div class="setting-group" id="compactInfoGroup" style="${state.settings.displayMode === 'compact' ? '' : 'display:none'}">
                <label class="toggle-label">
                  <span class="toggle-text">Show info in Compact Grid</span>
                  <input type="checkbox" id="showCompactInfoToggle" ${state.settings.showCompactInfo ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Show title and author below cover art when using Compact Grid mode.</p>
              </div>
              <div class="setting-group">
                <label for="mangasPerRowSelect">Mangas per row</label>
                <select id="mangasPerRowSelect" class="input">
                  <option value="5" ${state.settings.mangasPerRow == 5 ? 'selected' : ''}>5</option>
                  <option value="6" ${state.settings.mangasPerRow == 6 ? 'selected' : ''}>6</option>
                  <option value="7" ${state.settings.mangasPerRow == 7 ? 'selected' : ''}>7</option>
                  <option value="8" ${state.settings.mangasPerRow == 8 ? 'selected' : ''}>8</option>
                  <option value="9" ${state.settings.mangasPerRow == 9 ? 'selected' : ''}>9</option>
                  <option value="10" ${state.settings.mangasPerRow == 10 ? 'selected' : ''}>10</option>
                  <option value="11" ${state.settings.mangasPerRow == 11 ? 'selected' : ''}>11</option>
                  <option value="12" ${state.settings.mangasPerRow == 12 ? 'selected' : ''}>12</option>
                  <option value="13" ${state.settings.mangasPerRow == 13 ? 'selected' : ''}>13</option>
                  <option value="14" ${state.settings.mangasPerRow == 14 ? 'selected' : ''}>14</option>
                </select>
                <p class="setting-description">Number of manga cards per row (grid modes only).</p>
              </div>
              <div class="setting-group">
                <p class="setting-description" style="margin:0 0 0.4rem 0;font-weight:600">Overlay badges</p>
                <label class="toggle-label" style="margin-bottom:0.3em">
                  <span class="toggle-text">Downloaded Chapters</span>
                  <input type="checkbox" id="toggleOverlayDownloaded" ${state.settings.overlays?.downloaded !== false ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <label class="toggle-label" style="margin-bottom:0.3em">
                  <span class="toggle-text">Unread Chapters</span>
                  <input type="checkbox" id="toggleOverlayUnread" ${state.settings.overlays?.unread !== false ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <label class="toggle-label">
                  <span class="toggle-text">Local Source</span>
                  <input type="checkbox" id="toggleOverlayLocal" ${state.settings.overlays?.local !== false ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Show badges for downloaded, unread, and local manga in your library.</p>
              </div>
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
                <label for="homeSourceModeSelect">Home page source mode</label>
                <select id="homeSourceModeSelect" class="input">
                  <option value="all" ${state.settings.homeSourceMode !== 'selected' ? 'selected' : ''}>Show all installed sources</option>
                  <option value="selected" ${state.settings.homeSourceMode === 'selected' ? 'selected' : ''}>Only selected sources</option>
                </select>
                <p class="setting-description">Controls which sources are used in Home rows (Most Popular Today, Recently Added and Latest Updates)</p>
              </div>
              <div class="setting-group" id="homeSourceSelectionGroup" style="${state.settings.homeSourceMode === 'selected' ? '' : 'display:none'}">
                <p class="setting-description" style="margin:0 0 0.4rem 0;font-weight:600">Sources visible on Home</p>
                <div id="homeSourceSelectionList">
                  ${(() => {
                    const ids = new Set(Array.isArray(state.settings.homeSelectedSourceIds) ? state.settings.homeSelectedSourceIds : []);
                    const sources = getSelectableSources();
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
                <label for="statusBadgeLocationSelect">Reading status badge location</label>
                <select id="statusBadgeLocationSelect" class="input">
                  <option value="cover" ${(state.settings.statusBadgeLocation || 'cover') === 'cover' ? 'selected' : ''}>On cover (top-left)</option>
                  <option value="info" ${state.settings.statusBadgeLocation === 'info' ? 'selected' : ''}>Below title</option>
                  <option value="both" ${state.settings.statusBadgeLocation === 'both' ? 'selected' : ''}>Both</option>
                </select>
                <p class="setting-description">Controls where the Reading/Completed/etc. badge appears on each library card</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Mostrar capítulos em falta</span>
                  <input type="checkbox" id="showChaptersLeftToggle" ${state.settings.showChaptersLeft ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Mostra quantos capítulos faltam por ler em cada carta da biblioteca (requer ter aberto o manga pelo menos uma vez)</p>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">${t('settings.hideStatusAndChapters')}</span>
                  <input type="checkbox" id="hideLibraryStatusAndChaptersToggle" ${state.settings.hideLibraryStatusAndChapters ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">${t('settings.hideStatusAndChaptersDesc')}</p>
              </div>
            </div>
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Defaults</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="libraryDefaultStatusFilter">Reset</button>
              </div>
              <div class="setting-group">
                <label for="libraryDefaultStatusFilterSelect">Default status filter when opening Library</label>
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

          <!-- Theme & Appearance tab -->
          <div class="settings-tab" id="tab-appearance">
            <!-- UI Theme card -->
            <div class="settings-section-card">
              <p class="settings-section-title">${t('settings.uiThemeTitle')}</p>
              <div class="setting-group">
                <label for="uiThemeSelect">${t('settings.uiThemeTitle')}</label>
                <select id="uiThemeSelect" class="input">
                  ${SHOP_THEMES.map(theme => {
                    const isOwned = getPurchasedThemes().includes(theme.id);
                    const isActive = getActiveTheme() === theme.id;
                    if (!isOwned) return '';
                    return `<option value="${escapeHtml(theme.id)}" ${isActive ? 'selected' : ''}>${escapeHtml(theme.name)}</option>`;
                  }).join('')}
                </select>
                <p class="setting-description">${t('settings.uiThemeDesc')}</p>
              </div>
              <div class="setting-group">
                <button class="btn secondary" id="btnGoToThemeShop" style="display:flex; gap:8px; justify-content:center; align-items:center; width:100%;">
                  Shop: ${t('nav.shop')}
                </button>
              </div>
            </div>

            <!-- Reader Appearance card -->
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Reader Appearance</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="readerBackground,readerNoiseEnabled,readerNoiseSource,readerNoiseGifFile,showBookSpine">Reset</button>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text" data-i18n="settings.showBookSpine">${t('settings.showBookSpine')}</span>
                  <input type="checkbox" id="showBookSpineToggle" ${state.settings.showBookSpine !== false ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description" data-i18n="settings.showBookSpineDesc">${t('settings.showBookSpineDesc')}</p>
              </div>
              <div class="setting-group" id="readerBgColorGroup" style="${state.settings.readerNoiseEnabled ? 'display:none' : ''}">
                <label for="readerBgSelect">Background colour</label>
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
                  <label for="readerNoiseSourceSelect">Wallpaper type</label>
                  <select id="readerNoiseSourceSelect" class="input">
                    <option value="generated" ${(state.settings.readerNoiseSource||'generated')==='generated'?'selected':''}>Film grain (generated)</option>
                    <option value="gif"        ${(state.settings.readerNoiseSource||'generated')==='gif'       ?'selected':''}>GIF / image file</option>
                  </select>
                </div>
                <div class="setting-group" id="readerNoiseGifGroup" style="${(state.settings.readerNoiseSource||'generated')==='gif'?'':'display:none'}">
                  <label for="readerNoiseGifFileSelect">Wallpaper file</label>
                  <select id="readerNoiseGifFileSelect" class="input">
                    <option value="">— loading… —</option>
                  </select>
                  <p class="setting-description">Place GIF / WebP files in the <code>public/</code> folder.</p>
                </div>
              </div>
            </div>

            <!-- Library Appearance card -->
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Library Appearance</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="libraryBookshelf3d">Reset</button>
              </div>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Bookshelf View</span>
                  <input type="checkbox" id="libraryBookshelf3dToggle" ${state.settings.libraryBookshelf3d ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Shows library cards in a 3D bookshelf with depth effect</p>
              </div>
            </div>
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">Library Sync</p>
              </div>
              <div class="setting-group">
                <p class="setting-description">Manually check all sources and Anime-Planet for status updates (Ongoing, Completed, Hiatus, Cancelled).</p>
                <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                  <button class="btn primary" id="btnSyncLibraryStatus">Sync Library Status</button>
                  <span id="syncLibraryStatusResult" style="font-size:0.8rem; color:var(--color-success)"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tracking tab -->
          <div class="settings-tab" id="tab-tracking">
            <div class="settings-section-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <p class="settings-section-title" style="margin-bottom:0">AniList</p>
                <button class="btn secondary reset-section-btn" style="padding:2px 6px;font-size:0.75rem" data-keys="anilistAutoSync,anilistAutoImportOnConnect,anilistAutoCategorize,anilistKeepCover">Reset</button>
              </div>
              <div id="anilist-loggedout" ${_alToken() ? 'style="display:none"' : ''}>
                <div class="setting-group">
                  <label for="anilistClientIdInput">AniList Client ID</label>
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
                <div class="setting-group">
                  <label for="anilistImportCategorySelect">Import into category</label>
                  <div style="display:flex;gap:8px;align-items:center">
                    <select id="anilistImportCategorySelect" class="input" style="flex:1">
                      <option value="">— None (mix with library) —</option>
                      ${(state.customLists || []).map(l => `<option value="${escapeHtml(l.id)}" ${state.settings.anilistImportCategoryId === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
                    </select>
                    <button class="btn secondary" id="btnNewAnilistImportCategory" title="Create a new category">+ New</button>
                  </div>
                  <p class="setting-description">Every manga imported from AniList (not just Completed) also gets added to this category, so it doesn't mix in with the rest of your library.</p>
                </div>
                <div class="setting-group">
                  <label class="toggle-label">
                    <span class="toggle-text">Keep AniList cover</span>
                    <input type="checkbox" id="anilistKeepCoverToggle" ${state.settings.anilistKeepCover ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                  <p class="setting-description">Uses the cover art from AniList instead of the one from the source it resolves to</p>
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
              <p class="settings-section-title">Sources</p>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">Show beta sources</span>
                  <input type="checkbox" id="showBetaSourcesToggle" ${state.settings.showBetaSources ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Shows recently added, not-yet-fully-tested sources in the source pickers (Search, Discover, Random Manga, etc). Off by default — manga already in your library from a beta source keep working either way.</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Network & Anti-Bot</p>
              <div class="setting-group">
                <label for="flaresolverrUrlInput">FlareSolverr URL</label>
                <input type="text" id="flaresolverrUrlInput" class="input" placeholder="http://localhost:8191/v1" autocomplete="off" spellcheck="false" style="width:100%">
                <p class="setting-description">Used to bypass Cloudflare on protected sources. Leave blank to disable.</p>
              </div>
              <div class="setting-group">
                <label for="comicVineApiKeyInput">ComicVine API Key</label>
                <input type="password" id="comicVineApiKeyInput" class="input" placeholder="Get a free key at comicvine.gamespot.com/api" autocomplete="off" spellcheck="false" style="width:100%">
                <p class="setting-description">Used to fetch higher-quality covers for Western comics (e.g. BatCave). Leave blank to disable.</p>
              </div>
            </div>
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
            <div class="settings-section-card">
              <p class="settings-section-title">Genre Blacklist</p>
              <div class="setting-group">
                <label for="genreBlacklistInput">Blacklisted Genres (comma separated)</label>
                <input type="text" id="genreBlacklistInput" class="input" placeholder="e.g. yaoi, doujinshi, harem" autocomplete="off" spellcheck="false" value="${escapeHtml((state.settings.genreBlacklist || []).join(', '))}"></input>
                <p class="setting-description">Manga containing these genres will be hidden from Search and Discover.</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Backup &amp; Restore</p>
              <div class="setting-group">
                <p class="setting-description" style="margin:0 0 0.6rem 0">Save your library, reading history, custom lists, achievements, settings and AniList links to a single file — or restore from one.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="btn secondary" id="btnExportBackup">Export Backup</button>
                  <button class="btn secondary" id="btnImportBackup" style="color:var(--color-danger)">Import Backup</button>
                  <input type="file" id="importBackupFileInput" accept=".json" style="display:none">
                </div>
                <p class="setting-description" style="margin-top:0.5rem">Your AniList login token isn't included for security — reconnect AniList (one click) after restoring. Downloaded/local manga files aren't included either, only their library entries.</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Import from Tachiyomi / Mihon</p>
              <div class="setting-group">
                <p class="setting-description" style="margin:0 0 0.6rem 0">Import a Tachiyomi or Mihon library backup (.tachibk). Titles, covers, genres, reading progress and categories come across as best as they can — chapters from a source ScrollScape doesn't recognise import as metadata only; use Migrate afterward to re-link them to a live source here.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button class="btn secondary" id="btnImportMihon">Import Tachiyomi/Mihon Backup</button>
                  <input type="file" id="importMihonFileInput" accept=".tachibk,.proto.gz,.gz" style="display:none">
                </div>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">OPDS Catalog</p>
              <div class="setting-group">
                <p class="setting-description" style="margin:0 0 0.6rem 0">Browse this library from an external e-reader app (KOReader, Moon+ Reader, Calibre, etc.) by pointing it at this catalog URL.</p>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <input type="text" id="opdsCatalogUrl" class="input" readonly value="${escapeHtml(window.location.origin)}/opds" style="flex:1;min-width:220px">
                  <button class="btn secondary" id="btnCopyOpdsUrl">Copy</button>
                </div>
                <p class="setting-description" style="margin-top:0.5rem">Read-only, no login required — matches the rest of this self-hosted app.</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Access Password</p>
              <div class="setting-group">
                <p class="setting-description" id="accessPasswordStatus" style="margin:0 0 0.6rem 0">Loading…</p>
                <div id="accessPasswordCurrentGroup" style="display:none;margin-bottom:0.6rem">
                  <label for="accessPasswordCurrentInput">Current password</label>
                  <input type="password" id="accessPasswordCurrentInput" class="input" autocomplete="current-password">
                </div>
                <label for="accessPasswordNewInput">New password (leave empty to remove the lock)</label>
                <input type="password" id="accessPasswordNewInput" class="input" autocomplete="new-password">
                <div class="setting-group" style="display:flex;gap:8px;margin-top:0.6rem">
                  <button class="btn secondary" id="btnSaveAccessPassword">Save</button>
                </div>
                <p class="setting-description" style="margin-top:0.5rem">Only gates the app itself — the OPDS catalog stays unauthenticated since external e-reader apps can't fill in a login form.</p>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Factory Reset</p>
              <div class="setting-group">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                  <p class="setting-description" style="margin:0">Reset all application settings to their default values. This will not delete your library or reading history.</p>
                  <button class="btn secondary" id="btnResetAllSettings" style="white-space:nowrap;color:var(--color-danger)">Reset All Settings</button>
                </div>
              </div>
            </div>
          </div>

        </div><!-- end panel-wrap -->
      </div><!-- end layout -->
    </div><!-- end content -->
  `;
}
