'use strict';

function createStorePersistence({ fs, fsp, logger = console, delayMs = 300 }) {
  let flushTimer = null;

  function flushStoreSync({ store, storePath, isShuttingDown }) {
    if (!store || isShuttingDown || !storePath) return isShuttingDown;

    try {
      const tmpPath = `${storePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
      fs.renameSync(tmpPath, storePath);
      return true;
    } catch (err) {
      logger.error(`[Store] Shutdown flush error: ${err.message}`);
      return true;
    }
  }

  function queueDebouncedFlush({ getStore, getStorePath, isShuttingDown }) {
    if (flushTimer) clearTimeout(flushTimer);
    if (isShuttingDown()) return;

    flushTimer = setTimeout(async () => {
      flushTimer = null;
      const store = getStore();
      const storePath = getStorePath();
      if (isShuttingDown() || !store || !storePath) return;

      const tmpPath = `${storePath}.tmp`;
      try {
        await fsp.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
        await fsp.rename(tmpPath, storePath);
      } catch (err) {
        logger.error(`[Store] Async write error: ${err.message}`);
      }
    }, delayMs);
  }

  return {
    flushStoreSync,
    queueDebouncedFlush,
  };
}

module.exports = { createStorePersistence };