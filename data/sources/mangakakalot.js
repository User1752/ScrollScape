// ============================================================
// MangaKakalot source  —  https://www.mangakakalot.art
// Mirrors the same interface as mangadex.js
//   search(query, page)  →  { results, hasNextPage }
//   mangaDetails(mangaId) → { id, title, author, description, cover, genres, status }
//   chapters(mangaId)     → { chapters }
//   pages(chapterId)      → { pages }
//
// mangaId   = URL slug  e.g. "one-piece"
// chapterId = "slug:chapterNumber"  e.g. "one-piece:1174"
// ============================================================

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const BASE = "https://www.mangakakalot.art";

// Headers that mimic a real browser to avoid Cloudflare blocks
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.mangakakalot.art/",
};

// ── helpers ──────────────────────────────────────────────────

function decodeEnt(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Parse manga cards shared by search + list pages
function parseCards(html) {
  const results = [];
  const seen = new Set();

  // Each card has an <a href="/manga/slug" title="Title"> with a nearby <img>
  const re = /href="\/manga\/([^"?#]+)"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const title = decodeEnt(m[2]);

    // Look for an image in the surrounding ~600 chars
    const block = html.slice(Math.max(0, m.index - 600), m.index + 100);
    const imgM  = block.match(
      /(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/i
    );
    const cover = imgM ? imgM[1] : "";

    results.push({
      id: slug,
      title,
      author: "",
      cover,
      url: `${BASE}/manga/${slug}`,
      genres: [],
      status: "unknown",
    });
  }

  return results;
}

// ── module exports ────────────────────────────────────────────

module.exports = {
  meta: {
    id: "mangakakalot",
    name: "MangaKakalot",
    version: "1.0.0",
    author: "MangaKakalot",
  },

  // ── search ─────────────────────────────────────────────────
  async search(query, page = 1) {
    let url;

    if (!query || query === "*") {
      // Latest updates list  e.g. /manga-list/latest-manga/1
      url = `${BASE}/manga-list/latest-manga/${page}`;
    } else {
      // Search uses underscores for spaces
      const kw = encodeURIComponent(query).replace(/%20/g, "_");
      url = `${BASE}/search/story/${kw}?page=${page}`;
    }

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`MangaKakalot: HTTP ${res.status} — ${url}`);
    const html = await res.text();

    const results    = parseCards(html);
    const hasNextPage =
      /class="[^"]*page-next[^"]*"/.test(html) ||
      /rel="next"/.test(html) ||
      html.includes("&page=" + (page + 1));

    return { results: results.slice(0, 50), hasNextPage };
  },

  // ── manga details ───────────────────────────────────────────
  async mangaDetails(mangaId) {
    const res = await fetch(`${BASE}/manga/${mangaId}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`MangaKakalot: HTTP ${res.status}`);
    const html = await res.text();

    // ── Title ──
    let title = decodeURIComponent(mangaId).replace(/-/g, " ");
    const titleM =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/class="[^"]*manga-name[^"]*"[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|div)>/i);
    if (titleM) title = decodeEnt(stripTags(titleM[1]));

    // ── Cover ──
    let cover = "";
    const coverM =
      html.match(/class="[^"]*manga-cover[^"]*"[\s\S]*?(?:data-src|src)="([^"]+)"/i) ||
      html.match(/<img[^>]+(?:data-src|src)="(https?:\/\/[^"]*\.(?:jpg|webp|png)[^"]*)"/i);
    if (coverM) cover = coverM[1];

    // ── Author ──
    let author = "";
    const authM =
      html.match(/[Aa]uthor[^<]{0,20}:<[^>]*>([^<]+)/) ||
      html.match(/class="[^"]*author[^"]*"[^>]*>([^<]+)/);
    if (authM) author = decodeEnt(authM[1].trim());

    // ── Status ──
    let status = "unknown";
    const statM =
      html.match(/[Ss]tatus\s*:\s*<[^>]*>([^<]+)/) ||
      html.match(/[Ss]tatus\s*:\s*([A-Za-z]+)/);
    if (statM) {
      const s = statM[1].toLowerCase();
      if (s.includes("complet"))             status = "completed";
      else if (s.includes("ongoing"))        status = "ongoing";
      else if (s.includes("hiatus"))         status = "hiatus";
    }

    // ── Genres ──
    const genreRe = /href="\/genre\/[^"]*"[^>]*>([^<]+)</g;
    const genres = [];
    let gm;
    while ((gm = genreRe.exec(html)) !== null) {
      const g = decodeEnt(gm[1].trim());
      if (g && !genres.includes(g)) genres.push(g);
    }

    // ── Description ──
    let description = "";
    const descM =
      html.match(/id="panel-story-info-description"[^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/class="[^"]*(?:description|synopsis|summary)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/i);
    if (descM) description = decodeEnt(stripTags(descM[1]));

    return { id: mangaId, title, author, description, cover, genres, status };
  },

  // ── chapters ────────────────────────────────────────────────
  async chapters(mangaId) {
    const res = await fetch(`${BASE}/manga/${mangaId}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`MangaKakalot: HTTP ${res.status}`);
    const html = await res.text();

    const chapters = [];
    const seen     = new Set();

    // ── Method 1: chapters already in the HTML ──
    const chapRe =
      /href="\/manga\/[^/"]+\/chapter-([\d.]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = chapRe.exec(html)) !== null) {
      const chapNum  = m[1];
      const chapName = decodeEnt(stripTags(m[2])) || `Chapter ${chapNum}`;
      const id       = `${mangaId}:${chapNum}`;
      if (seen.has(id)) continue;
      seen.add(id);

      // Date nearby (within next 250 chars after the match)
      const snippet = html.slice(m.index, m.index + 250);
      const dateM   = snippet.match(
        /(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i
      );
      chapters.push({
        id,
        name:    chapName.match(/[Cc]hapter/) ? chapName : `Chapter ${chapNum}`,
        chapter: chapNum,
        date:    dateM ? dateM[1] : new Date().toISOString(),
      });
    }

    // ── Method 2: AJAX endpoint (chapter list loaded dynamically) ──
    if (chapters.length === 0) {
      // The numeric storyid is usually in a JS var, data attribute, or hidden input
      const idM =
        html.match(/var\s+storyid\s*=\s*(\d+)/i) ||
        html.match(/story_id\s*[:=]\s*['""]?(\d+)/i) ||
        html.match(/data-id=["'](\d+)["'][^>]*class=["'][^"']*chapter/i) ||
        html.match(/"id"\s*:\s*(\d+)/) ||
        html.match(/manga_id\s*=\s*(\d+)/i);

      if (idM) {
        const numericId = idM[1];
        const ajaxHeaders = {
          ...HEADERS,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json, text/javascript, */*",
        };

        // Try both known AJAX endpoint patterns
        const ajaxUrls = [
          `${BASE}/ajax/manga/list-chapter-volume?id=${numericId}`,
          `${BASE}/ajax/manga/list-chapter?id=${numericId}`,
          `${BASE}/chapter/list/${numericId}`,
        ];

        for (const ajaxUrl of ajaxUrls) {
          try {
            const ajaxRes = await fetch(ajaxUrl, { headers: ajaxHeaders });
            if (!ajaxRes.ok) continue;

            const raw = await ajaxRes.text();
            // Response may be JSON with an "html" field, or raw HTML
            let ajaxHtml = raw;
            try {
              const json = JSON.parse(raw);
              ajaxHtml = json.html || json.data || json.content || raw;
            } catch (_) {}

            const ajRe =
              /href="\/manga\/[^/"]+\/chapter-([\d.]+)"[^>]*>([\s\S]*?)<\/a>/g;
            let am;
            while ((am = ajRe.exec(ajaxHtml)) !== null) {
              const chapNum  = am[1];
              const chapName = decodeEnt(stripTags(am[2])) || `Chapter ${chapNum}`;
              const id       = `${mangaId}:${chapNum}`;
              if (seen.has(id)) continue;
              seen.add(id);
              chapters.push({
                id,
                name:    chapName.match(/[Cc]hapter/) ? chapName : `Chapter ${chapNum}`,
                chapter: chapNum,
                date:    new Date().toISOString(),
              });
            }
            if (chapters.length > 0) break; // stop trying other endpoints
          } catch (_) {}
        }
      }
    }

    return { chapters };
  },

  // ── pages ───────────────────────────────────────────────────
  async pages(chapterId) {
    // chapterId = "slug:chapterNumber"  e.g. "one-piece:1174"
    const sep     = chapterId.lastIndexOf(":");
    const slug    = chapterId.slice(0, sep);
    const chapNum = chapterId.slice(sep + 1);

    const url = `${BASE}/manga/${slug}/chapter-${chapNum}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`MangaKakalot: HTTP ${res.status}`);
    const html = await res.text();

    const pages = [];
    const seen  = new Set();

    // ── Method 1: <img data-src="…"> or <img src="…"> inside the reader ──
    const imgRe =
      /(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
    let m;
    while ((m = imgRe.exec(html)) !== null) {
      const img = m[1];
      // Skip site assets: logos, icons, banners, avatars, thumbnails
      if (
        /logo|icon|banner|avatar|thumb|ad[_-]?|header|footer/i.test(img)
      )
        continue;
      if (seen.has(img)) continue;
      seen.add(img);
      pages.push({ img });
    }

    // ── Method 2: JavaScript image array (fallback) ──
    if (pages.length === 0) {
      const jsM = html.match(
        /var\s+(?:pages_array|images|chapImages|imageList|listImages)\s*=\s*(\[[\s\S]*?\])/
      );
      if (jsM) {
        try {
          const arr = JSON.parse(jsM[1]);
          for (const item of arr) {
            const img =
              typeof item === "string"
                ? item
                : item.imageUrl || item.url || item.src || "";
            if (img && !seen.has(img)) {
              seen.add(img);
              pages.push({ img });
            }
          }
        } catch (_) {}
      }
    }

    return { pages };
  },
};
