# Navigation and Content Organization Specification

## Overview
This specification details the implementation of a contextual back navigation system and structured achievement management for the Manghu manga reader application.

---

## 1. Contextual Back Navigation System

### 1.1 Current Limitations

**Existing Implementation:**
```javascript
// Current: Simple previous view tracking
const backBtn = $("backBtn");
if (backBtn) backBtn.onclick = () => setView(state.previousView || "discover");
```

**Problems:**
- Only remembers the last view, not the full navigation path
- No context about where user came from when viewing manga details
- Always defaults to "discover" when previousView is undefined
- Cannot track multi-level navigation (e.g., Advanced Search > Manga Details > Reader > back chain)
- Lost context when switching between manga from different sources

### 1.2 Proposed Solution: Navigation Stack

#### 1.2.1 Data Structure

**Navigation Entry Interface:**
```javascript
{
  view: string,           // View identifier: "discover", "library", "manga-details", "advanced-search", "analytics", "reader"
  context: object,        // Additional context data
  timestamp: number,      // When this navigation occurred
  scrollPosition: number  // Preserve scroll position for restoration
}
```

**Navigation Stack Structure:**
```javascript
state.navigationStack = [
  {
    view: "advanced-search",
    context: {
      filters: {
        genre: "Action",
        status: "ongoing",
        sort: "popularity"
      },
      searchQuery: "",
      page: 1
    },
    timestamp: 1740614400000,
    scrollPosition: 0
  },
  {
    view: "manga-details",
    context: {
      mangaId: "one-piece",
      sourceId: "mangasee",
      fromView: "advanced-search"
    },
    timestamp: 1740614460000,
    scrollPosition: 0
  },
  {
    view: "reader",
    context: {
      mangaId: "one-piece",
      chapterId: "chapter-1000",
      sourceId: "mangasee",
      fromView: "manga-details"
    },
    timestamp: 1740614520000,
    scrollPosition: 0
  }
]
```

#### 1.2.2 Navigation Stack Manager

**Core Functions:**

```javascript
/**
 * Navigation Stack Manager
 * Manages the history of user navigation through the application
 */
const NavigationManager = {
  
  /**
   * Maximum stack size to prevent memory issues
   */
  MAX_STACK_SIZE: 50,

  /**
   * Push a new navigation entry onto the stack
   * @param {string} view - The view identifier
   * @param {object} context - Context data for the view
   * @param {boolean} replace - If true, replace the current entry instead of pushing
   */
  pushView(view, context = {}, replace = false) {
    const entry = {
      view,
      context: { ...context },
      timestamp: Date.now(),
      scrollPosition: window.scrollY || document.documentElement.scrollTop || 0
    };

    if (replace && state.navigationStack.length > 0) {
      // Replace the last entry
      state.navigationStack[state.navigationStack.length - 1] = entry;
    } else {
      // Add new entry
      state.navigationStack.push(entry);
      
      // Enforce max size (keep recent entries)
      if (state.navigationStack.length > this.MAX_STACK_SIZE) {
        state.navigationStack = state.navigationStack.slice(-this.MAX_STACK_SIZE);
      }
    }

    // Save to localStorage for persistence across page refreshes
    this.saveStack();
  },

  /**
   * Navigate back to the previous view
   * @returns {object|null} The previous navigation entry, or null if stack is empty
   */
  goBack() {
    // Remove current view
    if (state.navigationStack.length > 0) {
      state.navigationStack.pop();
    }

    // Get previous view
    const previous = this.getCurrentEntry();
    
    if (previous) {
      // Restore the view and its context
      this.restoreView(previous);
      return previous;
    } else {
      // No history, go to default view
      setView("discover");
      return null;
    }
  },

  /**
   * Get the current navigation entry (top of stack)
   * @returns {object|null}
   */
  getCurrentEntry() {
    return state.navigationStack.length > 0 
      ? state.navigationStack[state.navigationStack.length - 1] 
      : null;
  },

  /**
   * Get the previous navigation entry (one below top)
   * @returns {object|null}
   */
  getPreviousEntry() {
    return state.navigationStack.length > 1 
      ? state.navigationStack[state.navigationStack.length - 2] 
      : null;
  },

  /**
   * Restore a view from a navigation entry
   * @param {object} entry - Navigation entry to restore
   */
  restoreView(entry) {
    const { view, context, scrollPosition } = entry;

    // Set the view
    setView(view);

    // Restore context based on view type
    switch (view) {
      case "manga-details":
        if (context.mangaId) {
          showMangaDetails(context.mangaId, context.sourceId);
        }
        break;

      case "advanced-search":
        if (context.filters) {
          // Restore filter states
          Object.entries(context.filters).forEach(([key, value]) => {
            const filterElement = document.querySelector(`[name="${key}"]`);
            if (filterElement) filterElement.value = value;
          });
          // Re-run search if there was a query
          if (context.searchQuery) {
            document.getElementById("searchInput").value = context.searchQuery;
            search();
          }
        }
        break;

      case "library":
        if (context.statusFilter) {
          state.libraryStatusFilter = context.statusFilter;
          renderLibrary();
        }
        break;

      case "reader":
        if (context.chapterId) {
          loadChapter(context.mangaId, context.chapterId, context.sourceId);
        }
        break;
    }

    // Restore scroll position after a brief delay to allow content to render
    setTimeout(() => {
      window.scrollTo(0, scrollPosition || 0);
    }, 100);
  },

  /**
   * Clear the entire navigation stack
   */
  clearStack() {
    state.navigationStack = [];
    this.saveStack();
  },

  /**
   * Clear stack up to a specific view (useful for "home" button)
   * @param {string} view - View to clear up to (inclusive)
   */
  clearToView(view) {
    const index = state.navigationStack.findIndex(entry => entry.view === view);
    if (index !== -1) {
      state.navigationStack = state.navigationStack.slice(0, index + 1);
      this.saveStack();
    }
  },

  /**
   * Check if we can navigate back
   * @returns {boolean}
   */
  canGoBack() {
    return state.navigationStack.length > 1;
  },

  /**
   * Save navigation stack to localStorage
   */
  saveStack() {
    try {
      localStorage.setItem("manghu_navigation_stack", JSON.stringify(state.navigationStack));
    } catch (e) {
      console.error("Failed to save navigation stack:", e);
    }
  },

  /**
   * Load navigation stack from localStorage
   */
  loadStack() {
    try {
      const saved = localStorage.getItem("manghu_navigation_stack");
      if (saved) {
        state.navigationStack = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load navigation stack:", e);
      state.navigationStack = [];
    }
  }
};
```

