'use strict';

function createRepoService({
  readStore,
  writeStore,
  listAvailableSourcesFromRepos,
  detectRepoKind,
  autoInstallLocalSources,
  loadSourceFromFile,
  isSafeUrl,
  fetchJson,
  sha1Short,
}) {
  async function getState() {
    await autoInstallLocalSources();
    const store = await readStore();
    const availableSources = await listAvailableSourcesFromRepos(store.repos);

    const installedSources = { ...(store.installedSources || {}) };
    for (const sid of Object.keys(installedSources)) {
      try {
        const mod = loadSourceFromFile(sid);
        installedSources[sid] = {
          ...installedSources[sid],
          capabilities: {
            trending: typeof mod.trending === 'function' && mod.meta?.supportsTrending !== false,
            recentlyAdded: typeof mod.recentlyAdded === 'function' && mod.meta?.supportsRecentlyAdded !== false,
            latestUpdates: typeof mod.latestUpdates === 'function' && mod.meta?.supportsLatestUpdates !== false,
            popularAllTime: mod.meta?.supportsPopularAllTime === true,
          },
        };
      } catch (_) {
        installedSources[sid] = {
          ...installedSources[sid],
          capabilities: {
            trending: false,
            recentlyAdded: false,
            latestUpdates: false,
            popularAllTime: false,
          },
        };
      }
    }

    return {
      repos: store.repos,
      availableSources,
      installedSources,
    };
  }

  async function addRepo({ url, repoJson } = {}) {
    let repoData;
    let repoUrl;

    if (typeof url === 'string' && url.startsWith('http')) {
      if (!isSafeUrl(url)) {
        const err = new Error('URL is not allowed (private/loopback)');
        err.statusCode = 400;
        throw err;
      }
      repoData = await fetchJson(url);
      repoUrl = url;
    } else if (repoJson) {
      repoData = repoJson;
      repoUrl = `localrepo:${sha1Short(JSON.stringify(repoData))}`;
    } else {
      const err = new Error('Valid URL or repoJson required');
      err.statusCode = 400;
      throw err;
    }

    const kind = detectRepoKind(repoData);
    if (kind === 'unknown') {
      const err = new Error('Unrecognised repo format');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    if (!store.repos.some(r => r.url === repoUrl)) {
      const name = repoData?.name || (kind === 'tachiyomi' ? 'Tachiyomi Repo' : repoUrl);
      store.repos.push({ url: repoUrl, name, kind });
      await writeStore(store);
    }

    return { ok: true, kind };
  }

  async function deleteRepo(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) {
      const err = new Error('url query parameter required');
      err.statusCode = 400;
      throw err;
    }

    const store = await readStore();
    store.repos = store.repos.filter(r => r.url !== url);
    await writeStore(store);
    return { ok: true };
  }

  return {
    getState,
    addRepo,
    deleteRepo,
  };
}

module.exports = { createRepoService };