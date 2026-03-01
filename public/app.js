// ============================================================================
// API HELPER
// ============================================================================

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ============================================================================
// INTERNATIONALIZATION (i18n)
// ============================================================================

const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.search": "Advanced Search",
    "nav.library": "Library",
    "nav.analytics": "Analytics",
    "nav.settings": "Settings",
    
    // Home
    "home.title": "Discover & Read Manga",
    "home.subtitle": "Access thousands of manga titles from multiple sources, track your reading progress, and enjoy a seamless reading experience — all in one place.",
    "home.tag": "Your Ultimate Manga Destination",
    "home.sources": "Sources",
    "home.search": "Search Manga",
    "home.searchPlaceholder": "Enter manga title...",
    "home.searchBtn": "Search",
    
    // Features
    "features.search.title": "Advanced Search",
    "features.search.desc": "Find exactly what you're looking for with powerful filters and sorting options",
    "features.reader.title": "Smart Reader",
    "features.reader.desc": "Enhanced reading experience with multiple modes, auto-scroll, and zoom controls",
    "features.track.title": "Track Progress",
    "features.track.desc": "Keep track of what you've read with analytics and achievements",
    "features.sources.title": "Multiple Sources",
    "features.sources.desc": "Access manga from MangaDex, MangaNato, Asura Scans, and more in one app",
    
    // Search & Filters
    "search.filters": "Filters",
    "search.genres": "Genres",
    "search.status": "Status",
    "search.sortBy": "Sort By",
    "search.relevance": "Relevance",
    "search.rating": "Rating",
    "search.alphabetical": "Alphabetical",
    "search.recent": "Recent",
    
    // Manga Details
    "manga.addToLibrary": "Add to Library",
    "manga.inLibrary": "In Library",
    "manga.status": "Status",
    "manga.author": "Author",
    "manga.artist": "Artist",
    "manga.genres": "Genres",
    "manga.description": "Description",
    "manga.chapters": "Chapters",
    "manga.readingStatus": "Reading Status",
    
    // Chapters
    "chapters.available": "Available",
    "chapters.unread": "Unread",
    "chapters.checkIntegrity": "Check Integrity",
    "chapters.bulkDownload": "Bulk Download",
    "chapters.download": "Download",
    "chapters.read": "Read",
    
    // Library
    "library.title": "My Library",
    "library.all": "All",
    "library.reading": "Reading",
    "library.completed": "Completed",
    "library.planToRead": "Plan to Read",
    "library.onHold": "On Hold",
    "library.dropped": "Dropped",
    
    // Reader
    "reader.close": "Close",
    "reader.previous": "Previous",
    "reader.next": "Next",
    "reader.zoomIn": "Zoom In",
    "reader.zoomOut": "Zoom Out",
    "reader.autoScroll": "Auto Scroll",
    "reader.settings": "Settings",
    
    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.readingMode": "Reading Mode",
    "settings.ltr": "Left to Right",
    "settings.rtl": "Right to Left",
    "settings.webtoon": "Webtoon",
    
    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.yes": "Yes",
    "common.no": "No"
  },
  pt: {
    // Navigation
    "nav.home": "Início",
    "nav.search": "Pesquisa Avançada",
    "nav.library": "Biblioteca",
    "nav.analytics": "Estatísticas",
    "nav.settings": "Configurações",
    
    // Home  
    "home.title": "Descubra & Leia Mangá",
    "home.subtitle": "Acesse milhares de títulos de mangá de várias fontes, acompanhe seu progresso de leitura e desfrute de uma experiência perfeita — tudo em um só lugar.",
    "home.tag": "Seu Destino Definitivo de Mangá",
    "home.sources": "Fontes",
    "home.search": "Pesquisar Mangá",
    "home.searchPlaceholder": "Digite o título do mangá...",
    "home.searchBtn": "Pesquisar",
    
    // Features
    "features.search.title": "Pesquisa Avançada",
    "features.search.desc": "Encontre exatamente o que procura com filtros poderosos e opções de ordenação",
    "features.reader.title": "Leitor Inteligente",
    "features.reader.desc": "Experiência de leitura aprimorada com múltiplos modos, rolagem automática e controles de zoom",
    "features.track.title": "Acompanhe o Progresso",
    "features.track.desc": "Mantenha o controle do que você leu com estatísticas, conquistas e listas personalizadas",
    "features.sources.title": "Múltiplas Fontes",
    "features.sources.desc": "Acesse mangá do MangaDex, MangaNato, Asura Scans e muito mais em um só app",
    
    // Search & Filters
    "search.filters": "Filtros",
    "search.genres": "Gêneros",
    "search.status": "Status",
    "search.sortBy": "Ordenar Por",
    "search.relevance": "Relevância",
    "search.rating": "Avaliação",
    "search.alphabetical": "Alfabética",
    "search.recent": "Recentes",
    
    // Manga Details
    "manga.addToLibrary": "Adicionar à Biblioteca",
    "manga.inLibrary": "Na Biblioteca",
    "manga.status": "Status",
    "manga.author": "Autor",
    "manga.artist": "Artista",
    "manga.genres": "Gêneros",
    "manga.description": "Descrição",
    "manga.chapters": "Capítulos",
    "manga.readingStatus": "Status de Leitura",
    
    // Chapters
    "chapters.available": "Disponíveis",
    "chapters.unread": "Não Lidos",
    "chapters.checkIntegrity": "Verificar Integridade",
    "chapters.bulkDownload": "Download em Massa",
    "chapters.download": "Baixar",
    "chapters.read": "Ler",
    
    // Library
    "library.title": "Minha Biblioteca",
    "library.all": "Todos",
    "library.reading": "Lendo",
    "library.completed": "Completos",
    "library.planToRead": "Quero Ler",
    "library.onHold": "Em Espera",
    "library.dropped": "Abandonados",
    
    // Reader
    "reader.close": "Fechar",
    "reader.previous": "Anterior",
    "reader.next": "Próximo",
    "reader.zoomIn": "Aumentar Zoom",
    "reader.zoomOut": "Diminuir Zoom",
    "reader.autoScroll": "Rolagem Automática",
    "reader.settings": "Configurações",
    
    // Settings
    "settings.title": "Configurações",
    "settings.language": "Idioma",
    "settings.theme": "Tema",
    "settings.readingMode": "Modo de Leitura",
    "settings.ltr": "Esquerda para Direita",
    "settings.rtl": "Direita para Esquerda",
    "settings.webtoon": "Webtoon",
    
    // Common
    "common.loading": "Carregando...",
    "common.error": "Erro",
    "common.cancel": "Cancelar",
    "common.save": "Salvar",
    "common.delete": "Excluir",
    "common.close": "Fechar",
    "common.confirm": "Confirmar",
    "common.yes": "Sim",
    "common.no": "Não"
  }
};

let currentLanguage = localStorage.getItem('language') || 'en';

function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    // Reload UI with new language
    location.reload();
  }
}

function applyTranslations() {
  // Apply text content translations
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  
  // Apply placeholder translations
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  
  // Apply title translations
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
}

// ============================================================================
// APPLICATION STATE
// ============================================================================

const state = {
  repos: [],
  availableSources: [],
  installedSources: {},
  currentSourceId: null,
  currentManga: null,
  currentChapter: null,
  currentChapterIndex: 0,
  currentPageIndex: 0,
  favorites: [],
  history: [],
  readChapters: new Set(),
  flaggedChapters: new Set(),
  allChapters: [],
  chaptersReversed: false,
  selectedGenres: new Set(),
  selectedStatuses: new Set(),
  sortBy: "relevance",
  settings: {
    language: "en",
    readingMode: "ltr",
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false,
    lineSharpness: 0
  },

  // --- New feature state ---
  readingStatus: {},        // { "mangaId:sourceId": { status, updatedAt, manga } }
  analytics: {},
  earnedAchievements: new Set(),

  // Reader zoom (1.0 = 100%)
  zoomLevel: 1.0,
  readerSessionStart: null, // ms timestamp when chapter opened

  // AutoScroll
  autoScroll: { enabled: false, speed: 2 },

  advancedFilters: {
    orderBy: "relevance",
    statuses: new Set(),
    tags: new Set()
  },

  // Pagination state
  searchPage: 1,
  searchQuery: "",
  searchHasNextPage: false,
  advSearchPage: 1,
  advSearchHasNextPage: false,

  // Local manga
  localManga: [],
  pdfDocument: null,

  // User ratings cache: mangaId -> 1-10 score
  ratings: {}
};

// ============================================================================
// NAVIGATION MANAGER
// Manages navigation stack with context preservation
// ============================================================================

class NavigationManager {
  constructor(maxStackSize = 50) {
    this.maxStackSize = maxStackSize;
    this.stack = [];
    this.currentView = null;
    this.currentContext = {};
    this.storageKey = 'manghu_nav_stack';
    this.loadFromStorage();
  }

  /**
   * Navigate to a new view
   * @param {string} view - View name
   * @param {object} context - Optional context data
   * @param {boolean} replace - Replace current entry instead of pushing new one
   */
  navigateTo(view, context = {}, replace = false) {
    // Save current view to stack before navigating (unless replacing)
    if (this.currentView && !replace) {
      this.stack.push({
        view: this.currentView,
        context: { ...this.currentContext },
        timestamp: Date.now()
      });

      // Limit stack size
      if (this.stack.length > this.maxStackSize) {
        this.stack.shift();
      }
    } else if (replace && this.stack.length > 0) {
      // Replace the last entry in the stack
      this.stack[this.stack.length - 1] = {
        view: this.currentView,
        context: { ...this.currentContext },
        timestamp: Date.now()
      };
    }

    // Set new current view
    this.currentView = view;
    this.currentContext = context;
    this.saveToStorage();
  }

  /**
   * Go back to previous view
   * @returns {object|null} Previous view entry or null if stack is empty
   */
  goBack() {
    if (this.stack.length === 0) {
      // No history, return to discover
      return { view: 'discover', context: {} };
    }

    const previous = this.stack.pop();
    this.currentView = previous.view;
    this.currentContext = previous.context;
    this.saveToStorage();
    return previous;
  }

  /**
   * Check if we can go back
   * @returns {boolean}
   */
  canGoBack() {
    return this.stack.length > 0;
  }

  /**
   * Get the previous view without modifying the stack
   * @returns {object|null}
   */
  peekPrevious() {
    if (this.stack.length === 0) return null;
    return { ...this.stack[this.stack.length - 1] };
  }

  /**
   * Clear the entire navigation stack
   */
  clear() {
    this.stack = [];
    this.currentView = null;
    this.currentContext = {};
    this.saveToStorage();
  }

  /**
   * Get the full navigation history
   * @returns {array}
   */
  getHistory() {
    return [...this.stack];
  }

  /**
   * Save stack to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        stack: this.stack,
        currentView: this.currentView,
        currentContext: this.currentContext
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save navigation stack:', err);
    }
  }

  /**
   * Load stack from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.stack = data.stack || [];
        this.currentView = data.currentView || null;
        this.currentContext = data.currentContext || {};
      }
    } catch (err) {
      console.warn('Failed to load navigation stack:', err);
      this.stack = [];
      this.currentView = null;
      this.currentContext = {};
    }
  }

  /**
   * Get current context
   * @returns {object}
   */
  getContext() {
    return { ...this.currentContext };
  }

  /**
   * Update current context
   * @param {object} updates - Context updates
   */
  updateContext(updates) {
    this.currentContext = { ...this.currentContext, ...updates };
    this.saveToStorage();
  }
}

// Create global navigation manager instance
const navigationManager = new NavigationManager();

// Create global achievement manager instance
const achievementManager = new AchievementManager();

// ============================================================================
// THEME SHOP — definitions & AP helpers
// ============================================================================

const SHOP_THEMES = [
  { id: 'default',     name: 'Default',        desc: 'Classic purple theme',            cost: 0,  primary: '#913FE2', primaryDark: '#6F2598', primaryLight: '#A855F7', preview: 'linear-gradient(135deg,#913FE2,#A855F7)' },
  { id: 'dragonball',  name: 'Dragon Ball',    desc: "Power up with Goku's energy",     cost: 5,  primary: '#FF6B00', primaryDark: '#CC4400', primaryLight: '#FFB800', preview: 'linear-gradient(135deg,#FF6B00,#FFB800)' },
  { id: 'naruto',      name: 'Naruto',         desc: 'Believe it! Run like a ninja',     cost: 5,  primary: '#F96E0A', primaryDark: '#bf4e00', primaryLight: '#FFB347', preview: 'linear-gradient(135deg,#F96E0A,#FFB347)' },
  { id: 'onepiece',    name: 'One Piece',      desc: 'Set sail for adventure',           cost: 5,  primary: '#C0392B', primaryDark: '#922B21', primaryLight: '#E74C3C', preview: 'linear-gradient(135deg,#C0392B,#E74C3C)' },
  { id: 'demonslayer', name: 'Demon Slayer',   desc: 'Total concentration breathing',    cost: 8,  primary: '#C53030', primaryDark: '#7B1FA2', primaryLight: '#E57373', preview: 'linear-gradient(135deg,#C53030,#7B1FA2)' },
  { id: 'aot',         name: 'Attack on Titan',desc: 'On that day, humanity remembered…',cost: 8,  primary: '#2E6B5E', primaryDark: '#1A4A40', primaryLight: '#4DB6AC', preview: 'linear-gradient(135deg,#2E6B5E,#4DB6AC)' },
  { id: 'jjk',         name: 'Jujutsu Kaisen', desc: 'Hollow Purple',                    cost: 10, primary: '#6B21A8', primaryDark: '#1A237E', primaryLight: '#A78BFA', preview: 'linear-gradient(135deg,#1A237E,#A78BFA)' },
  { id: 'bleach',      name: 'Bleach',         desc: 'Bankai',                           cost: 10, primary: '#00B4B4', primaryDark: '#007878', primaryLight: '#4DEEEE', preview: 'linear-gradient(135deg,#007878,#4DEEEE)' },
];

function getSpentAP()   { return parseInt(localStorage.getItem('manghu_ap_spent')  || '0', 10); }
function getBonusAP()   { return parseInt(localStorage.getItem('manghu_ap_bonus')  || '0', 10); }
function addBonusAP(n)  { localStorage.setItem('manghu_ap_bonus', getBonusAP() + n); }
function spendAP(n)     { localStorage.setItem('manghu_ap_spent', Math.max(0, getSpentAP() + n)); }
function getAvailableAP() { return Math.max(0, achievementManager.unlockedAchievements.size + getBonusAP() - getSpentAP()); }

function getPurchasedThemes() {
  try { return JSON.parse(localStorage.getItem('manghu_purchased_themes') || '["default"]'); }
  catch { return ['default']; }
}
function addPurchasedTheme(id) {
  const p = getPurchasedThemes();
  if (!p.includes(id)) { p.push(id); localStorage.setItem('manghu_purchased_themes', JSON.stringify(p)); }
}
function getActiveTheme() { return localStorage.getItem('manghu_active_theme') || 'default'; }
function setActiveTheme(id) { localStorage.setItem('manghu_active_theme', id); applyTheme(id); }
function applyTheme(id) {
  const t = SHOP_THEMES.find(x => x.id === id) || SHOP_THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary',       t.primary);
  root.style.setProperty('--primary-dark',  t.primaryDark);
  root.style.setProperty('--primary-light', t.primaryLight);
  root.setAttribute('data-color-theme', id === 'default' ? '' : id);
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
  { id: 'first_read',     icon: '📖', label: 'First Steps',       desc: 'Read your first chapter',           check: (a) => a.totalChaptersRead >= 1 },
  { id: 'reader_10',      icon: '📚', label: 'Bookworm',           desc: 'Read 10 chapters',                  check: (a) => a.totalChaptersRead >= 10 },
  { id: 'reader_100',     icon: '🏆', label: 'Manga Addict',        desc: 'Read 100 chapters',                 check: (a) => a.totalChaptersRead >= 100 },
  { id: 'reader_500',     icon: '⭐', label: 'Legend',              desc: 'Read 500 chapters',                 check: (a) => a.totalChaptersRead >= 500 },
  { id: 'first_fav',      icon: '❤️', label: 'Collector',           desc: 'Add your first manga to library',   check: (a) => a.totalFavorites >= 1 },
  { id: 'fav_10',         icon: '📦', label: 'Hoarder',             desc: 'Have 10 manga in your library',     check: (a) => a.totalFavorites >= 10 },
  { id: 'completed_1',    icon: '✅', label: 'Completionist',       desc: 'Mark your first manga as completed',check: (a) => a.completedCount >= 1 },
  { id: 'completed_5',    icon: '🎖️', label: 'Veteran Reader',      desc: 'Complete 5 manga',                  check: (a) => a.completedCount >= 5 },
  { id: 'list_maker',     icon: '📋', label: 'Organizer',           desc: 'Create a custom list',              check: (a) => a.totalLists >= 1 },
  { id: 'night_owl',      icon: '🦉', label: 'Night Owl',           desc: 'Spend 1 hour reading total',        check: (a) => (a.totalTimeSpent || 0) >= 60 },
  { id: 'marathon',       icon: '🏃', label: 'Marathon Reader',     desc: 'Spend 5 hours reading total',       check: (a) => (a.totalTimeSpent || 0) >= 300 },
];