#### 1.2.3 Integration Points

**Modified setView Function:**
```javascript
function setView(view, context = {}, addToHistory = true) {
  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "analytics"];
  
  // Add to navigation stack
  if (addToHistory) {
    NavigationManager.pushView(view, context);
  }

  for (const v of ALL_VIEWS) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }

  // Sync sidebar active state
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle("active", linkView === view);
  });

  // Update back button visibility
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.style.display = NavigationManager.canGoBack() ? "block" : "none";
  }

  // On-enter actions per view
  if (view === "library") {
    renderLibrary();
  } else if (view === "analytics") {
    renderAnalyticsView();
  }
}
```

**Modified showMangaDetails Function:**
```javascript
async function showMangaDetails(mangaId, sourceId) {
  const previousEntry = NavigationManager.getCurrentEntry();
  const fromView = previousEntry ? previousEntry.view : "discover";

  // Push manga details to navigation stack with context
  NavigationManager.pushView("manga-details", {
    mangaId,
    sourceId,
    fromView
  });

  // ... rest of the function
}
```

**Modified Back Button Handler:**
```javascript
function bindUI() {
  // ... existing code

  // Back button with navigation stack
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      NavigationManager.goBack();
    };
  }

  // ... rest of the function
}
```

#### 1.2.4 Use Cases and Examples

**Use Case 1: Advanced Search to Manga Details**
```
User Flow:
1. User is on Advanced Search page with filters set (Genre: Action, Status: Ongoing)
2. User clicks on "One Piece" manga
3. User views manga details
4. User clicks back button

Expected Result:
- User returns to Advanced Search page
- Filters are still set to Action, Ongoing
- Scroll position is restored

Navigation Stack State:
[
  { view: "advanced-search", context: { filters: {...}, searchQuery: "" } },
  { view: "manga-details", context: { mangaId: "one-piece", fromView: "advanced-search" } }
]

After back:
[
  { view: "advanced-search", context: { filters: {...}, searchQuery: "" } }
]
```

**Use Case 2: Library to Manga Details to Reader**
```
User Flow:
1. User is in Library with status filter "Reading"
2. User clicks on a manga
3. User clicks "Continue Reading" and enters reader
4. User clicks back (should return to manga details)
5. User clicks back again (should return to library with "Reading" filter)

Navigation Stack Evolution:
Step 1: [{ view: "library", context: { statusFilter: "reading" } }]
Step 3: [{ view: "library", ... }, { view: "manga-details", ... }, { view: "reader", ... }]
Step 4: [{ view: "library", ... }, { view: "manga-details", ... }]
Step 5: [{ view: "library", context: { statusFilter: "reading" } }]
```

