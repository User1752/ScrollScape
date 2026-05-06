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
      <div class="settings-body">
        <div class="setting-group">
          <label>Reading Mode</label>
          <select id="modeSelect" class="input">
            <option value="ltr"     ${state.settings.readingMode === "ltr"     ? "selected" : ""}>Left to Right</option>
            <option value="rtl"     ${state.settings.readingMode === "rtl"     ? "selected" : ""}>Right to Left (Manga)</option>
            <option value="webtoon" ${state.settings.readingMode === "webtoon" ? "selected" : ""}>Webtoon (Vertical Scroll)</option>
          </select>
        </div>
        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Advanced Settings</h3>
        <div class="setting-group">
          <label>Line Sharpness</label>
          <select id="sharpnessSelect" class="input">
            <option value="0" ${(state.settings.lineSharpness||0) === 0 ? 'selected' : ''}>Off</option>
            <option value="1" ${(state.settings.lineSharpness||0) === 1 ? 'selected' : ''}>Subtle</option>
            <option value="2" ${(state.settings.lineSharpness||0) === 2 ? 'selected' : ''}>Strong</option>
            <option value="3" ${(state.settings.lineSharpness||0) === 3 ? 'selected' : ''}>Max</option>
          </select>
          <p class="setting-description">Increases contrast to make manga lines crisper</p>
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
        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Pan wide images</span>
            <input type="checkbox" id="panWideToggle" ${state.settings.panWideImages ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Allows horizontal scrolling on double-page spreads</p>
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
          <label>Library default status view</label>
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
        <div class="settings-divider"></div>
        <div class="setting-group">
          <button class="btn secondary" id="clearReadBtn">Clear Reading History</button>
        </div>
        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Tracking</h3>
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
            <p class="setting-description">Automatically adds completed manga to a &ldquo;Read&rdquo; category when importing</p>
          </div>
          <div class="setting-group" style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" id="btnAniListImportNow">&#8595; Import Library Now</button>
            <button class="btn secondary" id="btnAniListDisconnect">Disconnect AniList</button>
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
        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Commands</h3>
        <div class="setting-group">
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="cheatInput" class="input" placeholder="Enter command…" autocomplete="off" autocorrect="off" spellcheck="false" style="flex:1;font-family:monospace">
            <button class="btn primary" id="cheatRunBtn">Run</button>
          </div>
          <p class="setting-description" style="margin-top:6px">Available: <code>cls</code> — reset all AP &amp; achievements &nbsp;·&nbsp; <code>godmode</code> — add 500 AP &nbsp;·&nbsp; <code>lcls</code> — clear library</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  $("modeSelect").onchange = (e) => {
    state.settings.readingMode = e.target.value;
    saveSettings();
    if (state.currentChapter) { showReader(); renderPage(); }
  };
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
  };
  const sourceBadgeToggle = $("showLibrarySourceToggle");
  if (sourceBadgeToggle) {
    sourceBadgeToggle.onchange = (e) => {
      state.settings.showLibrarySourceBadge = e.target.checked;
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
        btnImportNow.textContent = '⏳ Importing…';
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

