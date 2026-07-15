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
  /** @type {Record<string, string>} key "mangaId:sourceId" -> custom cover URL */
  coverOverrides: {},
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
    bookshelfStripeUseSourceColor: false,
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false,
    lineSharpness: 0,
    hideNsfw: false,
    showHomeSearch: true,
    homeSourceMode: 'all',
    homeSelectedSourceIds: [],
    showLibrarySourceBadge: true,
    showChaptersLeft: false,
    statusBadgeLocation: 'cover',
    anilistAutoSync: true,
    anilistAutoImportOnConnect: false,
    anilistAutoCategorize: true,
    autoWebtoonDetect: true,
    pageFlipAnimation: true,

    // === Biblioteca ===
    displayMode: 'detailed', // 'compact' | 'detailed' | 'list'
    showCompactInfo: false,
    hideLibraryStatusAndChapters: false,
    mangasPerRow: 6, // 5-14
    overlays: {
      downloaded: true,
      unread: true,
      local: true,
    },
    showBookSpine: true,
    readerBackground: 'black',
    webtoonTurnButtonsEnabled: true,
    webtoonTurnButtonPlacement: 'corners',
    autoLoadNextChapter: false,
    readerNoiseEnabled: false,
    readerNoiseIntensity: 50,
    readerNoiseSource: 'generated',
    readerNoiseGifFile: '',
    autoScrollPointSpeeds: [0.2, 0.5, 1.0, 2.0, 3.5],
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

  // ── Chapter page progress cache ───────────────────────────────────────────
  /** @type {Record<string, number>} key "mangaId:chapterId" → total pages known for that chapter */
  lastReadPageTotals: {},

  // ── Chapter count cache ───────────────────────────────────────────────────
  /** @type {Record<string, number>} mangaId → total number of chapters (cached from last fetch) */
  chapterCountCache: {}
};

function getMangaKey(manga) {
  if (!manga) return ':';
  const sourceId = String(manga.sourceId || manga.source || '');
  const mangaId = String(manga.id || manga.mangaId || '');
  return `${sourceId}:${mangaId}`;
}

function isMangaInLibrary(manga, activeSourceId) {
  if (!manga) return false;
  const sourceId = String(manga.sourceId || manga.source || activeSourceId || '');
  const mangaId = String(manga.id || manga.mangaId || '');
  const targetKey = `${sourceId}:${mangaId}`;

  const matchingFavorites = state.favorites.filter(fav => {
    const favSourceId = String(fav.sourceId || fav.source || '');
    const favMangaId = String(fav.id || fav.mangaId || '');

    // Rule 1: strict match
    if (favSourceId && `${favSourceId}:${favMangaId}` === targetKey) {
       return true;
    }
    // Rule 4: If sourceId is missing from existing favorite, do not silently treat it as a match.
    // Legacy id-only fallback is restricted.
    return false;
  });

  const result = matchingFavorites.length > 0;
  
  if (window.SCROLLSCAPE_DEBUG_LIBRARY_MEMBERSHIP) {
    console.log({
      stage: "membership-check",
      title: manga.title,
      id: mangaId,
      sourceId: sourceId,
      mangaKey: targetKey,
      favoritesCount: state.favorites.length,
      matchingFavorites,
      renderable: result,
      filteredOutReason: result ? null : "Not in favorites"
    });
  }
  return result;
}

function isBadIdentityValue(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return !s || s === 'undefined' || s === 'null' || s === '[object object]';
}

function normalizeLibraryPayload(manga, fallbackSourceId) {
  if (!manga || typeof manga !== 'object') return null;

  const url = String(manga.url || manga.href || manga.sourceUrl || '').trim();

  let id = String(
    manga.id ||
    manga.mangaId ||
    manga.slug ||
    ''
  ).trim();

  if (isBadIdentityValue(id) && url) {
    const match = url.match(/\/manga\/([^/?#]+)/i);
    if (match) id = decodeURIComponent(match[1]);
  }

  const sourceId = String(
    manga.sourceId ||
    manga.source ||
    fallbackSourceId ||
    ''
  ).trim();

  const title = String(manga.title || manga.name || '').trim();

  if (
    isBadIdentityValue(id) ||
    isBadIdentityValue(sourceId) ||
    isBadIdentityValue(title)
  ) {
    return null;
  }

  return {
    ...manga,
    id,
    mangaId: id,
    slug: String(manga.slug || id).trim(),
    sourceId,
    title,
    cover: manga.cover || manga.image || manga.coverUrl || '',
    url
  };
}

async function ensureMangaInLibrary(manga, fallbackSourceId) {
  const payload = normalizeLibraryPayload(manga, fallbackSourceId);

  if (!payload) {
    if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
      console.warn({ stage: "add-request-error", errorName: "ValidationError", errorMessage: "Invalid payload", payload });
    }
    showToast("Error", "Could not update Library.", "error");
    return false;
  }

  const key = getMangaKey(payload);

  if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
    console.log({
      stage: "before-add-request",
      title: payload.title,
      id: payload.id,
      mangaId: payload.mangaId,
      slug: payload.slug,
      sourceId: payload.sourceId,
      url: payload.url,
      mangaKey: key,
      payload,
      endpoint: "/api/library/add",
      currentSourceId: state.currentSourceId
    });
  }

  if (isMangaInLibrary(payload)) {
    return true;
  }

  try {
    const response = await fetch("/api/library/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mangaId: payload.mangaId, sourceId: payload.sourceId, manga: payload })
    });
    
    const responseBody = await response.json();
    const favoritesCountBefore = state.favorites.length;

    if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
      console.log({
        stage: "after-add-response",
        endpoint: "/api/library/add",
        status: response.status,
        ok: response.ok,
        responseBody,
        favoritesCountBefore
      });
    }

    if (!response.ok || !responseBody.ok) {
      throw new Error(responseBody.error || "Backend rejected payload");
    }

    const libData = await api("/api/library");
    state.favorites = Array.isArray(libData.favorites) ? libData.favorites : (Array.isArray(libData) ? libData : state.favorites);

    const saved = state.favorites.some(f => getMangaKey(f) === key);
    
    if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
      console.log({ stage: "after-add-verification", saved, favoritesCountAfter: state.favorites.length });
    }

    if (!saved) {
      showToast("Error", "Could not update Library.", "error");
      return false;
    }

    return true;
  } catch (e) {
    if (window.SCROLLSCAPE_DEBUG_LIBRARY_UPDATE) {
      console.error({ stage: "add-request-error", endpoint: "/api/library/add", payload, errorName: e.name, errorMessage: e.message });
    }
    showToast("Error", "Could not update Library.", "error");
    return false;
  }
}

async function ensureMangaNotInLibrary(mangaId, sourceId) {
  const mangaIdStr = String(mangaId);
  const sourceIdStr = String(sourceId || state.currentSourceId);
  const res = await api("/api/library/remove", { method: "POST", body: JSON.stringify({ mangaId: mangaIdStr, sourceId: sourceIdStr }) });
  const libData = await api("/api/library");
  state.favorites = Array.isArray(libData.favorites) ? libData.favorites : (Array.isArray(libData) ? libData : state.favorites);
  return res;
}


