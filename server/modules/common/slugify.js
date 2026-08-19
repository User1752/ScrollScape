'use strict';

// Lowercases and hyphenates a free-text name into a URL-path-safe slug,
// e.g. for turning a genre name into the segment a source site's own
// genre-listing URL expects.
function slugifyGenre(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

module.exports = { slugifyGenre };
