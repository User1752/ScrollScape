'use strict';

const { safeId, isSafeUrl, fetchText } = require('../../helpers');

/**
 * Creates source lifecycle operations (install/uninstall) decoupled from routes.
 */
function createSourceLifecycleService({
  readStore,
  writeStore,
  sourcePath,
  loadSourceFromFile,
  clearSourceCache,
  listAvailableSourcesFromRepos,
  invalidatePopularAll,
}) {
  async function installSource(rawId, repos = []) {
    const sid = safeId(rawId);
    if (!sid) {
      const err = new Error('Invalid source ID');
      err.statusCode = 400;
      throw err;
    }

    const available = await listAvailableSourcesFromRepos(repos);
    const source = available.find(entry => entry.id === sid);
    if (!source) {
      const err = new Error('Source not found in any repo');
      err.statusCode = 404;
      throw err;
    }
    if (source.kind !== 'js') {
      const err = new Error('Source type not supported');
      err.statusCode = 400;
      throw err;
    }
    if (!isSafeUrl(source.codeUrl)) {
      const err = new Error('Source code URL is not valid');
      err.statusCode = 400;
      throw err;
    }

    const code = await fetchText(source.codeUrl);
    const targetPath = sourcePath(sid);
    await require('fs').promises.writeFile(targetPath, code, 'utf8');

    const mod = loadSourceFromFile(sid);
    return {
      sid,
      installed: {
        id: sid,
        name: mod.meta.name || source.name,
        version: mod.meta.version || source.version,
        author: mod.meta.author || source.author || '',
        icon: mod.meta.icon || source.icon || '',
        installedAt: new Date().toISOString(),
      },
    };
  }

  async function removeSource(rawId) {
    const sid = safeId(rawId);
    if (!sid) {
      const err = new Error('Invalid source ID');
      err.statusCode = 400;
      throw err;
    }

    const fs = require('fs');
    const filePath = sourcePath(sid);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    return { sid };
  }

  async function installById(rawId) {
    const store = await readStore();
    const { sid, installed } = await installSource(rawId, store.repos);

    clearSourceCache(sid);
    invalidatePopularAll();

    store.installedSources[sid] = installed;
    await writeStore(store);

    return { ok: true, installed: store.installedSources[sid] };
  }

  async function uninstallById(rawId) {
    const { sid } = await removeSource(rawId);

    const store = await readStore();
    delete store.installedSources[sid];
    await writeStore(store);

    clearSourceCache(sid);
    invalidatePopularAll();

    return { ok: true };
  }

  return {
    installById,
    uninstallById,
  };
}

module.exports = {
  createSourceLifecycleService,
};
