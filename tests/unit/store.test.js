const test = require('node:test');
const assert = require('node:assert');
const { StorageService } = require('../../server/store');

test('Store Service - Defaults and Normalization', async (t) => {
  await t.test('readStore generates defaults when empty', async () => {
    const storageService = new StorageService();
    const store = {};
    storageService.normaliseStore(store);
    assert.ok(Array.isArray(store.history));
    assert.ok(typeof store.readingStatus === 'object');
    assert.ok(typeof store.installedSources === 'object');
  });
});

