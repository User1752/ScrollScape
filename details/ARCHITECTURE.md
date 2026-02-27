# System Architecture Overview

## Component Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MANGHU APPLICATION                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Navigation  │  │ Achievement  │  │  Icon System │
        │    System    │  │   System     │  │              │
        └──────────────┘  └──────────────┘  └──────────────┘
                │                │                │
                │                │                │
        ┌───────┴────────┐      │         ┌──────┴──────┐
        │                │      │         │             │
        ▼                ▼      ▼         ▼             ▼
┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Navigation   │  │  State   │  │  JSON    │  │   Feather    │
│   Manager    │  │  Object  │  │  Config  │  │    Icons     │
└──────────────┘  └──────────┘  └──────────┘  └──────────────┘
        │                │            │              │
        │                │            │              │
        ▼                ▼            ▼              ▼
┌──────────────┐  ┌──────────┐  ┌───────────────────────────┐
│ localStorage │  │  Memory  │  │ data/achievements.json    │
│              │  │          │  │ data/icon-mapping.json    │
└──────────────┘  └──────────┘  └───────────────────────────┘
```

---

## Navigation Flow

```
User Action (Click Manga)
        │
        ▼
┌───────────────────┐
│  Event Handler    │
│  (e.g., onclick)  │
└───────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  NavigationManager.pushView() │
│  - Capture current state      │
│  - Add to stack               │
│  - Save to localStorage      │
└───────────────────────────────┘
        │
        ▼
┌───────────────────┐
│   setView()       │
│   - Hide old view │
│   - Show new view │
│   - Update UI     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  View Rendered    │
└───────────────────┘


Back Button Click
        │
        ▼
┌───────────────────────────────┐
│  NavigationManager.goBack()   │
│  - Pop from stack             │
│  - Get previous entry         │
│  - Restore context            │
└───────────────────────────────┘
        │
        ▼
┌───────────────────┐
│  restoreView()    │
│  - Apply context  │
│  - Restore scroll │
│  - Render view    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Previous View     │
│ (with context)    │
└───────────────────┘
```

---

## Navigation Stack Structure

```
navigationStack Array (Max 50 entries)
│
├─ Entry 0 (Oldest)
│  ├─ view: "discover"
│  ├─ context: {}
│  ├─ timestamp: 1740614400000
│  └─ scrollPosition: 0
│
├─ Entry 1
│  ├─ view: "advanced-search"
│  ├─ context: {
│  │    filters: { genre: "Action", status: "ongoing" },
│  │    searchQuery: "",
│  │    page: 1
│  │  }
│  ├─ timestamp: 1740614460000
│  └─ scrollPosition: 250
│
├─ Entry 2
│  ├─ view: "manga-details"
│  ├─ context: {
│  │    mangaId: "one-piece",
│  │    sourceId: "mangasee",
│  │    fromView: "advanced-search"
│  │  }
│  ├─ timestamp: 1740614520000
│  └─ scrollPosition: 0
│
└─ Entry 3 (Current - Top of Stack)
   ├─ view: "reader"
   ├─ context: {
   │    mangaId: "one-piece",
   │    chapterId: "chapter-1000",
   │    sourceId: "mangasee",
   │    fromView: "manga-details"
   │  }
   ├─ timestamp: 1740614580000
   └─ scrollPosition: 0

Back: Pop Entry 3, restore Entry 2
Back: Pop Entry 2, restore Entry 1
Back: Pop Entry 1, restore Entry 0
Back: Stack empty, go to default (discover)
```

---

## Achievement System Flow

```
User Action (Read Chapter)
        │
        ▼
┌───────────────────────────────┐
│  Update Analytics             │
│  - Increment totalChaptersRead│
│  - Update time spent          │
│  - Update streak              │
└───────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  checkAndUnlockAchievements()        │
│  1. Fetch analytics from server      │
│  2. Build stats object               │
│  3. Call achievementManager.check()  │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  AchievementManager                  │
│  .checkAndUnlockAchievements(stats)  │
│                                      │
│  For each achievement:               │
│  ┌────────────────────────────────┐ │
│  │ 1. Check if already earned     │ │
│  │ 2. Evaluate condition          │ │
│  │ 3. Unlock on server if met     │ │
│  │ 4. Add to earned set           │ │
│  │ 5. Return if newly unlocked    │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Newly Unlocked Array         │
│  [ achievement1, achievement2]│
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  For each newly unlocked:     │
│  - Get icon HTML              │
│  - Show toast notification    │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Update UI                    │
│  - Refresh achievements grid  │
│  - Update progress counters   │
└───────────────────────────────┘
```

---

## Achievement Condition Evaluation

```
Achievement Object
{
  "id": "reader_100",
  "condition": {
    "type": "stat_check",
    "stat": "totalChaptersRead",
    "operator": ">=",
    "value": 100
  }
}
        │
        ▼
┌─────────────────────────────┐
│  checkCondition()           │
│  - Identify condition type  │
└─────────────────────────────┘
        │
        ├────────┬────────┬──────────┐
        ▼        ▼        ▼          ▼
   stat_check  custom  composite  (other)
        │        │        │
        ▼        ▼        ▼