// ============================================================================
// UTILITIES
// ============================================================================

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function statusLabel(status) {
  const map = {
    reading: 'Reading',
    completed: 'Completed',
    on_hold: 'On Hold',
    plan_to_read: 'Plan to Read',
    dropped: 'Dropped'
  };
  return map[status] || status;
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
  const saved = localStorage.getItem("manghuTheme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeToggleIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("manghuTheme", next);
  updateThemeToggleIcon(next);
}

function updateThemeToggleIcon(theme) {
  const moonIcon = document.querySelector(".icon-moon");
  const sunIcon  = document.querySelector(".icon-sun");
  if (!moonIcon || !sunIcon) return;
  if (theme === "dark") {
    moonIcon.style.display = "block";
    sunIcon.style.display  = "none";
  } else {
    moonIcon.style.display = "none";
    sunIcon.style.display  = "block";
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(title, message = "", type = "default") {
  const container = $("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ""}
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem("manghuSettings");
    if (saved) state.settings = { ...state.settings, ...JSON.parse(saved) };

    const readChaps = localStorage.getItem("manghuReadChapters");
    if (readChaps) state.readChapters = new Set(JSON.parse(readChaps));

    const flaggedChaps = localStorage.getItem("manghuFlaggedChapters");
    if (flaggedChaps) state.flaggedChapters = new Set(JSON.parse(flaggedChaps));

    const progress = localStorage.getItem("manghuReadingProgress");
    if (progress) {
      const p = JSON.parse(progress);
      state.lastReadPages = p.pages || {};
      state.lastReadChapter = p.chapters || {};
    } else {
      state.lastReadPages = {};
      state.lastReadChapter = {};
    }
  } catch (e) {
    console.warn("Failed to load settings:", e);
    state.lastReadPages = {};
    state.lastReadChapter = {};
  }
}

function saveSettings() {
  localStorage.setItem("manghuSettings", JSON.stringify(state.settings));
  localStorage.setItem("manghuReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("manghuFlaggedChapters", JSON.stringify([...state.flaggedChapters]));
  localStorage.setItem("manghuReadingProgress", JSON.stringify({
    pages: state.lastReadPages,
    chapters: state.lastReadChapter
  }));
}

function markChapterAsRead(mangaId, chapterId) {
  state.readChapters.add(`${mangaId}:${chapterId}`);
  saveSettings();
}

function unmarkChapterAsRead(mangaId, chapterId) {
  state.readChapters.delete(`${mangaId}:${chapterId}`);
  saveSettings();
}

function isChapterRead(mangaId, chapterId) {
  return state.readChapters.has(`${mangaId}:${chapterId}`);
}

function toggleFlagChapter(mangaId, chapterId) {
  const key = `${mangaId}:${chapterId}`;
  if (state.flaggedChapters.has(key)) state.flaggedChapters.delete(key);
  else state.flaggedChapters.add(key);
  saveSettings();
}

function showChapterContextMenu(e, chapterId, mangaId) {
  // Remove any existing context menu
  document.querySelectorAll(".chapter-ctx-menu").forEach(m => m.remove());

  const isRead    = isChapterRead(mangaId, chapterId);
  const isFlagged = state.flaggedChapters.has(`${mangaId}:${chapterId}`);

  const menu = document.createElement("div");
  menu.className = "context-menu chapter-ctx-menu";
  menu.innerHTML = `
    <button class="context-item" id="ctxMarkRead">
      ${isRead
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Mark as Unread'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Mark as Read'}
    </button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxFlag">
      🚩 ${isFlagged ? 'Remove Flag' : 'Add Flag'}
    </button>
  `;

  // Position near cursor
  document.body.appendChild(menu);
  const { clientX: x, clientY: y } = e;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = (x + mw > window.innerWidth  ? window.innerWidth  - mw - 8 : x) + "px";
  menu.style.top  = (y + mh > window.innerHeight ? window.innerHeight - mh - 8 : y) + "px";

  // Actions
  menu.querySelector("#ctxMarkRead").onclick = () => {
    if (isRead) unmarkChapterAsRead(mangaId, chapterId);
    else        markChapterAsRead(mangaId, chapterId);
    menu.remove();
    loadChapters();
  };
  menu.querySelector("#ctxFlag").onclick = () => {
    toggleFlagChapter(mangaId, chapterId);
    menu.remove();
    loadChapters();
  };

  // Dismiss on click outside
  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", dismiss, true); }
  };
  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}

function updateReadingProgress(mangaId, chapterId, pageIndex) {
  if (!mangaId || !chapterId) return;
  state.lastReadPages[`${mangaId}:${chapterId}`] = pageIndex;
  state.lastReadChapter[mangaId] = chapterId;
  saveSettings();
}

// ============================================================================
// STATE & RENDERING
// ============================================================================

async function refreshState() {
  try {
    const data = await api("/api/state");
    state.installedSources = data.installedSources || {};

    const [libData, statusData] = await Promise.all([
      api("/api/library"),
      api("/api/user/status")
    ]);

    state.favorites     = libData.favorites || [];
    state.history       = libData.history   || [];
    state.readingStatus = statusData.readingStatus || {};

    try {
      const localData = await api("/api/local/list");
      state.localManga = localData.localManga || [];
      // Generate covers for any PDF manga that still has a .pdf cover
      generateMissingPDFCovers();
    } catch (_) { state.localManga = []; }

    try {
      const ratingsData = await api("/api/ratings");
      state.ratings = ratingsData.ratings || {};
    } catch (_) { state.ratings = {}; }

    renderSourceSelect();
    await Promise.all([
      loadAllTimePopular(),
      loadPopularToday(),
      loadRecentlyAdded(),
      loadLatestUpdates()
    ]);
    await updateStats();
    renderLibrary();

    // Trigger recommendations if there's any reading history or library content
    if (state.favorites.length > 0 || state.history.length > 0) loadRecommendations();
  } catch (e) {
    console.error("Failed to load state:", e);
  }
}

function renderSourceSelect() {
  const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
  const installed = Object.values(state.installedSources);

  for (const sel of selectors) {
    if (!sel) continue;
    sel.innerHTML = "";
    if (installed.length === 0) {
      sel.innerHTML = `<option value="">(Install a source first)</option>`;
      continue;
    }
    for (const s of installed) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    }
    if (!state.currentSourceId || !state.installedSources[state.currentSourceId]) {
      state.currentSourceId = installed[0].id;
    }
    sel.value = state.currentSourceId;
    sel.dispatchEvent(new Event('change', { bubbles: false }));
    sel.onchange = () => { 
      state.currentSourceId = sel.value;
      if (state.currentView === 'advanced-search') {
        advancedSearch();
      } else {
        // Reload homepage content when source changes
        loadPopularToday();
        loadRecentlyAdded();
        loadLatestUpdates();
      }
    };
  }
}

// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

async function loadAllTimePopular() {
  const row = $("allTimePopularRow");
  if (!row) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api("/api/popular-all");
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.map(m => {
      const genres = (m.genres || []).slice(0, 2);
      const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
      return `
        <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
          <div class="manga-card-cover">
            ${m.cover && !m.cover.endsWith('.pdf')
              ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
              : `<div class="no-cover">?</div>`}
            ${m.sourceName ? `<span class="all-pop-source-badge">${escapeHtml(m.sourceName)}</span>` : ""}
          </div>
          <div class="manga-card-info">
            <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
            <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
            ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
            <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
          </div>
        </div>`;
    }).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading all-time popular:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/trending`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.slice(0, 10).map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading popular manga:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/recentlyAdded`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading recently added:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadLatestUpdates() {
  const row = $("latestUpdatesRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/latestUpdates`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = result.results || [];
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    console.error("Error loading latest updates:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

function mangaCardHTML(m) {
  const genres = (m.genres || []).slice(0, 3);
  const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
      <div class="manga-card-cover">
        ${m.cover && !m.cover.endsWith('.pdf')
          ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          : (m.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
      </div>
    </div>
  `;
}

async function startReading(mangaId) {
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  await loadMangaDetails(mangaId);
  if (!state.allChapters?.length) { showToast("No chapters found", "", "info"); return; }
  // Chapters are sorted newest-first; last index = chapter 1
  const firstIdx = state.allChapters.length - 1;
  const ch = state.allChapters[firstIdx];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
}

async function continueReading(mangaId, sourceId) {
  if (!mangaId) return;
  // Switch source if needed
  if (sourceId && state.installedSources[sourceId] && sourceId !== state.currentSourceId) {
    state.currentSourceId = sourceId;
    renderSourceSelect();
  }
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }

  const lastChapterId = state.lastReadChapter?.[mangaId];
  if (!lastChapterId) {
    // No progress yet — fall back to start reading
    await startReading(mangaId);
    return;
  }

  const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
  try {
    showToast("Resuming...", "", "info");
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.allChapters = cr.chapters || [];
    const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
    if (idx >= 0) {
      const ch = state.allChapters[idx];
      await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
    } else {
      await loadMangaDetails(mangaId);
    }
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

// ============================================================================
// HISTORY VIEW
// ============================================================================

function renderHistoryView() {
  const container = $("historyList");
  if (!container) return;
  const history = state.history || [];
  if (!history.length) {
    container.innerHTML = `<div class="muted" style="text-align:center;padding:3rem 0">No reading history yet.</div>`;
    return;
  }
  container.innerHTML = history.map(m => {
    const genres = (m.genres || []).slice(0, 3);
    const date   = m.readAt ? new Date(m.readAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "";
    return `
      <div class="history-item" data-manga-id="${escapeHtml(m.id)}" data-source-id="${escapeHtml(m.sourceId || "")}">
        <div class="history-cover">
          ${m.cover && !m.cover.endsWith('.pdf') ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async">` : (m.cover ? `<div class="no-cover">&#128196;</div>` : `<div class="no-cover">?</div>`)}
        </div>
        <div class="history-info">
          <h3 class="history-title">${escapeHtml(m.title)}</h3>
          ${m.author ? `<p class="history-author">✍️ ${escapeHtml(m.author)}</p>` : ""}
          ${genres.length ? `<div class="history-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
          ${date ? `<p class="history-date">🕐 ${date}</p>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn history-view-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">View Details</button>
          <button class="btn btn-start-reading-detail history-read-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">${state.lastReadChapter?.[m.id] ? '&#9654; Continue Reading' : '&#9654; Start Reading'}</button>
          <button class="history-delete-btn" title="Remove from history" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">[x]</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".history-view-btn").forEach(btn => {
    btn.onclick = () => {
      const sid = btn.dataset.sid;
      if (sid && state.installedSources[sid]) {
        state.currentSourceId = sid;
        renderSourceSelect();
      }
      loadMangaDetails(btn.dataset.mid);
    };
  });
  container.querySelectorAll(".history-read-btn").forEach(btn => {
    btn.onclick = () => continueReading(btn.dataset.mid, btn.dataset.sid);
  });
  container.querySelectorAll(".history-delete-btn").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api("/api/history/remove", {
          method: "POST",
          body: JSON.stringify({ mangaId: btn.dataset.mid, sourceId: btn.dataset.sid })
        });
        state.history = state.history.filter(m => !(m.id === btn.dataset.mid && m.sourceId === (btn.dataset.sid || m.sourceId)));
        renderHistoryView();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });
}

function renderMangaGrid(container, mangaList) {
  container.innerHTML = mangaList.map(m => mangaCardHTML(m)).join("");
  bindMangaCards(container);
}

function bindMangaCards(container) {
  container.querySelectorAll("[data-manga-id]").forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.sourceId;
      if (sid && sid !== state.currentSourceId && state.installedSources[sid]) {
        state.currentSourceId = sid;
        const sel = $("sourceSelect");
        if (sel) sel.value = sid;
      }
      loadMangaDetails(el.dataset.mangaId);
    };
  });
}

// ============================================================================
// RECOMMENDATIONS
// Based on genres of manga in user's library
// ============================================================================

async function loadRecommendations() {
  const section = $("recommendedSection");
  const row     = $("recommendedRow");
  if (!section || !row) return;

  const installedSourceIds = Object.keys(state.installedSources);
  if (installedSourceIds.length === 0) return;

  // Build genre profile from history (weighted 2x) + favorites (weighted 1x)
  const genreScore = new Map();
  const addGenres = (manga, weight) => {
    for (const g of (manga.genres || [])) {
      const key = g.toLowerCase();
      genreScore.set(key, (genreScore.get(key) || 0) + weight);
    }
  };
  for (const m of (state.history  || [])) addGenres(m, 2);
  for (const m of (state.favorites || [])) addGenres(m, 1);

  if (genreScore.size === 0) return;

  // Top 3 genres — these drive both the API query and the label
  const topGenres = [...genreScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g.charAt(0).toUpperCase() + g.slice(1));

  const topGenresLower = topGenres.map(g => g.toLowerCase());

  const libraryIds = new Set([
    ...state.favorites.map(m => m.id),
    ...state.history.map(m => m.id)
  ]);

  // Score a result by how many label genres it matches (used for sources that return genres)
  const genreMatchScore = m => {
    const mg = (m.genres || []).map(g => g.toLowerCase());
    return mg.length === 0
      ? 1 // source doesn't return genres (MangaPill) — treat as neutral match
      : topGenresLower.filter(g => mg.includes(g)).length;
  };

  // Fetch from every installed source in parallel using exactly the label genres
  const perSource = await Promise.all(
    installedSourceIds.map(async sid => {
      try {
        const result = await api(`/api/source/${sid}/byGenres`, {
          method: "POST",
          body: JSON.stringify({ genres: topGenres })
        });
        return (result.results || [])
          .filter(m => !libraryIds.has(m.id))
          .map(m => ({ ...m, sourceId: sid, _score: genreMatchScore(m) }))
          // Sort within each source: best genre match first
          .sort((a, b) => b._score - a._score);
      } catch (_) {
        return [];
      }
    })
  );

  // Interleave results from all sources for diversity, then deduplicate by normalised title
  const interleaved = [];
  const maxLen = Math.max(...perSource.map(a => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of perSource) {
      if (i < arr.length) interleaved.push(arr[i]);
    }
  }
  const seenTitles = new Set();
  const list = interleaved.filter(m => {
    const key = m.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  }).slice(0, 24);

  if (!list.length) return;
  section.style.display = "block";

  // Label: show top 3 genres with their relative consumption weight
  const labelEl = section.querySelector(".recommended-genres-label");
  if (labelEl) {
    const total = [...genreScore.values()].reduce((a, b) => a + b, 0) || 1;
    const labelGenres = topGenres.map(g => {
      const pct = Math.round((genreScore.get(g.toLowerCase()) || 0) / total * 100);
      return pct >= 5 ? `${g} (${pct}%)` : g;
    });
    labelEl.textContent = `Based on: ${labelGenres.join(", ")}`;
  }

  row.innerHTML = list.map(m => mangaCardHTML(m)).join("");
  bindMangaCards(row);
  initRowAutoScroll(row);
}

// ============================================================================
// ROW AUTO-SCROLL + DRAG
// ============================================================================

function initRowAutoScroll(row) {
  if (row._autoScrollId) cancelAnimationFrame(row._autoScrollId);

  const SPEED = 0.4; // px per frame
  let pos = 0;

  row.style.scrollSnapType = "none";

  function tick() {
    if (!row._dragging) {
      pos += SPEED;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0) { row._autoScrollId = requestAnimationFrame(tick); return; }
      if (pos >= max) pos = 0;
      row.scrollLeft = pos;
    } else {
      pos = row.scrollLeft;
    }
    row._autoScrollId = requestAnimationFrame(tick);
  }
  row._autoScrollId = requestAnimationFrame(tick);

  initRowDrag(row);
}

function initRowDrag(row) {
  if (row._dragInit) return;
  row._dragInit = true;

  let startX    = 0;
  let startLeft = 0;
  let hasMoved  = false;

  row.style.cursor = "grab";

  row.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    startX    = e.clientX;
    startLeft = row.scrollLeft;
    hasMoved  = false;
    row.style.cursor = "grabbing";
  }, { passive: true });

  row.addEventListener("pointermove", e => {
    if (e.buttons !== 1) return;
    const dx = e.clientX - startX;
    if (!hasMoved && Math.abs(dx) < 5) return; // threshold: ignore tiny jitter
    hasMoved = true;
    row._dragging = true;
    row.scrollLeft = startLeft - dx;
  }, { passive: true });

  const stopDrag = () => { row._dragging = false; row.style.cursor = "grab"; };
  row.addEventListener("pointerup",     stopDrag);
  row.addEventListener("pointercancel", () => { hasMoved = false; stopDrag(); });

  // Block click from opening manga only if user actually dragged (not just clicked)
  row.addEventListener("click", e => {
    if (hasMoved) {
      e.stopPropagation();
      hasMoved = false;
    }
  }, true); // capture phase — fires before card onclick
}

