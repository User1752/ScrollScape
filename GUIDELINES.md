# ScrollScape — Code and Organization Guidelines

This document defines the code organization, implementation, and maintenance rules for **ScrollScape**.

The goal is to keep the project organized, predictable, secure, easy to modify, and ready to grow without becoming difficult to maintain.

These guidelines must be followed across the whole project.

---

## 1. Core Principles

ScrollScape code should be:

- organized;
- modular;
- readable;
- predictable;
- easy to change;
- easy to test;
- secure by default;
- free from unnecessary hardcoded values;
- separated by responsibility;
- consistent with the existing architecture.

When choosing between a simple solution and an unnecessarily complex solution, prefer the simple one, as long as it remains safe and maintainable.

---

## 2. General Project Structure

The main structure should remain clear:

```txt
server.js
server/
public/
data/
docker/
tools/
brain/
```

### Responsibility of each area

```txt
server.js
```

Should act only as the application entry point and thin orchestrator.

It may contain:

- initial configuration;
- global path constants;
- module configuration;
- Express application setup;
- global middleware registration;
- route registration;
- server startup.

It should not contain heavy business logic.

---

```txt
server/
```

Contains the backend logic of the application.

Recommended structure:

```txt
server/
  helpers.js
  store.js
  sourceLoader.js
  middleware/
  modules/
  routes/
```

---

```txt
server/modules/
```

Contains reusable domain logic.

Examples:

```txt
server/modules/store/
server/modules/source-loader/
server/modules/network/
server/modules/common/
server/modules/local/
server/modules/calendar/
server/modules/downloads/
```

Rule:

> If the logic is reusable, complex, or domain-specific, it should live in `server/modules/`.

---

```txt
server/routes/
```

Contains only the HTTP layer.

Routes should:

- validate input;
- call services/modules;
- return HTTP responses;
- handle errors clearly.

Routes should not contain extensive business logic.

---

```txt
public/
```

Contains the frontend of the application.

Recommended structure:

```txt
public/
  index.html
  styles.css
  app.js
  modules/
```

The `public/modules/` folder should contain frontend modules separated by responsibility, such as API, state, navigation, reader, settings, analytics, i18n, and debug.

---

```txt
data/
```

Contains local and persistent user data.

Examples:

```txt
data/store.json
data/sources/
data/cache/
data/local/
data/tmp/
data/theme-presets/
```

Never assume these files or folders already exist. The application should create required directories and files during startup.

---

## 3. Keep `server.js` Small

`server.js` should remain a thin orchestrator.

Allowed in `server.js`:

- global path constants;
- module configuration;
- Express setup;
- global middleware;
- very simple global routes;
- server startup;
- initial directory creation.

Avoid in `server.js`:

- library logic;
- download logic;
- source logic;
- analytics logic;
- achievements logic;
- scraping;
- complex data manipulation;
- domain-specific validation;
- long functions that belong in modules.

If a function in `server.js` starts growing, move it to:

```txt
server/modules/
```

or:

```txt
server/routes/
```

depending on its responsibility.

---

## 4. Separate Routes, Services, and Helpers

Use this rule:

```txt
routes/   -> HTTP, req, res, status codes
modules/  -> business/domain logic
helpers/  -> generic reusable utilities
config/   -> configurable values
```

Example:

```txt
server/routes/downloads.js
```

should call:

```txt
server/modules/downloads/service.js
```

and should not contain the full CBZ generation logic directly inside the route.

---

## 5. Avoid Hardcoded Values

Avoid fixed values scattered throughout the code.

Do not hardcode:

- URLs;
- paths;
- ports;
- filenames;
- upload limits;
- timeouts;
- UI text;
- error messages;
- colors;
- sizes;
- allowed extensions;
- rate limits;
- directory names;
- storage keys;
- event names;
- configuration values.

### Avoid

