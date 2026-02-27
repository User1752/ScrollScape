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
  selectedGenres: new Set(),
  selectedStatuses: new Set(),
  sortBy: "relevance",
  settings: {
    language: "en",
    readingMode: "ltr",
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false
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
  advSearchHasNextPage: false
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

    renderSourceSelect();
    await Promise.all([
      loadPopularToday(),
      loadRecentlyAdded(),
      loadLatestUpdates()
    ]);
    await updateStats();
    renderLibrary();

    // Trigger recommendations if library has content
    if (state.favorites.length > 0) loadRecommendations();
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
    sel.onchange = () => { 
      state.currentSourceId = sel.value;
      // Reload homepage content when source changes
      loadPopularToday();
      loadRecentlyAdded();
      loadLatestUpdates();
    };
  }
}

// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "", page: 1 })
    });
    const list = result.results || [];
    if (!list.length) { 
      row.innerHTML = `<div class="muted">No manga found.</div>`; 
      return; 
    }
    row.innerHTML = list.slice(0, 10).map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
  } catch (e) {
    console.error("Error loading popular manga:", e);
    row.innerHTML = `<div class="muted">Error loading manga from ${state.installedSources[state.currentSourceId]?.name || state.currentSourceId}</div>`;
  }
}

async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "", page: 1, orderBy: "createdAt" })
    });
    const list = result.results || [];
    if (!list.length) { 
      row.innerHTML = `<div class="muted">No manga found.</div>`; 
      return; 
    }
    renderMangaGrid(row, list.slice(0, 12));
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
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "", page: 1, orderBy: "latestUploadedChapter" })
    });
    const list = result.results || [];
    if (!list.length) { 
      row.innerHTML = `<div class="muted">No manga found.</div>`; 
      return; 
    }
    renderMangaGrid(row, list.slice(0, 12));
  } catch (e) {
    console.error("Error loading latest updates:", e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

function mangaCardHTML(m) {
  const genres = (m.genres || []).slice(0, 3);
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}">
      <div class="manga-card-cover">
        ${m.cover
          ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy">`
          : '<div class="no-cover">?</div>'}
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
          ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy">` : `<div class="no-cover">?</div>`}
        </div>
        <div class="history-info">
          <h3 class="history-title">${escapeHtml(m.title)}</h3>
          ${m.author ? `<p class="history-author">✍️ ${escapeHtml(m.author)}</p>` : ""}
          ${genres.length ? `<div class="history-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
          ${date ? `<p class="history-date">🕐 ${date}</p>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn history-view-btn" data-mid="${escapeHtml(m.id)}">View Details</button>
          <button class="btn btn-start-reading-detail history-read-btn" data-mid="${escapeHtml(m.id)}">&#9654; Start Reading</button>
          <button class="history-delete-btn" title="Remove from history" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">[x]</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".history-view-btn").forEach(btn => {
    btn.onclick = () => loadMangaDetails(btn.dataset.mid);
  });
  container.querySelectorAll(".history-read-btn").forEach(btn => {
    btn.onclick = () => startReading(btn.dataset.mid);
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
    el.onclick = () => loadMangaDetails(el.dataset.mangaId);
  });
}

// ============================================================================
// RECOMMENDATIONS
// Based on genres of manga in user's library
// ============================================================================

