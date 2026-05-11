'use strict';

const path = require('path');
const fsp = require('fs').promises;

function createAchievementService({ readStore, writeStore }) {
  const achievementsJson = path.join(__dirname, '..', '..', '..', 'data', 'achievements.json');

  async function getDefinitions() {
    const raw = await fsp.readFile(achievementsJson, 'utf8');
    return JSON.parse(raw);
  }

  async function getAchievements() {
    const store = await readStore();
    return { achievements: store.achievements };
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

  return {
    getDefinitions,
    getAchievements,
    unlockAchievement,
  };
}

module.exports = { createAchievementService };