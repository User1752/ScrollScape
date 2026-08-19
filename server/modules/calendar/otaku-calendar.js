'use strict';

// Scrapes otakucalendar.com's manga-volume release page and matches its
// entries against the given `releasing` favorites list by normalized title.
// Self-contained: no shared cache/state, so no factory wrapper needed.
async function fetchOtakuCalendarReleases(targetYear, targetMonth, releasing) {
  try {
    const res = await fetch(`https://otakucalendar.com/Release/?filterCategory=2`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return {};
    const html = await res.text();

    let currentYear = null;
    let currentMonthStr = null;
    let currentDay = null;

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const targetMonthStr = monthNames[targetMonth - 1];

    const parts = html.split(/<div class="calendarDateWindow">|<a href="\/Release\//g);

    const favNorm = new Map();
    const normalize = (t) => t ? t.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    for (const m of releasing) {
        const norm = normalize(m.title);
        if (norm) favNorm.set(norm, m);
    }

    const releasesByDay = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('<div class="dayOfMonth">')) {
        const dayMatch = part.match(/<div class="dayOfMonth">\s*(\d+)\s*<\/div>/);
        const monthMatch = part.match(/<div class="month">\s*([A-Za-z]+)\s*<\/div>/);
        const yearMatch = part.match(/<div>\s*(\d{4})\s*<\/div>/);

        if (dayMatch && monthMatch && yearMatch) {
          currentDay = parseInt(dayMatch[1], 10);
          currentMonthStr = monthMatch[1].trim();
          currentYear = parseInt(yearMatch[1], 10);
        }
      } else if (currentDay !== null && part.includes('</a>')) {
        if (currentYear !== targetYear || currentMonthStr !== targetMonthStr) continue;

        const textMatch = part.match(/>([^<]+)<\/a>/);
        if (textMatch) {
          const text = textMatch[1].trim();
          if (text.includes('(Manga)')) {
            let rawTitle = text.replace(/\(Manga\).*$/i, '').trim();
            let volMatch = rawTitle.match(/Volume\s+(\d+)/i) || rawTitle.match(/\s+(\d+)$/);
            let vol = volMatch ? volMatch[1] : '?';

            rawTitle = rawTitle.replace(/Volume\s+\d+/i, '').trim();
            rawTitle = rawTitle.replace(/\s+\d+$/, '').trim();

            const normTitle = normalize(rawTitle);

            let matchedManga = favNorm.get(normTitle);

            if (!matchedManga) {
                for (const [key, m] of favNorm.entries()) {
                    if (key.length > 4 && (normTitle.includes(key) || key.includes(normTitle))) {
                        if (Math.abs(normTitle.length - key.length) <= 5) {
                            matchedManga = m;
                            break;
                        }
                    }
                }
            }

            if (matchedManga) {
              if (!releasesByDay[currentDay]) releasesByDay[currentDay] = [];
              releasesByDay[currentDay].push({
                chapterId: 'vol-' + vol + '-' + Math.random().toString(36).substring(7),
                chapter: `Vol.${vol}`,
                publishAt: new Date(Date.UTC(targetYear, targetMonth - 1, currentDay)).toISOString(),
                predicted: false,
                confidence: 'high',
                isVolume: true,
                manga: { id: matchedManga.id, title: matchedManga.title, cover: matchedManga.cover, sourceId: matchedManga.sourceId },
              });
            }
          }
        }
      }
    }
    return releasesByDay;
  } catch (e) {
    console.error('[calendar] OtakuCalendar fetch error:', e.message);
    return {};
  }
}

module.exports = { fetchOtakuCalendarReleases };