**Use Case 3: Deep Navigation Traversal**
```
User Flow:
1. Discover > Search "Naruto" > Manga Details > Reader > Back > Back > Back

Navigation Stack:
[discover] → [discover, manga-details] → [discover, manga-details, reader]
→ [discover, manga-details] → [discover] → []

Final State: User is back at Discover page
```

#### 1.2.5 Edge Cases and Handling

**1. Page Refresh:**
- Navigation stack is saved to localStorage
- On app initialization, load stack from localStorage
- Restore the last view from stack

**2. Direct URL Access (if implementing routing):**
- Clear navigation stack
- Initialize with the accessed view

**3. Stack Overflow:**
- Limit stack to 50 entries
- Remove oldest entries when limit is reached

**4. Invalid Context:**
- Validate context before restoration
- Fallback to view without context if validation fails

**5. Sidebar Navigation:**
- Clicking sidebar links should clear stack and start fresh
- Exception: Going back to a sidebar view should preserve its position in stack

---

## 2. Structured Achievement System

### 2.1 Current Limitations

**Existing Implementation:**
- Achievements are hardcoded in JavaScript array
- Icons are emoji characters embedded in code
- Adding new achievements requires code modification
- No categorization or progression system
- Difficult to maintain translations

### 2.2 Proposed Solution: JSON-Based Achievement System

#### 2.2.1 Achievement Data Structure

