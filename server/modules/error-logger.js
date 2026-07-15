'use strict';
const path = require('path');
const fsp = require('fs').promises;

const DATA_DIR = path.resolve(__dirname, '../../data');
const LOG_PATH = path.join(DATA_DIR, 'error-log.json');

let writePromise = Promise.resolve();

/**
 * Records an error to data/error-log.json safely (with mutex)
 */
async function recordError(errObj) {
  const op = writePromise.then(async () => {
    try {
      let entries = [];
      try {
        const raw = await fsp.readFile(LOG_PATH, 'utf8');
        entries = JSON.parse(raw);
        if (!Array.isArray(entries)) entries = [];
      } catch {
        entries = [];
      }

      const existing = entries.find(e => e.area === errObj.area && e.message === errObj.message);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.lastSeenAt = new Date().toISOString();
        if (errObj.details) Object.assign(existing.details, errObj.details);
      } else {
        entries.unshift({
          code: errObj.code || 'ERR',
          area: errObj.area || 'system',
          message: errObj.message,
          details: errObj.details || {},
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          count: 1
        });
      }

      if (entries.length > 50) entries.length = 50;
      await fsp.writeFile(LOG_PATH, JSON.stringify(entries, null, 2), 'utf8');
    } catch (e) {
      console.error('[ErrorLogger] fail:', e.message);
    }
  });

  writePromise = op;
  return op;
}

async function clearErrors() {
  const op = writePromise.then(async () => {
    try {
      await fsp.writeFile(LOG_PATH, JSON.stringify([], null, 2), 'utf8');
    } catch (e) {
      console.error('[ErrorLogger] fail clear:', e.message);
    }
  });
  writePromise = op;
  return op;
}

module.exports = { recordError, clearErrors };
