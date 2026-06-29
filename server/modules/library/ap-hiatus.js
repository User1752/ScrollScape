'use strict';

async function checkAnimePlanetHiatus(title) {
  if (!title) return false;
  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const res = await fetch(`https://www.anime-planet.com/manga/${slug}`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