**File: `data/achievements.json`**
```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-02-27",
  "categories": [
    {
      "id": "reading",
      "name": "Reading Progress",
      "description": "Achievements related to reading chapters",
      "icon": "book-open",
      "achievements": [
        {
          "id": "first_read",
          "name": "First Steps",
          "description": "Read your first chapter",
          "icon": "book",
          "rarity": "common",
          "points": 10,
          "condition": {
            "type": "stat_check",
            "stat": "totalChaptersRead",
            "operator": ">=",
            "value": 1
          },
          "rewards": {
            "badge": true,
            "notification": true
          }
        },
        {
          "id": "reader_10",
          "name": "Bookworm",
          "description": "Read 10 chapters",
          "icon": "book-stack",
          "rarity": "common",
          "points": 25,
          "condition": {
            "type": "stat_check",
            "stat": "totalChaptersRead",
            "operator": ">=",
            "value": 10
          }
        },
        {
          "id": "reader_100",
          "name": "Manga Addict",
          "description": "Read 100 chapters",
          "icon": "trophy",
          "rarity": "rare",
          "points": 100,
          "condition": {
            "type": "stat_check",
            "stat": "totalChaptersRead",
            "operator": ">=",
            "value": 100
          }
        },
        {
          "id": "reader_500",
          "name": "Legend",
          "description": "Read 500 chapters",
          "icon": "star",
          "rarity": "epic",
          "points": 500,
          "condition": {
            "type": "stat_check",
            "stat": "totalChaptersRead",
            "operator": ">=",
            "value": 500
          }
        },
        {
          "id": "reader_1000",
          "name": "Unstoppable",
          "description": "Read 1000 chapters",
          "icon": "crown",
          "rarity": "legendary",
          "points": 1000,
          "condition": {
            "type": "stat_check",
            "stat": "totalChaptersRead",
            "operator": ">=",
            "value": 1000
          }
        }
      ]
    },
    {
      "id": "collection",
      "name": "Library Management",
      "description": "Achievements related to building your library",
      "icon": "library",
      "achievements": [
        {
          "id": "first_fav",
          "name": "Collector",
          "description": "Add your first manga to library",
          "icon": "heart",
          "rarity": "common",
          "points": 10,
          "condition": {
            "type": "stat_check",
            "stat": "totalFavorites",
            "operator": ">=",
            "value": 1
          }
        },
        {
          "id": "fav_10",
          "name": "Hoarder",
          "description": "Have 10 manga in your library",
          "icon": "box",
          "rarity": "common",
          "points": 50,
          "condition": {
            "type": "stat_check",
            "stat": "totalFavorites",
            "operator": ">=",
            "value": 10
          }
        },
        {
          "id": "fav_50",
          "name": "Curator",
          "description": "Have 50 manga in your library",
          "icon": "boxes",
          "rarity": "rare",
          "points": 200,
          "condition": {
            "type": "stat_check",
            "stat": "totalFavorites",
            "operator": ">=",
            "value": 50
          }
        },
        {
          "id": "fav_100",
          "name": "Archive Master",
          "description": "Have 100 manga in your library",
          "icon": "archive",
          "rarity": "epic",
          "points": 500,
          "condition": {
            "type": "stat_check",
            "stat": "totalFavorites",
            "operator": ">=",
            "value": 100
          }
        }
      ]
    },
    {
      "id": "completion",
      "name": "Completionist",
      "description": "Achievements for completing manga series",
      "icon": "check-circle",
      "achievements": [
        {
          "id": "completed_1",
          "name": "Completionist",
          "description": "Mark your first manga as completed",
          "icon": "check",
          "rarity": "common",
          "points": 25,
          "condition": {
            "type": "stat_check",
            "stat": "completedCount",
            "operator": ">=",
            "value": 1
          }
        },
        {
          "id": "completed_5",
          "name": "Veteran Reader",
          "description": "Complete 5 manga",
          "icon": "medal",
          "rarity": "rare",
          "points": 100,
          "condition": {
            "type": "stat_check",
            "stat": "completedCount",
            "operator": ">=",
            "value": 5
          }
        },
        {
          "id": "completed_25",
          "name": "Master Reader",
          "description": "Complete 25 manga",
          "icon": "award",
          "rarity": "epic",
          "points": 500,
          "condition": {
            "type": "stat_check",
            "stat": "completedCount",
            "operator": ">=",
            "value": 25
          }
        }
      ]
    },
    {
      "id": "time",
      "name": "Time Investment",
      "description": "Achievements based on time spent reading",
      "icon": "clock",
      "achievements": [
        {
          "id": "night_owl",
          "name": "Night Owl",
          "description": "Spend 1 hour reading total",
          "icon": "moon",
          "rarity": "common",
          "points": 50,
          "condition": {
            "type": "stat_check",
            "stat": "totalTimeSpent",
            "operator": ">=",
            "value": 60
          }
        },
        {
          "id": "marathon",
          "name": "Marathon Reader",
          "description": "Spend 5 hours reading total",
          "icon": "runner",
          "rarity": "rare",
          "points": 200,
          "condition": {
            "type": "stat_check",
            "stat": "totalTimeSpent",
            "operator": ">=",
            "value": 300
          }
        },
        {
          "id": "dedicated",
          "name": "Dedicated",
          "description": "Spend 24 hours reading total",
          "icon": "fire",
          "rarity": "epic",
          "points": 1000,
          "condition": {
            "type": "stat_check",
            "stat": "totalTimeSpent",
            "operator": ">=",
            "value": 1440
          }
        }
      ]
    },
    {
      "id": "streak",
      "name": "Consistency",
      "description": "Achievements for reading streaks",
      "icon": "calendar",
      "achievements": [
        {
          "id": "streak_3",
          "name": "Getting Started",
          "description": "Read 3 days in a row",
          "icon": "activity",
          "rarity": "common",
          "points": 30,
          "condition": {
            "type": "stat_check",
            "stat": "currentStreak",
            "operator": ">=",
            "value": 3
          }
        },
        {
          "id": "streak_7",
          "name": "Weekly Warrior",
          "description": "Read 7 days in a row",
          "icon": "trending-up",
          "rarity": "rare",
          "points": 100,
          "condition": {
            "type": "stat_check",
            "stat": "currentStreak",
            "operator": ">=",
            "value": 7
          }
        },
        {
          "id": "streak_30",
          "name": "Unwavering",
          "description": "Read 30 days in a row",
          "icon": "zap",
          "rarity": "epic",
          "points": 500,
          "condition": {
            "type": "stat_check",
            "stat": "currentStreak",
            "operator": ">=",
            "value": 30
          }
        },
        {
          "id": "streak_100",
          "name": "Immortal",
          "description": "Read 100 days in a row",
          "icon": "infinity",
          "rarity": "legendary",
          "points": 2000,
          "condition": {
            "type": "stat_check",
            "stat": "currentStreak",
            "operator": ">=",
            "value": 100
          }
        }
      ]
    },
    {
      "id": "special",
      "name": "Special",
      "description": "Unique and special achievements",
      "icon": "gift",
      "achievements": [
        {
          "id": "first_review",
          "name": "Critic",
          "description": "Write your first review",
          "icon": "edit",
          "rarity": "common",
          "points": 25,
          "condition": {
            "type": "stat_check",
            "stat": "totalReviews",
            "operator": ">=",
            "value": 1
          }
        },
        {
          "id": "explorer",
          "name": "Explorer",
          "description": "Use manga from 5 different sources",
          "icon": "compass",
          "rarity": "rare",
          "points": 100,
          "condition": {
            "type": "stat_check",
            "stat": "uniqueSources",
            "operator": ">=",
            "value": 5
          }
        },
        {
          "id": "early_bird",
          "name": "Early Bird",
          "description": "Read a chapter within 1 hour of its release",
          "icon": "sunrise",
          "rarity": "epic",
          "points": 150,
          "condition": {
            "type": "custom",
            "handler": "checkEarlyBird"
          }
        }
      ]
    }
  ]
}
```

