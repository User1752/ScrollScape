# ScrollScape

> Self-hosted manga reader — multiple online sources, local file support, AniList tracking, reading progress, library management, and more. Runs via Docker or as a standalone executable. No account required.

![Node.js](https://img.shields.io/badge/Node.js-20-brightgreen?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)
![Express](https://img.shields.io/badge/Express-4.19-black?logo=express)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Version](https://img.shields.io/badge/version-1.4.0-purple)

---

## Features

| | |
|---|---|
| **Multiple sources** | MangaDex, AllManga, MangaKatana, MangaPill — add your own in `data/sources/` |
| **Local files** | Import CBZ, CBR and PDF files through the same reader |
| **Reading progress** | Per-chapter markers, continue-reading, full history |
| **Library & lists** | Favourites, custom lists, reading status (Reading / Completed / On-hold) |
| **Library migration** | Migrate manga between sources while preserving custom lists and reading status |
| **AniList Tracker** | OAuth login, search & link manga, sync chapter progress / score / status / dates automatically |
| **Release calendar** | Monthly calendar with confirmed releases and predicted chapter dates; confidence indicators (high/medium/low); chapter-offset correction for licensed manga |
| **Achievements** | Unlock achievements and spend AP on community themes |
| **Analytics** | Daily streaks, time spent, chapter counts, genre overview with % bars (most/least read) |
| **Recommendations** | Genre-based suggestions from your library |
| **Bulk download** | Download entire series as CBZ archives |
| **Animated wallpaper** | Reader background: generated film-grain (canvas) or your own GIF/WebP files |
| **Immersive reader** | Scrollbars hidden during reading; auto-advance to next chapter; chapter prefetch; corner tap zones for chapter navigation |
| **Custom themes** | Dark / light mode + community themes (Initial D, Dragon Ball Z, One Piece…) + save your own presets |
| **i18n** | English & Portuguese; add more in `public/modules/i18n.js` |
| **Debug panel** | `Ctrl+Shift+D` — in-app error log with categorised codes, copy-as-JSON, persistent mode |

---

## Quick Start

### Windows — Docker (recommended)
```bat
ScrollScape.bat
```
Double-click the bat file. It will start Docker Desktop if needed, build the container, and open `http://localhost:3000` automatically.

### Linux / macOS — Docker
```bash
chmod +x scrollscape.sh
./scrollscape.sh
```

### Any platform — Node.js
```bash
npm install
node server.js
# Open http://localhost:3000
```

### Android (Termux)
```bash
pkg update && pkg install nodejs git
git clone <repo> ScrollScape && cd ScrollScape
npm install && node server.js
# Open http://localhost:3000 in your mobile browser
```

---

## Project Structure

```
server.js                     Entry point
server/
  helpers.js                  Shared utilities (SSRF guard, sanitisers, fetch helpers)
  store.js                    In-memory store with debounced JSON persistence
  sourceLoader.js             Plugin loading, path-confinement, caching
  middleware/security.js      Security headers + rate limiter
  routes/
    proxy.js                  Image proxy + AniList GraphQL relay
    repos.js                  Repository management
    sources.js                Source install/uninstall + generic dispatcher
    local.js                  Local manga (CBZ/CBR/PDF) import & reader
    library.js                Favourites, history, reading status, library migration
    downloads.js              CBZ chapter / bulk downloads
    reviews.js                Per-manga ratings and reviews
    lists.js                  Custom manga lists
    analytics.js              Reading analytics aggregation
    achievements.js           Achievement unlock / query
    mangaupdates.js           MangaUpdates metadata lookup
    calendar.js               Release calendar with interval prediction
    theme-presets.js          Custom theme preset persistence
public/
  modules/
    debug.js                  Structured error logging + in-app debug panel
    api.js                    fetch() wrapper with error propagation
    i18n.js                   Translations and t() helper
    state.js                  Global runtime state object
    navigation.js             NavigationManager + AchievementManager
    utils.js                  $(), escapeHtml(), showToast(), theme helpers
    anilist.js                AniList OAuth, GraphQL, tracker modal
    ui-reader-noise.js        Animated reader wallpaper (canvas grain + GIF/WebP)
    ui-reader-page-rendering.js  Reader show/hide, page rendering, chapter navigation
    ui-autoscroll-1.js        Webtoon autoscroll, auto-next chapter, chapter prefetch
    ui-analytics-view.js      Analytics dashboard rendering
    ui-migrate.js             Library migration modal UI
    ui-settings-modal.js      Settings UI (Reading Mode + Reader Appearance cards)
  app.js                      Main UI logic
  index.html                  Single-page HTML shell
  styles.css                  All application styles
data/
  store.json                  User data (auto-created, git-ignored)
  achievements.json           Achievement definitions
  sources/                    Source plugin files
docker/
  Dockerfile
  docker-compose.yml
```

---

## Animated Wallpaper

During reading, open **Settings → Reader Appearance** and enable **Animated Wallpaper**.

| Option | Description |
|--------|-------------|
| **Generated (film grain)** | Canvas-rendered TV-static noise at 24 fps |
| **GIF / WebP file** | Drop a `.gif` or `.webp` into the `public/` folder; it appears in the file picker automatically |

The reader background becomes transparent when the wallpaper is active so pages float over it. Intensity is stored as opacity (0–100 %) and is configurable in the source settings.

---

## Adding a Source

Drop a `.js` file into `data/sources/` — it is picked up automatically on the next start.

```js
exports.meta = {
  id: 'my-source',
  name: 'My Source',
  baseUrl: 'https://example.com',
  lang: 'en'
};

exports.search       = async ({ query, page = 1 })    => ({ results: [], hasNextPage: false });
exports.mangaDetails = async ({ mangaId })            => ({ id, title, cover, chapters: [] });
exports.chapters     = async ({ mangaId })            => ([ /* Chapter[] */ ]);
exports.pages        = async ({ mangaId, chapterId }) => ({ pages: [ /* url strings */ ] });
```

All four exports are required. Source calls have a **30 s hard timeout**. Manga with zero chapters across all sources are automatically hidden from search results.

---

## AniList Tracker

1. Open **Settings → Tracking** and enter your AniList OAuth Client ID.
2. Click **Connect** — you'll be redirected to AniList for authorisation.
3. On any manga detail page, click **Tracker** to search AniList and link the entry.
4. Chapter progress, score, and status sync automatically as you read.

To set up an OAuth client: create an API client at `https://anilist.co/settings/developer` with `http://localhost:3000` as the redirect URI.

---

## Debug Panel

Press **Ctrl+Shift+D** at any time to open the debug panel.

| Level | Colour | Codes |
|-------|--------|-------|
| ERROR | red    | `API` `SOURCE` `STATE` `PDF` `ANILIST` `ANALYTICS` `ACHIEVEMENTS` `GLOBAL` |
| WARN  | amber  | `SETTINGS` `COVER` `ANILIST` `MANGAUPDATES` `SOURCE` |
| INFO  | blue   | any   |

To keep the panel permanently visible across page reloads:
```js
// In the browser console:
dbg.enable()           // activates persistent DBG toggle button
dbg.disable()          // removes it
dbg.getLog()           // returns the full log array
```

---

## API Overview

All endpoints are prefixed `/api/`. Rate limit: **600 requests / 10 minutes** per IP.

| Area | Key endpoints |
|------|--------------|
| State | `GET /api/state` |
| Sources | `POST /api/sources/install` · `POST /api/source/:id/:method` · `GET /api/popular-all` |
| Repos | `POST /api/repos` · `DELETE /api/repos` |
| Library | `GET /api/library` · `POST /api/favorites/toggle` · `POST /api/history` · `POST /api/library/migrate` |
| Status & ratings | `GET/POST /api/user/status` · `GET/POST /api/reviews` · `POST /api/ratings/clear` |
| Downloads | `POST /api/download/chapter` · `POST /api/download/bulk` |
| Local files | `POST /api/local/import` · `GET /api/local/list` |
| Lists | `GET/POST /api/lists` · `POST/DELETE /api/lists/:id/items` |
| Analytics | `GET /api/analytics` · `POST /api/analytics/session` |
| Achievements | `GET /api/achievements` · `POST /api/achievements/unlock` |
| Calendar | `GET /api/calendar?year=&month=` |
| Theme presets | `GET/PUT /api/theme-presets` |
| Reader wallpapers | `GET /api/reader-wallpapers` |
| Utilities | `GET /api/proxy-image` · `POST /api/mangaupdates/search` · `POST /api/anilist` |

---

## Security

| Concern | Mitigation |
|---------|-----------|
| SSRF | `isSafeUrl()` blocks loopback, RFC-1918, link-local (169.254/16 — AWS IMDS), and IPv6 equivalents on all URL inputs |
| Path traversal | `sourcePath()` rejects `..` and absolute prefixes |
| Prototype pollution | `safeManga()` whitelists known keys; status/review keys sanitised |
| Rate limiting | Sliding-window limiter — 600 req / 10 min / IP, returns 429 + Retry-After |
| Hung scrapers | 30 s timeout on all source calls; 10 s on fetch helpers |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, CSP, `Referrer-Policy` |
| Content-type confusion | Proxy allowlists response `Content-Type` to known image MIME types only |

---

## Build — Standalone Executable

**Requires:** Node.js 20 + `npm install`

```bash
npm run build:win    # dist/ScrollScape-win.exe
npm run build:linux  # dist/ScrollScape-linux
npm run build:mac    # dist/ScrollScape-mac
npm run build:all    # all three
```

The executable bundles the full Node.js runtime — no Node.js needed on the target machine. On first launch it seeds `data/sources/` from the bundle so sources can be customised without rebuilding.

---

## Docker

```yaml
# docker/docker-compose.yml
services:
  scrollscape:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ../data:/app/data      # persists across rebuilds
      - ../public:/app/public  # live CSS/JS edits (no rebuild needed)
    restart: unless-stopped
```

```bash
# Apply server-side code changes
cd docker && docker compose up -d --build
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |

---