```js
const upload = multer({ dest: "data/tmp", limits: { fileSize: 500 * 1024 * 1024 } });
```

### Prefer

```js
const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: limits.maxUploadSizeBytes }
});
```

### Create configuration files when needed

Suggested structure:

```txt
server/config/
  paths.js
  limits.js
  cache.js
  security.js
  defaults.js
```

Example:

```js
// server/config/limits.js
'use strict';

module.exports = {
  jsonBodyLimit: '5mb',
  maxUploadSizeBytes: 500 * 1024 * 1024,
  apiRateLimitWindowMs: 600_000,
  apiRateLimitMaxRequests: 6000,
  fetchTimeoutMs: 10_000,
  sourceCallTimeoutMs: 30_000,
  repoCacheTtlMs: 3_600_000
};
```

---

## 6. Paths and Directories

All important paths should be centralized.

Examples of global path constants:

```txt
DATA_DIR
SOURCES_DIR
SNAP_SOURCES_DIR
STORE_PATH
CACHE_DIR
LOCAL_DIR
TMP_DIR
THEME_PRESETS_DIR
```

Rule:

> Never build sensitive paths directly inside routes or services when the path can come from configuration.

Always use:

```js
path.join(...)
```

Avoid manual concatenation:

```js
const filePath = DATA_DIR + "/store.json";
```

Prefer:

```js
const filePath = path.join(DATA_DIR, 'store.json');
```

---

## 7. Configurable Modules

Modules that depend on paths or external options should expose a `configure()` function.

Keep this pattern for modules such as:

```txt
store.js
sourceLoader.js
local routes
theme preset routes
```

Recommended pattern:

```js
function configure(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid options provided.');
  }

  service.configure(options);
}
```

Rules:

- validate received options;
- fail early if required configuration is missing;
- do not access files before `configure()` has been called;
- do not hide global paths inside modules.

---

## 8. Helpers

`helpers.js` should remain a thin export layer for shared utilities.

It may centralize functions such as:

```txt
safeId
safeManga
sha1Short
isSafeUrl
fetchJson
fetchText
fetchImageBuffer
resolvePageUrl
safeName
```

Rules:

- helpers should be generic;
- helpers should not depend on routes;
- helpers should not contain feature-specific business logic;
- helpers should not mutate global state;
- helpers should be easy to test in isolation.

If a helper becomes tied to a specific feature, move it to:

```txt
server/modules/<domain>/
```

---

## 9. Store and Persistence

Persistence should remain centralized in:

```txt
server/store.js
server/modules/store/
```

Rules:

- never write directly to `data/store.json` outside the store module;
- always use `readStore()` and `writeStore()`;
- normalize the store after reading data;
- handle invalid JSON safely;
- ensure safe writes;
- avoid data corruption during power loss or process interruption;
- keep defaults centralized;
- do not spread the internal store schema across unrelated files.

Avoid:

```js
fs.writeFileSync('data/store.json', JSON.stringify(store));
```

Use:

```js
const store = await readStore();
store.history.push(entry);
await writeStore(store);
```

---

## 10. Source Loader and External Sources

Source loading should remain isolated in:

```txt
sourceLoader.js
server/modules/source-loader/
```

Mandatory rules for sources:

- always validate `id` with `safeId`;
- confine paths before accessing the filesystem;
- validate the exported source interface;
- clear cache when a source is updated or removed;
- never trust external code without validation;
- apply timeouts to source calls;
- keep safe fallback behavior when a repository fails;
- do not let a broken source crash the whole application.

Each source must export:

```js
exports.meta = {
  id: 'source-id',
  name: 'Source Name',
  baseUrl: 'https://example.com',
  lang: 'en'
};

exports.search = async ({ query, page = 1 }) => {};
exports.mangaDetails = async ({ mangaId }) => {};
exports.chapters = async ({ mangaId }) => {};
exports.pages = async ({ mangaId, chapterId }) => {};
```

---

