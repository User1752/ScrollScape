// ============================================================================
// INITIALIZATION
// ============================================================================

(async function main() {
  initTheme();
  applyTranslations();
  loadSettings();
  console.log('[ScrollScape] Settings loaded:', JSON.stringify(state.settings));
  var activeCustom = getActiveCustom();
  var activeTheme = getActiveTheme();
  if (activeCustom && activeTheme !== 'default') {
    localStorage.setItem('scrollscape_active_theme', 'default');
    activeTheme = 'default';
  }
  applyTheme(activeTheme);
  applyCustomization(activeCustom);

  // Handle AniList OAuth redirect (token arrives in the URL hash after login)
  await anilistHandleCallback();

  // Configure PDF.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  
  // Load achievements from JSON
  try {
    await achievementManager.loadAchievements();
  } catch (err) {
    dbg.error(dbg.ERR_ACHIEVE, 'Failed to load achievements', err);
  }

  // Wire up navigation and open the initial route *before* refreshState(),
  // which fans out network calls to every installed source (some, like a
  // Cloudflare-protected source under load, can take several seconds). Each
  // view already fetches/renders its own data independently, so there's no
  // need to make the whole app wait on refreshState() before nav works.
  bindUI();
  if (typeof routerRestoreInitialRoute === 'function') routerRestoreInitialRoute();

  // Initialize Feather icons for static HTML
  if (typeof feather !== 'undefined') {
    feather.replace();
  }

  await refreshState();

  // Reconcile chapter progress with AniList at startup in background.
  // If AniList has higher progress, local read state is advanced to match.
  anilistStartupReconcileProgress().catch((e) => {
    dbg.warn(dbg.ERR_ANILIST, 'Startup progress reconcile failed', e);
  });

  // Check achievements on startup based on existing data
  await checkAndUnlockAchievements();
})();