// ============================================================================
// STATISTICS
// ============================================================================

async function updateStats() {
  try {
    const anaData = await api("/api/analytics");
    state.analytics = anaData;

    const totalLibrary = state.favorites.length;
    const completedCount = anaData.statusDistribution?.completed || 0;
    const chaptersRead = anaData.analytics?.totalChaptersRead || state.readChapters.size;
    const streak = anaData.analytics?.dailyStreak || 0;

    const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
    el("statTotalLibrary", totalLibrary);
    el("statCompleted", completedCount);
    el("statChaptersRead", chaptersRead);
    el("statReadingStreak", streak);
    if ($("libraryCount")) $("libraryCount").textContent = `${totalLibrary} manga`;
  } catch (e) {
    // Non-fatal
  }
}

// ============================================================================
// LIBRARY RENDERING
// ============================================================================

function renderLibrary() {
  const grid = $("library"); // Fixed: was "library-grid", correct ID is "library"
  if (!grid) return;

  const filterVal = $("libraryStatusFilter")?.value || "all";
  const favs = state.favorites.filter(manga => {
    if (filterVal === "all") return true;
    const key = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    return status === filterVal;
  });

  const totalCount = favs.length + (filterVal === "all" ? state.localManga.length : 0);
  if ($("libraryCount")) {
    $("libraryCount").textContent = `${totalCount} manga`;
  }

  const favHTML = favs.map(manga => {
    const key    = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    const statusBadge = status
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    const currentRating = state.ratings[manga.id] || 0;
    const lastChapterId = state.lastReadChapter?.[manga.id];
    const btnLabel = lastChapterId ? "Continue Reading" : "Start Reading";
    return `
      <div class="library-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || state.currentSourceId)}">
        <div class="library-card-cover">
          ${manga.cover && !manga.cover.endsWith('.pdf') ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">` : (manga.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
          ${statusBadge}
          <div class="library-card-overlay">
            <button class="btn-read">${btnLabel}</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${status ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : ""}
          ${currentRating ? `<span class="card-score-badge">${currentRating}<span class="card-score-badge-max">/10</span></span>` : ""}
        </div>
      </div>`;
  }).join("");

  // Local manga section
  const localHTML = (filterVal === "all" && state.localManga.length > 0)
    ? `<div class="local-section-header">&#128193; Local Manga</div>` +
      state.localManga.map(manga => {
        const localRating = state.ratings[manga.id] || 0;
        return `
        <div class="library-card local-manga-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="local">
          <div class="library-card-cover">
            ${manga.cover && !manga.cover.endsWith('.pdf') ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy" decoding="async">` : '<div class="no-cover">&#128196;</div>'}
            <div class="local-badge">${escapeHtml((manga.type || 'local').toUpperCase())}</div>
            <button class="local-delete-btn" data-manga-id="${escapeHtml(manga.id)}" title="Delete local manga">&#128465;</button>
            <div class="library-card-overlay"><button class="btn-read">Read</button></div>
          </div>
          <div class="library-card-info">
            <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
            <p class="library-card-author">${escapeHtml((manga.type || 'local').toUpperCase())}</p>
            ${localRating ? `<span class="card-score-badge">${localRating}<span class="card-score-badge-max">/10</span></span>` : ""}
          </div>
        </div>`;
      }).join("")
    : "";

  if (favs.length === 0 && !localHTML) {
    grid.innerHTML = `<div class="muted">No manga found. Add favorites or import local files!</div>`;
    return;
  }

  grid.innerHTML = favHTML + localHTML;

  grid.querySelectorAll(".library-card:not(.local-manga-card)").forEach(card => {
    const mangaId  = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    card.onclick = async (e) => {
      const prevSource = state.currentSourceId;
      if (sourceId && sourceId !== state.currentSourceId) {
        state.currentSourceId = sourceId;
        renderSourceSelect();
        const srcName = state.installedSources[sourceId]?.name || sourceId;
        showToast("Source switched", srcName, "info");
      }

      // "Continue Reading" overlay button — jump directly to last chapter + page
      if (e.target.closest(".btn-read") && state.lastReadChapter?.[mangaId]) {
        const lastChapterId = state.lastReadChapter[mangaId];
        const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
        try {
          showToast("Resuming...", "", "info");
          // Load manga details silently so state.currentManga is populated
          const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.currentManga = result;
          // Load chapters so state.allChapters is populated
          const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
            method: "POST",
            body: JSON.stringify({ mangaId })
          });
          state.allChapters = cr.chapters || [];
          const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
          if (idx >= 0) {
            const ch = state.allChapters[idx];
            await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
          } else {
            // Chapter no longer exists — fall back to detail page
            await loadMangaDetails(mangaId, "library");
          }
        } catch (err) {
          showToast("Error", err.message, "error");
        }
        return;
      }

      await loadMangaDetails(mangaId, "library");
      if (!state.currentSourceId) state.currentSourceId = prevSource;
    };
  });

  grid.querySelectorAll(".local-manga-card").forEach(card => {
    const mangaId = card.dataset.mangaId;
    card.onclick = async (e) => {
      if (e.target.closest(".local-delete-btn")) return;
      state.currentSourceId = "local";
      await loadMangaDetails(mangaId, "library");
    };
  });

  grid.querySelectorAll(".local-delete-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const mangaId = btn.dataset.mangaId;
      if (!confirm("Delete this local manga?")) return;
      await deleteLocalManga(mangaId);
    };
  });
}

async function loadLocalManga() {
  try {
    const data = await api("/api/local/list");
    state.localManga = data.localManga || [];
  } catch (_) { state.localManga = []; }
}

async function deleteLocalManga(mangaId) {
  try {
    await api(`/api/local/${mangaId}`, { method: "DELETE" });
    state.localManga = state.localManga.filter(m => m.id !== mangaId);
    renderLibrary();
    showToast("Deleted", "Local manga removed", "info");
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

// ============================================================================
// LOCAL MANGA IMPORT MODAL
// ============================================================================
let _importFile = null;

function showImportModal() {
  _importFile = null;
  if ($("importTitleInput"))  $("importTitleInput").value  = "";
  if ($("importFileName"))   { $("importFileName").textContent = ""; $("importFileName").classList.add("hidden"); }
  if ($("importProgress"))   $("importProgress").classList.add("hidden");
  if ($("importError"))      { $("importError").textContent = ""; $("importError").classList.add("hidden"); }
  if ($("importSubmitBtn"))  $("importSubmitBtn").disabled = true;
  if ($("importFileInput"))  $("importFileInput").value = "";
  $("importLocalModal").classList.remove("hidden");

  // Drag and drop
  const zone = $("importDropZone");
  if (zone && !zone._ddBound) {
    zone._ddBound = true;
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drop-active"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop-active"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("drop-active");
      const file = e.dataTransfer.files[0];
      if (file) setImportFile(file);
    });
  }
}

function closeImportModal() {
  $("importLocalModal").classList.add("hidden");
  _importFile = null;
}

function onImportFileSelected(event) {
  const file = event.target.files[0];
  if (file) setImportFile(file);
}

function setImportFile(file) {
  const allowed = ['.cbz', '.cbr', '.pdf'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    if ($("importError")) { $("importError").textContent = "Unsupported format. Use CBZ, CBR or PDF."; $("importError").classList.remove("hidden"); }
    return;
  }
  _importFile = file;
  if ($("importFileName"))  { $("importFileName").textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`; $("importFileName").classList.remove("hidden"); }
  if ($("importError"))     $("importError").classList.add("hidden");
  if ($("importSubmitBtn")) $("importSubmitBtn").disabled = false;
  // Pre-fill title from filename if empty
  const titleInput = $("importTitleInput");
  if (titleInput && !titleInput.value) {
    titleInput.value = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[_\-]+/g, ' ');
  }
}

async function submitImport() {
  if (!_importFile) return;
  const title = $("importTitleInput")?.value?.trim() || "";
  const submitBtn = $("importSubmitBtn");
  const progressEl = $("importProgress");
  const errorEl   = $("importError");
  const fillEl    = $("importProgressFill");
  const labelEl   = $("importProgressLabel");

  if (submitBtn) submitBtn.disabled = true;
  if (errorEl)  { errorEl.textContent = ""; errorEl.classList.add("hidden"); }
  if (progressEl) progressEl.classList.remove("hidden");
  if (fillEl)   fillEl.style.width = "10%";
  if (labelEl)  labelEl.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("file", _importFile);
    if (title) formData.append("title", title);

    // Simulate progress while uploading
    let pct = 10;
    const progTimer = setInterval(() => {
      pct = Math.min(pct + 5, 85);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (labelEl) labelEl.textContent = pct < 50 ? "Uploading..." : "Extracting...";
    }, 400);

    const resp = await fetch("/api/local/import", { method: "POST", body: formData });
    clearInterval(progTimer);

    if (fillEl)   fillEl.style.width = "100%";
    if (labelEl)  labelEl.textContent = "Done!";

    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || "Import failed");

    state.localManga.push(data.manga);

    // For PDFs, render page 1 via PDF.js and upload as cover image
    if (_importFile.name.toLowerCase().endsWith('.pdf') && window.pdfjsLib && data.manga?.id) {
      try {
        if (labelEl) labelEl.textContent = "Generating cover...";
        const fileUrl = URL.createObjectURL(_importFile);
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        URL.revokeObjectURL(fileUrl);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
        if (blob) {
          const coverResp = await fetch(`/api/local/${data.manga.id}/cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          });
          if (coverResp.ok) {
            const coverData = await coverResp.json();
            data.manga.cover = coverData.cover;
            const idx = state.localManga.findIndex(m => m.id === data.manga.id);
            if (idx !== -1) state.localManga[idx].cover = coverData.cover;
          }
        }
      } catch (coverErr) {
        console.warn('Cover generation failed:', coverErr);
      }
    }

    showToast("Imported!", data.manga.title, "success");
    setTimeout(() => {
      closeImportModal();
      renderLibrary();
    }, 600);
  } catch (e) {
    if (progressEl) progressEl.classList.add("hidden");
    if (errorEl)    { errorEl.textContent = e.message; errorEl.classList.remove("hidden"); }
    if (submitBtn)  submitBtn.disabled = false;
  }
}

async function generateMissingPDFCovers() {
  if (!window.pdfjsLib) return;
  const pending = state.localManga.filter(m => m.cover && m.cover.endsWith('.pdf'));
  for (const manga of pending) {
    try {
      const pdf = await pdfjsLib.getDocument(manga.cover).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) continue;
      const resp = await fetch(`/api/local/${manga.id}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob
      });
      if (resp.ok) {
        const data = await resp.json();
        manga.cover = data.cover;
      }
    } catch (e) {
      console.warn(`Cover generation failed for ${manga.id}:`, e);
    }
  }
  if (pending.length > 0) renderLibrary();
}

// ============================================================================
// READING STATUS
// ============================================================================

async function loadReadingStatus() {
  try {
    const data = await api("/api/user/status");
    state.readingStatus = data.readingStatus || {};
  } catch (e) { /* non-fatal */ }
}

function getMangaStatus(mangaId, sourceId) {
  return state.readingStatus[`${mangaId}:${sourceId}`]?.status || null;
}

function renderReadingStatusSection(mangaId, sourceId) {
  const section = $("readingStatusSection");
  if (!section) return;
  const current = getMangaStatus(mangaId, sourceId);
  section.innerHTML = `
    <div class="status-selector-section">
      <span class="status-selector-label">Reading Status:</span>
      <select class="status-select" id="mangaStatusSelect">
        <option value="none" ${!current ? "selected" : ""}>— Not Set —</option>
        <option value="reading"      ${current === "reading"       ? "selected" : ""}>Reading</option>
        <option value="completed"    ${current === "completed"     ? "selected" : ""}>Completed</option>
        <option value="on_hold"      ${current === "on_hold"       ? "selected" : ""}>On Hold</option>
        <option value="plan_to_read" ${current === "plan_to_read"  ? "selected" : ""}>Plan to Read</option>
        <option value="dropped"      ${current === "dropped"       ? "selected" : ""}>Dropped</option>
      </select>
      ${current ? `<span class="status-badge status-badge-${current}">${statusLabel(current)}</span>` : ""}
    </div>
  `;
  $("mangaStatusSelect").onchange = async (e) => {
    const newStatus = e.target.value;
    try {
      await api("/api/user/status", {
        method: "POST",
        body: JSON.stringify({
          mangaId, sourceId, status: newStatus,
          mangaData: state.currentManga || {}
        })
      });
      state.readingStatus[`${mangaId}:${sourceId}`] = newStatus !== "none"
        ? { status: newStatus, updatedAt: new Date().toISOString() }
        : undefined;
      if (newStatus === "none") delete state.readingStatus[`${mangaId}:${sourceId}`];
      showToast("Status Updated", statusLabel(newStatus), "success");
      renderReadingStatusSection(mangaId, sourceId);
      renderLibrary();
      await checkAndUnlockAchievements();
    } catch (err) {
      showToast("Error", err.message, "error");
    }
  };
}

// ============================================================================
// SEARCH & MANGA DETAILS
// ============================================================================

let _liveSearchTimer = null;

// ── Pagination helper ───────────────────────────────────────────────────────
function renderPagination(containerId, currentPage, hasNextPage, callbackName) {
  const container = $(containerId);
  if (!container) return;
  if (currentPage === 1 && !hasNextPage) {
    container.innerHTML = "";
    return;
  }
  const btn = (page, label, active = false, disabled = false) =>
    active
      ? `<button class="pagination-number active">${label}</button>`
      : `<button class="pagination-number${disabled ? " disabled" : ""}" ${
          disabled ? "disabled" : `onclick="${callbackName}(${page})"`
        }>${label}</button>`;

  let nums = "";
  if (currentPage > 2) nums += btn(1, "1");
  if (currentPage > 3) nums += `<span class="pagination-ellipsis">…</span>`;
  if (currentPage > 1) nums += btn(currentPage - 1, currentPage - 1);
  nums += btn(currentPage, currentPage, true);
  if (hasNextPage) nums += btn(currentPage + 1, currentPage + 1);

  container.innerHTML = `
    <div class="pagination">
      <button class="pagination-btn" ${
        currentPage <= 1 ? "disabled" : `onclick="${callbackName}(${currentPage - 1})"`
      }>← Prev</button>
      <div class="pagination-numbers">${nums}</div>
      <button class="pagination-btn" ${
        !hasNextPage ? "disabled" : `onclick="${callbackName}(${currentPage + 1})"`
      }>Next →</button>
    </div>
  `;
}

function searchGoToPage(page) {
  state.searchPage = page;
  window.scrollTo({ top: 0, behavior: "smooth" });
  search(page);
}

function advSearchGoToPage(page) {
  state.advSearchPage = page;
  window.scrollTo({ top: 0, behavior: "smooth" });
  advancedSearch(page);
}

// ── Main search ─────────────────────────────────────────────────────────────
async function search(page = 1) {
  const query = $("searchInput").value.trim();
  const dropdown = $("searchDropdown");
  if (!state.currentSourceId) { $("searchStatus").textContent = "Select a source first."; return; }
  if (!query) {
    if (dropdown) dropdown.innerHTML = "";
    $("searchStatus").textContent = "";
    const pg = $("searchPagination"); if (pg) pg.innerHTML = "";
    return;
  }

  state.searchQuery = query;
  state.searchPage = page;
  $("searchStatus").textContent = "Searching...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, page })
    });
    const results = result.results || [];
    const hasNextPage = result.hasNextPage || false;
    state.searchHasNextPage = hasNextPage;
    if (!dropdown) return;
    if (!results.length) {
      dropdown.innerHTML = `<div class="muted" style="padding:1rem">No results found for "${escapeHtml(query)}"</div>`;
      $("searchStatus").textContent = "0 result(s) found";
      renderPagination("searchPagination", page, false, "searchGoToPage");
    } else {
      dropdown.innerHTML = results.map(m => mangaCardHTML(m)).join("");
      bindMangaCards(dropdown);
      $("searchStatus").textContent = `${results.length} result(s) found — Page ${page}`;
      renderPagination("searchPagination", page, hasNextPage, "searchGoToPage");
    }
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
    const pg = $("searchPagination"); if (pg) pg.innerHTML = "";
  }
}

