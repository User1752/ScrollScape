'use strict';

// Normalizes a scraped, free-text publication-status label (e.g. "Releasing",
// "On Hiatus", "Complete") into one of the app's fixed status values. Falls
// back to the original (lowercased) text rather than a generic "unknown" —
// that raw text is what actually reaches the status badge in ui-search.js,
// so an unrecognized label still shows something meaningful instead of
// nothing.
function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('ongoing') || s.includes('publishing') || s.includes('releas')) return 'ongoing';
  if (s.includes('complet') || s.includes('finish')) return 'completed';
  if (s.includes('hiatus')) return 'hiatus';
  if (s.includes('cancel')) return 'cancelled';
  return s || 'unknown';
}

module.exports = { normalizeStatus };
