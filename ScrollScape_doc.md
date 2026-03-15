---
tags:
  - project
  - documentation
  - manga-reader
  - self-hosted
created: 2026-03-09
status: active
version: "1.3.0"
---

# ScrollScape

> A self-hosted, privacy-first manga reader that aggregates multiple online sources, supports local file imports, tracks reading progress, and gamifies the experience with achievements and a theme shop — no account required.

---

## Table of Contents

- [[#Overview]]
- [[#Goals]]
- [[#Features]]
  - [[#Multi-Source Browsing]]
  - [[#Local File Import]]
  - [[#Library & Progress Tracking]]
  - [[#Bulk Downloads]]
  - [[#Achievements & Theme Shop]]
  - [[#Analytics]]
  - [[#Internationalization]]
  - [[#AniList Tracker]]
  - [[#Debug Panel]]
- [[#Technical Details]]
  - [[#Tech Stack]]
  - [[#Architecture]]
  - [[#API Routes]]
  - [[#Source Plugin System]]
  - [[#Data Model]]
  - [[#Security]]
  - [[#Deployment]]
- [[#Roadmap]]
- [[#Resources]]

---

## Overview

ScrollScape is a **self-hosted Node.js manga reader** that runs entirely on your own machine. It acts as a unified front-end for multiple manga providers (MangaDex, AllManga, MangaPill) while also supporting local archive reading (CBZ, CBR, PDF). A single `store.json` file persists all user data — no external database, no cloud account.

It is designed to run anywhere Node.js runs: Windows, Linux, macOS, and Android (via Termux). Pre-built standalone executables bundle the full Node.js 20 runtime, making installation a one-file affair.

```
Browser  ──►  Express Server (port 3000)  ──►  Source Plugins / Local Files
                      │
                 store.json  (favorites, history, analytics, achievements)
```

---

## Goals

| # | Goal | Success Metric |
|---|------|----------------|
| 1 | **One-stop manga hub** | Browse, read, download, and track across all sources from a single UI |
| 2 | **Zero-account privacy** | All data stored locally; no telemetry, no sign-up required |
| 3 | **Cross-platform** | Ships as Docker image, standalone exe (Win/Lin/Mac), and raw Node.js app |
| 4 | **Extensible sources** | Community members can write and share JS source plugins without forking the project |
| 5 | **Engaging UX** | Gamified achievements and an AP-based theme shop reward reading milestones |
| 6 | **Accessibility** | i18n support (English + Portuguese) with an extensible translation system |

---

## Features

### Multi-Source Browsing

ScrollScape ships with three built-in source plugins and a plugin loader that can install additional sources at runtime from community repositories.

| Source | Method | Notes |
|--------|--------|-------|
| **MangaDex** | Official REST API (`api.mangadex.org`) | Full metadata, cover art, ordering |
| **AllManga** | HTML scraper (Cheerio) | Tag filtering currently broken (see [[#Roadmap]]) |
| **MangaPill** | HTML scraper (Cheerio) | Stable |

Every source exposes a standard interface:

```js
exports.meta          // { id, name, version, author }
exports.search        // (query, page, orderBy) → { results, hasNextPage }
exports.mangaDetails  // (mangaId) → { id, title, cover, chapters }
exports.chapters      // (mangaId) → Chapter[]
exports.pages         // (chapterId) → { pages: string[] }
// Optional: trending(), recentlyAdded(), latestUpdates(), byGenres(), authorSearch()
```

The `/api/popular-all` endpoint aggregates `trending()` across all installed sources, interleaves, and deduplicates results with a 60-second cache.

---

### Local File Import

Users can import their own manga archives directly into ScrollScape:

- **Formats**: CBZ (ZIP), CBR (RAR), PDF
- **Upload limit**: 500 MB per file
- **Drag-and-drop** or file picker UI
- Files are stored in `data/local/<safeId>/` and served through the same reader interface as online manga
- PDF pages are rendered client-side via **PDF.js 3.11**

---

### Library & Progress Tracking

- **Favorites** — save any manga to a personal library with full metadata
- **Reading status** — per-manga status: `Reading`, `Completed`, `On Hold`, `Plan to Read`, `Dropped`
- **History** — automatically records every chapter read; capped at 100 entries; resumable via "Continue Reading"
- **Flagged chapters** — mark chapters for later
- **Custom Lists** — create named lists (e.g., "Isekai Backlog") and add/remove manga freely
- **Ratings** — star ratings per manga stored locally
- **MangaUpdates metadata** — optional lookup of additional metadata via the MangaUpdates API (`/api/mangaupdates/search`)

---

### Bulk Downloads

- Download a single chapter or an **entire series** as CBZ archives
- Bulk downloads run asynchronously with **Server-Sent Events (SSE)** streaming real-time progress to the browser
- Completed archives are available for 15 minutes before automatic cleanup
- Output: standard `.cbz` (ZIP) files compatible with any comic reader

---

### Achievements & Theme Shop

**Achievement System**

Achievements are defined in `data/achievements.json` and include the following rarities:

| Rarity | Color | Description |
|--------|-------|-------------|
| Common | Grey | Easy milestones (first read, first favorite) |
| Rare | Blue | Medium goals (100 chapters, 10 favorites) |
| Epic | Purple | Hard goals (500 chapters, 5 completed series) |
| Legendary | Gold | Extreme dedication |

Sample achievements: `first_read`, `reader_10`, `reader_100`, `reader_500`, `first_fav`, `fav_10`, `completed_1`, `completed_5`, `list_maker`, `night_owl`, `marathon`.

Each unlock awards **1 AP (Achievement Point)**. A hidden Shenlong easter egg grants **+50 AP**.

**Theme Shop**

AP can be spent to unlock community-designed color themes:

| Theme | Inspiration | Primary Color |
|-------|-------------|---------------|
| Default | — | Purple |
| Dragon Ball Z | Cosmos / Shenlong | Gold |
| Initial D | AE86 Trueno | Red |
| One Piece | Ocean / Pirate | Orange |
| Chainsaw Man | Dark / Gore | Dark Red |
| Gintama | — | Custom |
| Samurai X | Sakura / Kenshin | Sakura Red |

Themes are defined in `public/themes.js` as objects containing raw CSS, color variable overrides, and `onApply()` / `onRemove()` lifecycle hooks for DOM side-effects (background images, animated GIFs, etc.).

---

### Analytics

The `/api/analytics` endpoint aggregates reading statistics from stored sessions:

- Total time spent reading (minutes)
- Total chapters read
- Daily reading **streak**
- Last read date
- Reading status distribution (pie/bar data)
- Mean rating across all rated manga
- Genre-based **recommendations** drawn from the user's own library

Sessions are recorded via `/api/analytics/session` with a duration clamped to a maximum of 1,440 minutes (24 hours) to prevent garbage data.

---

### Internationalization

- Built-in languages: **English** and **Portuguese**
- DOM nodes use `data-i18n="key"` attributes; `applyTranslations()` rewrites them all at once on language switch
- Language preference persisted across sessions
- Adding a new language requires only extending the `translations` object in `public/modules/i18n.js`

---

### AniList Tracker

ScrollScape can sync reading progress, scores, and status to [AniList](https://anilist.co) via OAuth 2 and the AniList GraphQL API.

**Setup**
1. Create an API client at `https://anilist.co/settings/developer` with `http://localhost:3000` as the redirect URI.
2. Open **Settings → Tracking** and enter your OAuth Client ID.
3. Click **Connect** — the page redirects to AniList for authorisation and returns an access token stored in `localStorage`.

**Behaviour**
- On any manga detail page, click **Tracker** to search AniList and link the entry.
- Chapter progress, score, and status are synced automatically each time a chapter is loaded.
- All AniList code lives in `public/modules/anilist.js`; it is loaded before `app.js` and exposes globals (`anilistGQL`, `showTrackerModal`, `anilistSyncProgress`, etc.).
- The server relays GraphQL requests through `POST /api/anilist` so the browser never sends the OAuth token cross-origin directly.

---

### Debug Panel

A structured, in-app error-logging system available on every page.

**Toggle**: `Ctrl+Shift+D` — opens/closes the floating panel.
**Persistent mode**: `localStorage.setItem('scrollscape_debug', '1')` adds a permanent **DBG** button in the bottom-right corner.

All client-side errors use the `dbg` global (defined in `public/modules/debug.js`, loaded first):

```js
dbg.error(dbg.ERR_API,      'Request failed', err)
dbg.warn (dbg.ERR_ANILIST,  'Token expired')
dbg.info (dbg.ERR_SETTINGS, 'Settings loaded', { count: 5 })
dbg.getLog()   // returns copy of the full log array
dbg.enable()   // activates persistent DBG button
dbg.disable()  // removes it
```

| Error Code | Area |
|------------|------|
| `SETTINGS` | Settings load/save |
| `STATE` | Global state persistence |
| `SOURCE` | Source plugin calls |
| `API` | `/api/*` fetch failures |
| `ANILIST` | AniList OAuth / GraphQL |
| `PDF` | PDF.js render pipeline |
| `DOWNLOAD` | Chapter / bulk downloads |
| `COVER` | Cover image generation |
| `ANALYTICS` | Analytics session recording |
| `ACHIEVEMENTS` | Achievement unlock/check |
| `MANGAUPDATES` | MangaUpdates metadata lookup |
| `GLOBAL` | Uncaught errors / unhandled rejections |

The panel displays timestamp, level badge, error code, message, and expandable JSON for extra data. Entries can be copied as JSON or cleared.

---

## Technical Details

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| HTTP Framework | Express 4 |
| Module System | CommonJS |
| Frontend | Vanilla ES5/ES6 (no bundler) |
| PDF rendering | PDF.js 3.11 (CDN) |
| Icons | Feather Icons (CDN) |
| Fonts | Google Fonts — Orbitron (CDN) |
| Archive read | `adm-zip` (CBZ), `node-unrar-js` (CBR) |
| HTML scraping | `cheerio` |
| File uploads | `multer` |
| Compression | `compression` (gzip middleware) |
| Binary packaging | `@yao-pkg/pkg` → standalone exe |
| Containerization | Docker + Docker Compose |

---

### Architecture

```
server.js                     ← entry point; mounts all routes
│
├─ server/middleware/
│   └─ security.js            ← security headers + rate limiter (600 req/10 min/IP)
│
├─ server/helpers.js          ← safeId(), safeManga(), isSafeUrl(), fetchImageBuffer()
├─ server/store.js            ← in-memory store + debounced write to data/store.json
├─ server/sourceLoader.js     ← plugin require() cache with path-confinement
│
├─ server/routes/
│   ├─ proxy.js               ← /api/proxy-image (SSRF-guarded)
│   ├─ repos.js               ← /api/repos, /api/state
│   ├─ sources.js             ← /api/sources/*, /api/source/:id/:method, /api/popular-all
│   ├─ local.js               ← /api/local/* (CBZ/CBR/PDF import & serving)
│   ├─ library.js             ← /api/library, /api/history, /api/favorites, /api/user/status
│   ├─ downloads.js           ← /api/download/* (single chapter + bulk SSE)
│   ├─ reviews.js             ← /api/ratings
│   ├─ lists.js               ← /api/lists
│   ├─ analytics.js           ← /api/analytics, /api/analytics/session
│   ├─ achievements.js        ← /api/achievements/*
│   └─ mangaupdates.js        ← /api/mangaupdates/search
│
└─ public/
    ├─ index.html             ← single-page app shell (all views are <section> blocks)
    ├─ app.js                 ← main UI: reader, shop, library, settings, achievements
    ├─ styles.css             ← all CSS; CSS custom properties for theming
    ├─ themes.js              ← COMMUNITY_THEMES array
    ├─ customSelect.js        ← custom dropdown component
    ├─ achievement-manager.js ← AchievementManager class
    └─ modules/
        ├─ debug.js           ← dbg global; structured error log + in-app panel (loads first)
        ├─ api.js             ← api() fetch wrapper
        ├─ i18n.js            ← t(), setLanguage(), applyTranslations()
        ├─ state.js           ← global state singleton
        ├─ navigation.js      ← NavigationManager, view switching
        ├─ utils.js           ← escapeHtml(), formatTime(), initTheme(), showToast()
        └─ anilist.js         ← AniList OAuth, GraphQL helpers, tracker modal
```

**Data flow**: `app.js` calls `api()` → `/api/*` → `store.js` reads/writes `data/store.json`. Source plugin calls go through `sourceLoader.js` with a 30-second timeout.

---

### API Routes

All routes are under `/api/` and rate-limited to **600 requests / 10 minutes / IP**.

#### State & Sources

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/state` | Full store state snapshot |
| `GET/POST/DELETE` | `/api/repos` | Manage community source repositories |
| `POST` | `/api/sources/install` | Download and install a JS source plugin |
| `POST` | `/api/sources/uninstall` | Remove an installed source |
| `POST` | `/api/source/:id/:method` | Dispatch to source plugin (whitelist-enforced, 30s timeout) |
| `GET` | `/api/popular-all` | Aggregated trending across all sources (60s TTL cache) |

#### Proxy

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/proxy-image` | Proxy external image URL server-side (SSRF-guarded) |
| `POST` | `/api/anilist` | AniList GraphQL relay (server forwards request with stored token) |

#### Library & History

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/library` | Favorites + history |
| `POST` | `/api/library/add` | Add or update manga in favorites |
| `POST` | `/api/library/remove` | Remove from favorites |
| `POST` | `/api/favorites/toggle` | Toggle favorite |
| `POST` | `/api/history/add` | Prepend chapter (capped at 100) |
| `POST` | `/api/history/remove` | Remove history entry |
| `DELETE` | `/api/history/clear` | Clear all history |
| `GET/POST` | `/api/user/status` | Get or set per-manga reading status |

#### Downloads

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/download/chapter` | Single chapter → CBZ |
| `POST` | `/api/download/bulk/start` | Start bulk download → `{ jobId }` |
| `GET` | `/api/download/bulk/progress/:id` | **SSE stream** — real-time progress |
| `GET` | `/api/download/bulk/file/:id` | Retrieve completed CBZ (auto-deleted after 15 min) |

#### Local Files

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/local/import` | Import CBZ/CBR/PDF (multer, 500 MB limit) |
| `GET` | `/api/local/list` | List all locally imported manga |

#### Social & Lists

| Method | Route | Description |
|--------|-------|-------------|
| `GET/POST` | `/api/ratings` | Per-manga user ratings |
| `POST` | `/api/ratings/clear` | Remove a manga's rating (JSON body: `{ mangaId }`) |
| `GET/POST` | `/api/lists` | Get or create custom lists |
| `POST/DELETE` | `/api/lists/:id/items` | Add/remove items from a list |

#### Analytics & Achievements

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/analytics` | Reading stats, status distribution, mean score |
| `POST` | `/api/analytics/session` | Record a reading session (duration clamped 0–1440 min) |
| `GET` | `/api/achievements` | Unlocked achievement IDs |
| `GET` | `/api/achievements/definitions` | Full achievement definitions |
| `POST` | `/api/achievements/unlock` | Unlock an achievement (idempotent) |

#### Metadata

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/mangaupdates/search` | MangaUpdates metadata lookup |

---

### Source Plugin System

Plugins are plain Node.js `.js` files placed in `data/sources/`. The loader:

1. **Path-confines** all `require()` paths — rejects `..` and absolute prefixes to prevent traversal
2. **Caches** modules in memory after first load
3. **Whitelists** callable method names: `search`, `mangaDetails`, `chapters`, `pages`, `trending`, `recentlyAdded`, `latestUpdates`, `byGenres`, `authorSearch`
4. **Times out** every plugin call after **30 seconds**
5. **Seeds** the built-in sources next to the exe on first launch so users can customize them

On first launch of the packaged exe, the bundled source files from the snapshot are copied to the writable `data/sources/` directory beside the binary.

---

### Data Model

`data/store.json` is the single source of truth:

```json
{
  "favorites":        [],      // Saved manga with full metadata
  "history":          [],      // Last 100 read chapters
  "readingStatus":    {},      // "mangaId:sourceId" → { status, updatedAt, manga }
  "installedSources": {},      // id → { name, version, author, icon, installedAt }
  "repos":            [],      // Community repository URLs
  "achievements":     [],      // Unlocked achievement ID strings
  "analytics": {
    "totalTimeSpent":    0,    // minutes
    "totalChaptersRead": 0,
    "streak":            0,
    "lastReadDate":      null,
    "readingSessions":   []
  },
  "reviews":          {},      // mangaId → Review[]
  "customLists":      [],      // [{ id, name, items[] }]
  "ratings":          {}       // mangaId → number (star rating)
}
```

**Sanitization**: All incoming manga payloads pass through `safeManga()` which whitelists known scalar/array fields. Status keys are validated against a regex. String fields are length-capped. Body size is limited to 5 MB.

AP (Achievement Points) are stored in `localStorage` on the client (`scrollscape_ap_spent`, `scrollscape_ap_bonus`) — not in `store.json`.

---

### Security

| Threat | Defense |
|--------|---------|
| SSRF | `isSafeUrl()` blocks loopback, RFC-1918, and link-local addresses on all URL inputs |
| Path traversal | Source plugin paths reject `..` and absolute prefixes |
| Prototype pollution | `safeManga()` whitelists known fields only |
| Oversized inputs | 5 MB body limit; string fields length-capped; history capped at 100 |
| Hung scrapers | 30-second `Promise.race` timeout on all source calls |
| Rate abuse | Sliding-window limiter (in-process, zero deps): 600 req / 10 min / IP |
| Clickjacking | `X-Frame-Options: DENY` header |
| XSS | `Content-Security-Policy` header + `escapeHtml()` on all rendered user content |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer leakage | `Referrer-Policy: no-referrer` |

---

### Deployment

#### Docker (Recommended)

```bash
# From the project root
cd docker
docker compose up -d --build
# Open http://localhost:3000
```

The `docker-compose.yml` mounts `../data` and `../public` for persistence and live file editing. The container restarts automatically unless explicitly stopped.

#### Windows Launcher

Double-click `ScrollScape.bat`. It will:
1. Check for Docker Desktop (errors with instructions if missing)
2. Start Docker Desktop daemon if not running
3. Run `docker compose up -d --build`
4. Open `http://localhost:3000` in the default browser

#### Linux / macOS

```bash
bash scrollscape.sh
```

#### Standalone Executable

```bash
npm run build:win    # → dist/ScrollScape-win.exe
npm run build:linux  # → dist/ScrollScape-linux
npm run build:mac    # → dist/ScrollScape-mac
```

Bundles the full Node.js 20 runtime. User data (`store.json`, sources, cache) lives **next to** the exe, not inside the snapshot, so it persists across updates.

#### Raw Node.js

```bash
npm install
node server.js          # development
PORT=8080 node server.js  # custom port
```

Set `NODE_ENV=production` to enable 7-day cache headers for static assets.

---

## Roadmap

Items tracked in `Todo.txt`:

| Status | Item | Notes |
|--------|------|-------|
| 🔲 Planned | **Berserk theme** | New AP-purchasable community theme |
| 🔲 Planned | **Coins update with theme** | AP/coin display should visually change when a theme is applied |
| 🔲 Planned | **Per-theme image selection** | Users can pick custom artwork within each theme |
| 🐛 Bug | **AllManga tag filtering broken** | Tags on `allmanga.to` source do not filter correctly |
| 🐛 Bug | **MangaDex 503 errors** | Intermittent 503s from MangaDex API (rate limiting / downtime handling) |

---

## Resources

| Resource | Link / Path |
|----------|-------------|
| Main server entry | [server.js](../server.js) |
| Frontend app | [public/app.js](../public/app.js) |
| AniList module | [public/modules/anilist.js](../public/modules/anilist.js) |
| Debug module | [public/modules/debug.js](../public/modules/debug.js) |
| Styles | [public/styles.css](../public/styles.css) |
| Community themes | [public/themes.js](../public/themes.js) |
| i18n strings | [public/modules/i18n.js](../public/modules/i18n.js) |
| Achievement definitions | [data/achievements.json](../data/achievements.json) |
| User data store | [data/store.json](../data/store.json) |
| MangaDex source plugin | [data/sources/mangadex.js](../data/sources/mangadex.js) |
| AllManga source plugin | [data/sources/allmanga.js](../data/sources/allmanga.js) |
| MangaPill source plugin | [data/sources/mangapill.js](../data/sources/mangapill.js) |
| Docker config | [docker/docker-compose.yml](../docker/docker-compose.yml) |
| Windows launcher | [ScrollScape.bat](../ScrollScape.bat) |
| Linux launcher | [scrollscape.sh](../scrollscape.sh) |
| Security middleware | [server/middleware/security.js](../server/middleware/security.js) |
| Store module | [server/store.js](../server/store.js) |
| Source loader | [server/sourceLoader.js](../server/sourceLoader.js) |
| MangaDex API | https://api.mangadex.org/docs |
| MangaUpdates API | https://api.mangaupdates.com |
| PDF.js | https://mozilla.github.io/pdf.js/ |
| Feather Icons | https://feathericons.com |