function toggleSourceSwitchDropdown(e) {
  e.stopPropagation();
  const dropdown = $("sourceSwitchDropdown");
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  // Close any other open ones first
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
  if (isHidden) {
    // Rebuild items in case sources changed
    const installed = Object.values(state.installedSources).filter(s => s.id !== state.currentSourceId);
    if (installed.length === 0) { showToast("No other sources installed", "", "info"); return; }
    const title = state.currentManga?.title || "";
    dropdown.innerHTML = installed.map(s =>
      `<button class="source-switch-item" onclick="switchToSourceSearch('${escapeHtml(s.id)}','${escapeHtml(title.replace(/'/g, "\\'"))}')">${escapeHtml(s.name)}</button>`
    ).join("");
    dropdown.classList.remove("hidden");
    setTimeout(() => document.addEventListener("click", _closeSrcDropdown, { once: true }), 0);
  }
}

function _closeSrcDropdown() {
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
}

async function switchToSourceSearch(sourceId, title) {
  document.querySelectorAll(".source-switch-dropdown").forEach(d => d.classList.add("hidden"));
  if (!title) return;
  showToast(`Searching in ${state.installedSources[sourceId]?.name || sourceId}...`, title, "info");
  try {
    const result = await api(`/api/source/${sourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: title, page: 1 })
    });
    const results = result.results || [];
    if (results.length === 0) {
      showToast("Not found", `"${title}" not found in ${state.installedSources[sourceId]?.name || sourceId}`, "info");
      return;
    }
    // Switch source globally and open first result
    state.currentSourceId = sourceId;
    const selectors = [$("sourceSelect"), $("advancedSourceSelect")];
    selectors.forEach(s => { if (s) s.value = sourceId; });
    loadMangaDetails(results[0].id);
  } catch (e) {
    showToast("Error", e.message, "error");
  }
}

async function loadMangaDetails(mangaId, fromView = "discover") {
  $("searchStatus").textContent = "Loading details...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const isFavorited = state.favorites.some(m => m.id === result.id && m.sourceId === state.currentSourceId);
    const hasProgress = state.lastReadChapter?.[result.id];

    // Navigate with context
    setView("manga-details", {
      mangaId: mangaId,
      sourceId: state.currentSourceId,
      scrollPosition: 0
    });

    // Render detail card
    $("details").innerHTML = `
      <div class="manga-details">
        ${result.cover && !result.cover.endsWith('.pdf') ? `
          <div class="manga-cover">
            <a href="${escapeHtml(`https://anilist.co/search/manga?search=${encodeURIComponent(result.title)}`)}" target="_blank" rel="noopener noreferrer" class="cover-anilist-link" title="View on AniList" onclick="event.stopPropagation()">
              <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
              <div class="cover-anilist-hint">View on AniList</div>
            </a>
          </div>` : (result.cover ? `<div class="manga-cover"><div class="no-cover" style="height:100%;font-size:4rem;">&#128196;</div></div>` : "")}
        <div class="manga-info">
          <h2 class="manga-title">${escapeHtml(result.title)}</h2>
          ${result.altTitle ? `<p class="manga-alt-title">${escapeHtml(result.altTitle)}</p>` : ""}
          ${result.author  ? `<p class="manga-author">✍️ <span class="author-link" data-author="${escapeHtml(result.author)}" onclick="searchByAuthor(this.dataset.author)">${escapeHtml(result.author)}</span></p>` : ""}
          <div class="manga-meta">
            ${result.status ? `<span class="badge badge-${result.status === 'ongoing' ? 'success' : 'secondary'}">${escapeHtml(result.status)}</span>` : ""}
            ${result.year   ? `<span class="badge">📅 ${escapeHtml(String(result.year))}</span>` : ""}
            <span class="source-switch-wrap">
              <span class="badge badge-source source-switch-btn" id="sourceSwitchBtn" onclick="toggleSourceSwitchDropdown(event)" title="Switch source">🌐 ${escapeHtml(state.installedSources[state.currentSourceId]?.name || state.currentSourceId)} ▾</span>
              <div class="source-switch-dropdown hidden" id="sourceSwitchDropdown">
                ${Object.values(state.installedSources).filter(s => s.id !== state.currentSourceId).map(s =>
                  `<button class="source-switch-item" onclick="switchToSourceSearch('${escapeHtml(s.id)}','${escapeHtml(result.title.replace(/'/g, "\\'"))}')">${escapeHtml(s.name)}</button>`
                ).join('')}
              </div>
            </span>
            <span class="badge badge-adaptation-check" id="adaptationCheckBtn" onclick="checkAnimeAdaptation('${escapeHtml(result.title.replace(/'/g, "\\'"))}')">🎬 Check</span>
          </div>
          <div id="adaptationResult"></div>
          ${result.genres?.length ? `
            <div class="manga-genres">
              ${result.genres.map(g => `<span class="genre-tag" data-genre="${escapeHtml(g)}" title="Search: ${escapeHtml(g)}">${escapeHtml(g)}</span>`).join("")}
            </div>` : ""}
          ${result.description ? `
            <div class="manga-description">
              <p>${escapeHtml(result.description)}</p>
            </div>` : ""}
          <div class="manga-actions">
            <button class="btn" id="addFavBtn">
              ${isFavorited ? "Remove from Library" : "Add to Library"}
            </button>
            <button class="btn btn-start-reading-detail" id="startReadingBtn">&#9654; Start Reading</button>
            ${hasProgress ? `<button class="btn btn-continue" id="continueReadingBtn">Continue</button>` : ""}
            ${fromView === 'random' ? `<button class="btn btn-reroll" id="rerollBtn" title="Pick another random manga">🎲 Reroll</button>` : ""}
          </div>
          <div id="detailRatingWrap" class="detail-rating-wrap"></div>
        </div>
      </div>
    `;

    // Reroll random
    if ($('rerollBtn')) $('rerollBtn').onclick = () => randomManga();

    // Favorites toggle
    $("addFavBtn").onclick = async () => {
      try {
        const res = await api("/api/favorites/toggle", {
          method: "POST",
          body: JSON.stringify({ mangaId: result.id, sourceId: state.currentSourceId, manga: result })
        });
        $("addFavBtn").textContent = res.isFavorite ? "Remove from Library" : "Add to Library";
        state.favorites = res.favorites;
        showToast(res.isFavorite ? "Added to Library" : "Removed from Library", result.title, res.isFavorite ? "success" : "info");
        renderLibrary();
        await updateStats();
        await checkAndUnlockAchievements();
      } catch (e) { showToast("Error", e.message, "error"); }
    };

    // Start reading (first chapter)
    $("startReadingBtn").onclick = async () => {
      if (!state.allChapters?.length) {
        showToast("Loading chapters...", "", "info");
        return;
      }
      const firstIdx = state.allChapters.length - 1;
      const ch = state.allChapters[firstIdx];
      await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
    };

    // Continue reading
    if (hasProgress) {
      $("continueReadingBtn").onclick = async () => {
        const lastChapterId = state.lastReadChapter[result.id];
        const lastPageIndex = state.lastReadPages[`${result.id}:${lastChapterId}`] || 0;
        try {
          const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
            method: "POST",
            body: JSON.stringify({ mangaId: result.id })
          });
          state.allChapters = cr.chapters || [];
          const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
          if (idx >= 0) {
            const ch = state.allChapters[idx];
            await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
          } else {
            showToast("Chapter not found", "It may have been removed.", "error");
          }
        } catch (e) { showToast("Error", e.message, "error"); }
      };
    }

    // Genre tag navigation
    $("details").querySelectorAll(".genre-tag[data-genre]").forEach(tag => {
      tag.onclick = (e) => { e.stopPropagation(); searchByGenre(tag.dataset.genre); };
    });

    // Rating widget
    renderDetailRating(result.id);

    // Render reading status
    renderReadingStatusSection(result.id, state.currentSourceId);
    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

function renderDetailRating(mangaId) {
  const wrap = $("detailRatingWrap");
  if (!wrap) return;
  const current = state.ratings[mangaId] || 0;
  wrap.innerHTML = `
    <div class="detail-rating-row" data-manga-id="${escapeHtml(mangaId)}">
      <span class="detail-rating-label">Rating</span>
      <div class="detail-rating-btns">
        ${Array.from({length: 10}, (_, i) => {
          const v = i + 1;
          return `<button class="card-score-btn detail-score-btn${v <= current ? ' active' : ''}" data-score="${v}">${v}</button>`;
        }).join("")}
      </div>
      ${current ? `<span class="detail-rating-current">${current}<span class="detail-rating-max">/10</span></span>` : ""}
      ${current ? `<button class="detail-rating-clear" title="Clear rating">\u2715</button>` : ""}
    </div>
  `;
  const row = wrap.querySelector(".detail-rating-row");
  row.querySelectorAll(".detail-score-btn").forEach(btn => {
    btn.onmouseenter = () => {
      const v = Number(btn.dataset.score);
      row.querySelectorAll(".detail-score-btn").forEach(b => b.classList.toggle("hover", Number(b.dataset.score) <= v));
    };
    btn.onmouseleave = () => row.querySelectorAll(".detail-score-btn").forEach(b => b.classList.remove("hover"));
    btn.onclick = async () => {
      const score = Number(btn.dataset.score);
      const newScore = state.ratings[mangaId] === score ? null : score;
      try {
        if (newScore) {
          await api("/api/reviews", { method: "POST", body: JSON.stringify({ mangaId, rating: newScore, text: "" }) });
          state.ratings[mangaId] = newScore;
        } else {
          await api(`/api/ratings/${mangaId}`, { method: "DELETE" });
          delete state.ratings[mangaId];
        }
        renderDetailRating(mangaId);
        renderLibrary();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });
  const clearBtn = wrap.querySelector(".detail-rating-clear");
  if (clearBtn) {
    clearBtn.onclick = async () => {
      try {
        await api(`/api/ratings/${mangaId}`, { method: "DELETE" });
        delete state.ratings[mangaId];
        renderDetailRating(mangaId);
        renderLibrary();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  }
}

// ============================================================================
// ADD TO LIST MODAL
// ============================================================================
// CHAPTERS MANAGEMENT
// ============================================================================

async function loadChapters() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");
  chapDiv.innerHTML = `<div class="muted">Loading chapters...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId: state.currentManga.id })
    });
    state.allChapters = result.chapters || [];
    state.chaptersReversed = false;
    renderChaptersList();
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

function renderChaptersList() {
  if (!state.currentManga) return;
  const chapDiv = $("chapters");

  let displayChapters = state.allChapters;
  if (state.settings.skipReadChapters) {
    displayChapters = state.allChapters.filter(ch => !isChapterRead(state.currentManga.id, ch.id));
  }
  if (state.chaptersReversed) {
    displayChapters = [...displayChapters].reverse();
  }

  if (!displayChapters.length) {
    chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "All chapters read" : "No chapters found"}</div>`;
    return;
  }

  const reverseIcon = state.chaptersReversed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;

  chapDiv.innerHTML = `
    <div class="chapters-header">
      <strong>${displayChapters.length} Chapter${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Unread" : "Available"}</strong>
      <div class="chapters-header-actions">
        <button class="btn-reverse-chapters ${state.chaptersReversed ? 'btn-reverse-active' : ''}" id="reverseChaptersBtn" title="${state.chaptersReversed ? 'Oldest first (reversed)' : 'Newest first (default)'}">
          ${reverseIcon}
          ${state.chaptersReversed ? "Oldest First" : "Newest First"}
        </button>
        <button class="btn-check-integrity" id="checkIntegrityBtn" title="Check Chapter Integrity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Check Integrity
        </button>
        <button class="btn-download-bulk" id="downloadBulkBtn" title="Download Multiple Chapters">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Bulk Download
        </button>
      </div>
    </div>
    <div id="integrityReport"></div>
    <div class="chapters-list">
      ${displayChapters.map((ch, i) => {
        const isRead    = isChapterRead(state.currentManga.id, ch.id);
        const realIndex = state.allChapters.findIndex(c => c.id === ch.id);
        const isFlagged = state.flaggedChapters.has(`${state.currentManga.id}:${ch.id}`);
        return `
          <div class="chapter-item ${isRead ? 'chapter-read' : ''} ${isFlagged ? 'chapter-flagged' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${realIndex}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
            <div class="chapter-info">
              <div class="chapter-name">${isFlagged ? '<span class="chapter-flag-icon">🚩</span> ' : ''}${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</div>
              ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" })}</div>` : ""}
            </div>
            <div class="chapter-action">
              ${isRead ? `<span class="read-badge">✓</span>` : ""}
              <button class="btn-download-chapter" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}" title="Download this chapter" onclick="event.stopPropagation();">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>`;
      }).join("")}
    </div>`;

  chapDiv.querySelectorAll(".chapter-item[data-chapter-id]").forEach(el => {
    el.onclick = () => loadChapter(
      el.dataset.chapterId,
      el.dataset.chapterName,
      parseInt(el.dataset.chapterIndex)
    );
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showChapterContextMenu(e, el.dataset.chapterId, state.currentManga?.id);
    });
  });

  // Download individual chapters
  chapDiv.querySelectorAll(".btn-download-chapter").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await downloadChapter(btn.dataset.chapterId, btn.dataset.chapterName);
    };
  });

  // Reverse order button
  const reverseBtn = $("reverseChaptersBtn");
  if (reverseBtn) {
    reverseBtn.onclick = () => {
      state.chaptersReversed = !state.chaptersReversed;
      renderChaptersList();
    };
  }

  // Bulk download button
  const bulkBtn = $("downloadBulkBtn");
  if (bulkBtn) {
    bulkBtn.onclick = () => showBulkDownloadModal(displayChapters);
  }

  // Check integrity button
  const integrityBtn = $("checkIntegrityBtn");
  if (integrityBtn) {
    integrityBtn.onclick = () => checkChapterIntegrity(state.allChapters);
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
  _bookFlipAnimating = false;
  _ltrFlipAnimating  = false;
  $("searchStatus").textContent = "Loading chapter...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });
    state.currentChapter      = result;
    state.currentChapter.name = chapterName;
    state.currentChapter.id   = chapterId;
    state.currentChapterIndex = chapterIndex;

    // PDF: load via PDF.js to get page count, build synthetic pages array
    if (result.isPDF && result.pdfUrl) {
      await initPDFChapter(result.pdfUrl);
    }

    const maxIndex = Math.max((state.currentChapter.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);
    // Keep zoom level between chapters — only reset if it was never set

    markChapterAsRead(state.currentManga.id, chapterId);
    state.readerSessionStart = Date.now();

    api("/api/history/add", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga.id,
        sourceId: state.currentSourceId,
        manga: state.currentManga,
        chapterId
      })
    }).then(() => {
      // Keep in-memory history in sync (with full manga object including genres)
      const existing = state.history.findIndex(
        m => m.id === state.currentManga.id && m.sourceId === state.currentSourceId
      );
      const entry = { ...state.currentManga, sourceId: state.currentSourceId, chapterId, readAt: new Date().toISOString() };
      if (existing >= 0) state.history.splice(existing, 1);
      state.history.unshift(entry);
      state.history = state.history.slice(0, 100);
      // Refresh recommendations so "Based on:" label reflects updated consumption
      loadRecommendations();
    }).catch(() => {});

    showReader();
    renderPage();
    $("searchStatus").textContent = "";
    loadChapters();
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
  }
}

// ============================================================================
// CHAPTER NAVIGATION
// ============================================================================

function getNextChapterIndex(currentIndex) {
  // Chapters are sorted newest-first, so "next" chapter = lower index
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex - 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex - 1;
}

function getPrevChapterIndex(currentIndex) {
  // Chapters are sorted newest-first, so "prev" chapter = higher index
  if (!state.settings.skipDuplicates || !state.allChapters.length) return currentIndex + 1;
  const cur = state.allChapters[currentIndex];
  for (let i = currentIndex + 1; i < state.allChapters.length; i++) {
    if (state.allChapters[i].chapter !== cur?.chapter) return i;
  }
  return currentIndex + 1;
}

async function goToNextChapter() {
  const next = getNextChapterIndex(state.currentChapterIndex);
  if (next < 0 || next >= (state.allChapters?.length || 0)) {
    showToast("Last chapter reached", "", "info"); return;
  }
  const ch = state.allChapters[next];
  if (!ch) { showToast("Last chapter reached", "", "info"); return; }
  await recordReadingSession();
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || next + 1}`, next);
}

