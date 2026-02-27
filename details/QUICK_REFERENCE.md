# Navigation & Achievement System - Quick Reference

## Navigation Stack API

### Push View to Stack
```javascript
NavigationManager.pushView(view, context, replace);
```
**Parameters:**
- `view` (string): View identifier ("discover", "library", "manga-details", etc.)
- `context` (object): View-specific context data
- `replace` (boolean): Replace current entry instead of pushing new one

**Example:**
```javascript
NavigationManager.pushView("manga-details", {
  mangaId: "one-piece",
  sourceId: "mangasee",
  fromView: "library"
});
```

---

### Navigate Back
```javascript
NavigationManager.goBack();
```
**Returns:** Previous navigation entry or null

**Example:**
```javascript
backButton.onclick = () => {
  NavigationManager.goBack();
};
```

---

### Get Current Entry
```javascript
const current = NavigationManager.getCurrentEntry();
```
**Returns:** `{ view, context, timestamp, scrollPosition }` or null

---

### Get Previous Entry
```javascript
const previous = NavigationManager.getPreviousEntry();
```
**Returns:** Entry before current or null

---

### Check If Can Go Back
```javascript
if (NavigationManager.canGoBack()) {
  // Show back button
}
```

---

### Clear Stack
```javascript
NavigationManager.clearStack(); // Clear all
NavigationManager.clearToView("library"); // Clear to specific view
```

---

## Achievement System API

### Initialize
```javascript
await achievementManager.initialize();
```
**Required:** Call once on app startup

---

### Check and Unlock
```javascript
const stats = {
  totalChaptersRead: 50,
  totalFavorites: 10,
  completedCount: 2,
  totalTimeSpent: 120,
  currentStreak: 5
};

const newlyUnlocked = await achievementManager.checkAndUnlockAchievements(stats);
```
**Returns:** Array of newly unlocked achievements

---

### Get All Achievements
```javascript
const all = achievementManager.getAllAchievements();
```
**Returns:** Array of all achievements with category info

---

### Get By Category
```javascript
const reading = achievementManager.getAchievementsByCategory("reading");
```
**Returns:** Array of achievements in that category

---

### Get Single Achievement
```javascript
const achievement = achievementManager.getAchievement("first_read");
```
**Returns:** Achievement object or undefined

---

### Get Icon HTML
```javascript
const iconHtml = achievementManager.getIconHtml("trophy", "large");
```
**Sizes:** "small" (16px), "medium" (24px), "large" (48px)

---

### Get Total Points
```javascript
const points = achievementManager.getTotalPoints();
```

---

### Get Category Progress
```javascript
const progress = achievementManager.getCategoryProgress("reading");
// Returns: { earned: 3, total: 5, percentage: 60 }
```

---

## Icon System

### Icon Mapping
All icons use Feather Icons library. Reference `data/icon-mapping.json` for available icons.

### Usage in HTML
```html
<i data-feather="book"></i>
<i data-feather="heart"></i>
<i data-feather="trophy"></i>
```

### Initialize Icons
```javascript
feather.replace(); // Call after DOM updates
```

### Get Icon Programmatically
```javascript
const iconHtml = achievementManager.getIconHtml("star", "medium");
```

---

## Context Structure Examples

### Manga Details Context
```javascript
{
  mangaId: "one-piece",
  sourceId: "mangasee",
  fromView: "advanced-search"
}
```

### Advanced Search Context
```javascript
{
  filters: {
    genre: "Action",
    status: "ongoing",
    sort: "popularity"
  },
  searchQuery: "naruto",
  page: 1
}
```

### Library Context
```javascript
{
  statusFilter: "reading"
}
```

### Reader Context
```javascript
{
  mangaId: "one-piece",
  chapterId: "chapter-1000",
  sourceId: "mangasee",
  fromView: "manga-details"
}
```

---

## Achievement Condition Types

### Stat Check
```json
{
  "type": "stat_check",
  "stat": "totalChaptersRead",
  "operator": ">=",
  "value": 100
}
```
**Operators:** `>=`, `>`, `<=`, `<`, `==`, `!=`

---

### Custom Handler
```json
{
  "type": "custom",
  "handler": "checkEarlyBird",
  "params": {}
}
```

---

### Composite (AND/OR)
```json
{
  "type": "composite",
  "logic": "AND",
  "conditions": [
    { "type": "stat_check", "stat": "totalChaptersRead", "operator": ">=", "value": 50 },
    { "type": "stat_check", "stat": "totalFavorites", "operator": ">=", "value": 5 }
  ]
}
```

---

## Available Stats for Conditions

| Stat Name | Type | Description |
|-----------|------|-------------|
| `totalChaptersRead` | number | Total chapters read |
| `totalTimeSpent` | number | Total minutes spent reading |
| `totalFavorites` | number | Manga in library |
| `completedCount` | number | Manga marked completed |
| `currentStreak` | number | Current daily reading streak |
| `totalReviews` | number | Reviews written |
| `uniqueSources` | number | Different sources used |
| `uniqueGenres` | number | Different genres read |

---

## Achievement Rarity Levels

