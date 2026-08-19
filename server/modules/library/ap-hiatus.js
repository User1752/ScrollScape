'use strict';

const { DEFAULT_USER_AGENT } = require('../network/fetch-utils');

async function checkAnimePlanetHiatus(title) {
  if (!title) return false;
  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const res = await fetch(`https://www.anime-planet.com/manga/${slug}`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      }
    });

    if (!res.ok) {
      return false;
    }

    const html = await res.text();
    // Check if the tags section contains "Hiatus"
    return html.toLowerCase().includes('hiatus');
  } catch (err) {
    return false;
  }
}

module.exports = { checkAnimePlanetHiatus };