## 11. Security

Security must be treated as part of the architecture, not as a later patch.

Mandatory rules:

- validate all IDs;
- sanitize objects received from the client;
- block private, loopback, and link-local URLs;
- prevent path traversal;
- do not trust data from external sources;
- do not expose internal paths in client-facing errors;
- do not store tokens in code;
- do not log sensitive data;
- validate content types in proxies;
- use rate limiting on API endpoints;
- apply timeouts to network calls.

Never use user input directly in:

```js
require(...)
fs.readFile(...)
fs.writeFile(...)
path.join(...)
fetch(...)
```

without prior validation.

---

## 12. Network, Fetch, and Timeouts

All external requests should go through shared utilities.

Use:

```txt
fetchJson()
fetchText()
fetchImageBuffer()
resolvePageUrl()
```

Avoid direct `fetch()` calls scattered across the project.

Rules:

- every request must have a timeout;
- validate URLs before requesting them;
- handle network errors;
- return useful errors;
- do not block the process;
- avoid infinite retries;
- use cache when appropriate.

---

## 13. Logging and Debugging

Avoid loose `console.log` statements in production code.

Rules:

- remove temporary logs before finishing a task;
- permanent logs must include clear context;
- errors should identify where the failure happened;
- do not log tokens, passwords, or sensitive data;
- use consistent categories;
- in the frontend, prefer the existing debug system;
- in the backend, create or use a centralized logger as the project grows.

Acceptable:

```js
logger.error('Failed to load source module', {
  sourceId,
  error: error.message
});
```

Avoid:

```js
console.log(error);
console.log(data);
console.log('test');
```

---

## 14. Comments

Comments should explain why a decision exists.

Acceptable:

```js
// Static files are registered last to avoid shadowing API routes.
```

Avoid:

```js
// Create app
const app = express();
```

Rules:

- comment important decisions;
- comment security rules;
- comment special cases;
- do not comment the obvious;
- update comments when the code changes;
- remove outdated or misleading comments.

---

## 15. Naming Conventions

### JavaScript

Use `camelCase` for variables and functions:

```js
const activeSourceId = safeId(sourceId);
```

Use `PascalCase` for classes:

```js
class StorageService {}
```

Use `UPPER_SNAKE_CASE` for true global constants:

```js
const DATA_DIR = path.join(USER_ROOT, 'data');
```

### Files and folders

Use `kebab-case`:

```txt
source-loader/
theme-presets/
popular-all.js
ui-reader-page-rendering.js
```

Avoid vague names:

```txt
stuff.js
things.js
misc.js
test2.js
new-file.js
```

---

## 16. Code Style

Keep the current CommonJS style unless a future migration is intentionally planned.

Use:

```js
'use strict';

const path = require('path');

module.exports = {
  functionName,
};
```

Avoid mixing CommonJS and ES Modules in the same area unless there is a clear reason.

Rules:

- keep imports at the top;
- group imports by type;
- avoid mutable global state;
- prefer `const`;
- use `let` only when reassignment is needed;
- avoid huge functions;
- avoid deeply nested callbacks;
- prefer `async/await` when possible;
- handle errors clearly.

---

## 17. HTTP Routes

Routes should be small and predictable.

Each route should follow this sequence:

```txt
1. Read input
2. Validate input
3. Call service/module
4. Return response
5. Handle errors
```

Recommended structure:

```js
router.post('/example', async (req, res) => {
  try {
    const input = validateExampleInput(req.body);
    const result = await exampleService.run(input);

    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});
```

Avoid:

- extensive business logic inside routes;
- multiple responsibilities in the same route;
- inconsistent response shapes;
- errors without appropriate status codes;
- partial validation.

---

## 18. Frontend

The frontend in `public/` should remain separated by modules.

Rules:

