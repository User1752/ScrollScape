// ============================================================================
// POPULAR TODAY / RECENTLY ADDED / LATEST UPDATES
// ============================================================================

async function loadAllTimePopular() {
  const row = $("allTimePopularRow");
  if (!row) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api("/api/popular-all");
    const list = (result.results || []).filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.map(m => {
      const genres = (m.genres || []).slice(0, 2);
      const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
      return `
        <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
          <div class="manga-card-cover">
            ${m.cover && !m.cover.endsWith('.pdf')
              ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
              : `<div class="no-cover">?</div>`}
            ${m.sourceName ? `<span class="all-pop-source-badge">${escapeHtml(m.sourceName)}</span>` : ""}
          </div>
          <div class="manga-card-info">
            <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
            <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
            ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
            <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
          </div>
        </div>`;
    }).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    dbg.error(dbg.ERR_SOURCE, 'Error loading all-time popular', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/trending`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = (result.results || []).filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    row.innerHTML = list.slice(0, 10).map(m => mangaCardHTML(m)).join("");
    bindMangaCards(row);
    initRowAutoScroll(row);
  } catch (e) {
    dbg.error(dbg.ERR_SOURCE, 'Error loading popular manga', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/recentlyAdded`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = (result.results || []).filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    dbg.error(dbg.ERR_SOURCE, 'Error loading recently added', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

async function loadLatestUpdates() {
  const row = $("latestUpdatesRow");
  if (!row || !state.currentSourceId) return;
  row.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/latestUpdates`, {
      method: "POST",
      body: JSON.stringify({})
    });
    const list = (result.results || []).filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
    if (!list.length) { row.innerHTML = `<div class="muted">No manga found.</div>`; return; }
    renderMangaGrid(row, list.slice(0, 12));
    initRowAutoScroll(row);
  } catch (e) {
    dbg.error(dbg.ERR_SOURCE, 'Error loading latest updates', e);
    row.innerHTML = `<div class="muted">Error loading manga.</div>`;
  }
}

function mangaCardHTML(m) {
  const genres = (m.genres || []).slice(0, 3);
  const sourceAttr = m.sourceId ? ` data-source-id="${escapeHtml(m.sourceId)}"` : "";
  return `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}"${sourceAttr}>
      <div class="manga-card-cover">
        ${m.cover && !m.cover.endsWith('.pdf')
          ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          : (m.cover ? '<div class="no-cover">&#128196;</div>' : '<div class="no-cover">?</div>')}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        ${genres.length ? `<div class="manga-card-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
        <button class="btn-start-reading" onclick="event.stopPropagation(); startReading('${escapeHtml(m.id)}')">▶ Start Reading</button>
      </div>
    </div>
  `;
}

async function startReading(mangaId) {
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  await loadMangaDetails(mangaId);
  if (!state.allChapters?.length) { showToast("No chapters found", "", "info"); return; }
  // Chapters are sorted newest-first; last index = chapter 1
  const firstIdx = state.allChapters.length - 1;
  const ch = state.allChapters[firstIdx];
  await loadChapter(ch.id, ch.name || `Chapter ${ch.chapter || 1}`, firstIdx);
}

async function continueReading(mangaId, sourceId) {
  if (!mangaId) return;
  // Switch source if needed
  if (sourceId && state.installedSources[sourceId] && sourceId !== state.currentSourceId) {
    state.currentSourceId = sourceId;
    renderSourceSelect();
  }
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }

  const lastChapterId = state.lastReadChapter?.[mangaId];
  if (!lastChapterId) {
    // No progress yet — fall back to start reading
    await startReading(mangaId);
    return;
  }

  const lastPageIndex = state.lastReadPages?.[`${mangaId}:${lastChapterId}`] || 0;
  try {
    showToast("Resuming...", "", "info");
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.currentManga = result;
    const cr = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });
    state.allChapters = cr.chapters || [];
    const idx = state.allChapters.findIndex(c => c.id === lastChapterId);
    if (idx >= 0) {
      const ch = state.allChapters[idx];
      await loadChapter(lastChapterId, ch.name || `Chapter ${ch.chapter || idx + 1}`, idx, lastPageIndex);
    } else {
      await loadMangaDetails(mangaId);
    }
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

