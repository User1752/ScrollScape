// ============================================================================
// HISTORY VIEW
// ============================================================================

const _historyChapterNameCache = new Map();

async function _hydrateHistoryChapterNames(container) {
  if (!container) return;
  const rows = [...container.querySelectorAll('.history-item[data-manga-id][data-source-id][data-chapter-id]')];
  const targets = rows.filter(row => {
    const sid = String(row.dataset.sourceId || '').trim();
    const cid = String(row.dataset.chapterId || '').trim();
    const hasName = String(row.dataset.chapterName || '').trim();
    return !!(sid && cid && !hasName);
  });
  if (!targets.length) return;

  const buckets = new Map();
  for (const row of targets) {
    const key = `${row.dataset.sourceId}:${row.dataset.mangaId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  for (const [key, group] of buckets.entries()) {
    const sep = key.indexOf(':');
    const sourceId = key.slice(0, sep);
    const mangaId = key.slice(sep + 1);
    try {
      let idToName = _historyChapterNameCache.get(key);
      if (!idToName) {
        const r = await api(`/api/source/${encodeURIComponent(sourceId)}/chapters`, {
          method: 'POST',
          body: JSON.stringify({ mangaId })
        });
        idToName = new Map((r?.chapters || []).map(ch => [String(ch.id), ch.name || `Chapter ${ch.chapter || '?'}`]));
        _historyChapterNameCache.set(key, idToName);
      }

      for (const row of group) {
        const cid = String(row.dataset.chapterId || '');
        const name = idToName.get(cid);
        if (!name) continue;
        row.dataset.chapterName = name;
        const label = row.querySelector('.history-last-chapter');
        if (label) label.textContent = `Stopped at: ${name}`;
      }
    } catch (_) {
      // Keep fallback text.
    }
  }
}

function renderHistoryView() {
  const container = $("historyList");
  if (!container) return;
  const history = (state.history || []).filter(m => !(state.settings.hideNsfw && isNsfwManga(m)));
  if (!history.length) {
    container.innerHTML = `<div class="muted" style="text-align:center;padding:3rem 0">No reading history yet.</div>`;
    return;
  }
  container.innerHTML = history.map(m => {
    const coverUrl = normalizeImageUrl(m.cover);
    const genres = (m.genres || []).slice(0, 3);
    const date   = m.readAt ? new Date(m.readAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "";
    const chapterName = String(m.chapterName || '').trim();
    const chapterId = String(m.chapterId || '').trim();
    const chapterLabel = chapterName || (chapterId ? `Chapter ${chapterId}` : '');
    return `
      <div class="history-item" data-manga-id="${escapeHtml(m.id)}" data-source-id="${escapeHtml(m.sourceId || "")}" data-chapter-id="${escapeHtml(chapterId)}" data-chapter-name="${escapeHtml(chapterName)}">
        <div class="history-cover">
          ${coverUrl && !coverUrl.endsWith('.pdf') ? `<img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(m.title)}" loading="lazy" decoding="async">` : (m.cover ? `<div class="no-cover">&#128196;</div>` : `<div class="no-cover">?</div>`) }
        </div>
        <div class="history-info">
          <h3 class="history-title">${escapeHtml(m.title)}</h3>
          ${m.author ? `<p class="history-author">${escapeHtml(m.author)}</p>` : ""}
          ${genres.length ? `<div class="history-genres">${genres.map(g => `<span class="manga-card-genre">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
          ${chapterLabel ? `<p class="history-last-chapter">Stopped at: ${escapeHtml(chapterLabel)}</p>` : ""}
          ${date ? `<p class="history-date">${date}</p>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn history-view-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">View Details</button>
          <button class="btn btn-start-reading-detail history-read-btn" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">${state.lastReadChapter?.[m.id] ? '&#9654; Continue Reading' : '&#9654; Start Reading'}</button>
          <button class="history-delete-btn" title="Remove from history" data-mid="${escapeHtml(m.id)}" data-sid="${escapeHtml(m.sourceId || '')}">[x]</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".history-view-btn").forEach(btn => {
    btn.onclick = () => {
      const sid = btn.dataset.sid;
      if (sid && state.installedSources[sid]) {
        state.currentSourceId = sid;
        renderSourceSelect();
      }
      loadMangaDetails(btn.dataset.mid);
    };
  });
  container.querySelectorAll(".history-read-btn").forEach(btn => {
    btn.onclick = () => continueReading(btn.dataset.mid, btn.dataset.sid);
  });
  container.querySelectorAll(".history-delete-btn").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api("/api/history/remove", {
          method: "POST",
          body: JSON.stringify({ mangaId: btn.dataset.mid, sourceId: btn.dataset.sid })
        });
        state.history = state.history.filter(m => !(m.id === btn.dataset.mid && m.sourceId === (btn.dataset.sid || m.sourceId)));
        renderHistoryView();
      } catch (e) { showToast("Error", e.message, "error"); }
    };
  });

  _hydrateHistoryChapterNames(container);
}