┌───────────┐ ┌─────────┐ ┌──────────┐
│Get stat   │ │Call     │ │Check all │
│value from │ │custom   │ │sub-      │
│stats      │ │handler  │ │conditions│
│object     │ │function │ │with AND/ │
└───────────┘ └─────────┘ │OR logic  │
        │        │        └──────────┘
        ▼        ▼             │
┌───────────────────────────────┐
│  Apply Operator               │
│  stats.totalChaptersRead      │
│  (150) >= 100                 │
│  Result: TRUE                 │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Return Boolean               │
│  true → Unlock Achievement    │
│  false → Skip                 │
└───────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                         │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  public/index.html                                 │    │
│  │  - UI Structure                                    │    │
│  │  - View containers                                 │    │
│  │  - Navigation elements                             │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  public/app.js                                     │    │
│  │  - State management (navigationStack, etc.)        │    │
│  │  - Event handlers                                  │    │
│  │  - View rendering                                  │    │
│  │  - NavigationManager integration                   │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  public/achievement-manager.js                     │    │
│  │  - AchievementManager class                        │    │
│  │  - Condition evaluation                            │    │
│  │  - Icon rendering                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│     ┌────────────────────┼────────────────────┐            │
│     │                    │                    │            │
│     ▼                    ▼                    ▼            │
│  ┌──────┐    ┌──────────────────┐    ┌──────────────┐    │
│  │Local │    │  Fetch API       │    │  Feather     │    │
│  │Stor  │    │  Calls           │    │  Icons       │    │
│  │age   │    │                  │    │              │    │
│  └──────┘    └──────────────────┘    └──────────────┘    │
│     │                │                        │            │
└─────┼────────────────┼────────────────────────┼────────────┘
      │                │                        │
      │                ▼                        │
      │     ┌─────────────────────┐             │
      │     │  server.js          │             │
      │     │  - API endpoints    │             │
      │     │  - Data persistence │             │
      │     │  - Source routing   │             │
      │     └─────────────────────┘             │
      │                │                        │
      │                ▼                        │
      │     ┌─────────────────────┐             │
      │     │  data/store.json    │             │
      │     │  - Library          │             │
      │     │  - Analytics        │             │
      │     │  - Achievements     │             │
      │     └─────────────────────┘             │
      │                                         │
      ▼                                         ▼
┌──────────────────┐              ┌──────────────────────┐
│  Navigation      │              │  Static JSON Files   │
│  Stack           │              │                      │
│  (Persisted)     │              │  achievements.json   │
│                  │              │  icon-mapping.json   │
└──────────────────┘              └──────────────────────┘
```

---

## Icon System Architecture

```
Request for Icon "trophy"
        │
        ▼
┌────────────────────────────────┐
│  achievementManager            │
│  .getIconHtml("trophy", "lg")  │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  Lookup in icon-mapping.json   │
│  {                             │
│    "trophy": {                 │
│      "class": "icon-trophy",   │
│      "featherIcon": "award",   │
│      "description": "Trophy"   │
│    }                           │
│  }                             │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  Build HTML                    │
│  <i data-feather="award"       │
│     class="icon icon-large"    │
│     aria-label="Trophy icon">  │
│  </i>                          │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  Return to caller              │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  Insert into DOM               │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  feather.replace()             │
│  - Converts data-feather to SVG│
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  Rendered SVG Icon             │
│  <svg class="feather">...</svg>│
└────────────────────────────────┘
```

---

## State Management

```
┌────────────────────────────────────────────────────┐
│  Application State Object                          │
├────────────────────────────────────────────────────┤
│  navigationStack: []           ← Navigation System │
│  ├─ Entry objects with view, context, etc.        │
│  │                                                 │
│  earnedAchievements: Set()     ← Achievement System│
│  ├─ Achievement IDs that are unlocked             │
│  │                                                 │
│  library: {}                   ← Existing          │
│  currentSource: "mangasee"     ← Existing          │
│  favorites: Set()              ← Existing          │
│  readChapters: Set()           ← Existing          │
│  lang: "en"                    ← Existing          │
│  theme: "dark"                 ← Existing          │
│  ...                           ← Other state       │
└────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ localStorage │        │    Memory    │
│              │        │              │
│ Persisted:   │        │ Runtime:     │
│ - nav stack  │        │ - views      │
│ - library    │        │ - temp data  │
│ - analytics  │        │ - cache      │
│ - theme      │        │              │
└──────────────┘        └──────────────┘
```

---

## View Lifecycle

```
1. User Triggers Navigation
   └─> NavigationManager.pushView()
   
2. Push to Stack
   └─> state.navigationStack.push({view, context, ...})
   
3. Save to localStorage
   └─> localStorage.setItem('manghu_navigation_stack', ...)
   
4. Call setView()
   └─> Hide previous view
   └─> Show new view
   └─> Update active states
   
5. Render View
   └─> Execute view-specific logic
   └─> Apply context from navigation entry
   └─> Restore scroll position
   
