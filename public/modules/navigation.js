// ============================================================================
// NAVIGATION MANAGER
// Manages a browser-history-like stack of views with context preservation.
// Persists across page reloads via localStorage.
// ============================================================================

class NavigationManager {
  /**
   * @param {number} [maxStackSize=50] Maximum entries kept in the back-stack
   */
  constructor(maxStackSize = 50) {
    this.maxStackSize = maxStackSize;
    this.stack = [];
    this.currentView = null;
    this.currentContext = {};
    this.storageKey = 'scrollscape_nav_stack';
    this.loadFromStorage();
  }

  /**
   * Navigate to a new view, pushing the current one onto the back-stack.
   *
   * @param {string} view - View identifier (e.g. "discover", "manga-details")
   * @param {object} [context={}] - Arbitrary data associated with the view
   * @param {boolean} [replace=false] - Replace current entry instead of pushing
   */
  navigateTo(view, context = {}, replace = false) {
    if (this.currentView && !replace) {
      this.stack.push({
        view: this.currentView,
        context: { ...this.currentContext },
        timestamp: Date.now()
      });
      if (this.stack.length > this.maxStackSize) this.stack.shift();
    } else if (replace && this.stack.length > 0) {
      this.stack[this.stack.length - 1] = {
        view: this.currentView,
        context: { ...this.currentContext },
        timestamp: Date.now()
      };
    }
    this.currentView = view;
    this.currentContext = context;
    this.saveToStorage();
  }

  /**
   * Pop the back-stack and return to the previous view.
   *
   * @returns {{view:string, context:object}} Previous entry (defaults to "discover")
   */
  goBack() {
    if (this.stack.length === 0) return { view: 'discover', context: {} };
    const previous = this.stack.pop();
    this.currentView = previous.view;
    this.currentContext = previous.context;
    this.saveToStorage();
    return previous;
  }

  /** @returns {boolean} Whether the back-stack has any entries */
  canGoBack() { return this.stack.length > 0; }

  /**
   * Inspect the previous view without modifying the stack.
   *
   * @returns {{view:string, context:object}|null}
   */
  peekPrevious() {
    if (this.stack.length === 0) return null;
    return { ...this.stack[this.stack.length - 1] };
  }

  /** Reset the navigation stack and forget the current view. */
  clear() {
    this.stack = [];
    this.currentView = null;
    this.currentContext = {};
    this.saveToStorage();
  }

  /** @returns {Array} Full copy of the navigation history */
  getHistory() { return [...this.stack]; }

  /** @returns {object} Shallow copy of the current context */
  getContext() { return { ...this.currentContext }; }

  /**
   * Merge updates into the current context without pushing a new stack entry.
   *
   * @param {object} updates
   */
  updateContext(updates) {
    this.currentContext = { ...this.currentContext, ...updates };
    this.saveToStorage();
  }

  // ── Storage helpers ───────────────────────────────────────────────────────

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        stack: this.stack,
        currentView: this.currentView,
        currentContext: this.currentContext
      }));
    } catch (err) {
      // dbg is always available — debug.js is loaded before this module.
      dbg.warn(dbg.ERR_STATE, 'NavigationManager: failed to persist stack', err); // eslint-disable-line no-undef
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.stack          = data.stack          || [];
        this.currentView    = data.currentView    || null;
        this.currentContext = data.currentContext || {};
      }
    } catch (err) {
      dbg.warn(dbg.ERR_STATE, 'NavigationManager: failed to restore stack', err); // eslint-disable-line no-undef
      this.stack = [];
      this.currentView = null;
      this.currentContext = {};
    }
  }
}

// ── Global singletons ─────────────────────────────────────────────────────
// AchievementManager is provided by achievement-manager.js (loaded before this file).
const navigationManager  = new NavigationManager();
const achievementManager = new AchievementManager();  // eslint-disable-line no-undef
