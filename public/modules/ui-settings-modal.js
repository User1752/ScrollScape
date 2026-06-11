// (Removido do escopo global: handlers de displayModeSelect e mangasPerRowSelect)
// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings() {
    let initializingSettingsModal = true;
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
          <button class="settings-nav-item" data-tab="tab-appearance">${t('settings.tabThemeAppearance')}</button>
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
                <label>Display mode</label>
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
                <label>Mangas per row</label>
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
                <label>Overlay badges</label>
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

          <!-- Theme & Appearance tab -->
          <div class="settings-tab" id="tab-appearance">
            <!-- UI Theme card -->
            <div class="settings-section-card">
              <p class="settings-section-title">${t('settings.uiThemeTitle')}</p>
              <div class="setting-group">
                <label>${t('settings.uiThemeTitle')}</label>
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

            <!-- Library Appearance card -->
            <div class="settings-section-card">
              <p class="settings-section-title">Library Appearance</p>
              <div class="setting-group">
                <label class="toggle-label">
                  <span class="toggle-text">3D Bookshelf</span>
                  <input type="checkbox" id="libraryBookshelf3dToggle" ${state.settings.libraryBookshelf3d ? "checked" : ""}>
                  <span class="toggle-slider"></span>
                </label>
                <p class="setting-description">Shows library cards in a 3D bookshelf with depth effect</p>
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
              <p class="settings-section-title">Source Health</p>
              <div class="setting-group">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                  <p class="setting-description" style="margin:0">Check if all installed sources are responding correctly.</p>
                  <button class="btn secondary" id="btnRunSourceHealthCheck" style="white-space:nowrap">Run Check</button>
                </div>
              </div>
              <div id="sourceHealthResults" style="display:none">
                <div id="sourceHealthList"></div>
              </div>
            </div>
            <div class="settings-section-card">
              <p class="settings-section-title">Recent Errors</p>
              <div class="setting-group">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                  <p class="setting-description" style="margin:0">Errors logged by sources during normal operation.</p>
                  <button class="btn secondary" id="btnClearErrorLog" style="white-space:nowrap;color:var(--color-danger)">Clear Log</button>
                </div>
              </div>
              <div id="errorLogResults">
                <p class="setting-description" style="margin:8px 0;font-style:italic">Loading…</p>
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
          </div>

        </div><!-- end panel-wrap -->
      </div><!-- end layout -->
    </div><!-- end content -->
  `;
  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  // Finaliza inicialização após todos os handlers estarem prontos
  setTimeout(() => { initializingSettingsModal = false; }, 0);
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

  // Display mode select
  const displayModeSelect = $("displayModeSelect");
  if (displayModeSelect) {
    displayModeSelect.onchange = (e) => {
      if (initializingSettingsModal) return;
      state.settings.displayMode = e.target.value;
      const compactInfoGroup = $("compactInfoGroup");
      if (compactInfoGroup) {
        compactInfoGroup.style.display = e.target.value === 'compact' ? '' : 'none';
      }
      saveSettings();
      renderLibrary();
    };
  }

  // Mangas per row select
  const mangasPerRowSelect = $("mangasPerRowSelect");
  if (mangasPerRowSelect) {
    mangasPerRowSelect.onchange = (e) => {
      if (initializingSettingsModal) return;
      state.settings.mangasPerRow = parseInt(e.target.value, 10);
      saveSettings();
      renderLibrary();
    };
  }

  // Show info in compact grid toggle
  const showCompactInfoToggle = $("showCompactInfoToggle");
  if (showCompactInfoToggle) {
    showCompactInfoToggle.onchange = (e) => {
      if (initializingSettingsModal) return;
      state.settings.showCompactInfo = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }

  $("modeSelect").onchange = (e) => {
    state.settings.readingMode = e.target.value;
    saveSettings();
    location.reload();
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


  // Overlay toggles (downloaded, unread, local)
  const overlayDownloaded = $("toggleOverlayDownloaded");
  if (overlayDownloaded) {
    overlayDownloaded.onchange = (e) => {
      if (!state.settings.overlays) state.settings.overlays = {};
      state.settings.overlays.downloaded = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }
  const overlayUnread = $("toggleOverlayUnread");
  if (overlayUnread) {
    overlayUnread.onchange = (e) => {
      if (!state.settings.overlays) state.settings.overlays = {};
      state.settings.overlays.unread = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }
  const overlayLocal = $("toggleOverlayLocal");
  if (overlayLocal) {
    overlayLocal.onchange = (e) => {
      if (!state.settings.overlays) state.settings.overlays = {};
      state.settings.overlays.local = e.target.checked;
      saveSettings();
      renderLibrary();
    };
  }

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

      // Atualizar todas as views principais
      if (typeof renderLibrary === 'function') renderLibrary();
      if (typeof renderCalendarView === 'function') renderCalendarView();
      // Atualiza Discover (home rows)
      if (typeof window.loadPopularToday === 'function') window.loadPopularToday();
      if (typeof window.loadRecentlyAdded === 'function') window.loadRecentlyAdded();
      if (typeof window.loadLatestUpdates === 'function') window.loadLatestUpdates();
      // Atualiza Search se estiver visível
      const searchView = document.querySelector('#view-search');
      if (searchView && !searchView.classList.contains('hidden') && typeof window.search === 'function') window.search(1);
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

  const uiThemeSelect = $("uiThemeSelect");
  if (uiThemeSelect) {
    uiThemeSelect.onchange = (e) => {
      const themeId = e.target.value;
      if (typeof setActiveTheme === 'function') {
        setActiveTheme(themeId);
      }
      if (typeof renderThemesView === 'function') {
        renderThemesView();
      }
      if (typeof renderShopView === 'function') {
        renderShopView();
      }
    };
  }

  const btnGoToThemeShop = $("btnGoToThemeShop");
  if (btnGoToThemeShop) {
    btnGoToThemeShop.onclick = () => {
      modal.remove();
      if (typeof setView === 'function') {
        setView('shop');
      }
    };
  }

  const hideLibraryStatusAndChaptersToggle = $("hideLibraryStatusAndChaptersToggle");
  if (hideLibraryStatusAndChaptersToggle) {
    hideLibraryStatusAndChaptersToggle.onchange = (e) => {
      state.settings.hideLibraryStatusAndChapters = e.target.checked;
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
  // ── Source Health Check + Error Log ─────────────────────────────────────────
  const btnRunSourceHealthCheck = $('btnRunSourceHealthCheck');
  if (btnRunSourceHealthCheck) {
    function formatRelativeTime(isoStr) {
      if (!isoStr) return '';
      const diff = Date.now() - new Date(isoStr).getTime();
      const mins  = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days  = Math.floor(diff / 86400000);
      if (mins  < 1)   return 'just now';
      if (mins  < 60)  return `${mins}m ago`;
      if (hours < 24)  return `${hours}h ago`;
      return `${days}d ago`;
    }

    async function loadErrorLog() {
      const wrap = $('errorLogResults');
      if (!wrap) return;
      try {
        const data = await fetch('/api/error-log').then(r => r.json());
        const entries = data.entries || [];
        if (!entries.length) {
          wrap.innerHTML = '<p class="setting-description" style="margin:8px 0">No errors recorded.</p>';
          return;
        }
        // Group by area
        const byArea = {};
        for (const e of entries) {
          const area = e.area || 'unknown';
          if (!byArea[area]) byArea[area] = [];
          byArea[area].push(e);
        }
        wrap.innerHTML = Object.entries(byArea).map(([area, errs]) => `
          <div style="margin-bottom:12px">
            <p style="font-weight:600;color:var(--color-text);margin:0 0 6px;font-size:0.9em;text-transform:uppercase;letter-spacing:0.05em">${escapeHtml(area)}</p>
            ${errs.map(e => `
              <div style="
                background:var(--color-surface-muted,var(--color-surface));
                border:1px solid var(--color-border);
                border-left:3px solid var(--color-danger);
                border-radius:6px;
                padding:8px 10px;
                margin-bottom:6px;
              ">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
                  <code style="font-size:0.78em;color:var(--color-text-muted);flex-shrink:0">${escapeHtml(e.code || '')}</code>
                  <span style="font-size:0.78em;color:var(--color-text-muted);white-space:nowrap">
                    ${escapeHtml(formatRelativeTime(e.lastSeenAt))}
                    ${e.count > 1 ? ` &nbsp;·&nbsp; <strong>${e.count}x</strong>` : ''}
                  </span>
                </div>
                <p style="margin:4px 0 0;font-size:0.85em;color:var(--color-text)">${escapeHtml(e.message || '')}</p>
                ${e.details?.error ? `<p style="margin:3px 0 0;font-size:0.8em;color:var(--color-text-muted);font-family:monospace">${escapeHtml(String(e.details.error))}</p>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('');
      } catch (err) {
        wrap.innerHTML = `<p class="setting-description" style="color:var(--color-danger);margin:8px 0">Failed to load error log: ${escapeHtml(err.message)}</p>`;
      }
    }

    async function runAndDisplaySourceHealthCheck() {
      const btn = btnRunSourceHealthCheck;
      const resultsWrap = $('sourceHealthResults');
      const list = $('sourceHealthList');
      if (!list || !resultsWrap) return;

      btn.disabled = true;
      btn.textContent = 'Checking…';
      resultsWrap.style.display = '';
      list.innerHTML = '<p class="setting-description" style="margin:8px 0">Running health check…</p>';

      // Load both health check and error log in parallel
      const [healthData] = await Promise.all([
        fetch('/api/sources/health-check').then(r => r.json()).catch(() => ({ results: [] })),
        loadErrorLog(),
      ]);

      try {
        const results = healthData.results || [];

        if (!results.length) {
          list.innerHTML = '<p class="setting-description" style="margin:8px 0">No sources installed.</p>';
          btn.disabled = false;
          btn.textContent = 'Run Check';
          return;
        }

        list.innerHTML = results.map(r => `
          <div class="source-health-row" style="
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid var(--color-border);
          ">
            <span style="
              font-size: 1.1em;
              color: ${r.ok ? 'var(--color-success)' : 'var(--color-danger)'};
              flex-shrink: 0;
              margin-top: 1px;
            ">${r.ok ? 'OK' : 'FAIL'}</span>
            <div style="flex:1;min-width:0">
              <span style="font-weight:600;color:var(--color-text)">${escapeHtml(r.name || r.id)}</span>
              <span style="color:var(--color-text-muted);font-size:0.82em;margin-left:6px">(${escapeHtml(r.id)})</span>
              ${r.ok && r.note ? `<p style="margin:3px 0 0;color:var(--color-text-muted);font-size:0.82em;font-style:italic">${escapeHtml(r.note)}</p>` : ''}
              ${!r.ok ? `<p style="margin:3px 0 0;color:var(--color-danger);font-size:0.85em">${escapeHtml(r.error || 'Unknown error')}</p>` : ''}
            </div>
          </div>
        `).join('');

        const passing = results.filter(r => r.ok).length;
        const failing = results.length - passing;
        const summary = document.createElement('p');
        summary.className = 'setting-description';
        summary.style.marginBottom = '8px';
        summary.innerHTML = `<strong>${passing}</strong> OK &nbsp;·&nbsp; <strong style="color:${failing ? 'var(--color-danger)' : 'inherit'}">${failing}</strong> failing`;
        list.prepend(summary);

      } catch (e) {
        list.innerHTML = `<p class="setting-description" style="color:var(--color-danger);margin:8px 0">Failed to run health check: ${escapeHtml(e.message)}</p>`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Run Check';
      }
    }

    btnRunSourceHealthCheck.onclick = runAndDisplaySourceHealthCheck;

    // Clear error log button
    const btnClearErrorLog = $('btnClearErrorLog');
    if (btnClearErrorLog) {
      btnClearErrorLog.onclick = async () => {
        if (!confirm('Clear all recorded errors?')) return;
        try {
          await fetch('/api/error-log', { method: 'DELETE' });
          showToast('Error log', 'All errors cleared.', 'info');
          loadErrorLog();
        } catch (e) {
          showToast('Error log', 'Failed to clear: ' + e.message, 'warning');
        }
      };
    }

    // Auto-run when opening the Advanced tab
    modal.querySelectorAll('.settings-nav-item').forEach(navBtn => {
      navBtn._origOnclick = navBtn.onclick;
      navBtn.onclick = function() {
        if (navBtn._origOnclick) navBtn._origOnclick.call(this);
        if (navBtn.dataset.tab === 'tab-advanced') runAndDisplaySourceHealthCheck();
      };
    });
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

window.showSettings = showSettings;