- `app.js` should not concentrate all UI logic;
- UI modules should live in `public/modules/`;
- HTTP calls should go through the API wrapper;
- visible text should go through `i18n.js`;
- global state should remain centralized;
- utility functions should go in `utils.js`;
- reader-specific logic should stay in `ui-reader-*` modules;
- analytics logic should stay in its own module;
- settings logic should stay in its own module.

Avoid hardcoded frontend values:

- text;
- colors;
- sizes;
- URLs;
- repeated selectors;
- storage names;
- error messages.

---

## 19. CSS, Themes, and Variables

Avoid isolated styles and hardcoded values.

Rules:

- use CSS variables for colors;
- use CSS variables for spacing;
- use CSS variables for shadows;
- use CSS variables for fonts;
- respect dark and light modes;
- respect community themes;
- do not place fixed colors inside components;
- keep styles reusable;
- avoid duplicated CSS blocks.

Recommended:

```css
.card {
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}
```

Avoid:

```css
.card {
  background: #ffffff;
  color: #222222;
  padding: 16px;
}
```

---

## 20. Visual Rework Without Breaking Themes

During visual changes to HTML, CSS, or UI components, the appearance of elements may be redesigned, but the connection to the theme system must always be preserved.

Buttons, switches, cards, inputs, menus, badges, modals, and other UI components must continue to receive their colors from the active theme variables.

The visual structure may change:

- button shape;
- border radius;
- shadows;
- spacing;
- transitions;
- hover states;
- active states;
- switch design;
- card layout;
- menu appearance;
- interface structure.

However, the color source must remain centralized in the theme system.

### Main rule

> The visual design may change. The theme color priority must not be broken.

### Correct

```css
.button {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.switch {
  background: var(--color-surface-muted);
}

.switch.is-active {
  background: var(--color-primary);
}
```

### Wrong

```css
.button {
  background: #7c3aed;
  color: #ffffff;
}

.switch.is-active {
  background: blue;
}
```

### Rules for component rework

- Never replace theme variables with fixed colors.
- Never use hex, rgb, hsl, or named colors directly in components, except inside theme definition files.
- All visual states must respect the theme:
  - normal;
  - hover;
  - active;
  - focus;
  - disabled;
  - selected;
  - loading;
  - error;
  - success.
- If a new color is needed, create a new variable in the theme system.
- If a component needs a visual variation, create a semantic variable instead of using a fixed color.
- Ensure dark mode, light mode, and community themes still affect the component.
- Always test at least two themes after changing global styles.

### Recommended semantic variables

Prefer names based on the role of the color, not the literal color.

Correct:

```css
:root {
  --color-primary: #8b5cf6;
  --color-on-primary: #ffffff;
  --color-surface: #111827;
  --color-surface-muted: #1f2937;
  --color-border: #374151;
  --color-text: #f9fafb;
  --color-text-muted: #9ca3af;
  --color-danger: #ef4444;
  --color-success: #22c55e;
}
```

Avoid:

```css
:root {
  --purple: #8b5cf6;
  --white: #ffffff;
  --gray-dark: #111827;
}
```

### Buttons

All buttons must use theme variables.

```css
.btn {
  background: var(--button-bg, var(--color-primary));
  color: var(--button-text, var(--color-on-primary));
  border-color: var(--button-border, var(--color-primary));
}

.btn:hover {
  background: var(--button-bg-hover, var(--color-primary-hover));
}
```

If `--color-primary-hover` does not exist, it should be added to the theme or generated centrally. It must not be invented directly inside the component.

### Switches

Switches must remain connected to the primary theme color.

```css
.switch {
  background: var(--switch-bg, var(--color-surface-muted));
}

.switch-thumb {
  background: var(--switch-thumb, var(--color-surface));
}

.switch[aria-checked="true"] {
  background: var(--switch-active-bg, var(--color-primary));
}
```

### Cards and panels

Cards must use theme surface colors.

```css
.card {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}
```

### Inputs

Inputs must respect theme background, text, border, and focus colors.