async function goToPrevChapter() {
  const prev = getPrevChapterIndex(state.currentChapterIndex);
  if (prev >= state.allChapters.length) { showToast("First chapter reached", "", "info"); return; }
  await recordReadingSession();
  const ch = state.allChapters[prev];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || prev + 1}`, prev);
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

async function downloadChapter(chapterId, chapterName) {
  try {
    showToast("Download Started", `Downloading ${chapterName}...`, "info");

    // Get chapter pages
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });

    if (!result.pages || result.pages.length === 0) {
      showToast("Error", "No pages found for this chapter", "error");
      return;
    }

    // Request CBZ from server (binary response)
    const resp = await fetch("/api/download/chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        chapterName,
        chapterId,
        sourceId: state.currentSourceId,
        pages: result.pages
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast("Error", err.error || "Download failed", "error");
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const filename = (resp.headers.get("Content-Disposition") || "").match(/filename="(.+?)"/)?.at(1)
      || `${chapterName}.cbz`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Download Complete", `${chapterName} downloaded as CBZ!`, "success");
  } catch (e) {
    showToast("Error", `Download failed: ${e.message}`, "error");
  }
}

function showBulkDownloadModal(chapters) {
  // Create modal HTML
  const modalHtml = `
    <div class="modal-overlay" id="bulkDownloadModal">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>📥 Bulk Download Chapters</h2>
          <button class="modal-close" onclick="closeBulkDownloadModal()">✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Select chapters to download as a ZIP file:</p>
          <div class="bulk-download-controls">
            <button class="btn btn-sm" onclick="selectAllChapters()">Select All</button>
            <button class="btn btn-sm" onclick="deselectAllChapters()">Deselect All</button>
            <span class="selected-count">0 selected</span>
          </div>
          <div class="bulk-chapters-list" id="bulkChaptersList">
            ${chapters.map((ch, i) => `
              <label class="bulk-chapter-item">
                <input type="checkbox" class="bulk-chapter-checkbox" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}">
                <span>${escapeHtml(ch.name || `Chapter ${ch.chapter || i + 1}`)}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeBulkDownloadModal()">Cancel</button>
          <button class="btn" id="confirmBulkDownload">Download Selected</button>
        </div>
      </div>
    </div>
  `;

  // Add modal to page
  const existing = $("bulkDownloadModal");
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Update count on checkbox change
  const updateCount = () => {
    const checked = document.querySelectorAll('.bulk-chapter-checkbox:checked').length;
    document.querySelector('.selected-count').textContent = `${checked} selected`;
  };

  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => {
    cb.addEventListener('change', updateCount);
  });

  // Confirm download button
  $("confirmBulkDownload").onclick = async () => {
    const selected = Array.from(document.querySelectorAll('.bulk-chapter-checkbox:checked'))
      .map(cb => ({ id: cb.dataset.chapterId, name: cb.dataset.chapterName }));
    
    if (selected.length === 0) {
      showToast("No Selection", "Please select at least one chapter", "warning");
      return;
    }

    closeBulkDownloadModal();
    await downloadBulkChapters(selected);
  };
}

window.closeBulkDownloadModal = function() {
  const modal = $("bulkDownloadModal");
  if (modal) modal.remove();
};

window.selectAllChapters = function() {
  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => cb.checked = true);
  const count = document.querySelectorAll('.bulk-chapter-checkbox').length;
  document.querySelector('.selected-count').textContent = `${count} selected`;
};

window.deselectAllChapters = function() {
  document.querySelectorAll('.bulk-chapter-checkbox').forEach(cb => cb.checked = false);
  document.querySelector('.selected-count').textContent = `0 selected`;
};

