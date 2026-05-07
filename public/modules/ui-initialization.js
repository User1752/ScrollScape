// ============================================================================
// INITIALIZATION
// ============================================================================

(async function main() {
  initTheme();
  applyTranslations();
  loadSettings();
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
  
  await refreshState();
  bindUI();
  
  // Initialize Feather icons for static HTML
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
  
  // Check achievements on startup based on existing data
  await checkAndUnlockAchievements();
})();