```css
.input {
  background: var(--color-input-bg, var(--color-surface));
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

### Rule for new variables

Whenever a new component needs a specific color, follow this order:

```txt
1. Check if a suitable variable already exists.
2. Reuse the existing variable if appropriate.
3. Create a new semantic variable if needed.
4. Add that variable to all themes.
5. Test the component in light mode, dark mode, and community themes.
```

### Visual rework checklist

Before completing any visual change, confirm:

```txt
[ ] The component still uses CSS variables.
[ ] No hardcoded colors were added.
[ ] Hover, active, focus, and disabled states respect the theme.
[ ] Switches still use the main theme color.
[ ] Buttons still change with the active theme.
[ ] Cards remain compatible with dark and light modes.
[ ] The change was tested with more than one theme.
[ ] New variables were added to all themes.
```

---

## 21. i18n and UI Text

The project supports multiple languages through:

```txt
public/modules/i18n.js
```

Rules:

- do not write reusable visible text directly inside components;
- add new text to the i18n system;
- keep keys clear;
- avoid duplicating the same phrase across multiple files;
- provide fallback behavior when a translation is missing.

Example:

```js
t('settings.readerAppearance.title')
```

Avoid:

```js
title.textContent = 'Reader Appearance';
```

---

## 22. Interface States

Each important UI flow should account for:

- initial state;
- loading state;
- empty state;
- success state;
- error state;
- disabled state.

Example:

```txt
Library:
- loading while data is being fetched;
- empty when there is no manga;
- error when the API fails;
- success when data is loaded.
```

Never leave an action without visual feedback.

---

## 23. API and Data Contracts

API responses should remain consistent.

Recommended success shape:

```js
{
  ok: true,
  data: {}
}
```

Recommended error shape:

```js
{
  ok: false,
  error: "Clear message"
}
```

Rules:

- do not return different formats without a reason;
- document new endpoints in the README;
- validate input and output;
- preserve compatibility when possible;
- avoid silently breaking the frontend.

---

## 24. Errors

Errors should be useful for development but safe for the end user.

Backend example:

```js
res.status(400).json({
  ok: false,
  error: 'Invalid source id.'
});
```

Avoid sending:

```js
res.status(500).json({
  error: error.stack
});
```

Rules:

- do not expose stack traces to the client;
- do not expose local paths;
- do not expose tokens;
- use clear messages;
- log technical details only internally;
- handle network, filesystem, and invalid data errors.

---

## 25. Dependencies

Before adding a dependency:

- check if the project already has a solution;
- evaluate whether the library is maintained;
- evaluate bundle impact;
- evaluate security impact;
- confirm that it is actually necessary.

Avoid dependencies for simple tasks.

Remove unused dependencies.

---

## 26. `.bat` and `.sh` Scripts

Startup scripts should be clear and conservative.

Rules:

- do not delete user data;
- do not overwrite `data/` without confirmation;
- do not hide critical errors;
- use clear messages;
- keep behavior similar between Windows and Linux/macOS;
- avoid absolute paths from the developer's machine;
- document relevant changes in the README.

---

## 27. Docker

Docker changes must respect:

- `data/` persistence;
- `public/` mounting when needed;
- rebuild only when necessary;
- compatibility with the current structure.

Do not change volumes without evaluating the impact on user data.

---

## 28. Performance

Rules:

- avoid repeated calls without cache;
- avoid reading files repeatedly in loops when unnecessary;
- use TTL cache when appropriate;
- avoid blocking the event loop;
- avoid processing large files fully in memory unless necessary;
- apply pagination when lists grow;
- compress responses when appropriate;
- optimize images and public assets.

---

## 29. Manual Testing and Validation

Before considering a change complete, test:

- startup with `node server.js`;
- opening the application on `localhost`;
- main API endpoints;
- library;
- installed sources;
- chapter reading;
- local import;
- downloads;
- themes;
- analytics;
- achievements;
- settings;
- Docker, if the change affects environment setup;
- Windows launcher, if the change affects scripts.

---

## 30. Checklist Before Finalizing Code

Before completing any change, confirm:

```txt
[ ] Is the code in the correct file?
[ ] Does the function have a single responsibility?
[ ] Are there avoidable hardcoded values?
[ ] Are names clear?
[ ] Is there unnecessary code duplication?
[ ] Are errors handled?
[ ] Is input validated?
[ ] Are there temporary logs?
[ ] Are sensitive values logged?
[ ] Does the code respect the existing structure?
[ ] Does the README need to be updated?
[ ] Was the change manually tested?
[ ] Could the change break existing user data?
```

---

## 31. Main Rule for New Features

Whenever a new feature is created, follow this order:

```txt
1. Create or update the domain module in server/modules/
2. Create or update the route in server/routes/
3. Use existing helpers/configuration
4. Avoid hardcoded values
5. Validate input
6. Handle errors
7. Update the frontend if needed
8. Update README/GUIDELINES if needed
9. Test the complete flow
```

---

## 32. External API Verification and Error Code Registry

External APIs and third-party services must be treated as unstable dependencies.

APIs such as MangaDex, AniList, MangaUpdates, source repositories, image providers, metadata providers, and any scraper target may change over time. Endpoints, response formats, rate limits, authentication requirements, field names, pagination behavior, and anti-bot behavior can change without warning.

Because of this, every integration with an external API must be easy to inspect, debug, and update.

### Mandatory rules for external APIs

- Do not assume external APIs will keep the same response structure forever.
- Validate all external API responses before using them.
- Check for missing fields, renamed fields, empty arrays, unexpected status codes, and invalid JSON.
- Keep API-specific parsing isolated in the relevant service/module.
- Do not spread API response parsing across unrelated files.
- Add timeouts to all external API calls.
- Handle rate limits and temporary failures clearly.
- Avoid crashing the application when one external API fails.
- Return a useful fallback or a clear error state when an API changes.
- Document important external API assumptions near the integration code.
- Review API integrations periodically, especially when users report missing results, failed searches, broken covers, failed metadata, or empty responses.

### API change examples

Possible API changes include:

```txt
- Search endpoint changed response format.
- Manga details endpoint renamed a field.
- Covers moved to a different endpoint.
- Pagination behavior changed.
- API now requires a new header.
- API started returning 403 or 429 more often.
- API returns an empty result set despite a valid query.
- Image URLs expire faster than before.
- Metadata provider changed its schema.
```

### Error codes for recurring issues

Whenever a known error occurs, the application should generate a stable internal error code.

This allows the same problem to be identified quickly in the future.

Example:

```txt
ERR-001 -> MangaDex search returned no results for a valid query.
ERR-002 -> MangaDex response format changed or expected field is missing.
ERR-003 -> AniList GraphQL request failed.
ERR-004 -> MangaUpdates search failed or returned invalid data.
ERR-005 -> Source module did not return valid chapters.
ERR-006 -> Cover image proxy rejected or failed to fetch image.
ERR-007 -> Local file import failed.
ERR-008 -> Store read/write failed.
ERR-009 -> Theme preset failed to load or save.
ERR-010 -> External API rate limit reached.
```

The exact codes may change, but they must remain centralized and documented.

### Error code registry

Create and maintain a centralized error code registry.

Recommended structure:

```txt
server/modules/errors/
  error-codes.js
  error-registry.js
