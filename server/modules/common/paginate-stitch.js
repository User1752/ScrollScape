'use strict';

// Shared "page-stitching" helper for source plugins whose native listing
// pages don't line up with the app's fixed APP_PAGE_SIZE-per-page UI: it
// fetches consecutive native pages and concatenates them until there's
// enough to slice out one app-sized page.
//
// fetchNativePage(n) must return RAW (unfiltered/unsorted) { results,
// hasNextPage[, totalPages][, temporarilyUnavailable, error] } for native
// page n. Filtering/sorting must happen in the caller *after* stitching,
// not per native page — applying it earlier makes the jump-straight-to-
// the-right-native-page math below drift, since a filtered page can
// contribute fewer items than nativePageSize even when the site itself
// has more.
async function fetchStitchedPage(fetchNativePage, appPage, options = {}) {
  const {
    appPageSize = 50,
    nativePageSize = 20,
    propagateTemporarilyUnavailable = false,
    trackTotalPages = false,
  } = options;

  const appPageNum = Math.max(1, Number(appPage) || 1);
  const startIndex = (appPageNum - 1) * appPageSize;
  let nativePage = Math.floor(startIndex / nativePageSize) + 1;
  const skip = startIndex - (nativePage - 1) * nativePageSize;

  let collected = [];
  let hasNext = true;
  let lastError;
  let nativeTotalPages;
  while (collected.length < skip + appPageSize && hasNext) {
    const page = await fetchNativePage(nativePage);
    if (propagateTemporarilyUnavailable && page.temporarilyUnavailable) {
      lastError = page;
      if (!collected.length) return page;
      break;
    }
    if (!page.results.length) { hasNext = false; break; }
    collected = collected.concat(page.results);
    hasNext = page.hasNextPage;
    if (trackTotalPages && Number.isFinite(page.totalPages)) nativeTotalPages = page.totalPages;
    nativePage += 1;
  }

  const slice = collected.slice(skip, skip + appPageSize);
  const hasMore = hasNext || collected.length > skip + appPageSize;
  const out = { results: slice, hasNextPage: hasMore };

  if (propagateTemporarilyUnavailable && lastError && !slice.length) {
    out.temporarilyUnavailable = true;
    out.error = lastError.error;
  }
  if (trackTotalPages) {
    // Convert the native page total into the equivalent count in
    // appPageSize-sized pages, since that's the page counter the client
    // actually shows.
    out.totalPages = Number.isFinite(nativeTotalPages)
      ? Math.max(1, Math.ceil((nativeTotalPages * nativePageSize) / appPageSize))
      : undefined;
  }
  return out;
}

module.exports = { fetchStitchedPage };
