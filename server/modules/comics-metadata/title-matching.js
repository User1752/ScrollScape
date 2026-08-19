/**
 * comics-metadata/title-matching.js — shared, safety-critical title
 * disambiguation logic for cross-database cover/publisher lookups (ComicVine,
 * League of Comic Geeks, ...).
 *
 * Matching a BatCave title against an external database is inherently fuzzy —
 * a mismatch would silently attach the WRONG comic's cover. Both lookup
 * sources share the exact same rule for that reason (see pickBestMatch):
 * only a case/punctuation-insensitive EXACT name match is ever used, and when
 * several candidates share that name (common for reprints/regional editions),
 * only a year-confirmed one is trusted — otherwise there is no safe choice.
 */

'use strict';

/**
 * Splits a BatCave-style title into a clean search term and an optional
 * publication year, recognizing the several parenthetical conventions BatCave
 * titles actually use:
 *   - "Wolverine Prequel Infinity Comic (2026-)" — ongoing, single year
 *   - "Batman: Detective Comics by Ram V Omnibus (2026)" — single year
 *   - "The Punisher - War Machine (2018-2019)" — closed range (uses start year)
 *   - "Big Baby Huey (1991 series)" — older completed-run annotation
 * Titles with no recognizable year (e.g. a year embedded mid-string rather
 * than a trailing annotation) are returned with year: null rather than
 * guessed at, since a wrong year would defeat the whole point of using it
 * to disambiguate.
 *
 * @param {string} rawTitle
 * @returns {{ cleanTitle: string, year: number|null }}
 */
function parseTitle(rawTitle) {
  const title = String(rawTitle || '').trim();
  const patterns = [
    /^(.*?)\s*\((\d{4})-\d{4}\)\s*$/, // "(2018-2019)" — range, start year
    /^(.*?)\s*\((\d{4})\s+series\)\s*$/i, // "(1991 series)"
    /^(.*?)\s*\((\d{4})-?\)\s*$/, // "(2026-)" or "(2026)"
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return { cleanTitle: match[1].trim(), year: Number(match[2]) };
    }
  }
  return { cleanTitle: title, year: null };
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Picks the single candidate whose name exactly matches cleanTitle.
 *
 * Multiple candidates sharing that exact name is common for short/generic
 * titles like "Batman", listed across many decades, publishers, and regional
 * reprints — defaulting to "the first result" among duplicates has already
 * picked an unrelated reprint over the intended run in testing. Only a
 * year-confirmed match among duplicates is trusted; with no year to
 * disambiguate, there's no safe choice.
 *
 * @template T
 * @param {T[]} candidates
 * @param {string} cleanTitle
 * @param {number|null} year
 * @param {(candidate: T) => string} getName
 * @param {(candidate: T) => number|null|undefined} getYear
 * @returns {T|null}
 */
function pickBestMatch(candidates, cleanTitle, year, getName, getYear) {
  const target = normalize(cleanTitle);
  if (!target) return null;

  const exactMatches = candidates.filter(c => normalize(getName(c)) === target);
  if (exactMatches.length === 0) return null;
  if (exactMatches.length === 1) return exactMatches[0];

  if (!year) return null;
  const yearMatch = exactMatches.find(c => Number(getYear(c)) === year);
  return yearMatch || null;
}

// normalize() is only ever used internally by pickBestMatch() below — not
// exported, since neither of this module's two real consumers (comicvine,
// leagueofcomicgeeks) has ever imported it on its own.
module.exports = { parseTitle, pickBestMatch };
