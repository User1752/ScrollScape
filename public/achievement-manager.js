/**
 * Achievement Manager
 * Manages achievement loading, tracking, and unlocking
 */

class AchievementManager {
  constructor() {
    this.achievements = [];
    this.categories = [];
    this.unlockedAchievements = new Set();
    this.achievementPoints = 0;
    this.storageKey = 'manghu_unlocked_achievements';
    this.loadFromStorage();
  }

  /**
   * Load achievements from JSON file
   * @returns {Promise<void>}
   */
  async loadAchievements() {
    try {
      const response = await fetch('/data/achievements.json');
      const data = await response.json();
      
      this.categories = data.categories || [];
      this.achievements = [];
      
      // Flatten achievements from all categories
      for (const category of this.categories) {
        for (const achievement of category.achievements || []) {
          this.achievements.push({
            ...achievement,
            category: category.id,
            categoryName: category.name
          });
        }
      }
      
      return data;
    } catch (err) {
      console.error('Failed to load achievements:', err);
      this.achievements = [];
      this.categories = [];
      throw err;
    }
  }

  /**
   * Check achievement conditions
   * @param {object} analytics - Current analytics data
   * @returns {string[]} - Array of newly unlocked achievement IDs
   */
  checkAchievements(analytics) {
    const newlyUnlocked = [];
    
    for (const achievement of this.achievements) {
      // Skip if already unlocked
      if (this.unlockedAchievements.has(achievement.id)) {
        continue;
      }
      
      // Check condition
      if (this.evaluateCondition(achievement.condition, analytics)) {
        this.unlockAchievement(achievement.id, achievement.points);
        newlyUnlocked.push(achievement.id);
      }
    }
    
    return newlyUnlocked;
  }