#### 2.2.2 Icon System (Non-Emoji)

**Icon Mapping File: `data/icon-mapping.json`**
```json
{
  "book": {
    "class": "icon-book",
    "unicode": "U+1F4D6",
    "svg": "book.svg",
    "description": "Book icon"
  },
  "book-open": {
    "class": "icon-book-open",
    "unicode": "U+1F4D6",
    "svg": "book-open.svg",
    "description": "Open book icon"
  },
  "book-stack": {
    "class": "icon-book-stack",
    "unicode": "U+1F4DA",
    "svg": "book-stack.svg",
    "description": "Stack of books"
  },
  "trophy": {
    "class": "icon-trophy",
    "unicode": "U+1F3C6",
    "svg": "trophy.svg",
    "description": "Trophy icon"
  },
  "star": {
    "class": "icon-star",
    "unicode": "U+2B50",
    "svg": "star.svg",
    "description": "Star icon"
  },
  "heart": {
    "class": "icon-heart",
    "unicode": "U+2764",
    "svg": "heart.svg",
    "description": "Heart icon"
  },
  "check": {
    "class": "icon-check",
    "unicode": "U+2714",
    "svg": "check.svg",
    "description": "Checkmark"
  },
  "medal": {
    "class": "icon-medal",
    "unicode": "U+1F3C5",
    "svg": "medal.svg",
    "description": "Medal icon"
  },
  "moon": {
    "class": "icon-moon",
    "unicode": "U+1F319",
    "svg": "moon.svg",
    "description": "Moon icon"
  },
  "fire": {
    "class": "icon-fire",
    "unicode": "U+1F525",
    "svg": "fire.svg",
    "description": "Fire icon"
  },
  "calendar": {
    "class": "icon-calendar",
    "unicode": "U+1F4C5",
    "svg": "calendar.svg",
    "description": "Calendar icon"
  }
}
```

#### 2.2.3 Achievement Manager Implementation

