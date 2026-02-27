# Manghu - Manga Web Reader

A self-hosted web-based manga reader with support for 11 manga sources including Tachiyomi-adapted extensions, library tracking, analytics, and more.

## Features

**Reading**
- LTR, RTL, and Webtoon (vertical scroll) reading modes
- Zoom controls (+/−/reset) with keyboard shortcuts
- Auto-scroll with adjustable speed
- Automatic progress saving — resume from where you left off
- Mark chapters as read, skip duplicates

**Sources (11 Total)**
- **Original Sources (6):**
  - MangaDex (API-based, most stable)
  - MangaNato
  - Asura Scans
  - MangaFire
  - TCB Scans
  - MangaKakalot

- **Tachiyomi-Adapted Sources (5):**
  - MangaSee (high-quality aggregator)
  - Manganelo/Mangakakalot Multi (multi-domain support)
  - ReadManhwa (JSON API, manhwa focus)
  - MangaHere (popular aggregator)
  - Reaper Scans (premium scan group)

- Switch between sources dynamically
- Homepage content updates based on selected source
- See [TACHIYOMI_ADAPTATION.md](TACHIYOMI_ADAPTATION.md) for details on adapted sources

**Downloads**
- Download individual chapters
- Bulk download multiple chapters at once
- Chapter integrity checking with MangaUpdates.com integration
- Automatic detection of missing chapters, duplicates, and gaps

**Library & Organization**
- Add manga to your personal library
- Set reading status per manga: Reading, Completed, On Hold, Plan to Read, Dropped
- Filter your library by reading status

**Discovery**
- Quick search and Advanced Search with filters (order by, status, tags)
- Random manga button
- Personalized recommendations based on the genres in your library
- Popular manga from selected source
- Recently added and latest updates

**Reviews & Ratings**
- Rate manga with 1–5 stars
- Write optional text reviews

**Analytics & Achievements**
- Track total chapters read, time spent reading, and daily streak
- Status distribution chart (how much of your library is completed, reading, etc.)
- 12 unlockable achievements with in-app notifications

**Interface**
- Dark and Light mode toggle (persisted across sessions)
- Multi-language support (English & Portuguese)
- Enhanced filters with beautiful gradients and animations
- Toast notifications for all actions
- Responsive layout — works on mobile and desktop

---

## Quick Start

### Local

```bash
npm install
npm start
```

Open: http://localhost:3000

### Docker

```bash
cd docker
docker compose up --build
```

Open: http://localhost:3000

---

## User Guide

### Selecting a Source

1. Use the dropdown in the search section to select your preferred manga source
2. Homepage content (popular manga, latest updates) will update automatically
3. Each source has different manga catalogs and update frequencies

**Note:** MangaDex is the most stable source as it uses an official API. Other sources may occasionally fail due to site changes or blocking.

### Searching for Manga

1. Select a source from the dropdown
2. Enter a title in the search bar on the Home view and press Enter or click **Search**
3. Click any result to open the manga detail page
4. For filters (genre, status, tags, sort order) use **Advanced Search** in the sidebar

### Managing Your Library

- On any manga detail page, click **Add to Library** to save it
- Use the **Reading Status** dropdown on the detail page to track your progress
- Go to **Library** in the sidebar to see all saved manga — use the filter to narrow by status

### Downloading Chapters

1. Open a manga detail page
2. Click **Download** next to any chapter for individual download
3. Click **Bulk Download** to select multiple chapters
4. Use **Check Integrity** to verify chapter completeness
   - Automatically queries MangaUpdates.com for accurate chapter counts
   - Detects gaps, duplicates, and missing chapters
   - Shows percentage completion based on external data

### Chapter Integrity

The integrity check feature automatically searches MangaUpdates.com to verify:
- Total expected chapters for the manga
- Missing chapter ranges
- Duplicate chapters
- Overall completion percentage

This helps ensure your downloads are complete and up-to-date.

### Reading a Chapter

1. Open a manga and click any chapter from the chapter list
2. Navigate pages with the arrow buttons or keyboard:
   - `→` / `d` — next page
   - `←` / `a` — previous page
   - `Escape` — close reader
   - `+` / `=` — zoom in
   - `-` — zoom out
3. Change reading mode (LTR/RTL/Webtoon) in **Settings** (⚙️)
4. Enable Auto-scroll for continuous reading

### Language

- Switch between English and Portuguese using the language selector in the top bar
- Setting persists across sessions

### Analytics

Go to **Analytics** in the sidebar to see:
- Chapters read, total reading time, and daily streak
- Status distribution across your library
- Recent reading sessions
- Earned achievements

---

## Settings

Access via the ⚙️ button in the sidebar.

| Setting | Description |
|---|---|
| Language | English / Português |
| Reading Mode | LTR / RTL / Webtoon |
| Hide Read Chapters | Only show unread chapters in chapter lists |
| Skip Duplicate Chapters | Skip chapters with the same chapter number |
| Pan Wide Images | Enable horizontal scroll for double-page spreads |
| Auto-scroll Speed | Adjust automatic scrolling speed (1-5) |
| Clear Reading History | Reset all locally saved reading progress |

---

## Project Structure