async function downloadBulkChapters(selectedChapters) {
  try {
    showToast("Bulk Download Started", `Fetching ${selectedChapters.length} chapters — this may take a while...`, "info");

    // Request CBZ from server (binary response — server fetches all images)
    const resp = await fetch("/api/download/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        sourceId: state.currentSourceId,
        chapters: selectedChapters
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast("Error", err.error || "Bulk download failed", "error");
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const filename = (resp.headers.get("Content-Disposition") || "").match(/filename="(.+?)"/)?.at(1)
      || `${state.currentManga?.title || "manga"}_chapters.cbz`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Download Complete", `${selectedChapters.length} chapters saved as CBZ!`, "success");
  } catch (e) {
    showToast("Error", `Bulk download failed: ${e.message}`, "error");
  }
}

// ============================================================================
// CHAPTER INTEGRITY CHECK
// ============================================================================

function checkChapterIntegrity(chapters) {
  if (!chapters || chapters.length === 0) {
    showToast("No Chapters", "No chapters available to check", "info");
    return;
  }

  analyzeChapterIntegrityWithMangaUpdates(chapters, state.currentManga);
}

async function analyzeChapterIntegrityWithMangaUpdates(chapters, mangaDetails = null) {
  const report = analyzeChapterIntegrity(chapters, mangaDetails);
  
  // If no external data, try to fetch from MangaUpdates
  if (!mangaDetails?.lastChapter && state.currentManga?.title) {
    try {
      const response = await api("/api/mangaupdates/search", {
        method: "POST",
        body: JSON.stringify({ title: state.currentManga.title })
      });
      
      if (response.found && response.latestChapter) {
        // Re-analyze with MangaUpdates data
        const enhancedMangaDetails = {
          ...mangaDetails,
          lastChapter: response.latestChapter,
          status: response.status,
          mangaUpdatesUrl: response.url
        };
        const enhancedReport = analyzeChapterIntegrity(chapters, enhancedMangaDetails);
        displayIntegrityReport(enhancedReport, response);
        return;
      }
    } catch (e) {
      console.warn("MangaUpdates lookup failed:", e.message);
    }
  }
  
  displayIntegrityReport(report);
}

function analyzeChapterIntegrity(chapters, mangaDetails = null) {
  const issues = [];
  const warnings = [];
  const info = [];

  // Extract chapter numbers (handles numeric strings and "Chapter X" style names)
  const chapterNumbers = chapters
    .map(ch => {
      const direct = parseFloat(ch.chapter);
      if (!isNaN(direct)) return direct;
      // Fallback: extract the first number from strings like "Chapter 1191"
      const match = String(ch.chapter || ch.name || '').match(/\d+(?:\.\d+)?/);
      return match ? parseFloat(match[0]) : NaN;
    })
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b);

  if (chapterNumbers.length === 0) {
    issues.push("⚠️ No valid chapter numbers found");
    return { issues, warnings, info, stats: {} };
  }

  // Statistics
  const stats = {
    total: chapters.length,
    withNumbers: chapterNumbers.length,
    minChapter: Math.min(...chapterNumbers),
    maxChapter: Math.max(...chapterNumbers),
    range: Math.max(...chapterNumbers) - Math.min(...chapterNumbers) + 1
  };

  // Use external data if available (from manga details)
  const expectedTotalChapters = mangaDetails?.lastChapter 
    ? parseFloat(mangaDetails.lastChapter) 
    : null;

  info.push(`Total chapters available: ${stats.total}`);
  info.push(`Chapter range: ${stats.minChapter} - ${stats.maxChapter}`);
  
  if (expectedTotalChapters) {
    info.push(`Expected total chapters: ${expectedTotalChapters} (from source)`);
  }

  // Check for duplicates
  const duplicates = chapterNumbers.filter((num, idx) => 
    chapterNumbers.indexOf(num) !== idx
  );
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    warnings.push(`${uniqueDuplicates.length} duplicate chapter(s): ${uniqueDuplicates.slice(0, 5).join(', ')}${uniqueDuplicates.length > 5 ? '...' : ''}`);
  }

  // Check for gaps in sequence
  const gaps = [];
  for (let i = 0; i < chapterNumbers.length - 1; i++) {
    const current = chapterNumbers[i];
    const next = chapterNumbers[i + 1];
    const diff = next - current;
    
    if (diff > 1.5) { // Allow for .5 chapters
      const missingStart = Math.ceil(current + 0.5);
      const missingEnd = Math.floor(next - 0.5);
      if (missingStart <= missingEnd) {
        gaps.push({ start: missingStart, end: missingEnd });
      }
    }
  }

  if (gaps.length > 0) {
    const gapCount = gaps.reduce((sum, g) => sum + (g.end - g.start + 1), 0);
    issues.push(`${gapCount} missing chapter(s) detected in ${gaps.length} gap(s)`);
    gaps.slice(0, 3).forEach(g => {
      if (g.start === g.end) {
        warnings.push(`   Missing: Chapter ${g.start}`);
      } else {
        warnings.push(`   Missing: Chapters ${g.start}-${g.end}`);
      }
    });
    if (gaps.length > 3) {
      warnings.push(`   ... and ${gaps.length - 3} more gap(s)`);
    }
  } else {
    info.push(`No gaps detected in available sequence`);
  }

  // Check for expected completeness
  const actualUnique = new Set(chapterNumbers).size;
  let completeness;
  let completenessBase;

  if (expectedTotalChapters && expectedTotalChapters > 0) {
    // Use external data for accurate completeness
    completenessBase = expectedTotalChapters;
    completeness = (actualUnique / expectedTotalChapters * 100).toFixed(1);
  } else {
    // Fallback to local range-based calculation
    completenessBase = stats.maxChapter - stats.minChapter + 1;
    completeness = (actualUnique / completenessBase * 100).toFixed(1);
    warnings.push(`⚠️ Using local range for completeness (no external data)`);
  }

  if (completeness >= 95) {
    info.push(`✅ ${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  } else if (completeness >= 80) {
    warnings.push(`⚠️ ${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  } else {
    issues.push(`❌ Only ${completeness}% complete (${actualUnique}/${Math.ceil(completenessBase)} chapters)`);
  }

  // Additional warnings if using external data
  if (expectedTotalChapters && stats.maxChapter < expectedTotalChapters) {
    const missingFromEnd = expectedTotalChapters - stats.maxChapter;
    warnings.push(`📉 Missing latest ${missingFromEnd} chapter(s) (up to ${expectedTotalChapters})`);
  }

  return { issues, warnings, info, stats, gaps, duplicates: uniqueDuplicates, completeness: parseFloat(completeness) };
}

function displayIntegrityReport(report, mangaUpdatesData = null) {
  const reportDiv = $("integrityReport");
  if (!reportDiv) return;

  const { issues, warnings, info } = report;
  const hasIssues = issues.length > 0;
  const hasWarnings = warnings.length > 0;

  let statusClass = "integrity-good";
  let statusIcon = "✅";
  let statusText = "All Good";

  if (hasIssues) {
    statusClass = "integrity-error";
    statusIcon = "❌";
    statusText = "Issues Found";
  } else if (hasWarnings) {
    statusClass = "integrity-warning";
    statusIcon = "⚠️";
    statusText = "Warnings";
  }

  let mangaUpdatesSection = "";
  if (mangaUpdatesData && mangaUpdatesData.found) {
    mangaUpdatesSection = `
      <div class="integrity-section integrity-mangaupdates">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">📚 MangaUpdates Data:</div>
        <div>Latest Chapter: ${mangaUpdatesData.latestChapter || "Unknown"}</div>
        <div>Status: ${mangaUpdatesData.status || "Unknown"}</div>
        ${mangaUpdatesData.url ? `<div><a href="${mangaUpdatesData.url}" target="_blank" style="color: var(--primary);">View on MangaUpdates →</a></div>` : ''}
      </div>
    `;
  }

  reportDiv.innerHTML = `
    <div class="integrity-report ${statusClass}">
      <div class="integrity-header">
        <span class="integrity-icon">${statusIcon}</span>
        <strong>Integrity Check: ${statusText}</strong>
        <button class="btn-close-report" onclick="closeIntegrityReport()">✕</button>
      </div>
      <div class="integrity-body">
        ${mangaUpdatesSection}
        ${issues.length > 0 ? `
          <div class="integrity-section integrity-issues">
            ${issues.map(issue => `<div>${issue}</div>`).join('')}
          </div>
        ` : ''}
        ${warnings.length > 0 ? `
          <div class="integrity-section integrity-warnings">
            ${warnings.map(warning => `<div>${warning}</div>`).join('')}
          </div>
        ` : ''}
        ${info.length > 0 ? `
          <div class="integrity-section integrity-info">
            ${info.map(i => `<div>${i}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  reportDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.closeIntegrityReport = function() {
  const reportDiv = $("integrityReport");
  if (reportDiv) reportDiv.innerHTML = '';
};

// ============================================================================
// ANIME / FILM ADAPTATION CHECK (via AniList GraphQL)
// ============================================================================
window.checkAnimeAdaptation = async function(title) {
  const btn       = $("adaptationCheckBtn");
  const resultDiv = $("adaptationResult");
  if (!resultDiv) return;

  if (btn) { btn.textContent = "🎬 Checking..."; btn.classList.add("badge-adaptation-loading"); }

  // Dual query:
  // 1. Look up the manga entry and follow its ADAPTATION relations to anime
  // 2. Directly search AniList for anime with the same title (catches cases
  //    where the manga<->anime relation isn't populated on AniList)
  const query = `
    query ($search: String) {
      mangaEntry: Media(search: $search, type: MANGA) {
        id
        relations {
          edges {
            relationType
            node {
              id type format status
              title { romaji english native }
              siteUrl
              coverImage { medium }
            }
          }
        }
      }
      animeDirect: Page(perPage: 6) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id format status
          title { romaji english native }
          siteUrl
          coverImage { medium }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } })
    });
    const data = await res.json();

    // --- Source 1: ADAPTATION relations from the manga entry ---
    const relationEdges = data?.data?.mangaEntry?.relations?.edges || [];
    const fromRelations = relationEdges
      .filter(e => e.relationType === "ADAPTATION" && e.node.type === "ANIME")
      .map(e => e.node);

    // --- Source 2: Direct anime search ---
    const directAnime = data?.data?.animeDirect?.media || [];

    // Merge, deduplicate by AniList ID — relation entries take priority
    const seen = new Set(fromRelations.map(n => n.id));
    const merged = [
      ...fromRelations,
      ...directAnime.filter(n => !seen.has(n.id))
    ];

    if (merged.length === 0) {
      resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">🎬 No anime or film adaptations found on AniList.</div>`;
    } else {
      resultDiv.innerHTML = `
        <div class="adaptation-result">
          <div class="adaptation-result-title">🎬 Adaptations found (${merged.length})</div>
          <div class="adaptation-list">
            ${merged.map(n => {
              const t    = n.title.english || n.title.romaji || n.title.native || "Unknown";
              const fmt  = n.format ? n.format.replace(/_/g, ' ') : '';
              const st   = n.status  ? n.status.replace(/_/g, ' ')  : '';
              const meta = [fmt, st].filter(Boolean).join(' · ');
              return `<a class="adaptation-item" href="${escapeHtml(n.siteUrl)}" target="_blank" rel="noopener noreferrer">
                ${n.coverImage?.medium
                  ? `<img src="${escapeHtml(n.coverImage.medium)}" alt="" class="adaptation-cover">`
                  : `<div class="adaptation-cover-placeholder">📺</div>`}
                <div class="adaptation-item-info">
                  <span class="adaptation-item-name">${escapeHtml(t)}</span>
                  ${meta ? `<span class="adaptation-item-meta">${escapeHtml(meta)}</span>` : ''}
                </div>
              </a>`;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">⚠️ Error checking adaptations: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.textContent = "🎬 Check"; btn.classList.remove("badge-adaptation-loading"); }
  }
};

// Record session duration when navigating away from chapter
async function recordReadingSession() {
  if (!state.readerSessionStart) return;
  const duration = (Date.now() - state.readerSessionStart) / 60000; // convert to minutes
  state.readerSessionStart = null;
  try {
    await api("/api/analytics/session", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga?.id,
        chapterId: state.currentChapter?.id,
        duration: Math.round(duration * 10) / 10
      })
    });
    await checkAndUnlockAchievements();
  } catch (e) { /* non-fatal */ }
}

// ============================================================================
// READER & PAGE RENDERING
// ============================================================================

// ── Auto-hide header state ──────────────────────────────────────────────────
let _headerHideTimer = null;

function _readerMouseMove(e) {
  const readerEl = $("reader");
  if (!readerEl) return;
  const SHOW_ZONE = 72; // px from top of viewport
  if (e.clientY <= SHOW_ZONE) {
    // Mouse is in the header zone — show and cancel any pending hide
    readerEl.classList.remove("header-hidden");
    clearTimeout(_headerHideTimer);
    _headerHideTimer = null;
  } else {
    // Mouse left the zone — schedule hide if not already pending
    if (!_headerHideTimer && !readerEl.classList.contains("header-hidden")) {
      _headerHideTimer = setTimeout(() => {
        readerEl.classList.add("header-hidden");
        _headerHideTimer = null;
      }, 2000);
    }
  }
}

function showReader() {
  const readerEl = $("reader");
  readerEl.classList.remove("hidden", "header-hidden");
  const chapterName = state.currentChapter?.name || "Chapter";
  $("readerTitle").textContent = `${state.currentManga?.title || ""} — ${chapterName}`;
  updateZoomUI();
  // Auto-hide header after 3 s of inactivity and on mouse position
  clearTimeout(_headerHideTimer);
  _headerHideTimer = setTimeout(() => { readerEl.classList.add("header-hidden"); _headerHideTimer = null; }, 3000);
  readerEl.addEventListener("mousemove", _readerMouseMove);
}

async function hideReader() {
  stopAutoScroll();
  await recordReadingSession();
  const readerEl = $("reader");
  readerEl.classList.add("hidden");
  readerEl.classList.remove("header-hidden");
  readerEl.removeEventListener("mousemove", _readerMouseMove);
  clearTimeout(_headerHideTimer);
  _headerHideTimer = null;
}

// ============================================================================
// AUTOSCROLL
// ============================================================================

let _autoScrollRAF = null;
const AUTOSCROLL_SPEEDS = [0.2, 0.5, 1.0, 2.0, 3.5]; // px per animation frame

function startAutoScroll() {
  stopAutoScroll();
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  function tick() {
    const speedPx = AUTOSCROLL_SPEEDS[state.autoScroll.speed - 1] || 1.5;
    pageWrap.scrollTop += speedPx;
    _autoScrollRAF = requestAnimationFrame(tick);
  }
  _autoScrollRAF = requestAnimationFrame(tick);
}

function stopAutoScroll() {
  if (_autoScrollRAF !== null) {
    cancelAnimationFrame(_autoScrollRAF);
    _autoScrollRAF = null;
  }
}

function toggleAutoScroll() {
  state.autoScroll.enabled = !state.autoScroll.enabled;
  const btn   = $("autoScrollToggle");
  const bar   = $("autoScrollBar");
  if (btn) {
    btn.classList.toggle("active", state.autoScroll.enabled);
    btn.title = state.autoScroll.enabled ? "Stop AutoScroll" : "Start AutoScroll";
  }
  if (bar) bar.classList.toggle("hidden", !state.autoScroll.enabled);
  if (state.autoScroll.enabled) startAutoScroll();
  else stopAutoScroll();
}

function renderPage() {
  if (!state.currentChapter?.pages) return;

  // PDF mode: delegate to async PDF.js renderer (respects reading mode)
  if (state.currentChapter.isPDF && state.pdfDocument) {
    if (state.settings.readingMode === 'webtoon') {
      renderPDFWebtoon();
    } else {
      renderPDFPageToCanvas(state.currentPageIndex + 1);
    }
    return;
  }

  const pages   = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const idx     = state.currentPageIndex;
  const mode    = state.settings.readingMode;

  // Reset zoom on new chapter
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : "";

  if (mode === "webtoon") {
    pageWrap.className = "reader-content reading-mode-webtoon";
    const validPages = pages.filter(p => p.img);
    const nextWIdx = getNextChapterIndex(state.currentChapterIndex);
    const nextWCh  = (nextWIdx >= 0 && nextWIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextWIdx] : null;
    const nextWLabel = nextWCh ? (nextWCh.name || `Chapter ${nextWCh.chapter || nextWIdx + 1}`) : null;
    pageWrap.innerHTML = `
      <div class="page-zoom-wrap webtoon-wrap" ${zoomStyle}>
        ${validPages.map((p, i) => `<img src="${escapeHtml(p.img)}" alt="Page ${i + 1}" class="webtoon-page" loading="eager">`).join("")}
      </div>
      <div class="chapter-end-wrap">
        ${nextWLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextWLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
      </div>`;
    $("pageCounter").textContent = `Webtoon Mode — ${validPages.length} pages`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);
  } else if (mode === "rtl") {
    renderBookSpread();
    return;
  } else if (mode === "ltr") {
    renderLTRSpread();
    return;
  } else {
    pageWrap.className = "reader-content";
    if (idx < 0 || idx >= pages.length) return;
    const page     = pages[idx];
    const isLast   = idx === pages.length - 1;
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        <div class="chapter-end-divider"></div>
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next →</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : "";
    pageWrap.innerHTML = page.img
      ? `<div class="page-zoom-wrap" ${zoomStyle}><img src="${escapeHtml(page.img)}" alt="Page ${idx + 1}" class="${imgClass}"></div>${endBanner}`
      : `<div class="muted">Page not available</div>`;
    // Scroll to top on new page (not when same chapter end-banner update)
    if (!isLast) pageWrap.scrollTop = 0;
    else pageWrap.scrollTo({ top: 0, behavior: "smooth" });

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  }
}

// ============================================================================
// BOOK READER — RTL double-page spread with 3D page-flip
// ============================================================================

let _bookFlipAnimating = false;

function getBookSpread(idx, pages) {
  const page = pages[idx];
  // Wide (double-page scan): same image fills both panels, each showing one half
  if (page?.isWide) {
    return { right: page.img || null, left: page.img || null, isWide: true };
  }
  return {
    right: pages[idx]?.img     || null,
    left:  pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// LTR (Western) spread: left = pages[idx], right = pages[idx+1]
function getLTRSpread(idx, pages) {
  const page = pages[idx];
  if (page?.isWide) {
    return { left: page.img || null, right: page.img || null, isWide: true };
  }
  return {
    left:  pages[idx]?.img     || null,
    right: pages[idx + 1]?.img || null,
    isWide: false,
  };
}

// After rendering a spread, check whether the idx page image is a wide double-page scan.
// RTL: pages[idx] is on the right panel. LTR: pages[idx] is on the left panel.
// If wide, mutate both panels in-place to show left/right halves of the same source.
// After rendering a spread, probe both panel images.
// If either is landscape (wider than tall) it is a double-page scan —
// overlay it as ONE full-spread image covering both panels.
function _applyWideSplitIfNeeded(idx, pages) {
  const spread = $('bookSpread');
  if (!spread) return;

  let applied = false;

  const imgs = [
    document.querySelector('#bookRight img.book-page-img'),
    document.querySelector('#bookLeft  img.book-page-img'),
  ].filter(Boolean);

  imgs.forEach(imgEl => {
    const check = () => {
      if (applied) return;
      if (state.currentPageIndex !== idx) return;
      if (imgEl.naturalWidth <= imgEl.naturalHeight) return; // portrait, skip

      applied = true;
      const src = imgEl.src;
      if (pages[idx]) pages[idx].isWide = true;

      // Remove any previous overlay
      const old = document.getElementById('bookWideOverlay');
      if (old) old.remove();

      // Full-spread overlay with the wide image shown at natural aspect ratio
      const overlay = document.createElement('div');
      overlay.className = 'book-wide-overlay';
      overlay.id = 'bookWideOverlay';
      const wImg = document.createElement('img');
      wImg.src = src;
      overlay.appendChild(wImg);
      spread.appendChild(overlay);

      // Fade in only once the image is decoded — no flash of blank overlay
      const showOverlay = () => requestAnimationFrame(() => overlay.classList.add('visible'));
      if (wImg.complete) showOverlay();
      else wImg.addEventListener('load', showOverlay, { once: true });

      // Fix counter (1 page consumed) and nav buttons
      const total = pages.length;
      const ctr = $('pageCounter');
      if (ctr) ctr.textContent = `${idx + 1} / ${total}`;
      const nx = $('nextPage');
      const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
      if (nx) nx.disabled = idx + 1 >= total && !hasNextCh;
    };

    if (imgEl.complete && imgEl.naturalWidth > 0) check();
    else imgEl.addEventListener('load', check, { once: true });
  });
}

function renderBookSpread() {
  if (!state.currentChapter?.pages) return;
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getBookSpread(idx, pages);
  const { right: rightImg, left: leftImg, isWide } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-rtl' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = isWide ? 1 : 2;
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const r = idx + 1, l = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${r} / ${total}`
    : (l <= total ? `${r}-${l} / ${total}` : `${r} / ${total}`);

  const wrapZoomStyle = '';

  // RTL: right panel reads first. For wide page: right half on right, left half on left.
  const rightHtml = rightImg
    ? `<img class="book-page-img${isWide ? ' wide-split-right' : ''}" src="${escapeHtml(rightImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const leftHtml = leftImg
    ? `<img class="book-page-img${isWide ? ' wide-split-left' : ''}" src="${escapeHtml(leftImg)}" alt="Page ${isWide ? idx + 1 : idx + 2}">`
    : `<div class="book-page-blank"></div>`;

  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap" ${wrapZoomStyle}>
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left" id="bookLeft">${leftHtml}</div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight">${rightHtml}</div>
      </div>
    </div>
  `;

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  _applyWideSplitIfNeeded(idx, pages);
}

function attachBookDragEvents() {
  const spread = $("bookSpread");
  if (!spread || spread.dataset.dragAttached) return;
  spread.dataset.dragAttached = "1";

  let startX = 0;
  let dragSide = null;
  let active   = false;

  spread.addEventListener("pointerdown", e => {
    if (e.button && e.pointerType === "mouse") return;
    const rect = spread.getBoundingClientRect();
    dragSide = (e.clientX - rect.left) > rect.width / 2 ? "right" : "left";
    startX   = e.clientX;
    active   = true;
    spread.setPointerCapture(e.pointerId);
  }, { passive: true });

  spread.addEventListener("pointerup", e => {
    if (!active) return;
    active = false;
    const dx = e.clientX - startX;
    const tap = Math.abs(dx) < 12;
    const isRTL = state.settings.readingMode === "rtl";
    const _navigate = state.settings.readingMode === "ltr" ? navigateLTR : navigateBook;
    // RTL (manga): left side = next pages, right side = previous pages
    // LTR: right side = next pages, left side = previous pages
    if (dragSide === "right" && (dx < -50 || tap))  _navigate(isRTL ? "backward" : "forward");
    if (dragSide === "left"  && (dx >  50 || tap))  _navigate(isRTL ? "forward"  : "backward");
  });
}

function navigateBook(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  if (direction === "forward") {
    const step = pages[idx]?.isWide ? 1 : 2;
    if (idx + step >= total) { _bookFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _bookFlipAnimating = false; goToPrevChapter(); return; }
    // Step back by 1 if the preceding page is a wide page, else by 2
    const backStep = pages[idx - 1]?.isWide ? 1 : 2;
    newIdx = Math.max(0, idx - backStep);
  }

  if (_bookFlipAnimating) return;

  _bookFlipAnimating = true;
  // RTL (manga): spine is on the right. "forward" = left page flips rightward → invert animation direction
  const animDir = direction === "forward" ? "backward" : "forward";
  playBookFlip(animDir, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _bookFlipAnimating = false;
    // Update counter + nav buttons in-place — no DOM rebuild, no flash
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = isWide2 ? 1 : 2;
    const r = newIdx + 1, l = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${r} / ${total2}` : (l <= total2 ? `${r}-${l} / ${total2}` : `${r} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideSplitIfNeeded(newIdx, pages);
  });
}

function playBookFlip(direction, oldIdx, newIdx, pages, onComplete, getSpread = getBookSpread) {
  const spread = $("bookSpread");
  if (!spread) { onComplete(); return; }

  // Remove any wide-page overlay from the previous spread immediately
  const prevOverlay = document.getElementById('bookWideOverlay');
  if (prevOverlay) prevOverlay.remove();

  const { right: newRight, left: newLeft } = getSpread(newIdx, pages);
  const isForward = direction === "forward";

  const sL = document.getElementById("bookLeft");
  const sR = document.getElementById("bookRight");

  // ── Helper ─────────────────────────────────────────────────────────────────
  const mkImg = (src, extraClass = '') =>
    src ? `<img class="book-page-img${extraClass ? ' ' + extraClass : ''}" src="${escapeHtml(src)}">` : `<div class="book-page-blank"></div>`;

  const newSpread = getSpread(newIdx, pages);
  const newIsWide = newSpread.isWide;
  // Recompute newRight/newLeft from the spread (already done above for the non-wide case)
  const nRight = newSpread.right;
  const nLeft  = newSpread.left;

  // Clone the existing rendered <img> from the panel that is about to flip.
  // Cloning guarantees the image is already loaded — no fetch needed, no blank frame.
  const flipPanel   = isForward ? sR : sL;
  const existingImg = flipPanel?.querySelector("img");
  const frontClone  = existingImg ? existingImg.cloneNode() : null;

  // Panel UNDER the flipper: set to the new destination page immediately.
  // It is fully hidden by the flipper at t=0 so the image can load silently.
  if (isForward) {
    if (sR) sR.innerHTML = mkImg(newRight);
  } else {
    if (sL) sL.innerHTML = mkImg(newLeft);
  }

  const w = spread.offsetWidth / 2;
  const h = spread.offsetHeight;

  // ── FLIPPER ────────────────────────────────────────────────────────────────
  const flipper = document.createElement("div");
  Object.assign(flipper.style, {
    position:        "absolute",
    top:             "0",
    width:           w + "px",
    height:          h + "px",
    transformStyle:  "preserve-3d",
    zIndex:          "20",
    left:            isForward ? w + "px" : "0px",
    transformOrigin: isForward ? "left center" : "right center",
    willChange:      "transform",
  });

  // ── Front face: the currently visible page (cloned → always loaded) ─────────
  const front = document.createElement("div");
  front.className = "book-flipper-face book-flipper-front";
  if (frontClone) {
    frontClone.className = "book-page-img";
    front.appendChild(frontClone);
  } else {
    front.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on front face (darkens toward the fold seam)
  const curlShadow = document.createElement("div");
  curlShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to right,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);"
      : "background:linear-gradient(to left,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.25) 30%,transparent 65%);",
  ].join("");
  front.appendChild(curlShadow);

  // ── Back face: the new incoming page (shown as the page lands) ──────────────
  // Forward: flipper sweeps right→left, back face lands on LEFT → show nLeft
  // Backward: flipper sweeps left→right, back face lands on RIGHT → show nRight
  const backSrc   = isForward ? nLeft  : nRight;
  const backClass = isForward ? (newIsWide ? 'wide-split-left' : '') : (newIsWide ? 'wide-split-right' : '');
  const back = document.createElement("div");
  back.className = "book-flipper-face book-flipper-back";
  if (backSrc) {
    const bi = new Image();
    bi.className = `book-page-img${backClass ? ' ' + backClass : ''}`;
    bi.src = backSrc;
    back.appendChild(bi);
  } else {
    back.innerHTML = `<div class="book-page-blank"></div>`;
  }

  // Curl-shadow on back face (mirrored direction)
  const backShadow = document.createElement("div");
  backShadow.style.cssText = [
    "position:absolute;top:0;left:0;right:0;bottom:0;",
    "pointer-events:none;z-index:3;opacity:0;",
    isForward
      ? "background:linear-gradient(to left,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);"
      : "background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.15) 35%,transparent 65%);",
  ].join("");
  back.appendChild(backShadow);

  flipper.appendChild(front);
  flipper.appendChild(back);

  // ── Cast-shadow on the stationary page ─────────────────────────────────────
  const castShadow = document.createElement("div");
  Object.assign(castShadow.style, {
    position:      "absolute",
    top:           "0",
    width:         w + "px",
    height:        h + "px",
    left:          isForward ? "0px" : w + "px",
    zIndex:        "19",
    pointerEvents: "none",
    opacity:       "0",
    background:    isForward
      ? "linear-gradient(to left,rgba(0,0,0,0.55) 0%,transparent 65%)"
      : "linear-gradient(to right,rgba(0,0,0,0.55) 0%,transparent 65%)",
  });
  spread.appendChild(castShadow);
  spread.appendChild(flipper);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const DURATION = 520;
  let startTime  = null;
  let done       = false;
  let midUpdated = false; // flag: update opposite panel once at ~50% (hidden by flipper)

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(ts) {
    if (done) return;
    if (!startTime) startTime = ts;

    const raw = Math.min((ts - startTime) / DURATION, 1);
    const et  = ease(raw);
    const angle = isForward ? -180 * et : 180 * et;

    flipper.style.transform = `rotateY(${angle}deg)`;

    // At ~50% the flipper is edge-on and covers the opposite panel completely.
    // Update it now so the image has the remaining ~260ms to decode before reveal.
    if (!midUpdated && raw >= 0.48) {
      midUpdated = true;
      if (isForward) {
        if (sL) sL.innerHTML = mkImg(nLeft,  newIsWide ? 'wide-split-left'  : '');
      } else {
        if (sR) sR.innerHTML = mkImg(nRight, newIsWide ? 'wide-split-right' : '');
      }
    }

    // Shadow intensity peaks at 90° fold (sin curve)
    const peak = Math.sin(et * Math.PI);
    curlShadow.style.opacity = (peak * 0.90).toFixed(3);
    backShadow.style.opacity = (peak * 0.82).toFixed(3);
    castShadow.style.opacity = (peak * 0.68).toFixed(3);

    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      finish();
    }
  }

  function finish() {
    if (done) return;
    done = true;
    flipper.remove();
    castShadow.remove();
    // Ensure both panels show correct content before handing back
    if (!midUpdated) {
      if (isForward) { if (sL) sL.innerHTML = mkImg(nLeft,  newIsWide ? 'wide-split-left'  : ''); }
      else           { if (sR) sR.innerHTML = mkImg(nRight, newIsWide ? 'wide-split-right' : ''); }
    }
    onComplete();
  }

  requestAnimationFrame(frame);
  setTimeout(finish, DURATION + 300); // safety fallback
}

