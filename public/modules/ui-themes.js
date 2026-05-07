// ============================================================================
// THEME SHOP — definitions & AP helpers
// ============================================================================

const _BASE_THEMES = [
  { id: 'default', name: 'Default', desc: 'Classic purple theme', cost: 0, primary: '#913FE2', primaryDark: '#6F2598', primaryLight: '#A855F7', preview: 'linear-gradient(135deg,#913FE2,#A855F7)' },
];
// Merge any community themes registered in themes.js (loaded before this file)
const SHOP_THEMES = [..._BASE_THEMES, ...(window.COMMUNITY_THEMES || [])];

function getSpentAP()   { return parseInt(localStorage.getItem('scrollscape_ap_spent')  || '0', 10); }
function getBonusAP()   { return parseInt(localStorage.getItem('scrollscape_ap_bonus')  || '0', 10); }
function addBonusAP(n)  { localStorage.setItem('scrollscape_ap_bonus', getBonusAP() + n); }
function spendAP(n)     { localStorage.setItem('scrollscape_ap_spent', Math.max(0, getSpentAP() + n)); }
function getAvailableAP() { return Math.max(0, achievementManager.unlockedAchievements.size + getBonusAP() - getSpentAP()); }

function getPurchasedThemes() {
  try { return JSON.parse(localStorage.getItem('scrollscape_purchased_themes') || '["default"]'); }
  catch { return ['default']; }
}
function addPurchasedTheme(id) {
  const p = getPurchasedThemes();
  if (!p.includes(id)) { p.push(id); localStorage.setItem('scrollscape_purchased_themes', JSON.stringify(p)); }
}
function getActiveTheme() { return localStorage.getItem('scrollscape_active_theme') || 'default'; }
function setActiveTheme(id) {
  localStorage.setItem('scrollscape_active_theme', id);
  applyTheme(id);

  // Activating a base/community theme must clear custom overlay/theme tweaks.
  if (typeof window.setActiveCustom === 'function') window.setActiveCustom(null);
  if (typeof window.applyCustomization === 'function') window.applyCustomization(null);
}
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
  const badge = document.getElementById('sidebarApBadge');
  if (badge) badge.textContent = `${ap} AP`;
  const achEl  = document.getElementById('achPageApBalance');
  const shopEl = document.getElementById('shopApBalance');
  if (achEl)  achEl.textContent  = ap;
  if (shopEl) shopEl.textContent = ap;
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

