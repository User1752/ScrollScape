// ============================================================================
// APPLICATION STATE
// Single global object that holds all runtime state for the ScrollScape frontend.
// Mutated in-place by feature modules; never replaced wholesale.
// ============================================================================

const state = {
  // ── Source registry ──────────────────────────────────────────────────────
  repos: [],
  availableSources: [],
  /** @type {Record<string, {id:string, name:string}>} */
  installedSources: {},
  /** @type {string|null} Currently selected source id */
  currentSourceId: null,

  // ── Browsing context ─────────────────────────────────────────────────────
  /** @type {object|null} Manga object currently open in the details view */
  currentManga: null,
  /** @type {object|null} Chapter object currently open in the reader */
  currentChapter: null,
  currentChapterIndex: 0,
  currentPageIndex: 0,

  // ── Library ──────────────────────────────────────────────────────────────
  /** @type {object[]} */
  favorites: [],
  /** @type {object[]} */
  history: [],
  /** @type {Set<string>} Keys of the form "mangaId:chapterId" */
  readChapters: new Set(),
  /** @type {Set<string>} Flagged chapters (same key format) */
  flaggedChapters: new Set(),
  /** @type {object[]} Full chapter list for the currently open manga */
  allChapters: [],
  chaptersReversed: false,

  // ── Advanced-search filters ───────────────────────────────────────────────
  /** @type {Set<string>} */
  selectedGenres: new Set(),
  /** @type {Set<string>} */
  selectedStatuses: new Set(),
  sortBy: "relevance",

  // ── User preferences (persisted to localStorage) ─────────────────────────
  settings: {
    language: "en",
    readingMode: "ltr",   // "ltr" | "rtl" | "webtoon"
    libraryDefaultStatusFilter: "all",
    libraryBookshelf3d: false,
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false,
    lineSharpness: 0,
    hideNsfw: false,
    showLibrarySourceBadge: true,
    showChaptersLeft: false,
    statusBadgeLocation: 'cover',
    anilistAutoSync: true,
    anilistAutoImportOnConnect: false,
    anilistAutoCategorize: true,
    autoWebtoonDetect: true,
    pageFlipAnimation: true,
    readerBackground: 'black',
    webtoonTurnButtonsEnabled: true,
    webtoonTurnButtonPlacement: 'corners',
    autoLoadNextChapter: false,
    readerNoiseEnabled: false,
    readerNoiseIntensity: 50,
    readerNoiseSource: 'generated',
    readerNoiseGifFile: '',
  },

  // ── Reading status & analytics ────────────────────────────────────────────
  /** @type {Record<string, {status:string, updatedAt:string, manga:object}>} */
  readingStatus: {},
  analytics: {},
  /** @type {Set<string>} IDs of achievements the user has unlocked */
  earnedAchievements: new Set(),

  // ── AniList sync metadata (populated from server on load) ────────────────
  /** @type {{lastImportAt:string|null, importedCount:number, overwriteCount:number}} */
  anilistSync: null,

  // ── Categories (custom lists) ─────────────────────────────────────────────
  /** @type {Array<{id:string, name:string, description:string, mangaItems:object[]}>} */
  customLists: [],

  // ── Reader ────────────────────────────────────────────────────────────────
  /** Current zoom multiplier (1.0 = 100 %) */
  zoomLevel: 1.0,
  /** Timestamp (ms) when the current chapter was opened */
  readerSessionStart: null,
  autoScroll: { enabled: false, speed: 2 },

  // ── Advanced-search pagination ────────────────────────────────────────────
  advancedFilters: {
    orderBy: "relevance",
    statuses: new Set(),
    tags: new Set()
  },
  searchPage: 1,
  searchQuery: "",
  searchHasNextPage: false,
  advSearchPage: 1,
  advSearchHasNextPage: false,

  // ── Local manga ───────────────────────────────────────────────────────────
  /** @type {object[]} Local manga entries returned by /api/local/list */
  localManga: [],
  /** pdf.js document handle for the currently open PDF */
  pdfDocument: null,

  // ── User ratings cache ────────────────────────────────────────────────────
  /** @type {Record<string, number>} mangaId → 1-10 score */
  ratings: {},

  // ── AniList progress tracking ─────────────────────────────────────────────
  /** @type {Record<string, number>} mangaId → highest chapter number read */
  highestReadChapter: {},

  // ── Chapter count cache ───────────────────────────────────────────────────
  /** @type {Record<string, number>} mangaId → total number of chapters (cached from last fetch) */
  chapterCountCache: {}
};