// Pre-fetch images for the next 3 spreads (6 pages) and 1 previous spread
function preloadBookPages(idx, pages) {
  const srcs = new Set();
  for (let offset = -2; offset <= 8; offset += 2) {
    const si = idx + offset;
    if (si < 0 || si >= pages.length) continue;
    const { right, left } = getBookSpread(si, pages);
    if (right) srcs.add(right);
    if (left)  srcs.add(left);
  }
  srcs.forEach(src => { const img = new Image(); img.src = src; });
}

// ============================================================================
// LTR — Western double-page spread (left-first) with the same 3-D flip engine
// ============================================================================

let _ltrFlipAnimating = false;

function renderLTRSpread() {
  if (!state.currentChapter?.pages) return;
  const pages    = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  if (!pageWrap) return;

  const idx   = state.currentPageIndex;
  const total = pages.length;

  const spread = getLTRSpread(idx, pages);
  const { left: leftImg, right: rightImg, isWide } = spread;

  const zoom = state.zoomLevel ?? 1.0;
  pageWrap.className = 'reader-content reading-mode-ltr' + _sharpClass();
  pageWrap.style.overflow = '';

  const step = isWide ? 1 : 2;
  const pv = $("prevPage"), nx = $("nextPage");
  const hasNextCh = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  const hasPrevCh = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
  if (pv) { pv.style.display = "block"; pv.disabled = idx === 0 && !hasPrevCh; }
  if (nx) { nx.style.display = "block"; nx.disabled = idx + step >= total && !hasNextCh; }

  const l = idx + 1, r = idx + 2;
  $("pageCounter").textContent = isWide
    ? `${l} / ${total}`
    : (r <= total ? `${l}-${r} / ${total}` : `${l} / ${total}`);

  const wrapZoomStyle = '';

  const leftHtml = leftImg
    ? `<img class="book-page-img${isWide ? ' wide-split-left' : ''}" src="${escapeHtml(leftImg)}" alt="Page ${idx + 1}">`
    : `<div class="book-page-blank"></div>`;
  const rightHtml = rightImg
    ? `<img class="book-page-img${isWide ? ' wide-split-right' : ''}" src="${escapeHtml(rightImg)}" alt="Page ${isWide ? idx + 1 : idx + 2}">`
    : `<div class="book-page-blank"></div>`;

  pageWrap.innerHTML = `
    <div class="book-reader-wrap" id="bookReaderWrap" ${wrapZoomStyle}>
      <div class="book-spread" id="bookSpread">
        <div class="book-side book-left" id="bookLeft">${leftHtml}</div>
        <div class="book-spine"></div>
        <div class="book-side book-right" id="bookRight">${rightHtml}</div>
      </div>
    </div>
  `;

  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  attachBookDragEvents();
  preloadBookPages(idx, pages);
  _applyBookZoom();
  _applyWideSplitIfNeeded(idx, pages);
}

function navigateLTR(direction) {
  const pages = state.currentChapter?.pages;
  if (!pages) return;
  const idx   = state.currentPageIndex;
  const total = pages.length;
  let newIdx;

  if (direction === "forward") {
    const step = pages[idx]?.isWide ? 1 : 2;
    if (idx + step >= total) { _ltrFlipAnimating = false; goToNextChapter(); return; }
    newIdx = idx + step;
  } else {
    if (idx === 0) { _ltrFlipAnimating = false; goToPrevChapter(); return; }
    const backStep = pages[idx - 1]?.isWide ? 1 : 2;
    newIdx = Math.max(0, idx - backStep);
  }

  if (_ltrFlipAnimating) return;

  _ltrFlipAnimating = true;
  playBookFlip(direction, idx, newIdx, pages, () => {
    state.currentPageIndex = newIdx;
    _ltrFlipAnimating = false;
    const total2   = pages.length;
    const isWide2  = pages[newIdx]?.isWide;
    const step2    = isWide2 ? 1 : 2;
    const l = newIdx + 1, r = newIdx + 2;
    const ctr = $("pageCounter");
    if (ctr) ctr.textContent = isWide2 ? `${l} / ${total2}` : (r <= total2 ? `${l}-${r} / ${total2}` : `${l} / ${total2}`);
    const pv2 = $("prevPage"), nx2 = $("nextPage");
    const hasNextCh2 = getNextChapterIndex(state.currentChapterIndex) >= 0 && getNextChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    const hasPrevCh2 = getPrevChapterIndex(state.currentChapterIndex) < (state.allChapters?.length || 0);
    if (pv2) pv2.disabled = newIdx === 0 && !hasPrevCh2;
    if (nx2) nx2.disabled = newIdx + step2 >= total2 && !hasNextCh2;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, newIdx);
    preloadBookPages(newIdx, pages);
    attachBookDragEvents();
    _applyWideSplitIfNeeded(newIdx, pages);
  }, getLTRSpread);
}

function applyZoom(delta) {
  state.zoomLevel = Math.min(3.0, Math.max(0.5, Math.round((state.zoomLevel + delta) * 10) / 10));
  updateZoomUI();

  if (state.settings.readingMode === "rtl" || state.settings.readingMode === "ltr") {
    _applyBookZoom();
    return;
  }

  renderPage();
}

// Apply zoom transform to bookSpread only (overflow:hidden on container = no scrollbars)
function _applyBookZoom() {
  const spread = document.getElementById('bookSpread');
  const zoom = state.zoomLevel ?? 1.0;
  if (spread) {
    spread.style.transform = zoom !== 1.0 ? `scale(${zoom})` : '';
    spread.style.transformOrigin = 'center center';
  }
}

// Returns the CSS class suffix for the current sharpness level
function _sharpClass() {
  const s = state.settings.lineSharpness || 0;
  return s > 0 ? ` sharp-${s}` : '';
}

// ============================================================================
// PDF READER
// ============================================================================
async function initPDFChapter(pdfUrl) {
  if (!window.pdfjsLib) { state.currentChapter.pages = []; return; }
  try {
    state.pdfDocument = await pdfjsLib.getDocument(pdfUrl).promise;
    const n = state.pdfDocument.numPages;
    state.currentChapter.pages = Array.from({ length: n }, (_, i) => ({ pdfPage: i + 1 }));
  } catch (e) {
    console.error('PDF load error:', e);
    state.currentChapter.pages = [];
    state.pdfDocument = null;
  }
}

async function renderPDFWebtoon() {
  const pageWrap = $('pageWrap');
  if (!state.pdfDocument || !pageWrap) return;
  const pdf = state.pdfDocument;
  const total = pdf.numPages;
  const zoomStyle = state.zoomLevel !== 1.0 ? `style="transform:scale(${state.zoomLevel});transform-origin:top center;"` : '';

  pageWrap.className = 'reader-content reading-mode-webtoon';
  pageWrap.innerHTML = `<div class="page-zoom-wrap webtoon-wrap" id="pdfWebtoonWrap" ${zoomStyle}></div>`;
  const wrap = pageWrap.querySelector('#pdfWebtoonWrap');

  $('pageCounter').textContent = `Webtoon Mode — ${total} pages`;
  $('prevPage').style.display = 'none';
  $('nextPage').style.display = 'none';
  updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);

  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdf.getPage(i);
      const scale    = Math.max(state.zoomLevel, 1) * 1.5;
      const viewport = page.getViewport({ scale });
      const canvas   = document.createElement('canvas');
      canvas.className = 'webtoon-page';
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      // Abort if user navigated away
      if (pageWrap !== $('pageWrap') || !pageWrap.querySelector('#pdfWebtoonWrap')) return;
      wrap.appendChild(canvas);
    } catch (e) {
      console.warn(`PDF webtoon page ${i} error:`, e);
    }
  }

  // Append chapter-end banner
  const nextIdx  = getNextChapterIndex(state.currentChapterIndex);
  const nextCh   = (nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
  const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
  pageWrap.insertAdjacentHTML('beforeend', `
    <div class="chapter-end-wrap">
      ${nextLabel
        ? `<p class="chapter-end-label">Next Chapter</p>
           <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
           <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
        : `<p class="chapter-end-label">You've reached the last chapter!</p>`}
    </div>`);
}

async function renderPDFPageToCanvas(pageNum) {
  const pageWrap = $("pageWrap");
  if (!state.pdfDocument || !pageWrap) return;
  try {
    const pdf  = state.pdfDocument;
    const page = await pdf.getPage(pageNum);
    const scale    = Math.max(state.zoomLevel, 1) * 1.5;
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.className = 'page-img';
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const isLast   = pageNum === pdf.numPages;
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx >= 0 && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
    const nextLabel = nextCh ? (nextCh.name || `Chapter ${nextCh.chapter || nextIdx + 1}`) : null;
    const endBanner = isLast ? `
      <div class="chapter-end-wrap">
        ${nextLabel
          ? `<p class="chapter-end-label">Next Chapter</p>
             <p class="chapter-end-name">${escapeHtml(nextLabel)}</p>
             <button class="btn chapter-next-btn" onclick="goToNextChapter()">Read Next \u2192</button>`
          : `<p class="chapter-end-label">Last chapter reached!</p>`}
      </div>` : '';

    pageWrap.className = 'reader-content';
    pageWrap.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'page-zoom-wrap';
    if (state.zoomLevel !== 1.0) wrap.style.cssText = `transform:scale(${state.zoomLevel});transform-origin:top center;`;
    wrap.appendChild(canvas);
    pageWrap.appendChild(wrap);
    if (endBanner) pageWrap.insertAdjacentHTML('beforeend', endBanner);

    $("pageCounter").textContent = `${pageNum} / ${pdf.numPages}`;
    $("prevPage").style.display = 'block';
    $("nextPage").style.display = 'block';
    $("prevPage").disabled = false;
    $("nextPage").disabled = false;
    pageWrap.scrollTop = 0;
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, pageNum - 1);
  } catch (e) {
    console.error('PDF render error:', e);
  }
}

function updateZoomUI() {
  const el = $("zoomLevel");
  if (el) el.textContent = `${Math.round(state.zoomLevel * 100)}%`;
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings() {
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>⚙️ Settings</h2>
        <button class="btn secondary" id="closeSettings">✕</button>
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
        <div class="settings-divider"></div>
        <div class="setting-group">
          <button class="btn secondary" id="clearReadBtn">Clear Reading History</button>
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
}

// ============================================================================
// CUSTOM LISTS VIEW
// ============================================================================

// ============================================================================
// CUSTOM LISTS VIEW (REMOVED)
// ============================================================================

// ============================================================================
// ANALYTICS VIEW
// ============================================================================

async function renderAnalyticsView() {
  try {
    const data = await api("/api/analytics");
    state.analytics = data;
    const a    = data.analytics || {};
    const dist = data.statusDistribution || {};

    // Stat cards
    const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
    el("anaChapters",  a.totalChaptersRead || 0);
    el("anaTime",      formatTime(a.totalTimeSpent || 0));
    el("anaMeanScore", data.meanScore != null ? data.meanScore.toFixed(2) : "—");
    el("anaLibrary",   data.totalFavorites || 0);

    // Status distribution
    const distEl = $("statusDistribution");
    if (distEl) {
      const total = Object.values(dist).reduce((n, v) => n + v, 0) || 1;
      const rows = [
        { key: "reading",       label: "Reading" },
        { key: "completed",     label: "Completed" },
        { key: "on_hold",       label: "On Hold" },
        { key: "plan_to_read",  label: "Plan to Read" },
        { key: "dropped",       label: "Dropped" },
      ];
      distEl.innerHTML = rows.map(r => `
        <div class="dist-row">
          <span class="dist-label">${r.label}</span>
          <div class="dist-bar-wrap">
            <div class="dist-bar dist-bar-${r.key}" style="width:${((dist[r.key] || 0) / total * 100).toFixed(1)}%"></div>
          </div>
          <span class="dist-count">${dist[r.key] || 0}</span>
        </div>`).join("");
    }

    // Recent sessions
    const sessionsEl = $("recentSessions");
    if (sessionsEl) {
      const sessions = (a.readingSessions || []).slice(0, 10);
      if (!sessions.length) {
        sessionsEl.innerHTML = `<div class="muted">No reading sessions yet. Start reading!</div>`;
      } else {
        sessionsEl.innerHTML = sessions.map(s => `
          <div class="session-item">
            <span class="session-manga">${escapeHtml(s.mangaId || "Unknown")}</span>
            <span class="session-duration">${formatTime(s.duration || 0)}</span>
            <span class="session-date">${new Date(s.date).toLocaleDateString()}</span>
          </div>`).join("");
      }
    }
  } catch (e) {
    console.error("Analytics error:", e);
  }
}

// ============================================================================
// ACHIEVEMENTS SYSTEM
// ============================================================================

async function checkAndUnlockAchievements() {
  try {
    // Fetch current analytics data
    const anaData = await api("/api/analytics");
    const a = anaData.analytics || {};
    
    // Build analytics object for achievement checking
    const analytics = {
      totalChaptersRead: a.totalChaptersRead || state.readChapters.size,
      totalTimeSpent:    a.totalTimeSpent || 0,
      totalFavorites:    (anaData.totalFavorites || 0),
      completedCount:    (anaData.statusDistribution?.completed || 0),
      totalLists:        (anaData.totalLists || 0),
      statusDistribution: anaData.statusDistribution || {},
      dailyStreak:       a.dailyStreak || 0
    };

    // Check achievements using AchievementManager
    const newlyUnlocked = achievementManager.checkAchievements(analytics);
    
    // Send newly unlocked achievements to backend
    for (const achievementId of newlyUnlocked) {
      try {
        await api("/api/achievements/unlock", {
          method: "POST",
          body: JSON.stringify({ achievementId })
        });
        
        // Show toast notification
        const achievement = achievementManager.getAchievement(achievementId);
        if (achievement) {
          showToast(
            `Achievement Unlocked! 🏆`, 
            `${achievement.name}: ${achievement.description}`, 
            "success"
          );
        }
      } catch (err) {
        console.error(`Failed to sync achievement ${achievementId}:`, err);
      }
    }
    
    // Update state
    state.earnedAchievements = achievementManager.unlockedAchievements;
    updateApBadge();
  } catch (e) {
    console.error('Error checking achievements:', e);
  }
}

async function renderAchievementsGrid() {
  const grid = $("achievementsGrid");
  if (!grid) return;
  
  try {
    // Get achievement stats
    const stats = achievementManager.getStats();
    const countEl = $("achievementCount");
    if (countEl) countEl.textContent = `${stats.unlocked}/${stats.total}`;

    // Render achievements by category
    const html = achievementManager.categories.map(category => {
      const achievements = achievementManager.getAchievementsByCategory(category.id);
      
      return `
        <div class="achievement-category">
          <h3 class="achievement-category-title">${escapeHtml(category.name)}</h3>
          <p class="achievement-category-desc">${escapeHtml(category.description)}</p>
          <div class="achievement-category-grid">
            ${achievements.map(a => {
              const isUnlocked = achievementManager.isUnlocked(a.id);
              const rarityClass = a.rarity || 'common';
              
              return `
                <div class="achievement-item ${isUnlocked ? 'earned' : 'locked'} rarity-${rarityClass}">
                  <div class="achievement-icon">
                    <i data-feather="${escapeHtml(a.icon)}" ${isUnlocked ? '' : 'class="locked-icon"'}></i>
                  </div>
                  <div class="achievement-info">
                    <h4>${escapeHtml(a.name)}</h4>
                    <p>${escapeHtml(a.description)}</p>
                    ${a.points ? `<span class="achievement-points">+${a.points} pts</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html || '<div class="muted">No achievements available.</div>';
    
    // Initialize Feather icons if available
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
    
  } catch (e) {
    console.error('Error rendering achievements:', e);
    grid.innerHTML = `<div class="muted">Could not load achievements.</div>`;
  }
}

// ============================================================================
// DRAGON BALL EASTER EGG HELPERS
// ============================================================================

function dragonBallSVG(n) {
  return `<img src="/dragon-ball-${n}.png" class="db-sprite" draggable="false" alt="${n}-star Dragon Ball">`;
}

function summonShenlong() {
  addBonusAP(50);
  updateApBadge();
  const overlay = document.getElementById('shenlong-overlay');
  const gif = document.getElementById('shenlong-gif');
  if (overlay) {
    // Reset GIF src so it replays from frame 1 every time
    if (gif) {
      const src = gif.getAttribute('src');
      gif.setAttribute('src', '');
      requestAnimationFrame(() => gif.setAttribute('src', src));
    }
    overlay.classList.remove('hidden');
    overlay.classList.add('shenlong-show');
    setTimeout(() => {
      overlay.classList.add('shenlong-hide');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('shenlong-show', 'shenlong-hide');
      }, 800);
    }, 2800);
  }
  showToast('🐉 Shenlong appears!', 'Your wish is granted — +50 AP!', 'success');
}