6. User Interacts
   └─> Trigger new navigation → Step 1
   └─> OR click back → Back Flow
   
[BACK FLOW]
1. User Clicks Back
   └─> NavigationManager.goBack()
   
2. Pop from Stack
   └─> state.navigationStack.pop()
   
3. Get Previous Entry
   └─> entry = stack[stack.length - 1]
   
4. Restore View
   └─> Call restoreView(entry)
   └─> Apply context
   └─> Restore scroll
   
5. View Restored
```

---

## Achievement Rendering

```
┌───────────────────────────────────────────────┐
│  renderAchievementsView()                     │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Load earned achievements from server         │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Get categories from achievements.json        │
│  [reading, collection, completion, ...]       │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  For each category:                           │
│  ┌─────────────────────────────────────────┐ │
│  │ 1. Render category header               │ │
│  │    - Icon                                │ │
│  │    - Name & description                  │ │
│  │    - Progress (earned/total)             │ │
│  │                                          │ │
│  │ 2. Create achievement grid               │ │
│  │    For each achievement in category:     │ │
│  │    ┌──────────────────────────────────┐ │ │
│  │    │ - Check if earned                 │ │ │
│  │    │ - Get icon HTML                   │ │ │
│  │    │ - Apply rarity class              │ │ │
│  │    │ - Render card (earned or locked)  │ │ │
│  │    └──────────────────────────────────┘ │ │
│  └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Insert HTML into DOM                         │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Call feather.replace() to render icons       │
└───────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│  Achievements Grid Displayed                  │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Reading Progress           3/5          │ │
│  ├─────────────────────────────────────────┤ │
│  │ [✓] First Steps  [✓] Bookworm          │ │
│  │ [✓] Manga Addict [🔒] Legend            │ │
│  │ [🔒] Unstoppable                        │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Library Management         2/4          │ │
│  ├─────────────────────────────────────────┤ │
│  │ [✓] Collector    [✓] Hoarder           │ │
│  │ [🔒] Curator     [🔒] Archive Master    │ │
│  └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

---

## File Structure

```
Manghu/
│
├── public/
│   ├── index.html                  (UI structure)
│   ├── app.js                      (Main application logic)
│   ├── achievement-manager.js      (New: Achievement system)
│   └── styles.css                  (Styling)
│
├── data/
│   ├── achievements.json           (New: Achievement definitions)
│   ├── icon-mapping.json           (New: Icon mappings)
│   ├── store.json                  (User data persistence)
│   └── sources/
│       ├── mangadex.js
│       ├── mangasee.js
│       └── ...
│
├── server.js                       (Express server)
│
├── NAVIGATION_SPECIFICATION.md     (Full technical spec)
├── IMPLEMENTATION_GUIDE.md         (Step-by-step guide)
├── QUICK_REFERENCE.md              (API reference)
└── ARCHITECTURE.md                 (This file)
```

---

## Integration Points Summary

### 1. Navigation System
- **Hooks into:** setView(), back button, all view transitions
- **Persists to:** localStorage
- **Dependencies:** None (standalone)

### 2. Achievement System
- **Hooks into:** Chapter read, library add, status update events
- **Loads from:** JSON files (/data/achievements.json)
- **Dependencies:** Server API (/api/achievements)

### 3. Icon System
- **Hooks into:** All UI elements using icons
- **Loads from:** Feather Icons CDN + icon-mapping.json
- **Dependencies:** Feather Icons library

---

## Performance Characteristics

| Component | Memory | Storage | Network | CPU |
|-----------|--------|---------|---------|-----|
| Navigation Stack | ~5KB | ~5KB localStorage | 0 | <1ms per nav |
| Achievement System | ~10KB | 0 | ~15KB initial load | <5ms per check |
| Icon System | ~2KB | 0 | ~20KB CDN (cached) | Native SVG render |

**Total Overhead:** ~17KB memory, ~5KB storage, ~35KB initial network

---

## Error Handling Flow

```
┌────────────────────────────┐
│  User Action / API Call   │
└────────────────────────────┘
             │
             ▼
┌────────────────────────────┐
│  try {                     │
│    // Operation            │
│  }                         │
└────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
   Success       Error
      │             │
      │             ▼
      │    ┌────────────────┐
      │    │ catch (error)  │
      │    └────────────────┘
      │             │
      │             ▼
      │    ┌────────────────────────┐
      │    │ Log to console         │
      │    │ Show user notification │
      │    │ Graceful degradation   │
      │    └────────────────────────┘
      │             │
      │             ▼
      └──────┬──────┘
             │
             ▼
┌────────────────────────────┐
│  Continue application      │
└────────────────────────────┘
```

**Graceful Degradation Examples:**
- Navigation: Fall back to simple previous view tracking
- Achievements: Show static list without unlock mechanism
- Icons: Show text fallbacks or placeholders

---

*This architecture document provides a visual overview of the navigation and achievement systems. For implementation details, see NAVIGATION_SPECIFICATION.md and IMPLEMENTATION_GUIDE.md.*