| Rarity | Color | CSS Class |
|--------|-------|-----------|
| Common | Gray (#9ca3af) | `rarity-common` |
| Rare | Blue (#3b82f6) | `rarity-rare` |
| Epic | Purple (#a855f7) | `rarity-epic` |
| Legendary | Gold (#f59e0b) | `rarity-legendary` |

---

## Event Hooks

### When to Check Achievements
```javascript
// After reading a chapter
await checkAndUnlockAchievements();

// After adding to library
await checkAndUnlockAchievements();

// After marking as completed
await checkAndUnlockAchievements();

// On app load (to catch offline progress)
await checkAndUnlockAchievements();
```

### When to Push to Navigation Stack
```javascript
// When user takes action that changes view
// Examples:
showMangaDetails() → pushView("manga-details", {...})
loadChapter() → pushView("reader", {...})
advancedSearch() → pushView("advanced-search", {...})
```

---

## Common Patterns

### Pattern 1: View with Context Preservation
```javascript
function showLibrary(statusFilter = "reading") {
  NavigationManager.pushView("library", { statusFilter });
  state.libraryStatusFilter = statusFilter;
  setView("library", {}, false);
  renderLibrary();
}
```

### Pattern 2: Back to Previous with Fallback
```javascript
function goBackOrHome() {
  if (NavigationManager.canGoBack()) {
    NavigationManager.goBack();
  } else {
    setView("discover");
  }
}
```

### Pattern 3: Clear Stack on Home
```javascript
function goHome() {
  NavigationManager.clearStack();
  setView("discover");
}
```

### Pattern 4: Achievement Notification
```javascript
async function unlockAchievement(achievementId) {
  const achievement = achievementManager.getAchievement(achievementId);
  if (!achievement) return;
  
  const result = await api('/api/achievements/unlock', {
    method: 'POST',
    body: JSON.stringify({ achievementId })
  });
  
  if (result.isNew) {
    showToast(
      'Achievement Unlocked!',
      `${achievement.name}: ${achievement.description}`,
      'success'
    );
  }
}
```

---

## Debugging

### Navigation Stack
```javascript
// View current stack
console.log(state.navigationStack);

// View current entry
console.log(NavigationManager.getCurrentEntry());

// Check localStorage
console.log(localStorage.getItem('manghu_navigation_stack'));
```

### Achievements
```javascript
// View all achievements
console.log(achievementManager.getAllAchievements());

// View earned achievements
console.log(achievementManager.earnedAchievements);

// Test condition
const stats = { totalChaptersRead: 10 };
const achievement = achievementManager.getAchievement('reader_10');
console.log(achievementManager.checkCondition(achievement, stats));
```

---

## File Locations

| File | Purpose |
|------|---------|
| `NAVIGATION_SPECIFICATION.md` | Full technical specification |
| `IMPLEMENTATION_GUIDE.md` | Step-by-step implementation |
| `QUICK_REFERENCE.md` | This file - API reference |
| `data/achievements.json` | Achievement definitions |
| `data/icon-mapping.json` | Icon mappings |
| `public/achievement-manager.js` | Achievement system class |

---

## Common Issues & Solutions

### Issue: Navigation stack not persisting
**Solution:** Ensure `NavigationManager.loadStack()` called in `init()`

### Issue: Back button not showing
**Solution:** Check CSS display property updated in `setView()`

### Issue: Achievements not loading
**Solution:** Verify JSON files accessible at `/data/achievements.json`

### Issue: Icons not displaying
**Solution:** Check Feather Icons CDN loaded and `feather.replace()` called

### Issue: Achievement unlocking twice
**Solution:** Check `earnedAchievements` Set before unlocking

---

## Performance Tips

1. **Navigation:** Stack limited to 50 entries automatically
2. **Achievements:** Check only on significant events, not every state change
3. **Icons:** Use `feather.replace()` sparingly, only after DOM updates
4. **Context:** Keep context objects small (<1KB per entry)

---

## Accessibility

### Navigation
- Add ARIA labels: `aria-label="Go back"`
- Keyboard shortcut: Alt + Left Arrow
- Announce view changes to screen readers

### Achievements
- Icon alt text from icon-mapping.json
- Use semantic HTML for progress
- High contrast support for rarity colors

### Icons
- Always include `aria-label` on icons
- Use `<i>` with Feather's data-feather
- Fallback text for screen readers

---

## Migration Checklist

- [ ] Add `navigationStack` to state object
- [ ] Copy `NavigationManager` to app.js
- [ ] Update `setView()` function
- [ ] Update back button handler
- [ ] Add context to navigation points
- [ ] Test navigation flows
- [ ] Create achievement-manager.js
- [ ] Include JSON files
- [ ] Update achievement checking
- [ ] Test achievement unlocking
- [ ] Include Feather Icons CDN
- [ ] Replace emojis in HTML
- [ ] Replace emojis in JS
- [ ] Add icon CSS
- [ ] Test all icons display
- [ ] Cross-browser testing
- [ ] Update documentation

---

## Version Compatibility

**Minimum Requirements:**
- Modern browsers (ES6+)
- localStorage support
- JSON parsing support
- Feather Icons 4.x

**Tested On:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Support Resources

- Full Specification: `NAVIGATION_SPECIFICATION.md`
- Implementation Guide: `IMPLEMENTATION_GUIDE.md`
- Feather Icons: https://feathericons.com/
- JSON Schema: See specification Section 2.2.1

---

*Last Updated: 2026-02-27*