// ============================================================================
// ACHIEVEMENTS PAGE VIEW
// ============================================================================

function renderAchievementsView() {
  const content = document.getElementById('achPageContent');
  if (!content) return;
  updateApBadge();

  // Secret Dragon Ball easter egg: collect all 7 dragon balls → Shenlong grants 50 AP
  const db = document.getElementById('achDragonBall');
  if (db) {
    if (!db.dataset.eggBound) {
      db.dataset.eggBound = '1';
      db.dataset.ball = '1';
      let eggTimer = null;
      db.addEventListener('click', () => {
        let ball = parseInt(db.dataset.ball || '1');
        db.style.transform = `scale(1.25) rotate(${ball * 52}deg)`;
        setTimeout(() => { db.style.transform = ''; }, 250);
        clearTimeout(eggTimer);
        if (ball === 7) {
          // All 7 balls collected — summon Shenlong!
          db.dataset.ball = '1';
          setTimeout(() => { db.innerHTML = dragonBallSVG(1); }, 3000);
          summonShenlong();
        } else {
          ball++;
          db.dataset.ball = ball;
          db.innerHTML = dragonBallSVG(ball);
          // Reset if idle for 3 seconds without reaching 7
          eggTimer = setTimeout(() => {
            db.dataset.ball = '1';
            db.innerHTML = dragonBallSVG(1);
          }, 3000);
        }
      });
    }
    // Render current ball if empty
    if (!db.innerHTML.trim()) db.innerHTML = dragonBallSVG(1);
  }
  const total    = achievementManager.achievements.length;
  const unlocked = achievementManager.unlockedAchievements.size;
  const countEl  = document.getElementById('achievementCount');
  if (countEl) countEl.textContent = `${unlocked}/${total}`;
  const html = achievementManager.categories.map(cat => {
    const achs = achievementManager.getAchievementsByCategory(cat.id);
    const catUnlocked = achs.filter(a => achievementManager.isUnlocked(a.id)).length;
    return `
      <div class="ach-page-category">
        <div class="ach-category-header">
          <h3>${escapeHtml(cat.name)}</h3>
          <span class="ach-category-count">${catUnlocked}/${achs.length}</span>
        </div>
        <div class="ach-category-grid">
          ${achs.map(a => {
            const isUnlocked = achievementManager.isUnlocked(a.id);
            return `
              <div class="ach-card ${isUnlocked ? 'ach-unlocked' : 'ach-locked'} ach-rarity-${escapeHtml(a.rarity || 'common')}" title="${escapeHtml(a.description)}">
                <div class="ach-card-icon"><i data-feather="${escapeHtml(a.icon)}"></i></div>
                <div class="ach-card-name">${escapeHtml(a.name)}</div>
                ${isUnlocked
                  ? `<div class="ach-card-ap">+1 AP</div>`
                  : `<div class="ach-card-locked-desc">${escapeHtml(a.description)}</div>`}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  content.innerHTML = html || '<div class="muted">No achievements yet.</div>';
  if (typeof feather !== 'undefined') feather.replace();
}

// ============================================================================
// SHOP VIEW
// ============================================================================

function renderShopView() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  updateApBadge();
  const ap        = getAvailableAP();
  const purchased = getPurchasedThemes();
  const active    = getActiveTheme();
  grid.innerHTML = SHOP_THEMES.map(t => {
    const owned    = purchased.includes(t.id);
    const isActive = active === t.id;
    const canAfford = ap >= t.cost;
    let btn, badge = '';
    if (isActive) {
      btn = `<button class="shop-btn shop-btn-active" disabled>Active</button>`;
      badge = `<span class="shop-active-badge">✓ Active</span>`;
    } else if (owned) {
      btn = `<button class="shop-btn shop-btn-owned" onclick="setActiveTheme('${t.id}');renderShopView()">Apply</button>`;
    } else if (t.cost === 0) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="addPurchasedTheme('${t.id}');setActiveTheme('${t.id}');renderShopView()">Get Free</button>`;
    } else if (canAfford) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="buyTheme('${t.id}')">Buy</button>`;
    } else {
      btn = `<button class="shop-btn shop-btn-afford" disabled>Need ${t.cost} AP</button>`;
    }
    const costStr = t.cost === 0 ? '<span style="color:var(--success)">Free</span>' : `<span class="ap-star">⭐</span>${t.cost} AP`;
    return `
      <div class="shop-card ${isActive ? 'shop-active' : owned ? 'shop-owned' : ''}">
        <div class="shop-card-preview" style="background:${t.preview}"></div>
        <div class="shop-card-body">
          <div class="shop-card-name">${escapeHtml(t.name)}</div>
          <div class="shop-card-desc">${escapeHtml(t.desc)}</div>
          <div class="shop-card-footer">
            <span class="shop-card-cost">${costStr}</span>
            ${btn}
          </div>
          ${badge}
        </div>
      </div>`;
  }).join('');
}

function buyTheme(id) {
  const t  = SHOP_THEMES.find(x => x.id === id);
  if (!t) return;
  const ap = getAvailableAP();
  if (ap < t.cost) { showToast('Not enough AP', `You need ${t.cost} AP`, 'warning'); return; }
  spendAP(t.cost);
  addPurchasedTheme(id);
  setActiveTheme(id);
  showToast('Theme unlocked! 🎨', t.name, 'success');
  renderShopView();
  updateApBadge();
}

// ============================================================================
// GENRE / AUTHOR NAVIGATION
// ============================================================================

async function searchByAuthor(author) {
  if (!author) return;
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  setView("advanced-search");
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  state.advancedFilters.tags.clear();
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(c => c.classList.remove("active"));
  const statusEl = $("advancedSearchStatus");
  const resultsDiv = $("advancedResults");
  if (statusEl) statusEl.textContent = `Searching author: "${author}"...`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/authorSearch`, {
      method: "POST",
      body: JSON.stringify({ authorName: author })
    });
    const results = result.results || [];
    if (!results.length) {
      if (resultsDiv) resultsDiv.innerHTML = `<div class="muted">No results found for author "${escapeHtml(author)}"</div>`;
      if (statusEl) statusEl.textContent = `0 result(s) for author "${author}"`;
      return;
    }
    renderMangaGrid(resultsDiv, results);
    if (statusEl) statusEl.textContent = `${results.length} result(s) for author "${author}"`;
  } catch (e) {
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

function searchByGenre(genre) {
  // Clear existing tag filters and add the selected genre
  state.advancedFilters.tags.clear();
  state.advancedFilters.tags.add(genre.toLowerCase());

  // Navigate to advanced search view
  setView("advanced-search");

  // Visually activate the matching genre chip in the advanced search UI
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(chip => {
    const chipTag = chip.dataset.tag || "";
    const isMatch = chipTag.toLowerCase() === genre.toLowerCase();
    chip.classList.toggle("active", isMatch);
    if (isMatch) state.advancedFilters.tags.add(chipTag);
  });

  // Pre-fill the search input and run the search
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  advancedSearch();
}

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

async function advancedSearch(page = 1) {
  const query   = $("advancedSearchInput").value.trim();
  const orderBy = $("advancedOrderBy").value;
  const publicationStatus = $("advancedPublicationStatus")?.value || "";
  const contentRating = $("advancedContentRating")?.value || "";
  const format = $("advancedFormat")?.value || "";
  const selectedGenres = Array.from(document.querySelectorAll('#genreGrid input[type="checkbox"]:checked')).map(cb => cb.value);

  if (!state.currentSourceId) {
    $("advancedSearchStatus").textContent = "Select a source first.";
    return;
  }

  state.advSearchPage = page;
  $("advancedSearchStatus").textContent = "Searching...";
  try {
    let result;
    if (selectedGenres.length > 0) {
      // Use byGenres endpoint so genres are resolved to real tag UUIDs on the backend
      result = await api(`/api/source/${state.currentSourceId}/byGenres`, {
        method: "POST",
        body: JSON.stringify({ genres: selectedGenres, orderBy })
      });
    } else {
      result = await api(`/api/source/${state.currentSourceId}/search`, {
        method: "POST",
        body: JSON.stringify({ query: query || "", page, orderBy })
      });
    }

    let results = result.results || [];
    const hasNextPage = result.hasNextPage || false;
    state.advSearchHasNextPage = hasNextPage;

    // Client-side filtering for additional criteria
    if (query && selectedGenres.length > 0) {
      const q = query.toLowerCase();
      results = results.filter(m => (m.title || "").toLowerCase().includes(q));
    }

    if (publicationStatus) {
      results = results.filter(m => m.status?.toLowerCase() === publicationStatus.toLowerCase());
    }

    if (contentRating) {
      results = results.filter(m => m.contentRating?.toLowerCase() === contentRating.toLowerCase());
    }

    const resultsDiv = $("advancedResults");
    if (!results.length) {
      resultsDiv.innerHTML = `<div class="muted">No results found</div>`;
      $("advancedSearchStatus").textContent = "0 result(s) found";
      renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
      return;
    }
    renderMangaGrid(resultsDiv, results);
    $("advancedSearchStatus").textContent = `${results.length} result(s) found — Page ${page}`;
    renderPagination("advancedSearchPagination", page, hasNextPage, "advSearchGoToPage");
  } catch (e) {
    $("advancedSearchStatus").textContent = `Error: ${e.message}`;
    renderPagination("advancedSearchPagination", page, false, "advSearchGoToPage");
  }
}

async function randomManga() {
  const sourceIds = Object.keys(state.installedSources).filter(id => id !== 'local');
  const statusEl = $('advancedSearchStatus');

  // Build a combined pool: library items (any source) + online search from a random source/page
  let pool = [];

  // Add library
  for (const m of (state.favorites || [])) {
    if (m.sourceId && m.sourceId !== 'local') pool.push({ id: m.id, sourceId: m.sourceId });
  }

  // Add online results from a random installed source on a random page
  if (sourceIds.length > 0) {
    const src = sourceIds[Math.floor(Math.random() * sourceIds.length)];
    const pg  = Math.floor(Math.random() * 15) + 1;
    if (statusEl) statusEl.textContent = 'Finding random manga...';
    try {
      const res = await api(`/api/source/${src}/search`, {
        method: 'POST',
        body: JSON.stringify({ query: '', page: pg })
      });
      for (const m of (res.results || [])) pool.push({ id: m.id, sourceId: src });
    } catch (_) { /* use library only if network fails */ }
  }

  if (!pool.length) {
    if (statusEl) statusEl.textContent = 'No manga found. Install a source or add manga to your library.';
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const prevSource = state.currentSourceId;
  state.currentSourceId = pick.sourceId;
  state._fromRandom = true;
  if (statusEl) statusEl.textContent = '';
  try {
    await loadMangaDetails(pick.id, 'random');
  } catch (e) {
    state.currentSourceId = prevSource;
    state._fromRandom = false;
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

function initAdvancedFilters() {
  // Auto-refresh on dropdown changes
  const dropdownFilters = [
    "advancedOrderBy",
    "advancedPublicationStatus",
    "advancedContentRating",
    "advancedFormat"
  ];

  dropdownFilters.forEach(id => {
    const el = $(id);
    if (el) {
      el.onchange = () => {
        const view = document.querySelector("#view-advanced-search");
        if (view && !view.classList.contains("hidden")) advancedSearch();
      };
    }
  });

  // Genre checkboxes — debounced auto-search
  const genreGrid = $("genreGrid");
  if (genreGrid) {
    genreGrid.addEventListener("change", () => {
      const view = document.querySelector("#view-advanced-search");
      if (view && !view.classList.contains("hidden")) advancedSearch();
    });
  }

  // Clear genres button
  const clearBtn = $("clearGenresBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      document.querySelectorAll('#genreGrid input[type="checkbox"]').forEach(cb => cb.checked = false);
      const view = document.querySelector("#view-advanced-search");
      if (view && !view.classList.contains("hidden")) advancedSearch();
    };
  }
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

function setView(view, context = {}, replace = false) {
  // Update navigation manager
  navigationManager.navigateTo(view, context, replace);

  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "analytics", "history", "achievements", "shop"];
  for (const v of ALL_VIEWS) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }

  // Sync sidebar active state
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle("active", linkView === view);
  });

  // On-enter actions per view
  if (view === "library") {
    renderLibrary();
  } else if (view === "analytics") {
    renderAnalyticsView();
  } else if (view === "history") {
    renderHistoryView();
  } else if (view === "achievements") {
    renderAchievementsView();
  } else if (view === "shop") {
    renderShopView();
  } else if (view === "manga-details") {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Restore context if available
    const ctx = navigationManager.getContext();
    if (ctx.mangaId && ctx.sourceId) {
      // Context is already set, renderMangaDetails will use it
    }
  }
}

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
  if (zoomReset) zoomReset.onclick = () => { state.zoomLevel = 1.0; updateZoomUI(); renderPage(); };

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
  if (randBtn)  randBtn.onclick  = randomManga;

  // Initialize advanced filters
  initAdvancedFilters();

  // Library status filter
  const libFilter = $("libraryStatusFilter");
  if (libFilter) libFilter.onchange = renderLibrary;

  // Language selector
  const langSelector = $("languageSelector");
  if (langSelector) {
    langSelector.value = currentLanguage;
    langSelector.onchange = () => setLanguage(langSelector.value);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

(async function main() {
  initTheme();
  applyTranslations();
  loadSettings();
  applyTheme(getActiveTheme());

  // Configure PDF.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  
  // Load achievements from JSON
  try {
    await achievementManager.loadAchievements();
  } catch (err) {
    console.error('Failed to load achievements:', err);
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
