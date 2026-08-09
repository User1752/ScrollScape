// ============================================================================
// THEME SHOP — definitions & AP helpers
// ============================================================================

const _BASE_THEMES = [
  { id: 'default', name: 'Default', desc: 'Classic purple theme', cost: 0, primary: '#913FE2', primaryDark: '#6F2598', primaryLight: '#A855F7', preview: 'linear-gradient(135deg,#913FE2,#A855F7)' },
];
// Merge any community themes registered in themes.js (loaded before this file)
const SHOP_THEMES = [..._BASE_THEMES, ...(window.COMMUNITY_THEMES || [])];

// Fire-and-forget push to the server-side wallet/theme store (see
// server/modules/achievements/service.js's updateProgression) — keeps the
// server copy in sync with every local mutation so AP/themes survive a
// cleared browser profile the same way the library/history already do.
function _pushProgressionToServer(patch) {
  fetch('/api/achievements/progression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

function getSpentAP()   { return parseInt(localStorage.getItem('scrollscape_ap_spent')  || '0', 10); }
function getBonusAP()   { return parseInt(localStorage.getItem('scrollscape_ap_bonus')  || '0', 10); }
function addBonusAP(n)  {
  const next = getBonusAP() + n;
  localStorage.setItem('scrollscape_ap_bonus', next);
  _pushProgressionToServer({ apBonus: next });
}
function spendAP(n)     {
  const next = Math.max(0, getSpentAP() + n);
  localStorage.setItem('scrollscape_ap_spent', next);
  _pushProgressionToServer({ apSpent: next });
}
function getAvailableAP() { return Math.max(0, achievementManager.unlockedAchievements.size + getBonusAP() - getSpentAP()); }

function getPurchasedThemes() {
  try { return JSON.parse(localStorage.getItem('scrollscape_purchased_themes') || '["default"]'); }
  catch { return ['default']; }
}
function addPurchasedTheme(id) {
  const p = getPurchasedThemes();
  if (!p.includes(id)) {
    p.push(id);
    localStorage.setItem('scrollscape_purchased_themes', JSON.stringify(p));
    _pushProgressionToServer({ purchasedThemes: p });
  }
}
function getActiveTheme() { return localStorage.getItem('scrollscape_active_theme') || 'default'; }
function setActiveTheme(id) {
  localStorage.setItem('scrollscape_active_theme', id);
  _pushProgressionToServer({ activeTheme: id });
  applyTheme(id);

  // Activating a base/community theme must clear custom overlay/theme tweaks.
  if (typeof window.setActiveCustom === 'function') window.setActiveCustom(null);
  if (typeof window.applyCustomization === 'function') window.applyCustomization(null);
}

// Called once at startup (see ui-state.js's refreshState()) to reconcile
// localStorage against the server-side copy. Merges rather than overwrites
// in either direction — a "richer side wins" union — so neither a cleared
// browser profile nor a stale/fresh server store file can regress progress;
// whichever side has less simply catches up to whichever has more.
async function syncProgressionWithServer() {
  let server;
  try {
    const res = await fetch('/api/achievements');
    server = res.ok ? await res.json() : null;
  } catch (_) {
    server = null;
  }
  if (!server) return;

  const serverAchievements = Array.isArray(server.achievements) ? server.achievements : [];
  let achievementsChanged = false;
  for (const id of serverAchievements) {
    if (!achievementManager.unlockedAchievements.has(id)) {
      achievementManager.unlockedAchievements.add(id);
      achievementsChanged = true;
    }
  }
  if (achievementsChanged) {
    achievementManager.achievementPoints = Array.from(achievementManager.unlockedAchievements)
      .reduce((sum, id) => sum + (achievementManager.getAchievement(id)?.points || 0), 0);
    achievementManager.saveToStorage();
  }
  // Push any unlock the server doesn't have yet (e.g. a prior POST that
  // failed while offline) back up to it.
  for (const id of achievementManager.unlockedAchievements) {
    if (!serverAchievements.includes(id)) {
      fetch('/api/achievements/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievementId: id }),
      }).catch(() => {});
    }
  }

  const serverAp = server.ap || { bonus: 0, spent: 0 };
  const mergedBonus = Math.max(getBonusAP(), Number(serverAp.bonus) || 0);
  const mergedSpent = Math.max(getSpentAP(), Number(serverAp.spent) || 0);
  const apChanged = mergedBonus !== getBonusAP() || mergedSpent !== getSpentAP();
  localStorage.setItem('scrollscape_ap_bonus', mergedBonus);
  localStorage.setItem('scrollscape_ap_spent', mergedSpent);

  const serverThemes = Array.isArray(server.purchasedThemes) ? server.purchasedThemes : ['default'];
  const localThemes = getPurchasedThemes();
  const mergedThemes = Array.from(new Set([...localThemes, ...serverThemes]));
  const themesChanged = mergedThemes.length !== localThemes.length;
  localStorage.setItem('scrollscape_purchased_themes', JSON.stringify(mergedThemes));

  // Active theme has no "merge" concept (single value, not a set/counter) —
  // keep the local choice if one was ever made, otherwise adopt the
  // server's so a wiped profile at least restores the last known theme.
  const hasLocalActive = localStorage.getItem('scrollscape_active_theme') !== null;
  const resolvedActiveTheme = hasLocalActive ? getActiveTheme() : (server.activeTheme || 'default');
  if (!hasLocalActive) localStorage.setItem('scrollscape_active_theme', resolvedActiveTheme);

  if (apChanged || themesChanged || achievementsChanged || !hasLocalActive) {
    _pushProgressionToServer({
      apBonus: mergedBonus,
      apSpent: mergedSpent,
      purchasedThemes: mergedThemes,
      activeTheme: resolvedActiveTheme,
    });
  }

  if (typeof updateApBadge === 'function') updateApBadge();
  applyTheme(resolvedActiveTheme);
}
window.syncProgressionWithServer = syncProgressionWithServer;
function applyTheme(id) {
  // Call onRemove for the previously active community theme
  const prevId = document.documentElement.getAttribute('data-color-theme') || '';
  if (prevId && prevId !== id) {
    const prev = (window.COMMUNITY_THEMES || []).find(t => t.id === prevId);
    if (prev?.onRemove) prev.onRemove();
  }
  const t = SHOP_THEMES.find(x => x.id === id) || SHOP_THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary',       t.primary);
  root.style.setProperty('--primary-dark',  t.primaryDark);
  root.style.setProperty('--primary-light', t.primaryLight);
  root.setAttribute('data-color-theme', id === 'default' ? '' : id);
  // Call onApply for the newly activated community theme
  const next = (window.COMMUNITY_THEMES || []).find(t => t.id === id);
  if (next?.onApply) next.onApply();
}
function updateApBadge() {
  const ap = getAvailableAP();
  
  // Update sidebar badge (always present)
  const badge = document.getElementById('sidebarApBadge');
  if (badge) badge.textContent = `${ap} AP`;
  
  // Update achievements page balance
  const achEl = document.getElementById('achPageApBalance');
  if (achEl) achEl.textContent = ap;
  
  // Update shop page balance
  const shopEl = document.getElementById('shopApBalance');
  if (shopEl) shopEl.textContent = ap;
  
  // Update any other AP displays in the current view
  document.querySelectorAll('[data-ap-balance]').forEach(el => {
    el.textContent = ap;
  });
}

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// Loaded dynamically from data/achievements.json via AchievementManager
// Legacy hardcoded achievements kept for backwards compatibility
// ============================================================================

const ACHIEVEMENTS = [
  { id: 'first_read',     icon: 'book-open', label: 'First Steps',       desc: 'Read your first chapter',           check: (a) => a.totalChaptersRead >= 1 },
  { id: 'reader_10',      icon: 'book',       label: 'Bookworm',           desc: 'Read 10 chapters',                  check: (a) => a.totalChaptersRead >= 10 },
  { id: 'reader_100',     icon: 'award',      label: 'Manga Addict',        desc: 'Read 100 chapters',                 check: (a) => a.totalChaptersRead >= 100 },
  { id: 'reader_500',     icon: 'star',       label: 'Legend',              desc: 'Read 500 chapters',                 check: (a) => a.totalChaptersRead >= 500 },
  { id: 'first_fav',      icon: 'heart', label: 'Collector',           desc: 'Add your first manga to library',   check: (a) => a.totalFavorites >= 1 },
  { id: 'fav_10',         icon: 'package', label: 'Hoarder',             desc: 'Have 10 manga in your library',     check: (a) => a.totalFavorites >= 10 },
  { id: 'completed_1',    icon: 'check-circle', label: 'Completionist',       desc: 'Mark your first manga as completed',check: (a) => a.completedCount >= 1 },
  { id: 'completed_5',    icon: 'award', label: 'Veteran Reader',      desc: 'Complete 5 manga',                  check: (a) => a.completedCount >= 5 },
  { id: 'list_maker',     icon: 'clipboard', label: 'Organizer',           desc: 'Create a custom list',              check: (a) => a.totalLists >= 1 },
  { id: 'night_owl',      icon: 'moon', label: 'Night Owl',           desc: 'Spend 1 hour reading total',        check: (a) => (a.totalTimeSpent || 0) >= 60 },
  { id: 'marathon',       icon: 'activity', label: 'Marathon Reader',     desc: 'Spend 5 hours reading total',       check: (a) => (a.totalTimeSpent || 0) >= 300 },
];