  /**
   * Evaluate achievement condition
   * @param {object} condition - Condition object
   * @param {object} analytics - Analytics data
   * @returns {boolean}
   */
  evaluateCondition(condition, analytics) {
    if (!condition) return false;
    
    switch (condition.type) {
      case 'stat_check':
        return this.evaluateStatCheck(condition, analytics);
      
      case 'time_based':
        return this.evaluateTimeBased(condition, analytics);
      
      case 'status_distribution':
        return this.evaluateStatusDistribution(condition, analytics);
      
      case 'composite':
        return this.evaluateComposite(condition, analytics);
      
      case 'library_title_match':
        return this.evaluateLibraryTitleMatch(condition, analytics);
      
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Evaluate stat check condition
   * @param {object} condition
   * @param {object} analytics
   * @returns {boolean}
   */
  evaluateStatCheck(condition, analytics) {
    const statValue = analytics[condition.stat] || 0;
    const targetValue = condition.value;
    
    switch (condition.operator) {
      case '>=': return statValue >= targetValue;
      case '>':  return statValue > targetValue;
      case '<=': return statValue <= targetValue;
      case '<':  return statValue < targetValue;
      case '==': return statValue == targetValue;
      case '!=': return statValue != targetValue;
      default:
        console.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Evaluate time-based condition
   * @param {object} condition
   * @param {object} analytics
   * @returns {boolean}
   */
  evaluateTimeBased(condition, analytics) {
    const totalMinutes = analytics.totalTimeSpent || 0;
    const targetMinutes = condition.minutes;
    return totalMinutes >= targetMinutes;
  }

  /**
   * Evaluate status distribution condition
   * @param {object} condition
   * @param {object} analytics
   * @returns {boolean}
   */
  evaluateStatusDistribution(condition, analytics) {
    const statusDistribution = analytics.statusDistribution || {};
    const statusCount = statusDistribution[condition.status] || 0;
    return statusCount >= condition.count;
  }

  /**
   * Evaluate library title match condition
   * @param {object} condition - { pattern: string }
   * @param {object} analytics - must include libraryTitles: string[]
   * @returns {boolean}
   */
  evaluateLibraryTitleMatch(condition, analytics) {
    const titles = analytics.libraryTitles || [];
    const pattern = (condition.pattern || '').toLowerCase();
    if (!pattern) return false;
    return titles.some(t => t.toLowerCase().includes(pattern));
  }

  /**
   * Evaluate composite condition (AND/OR logic)
   * @param {object} condition
   * @param {object} analytics
   * @returns {boolean}
   */
  evaluateComposite(condition, analytics) {
    const subconditions = condition.conditions || [];
    
    if (condition.logic === 'AND') {
      return subconditions.every(sub => this.evaluateCondition(sub, analytics));
    } else if (condition.logic === 'OR') {
      return subconditions.some(sub => this.evaluateCondition(sub, analytics));
    }
    
    return false;
  }

  /**
   * Unlock an achievement
   * @param {string} achievementId
   * @param {number} points
   */
  unlockAchievement(achievementId, points = 0) {
    if (this.unlockedAchievements.has(achievementId)) {
      return; // Already unlocked
    }
    
    this.unlockedAchievements.add(achievementId);
    this.achievementPoints += points;
    this.saveToStorage();
    
    // Emit event for UI notification
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement) {
      this.emitAchievementUnlocked(achievement);
    }
  }

  /**
   * Emit achievement unlocked event
   * @param {object} achievement
   */
  emitAchievementUnlocked(achievement) {
    const event = new CustomEvent('achievementUnlocked', {
      detail: { achievement }
    });
    window.dispatchEvent(event);
  }

  /**
   * Get achievement by ID
   * @param {string} id
   * @returns {object|null}
   */
  getAchievement(id) {
    return this.achievements.find(a => a.id === id) || null;
  }

  /**
   * Get all achievements in a category
   * @param {string} categoryId
   * @returns {array}
   */
  getAchievementsByCategory(categoryId) {
    return this.achievements.filter(a => a.category === categoryId);
  }

  /**
   * Get achievement progress
   * @param {string} achievementId
   * @param {object} analytics
   * @returns {object}
   */
  getProgress(achievementId, analytics) {
    const achievement = this.getAchievement(achievementId);
    if (!achievement || !achievement.condition) {
      return { current: 0, target: 0, percentage: 0 };
    }
    
    const condition = achievement.condition;
    
    if (condition.type === 'stat_check') {
      const current = analytics[condition.stat] || 0;
      const target = condition.value;
      const percentage = Math.min(100, (current / target) * 100);
      return { current, target, percentage };
    }
    
    if (condition.type === 'time_based') {
      const current = analytics.totalTimeSpent || 0;
      const target = condition.minutes;
      const percentage = Math.min(100, (current / target) * 100);
      return { current, target, percentage };
    }
    
    return { current: 0, target: 0, percentage: 0 };
  }

  /**
   * Get statistics
   * @returns {object}
   */
  getStats() {
    const total = this.achievements.length;
    const unlocked = this.unlockedAchievements.size;
    const percentage = total > 0 ? (unlocked / total) * 100 : 0;
    
    return {
      total,
      unlocked,
      locked: total - unlocked,
      percentage: Math.round(percentage),
      points: this.achievementPoints
    };
  }

  /**
   * Get achievements by rarity
   * @param {string} rarity
   * @returns {array}
   */
  getAchievementsByRarity(rarity) {
    return this.achievements.filter(a => a.rarity === rarity);
  }

  /**
   * Check if achievement is unlocked
   * @param {string} achievementId
   * @returns {boolean}
   */
  isUnlocked(achievementId) {
    return this.unlockedAchievements.has(achievementId);
  }

  /**
   * Save unlocked achievements to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        unlocked: Array.from(this.unlockedAchievements),
        points: this.achievementPoints,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save achievements:', err);
    }
  }

  /**
   * Load unlocked achievements from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.unlockedAchievements = new Set(data.unlocked || []);
        this.achievementPoints = data.points || 0;
      }
    } catch (err) {
      console.warn('Failed to load achievements:', err);
      this.unlockedAchievements = new Set();
      this.achievementPoints = 0;
    }
  }

  /**
   * Reset all achievements (for testing/debugging)
   */
  reset() {
    this.unlockedAchievements.clear();
    this.achievementPoints = 0;
    this.saveToStorage();
  }

  /**
   * Get recent unlocks
   * @param {number} limit
   * @returns {array}
   */
  getRecentUnlocks(limit = 5) {
    // This could be enhanced with unlock timestamps
    const unlocked = Array.from(this.unlockedAchievements);
    return unlocked
      .map(id => this.getAchievement(id))
      .filter(a => a !== null)
      .slice(0, limit);
  }
}
