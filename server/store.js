/**
 * store.js — In-memory store cache backed by disk persistence
 *
 * Refactored for:
 *  • Atomic writes: using a .tmp file and fs.rename/renameSync to prevent corruption on power loss.
 *  • Maintainability: cleaner event hooks and bounded flush logic.
 *  • Security: strict path configurations, safer parsing, and default state generation.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const { createStorePersistence } = require('./modules/store/persistence');
const { normaliseStore } = require('./modules/store/schema');

class StorageService {
  constructor() {
    this.storePath = null;
    this.store = null;
    this.isShuttingDown = false;
    this.persistence = createStorePersistence({ fs, fsp });

    this.handleTermination = this.handleTermination.bind(this);
  }

  configure(storePath) {
    if (!storePath || typeof storePath !== 'string') {
      throw new Error('Invalid storePath provided to store.configure()');
    }
    this.storePath = storePath;
  }

  async readStore() {
    if (!this.store) {
      if (!this.storePath) throw new Error('Store accessed before configure() was called.');
      const raw = await fsp.readFile(this.storePath, 'utf8');
      this.store = JSON.parse(raw);
      this.normaliseStore(this.store);
    }
    return this.store;
  }

  async writeStore(store) {
    this.store = store;
    this.persistence.queueDebouncedFlush({
      getStore: () => this.store,
      getStorePath: () => this.storePath,
      isShuttingDown: () => this.isShuttingDown,
    });
  }

  async initStore() {
    if (!this.storePath) throw new Error('Store initialized before configure() was called.');
    if (!fs.existsSync(this.storePath)) return;

    try {
      const raw = await fsp.readFile(this.storePath, 'utf8');
      this.store = JSON.parse(raw);
    } catch (e) {
      console.error(`[Store] Initialization failed: ${e.message}. Starting fresh.`);
      this.store = {};
    }

    this.normaliseStore(this.store);
  }

  flushStoreSync() {
    this.isShuttingDown = this.persistence.flushStoreSync({
      store: this.store,
      storePath: this.storePath,
      isShuttingDown: this.isShuttingDown,
    });
  }

  normaliseStore(s) {
    return normaliseStore(s);
  }
  handleTermination() {
    this.flushStoreSync();
    process.exit(0);
  }
}

const storageService = new StorageService();
process.on('SIGINT', storageService.handleTermination);
process.on('SIGTERM', storageService.handleTermination);

module.exports = {
  StorageService,
  configure: storageService.configure.bind(storageService),
  readStore: storageService.readStore.bind(storageService),
  writeStore: storageService.writeStore.bind(storageService),
  initStore: storageService.initStore.bind(storageService),
  flushStoreSync: storageService.flushStoreSync.bind(storageService),
  normaliseStore: storageService.normaliseStore.bind(storageService),
};
