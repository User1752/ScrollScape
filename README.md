# Manghu — Self-Hosted Manga Reader

A self-hosted web manga reader built with Node.js and vanilla JS.  
Supports **MangaDex** and **MangaPill** as online sources, plus local file imports (CBZ, CBR, PDF).

---

## Features

**Reading**
- LTR, RTL, and Webtoon (vertical scroll) reading modes
- **PDF support** — full Webtoon scroll and single-page LTR/RTL for imported PDFs, rendered client-side via PDF.js
- Zoom controls (+/−/reset) with keyboard shortcuts
- Auto-scroll with adjustable speed
- Automatic progress saving — resume where you left off
- Mark chapters as read / unread
- Right-click chapter menu: mark read, mark unread, flag (highlight)

**Sources**
- **MangaDex** — Official API (stable, no scraping)
- **MangaPill** — HTML scraper
- **Source-switch dropdown** on the manga detail page — click the source badge to search the same title on any other installed source and open it instantly
- Opening a library manga automatically switches to its original source
- Drop any `.js` file in `data/sources/` and it is auto-installed on startup

**Search & Discovery**
- Source selector in the top bar — switch between MangaDex and MangaPill at any time
- Advanced Search with genre checkboxes, status, and sort order
- Random manga button
- Personalised recommendations based on your library genres

**Local Manga Import**
- Import CBZ, CBR, and PDF files (up to 500 MB) directly from your device
- **First page of PDFs is auto-rendered as the cover image** (via PDF.js, no server-side processing)
- Files are stored on the server and served like any other manga
- Delete local manga from the library at any time

**Library & Organisation**
- Add manga from any source to your personal library
- Import local files (CBZ/CBR/PDF) — they appear in the library automatically
- Reading status per manga: Reading, Completed, On Hold, Plan to Read, Dropped
- Filter library by reading status

**History**
- Automatic reading history — every manga you open is tracked
- Dedicated History view in the sidebar
- Remove individual entries, or **clear all history** from Settings

**Downloads**
- Download individual chapters as CBZ
- Bulk download multiple chapters at once
- Chapter integrity check via MangaUpdates.com integration

**Reviews & Ratings**
- Rate manga 1–10 with optional text review

**Analytics & Achievements**
- Track chapters read, time spent, and daily streak
- Status distribution chart
- Unlockable achievements with in-app notifications

**Interface**
- Dark and Light mode
- English & Portuguese language support
- Toast notifications for all actions
- Responsive — works on mobile and desktop

---

## Quick Start

### Docker (recommended)

```bash
cd docker
docker compose up --build
```

Open: http://localhost:3000

> Data is persisted in `data/` on the host via a Docker volume — your library and imported files survive restarts and rebuilds.

### Local

```bash
npm install
npm start
```

Open: http://localhost:3000

---

## User Guide

### Searching for Manga

1. Select a source from the top bar (MangaDex or MangaPill)
2. Enter a title in the search bar and press Enter
3. Click any result to open the manga detail page
4. For advanced filters (genre, status, sort) use **Advanced Search** in the sidebar

### Switching Source on a Manga

On any manga detail page, click the **🌐 SourceName ▾** badge in the metadata row.  
A dropdown lists all other installed sources. Selecting one searches the manga title there and opens the first matching result — source context switches automatically.

### Managing Your Library

- Click **Add to Library** on any manga detail page
- Opening a library card automatically switches to the source it was saved from
- Use the **Reading Status** dropdown to track progress
- Go to **Library** in the sidebar — filter by status or scroll down for imported local files

### Importing Local Manga

1. Go to **Library** in the sidebar
2. Click **⬆ Import Local**
3. Drag and drop or select a `.cbz`, `.cbr`, or `.pdf` file
4. Optionally set a custom title
5. Click **Import** — the manga appears in the library immediately with a cover image

Imported files are stored in `data/local/` on the server and persist across restarts.  
PDF cover images are generated automatically from page 1 on import.

### Reading a Chapter

1. Open a manga and click any chapter
2. Navigate with arrow buttons or keyboard:
   - `→` / `d` — next page
   - `←` / `a` — previous page
   - `Escape` — close reader
   - `+` / `=` — zoom in
   - `-` — zoom out
3. Change reading mode (LTR/RTL/Webtoon) in **Settings** (⚙)
4. At the last page, a banner shows the next chapter with a direct button

### Chapter Context Menu

Right-click any chapter in the chapter list to:
- **Mark as Read** — marks the chapter with a visual indicator
- **Mark as Unread** — removes the read marker
- **Add/Remove Flag 🚩** — highlights the chapter with an orange border for custom tracking

### History

Go to **History** in the sidebar to see all manga you have opened. Each entry shows the cover, title, and when you last read it. Click **View** to open the details page or **[x]** to remove the entry.

To wipe all history: open **Settings** (⚙) → **Clear Reading History**.

### Language

Switch between **English** and **Português** in the top bar. The setting persists across sessions.

### Analytics

Go to **Analytics** in the sidebar to see chapters read, total reading time, daily streak, status distribution, and earned achievements.

---

## Settings

Access via the ⚙ button in the sidebar.

