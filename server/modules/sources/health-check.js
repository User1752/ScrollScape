/**
 * server/modules/sources/health-check.js — Source health check logic
 *
 * Tests each installed source by calling search() with a generic query and
 * verifying that the response conforms to the expected shape { results, hasNextPage }.
 *
 * A configurable timeout (default 7 s) prevents a hung source from blocking
 * the startup sequence or the health-check API endpoint indefinitely.
 *
 * Used both at startup (fire-and-forget) and via GET /api/sources/health-check.
 */

'use strict';

const HEALTH_CHECK_TIMEOUT_MS = 15_000;
// Use a query with 3+ chars so scrapers that branch on short queries
// (e.g. MangaKatana) don't fall into the slower trending/homepage path.
const HEALTH_CHECK_QUERY      = 'one piece';

/**
 * @param {{ readStore: Function, loadSourceFromFile: Function }} deps
 */
function createSourceHealthCheckService({ readStore, loadSourceFromFile }) {
  /**
   * Runs a lightweight search() probe on every installed source.
   *
   * @returns {Promise<{ id: string, name: string, ok: boolean, error?: string }[]>}
   */
  async function runHealthCheck() {
    let store;
    try {
      store = await readStore();
    } catch (e) {
      return [{ id: 'store', name: 'Store', ok: false, error: `Failed to read store: ${e.message}` }];
    }

    const ids = Object.keys(store.installedSources || {});
    if (!ids.length) return [];

    const results = await Promise.all(ids.map(async (id) => {
      const name = store.installedSources[id]?.name || id;

      let mod;
      try {
        mod = loadSourceFromFile(id);
      } catch (e) {
        return { id, name, ok: false, error: `Failed to load module: ${e.message}` };
      }

      if (typeof mod.search !== 'function') {
        return { id, name, ok: false, error: 'search() is not implemented.' };
      }

      try {
        let result;

        // Prefer a dedicated healthCheck() method if the source exposes one.
        // This allows scrapers (e.g. MangaKatana) to do a single fast probe
        // instead of a full search() with retries and backoff.
        if (typeof mod.healthCheck === 'function') {
          const probe = mod.healthCheck();
          result = (probe && typeof probe.then === 'function')
            ? await Promise.race([
                probe,
                new Promise((_, rej) =>
                  setTimeout(() => rej(new Error('timeout')), HEALTH_CHECK_TIMEOUT_MS)
                ),
              ])
            : probe;

          if (!result || typeof result !== 'object') {
            return { id, name, ok: false, error: 'healthCheck() did not return an object.' };
          }
          // temporarilyUnavailable = site is up but blocked/rate-limited; module is healthy.
          if (result.temporarilyUnavailable) {
            return { id, name, ok: true, note: result.error || 'Temporarily unavailable' };
          }
          return { id, name, ok: result.ok !== false };
        }

        // Fallback: call search() with a meaningful query.
        const searchProbe = mod.search(HEALTH_CHECK_QUERY, 1);
        result = (searchProbe && typeof searchProbe.then === 'function')
          ? await Promise.race([
              searchProbe,
              new Promise((_, rej) =>
                setTimeout(() => rej(new Error('timeout')), HEALTH_CHECK_TIMEOUT_MS)
              ),
            ])
          : searchProbe;

        // Expected shape: { results: Array, hasNextPage: boolean }
        // temporarilyUnavailable: true means the site is reachable but currently
        // rate-limited or behind Cloudflare — the module itself is healthy.
        if (!result || typeof result !== 'object') {
          return { id, name, ok: false, error: 'search() did not return an object.' };
        }
        if (result.temporarilyUnavailable) {
          return { id, name, ok: true, note: 'Site temporarily unavailable (rate-limited or Cloudflare)' };
        }
        if (!Array.isArray(result.results)) {
          return { id, name, ok: false, error: 'search() did not return { results: [] }.' };
        }

        return { id, name, ok: true };
      } catch (e) {
        return { id, name, ok: false, error: `probe threw: ${e.message}` };
      }
    }));

    return results;
  }

  /**
   * Logs health check results to the console.
   * Intended to be called at startup (fire-and-forget).
   *
   * @returns {Promise<void>}
   */
  async function logHealthCheck() {
    let results;
    try {
      results = await runHealthCheck();
    } catch (e) {
      console.error('[HealthCheck] Unexpected error during source health check:', e.message);
      return;
    }

    if (!results.length) {
      console.log('[HealthCheck] No installed sources to check.');
      return;
    }

    const ok      = results.filter(r => r.ok);
    const failing = results.filter(r => !r.ok);

    console.log(`[HealthCheck] Sources: ${ok.length} OK, ${failing.length} failing.`);

    for (const r of ok) {
      console.log(`[HealthCheck]   ✓ ${r.name} (${r.id})`);
    }
    for (const r of failing) {
      console.warn(`[HealthCheck]   ✗ ${r.name} (${r.id}): ${r.error}`);
    }
  }

  return { runHealthCheck, logHealthCheck };
}

module.exports = { createSourceHealthCheckService };
