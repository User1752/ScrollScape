// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings() {
  let initializingSettingsModal = true;
  const modal = document.createElement("div");
  modal.className = "settings-modal";

  // Closing this modal must not leave a dangling subscription behind —
  // there are several places below that call modal.remove() (the X
  // button, clicking the backdrop, a couple of post-save flows), so
  // patching remove() itself here guarantees cleanup fires no matter which
  // of those actually triggers the close, instead of having to remember to
  // unsubscribe at every call site individually.
  let _unsubscribeAnilistBadge = null;
  const _originalModalRemove = modal.remove.bind(modal);
  modal.remove = () => {
    if (_unsubscribeAnilistBadge) { _unsubscribeAnilistBadge(); _unsubscribeAnilistBadge = null; }
    _originalModalRemove();
  };
  
  const _origSave = window.saveSettings;
  const saveSettings = () => {
    if (_origSave) _origSave();
    const ind = document.getElementById('settingsSavedIndicator');
    if (ind) {
      ind.style.opacity = '1';
      if (ind._to) clearTimeout(ind._to);
      ind._to = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
    }
  };

  modal.innerHTML = buildSettingsModalHtml();
  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  // Finishes initialization once every handler above is wired up
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

  // Search filter logic
  const searchInput = $("settingsSearchInput");
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const cards = modal.querySelectorAll('.settings-section-card');
      let firstVisibleTabBtn = null;
      
      cards.forEach(card => {
        let cardHasMatch = false;
        const groups = card.querySelectorAll('.setting-group');
        groups.forEach(group => {
          if (!q || group.textContent.toLowerCase().includes(q)) {
            group.style.display = '';
            cardHasMatch = true;
          } else {
            group.style.display = 'none';
          }
        });
        
        // Check title and descriptions
        if (q && card.querySelector('.settings-section-title')?.textContent.toLowerCase().includes(q)) {
          groups.forEach(group => group.style.display = '');
          cardHasMatch = true;
        }

        // Always show title and reset button if there's a match, otherwise hide the whole card
        card.style.display = (!q || cardHasMatch) ? '' : 'none';
      });

      // Show/hide tabs in sidebar if they have visible cards
      modal.querySelectorAll('.settings-nav-item').forEach(navBtn => {
        const tabId = navBtn.dataset.tab;
        const tab = modal.querySelector('#' + tabId);
        if (tab) {
          const hasVisibleCards = Array.from(tab.querySelectorAll('.settings-section-card')).some(c => c.style.display !== 'none');
          navBtn.style.display = hasVisibleCards ? '' : 'none';
          if (hasVisibleCards && !firstVisibleTabBtn) firstVisibleTabBtn = navBtn;
        }
      });
      
      // If the currently active tab has no visible cards, switch to the first one that does
      const activeNav = modal.querySelector('.settings-nav-item.active');
      if (q && activeNav && activeNav.style.display === 'none' && firstVisibleTabBtn) {
        firstVisibleTabBtn.click();
      }
    };
  }

  // Reset Section Handlers
  modal.querySelectorAll('.reset-section-btn').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Reset these settings to their default values?')) return;
      const keys = btn.dataset.keys.split(',').map(k => k.trim());
      if (typeof window.resetSettingsSection === 'function') {
        window.resetSettingsSection(keys);
      }
      
      // Re-render settings modal smoothly by closing and reopening
      const curTab = modal.querySelector('.settings-nav-item.active')?.dataset?.tab;
      modal.remove();
      showSettings();
      if (curTab) {
        const nextTabBtn = document.querySelector(`.settings-nav-item[data-tab="${curTab}"]`);
        if (nextTabBtn) nextTabBtn.click();
      }
      
      // Update affected UI globally
      if (typeof renderLibrary === 'function') renderLibrary();
      if (typeof applyReaderBackground === 'function') applyReaderBackground();
      if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
      if (typeof applyHomeSearchVisibility === 'function') applyHomeSearchVisibility();
      if (typeof loadPopularToday === 'function') loadPopularToday();
      if (typeof loadRecentlyAdded === 'function') loadRecentlyAdded();
      if (typeof loadLatestUpdates === 'function') loadLatestUpdates();
      
      const ind = document.getElementById('settingsSavedIndicator');
      if (ind) {
        ind.style.opacity = '1';
        if (ind._to) clearTimeout(ind._to);
        ind._to = setTimeout(() => { ind.style.opacity = '0'; }, 2000);
      }
    };
  });

  const btnResetAll = $("btnResetAllSettings");
  if (btnResetAll) {
    btnResetAll.onclick = () => {
      if (!confirm('Are you sure you want to reset ALL settings to their default values? This cannot be undone.')) return;
      if (typeof window.resetSettingsSection === 'function' && typeof DEFAULT_SETTINGS !== 'undefined') {
        window.resetSettingsSection(Object.keys(DEFAULT_SETTINGS));
      } else {
        localStorage.removeItem("scrollscapeSettings");
        location.reload();
        return;
      }
      
      modal.remove();
      showSettings();
      const advancedTabBtn = document.querySelector(`.settings-nav-item[data-tab="tab-advanced"]`);
      if (advancedTabBtn) advancedTabBtn.click();
      
      if (typeof renderLibrary === 'function') renderLibrary();
      if (typeof applyReaderBackground === 'function') applyReaderBackground();
      if (typeof applyReaderNoiseSetting === 'function') applyReaderNoiseSetting();
    };
  }

  const accessPasswordStatusEl = $("accessPasswordStatus");
  if (accessPasswordStatusEl) {
    fetch('/api/auth/status').then(r => r.json()).then(status => {
      accessPasswordStatusEl.textContent = status.passwordSet
        ? 'A password is currently set.'
        : 'No password set — ScrollScape is fully open right now.';
      $("accessPasswordCurrentGroup").style.display = status.passwordSet ? '' : 'none';
    }).catch(() => {
      accessPasswordStatusEl.textContent = 'Could not check current status.';
    });
  }

  const btnSaveAccessPassword = $("btnSaveAccessPassword");
  if (btnSaveAccessPassword) {
    btnSaveAccessPassword.onclick = async () => {
      const newPassword = $("accessPasswordNewInput")?.value || '';
      const currentPassword = $("accessPasswordCurrentInput")?.value || '';
      btnSaveAccessPassword.disabled = true;
      try {
        const resp = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword, currentPassword }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Could not update the password.');
        showToast('Access Password', newPassword ? 'Password set.' : 'Password removed — ScrollScape is now open.', 'success');
        $("accessPasswordNewInput").value = '';
        $("accessPasswordCurrentInput").value = '';
        if (accessPasswordStatusEl) {
          accessPasswordStatusEl.textContent = data.passwordSet ? 'A password is currently set.' : 'No password set — ScrollScape is fully open right now.';
          $("accessPasswordCurrentGroup").style.display = data.passwordSet ? '' : 'none';
        }
      } catch (err) {
        showToast('Error', err.message || 'Could not update the password.', 'error');
      } finally {
        btnSaveAccessPassword.disabled = false;
      }
    };
  }

  const btnCopyOpdsUrl = $("btnCopyOpdsUrl");
  if (btnCopyOpdsUrl) {
    btnCopyOpdsUrl.onclick = async () => {
      const url = $("opdsCatalogUrl")?.value || '';
      try {
        await navigator.clipboard.writeText(url);
        showToast('OPDS', 'Catalog URL copied.', 'success');
      } catch (_) {
        showToast('OPDS', 'Could not copy — select and copy the URL manually.', 'warning');
      }
    };
  }

  const btnImportMihon = $("btnImportMihon");
  const importMihonFileInput = $("importMihonFileInput");
  if (btnImportMihon && importMihonFileInput) {
    btnImportMihon.onclick = () => importMihonFileInput.click();
    importMihonFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) importMihonBackupFile(file);
      importMihonFileInput.value = '';
    };
  }

  const btnExportBackup = $("btnExportBackup");
  if (btnExportBackup) btnExportBackup.onclick = () => exportBackup();

  const btnImportBackup = $("btnImportBackup");
  const importBackupFileInput = $("importBackupFileInput");
  if (btnImportBackup && importBackupFileInput) {
    btnImportBackup.onclick = () => importBackupFileInput.click();
    importBackupFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) importBackupFile(file);
      e.target.value = '';
    };
  }

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

  const showBetaSourcesToggle = $("showBetaSourcesToggle");
  if (showBetaSourcesToggle) {
    showBetaSourcesToggle.onchange = (e) => {
      state.settings.showBetaSources = e.target.checked;
      saveSettings();
      renderSourceSelect();
      if (typeof loadPopularToday === 'function') loadPopularToday();
      if (typeof loadRecentlyAdded === 'function') loadRecentlyAdded();
      if (typeof loadLatestUpdates === 'function') loadLatestUpdates();
    };
  }

  const fsInput = $("flaresolverrUrlInput");
  if (fsInput) {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.ok && data.data && data.data.flaresolverrUrl) {
        fsInput.value = data.data.flaresolverrUrl;
      }
    });
    fsInput.onchange = (e) => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flaresolverrUrl: e.target.value.trim() })
      });
      saveSettings(); // To trigger the saved indicator
    };
  }

  const cvInput = $("comicVineApiKeyInput");
  if (cvInput) {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.ok && data.data && data.data.comicVineApiKey) {
        cvInput.value = data.data.comicVineApiKey;
      }
    });
    cvInput.onchange = (e) => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comicVineApiKey: e.target.value.trim() })
      });
      saveSettings();
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
    if (state.currentChapter) { 
      if (typeof showReader === 'function') showReader();
      if (typeof renderPage === 'function') renderPage();
    }
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
  const ensureAutoScrollSpeedConfig = () => {
    const defaults = [0.2, 0.5, 1.0, 2.0, 3.5];
    const raw = Array.isArray(state.settings.autoScrollPointSpeeds)
      ? state.settings.autoScrollPointSpeeds
      : defaults;
    state.settings.autoScrollPointSpeeds = defaults.map((fallback, idx) => {
      const n = Number(raw[idx]);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(12, Math.max(0.05, n));
    });
  };
  ensureAutoScrollSpeedConfig();

  const bindAutoScrollPointSpeed = (point) => {
    const input = $(`autoScrollPointSpeed${point}`);
    const label = $(`autoScrollPointSpeed${point}Label`);
    if (!input || !label) return;
    const idx = point - 1;
    const current = Number(state.settings.autoScrollPointSpeeds[idx] ?? input.value);
    input.value = Number.isFinite(current) ? String(current) : String(input.value);
    label.textContent = `${Number(input.value).toFixed(2)} px/f`;
    input.oninput = (e) => {
      const value = Math.min(12, Math.max(0.05, Number(e.target.value) || 0.05));
      state.settings.autoScrollPointSpeeds[idx] = value;
      label.textContent = `${value.toFixed(2)} px/f`;
      saveSettings();
      if (state.autoScroll?.enabled && Number(state.autoScroll.speed) === point) {
        if (typeof stopAutoScroll === 'function') stopAutoScroll();
        if (typeof startAutoScroll === 'function') startAutoScroll();
      }
    };
  };
  bindAutoScrollPointSpeed(1);
  bindAutoScrollPointSpeed(2);
  bindAutoScrollPointSpeed(3);
  bindAutoScrollPointSpeed(4);
  bindAutoScrollPointSpeed(5);

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

  const showBookSpineToggle = $('showBookSpineToggle');
  if (showBookSpineToggle) {
    showBookSpineToggle.onchange = (e) => {
      state.settings.showBookSpine = e.target.checked;
      saveSettings();
      if (state.currentChapter) { showReader(); renderPage(); }
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

  const bookshelfToggle = $("libraryBookshelf3dToggle");
  if (bookshelfToggle) {
    bookshelfToggle.addEventListener("change", (e) => {
      state.settings.libraryBookshelf3d = e.target.checked;
      saveSettings();
      if (typeof window.renderLibrary === "function") window.renderLibrary();
    });
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
        _pushProgressionToServer({ resetAll: true });
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

  const genreBlacklistInput = $('genreBlacklistInput');
  if (genreBlacklistInput) {
    genreBlacklistInput.onchange = (e) => {
      const val = e.target.value || '';
      const list = val.split(/[,|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      state.settings.genreBlacklist = list;
      saveSettings();
      if (typeof applyAdvancedSearchNsfwVisibility === 'function') {
        applyAdvancedSearchNsfwVisibility();
      }
    };
  }

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

  const btnSyncLibraryStatus = $("btnSyncLibraryStatus");
  if (btnSyncLibraryStatus) {
    btnSyncLibraryStatus.onclick = async () => {
      const resSpan = $("syncLibraryStatusResult");
      btnSyncLibraryStatus.disabled = true;
      btnSyncLibraryStatus.textContent = "Syncing...";
      if (resSpan) resSpan.textContent = "";

      try {
        const response = await fetch("/api/library/sync-status", { method: "POST" });
        const data = await response.json();
        
        if (data.ok) {
          if (resSpan) resSpan.textContent = `Updated ${data.updated} mangas.`;
          showToast("Sync Complete", `Updated status for ${data.updated} mangas.`, "success");
          if (data.updated > 0) {
            renderLibrary(); // Re-render to show updated badges if any
          }
        } else {
          if (resSpan) resSpan.textContent = "Sync failed.";
          showToast("Sync Failed", data.error || "Unknown error occurred.", "error");
        }
      } catch (err) {
        if (resSpan) resSpan.textContent = "Error.";
        showToast("Sync Error", err.message, "error");
      } finally {
        btnSyncLibraryStatus.disabled = false;
        btnSyncLibraryStatus.textContent = "Sync Library Status";
      }
    };
  }

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
  const alImportCategorySelect = $('anilistImportCategorySelect');
  if (alImportCategorySelect) {
    alImportCategorySelect.onchange = (e) => {
      state.settings.anilistImportCategoryId = e.target.value;
      saveSettings();
    };
  }
  const alKeepCoverToggle = $('anilistKeepCoverToggle');
  if (alKeepCoverToggle) {
    alKeepCoverToggle.onchange = (e) => {
      state.settings.anilistKeepCover = e.target.checked;
      saveSettings();
    };
  }
  const btnNewAlImportCategory = $('btnNewAnilistImportCategory');
  if (btnNewAlImportCategory) {
    btnNewAlImportCategory.onclick = () => {
      showListFormModal(null, async () => {
        await _listsReload();
        const newList = state.customLists[state.customLists.length - 1];
        if (newList) {
          state.settings.anilistImportCategoryId = newList.id;
          saveSettings();
        }
        showSettings();
        const trackingTabBtn = document.querySelector('.settings-nav-item[data-tab="tab-tracking"]');
        if (trackingTabBtn) trackingTabBtn.click();
      });
    };
  }
  const btnImportNow = $('btnAniListImportNow');
  if (btnImportNow) {
    const progressWrap = $('anilistImportProgressWrap');
    const progressFill = $('anilistImportProgressFill');
    const progressText = $('anilistImportProgressText');
    const setProgress = (pct, txt) => {
      if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
      if (progressText && txt) progressText.textContent = txt;
    };

    // Subscribed unconditionally (not just after clicking "Start Import")
    // so that reopening Settings while an import kicked off from an
    // earlier, since-closed modal is still running shows real progress
    // instead of a blank/default button — the import itself was never
    // tied to this modal's lifetime in the first place (see
    // anilist.js's shared progress channel).
    _unsubscribeAnilistBadge = anilistSubscribeImportProgress(({ percent, label, running }) => {
      if (running) {
        btnImportNow.disabled = true;
        btnImportNow.textContent = 'Importing...';
        if (progressWrap) progressWrap.classList.remove('hidden');
        setProgress(percent, label || 'Importing…');
      } else {
        btnImportNow.disabled = false;
        btnImportNow.textContent = '↓ Import Library Now';
      }
    });
    if (typeof anilistGetImportState === 'function') {
      const importState = anilistGetImportState();
      if (importState.running) {
        btnImportNow.disabled = true;
        btnImportNow.textContent = 'Importing...';
        if (progressWrap) progressWrap.classList.remove('hidden');
        setProgress(importState.percent, importState.label || 'Importing…');
      }
    }

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

        // Button/progress-bar state from here on is driven entirely by the
        // anilistSubscribeImportProgress() subscription set up above (it
        // fires for every report() call inside anilistImportLibrary
        // regardless of which modal instance is open, or none at all) —
        // no separate onProgress callback needed here.
        setProgress(0, 'Starting AniList import…');

        try {
          const r = await anilistImportLibrary({ statuses: selectedStatuses, keepCover: state.settings.anilistKeepCover });

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
          if (!r?.ok) {
            showToast('AniList Import', `Import stopped: ${r?.error || 'unable to complete'}`, 'warning');
          }
        } catch (err) {
          showToast('AniList Import', err?.message || 'Import failed.', 'error');
        }
      };
    };
  }
}

window.showSettings = showSettings;