```

Example:

```js
// server/modules/errors/error-codes.js
'use strict';

module.exports = {
  MANGADEX_NO_RESULTS: 'ERR-001',
  MANGADEX_INVALID_RESPONSE: 'ERR-002',
  ANILIST_REQUEST_FAILED: 'ERR-003',
  MANGAUPDATES_REQUEST_FAILED: 'ERR-004',
  SOURCE_INVALID_CHAPTERS: 'ERR-005',
  COVER_PROXY_FAILED: 'ERR-006',
  LOCAL_IMPORT_FAILED: 'ERR-007',
  STORE_PERSISTENCE_FAILED: 'ERR-008',
  THEME_PRESET_FAILED: 'ERR-009',
  EXTERNAL_RATE_LIMITED: 'ERR-010'
};
```

### Error log file

When a recurring or known error happens, the application should add an entry to a log file.

Recommended file:

```txt
data/error-log.json
```

The log should help identify the same error in the future.

Recommended entry format:

```json
{
  "code": "ERR-001",
  "area": "mangadex",
  "message": "MangaDex search returned no results for a valid query.",
  "details": {
    "query": "one piece",
    "endpoint": "/manga",
    "status": 200
  },
  "firstSeenAt": "2026-05-16T10:20:00.000Z",
  "lastSeenAt": "2026-05-16T10:25:00.000Z",
  "count": 3
}
```

Rules:

- If the same error happens again, update `lastSeenAt` and increment `count`.
- Do not duplicate the same error unnecessarily.
- Do not log sensitive data.
- Do not log tokens, cookies, authentication headers, or private user data.
- Keep the error log readable and bounded.
- If the file grows too much, rotate it or keep only the most recent entries.

### Error logger helper

Create a reusable helper for known errors.

Recommended structure:

```js
// server/modules/errors/error-registry.js
'use strict';

