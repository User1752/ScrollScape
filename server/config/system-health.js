'use strict';

const REQUIRED_STORE_KEYS = [
  'repos',
  'installedSources',
  'history',
  'favorites',
  'readingStatus',
  'reviews',
  'customLists',
  'achievements',
  'anilistSync',
  'analytics',
];

const REQUIRED_DATA_FILES = [
  'store.json',
  'achievements.json',
  'icon-mapping.json',
  'error-log.json',
];

const MODULE_DEFINITIONS = [
  { id: 'discover', label: 'Discover', kind: 'frontend-file', relPath: 'public/modules/ui-discover.js' },
  { id: 'sources', label: 'Sources', kind: 'backend-route', relPath: 'server/routes/sources.js' },
  { id: 'library', label: 'Library', kind: 'backend-route', relPath: 'server/routes/library.js' },
  { id: 'local', label: 'Local Import', kind: 'backend-route', relPath: 'server/routes/local.js' },
  { id: 'downloads', label: 'Downloads', kind: 'backend-route', relPath: 'server/routes/downloads.js' },
  { id: 'analytics', label: 'Analytics', kind: 'backend-route', relPath: 'server/routes/analytics.js' },
  { id: 'history', label: 'History', kind: 'frontend-file', relPath: 'public/modules/ui-history.js' },
  { id: 'achievements', label: 'Achievements', kind: 'backend-route', relPath: 'server/routes/achievements.js' },
  { id: 'calendar', label: 'Calendar', kind: 'backend-route', relPath: 'server/routes/calendar.js' },
  { id: 'lists', label: 'Custom Lists', kind: 'backend-route', relPath: 'server/routes/lists.js' },
  { id: 'reviews', label: 'Reviews', kind: 'backend-route', relPath: 'server/routes/reviews.js' },
  { id: 'themePresets', label: 'Theme Presets', kind: 'backend-route', relPath: 'server/routes/theme-presets.js' },
  { id: 'coverSearch', label: 'Cover Search', kind: 'backend-route', relPath: 'server/routes/cover-search.js' },
  { id: 'mangaupdates', label: 'MangaUpdates', kind: 'backend-route', relPath: 'server/routes/mangaupdates.js' },
  { id: 'sourceHealth', label: 'Source Health', kind: 'backend-route', relPath: 'server/routes/health-check.js' },
];

const SOURCE_ERROR_TYPES = [
  {
    code: 'error-1',
    key: 'api_error',
    label: 'API error',
    patterns: ['api', 'http 500', 'http 502', 'http 503', 'gateway', 'service unavailable'],
    suggestedAction: 'Check endpoint availability and response codes.',
  },
  {
    code: 'error-2',
    key: 'site_maintenance',
    label: 'Site in maintenance',
    patterns: ['maintenance', 'manutencao', 'manutenção', 'temporarily unavailable', 'site down'],
    suggestedAction: 'Wait and retry later; avoid aggressive retries.',
  },
  {
    code: 'error-3',
    key: 'cloudflare_or_challenge',
    label: 'Cloudflare/challenge block',
    patterns: ['cloudflare', 'challenge', 'captcha', 'checking your browser'],
    suggestedAction: 'Adjust scraper strategy and headers; keep read-only fallback.',
  },
  {
    code: 'error-4',
    key: 'timeout_or_network',
    label: 'Timeout/network error',
    patterns: ['timeout', 'timed out', 'etimedout', 'econnreset', 'network error'],
    suggestedAction: 'Increase resilience and retry/backoff policy.',
  },
  {
    code: 'error-5',
    key: 'contract_or_parse',
    label: 'Parser/contract break',
    patterns: ['did not return', 'missing', 'invalid', 'unexpected', 'parse', 'json'],
    suggestedAction: 'Update source parser to match current site/API structure.',
  },
  {
    code: 'error-6',
    key: 'rate_limit',
    label: 'Rate limit',
    patterns: ['429', 'rate limit', 'too many requests'],
    suggestedAction: 'Throttle requests and increase cooldown between calls.',
  },
  {
    code: 'error-99',
    key: 'unknown',
    label: 'Unknown error',
    patterns: [],
    suggestedAction: 'Inspect raw logs and source module output for root cause.',
  },
];

module.exports = {
  REQUIRED_STORE_KEYS,
  REQUIRED_DATA_FILES,
  MODULE_DEFINITIONS,
  SOURCE_ERROR_TYPES,
};
