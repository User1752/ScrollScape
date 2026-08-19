'use strict';

const path = require('path');
const fsp = require('fs').promises;

function createAchievementService({ readStore, writeStore, achievementsJsonPath } = {}) {
  // achievements.json is a static, read-only catalog bundled with the app
  // code (not user data), so — like data/sources/'s own snapshot — it's
  // meant to resolve relative to wherever this code actually is, packaged
  // .exe or not, rather than the writable DATA_DIR everything else in this
  // service reads/writes through `readStore`/`writeStore`. The 3-level `..`
  // walk this used to do inline baked in an assumption about exactly how
  // deep this file sits in the module tree; callers now compute and inject
  // the path instead, so moving this file doesn't silently break it.
  const achievementsJson = achievementsJsonPath || path.join(__dirname, '..', '..', '..', 'data', 'achievements.json');

  async function getDefinitions() {
    const raw = await fsp.readFile(achievementsJson, 'utf8');
    return JSON.parse(raw);
  }

  async function getAchievements() {
    const store = await readStore();
    return {
      achievements: store.achievements,
      ap: store.ap,
      purchasedThemes: store.purchasedThemes,
      activeTheme: store.activeTheme,
    };
  }

  async function unlockAchievement({ achievementId } = {}) {
    if (!achievementId || typeof achievementId !== 'string') {
      const err = new Error('achievementId (string) required');
      err.statusCode = 400;
      throw err;
    }

    const safeAchId = achievementId.slice(0, 100).replace(/[^a-z0-9_-]/gi, '_');

    const store = await readStore();
    const isNew = !store.achievements.includes(safeAchId);
    if (isNew) {
      store.achievements.push(safeAchId);
      await writeStore(store);
    }

    return { ok: true, isNew, achievements: store.achievements };
  }

  // Consolidates AP wallet + theme ownership into the same store as
  // achievements — see schema.js's normaliseStore() for defaults/shape.
  // Each field is set (not incremented) so the client can push its own
  // already-merged/authoritative value, whether from a single local
  // mutation or a startup reconciliation against localStorage.
  async function updateProgression(patch = {}) {
    const store = await readStore();
    store.ap = store.ap && typeof store.ap === 'object' ? store.ap : { bonus: 0, spent: 0 };

    if (patch.resetAll) {
      store.achievements = [];
      store.ap = { bonus: 0, spent: 0 };
      store.purchasedThemes = ['default'];
      store.activeTheme = 'default';
    } else {
      if (Number.isFinite(patch.apBonus)) {
        store.ap.bonus = Math.max(0, patch.apBonus);
      }
      if (Number.isFinite(patch.apSpent)) {
        store.ap.spent = Math.max(0, patch.apSpent);
      }
      if (Array.isArray(patch.purchasedThemes)) {
        store.purchasedThemes = patch.purchasedThemes
          .filter(id => typeof id === 'string' && id)
          .slice(0, 200)
          .map(id => id.slice(0, 100).replace(/[^a-z0-9_-]/gi, '_'));
        if (!store.purchasedThemes.includes('default')) store.purchasedThemes.unshift('default');
      }
      if (typeof patch.activeTheme === 'string' && patch.activeTheme) {
        store.activeTheme = patch.activeTheme.slice(0, 100).replace(/[^a-z0-9_-]/gi, '_');
      }
    }

    await writeStore(store);
    return {
      ok: true,
      achievements: store.achievements,
      ap: store.ap,
      purchasedThemes: store.purchasedThemes,
      activeTheme: store.activeTheme,
    };
  }

  return {
    getDefinitions,
    getAchievements,
    unlockAchievement,
    updateProgression,
  };
}

module.exports = { createAchievementService };