```
Manghu/
├── data/
│   ├── sources/           # Manga source scripts
│   │   ├── mangadex.js    # MangaDex API (most stable)
│   │   ├── mangakakalot.js
│   │   ├── manganato.js
│   │   ├── asurascans.js
│   │   ├── mangafire.js
│   │   └── tcbscans.js
│   ├── store.json         # All persistent data (library, lists, analytics, etc.)
│   └── cache/             # API cache
├── public/
│   ├── index.html         # App shell and views
│   ├── styles.css         # Styles (dark/light themes, all components)
│   └── app.js             # Frontend logic with i18n support
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── server.js              # Express API server
└── package.json
```

---

## API Reference

### Content

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/source/:id/search` | Search manga. Body: `{ query, page, orderBy?, statuses?, tags? }` |
| `POST` | `/api/source/:id/mangaDetails` | Get manga info. Body: `{ mangaId }` |
| `POST` | `/api/source/:id/chapters` | Get chapter list. Body: `{ mangaId }` |
| `POST` | `/api/source/:id/pages` | Get page images. Body: `{ chapterId }` |

### Downloads

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/download/chapter` | Download a single chapter. Body: `{ sourceId, chapterId }` |
| `POST` | `/api/download/bulk` | Download multiple chapters. Body: `{ sourceId, mangaId, chapterIds[] }` |

### MangaUpdates Integration

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/mangaupdates/search` | Search MangaUpdates for manga data. Body: `{ title }` |

### Library

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/library` | Returns `{ favorites, history }` |
| `POST` | `/api/favorites/toggle` | Add or remove from library |
| `GET` | `/api/user/status` | Get all reading statuses |
| `POST` | `/api/user/status` | Set status for a manga |

### Reviews

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reviews/:mangaId` | Get reviews for a manga |
| `POST` | `/api/reviews` | Submit a review (`{ mangaId, rating, text }`) |

### Analytics & Achievements

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics` | Get stats, status distribution, sessions |
| `POST` | `/api/analytics/session` | Record a reading session |
| `GET` | `/api/achievements` | Get unlocked achievements |
| `POST` | `/api/achievements/unlock` | Unlock an achievement |

---

## Adding a Custom Source

Create `data/sources/mysource.js`:

```javascript
module.exports = {
  meta: {
    id: "mysource",
    name: "My Source",
    version: "1.0.0",
    author: "You",
    icon: ""
  },

  async search(query, page) {
    // return { results: [{ id, title, cover, author, ... }] }
  },

  async mangaDetails(mangaId) {
    // return { id, title, cover, author, description, genres, status, ... }
  },

  async chapters(mangaId) {
    // return { chapters: [{ id, name, date, ... }] }
  },

  async pages(chapterId) {
    // return { pages: [{ img: "url" }] }
  }
};
```

Restart the server — the source will be auto-installed.

---

## Data Storage

| Location | What's stored |
|---|---|
| `data/store.json` | Library, history, reading status, reviews, analytics, achievements |
| `data/sources/` | Manga source implementations (MangaDex, MangaNato, etc.) |
| `localStorage` | Settings, read chapters, reading progress, language preference |

---

## Troubleshooting

**Manga not loading** — Check your internet connection and try switching to a different source. MangaDex is the most stable.

**Source returns 403/404 errors** — Some sources may block automated requests or change their URLs. Try:
- Switching to MangaDex (most reliable)
- Waiting a few minutes before trying again
- Checking if the source's website is accessible in your browser

**Images not showing** — The source may be temporarily unavailable. Check the browser console for errors.

**Progress not saving** — Make sure localStorage is enabled in your browser and cookies aren't blocked.

**Homepage not loading** — Make sure at least one source is installed. The homepage loads content from the currently selected source.

---

## Development & Specifications

### Feature Specifications

Detailed specifications for upcoming features:

- **[NAVIGATION_SPECIFICATION.md](details/NAVIGATION_SPECIFICATION.md)** - Contextual back navigation system and structured achievement management
- **[IMPLEMENTATION_GUIDE.md](details/IMPLEMENTATION_GUIDE.md)** - Step-by-step implementation guide for new features
- **[QUICK_REFERENCE.md](details/QUICK_REFERENCE.md)** - Developer API reference for navigation and achievement systems
- **[ARCHITECTURE.md](details/ARCHITECTURE.md)** - System architecture diagrams and data flow
- **[DOCUMENTATION_INDEX.md](details/DOCUMENTATION_INDEX.md)** - Navigation guide for all documentation
- **[PROJECT_SUMMARY.md](details/PROJECT_SUMMARY.md)** - Complete deliverable summary

### Source Documentation

Information about manga sources:

- **[TACHIYOMI_ADAPTATION.md](TACHIYOMI_ADAPTATION.md)** - How Tachiyomi extensions were adapted for PC
- **[SOURCES.md](SOURCES.md)** - Complete list of all 11 sources with comparisons

### Configuration Files

- **[data/achievements.json](data/achievements.json)** - Achievement definitions (31 achievements in 6 categories)
- **[data/icon-mapping.json](data/icon-mapping.json)** - Icon system configuration (40+ icons)

---

## Notes

- **MangaDex** is the recommended primary source as it uses an official API
- Other sources use web scraping and may break if sites change their structure
- Some sources may be geo-blocked or require VPN in certain regions
- Download speeds depend on the source's server and your connection
- **MangaUpdates integration** provides accurate chapter counts for integrity checking
- Integrity check automatically queries MangaUpdates.com when no external chapter data is available

---

## License

MIT — free to use and modify.