**File: `public/achievement-manager.js`**
```javascript
/**
 * Achievement Manager
 * Handles loading, checking, and unlocking achievements from JSON configuration
 */
class AchievementManager {
  constructor() {
    this.achievements = null;
    this.iconMapping = null;
    this.earnedAchievements = new Set();
    this.customHandlers = new Map();
  }

  /**
   * Initialize the achievement system
   * Load achievements and icon mappings from JSON files
   */
  async initialize() {
    try {
      const [achievementsResponse, iconsResponse] = await Promise.all([
        fetch('/data/achievements.json'),
        fetch('/data/icon-mapping.json')
      ]);

      this.achievements = await achievementsResponse.json();
      this.iconMapping = await iconsResponse.json();

      // Register custom handlers
      this.registerCustomHandlers();

      console.log(`Loaded ${this.getTotalAchievementCount()} achievements`);
    } catch (error) {
      console.error('Failed to initialize achievement system:', error);
    }
  }

  /**
   * Get total count of all achievements across categories
   */
  getTotalAchievementCount() {
    if (!this.achievements) return 0;
    return this.achievements.categories.reduce(
      (sum, category) => sum + category.achievements.length,
      0
    );
  }

  /**
   * Get all achievements as a flat array
   */
  getAllAchievements() {
    if (!this.achievements) return [];
    return this.achievements.categories.flatMap(category => 
      category.achievements.map(achievement => ({
        ...achievement,
        category: category.id,
        categoryName: category.name
      }))
    );
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(categoryId) {
    if (!this.achievements) return [];
    const category = this.achievements.categories.find(c => c.id === categoryId);
    return category ? category.achievements : [];
  }

  /**
   * Get achievement by ID
   */
  getAchievement(achievementId) {
    const all = this.getAllAchievements();
    return all.find(a => a.id === achievementId);
  }

  /**
   * Check if an achievement condition is met
   */
  checkCondition(achievement, stats) {
    const { condition } = achievement;

    if (!condition) return false;

    switch (condition.type) {
      case 'stat_check':
        return this.checkStatCondition(condition, stats);
      
      case 'custom':
        return this.checkCustomCondition(condition, stats);
      
      case 'composite':
        return this.checkCompositeCondition(condition, stats);
      
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Check a stat-based condition
   */
  checkStatCondition(condition, stats) {
    const { stat, operator, value } = condition;
    const statValue = stats[stat] || 0;

    switch (operator) {
      case '>=': return statValue >= value;
      case '>':  return statValue > value;
      case '<=': return statValue <= value;
      case '<':  return statValue < value;
      case '==': return statValue == value;
      case '!=': return statValue != value;
      default:   return false;
    }
  }

  /**
   * Check a custom condition using registered handlers
   */
  checkCustomCondition(condition, stats) {
    const handler = this.customHandlers.get(condition.handler);
    if (!handler) {
      console.warn(`No handler registered for: ${condition.handler}`);
      return false;
    }
    return handler(stats, condition.params);
  }

  /**
   * Check a composite condition (AND/OR logic)
   */
  checkCompositeCondition(condition, stats) {
    const { logic, conditions } = condition;
    
    if (logic === 'AND') {
      return conditions.every(c => this.checkCondition({ condition: c }, stats));
    } else if (logic === 'OR') {
      return conditions.some(c => this.checkCondition({ condition: c }, stats));
    }
    
    return false;
  }

  /**
   * Register custom condition handlers
   */
  registerCustomHandlers() {
    // Early bird: Read within 1 hour of release
    this.customHandlers.set('checkEarlyBird', (stats) => {
      return stats.hasEarlyRead || false;
    });

    // Add more custom handlers as needed
  }

  /**
   * Check all achievements and return newly unlocked ones
   */
  async checkAndUnlockAchievements(stats) {
    const newlyUnlocked = [];
    const allAchievements = this.getAllAchievements();

    for (const achievement of allAchievements) {
      // Skip already earned
      if (this.earnedAchievements.has(achievement.id)) {
        continue;
      }

      // Check condition
      if (this.checkCondition(achievement, stats)) {
        try {
          // Unlock on server
          const result = await api('/api/achievements/unlock', {
            method: 'POST',
            body: JSON.stringify({ achievementId: achievement.id })
          });

          if (result.isNew) {
            this.earnedAchievements.add(achievement.id);
            newlyUnlocked.push(achievement);
          }
        } catch (error) {
          console.error(`Failed to unlock achievement ${achievement.id}:`, error);
        }
      }
    }

    return newlyUnlocked;
  }

  /**
   * Get icon HTML for an achievement
   */
  getIconHtml(iconName, size = 'medium') {
    if (!this.iconMapping || !this.iconMapping[iconName]) {
      return `<span class="icon-placeholder icon-${size}"></span>`;
    }

    const icon = this.iconMapping[iconName];
    const sizeClass = `icon-${size}`;

    // Use SVG if available
    if (icon.svg) {
      return `<img src="/assets/icons/${icon.svg}" class="icon ${sizeClass}" alt="${icon.description}">`;
    }

    // Fallback to CSS icon class
    return `<i class="${icon.class} ${sizeClass}" aria-label="${icon.description}"></i>`;
  }

  /**
   * Get rarity color class
   */
  getRarityClass(rarity) {
    return `rarity-${rarity}`;
  }

  /**
   * Calculate total points earned
   */
  getTotalPoints() {
    const allAchievements = this.getAllAchievements();
    return Array.from(this.earnedAchievements).reduce((total, id) => {
      const achievement = allAchievements.find(a => a.id === id);
      return total + (achievement?.points || 0);
    }, 0);
  }

  /**
   * Get progress for a category
   */
  getCategoryProgress(categoryId) {
    const achievements = this.getAchievementsByCategory(categoryId);
    const earned = achievements.filter(a => this.earnedAchievements.has(a.id)).length;
    return {
      earned,
      total: achievements.length,
      percentage: achievements.length > 0 ? (earned / achievements.length) * 100 : 0
    };
  }

  /**
   * Load earned achievements from server
   */
  async loadEarnedAchievements() {
    try {
      const response = await api('/api/achievements');
      this.earnedAchievements = new Set(response.achievements || []);
      return this.earnedAchievements;
    } catch (error) {
      console.error('Failed to load earned achievements:', error);
      return new Set();
    }
  }
}

// Global instance
const achievementManager = new AchievementManager();
```

#### 2.2.4 UI Integration

