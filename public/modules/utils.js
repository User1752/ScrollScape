// ============================================================================
// UTILITIES
// Stateless helper functions shared across the entire frontend.
// No dependencies on state, navigation, or i18n.
// ============================================================================

// ── DOM shorthand ─────────────────────────────────────────────────────────

/**
 * Shorthand for {@link document.getElementById}.
 *
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function $(id) { return document.getElementById(id); }

// ── Text / HTML helpers ───────────────────────────────────────────────────

/**
 * Escape a string so it can be safely embedded in HTML.
 *
 * @param {*} s - Value to escape (will be coerced to string)
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Format a duration in minutes as a human-readable string.
 * Examples: 45 → "45m", 90 → "1h 30m", 120 → "2h"
 *
 * @param {number} minutes
 * @returns {string}
 */
function formatTime(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Convert an internal reading-status key to a display label.
 *
 * @param {"reading"|"completed"|"on_hold"|"plan_to_read"|"dropped"|string} status
 * @returns {string}
 */
function statusLabel(status) {
  const map = {
    reading:      'Reading',
    completed:    'Completed',
    on_hold:      'On Hold',
    plan_to_read: 'Plan to Read',
    dropped:      'Dropped'
  };
  return map[status] || status;
}

const NSFW_TAGS = new Set([
  'ecchi',
  'mature',
  'smut',
  'hentai',
  'adult',
  'nsfw',
  'erotica',
  'suggestive',
  'pornographic',
  'sexual violence'
]);

const NSFW_TEXT_HINTS = [
  'mature',
  'adult',
  'hentai',
  'ecchi',
  'smut',
  'nsfw',
  'sex',
  'sexual',
  'erot',
  'porn',
  'oppai',
  'boobs',
  'breasts',
  'milf',
  'fetish',
  'bdsm',
  'incest',
  'hitozuma',
  'netorare',
  'ntr',
  'ahegao',
  'yuri h',
  'doujin',
  'lewdness'
];

function normalizeTagValue(tag) {
  return String(tag || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isNsfwTag(tag) {
  return NSFW_TAGS.has(normalizeTagValue(tag));
}

function isNsfwManga(manga) {
  if (!manga) return false;
  const allTags = [
    ...(Array.isArray(manga.genres) ? manga.genres : []),
    ...(Array.isArray(manga.tags) ? manga.tags : []),
    manga.contentRating,
    manga.content_rating,
    manga.ageRating,
  ].filter(Boolean);
  if (allTags.some(isNsfwTag)) return true;

  // Fallback for legacy entries that were saved without usable genre/tag metadata.
  const text = `${manga.title || ''} ${manga.description || ''}`.toLowerCase();
  return NSFW_TEXT_HINTS.some(k => text.includes(k));
}

// ── Webtoon / Manhwa / Manhua auto-detection ──────────────────────────────

const WEBTOON_TYPES = new Set(['manhwa', 'manhua', 'webtoon', 'webtoons']);
const WEBTOON_GENRES = new Set(['manhwa', 'manhua', 'webtoons', 'webtoon']);

/**
 * Returns true when the manga is a vertical-scroll format (Manhwa / Manhua / Webtoon).
 * Checks the `type` field first, then genres/tags.
 *
 * @param {object} manga
 * @returns {boolean}
 */
function isWebtoonFormat(manga) {
  if (!manga) return false;
  const type = String(manga.type || '').toLowerCase().trim();
  if (WEBTOON_TYPES.has(type)) return true;
  const allTags = [
    ...(Array.isArray(manga.genres) ? manga.genres : []),
    ...(Array.isArray(manga.tags)   ? manga.tags   : []),
  ].map(t => String(t || '').toLowerCase().trim());
  return allTags.some(t => WEBTOON_GENRES.has(t));
}

// ── Theme (dark / light toggle) ───────────────────────────────────────────

/**
 * Read the saved theme from localStorage and apply it to the document root.
 * Should be called once during app initialisation.
 */
function initTheme() {
  const saved = localStorage.getItem("scrollscapeTheme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeToggleIcon(saved);
}

/**
 * Toggle between "dark" and "light" themes and persist the choice.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("scrollscapeTheme", next);
  updateThemeToggleIcon(next);
}

/**
 * Show the correct sun / moon icon for the given theme.
 *
 * @param {"dark"|"light"} theme
 */
function updateThemeToggleIcon(theme) {
  const moonIcon = document.querySelector(".icon-moon");
  const sunIcon  = document.querySelector(".icon-sun");
  if (!moonIcon || !sunIcon) return;
  if (theme === "dark") {
    moonIcon.style.display = "block";
    sunIcon.style.display  = "none";
  } else {
    moonIcon.style.display = "none";
    sunIcon.style.display  = "block";
  }
}

// ── Toast notifications ───────────────────────────────────────────────────

/**
 * Display a brief toast notification.
 *
 * @param {string} title   - Primary line of text
 * @param {string} [message=""] - Optional secondary line
 * @param {"default"|"success"|"error"|"info"} [type="default"]
 */
function showToast(title, message = "", type = "default") {
  const container = $("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ""}
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}
