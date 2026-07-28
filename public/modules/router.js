// ============================================================================
// URL ROUTER
// Mirrors the in-app view state (NavigationManager + setView) onto the
// browser's address bar and history, so URLs are shareable/bookmarkable and
// the browser's native Back/Forward buttons and page refresh work.
// ============================================================================

const ROUTER_VIEW_PATHS = {
  discover: '/',
  library: '/library',
  'advanced-search': '/search',
  analytics: '/analytics',
  history: '/history',
  achievements: '/achievements',
  themes: '/themes',
  shop: '/shop',
  customize: '/customize',
  calendar: '/calendar',
  'system-health': '/system-health',
};

const ROUTER_PATH_VIEWS = Object.fromEntries(
  Object.entries(ROUTER_VIEW_PATHS).map(([view, path]) => [path, view])
);

/** Set while restoring state from a URL (popstate or initial load) so we don't re-push the same navigation. */
let _routerRestoring = false;

function _routerSlugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** @returns {string} URL pathname representing the given view/context. */
function buildPathForView(view, context) {
  if (view === 'manga-details' && context?.mangaId && context?.sourceId) {
    const base = `/manga/${encodeURIComponent(context.sourceId)}/${encodeURIComponent(context.mangaId)}`;
    const slug = _routerSlugify(context.title);
    return slug ? `${base}/${slug}` : base;
  }
  return ROUTER_VIEW_PATHS[view] || '/';
}

/** @returns {{view:string, context:object}} Parsed target for the current location.pathname. */
function parsePathToRoute() {
  const path = window.location.pathname;

  const mangaMatch = path.match(/^\/manga\/([^/]+)\/([^/]+)(?:\/[^/]*)?\/?$/);
  if (mangaMatch) {
    return {
      view: 'manga-details',
      context: {
        sourceId: decodeURIComponent(mangaMatch[1]),
        mangaId: decodeURIComponent(mangaMatch[2]),
      },
    };
  }

  const view = ROUTER_PATH_VIEWS[path.replace(/\/+$/, '') || '/'];
  return { view: view || 'discover', context: {} };
}

/** Push (or replace) a history entry so the address bar matches the given view/context. */
function syncUrlForView(view, context) {
  if (_routerRestoring) return;
  const path = buildPathForView(view, context);
  if (path === window.location.pathname) return;
  window.history.pushState({ view, context }, '', path);
}

/** Apply a parsed/serialized route to the app without re-touching browser history. */
async function _routerApplyRoute(route) {
  _routerRestoring = true;
  try {
    if (route.view === 'manga-details' && route.context.mangaId && route.context.sourceId) {
      // loadMangaDetails() itself calls setView() only after its network
      // fetch resolves — await it so the guard stays up for that whole
      // window instead of releasing before setView() ever runs.
      await loadMangaDetails(route.context.mangaId, undefined, route.context.title || '', false, route.context.sourceId);
    } else {
      setView(route.view, route.context, true);
    }
  } finally {
    _routerRestoring = false;
  }
}

window.addEventListener('popstate', (e) => {
  const route = e.state || parsePathToRoute();
  _routerApplyRoute(route);
});

/** Called once at startup to open whatever view the current URL points at. */
function routerRestoreInitialRoute() {
  const route = parsePathToRoute();
  window.history.replaceState({ view: route.view, context: route.context }, '', window.location.pathname);
  if (route.view === 'discover') return; // Already the default rendered view.
  _routerApplyRoute(route);
}