| Setting | Description |
|---|---|
| Language | English / Português |
| Reading Mode | LTR / RTL / Webtoon |
| Hide Read Chapters | Only show unread chapters |
| Skip Duplicate Chapters | Skip chapters with the same chapter number |
| Pan Wide Images | Horizontal scroll for double-page spreads |
| Auto-scroll Speed | 1–5 |
| Clear Reading History | Wipes all server-side history and all local progress |

---

## Project Structure

```
Manghu/
├── data/
│   ├── sources/
│   │   ├── mangadex.js         # MangaDex official API source
│   │   └── mangapill.js        # MangaPill HTML scraper source
│   ├── achievements.json       # Achievement definitions
│   ├── icon-mapping.json       # Source icon map
│   ├── store.json              # Runtime data — NOT committed (auto-created)
│   ├── store.json.example      # Template for store.json structure
│   ├── local/                  # Imported local manga (not committed)
│   ├── tmp/                    # Upload temp dir (not committed)
│   └── cache/                  # API response cache (not committed)
├── public/
│   ├── index.html              # App shell
│   ├── styles.css              # All styles (dark/light themes)
│   ├── app.js                  # Frontend logic
│   └── achievement-manager.js
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .gitignore
├── .dockerignore
├── server.js                   # Express API server
└── package.json
```

---

## API Reference

### Source Content

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/source/:id/search` | Search manga. Body: `{ query, page }` |
| `POST` | `/api/source/:id/mangaDetails` | Manga info. Body: `{ mangaId }` |
| `POST` | `/api/source/:id/chapters` | Chapter list. Body: `{ mangaId }` |
| `POST` | `/api/source/:id/pages` | Page images. Body: `{ chapterId }` |
| `POST` | `/api/source/:id/trending` | Trending manga |
| `POST` | `/api/source/:id/recentlyAdded` | Recently added manga |
| `POST` | `/api/source/:id/latestUpdates` | Latest updated manga |

> Use `local` as the source ID to access imported local manga via the same API.

### Image Proxy

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/proxy-image?url=…` | Proxy an image URL server-side. Optional `ref` param overrides the `Referer` header. |

### Local Manga

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/local/list` | List all imported local manga |
| `POST` | `/api/local/import` | Import a file. Multipart: `file` + optional `title` |
| `POST` | `/api/local/:mangaId/cover` | Upload a cover image (JPEG). Body: raw `image/jpeg` |
| `DELETE` | `/api/local/:mangaId` | Delete a local manga and its files |

### Library & History

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/library` | Returns `{ favorites, history }` |
| `POST` | `/api/favorites/toggle` | Add or remove from library |
| `POST` | `/api/history/add` | Add manga to history |
| `POST` | `/api/history/remove` | Remove a single entry from history |
| `DELETE` | `/api/history/clear` | Wipe all history |
| `GET` | `/api/user/status` | Get all reading statuses |
| `POST` | `/api/user/status` | Set status for a manga |

### Downloads

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/download/chapter` | Download a single chapter as CBZ |
| `POST` | `/api/download/bulk` | Bulk download chapters as CBZ |
| `POST` | `/api/mangaupdates/search` | Search MangaUpdates for chapter count data |

### Analytics & Achievements

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics` | Stats, distribution, sessions |
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
    // return { results: [{ id, title, cover, author, status, genres }], hasNextPage: bool }
  },
  async mangaDetails(mangaId) {
    // return { id, title, cover, author, description, genres, status }
  },
  async chapters(mangaId) {
    // return { chapters: [{ id, name, chapter, date }] }
  },
  async pages(chapterId) {
    // return { pages: [{ img: "url" }] }
  }
};
```

Restart the server — the source is auto-installed.

> If your source's CDN blocks requests without a `Referer` header, route image URLs through `/api/proxy-image?url=<encoded>&ref=<your-site>`.

---

## Data Storage

| Location | Committed | What is stored |
|---|---|---|
| `data/store.json` | ✗ | Library, history, reading status, reviews, analytics, achievements |
| `data/sources/` | ✓ | Manga source scripts |
| `data/local/` | ✗ | Extracted pages, covers and metadata for imported files |
| `data/cache/` | ✗ | API response cache |
| `localStorage` | — | Settings, read chapters, flagged chapters, reading progress |

`store.json` is created automatically on first run. See `data/store.json.example` for the expected structure.

---

## Troubleshooting

**Manga not loading**  
Check your internet connection. Both MangaDex and MangaPill require network access.

**Images not showing (MangaDex)**  
MangaDex may be temporarily unavailable. Check the browser console for errors.

**Images not showing (MangaPill)**  
MangaPill's CDN requires a valid `Referer` header. All images are proxied through `/api/proxy-image` automatically — if images still fail, the CDN selector may have changed; check `data/sources/mangapill.js`.

**PDF cover not generating**  
PDF cover generation runs entirely in the browser via PDF.js. Make sure JavaScript is enabled and the browser supports the Canvas API. Covers are re-generated automatically on next library load for any PDF that still shows the placeholder icon.

**Progress not saving**  
Make sure `localStorage` is enabled and not blocked.

**Local import fails**  
Ensure the file is a valid CBZ, CBR, or PDF. Files up to 500 MB are supported.

**Source not appearing in the selector**  
Drop the `.js` file in `data/sources/` and restart the container (`docker compose restart`). No rebuild needed.

---

## License

MIT — free to use and modify.
