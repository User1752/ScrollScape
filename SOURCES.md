# Available Manga Sources

## Total: 11 Sources

### Original Sources (6)

#### 1. MangaDex
- **File**: `mangadex.js`
- **Type**: Official API
- **Stability**: ⭐⭐⭐⭐⭐ (Most Stable)
- **Speed**: Fast
- **Features**: Advanced search, tags, multiple languages
- **Best For**: Reliability, official releases

#### 2. MangaNato
- **File**: `manganato.js`
- **Type**: Web Scraping
- **Stability**: ⭐⭐⭐⭐
- **Speed**: Medium
- **Features**: Large catalog, frequent updates
- **Best For**: Popular series

#### 3. Asura Scans
- **File**: `asurascans.js`
- **Type**: Scan Group
- **Stability**: ⭐⭐⭐
- **Speed**: Medium
- **Features**: High-quality scans, manhwa focus
- **Best For**: Premium manhwa translations

#### 4. MangaFire
- **File**: `mangafire.js`
- **Type**: Aggregator
- **Stability**: ⭐⭐⭐⭐
- **Speed**: Fast
- **Features**: Modern interface, large catalog
- **Best For**: Aggregated content

#### 5. TCB Scans
- **File**: `tcbscans.js`
- **Type**: Scan Group
- **Stability**: ⭐⭐⭐
- **Speed**: Medium
- **Features**: Fast releases for popular series (One Piece, etc.)
- **Best For**: Latest weekly chapters

#### 6. MangaKakalot (Original)
- **File**: `mangakakalot.js`
- **Type**: Aggregator
- **Stability**: ⭐⭐⭐
- **Speed**: Medium
- **Features**: Extensive library
- **Best For**: Older/completed series

---

### Tachiyomi-Adapted Sources (5)

#### 7. MangaSee
- **File**: `mangasee.js`
- **Origin**: Tachiyomi Extension
- **Stability**: ⭐⭐⭐⭐⭐
- **Speed**: Very Fast
- **Features**:
  - Client-side search (searches entire catalog)
  - High-resolution images
  - MangaSee123 infrastructure
  - Advanced chapter numbering (supports decimals)
- **Best For**: High-quality images, extensive library
- **URL**: https://mangasee123.com

#### 8. Manganelo/MangaKakalot Multi
- **File**: `mangakakalot-multi.js`
- **Origin**: Tachiyomi Extension (Enhanced)
- **Stability**: ⭐⭐⭐⭐
- **Speed**: Fast
- **Features**:
  - Multi-domain support (Manganelo + Mangakakalot)
  - Automatic fallback between domains
  - Updated HTML selectors
  - Better date parsing
- **Best For**: Reliability through redundancy
- **URLs**: 
  - https://chapmanganelo.com
  - https://mangakakalot.com

#### 9. ReadManhwa
- **File**: `readmanhwa.js`
- **Origin**: Tachiyomi Extension
- **Stability**: ⭐⭐⭐⭐⭐
- **Speed**: Very Fast (JSON API)
- **Features**:
  - JSON API (no HTML scraping)
  - Manhwa-focused content
  - Rich metadata (genres, ratings)
  - Popularity sorting
- **Best For**: Korean manhwa, speed
- **URL**: https://www.readmanhwa.com

#### 10. MangaHere
- **File**: `mangahere.js`
- **Origin**: Tachiyomi Extension
- **Stability**: ⭐⭐⭐⭐
- **Speed**: Medium
- **Features**:
  - Large established library
  - Detailed manga information
  - Genre tags
  - Author listings
- **Best For**: Discovery, classic manga
- **URL**: https://www.mangahere.cc

#### 11. Reaper Scans
- **File**: `reaperscans.js`
- **Origin**: Tachiyomi Extension
- **Stability**: ⭐⭐⭐⭐
- **Speed**: Fast
- **Features**:
  - Premium quality scans
  - Fast release schedule
  - WordPress-based API
  - AJAX chapter loading
- **Best For**: Premium manhwa, latest releases
- **URL**: https://reaperscans.com

---

## Source Comparison