**Achievement Display Component:**
```javascript
/**
 * Render achievements grid with categories
 */
async function renderAchievementsView() {
  const container = document.getElementById('achievementsContainer');
  if (!container) return;

  await achievementManager.loadEarnedAchievements();
  const categories = achievementManager.achievements.categories;

  const html = `
    <div class="achievements-header">
      <h2>Achievements</h2>
      <div class="achievements-stats">
        <div class="stat-item">
          <span class="stat-label">Unlocked</span>
          <span class="stat-value">${achievementManager.earnedAchievements.size}/${achievementManager.getTotalAchievementCount()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Points</span>
          <span class="stat-value">${achievementManager.getTotalPoints()}</span>
        </div>
      </div>
    </div>

    <div class="achievements-categories">
      ${categories.map(category => `
        <div class="achievement-category">
          <div class="category-header">
            ${achievementManager.getIconHtml(category.icon, 'small')}
            <h3>${category.name}</h3>
            <span class="category-desc">${category.description}</span>
            <div class="category-progress">
              ${achievementManager.getCategoryProgress(category.id).earned}/${category.achievements.length}
            </div>
          </div>
          <div class="achievement-grid">
            ${category.achievements.map(achievement => {
              const isEarned = achievementManager.earnedAchievements.has(achievement.id);
              const rarityClass = achievementManager.getRarityClass(achievement.rarity);
              
              return `
                <div class="achievement-card ${isEarned ? 'earned' : 'locked'} ${rarityClass}">
                  <div class="achievement-icon">
                    ${achievementManager.getIconHtml(achievement.icon, 'large')}
                  </div>
                  <div class="achievement-info">
                    <h4 class="achievement-name">${achievement.name}</h4>
                    <p class="achievement-desc">${achievement.description}</p>
                    <div class="achievement-meta">
                      <span class="achievement-rarity">${achievement.rarity}</span>
                      <span class="achievement-points">${achievement.points} pts</span>
                    </div>
                  </div>
                  ${isEarned ? '<div class="earned-badge">Unlocked</div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;
}
```

---

## 3. Emoji Removal Strategy

### 3.1 Emoji Inventory

**Current Emoji Usage:**

| Location | Emoji | Purpose | Replacement |
|----------|-------|---------|-------------|
| index.html | 🎯 | Hero tag | Icon class: `target` |
| index.html | 📚 | Sources badge | Icon class: `books` |
| index.html | 🎨 | Themes badge | Icon class: `palette` |
| index.html | 📊 | Analytics badge | Icon class: `chart-bar` |
| index.html | 🔍 | Search feature | Icon class: `search` |
| index.html | 📖 | Reading feature | Icon class: `book-open` |
| index.html | 🌐 | Sources feature | Icon class: `globe` |
| index.html | 🎲 | Random button | Icon class: `dice` |
| app.js | 📖 | Reading status | Icon class: `book-open` |
| app.js | 🗂️ | Plan to Read | Icon class: `folder` |
| app.js | 🔥 | Streak icon | Icon class: `flame` |
| app.js | All achievement emojis | Achievement icons | JSON-based icon system |
| styles.css | 📚 | Before content | CSS icon class |
| styles.css | 🔥 | Before content | CSS icon class |

### 3.2 Icon Implementation Options

**Option 1: Font Icons (Recommended)**
- Use icon fonts like Font Awesome, Feather Icons, or Lucide
- Lightweight and scalable
- Easy CSS styling
- Browser-compatible

**Option 2: SVG Icons**
- Inline SVG or symbol sprite
- Full customization
- Better accessibility
- Larger file size

**Option 3: CSS-based Icons**
- Pure CSS shapes
- No external dependencies
- Limited design complexity

### 3.3 Implementation Example with Feather Icons

**HTML Changes:**
```html
<!-- Before -->
<button id="randomMangaBtn" class="btn-random">🎲 Random</button>

<!-- After -->
<button id="randomMangaBtn" class="btn-random">
  <i data-feather="shuffle"></i>
  <span>Random</span>
</button>
```

**CSS Changes:**
```css
/* Before */
.achievement-emoji {
  font-size: 3rem;
}

/* After */
.achievement-icon {
  width: 48px;
  height: 48px;
  color: var(--primary);
}

.achievement-icon.rarity-common { color: #9ca3af; }
.achievement-icon.rarity-rare { color: #3b82f6; }
.achievement-icon.rarity-epic { color: #a855f7; }
.achievement-icon.rarity-legendary { color: #f59e0b; }
```

**JavaScript Initialization:**
```javascript
// Initialize Feather icons
document.addEventListener('DOMContentLoaded', () => {
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
});
```

---

## 4. Implementation Roadmap

### Phase 1: Navigation Stack (Week 1)
- [ ] Implement NavigationManager class
- [ ] Update setView() function
- [ ] Modify all navigation trigger points
- [ ] Add localStorage persistence
- [ ] Test all navigation flows
- [ ] Handle edge cases

### Phase 2: Achievement JSON System (Week 2)
- [ ] Create achievements.json
- [ ] Create icon-mapping.json
- [ ] Implement AchievementManager class
- [ ] Update server endpoints to support new structure
- [ ] Migrate existing achievements
- [ ] Test achievement unlocking

### Phase 3: Emoji Removal (Week 3)
- [ ] Choose icon library (Feather Icons recommended)
- [ ] Create icon component/helper
- [ ] Replace all emoji in HTML
- [ ] Replace all emoji in JavaScript
- [ ] Replace all emoji in CSS
- [ ] Update translations
- [ ] Cross-browser testing

### Phase 4: Testing & Polish (Week 4)
- [ ] Unit tests for NavigationManager
- [ ] Unit tests for AchievementManager
- [ ] Integration testing
- [ ] Performance testing
- [ ] Accessibility audit
- [ ] Documentation updates

---

## 5. Testing Plan

### 5.1 Navigation Testing

**Test Cases:**
1. **Linear Navigation**
   - Start at Discover
   - Navigate to Manga Details
   - Click Back → Should return to Discover

2. **Advanced Search Context**
   - Set filters in Advanced Search
   - Select manga
   - Click Back → Should return to Advanced Search with filters preserved

3. **Library Context**
   - Filter Library to "Reading"
   - Select manga
   - Enter Reader
   - Back → Manga Details
   - Back → Library with "Reading" filter

4. **Deep Navigation**
   - Navigate through 10+ views
   - Back through all
   - Verify stack cleanup

5. **Page Refresh**
   - Navigate several views
   - Refresh page
   - Verify stack persistence

6. **Edge Cases**
   - Empty stack behavior
   - Invalid context handling
   - Stack overflow prevention

### 5.2 Achievement Testing

**Test Cases:**
1. **Achievement Unlocking**
   - Simulate statistics changes
   - Verify correct achievements unlock
   - Verify notifications appear

2. **JSON Loading**
   - Modify achievements.json
   - Reload app
   - Verify changes reflected

3. **Category Filtering**
   - Display by category
   - Verify progress calculations

4. **Custom Conditions**
   - Test custom handlers
   - Verify composite conditions

5. **Performance**
   - Load time with 100+ achievements
   - Check frequency optimization

---

## 6. Maintenance Guide

### 6.1 Adding New Achievements

**Steps:**
1. Open `data/achievements.json`
2. Choose appropriate category or create new one
3. Add achievement object with required fields
4. If using new icon, add to `data/icon-mapping.json`
5. If custom condition needed, add handler in `achievement-manager.js`
6. No code changes required otherwise

**Example:**
```json
{
  "id": "genre_explorer",
  "name": "Genre Explorer",
  "description": "Read manga from 10 different genres",
  "icon": "compass",
  "rarity": "rare",
  "points": 150,
  "condition": {
    "type": "stat_check",
    "stat": "uniqueGenres",
    "operator": ">=",
    "value": 10
  }
}
```

### 6.2 Modifying Navigation Behavior

**Common Modifications:**

1. **Clear stack on specific action:**
```javascript
// Clear stack when user goes to Home
homeButton.onclick = () => {
  NavigationManager.clearStack();
  setView('discover');
};
```

2. **Replace current entry instead of push:**
```javascript
// When refreshing same view
setView('manga-details', context, { replace: true });
```

3. **Custom back behavior for specific view:**
```javascript
// Override back for reader
if (currentView === 'reader') {
  // Custom logic
  NavigationManager.clearToView('library');
}
```

---

## 7. API Changes

### 7.1 New Endpoints

**GET `/data/achievements.json`**
- Returns achievement configuration
- Public endpoint
- Cached by browser

**GET `/data/icon-mapping.json`**
- Returns icon mappings
- Public endpoint
- Cached by browser

### 7.2 Modified Endpoints

**POST `/api/achievements/unlock`**
- Accept dynamic achievement IDs from JSON
- Validate against loaded configuration

---

## 8. Performance Considerations

### 8.1 Navigation Stack

- **Memory Usage**: Limited to 50 entries (~5KB)
- **localStorage**: Single write per navigation (~1ms)
- **Restoration**: Async loading, non-blocking

### 8.2 Achievement System

- **JSON Loading**: One-time on app initialization (~10KB file)
- **Check Frequency**: Throttled to significant events only
- **Caching**: Achievement data cached in memory

---

## 9. Accessibility Improvements

### 9.1 Navigation

- Add ARIA labels to back button
- Announce view changes to screen readers
- Keyboard navigation support (Alt + Left Arrow for back)

### 9.2 Achievements

- Icon alt text from icon-mapping.json
- Progress announcements for screen readers
- High contrast mode support for rarity colors

---

## 10. Future Enhancements

### 10.1 Navigation

- URL routing integration
- Browser back/forward button support
- Gesture navigation for mobile
- Navigation breadcrumbs

### 10.2 Achievements

- Achievement showcase profile
- Social sharing
- Seasonal/event achievements
- Achievement hints/progress tracking
- Leaderboards

---

## Conclusion

This specification provides a comprehensive system for:
1. **Contextual navigation** that remembers user context
2. **Maintainable achievements** through JSON configuration
3. **Professional UI** without emoji dependencies

The implementation is modular, testable, and extensible for future requirements.