async function loadRecommendations() {
  const section = $("recommendedSection");
  const row     = $("recommendedRow");
  if (!section || !row || !state.currentSourceId) return;

  // Build genre profile from library
  const genreProfile = new Map();
  for (const m of state.favorites) {
    for (const g of (m.genres || [])) {
      genreProfile.set(g.toLowerCase(), (genreProfile.get(g.toLowerCase()) || 0) + 1);
    }
  }
  if (genreProfile.size === 0) return;

  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "followedCount" })
    });

    const libraryIds = new Set(state.favorites.map(m => m.id));
    const scored = (result.results || [])
      .filter(m => !libraryIds.has(m.id))
      .map(m => {
        const score = (m.genres || []).reduce((n, g) => n + (genreProfile.get(g.toLowerCase()) || 0), 0);
        return { ...m, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (scored.length === 0) return;
    section.style.display = "block";
    row.innerHTML = scored.map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
  } catch (e) {
    // Recommendations failing silently is acceptable
  }
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

  if ($("libraryCount")) {
    $("libraryCount").textContent = `${favs.length} manga`;
  }

  if (favs.length === 0) {
    grid.innerHTML = `<div class="muted">No manga found. Add your favorites or change the filter!</div>`;
    return;
  }

  grid.innerHTML = favs.map(manga => {
    const key    = `${manga.id}:${manga.sourceId}`;
    const status = state.readingStatus[key]?.status;
    const statusBadge = status
      ? `<div class="library-card-status status-badge-${status}">${statusLabel(status).split(' ')[0]}</div>`
      : "";
    return `
      <div class="library-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || state.currentSourceId)}">
        <div class="library-card-cover">
          ${manga.cover ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}" loading="lazy">` : '<div class="no-cover">?</div>'}
          ${statusBadge}
          <div class="library-card-overlay">
            <button class="btn-read">Continue Reading</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
          <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
          ${status ? `<div style="margin-top:0.3rem"><span class="status-badge status-badge-${status}">${statusLabel(status)}</span></div>` : ""}
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".library-card").forEach(card => {
    const mangaId  = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    card.onclick = async (e) => {
      // Preserve source context when opening from library
      const prevSource = state.currentSourceId;
      state.currentSourceId = sourceId;
      await loadMangaDetails(mangaId, "library");
      if (!state.currentSourceId) state.currentSourceId = prevSource;
    };
  });
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
        ${result.cover ? `
          <div class="manga-cover">
            <a href="${escapeHtml(`https://anilist.co/search/manga?search=${encodeURIComponent(result.title)}`)}" target="_blank" rel="noopener noreferrer" class="cover-anilist-link" title="View on AniList" onclick="event.stopPropagation()">
              <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
              <div class="cover-anilist-hint">View on AniList</div>
            </a>
          </div>` : ""}
        <div class="manga-info">
          <h2 class="manga-title">${escapeHtml(result.title)}</h2>
          ${result.altTitle ? `<p class="manga-alt-title">${escapeHtml(result.altTitle)}</p>` : ""}
          ${result.author  ? `<p class="manga-author">✍️ ${escapeHtml(result.author)}</p>` : ""}
          <div class="manga-meta">
            ${result.status ? `<span class="badge badge-${result.status === 'ongoing' ? 'success' : 'secondary'}">${escapeHtml(result.status)}</span>` : ""}
            ${result.year   ? `<span class="badge">📅 ${escapeHtml(String(result.year))}</span>` : ""}
          </div>
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
            <button class="btn btn-secondary" id="addToListBtn">Add to List</button>
          </div>
        </div>
      </div>
    `;

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

    // Add to custom list
    $("addToListBtn").onclick = () => showAddToListModal(result);

    // Render reading status
    renderReadingStatusSection(result.id, state.currentSourceId);
    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    $("searchStatus").textContent = `Error: ${e.message}`;
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
    let displayChapters = state.allChapters;
    if (state.settings.skipReadChapters) {
      displayChapters = state.allChapters.filter(ch => !isChapterRead(state.currentManga.id, ch.id));
    }
    if (!displayChapters.length) {
      chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "All chapters read" : "No chapters found"}</div>`;
      return;
    }
    chapDiv.innerHTML = `
      <div class="chapters-header">
        <strong>${displayChapters.length} Chapter${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Unread" : "Available"}</strong>
        <div class="chapters-header-actions">
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

  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
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

    const maxIndex = Math.max((result.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);
    state.zoomLevel = 1.0;

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
  if (next < 0) { showToast("Last chapter reached", "", "info"); return; }
  await recordReadingSession();
  const ch = state.allChapters[next];
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

    // Request download from server
    const downloadResult = await api(`/api/download/chapter`, {
      method: "POST",
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        chapterName,
        chapterId,
        sourceId: state.currentSourceId,
        pages: result.pages
      })
    });

    if (downloadResult.success) {
      // Trigger download
      const link = document.createElement('a');
      link.href = downloadResult.downloadUrl;
      link.download = downloadResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("Download Complete", `${chapterName} downloaded successfully!`, "success");
    } else {
      showToast("Error", downloadResult.error || "Download failed", "error");
    }
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
    showToast("Bulk Download Started", `Preparing ${selectedChapters.length} chapters...`, "info");

    // Request bulk download from server
    const downloadResult = await api(`/api/download/bulk`, {
      method: "POST",
      body: JSON.stringify({
        mangaTitle: state.currentManga?.title || "Unknown",
        sourceId: state.currentSourceId,
        chapters: selectedChapters
      })
    });

    if (downloadResult.success) {
      // Trigger download
      const link = document.createElement('a');
      link.href = downloadResult.downloadUrl;
      link.download = downloadResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("Download Complete", `${selectedChapters.length} chapters downloaded!`, "success");
    } else {
      showToast("Error", downloadResult.error || "Bulk download failed", "error");
    }
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

  // Extract chapter numbers
  const chapterNumbers = chapters
    .map(ch => parseFloat(ch.chapter))
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

function showReader() {
  $("reader").classList.remove("hidden");
  const chapterName = state.currentChapter?.name || "Chapter";
  $("readerTitle").textContent = `${state.currentManga?.title || ""} — ${chapterName}`;
  updateZoomUI();
}

async function hideReader() {
  stopAutoScroll();
  await recordReadingSession();
  $("reader").classList.add("hidden");
}

// ============================================================================
// AUTOSCROLL
// ============================================================================

let _autoScrollRAF = null;
const AUTOSCROLL_SPEEDS = [0.5, 1.5, 3.0, 5.0, 8.0]; // px per animation frame

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
    const nextWCh  = nextWIdx < (state.allChapters?.length || 0) ? state.allChapters[nextWIdx] : null;
    const nextWLabel = nextWCh ? (nextWCh.name || `Chapter ${nextWCh.chapter || nextWIdx + 1}`) : null;
    pageWrap.innerHTML = `
      <div class="page-zoom-wrap webtoon-wrap" ${zoomStyle}>
        ${validPages.map((p, i) => `<img src="${escapeHtml(p.img)}" alt="Page ${i + 1}" class="webtoon-page" loading="lazy">`).join("")}
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
  } else {
    pageWrap.className = "reader-content";
    if (idx < 0 || idx >= pages.length) return;
    const page     = pages[idx];
    const isLast   = idx === pages.length - 1;
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    const nextIdx  = isLast ? getNextChapterIndex(state.currentChapterIndex) : -1;
    const nextCh   = (isLast && nextIdx < (state.allChapters?.length || 0)) ? state.allChapters[nextIdx] : null;
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

function applyZoom(delta) {
  state.zoomLevel = Math.min(3.0, Math.max(0.5, Math.round((state.zoomLevel + delta) * 10) / 10));
  updateZoomUI();
  renderPage();
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
  $("clearReadBtn").onclick = () => {
    if (confirm("Clear all reading history?")) {
      state.readChapters.clear();
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
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
    el("anaChapters", a.totalChaptersRead || 0);
    el("anaTime",     formatTime(a.totalTimeSpent || 0));
    el("anaStreak",   a.dailyStreak || 0);
    el("anaLibrary",  data.totalFavorites || 0);

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

    // Achievements
    await renderAchievementsGrid();

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
// GENRE NAVIGATION
// ============================================================================

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
    // Build tags array from selected filters
    const tags = [...selectedGenres];
    if (format) tags.push(format);

    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({
        query: query || "",
        page,
        orderBy,
        statuses: publicationStatus ? [publicationStatus] : [],
        tags: tags
      })
    });

    let results = result.results || [];
    const hasNextPage = result.hasNextPage || false;
    state.advSearchHasNextPage = hasNextPage;

    // Client-side filtering for additional criteria
    if (publicationStatus) {
      results = results.filter(m => m.status?.toLowerCase() === publicationStatus.toLowerCase());
    }

    if (contentRating) {
      results = results.filter(m => m.contentRating?.toLowerCase() === contentRating.toLowerCase());
    }

    if (selectedGenres.length > 0) {
      results = results.filter(m => {
        const mt = (m.genres || []).map(g => g.toLowerCase());
        return selectedGenres.some(t => mt.some(g => g.includes(t.toLowerCase())));
      });
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
  if (!state.currentSourceId) { alert("Select a source first."); return; }
  $("advancedSearchStatus").textContent = "Finding random manga...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "", page: 1, orderBy: "random" })
    });
    const results = result.results || [];
    if (results.length > 0) {
      await loadMangaDetails(results[Math.floor(Math.random() * results.length)].id);
    } else {
      $("advancedSearchStatus").textContent = "No manga found";
    }
  } catch (e) {
    $("advancedSearchStatus").textContent = `Error: ${e.message}`;
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

  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "analytics", "history"];
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
  } else if (view === "manga-details") {
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

  // Reader controls
  const closeReader = $("closeReader");
  const prevPage    = $("prevPage");
  const nextPage    = $("nextPage");

  if (closeReader) closeReader.onclick = () => hideReader();

  if (prevPage) prevPage.onclick = () => {
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      state.currentPageIndex += state.settings.readingMode === "rtl" ? 1 : -1;
      renderPage();
    }
  };

  if (nextPage) nextPage.onclick = () => {
    if (state.currentPageIndex === (state.currentChapter?.pages?.length ?? 1) - 1) {
      goToNextChapter();
    } else {
      state.currentPageIndex += state.settings.readingMode === "rtl" ? -1 : 1;
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
    const isRtl = state.settings.readingMode === "rtl";
    if (e.key === "ArrowRight" || e.key === "d") {
      if (state.settings.readingMode !== "webtoon") {
        if (isRtl) { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
        else        { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
      }
    } else if (e.key === "ArrowLeft" || e.key === "a") {
      if (state.settings.readingMode !== "webtoon") {
        if (isRtl) { if (state.currentPageIndex < (state.currentChapter?.pages?.length ?? 1) - 1) { state.currentPageIndex++; renderPage(); } else goToNextChapter(); }
        else        { if (state.currentPageIndex > 0) { state.currentPageIndex--; renderPage(); } else goToPrevChapter(); }
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
  if (advBtn)   advBtn.onclick   = advancedSearch;
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
