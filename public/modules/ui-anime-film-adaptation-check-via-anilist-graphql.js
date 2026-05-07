// ============================================================================
// ANIME / FILM ADAPTATION CHECK (via AniList GraphQL)
// ============================================================================
window.checkAnimeAdaptation = async function(title) {
  const btn       = $("adaptationCheckBtn");
  const resultDiv = $("adaptationResult");
  if (!resultDiv) return;

  if (btn) { btn.textContent = "Checking..."; btn.classList.add("badge-adaptation-loading"); }

  // Dual query:
  // 1. Look up the manga entry and follow its ADAPTATION relations to anime
  // 2. Directly search AniList for anime with the same title (catches cases
  //    where the manga<->anime relation isn't populated on AniList)
  // Use Page for the manga lookup so that a missing manga returns [] instead of
  // causing AniList to return HTTP 400 (non-nullable Media field = null), which
  // would kill the animeDirect results too.
  const query = `
    query ($search: String) {
      mangaPage: Page(perPage: 1) {
        media(search: $search, type: MANGA) {
          id
          relations {
            edges {
              relationType
              node {
                id type format status
                title { romaji english native }
                siteUrl
                coverImage { medium }
              }
            }
          }
        }
      }
      animeDirect: Page(perPage: 6) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id format status
          title { romaji english native }
          siteUrl
          coverImage { medium }
        }
      }
    }
  `;

  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } })
    });
    const data = await res.json();

    // --- Source 1: ADAPTATION relations from the manga entry ---
    const mangaEntry = (data?.data?.mangaPage?.media || [])[0] || null;
    const relationEdges = mangaEntry?.relations?.edges || [];
    const fromRelations = relationEdges
      .filter(e => e.relationType === "ADAPTATION" && e.node.type === "ANIME")
      .map(e => e.node);

    // --- Source 2: Direct anime search ---
    const directAnime = data?.data?.animeDirect?.media || [];

    // Merge, deduplicate by AniList ID — relation entries take priority
    const seen = new Set(fromRelations.map(n => n.id));
    const merged = [
      ...fromRelations,
      ...directAnime.filter(n => !seen.has(n.id))
    ];

    if (merged.length === 0) {
      resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">No anime or film adaptations found on AniList.</div>`;
    } else {
      resultDiv.innerHTML = `
        <div class="adaptation-result">
          <div class="adaptation-result-title">Adaptations found (${merged.length})</div>
          <div class="adaptation-list">
            ${merged.map(n => {
              const t    = n.title.english || n.title.romaji || n.title.native || "Unknown";
              const fmt  = n.format ? n.format.replace(/_/g, ' ') : '';
              const st   = n.status  ? n.status.replace(/_/g, ' ')  : '';
              const meta = [fmt, st].filter(Boolean).join(' · ');
              return `<a class="adaptation-item" href="${escapeHtml(n.siteUrl)}" target="_blank" rel="noopener noreferrer">
                ${n.coverImage?.medium
                  ? `<img src="${escapeHtml(n.coverImage.medium)}" alt="" class="adaptation-cover">`
                  : `<div class="adaptation-cover-placeholder">TV</div>`}
                <div class="adaptation-item-info">
                  <span class="adaptation-item-name">${escapeHtml(t)}</span>
                  ${meta ? `<span class="adaptation-item-meta">${escapeHtml(meta)}</span>` : ''}
                </div>
              </a>`;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (e) {
    resultDiv.innerHTML = `<div class="adaptation-result adaptation-none">Error checking adaptations: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.textContent = "Check"; btn.classList.remove("badge-adaptation-loading"); }
  }
};

// Record session duration when navigating away from chapter
async function recordReadingSession() {
  if (!state.readerSessionStart) return;
  const duration = (Date.now() - state.readerSessionStart) / 60000; // convert to minutes
  state.readerSessionStart = null;
  const chapterMeta = state.allChapters?.[state.currentChapterIndex] || null;
  try {
    await api("/api/analytics/session", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga?.id,
        mangaTitle: state.currentManga?.title || '',
        chapterId: state.currentChapter?.id,
        chapterName: state.currentChapter?.name || '',
        chapterNumber: chapterMeta?.chapter || '',
        chaptersRead: 1,
        duration: Math.round(duration * 10) / 10
      })
    });
    await checkAndUnlockAchievements();
  } catch (e) { /* non-fatal */ }
}

