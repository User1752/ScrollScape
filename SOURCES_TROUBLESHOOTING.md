# Manga Sources - Status & Troubleshooting

## Current Status (February 2026)

### ✅ Working Sources
- **MangaDex** - Official API, stable and reliable

### ⚠️ Problematic Sources (Scraping-based)
- MangaNato
- MangaKakalot  
- Asura Scans
- MangaFire
- MangaHere
- MangaSee
- ReadManhwa
- Reaper Scans
- TCB Scans

## Why Sources Break

Web scraping sources fail frequently due to:

1. **Cloudflare Protection** - Sites use anti-bot measures
2. **HTML Structure Changes** - Sites update their layout
3. **Dynamic Content Loading** - Content loaded via JavaScript
4. **Rate Limiting** - Too many requests get blocked
5. **Domain Changes** - Sites change URLs frequently

## Solutions

### Short-term Fixes

1. **Update Headers** - Sites may require specific User-Agent strings
2. **Add Delays** - Prevent rate limiting
3. **Update Selectors** - When HTML changes, update regex/parsing logic

### Long-term Solutions

#### Option 1: Use Official APIs (Recommended)
- **MangaDex**: Already implemented ✅
- **ComicK API**: https://api.comick.io (free tier available)
- **Kitsu API**: https://kitsu.docs.apiary.io
- **AniList API**: GraphQL API for manga metadata

#### Option 2: Browser Automation
Use Puppeteer or Playwright to render JavaScript:
```javascript
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url);
const html = await page.content();
```

**Pros**: Handles JavaScript, bypasses some protection
**Cons**: Slow, resource-intensive, may still be blocked

#### Option 3: Third-party Extension Repositories

Reference the Tachiyomi extension ecosystem:

- **Keiyoushi Extensions**: https://github.com/keiyoushi/extensions-source
  - Most comprehensive collection
  - Regular updates
  - Community-maintained

- **Mihon Guide**: https://wotaku.wiki/guides/ext/mihon
  - Installation guides
  - Extension recommendations

- **Kareadita Extensions**: https://github.com/Kareadita/tach-extension
  - Tachiyomi-compatible extensions

- **Suwayomi Extensions**: https://github.com/Suwayomi/tachiyomi-extension
  - Server-side Tachiyomi

#### Option 4: Aggregate APIs

Use manga aggregator APIs:

1. **Manga Updates API**
   - Already integrated for metadata ✅
   - No chapter content, metadata only

2. **Jikan API** (MyAnimeList)
   - Metadata only
   - https://jikan.moe

3. **Manga+ by Shueisha**
   - Official Shonen Jump manga
   - Requires authentication

## Recommended Action Plan

### Phase 1: Stabilize Core (Current)
- [x] MangaDex API working
- [ ] Add ComicK API as backup
- [ ] Document which sources are stable

### Phase 2: API-First Approach
- [ ] Implement ComicK API source
- [ ] Add AniList integration for tracking
- [ ] Use Manga Updates for completeness checking

### Phase 3: Browser Automation (Optional)
- [ ] Add Puppeteer for sites requiring JavaScript
- [ ] Implement caching to reduce requests
- [ ] Add configurable delays

### Phase 4: Extension System
- [ ] Build adapter layer for Tachiyomi extensions
- [ ] Allow users to install extensions from repos
- [ ] Auto-update mechanism

## Testing Sources

To test if a source is working:

1. **Search Test**: Try searching for "One Piece"
2. **Details Test**: Load manga details page
3. **Chapters Test**: Load chapter list
4. **Pages Test**: Load chapter images

If any step fails, the source needs fixing.

## Debugging Tips

### 1. Check HTTP Status
```javascript
console.log('Response status:', res.status);
console.log('Response headers:', res.headers);
```

### 2. Save HTML for Inspection
```javascript
const fs = require('fs');
fs.writeFileSync('debug.html', html, 'utf8');
```

### 3. Test Regex Patterns
```javascript
const matches = html.match(yourRegex);
console.log('Matches found:', matches?.length || 0);
```

### 4. Use Online Regex Testers
- regex101.com - Test patterns against sample HTML
- Copy actual HTML from browser DevTools

## Alternative Manga Sources with APIs

### Free/Open APIs
- **ComicK** (comick.io) - Extensive catalog, free API
- **MangaDex** (mangadex.org) - Already implemented
- **Cubari** (cubari.moe) - Proxy for multiple sources

### Aggregator APIs
- **Paperback** - iOS manga reader with sources
- **Tachiyomi Sources** - Android reader extensions

## Migration Path

For users relying on broken sources:

1. **Export Library** - Save favorites list
2. **Switch to MangaDex** - Most reliable currently
3. **Add ComicK** - When implemented
4. **Re-import Library** - Match titles across sources

## Notes

- Web scraping is inherently fragile
- Sites actively fight against scrapers
- APIs are more stable but may have limitations
- Consider legal/ethical implications
- Support official releases when possible

## References

- Keiyoushi Extensions: https://github.com/keiyoushi/extensions-source
- Mihon Guide: https://wotaku.wiki/guides/ext/mihon
- Tachiyomi Extensions: https://github.com/Suwayomi/tachiyomi-extension
- Kareadita: https://github.com/Kareadita/tach-extension
- ComicK API Docs: https://api.comick.io/docs

---

Last Updated: February 27, 2026