const fs = require('fs').promises;

async function registerKnownError({
  logPath,
  code,
  area,
  message,
  details = {}
}) {
  const now = new Date().toISOString();

  let entries = [];

  try {
    const raw = await fs.readFile(logPath, 'utf8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }

  const existing = entries.find((entry) =>
    entry.code === code &&
    entry.area === area &&
    entry.message === message
  );

  if (existing) {
    existing.lastSeenAt = now;
    existing.count = (existing.count || 1) + 1;
    existing.details = details;
  } else {
    entries.push({
      code,
      area,
      message,
      details,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1
    });
  }

  await fs.writeFile(logPath, JSON.stringify(entries, null, 2), 'utf8');
}

module.exports = {
  registerKnownError
};
```

### Example: MangaDex no results

If MangaDex search returns no results for a query that should normally return results, the application should not fail silently.

Example behavior:

```txt
User searches: "One Piece"
MangaDex returns: []
Application logs: ERR-001
Frontend/debug panel shows: "ERR-001 — MangaDex returned no results."
Developer can later inspect data/error-log.json.
```

Example implementation idea:

```js
const { MANGADEX_NO_RESULTS } = require('../errors/error-codes');
const { registerKnownError } = require('../errors/error-registry');

if (sourceId === 'mangadex' && Array.isArray(results) && results.length === 0) {
  await registerKnownError({
    logPath: ERROR_LOG_PATH,
    code: MANGADEX_NO_RESULTS,
    area: 'mangadex',
    message: 'MangaDex search returned no results for a valid query.',
    details: {
      query,
      endpoint: '/manga',
      status: responseStatus
    }
  });
}
```

### API integration checklist

Before finishing changes related to an external API, confirm:

```txt
[ ] The API response is validated.
[ ] Missing fields are handled safely.
[ ] Empty responses are handled.
[ ] Rate limits are handled.
[ ] Timeouts are configured.
[ ] The error has a stable error code when relevant.
[ ] Recurring errors are added to data/error-log.json.
[ ] Sensitive data is not logged.
[ ] The frontend/debug panel can show the error code.
[ ] The README or relevant documentation was updated if behavior changed.
```


---

## Final Note

These guidelines should evolve with the project.

Whenever a new technical pattern, folder structure, configuration system, or security rule is adopted, this file should be updated.

ScrollScape should keep the same core logic: organized, modular, secure code, without unnecessary hardcoded values, and easy to maintain.
