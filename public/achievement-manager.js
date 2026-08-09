/**
 * Achievement Manager
 * Manages achievement loading, tracking, and unlocking
 */

// Bundled fallback so the achievements page works even if the API is
// unreachable — kept as an exact copy of data/achievements.json (see
// getDefinitions() in server/modules/achievements/service.js), so there's
// only ever one real set of achievement definitions to maintain; this is
// just what ships with the client for when the server can't be reached.
const _ACHIEVEMENT_FALLBACK = {"version":"1.1.0","lastUpdated":"2026-08-09T00:00:00.000Z","categories":[{"id":"reading","name":"Reading Progress","description":"Achievements related to reading chapters","icon":"book-open","achievements":[{"id":"first_read","name":"First Steps","description":"Read your first chapter","icon":"book","rarity":"common","points":10,"condition":{"type":"stat_check","stat":"totalChaptersRead","operator":">=","value":1}},{"id":"reader_10","name":"Bookworm","description":"Read 10 chapters","icon":"book-open","rarity":"common","points":25,"condition":{"type":"stat_check","stat":"totalChaptersRead","operator":">=","value":10}},{"id":"reader_100","name":"Manga Addict","description":"Read 100 chapters","icon":"award","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"totalChaptersRead","operator":">=","value":100}},{"id":"reader_500","name":"Legend","description":"Read 500 chapters","icon":"star","rarity":"epic","points":500,"condition":{"type":"stat_check","stat":"totalChaptersRead","operator":">=","value":500}},{"id":"reader_1000","name":"Unstoppable","description":"Read 1000 chapters","icon":"star","rarity":"legendary","points":1000,"condition":{"type":"stat_check","stat":"totalChaptersRead","operator":">=","value":1000}}]},{"id":"collection","name":"Library Management","description":"Achievements related to building your library","icon":"library","achievements":[{"id":"first_fav","name":"Collector","description":"Add your first manga to library","icon":"heart","rarity":"common","points":10,"condition":{"type":"stat_check","stat":"totalFavorites","operator":">=","value":1}},{"id":"fav_10","name":"Hoarder","description":"Have 10 manga in your library","icon":"box","rarity":"common","points":50,"condition":{"type":"stat_check","stat":"totalFavorites","operator":">=","value":10}},{"id":"fav_50","name":"Mega Reader","description":"Have 50 manga in your library","icon":"package","rarity":"rare","points":200,"condition":{"type":"stat_check","stat":"totalFavorites","operator":">=","value":50}},{"id":"fav_100","name":"Archive Master","description":"Have 100 manga in your library","icon":"archive","rarity":"epic","points":500,"condition":{"type":"stat_check","stat":"totalFavorites","operator":">=","value":100}}]},{"id":"completion","name":"Completionist","description":"Achievements for completing manga series","icon":"check-circle","achievements":[{"id":"completed_1","name":"The End","description":"Complete your first manga series","icon":"check","rarity":"common","points":25,"condition":{"type":"stat_check","stat":"completedCount","operator":">=","value":1}},{"id":"completed_5","name":"Veteran Reader","description":"Complete 5 manga","icon":"award","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"completedCount","operator":">=","value":5}},{"id":"completed_10","name":"Dedicated Reader","description":"Complete 10 manga","icon":"award","rarity":"rare","points":250,"condition":{"type":"stat_check","stat":"completedCount","operator":">=","value":10}},{"id":"completed_25","name":"Master Reader","description":"Complete 25 manga","icon":"star","rarity":"epic","points":500,"condition":{"type":"stat_check","stat":"completedCount","operator":">=","value":25}}]},{"id":"time","name":"Time Investment","description":"Achievements based on time spent reading","icon":"clock","achievements":[{"id":"night_owl","name":"Night Owl","description":"Spend 1 hour reading total","icon":"moon","rarity":"common","points":50,"condition":{"type":"stat_check","stat":"totalTimeSpent","operator":">=","value":60}},{"id":"marathon","name":"Marathon Reader","description":"Spend 5 hours reading total","icon":"activity","rarity":"rare","points":200,"condition":{"type":"stat_check","stat":"totalTimeSpent","operator":">=","value":300}},{"id":"dedicated","name":"Dedicated","description":"Spend 24 hours reading total","icon":"zap","rarity":"epic","points":1000,"condition":{"type":"stat_check","stat":"totalTimeSpent","operator":">=","value":1440}},{"id":"devoted","name":"Devoted","description":"Spend 100 hours reading total","icon":"maximize","rarity":"legendary","points":5000,"condition":{"type":"stat_check","stat":"totalTimeSpent","operator":">=","value":6000}}]},{"id":"streak","name":"Consistency","description":"Achievements for reading streaks","icon":"calendar","achievements":[{"id":"streak_3","name":"Getting Started","description":"Read 3 days in a row","icon":"activity","rarity":"common","points":30,"condition":{"type":"stat_check","stat":"dailyStreak","operator":">=","value":3}},{"id":"streak_7","name":"Weekly Warrior","description":"Read 7 days in a row","icon":"trending-up","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"dailyStreak","operator":">=","value":7}},{"id":"streak_30","name":"Unwavering","description":"Read 30 days in a row","icon":"zap","rarity":"epic","points":500,"condition":{"type":"stat_check","stat":"dailyStreak","operator":">=","value":30}},{"id":"streak_100","name":"Immortal","description":"Read 100 days in a row","icon":"maximize","rarity":"legendary","points":2000,"condition":{"type":"stat_check","stat":"dailyStreak","operator":">=","value":100}},{"id":"streak_365","name":"Eternal","description":"Read every day for a full year","icon":"star","rarity":"legendary","points":10000,"condition":{"type":"stat_check","stat":"dailyStreak","operator":">=","value":365}}]},{"id":"social","name":"Community & Curation","description":"Achievements for lists, reviews, and AniList syncing","icon":"users","achievements":[{"id":"list_1","name":"List Maker","description":"Create your first custom list","icon":"list","rarity":"common","points":10,"condition":{"type":"stat_check","stat":"totalLists","operator":">=","value":1}},{"id":"list_5","name":"List Curator","description":"Create 5 custom lists","icon":"layers","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"totalLists","operator":">=","value":5}},{"id":"first_review","name":"Critic","description":"Write your first review","icon":"edit","rarity":"common","points":25,"condition":{"type":"stat_check","stat":"totalReviews","operator":">=","value":1}},{"id":"reviews_10","name":"Prolific Critic","description":"Write 10 reviews","icon":"edit-3","rarity":"rare","points":150,"condition":{"type":"stat_check","stat":"totalReviews","operator":">=","value":10}},{"id":"anilist_linked_1","name":"Synced Up","description":"Link a manga to your AniList account","icon":"link","rarity":"common","points":20,"condition":{"type":"stat_check","stat":"anilistLinkedCount","operator":">=","value":1}},{"id":"anilist_linked_10","name":"AniList Power User","description":"Link 10 manga to your AniList account","icon":"link-2","rarity":"rare","points":150,"condition":{"type":"stat_check","stat":"anilistLinkedCount","operator":">=","value":10}}]},{"id":"exploration","name":"Exploration","description":"Achievements for trying different sources","icon":"compass","achievements":[{"id":"explorer","name":"Explorer","description":"Have manga from 5 different sources in your library","icon":"compass","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"uniqueSources","operator":">=","value":5}},{"id":"source_master","name":"Source Master","description":"Have manga from 8 different sources in your library","icon":"globe","rarity":"epic","points":300,"condition":{"type":"stat_check","stat":"uniqueSources","operator":">=","value":8}}]},{"id":"library_status","name":"Library Habits","description":"Achievements for how you manage reading status","icon":"bookmark","achievements":[{"id":"on_hold_5","name":"Taking a Break","description":"Have 5 manga on hold","icon":"pause-circle","rarity":"common","points":40,"condition":{"type":"stat_check","stat":"onHoldCount","operator":">=","value":5}},{"id":"plan_to_read_20","name":"Ambitious","description":"Have 20 manga in your plan-to-read pile","icon":"clipboard","rarity":"rare","points":100,"condition":{"type":"stat_check","stat":"planToReadCount","operator":">=","value":20}},{"id":"dropped_5","name":"Picky Reader","description":"Drop 5 manga","icon":"x-circle","rarity":"common","points":40,"condition":{"type":"stat_check","stat":"droppedCount","operator":">=","value":5}}]},{"id":"dedication","name":"Dedication","description":"Achievements for binge-reading sessions","icon":"activity","achievements":[{"id":"binge_5","name":"Binge Reader","description":"Read 5 chapters in a single day","icon":"activity","rarity":"common","points":40,"condition":{"type":"stat_check","stat":"maxChaptersInADay","operator":">=","value":5}},{"id":"binge_20","name":"Marathon Binge","description":"Read 20 chapters in a single day","icon":"zap","rarity":"epic","points":300,"condition":{"type":"stat_check","stat":"maxChaptersInADay","operator":">=","value":20}}]},{"id":"special","name":"Special","description":"Unique and special achievements","icon":"gift","achievements":[{"id":"sayajin","name":"Sayajin","description":"Have a Dragon Ball manga in your library","icon":"zap","rarity":"epic","points":300,"condition":{"type":"library_title_match","pattern":"dragon ball"}},{"id":"genre_explorer","name":"Genre Explorer","description":"Read manga from 10 different genres","icon":"map","rarity":"rare","points":150,"condition":{"type":"stat_check","stat":"uniqueGenres","operator":">=","value":10}},{"id":"titan_slayer","name":"Titan Slayer","description":"Have an Attack on Titan manga in your library","icon":"shield","rarity":"epic","points":300,"condition":{"type":"library_title_match","pattern":"attack on titan"}},{"id":"king_of_pirates","name":"Future King of the Pirates","description":"Have a One Piece manga in your library","icon":"anchor","rarity":"epic","points":300,"condition":{"type":"library_title_match","pattern":"one piece"}},{"id":"believe_it","name":"Believe It!","description":"Have a Naruto manga in your library","icon":"wind","rarity":"epic","points":300,"condition":{"type":"library_title_match","pattern":"naruto"}}]}]};

class AchievementManager {
  constructor() {
    this.achievements = [];
    this.categories = [];
    this.unlockedAchievements = new Set();
    this.achievementPoints = 0;
    this.storageKey = 'scrollscape_unlocked_achievements';
    this._achievementsMap = new Map();

    // Strategy pattern mapping for condition evaluations
    this.evaluators = {
      'stat_check': this.evaluateStatCheck.bind(this),
      'time_based': this.evaluateTimeBased.bind(this),
      'status_distribution': this.evaluateStatusDistribution.bind(this),
      'composite': this.evaluateComposite.bind(this),
      'library_title_match': this.evaluateLibraryTitleMatch.bind(this),
      'custom': () => false // Placeholder check custom validations
    };

    // Populate immediately from bundled fallback so the page never starts empty.
    this._applyData(_ACHIEVEMENT_FALLBACK);
    this.loadFromStorage();
  }

  /**
   * Internal data structure setup mapping
   * @private
   */
  _applyData(data) {
    // Was previously hiding streak_*/first_review/explorer/source_master —
    // all had conditions referencing stats checkAndUnlockAchievements()
    // never actually computed (e.g. "currentStreak" when the real field is
    // "dailyStreak"), so they could never unlock. Now fixed and wired up
    // (see ui-achievements.js) instead of hidden. early_bird is the one
    // that's gone for good: its condition type ("custom") has no real
    // handler, just a placeholder that always returns false. Left here,
    // empty, as the mechanism for the next time an achievement needs to be
    // pulled without deleting its definition outright.
    const removedCategoryIds = new Set([]);
    const removedAchievementIds = new Set([]);

    this.categories = (data?.categories || [])
      .filter(c => !removedCategoryIds.has(c.id))
      .map(c => ({
        ...c,
        achievements: (c.achievements || []).filter(a => !removedAchievementIds.has(a.id))
      }));
    this.achievements = [];
    this._achievementsMap.clear();

    for (const category of this.categories) {
      for (const achievement of category.achievements || []) {
        const enriched = {
          ...achievement,
          category: category.id,
          categoryName: category.name
        };
        this.achievements.push(enriched);
        this._achievementsMap.set(enriched.id, enriched);
      }
    }
  }

  /**
   * Load achievements from JSON file API definition
   * @returns {Promise<object>}
   */
  async loadAchievements() {
    let data;
    try {
      const response = await fetch('/api/achievements/definitions');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (err) {
      console.warn('Failed to fetch achievement definitions, using bundled fallback:', err);
      data = _ACHIEVEMENT_FALLBACK;
    }
    this._applyData(data);
    return data;
  }

  /**
   * Check all unacquired requirements against the given analytics payload
   * @param {object} analytics - Current analytics data properties dict
   * @returns {string[]} - Array of newly unlocked achievement IDs
   */
  checkAchievements(analytics) {
    if (!analytics) return [];

    const newlyUnlocked = [];
    let hasNewUnlocks = false;
    
    for (const achievement of this.achievements) {
      if (this.unlockedAchievements.has(achievement.id)) continue;
      
      const conditionRes = this.evaluateCondition(achievement.condition, analytics);
      if (conditionRes) {
        this._unlockMemoryOnly(achievement.id, achievement.points);
        newlyUnlocked.push(achievement.id);
        hasNewUnlocks = true;
      }
    }
    
    // Batch UI emission and IO writes for performance
    if (hasNewUnlocks) {
      this.saveToStorage();
      newlyUnlocked.forEach(id => {
        const achievementInfo = this._achievementsMap.get(id);
        if (achievementInfo) this.emitAchievementUnlocked(achievementInfo);
      });
    }
    
    return newlyUnlocked;
  }

  /**
   * Evaluator router
   * @param {object} condition - Condition object
   * @param {object} analytics - Data
   * @returns {boolean}
   */
  evaluateCondition(condition, analytics) {
    if (!condition || !condition.type) return false;
    
    const evaluatorFunc = this.evaluators[condition.type];
    if (evaluatorFunc) {
      return evaluatorFunc(condition, analytics);
    }
    
    console.warn(`Unknown condition type: ${condition.type}`);
    return false;
  }

  /** @private Helper maps */
  static OPERATORS = {
    '>=': (a, b) => a >= b,
    '>':  (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '<':  (a, b) => a < b,
    '==': (a, b) => a == b,
    '!=': (a, b) => a != b
  };

  /** Evaluate numeric thresholds */
  evaluateStatCheck(condition, analytics) {
    const statValue = analytics[condition.stat] || 0;
    const targetValue = condition.value;
    const opFunc = AchievementManager.OPERATORS[condition.operator];
    
    return opFunc ? opFunc(statValue, targetValue) : false;
  }

  evaluateTimeBased(condition, analytics) {
    return (analytics.totalTimeSpent || 0) >= condition.minutes;
  }

  evaluateStatusDistribution(condition, analytics) {
    const statusDistribution = analytics.statusDistribution || {};
    return (statusDistribution[condition.status] || 0) >= condition.count;
  }

  evaluateLibraryTitleMatch(condition, analytics) {
    const titles = analytics.libraryTitles || [];
    const pattern = (condition.pattern || '').toLowerCase();
    
    if (!pattern) return false;
    return titles.some(t => t.toLowerCase().includes(pattern));
  }

  evaluateComposite(condition, analytics) {
    const sub = condition.conditions || [];
    if (condition.logic === 'AND') return sub.every(s => this.evaluateCondition(s, analytics));
    if (condition.logic === 'OR')  return sub.some(s => this.evaluateCondition(s, analytics));
    return false;
  }

  /**
   * Imperative unlock from UI, immediately saving to memory/disk.
   * @param {string} achievementId
   * @param {number} points
   */
  unlockAchievement(achievementId, points = 0) {
    if (this._unlockMemoryOnly(achievementId, points)) {
      this.saveToStorage();
      const achievement = this.getAchievement(achievementId);
      if (achievement) this.emitAchievementUnlocked(achievement);
    }
  }

  /**
   * Internal locker for batching
   * @private
   */
  _unlockMemoryOnly(achievementId, points = 0) {
    if (this.unlockedAchievements.has(achievementId)) return false;
    
    this.unlockedAchievements.add(achievementId);
    this.achievementPoints += points;
    return true;
  }

  /** Emit event for UI notification */
  emitAchievementUnlocked(achievement) {
    const event = new CustomEvent('achievementUnlocked', { detail: { achievement } });
    window.dispatchEvent(event);
  }

  /** Read APIs */
  getAchievement(id) {
    return this._achievementsMap.get(id) || null;
  }

  getAchievementsByCategory(categoryId) {
    return this.achievements.filter(a => a.category === categoryId);
  }

  getAchievementsByRarity(rarity) {
    return this.achievements.filter(a => a.rarity === rarity);
  }

  isUnlocked(achievementId) {
    return this.unlockedAchievements.has(achievementId);
  }

  /**
   * Calculate local progress for partial achievements
   * @returns {object} { current, target, percentage }
   */
  getProgress(achievementId, analytics) {
    const achievement = this.getAchievement(achievementId);
    if (!achievement?.condition) {
      return { current: 0, target: 0, percentage: 0 };
    }
    
    const { type, stat, value, minutes } = achievement.condition;
    let current = 0, target = 0;
    
    if (type === 'stat_check') {
      current = analytics[stat] || 0;
      target = value;
    } else if (type === 'time_based') {
      current = analytics.totalTimeSpent || 0;
      target = minutes;
    } else {
      return { current: 0, target: 0, percentage: 0 };
    }
    
    if (!target) return { current, target, percentage: current > 0 ? 100 : 0 };
    const percentage = Math.max(0, Math.min(100, (current / target) * 100));
    return { current, target, percentage };
  }

  getStats() {
    const total = this.achievements.length;
    const unlocked = this.unlockedAchievements.size;
    
    return {
      total,
      unlocked,
      locked: total - unlocked,
      percentage: total ? Math.round((unlocked / total) * 100) : 0,
      points: this.achievementPoints
    };
  }

  /** State Management */
  saveToStorage() {
    try {
      const data = {
        unlocked: Array.from(this.unlockedAchievements),
        points: this.achievementPoints,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save achievements to storage:', err);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      this.unlockedAchievements = new Set(data.unlocked || []);
      this.achievementPoints = Number.isFinite(data.points) ? data.points : 0;
    } catch (err) {
      console.warn('Failed to load achievements. Resetting defaults:', err);
      this._resetMemoryState();
    }
  }

  _resetMemoryState() {
    this.unlockedAchievements.clear();
    this.achievementPoints = 0;
  }

  reset() {
    this._resetMemoryState();
    this.saveToStorage();
  }

  /**
   * Renders the newest unlocks chronologically by checking internal insertion order
   */
  getRecentUnlocks(limit = 5) {
    const ids = Array.from(this.unlockedAchievements);
    
    return ids
      .slice(-limit)
      .reverse()
      .map(id => this.getAchievement(id))
      .filter(Boolean);
  }
}

// Global browser scope (assumes it is loaded via <script>)
window.AchievementManager = AchievementManager;