### Speed Ranking
1. 🥇 ReadManhwa (JSON API)
2. 🥈 MangaSee (Client-side search)
3. 🥉 MangaDex (Official API)
4. MangaKakalot Multi
5. MangaFire
6. Reaper Scans
7. MangaNato
8. MangaHere
9. MangaKakalot (Original)
10. Asura Scans
11. TCB Scans

### Stability Ranking
1. 🥇 MangaDex (Official API)
1. 🥇 MangaSee (Stable infrastructure)
1. 🥇 ReadManhwa (JSON API)
4. MangaNato
4. MangaKakalot Multi
4. MangaFireHere
4. Reaper Scans
8. MangaKakalot (Original)
8. Asura Scans
8. TCB Scans

### Library Size Ranking
1. 🥇 MangaSee (50,000+)
2. 🥈 MangaDex (40,000+)
3. 🥉 MangaHere (30,000+)
4. MangaKakalot (25,000+)
5. MangaNato (25,000+)
6. MangaFire (20,000+)
7. ReadManhwa (15,000+ manhwa)
8. Reaper Scans (500+ premium)
9. Asura Scans (300+ premium)
10. TCB Scans (50+ weekly)

---

## Recommended Usage

### For Best Results:
1. **Primary Source**: MangaDex (most reliable)
2. **Backup Source**: MangaSee (speed + quality)
3. **Manhwa**: ReadManhwa or Asura Scans
4. **Latest Chapters**: TCB Scans or Reaper Scans

### Popular Manga:
- One Piece: TCB Scans → MangaSee → MangaDex
- Solo Leveling: Asura Scans → ReadManhwa
- Naruto/Bleach: MangaSee → MangaHere → MangaDex
- Korean Manhwa: ReadManhwa → Asura Scans → Reaper Scans

### Niche/Obscure Titles:
- Try: MangaSee → MangaDex → MangaHere

---

## Technical Details

### API Types:
- **Official API**: MangaDex, ReadManhwa
- **Web Scraping**: MangaNato, Asura, MangaFire, TCB, MangaKakalot (all), MangaHere, Reaper
- **Client-Side**: MangaSee (JavaScript search index)

### Response Formats:
All sources return standardized formats:

**Search Results:**
```javascript
{
  results: [
    {
      id: "manga-id",
      title: "Manga Title",
      cover: "https://...",
      author: "Author Name",
      status: "ongoing|completed|unknown",
      genres: ["Action", "Adventure"]
    }
  ],
  hasNextPage: true
}
```

**Manga Details:**
```javascript
{
  id: "manga-id",
  title: "Manga Title",
  cover: "https://...",
  author: "Author Name",
  description: "...",
  status: "ongoing|completed|unknown",
  genres: ["Action", "Adventure"],
  lastChapter: "123"
}
```

**Chapters:**
```javascript
{
  chapters: [
    {
      id: "chapter-id",
      name: "Chapter 1",
      chapter: "1",
      date: "2024-01-01T00:00:00.000Z",
      scanlator: "Group Name"
    }
  ]
}
```

**Pages:**
```javascript
{
  pages: [
    {
      img: "https://...",
      page: 1
    }
  ]
}
```

---

## Adding More Sources

Want to add more Tachiyomi extensions? See [TACHIYOMI_ADAPTATION.md](TACHIYOMI_ADAPTATION.md) for:
- Adaptation process
- Template code
- Conversion guide (Kotlin → JavaScript)
- Testing procedures

---

## Troubleshooting

### Source Not Working?
1. Check if the source website is online
2. Try a different source
3. Clear browser cache
4. Check server console for errors

### Slow Performance?
1. Use API-based sources (MangaDex, ReadManhwa)
2. Avoid web-scraping sources during peak hours
3. Try MangaSee for client-side search

### Missing Manga?
- Different sources have different catalogs
- Try multiple sources
- Use Advanced Search for better results

---

## Credits

**Original Sources:**
- MangaDex team
- Community scanlation groups

**Tachiyomi Adaptations:**
- Tachiyomi development team
- Keiyoushi extensions repository
- Individual extension developers

**Manghu Integration:**
- Source adaptation and PC optimization
- Unified API interface
- Error handling and retry logic
