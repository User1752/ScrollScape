// ============================================================================
// modules/anilist.js — AniList OAuth, GraphQL helpers, and Tracker Modal
//
// Depends on (loaded before this file by index.html):
//   modules/api.js      → api()
//   modules/state.js    → state
//   modules/utils.js    → $(), escapeHtml(), showToast()
//
// References at call-time (from app.js, loaded after):
//   renderLibrary()
// ============================================================================

// ── localStorage helpers ─────────────────────────────────────────────────────
function _alToken()         { return localStorage.getItem('scrollscape_anilist_token') || null; }
function _alSetToken(t)     { localStorage.setItem('scrollscape_anilist_token', t); }
function _alUser()          { try { return JSON.parse(localStorage.getItem('scrollscape_anilist_user') || 'null'); } catch { return null; } }
function _alClientId()      { return localStorage.getItem('scrollscape_anilist_clientid') || ''; }
function _alSetClientId(id) { localStorage.setItem('scrollscape_anilist_clientid', id); }
function _alDisconnect() {
  localStorage.removeItem('scrollscape_anilist_token');
  localStorage.removeItem('scrollscape_anilist_user');
}
function _alGetLink(mangaId) {
  try { return JSON.parse(localStorage.getItem('scrollscape_al_links') || '{}')[mangaId] || null; } catch (e) {
    dbg.warn(dbg.ERR_ANILIST, '_alGetLink: failed to read localStorage', e);
    return null;
  }
}
function _alSetLink(mangaId, anilistId) {
  try {
    const l = JSON.parse(localStorage.getItem('scrollscape_al_links') || '{}');
    l[mangaId] = anilistId;
    localStorage.setItem('scrollscape_al_links', JSON.stringify(l));
  } catch (e) {
    dbg.warn(dbg.ERR_ANILIST, '_alSetLink: failed to write localStorage', e);
  }
}

// ── GraphQL helper ────────────────────────────────────────────────────────────
async function anilistGQL(query, variables) {
  const token = _alToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/anilist', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  // AniList returns a valid JSON body even on 4xx (errors array inside).
  // Parse it regardless so callers can inspect data.errors.
  let body;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok && !body) throw new Error(`AniList HTTP ${res.status}`);
  return body;
}

async function anilistFetchViewer() {
  const data = await anilistGQL('query { Viewer { id name avatar { medium } } }');
  return data?.data?.Viewer || null;
}

async function anilistSearchMedia(title) {
  const data = await anilistGQL(
    'query ($s: String) { Media(search: $s, type: MANGA) { id } }',
    { s: title }
  );
  return data?.data?.Media?.id || null;
}

async function anilistSyncProgress(mangaTitle, chapterNum) {
  if (!_alToken() || !state.settings.anilistAutoSync) return;
  try {
    const mediaId = await anilistSearchMedia(mangaTitle);
    if (!mediaId) return;
    const progress = parseInt(chapterNum, 10);
    if (isNaN(progress) || progress < 0) return;
    await anilistGQL(
      'mutation ($m: Int, $p: Int) { SaveMediaListEntry(mediaId: $m, status: CURRENT, progress: $p) { id } }',
      { m: mediaId, p: progress }
    );
  } catch (e) {
    dbg.warn(dbg.ERR_ANILIST, 'Sync failed', e);
  }
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
function anilistOAuthConnect() {
  const clientId = _alClientId();
  if (!clientId) { showToast('AniList', 'Enter your Client ID first.', 'warning'); return; }
  window.location.href =
    `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token`;
}

async function anilistHandleCallback() {
  if (!window.location.hash.includes('access_token=')) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  if (!token) return;
  history.replaceState(null, '', window.location.pathname);
  _alSetToken(token);
  try {
    const viewer = await anilistFetchViewer();
    if (viewer) {
      localStorage.setItem('scrollscape_anilist_user', JSON.stringify({
        id: viewer.id, name: viewer.name, avatar: viewer.avatar?.medium || ''
      }));
      showToast('AniList Connected', `Welcome, ${viewer.name}!`, 'success');
      // Auto-import if the user has the toggle enabled
      if (state.settings.anilistAutoImportOnConnect) {
        setTimeout(() => anilistImportLibrary(), 800);
      }
    }
  } catch (_) {
    showToast('AniList', 'Connected but could not fetch profile.', 'warning');
  }
}

// ============================================================================
// ANILIST LIBRARY IMPORT
// ============================================================================

let _anilistImportInProgress = false;

const _AL_IMPORT_LIMITS = {
  resolveEntriesMax: 80,
  resolveBatch: 2,
  progressMax: 30,
  progressDelayMs: 140,
};

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _parseChapterNumber(ch) {
  const raw = String(ch?.chapter ?? ch?.name ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function _oldestFirstChapters(chapters) {
  if (!Array.isArray(chapters) || chapters.length <= 1) return chapters || [];

  const rows = chapters.map((c, i) => ({ c, i, n: _parseChapterNumber(c) }));
  const numericCount = rows.filter(r => r.n !== null).length;
  const mostlyNumeric = numericCount >= Math.max(2, Math.floor(chapters.length * 0.5));

  if (mostlyNumeric) {
    return [...rows]
      .sort((a, b) => {
        if (a.n === null && b.n === null) return a.i - b.i;
        if (a.n === null) return 1;
        if (b.n === null) return -1;
        if (a.n !== b.n) return a.n - b.n;
        return a.i - b.i;
      })
      .map(r => r.c);
  }

  // Most sources return chapters newest-first; reverse as a fallback.
  return [...chapters].reverse();
}

async function _applyImportedProgress(entries, resolutionMap, opts = {}) {
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const entriesByAnilistId = new Map(entries.map(en => [String(en.anilistId), en]));
  const targets = [];
  for (const [anilistId, resolved] of resolutionMap.entries()) {
    const entry = entriesByAnilistId.get(String(anilistId));
    const p = Number(entry?.progress || 0);
    if (!entry || !resolved?.mangaId || !resolved?.sourceId || resolved.sourceId === 'anilist') continue;
    if (!Number.isFinite(p) || p <= 0) continue;
    targets.push({
      mangaId: resolved.mangaId,
      sourceId: resolved.sourceId,
      progress: Math.max(0, Math.floor(p)),
    });
  }

  if (!targets.length) return { updated: 0, total: 0 };

  if (!state.readChapters) state.readChapters = new Set();
  if (!state.lastReadPages) state.lastReadPages = {};
  if (!state.lastReadChapter) state.lastReadChapter = {};
  if (!state.highestReadChapter) state.highestReadChapter = {};

  let idx = 0;
  let processed = 0;
  let updated = 0;
  const queue = targets.slice(0, _AL_IMPORT_LIMITS.progressMax);
  const concurrency = Math.min(1, queue.length);
  let rateLimited = false;

  const isRateLimitError = (e) => {
    const msg = String(e?.message || '').toLowerCase();
    return msg.includes('429') || msg.includes('too many requests') || msg.includes('slow down');
  };

  async function worker() {
    while (idx < queue.length && !rateLimited) {
      const item = queue[idx++];
      try {
        const cr = await api(`/api/source/${item.sourceId}/chapters`, {
          method: 'POST',
          body: JSON.stringify({ mangaId: item.mangaId })
        });
        const chapters = cr?.chapters || [];
        if (!chapters.length) continue;

        const ordered = _oldestFirstChapters(chapters).filter(ch => ch?.id);
        if (!ordered.length) continue;

        const picked = ordered.slice(0, Math.min(item.progress, ordered.length));
        if (!picked.length) continue;

        for (const ch of picked) state.readChapters.add(`${item.mangaId}:${ch.id}`);

        const last = picked[picked.length - 1];
        state.lastReadChapter[item.mangaId] = last.id;
        state.lastReadPages[`${item.mangaId}:${last.id}`] = 0;

        const highestByData = picked.reduce((mx, ch) => {
          const n = _parseChapterNumber(ch);
          return (n !== null && n > mx) ? n : mx;
        }, 0);
        const best = highestByData > 0 ? highestByData : item.progress;
        state.highestReadChapter[item.mangaId] = Math.max(state.highestReadChapter[item.mangaId] || 0, best);

        updated++;
        processed++;
        if (onProgress) onProgress({ phase: 'progress-sync', processed, total: queue.length, updated, rateLimited: false });
        if (_AL_IMPORT_LIMITS.progressDelayMs > 0) {
          await _sleep(_AL_IMPORT_LIMITS.progressDelayMs);
        }
      } catch (e) {
        if (isRateLimitError(e)) {
          rateLimited = true;
          if (onProgress) onProgress({ phase: 'progress-sync', processed, total: queue.length, updated, rateLimited: true });
          break;
        }
        dbg.warn(dbg.ERR_ANILIST, 'Progress import failed for a manga', e);
        processed++;
        if (onProgress) onProgress({ phase: 'progress-sync', processed, total: queue.length, updated, rateLimited: false });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (updated > 0 && typeof saveSettings === 'function') saveSettings();
  return { updated, total: queue.length, rateLimited };
}

/**
 * For each AniList entry, search all installed sources and return the best
 * match (most chapters) as a resolution record. Processes in batches of 5
 * to avoid flooding the server.
 * @param {Array<{anilistId, title, cover}>} entries
 * @returns {Promise<Array<{anilistId, mangaId, sourceId, title, cover, lastChapter}>>}
 */
async function _resolveAnilistSources(entries, opts = {}) {
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  let stateData;
  try { stateData = await api('/api/state'); } catch (_) { return []; }
  const sourceIds = Object.keys(stateData?.installedSources || {});
  if (!sourceIds.length) return [];

  const BATCH = _AL_IMPORT_LIMITS.resolveBatch;
  const cappedEntries = entries.slice(0, _AL_IMPORT_LIMITS.resolveEntriesMax);
  const resolutions = [];
  let rateLimited = false;
  let processed = 0;

  const isRateLimitResponse = (res) => res && !res.ok && res.status === 429;

  for (let i = 0; i < cappedEntries.length && !rateLimited; i += BATCH) {
    const chunk = cappedEntries.slice(i, i + BATCH);
    const chunkResults = await Promise.all(chunk.map(async (entry) => {
      const searches = await Promise.allSettled(
        sourceIds.map(async (sid) => {
          try {
            const res = await fetch(`/api/source/${encodeURIComponent(sid)}/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: entry.title, page: 1 }),
            });
            if (isRateLimitResponse(res)) {
              rateLimited = true;
              return null;
            }
            if (!res.ok) return null;
            const r = await res.json();
            const first = (r?.results || [])[0];
            if (!first) return null;
            return { sid, manga: first };
          } catch (_) { return null; }
        })
      );

      // Pick the source whose first result has the most chapters
      let best = null;
      for (const s of searches) {
        if (s.status !== 'fulfilled' || !s.value) continue;
        const { sid, manga } = s.value;
        const chaps = manga.lastChapter || 0;
        if (!best || chaps > (best.lastChapter || 0)) {
          best = {
            anilistId:   entry.anilistId,
            mangaId:     manga.id,
            sourceId:    sid,
            title:       manga.title,
            cover:       manga.cover || entry.cover,
            lastChapter: chaps,
          };
        }
      }
      return best; // null if no source returned any result
    }));

    resolutions.push(...chunkResults.filter(Boolean));
    processed += chunk.length;
    if (onProgress) onProgress({ phase: 'resolve-sources', processed, total: cappedEntries.length, rateLimited: false });
    if (!rateLimited) await _sleep(120);
  }

  if (rateLimited && onProgress) onProgress({ phase: 'resolve-sources', processed, total: cappedEntries.length, rateLimited: true });

  return {
    resolutions,
    rateLimited,
    capped: entries.length > cappedEntries.length,
  };
}

/**
 * Fetch the authenticated user's full MANGA list from AniList and bulk-apply
 * it to the local library. AniList data always wins over local data.
 */
async function anilistImportLibrary(opts = {}) {
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const report = (percent, label, extra = {}) => {
    if (!onProgress) return;
    try {
      onProgress({ percent: Math.max(0, Math.min(100, Math.floor(percent))), label, ...extra });
    } catch (_) {}
  };

  if (!_alToken()) {
    showToast('AniList', 'Connect your AniList account first.', 'warning');
    return { ok: false, reason: 'not-connected' };
  }
  if (_anilistImportInProgress) {
    showToast('AniList Import', 'Import already in progress…', 'warning');
    return { ok: false, reason: 'in-progress' };
  }
  _anilistImportInProgress = true;
  report(2, 'Fetching AniList library…');
  showToast('AniList Import', 'Fetching your AniList library…', 'info');

  const FETCH_QUERY = `
    query ($userId: Int) {
      MediaListCollection(userId: $userId, type: MANGA) {
        lists {
          entries {
            status
            progress
            score(format: POINT_10)
            media {
              id
              title { english romaji }
              coverImage { large medium }
            }
          }
        }
      }
    }
  `;

  try {
    const user = _alUser();
    const userId = user?.id || null;
    const data = await anilistGQL(FETCH_QUERY, userId ? { userId } : {});

    if (data?.errors?.length) {
      throw new Error(data.errors[0]?.message || 'AniList GraphQL error');
    }

    const lists = data?.data?.MediaListCollection?.lists || [];
    const entries = [];
    for (const list of lists) {
      for (const entry of (list.entries || [])) {
        const media = entry.media;
        if (!media?.id) continue;
        entries.push({
          anilistId: media.id,
          title:     media.title?.english || media.title?.romaji || `Manga #${media.id}`,
          cover:     media.coverImage?.large || media.coverImage?.medium || '',
          status:    entry.status || '',
          progress:  entry.progress || 0,
          score:     entry.score || 0,
        });
      }
    }

    if (entries.length === 0) {
      showToast('AniList Import', 'No MANGA entries found in your list.', 'info');
      _anilistImportInProgress = false;
      report(100, 'No manga found on AniList.');
      return { ok: true, imported: 0, overwritten: 0, progressSynced: 0 };
    }

    report(15, `Fetched ${entries.length} entries`);
    showToast('AniList Import', `Importing ${entries.length} entries…`, 'info');
    report(22, 'Applying AniList library to ScrollScape…');
    const result = await fetch('/api/anilist/import-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    }).then(r => r.json());

    if (!result.ok) throw new Error(result.error || 'Import failed');
    report(40, 'Library import applied');

    // Refresh in-memory library state
    try {
      const libData = await fetch('/api/library').then(r => r.json());
      state.favorites    = libData.favorites || state.favorites;
      state.history      = libData.history   || state.history;
      const statusData = await fetch('/api/user/status').then(r => r.json());
      state.readingStatus = statusData.readingStatus || state.readingStatus;
      // Update anilistSync metadata so Settings reflects the new import immediately
      state.anilistSync = {
        lastImportAt:   result.syncedAt,
        importedCount:  result.imported,
        overwriteCount: result.overwritten,
        skippedCount:   result.skipped || 0,
        failedCount:    result.failed,
      };
      renderLibrary();
    } catch (_) { /* non-fatal — UI will refresh on next navigation */ }

    // Source resolution — find the source with the most chapters for each manga
    const resolutionMap = new Map(); // String(anilistId) → { mangaId, sourceId, cover }
    try {
      showToast('AniList Import', `Resolving sources for ${entries.length} manga…`, 'info');
      report(45, 'Resolving best source per manga…');
      const resolveResult = await _resolveAnilistSources(entries, {
        onProgress: (p) => {
          const ratio = p.total ? p.processed / p.total : 1;
          report(45 + Math.round(ratio * 25), `Resolving sources ${p.processed}/${p.total || 0}`);
        }
      });
      const resolutions = resolveResult.resolutions || [];
      if (resolutions.length > 0) {
        await api('/api/anilist/resolve-apply', {
          method: 'POST',
          body: JSON.stringify({ resolutions }),
        });
        for (const r of resolutions) {
          resolutionMap.set(String(r.anilistId), { mangaId: r.mangaId, sourceId: r.sourceId, cover: r.cover });
        }
        // Refresh state with real source entries
        try {
          const libData2 = await fetch('/api/library').then(r => r.json());
          state.favorites     = libData2.favorites || state.favorites;
          state.readingStatus = (await fetch('/api/user/status').then(r => r.json())).readingStatus || state.readingStatus;
          renderLibrary();
        } catch (_) {}
      }

      if (resolveResult.rateLimited) {
        showToast('AniList Import', 'Rate limit reached while resolving sources. Continuing with partial sync.', 'warning');
      } else if (resolveResult.capped) {
        showToast('AniList Import', `Resolved first ${_AL_IMPORT_LIMITS.resolveEntriesMax} entries to keep import stable.`, 'info');
      }
    } catch (resErr) {
      dbg.error(dbg.ERR_ANILIST, 'Source resolution failed', resErr);
    }

    // Import chapter progress from AniList into local chapter/read state.
    // Example: progress=20 marks first 20 chapters as read and sets last read chapter.
    let progressStats = { updated: 0, total: 0, rateLimited: false };
    try {
      report(72, 'Syncing chapter progress…');
      progressStats = await _applyImportedProgress(entries, resolutionMap, {
        onProgress: (p) => {
          const ratio = p.total ? p.processed / p.total : 1;
          report(72 + Math.round(ratio * 18), `Syncing progress ${p.processed}/${p.total || 0}`);
        }
      });
    } catch (progErr) {
      dbg.error(dbg.ERR_ANILIST, 'Progress import failed', progErr);
    }

    // Auto-categorize: add COMPLETED manga to a "Read" category if enabled
    if (state.settings.anilistAutoCategorize) {
      report(92, 'Applying categories…');
      const completedEntries = entries.filter(en => (en.status || '').toUpperCase() === 'COMPLETED');
      if (completedEntries.length > 0) {
        try {
          // Find or create the "Read" list
          let listsData = await api('/api/lists');
          state.customLists = listsData.lists || [];
          let readList = state.customLists.find(l => l.name.toLowerCase() === 'read');
          if (!readList) {
            const created = await api('/api/lists', {
              method: 'POST',
              body: JSON.stringify({ name: 'Read', description: 'Manga imported as Completed from AniList' }),
            });
            readList = created.list;
            listsData = await api('/api/lists');
            state.customLists = listsData.lists || [];
          }

          // Batch-assign each completed manga to the Read list
          for (const en of completedEntries) {
            // Prefer resolved source entry; fall back to anilist placeholder
            const resolved = resolutionMap.get(String(en.anilistId));
            const mangaId  = resolved ? String(resolved.mangaId)  : String(en.anilistId);
            const sourceId = resolved ? resolved.sourceId         : 'anilist';
            const cover    = resolved ? (resolved.cover || en.cover) : en.cover;
            // Get current categories so we don't lose existing ones
            let curCatIds = [];
            try {
              const d = await api(`/api/lists/manga/${encodeURIComponent(mangaId)}/categories?sourceId=${encodeURIComponent(sourceId)}`);
              curCatIds = d.categoryIds || [];
            } catch (_) {}
            if (!curCatIds.includes(readList.id)) {
              curCatIds = [...curCatIds, readList.id];
              const payload = {
                mangaId,
                sourceId,
                categoryIds: curCatIds,
                mangaData: { id: mangaId, title: en.title, cover, sourceId },
              };
              try {
                await api('/api/lists/manga-categories', {
                  method: 'PUT',
                  body: JSON.stringify(payload),
                });
              } catch (err) {
                const msg = String(err?.message || '').toLowerCase();
                const isRouteConflict = msg.includes('list not found') || msg.includes('category not found');
                if (!isRouteConflict) throw err;

                const current = await api(`/api/lists/manga/${encodeURIComponent(payload.mangaId)}/categories?sourceId=${encodeURIComponent(payload.sourceId)}`);
                const currentIds = new Set(current.categoryIds || []);
                const freshLists = await api('/api/lists');
                const validIds = new Set((freshLists.lists || []).map(l => l.id));
                const targetIds = new Set((payload.categoryIds || []).filter(id => validIds.has(id)));

                const toAdd = [...targetIds].filter(id => !currentIds.has(id));
                const toRemove = [...currentIds].filter(id => !targetIds.has(id));

                for (const listId of toAdd) {
                  await api(`/api/lists/${encodeURIComponent(listId)}/manga`, {
                    method: 'POST',
                    body: JSON.stringify({ mangaData: payload.mangaData }),
                  });
                }
                for (const listId of toRemove) {
                  await api(`/api/lists/${encodeURIComponent(listId)}/manga/${encodeURIComponent(payload.mangaId)}`, {
                    method: 'DELETE',
                  });
                }
              }
            }
          }

          // Reload lists and refresh library chips
          const finalLists = await api('/api/lists');
          state.customLists = finalLists.lists || [];
          renderLibrary();
        } catch (catErr) {
          dbg.error(dbg.ERR_ANILIST, 'Auto-categorize failed', catErr);
        }
      }
    }

    const parts = [];
    if (result.imported)    parts.push(`${result.imported} new`);
    if (result.overwritten) parts.push(`${result.overwritten} updated`);
    if (progressStats.updated) parts.push(`${progressStats.updated} progress synced`);
    if (progressStats.rateLimited) parts.push('progress paused (rate limit)');
    if (result.failed)      parts.push(`${result.failed} failed`);
    showToast('Import Complete', parts.join(' · ') || 'Nothing to import', result.failed ? 'warning' : 'success');
    report(100, 'Import complete');

    return {
      ok: true,
      imported: result.imported || 0,
      overwritten: result.overwritten || 0,
      progressSynced: progressStats.updated || 0,
      rateLimited: !!progressStats.rateLimited,
    };

  } catch (err) {
    dbg.error(dbg.ERR_ANILIST, 'anilistImportLibrary failed', err);
    showToast('AniList Import', err.message || 'Import failed. Check your connection.', 'error');
    report(100, `Import failed: ${err.message || 'unknown error'}`);
    return { ok: false, error: err.message || 'Import failed' };
  } finally {
    _anilistImportInProgress = false;
  }
}



async function showTrackerModal(manga) {
  document.querySelector('.tracker-modal')?.remove();

  const AL_STATUSES = [
    ['CURRENT',   'Reading'],
    ['COMPLETED', 'Completed'],
    ['PAUSED',    'On Hold'],
    ['DROPPED',   'Dropped'],
    ['PLANNING',  'Plan to Read'],
    ['REPEATING', 'Rereading'],
  ];

  // Hide sidebar for more room
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.visibility = 'hidden';

  const modal = document.createElement('div');
  modal.className = 'tracker-modal';
  const closeModal = () => {
    if (sidebar) sidebar.style.visibility = '';
    modal.remove();
  };
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.body.appendChild(modal);

  // Build modal shell once: left sidebar (current manga) + right main panel
  const currentCover = manga.cover && !manga.cover.endsWith('.pdf') ? manga.cover : null;
  modal.innerHTML = `
    <div class="tracker-content">
      <div class="tracker-header">
        <h3 class="tracker-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle;margin-right:7px"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>AniList Tracker
        </h3>
        <button class="btn secondary tracker-close" id="closeTrackerBtn">&#x2715;</button>
      </div>
      <div class="tracker-layout">
        <div class="tracker-sidebar">
          <div class="tracker-sidebar-cover">
            ${currentCover
              ? `<img src="${escapeHtml(currentCover)}" alt="${escapeHtml(manga.title)}" loading="lazy">`
              : `<div class="tracker-sidebar-no-cover">?</div>`}
          </div>
          <p class="tracker-sidebar-title">${escapeHtml(manga.title)}</p>
          <p class="tracker-sidebar-hint">Find on AniList &rarr;</p>
        </div>
        <div class="tracker-main" id="trackerMain">
          <div class="muted" style="padding:2rem 0;text-align:center">Searching AniList…</div>
        </div>
      </div>
    </div>`;
  modal.querySelector('#closeTrackerBtn').onclick = () => closeModal();

  // render() updates only the right-side main panel
  const render = (html) => {
    document.getElementById('trackerMain').innerHTML = html;
  };

  if (!_alToken()) {
    render(`<p class="tracker-info-msg">Connect your AniList account in <strong>Settings &rarr; Tracking</strong> to use this feature.</p>`);
    return;
  }

  const fmtDate = (fd) => {
    if (!fd?.year) return '';
    const m = String(fd.month || 1).padStart(2, '0');
    const d = String(fd.day  || 1).padStart(2, '0');
    return `${fd.year}-${m}-${d}`;
  };
  const parseDate = (str) => {
    if (!str) return null;
    const [y, mo, d] = str.split('-').map(Number);
    return { year: y || null, month: mo || null, day: d || null };
  };

  const SEARCH_QUERY = `query ($s: String) {
    Page(perPage: 16) {
      media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { large medium }
        format
        status
        startDate { year }
      }
    }
  }`;

  const ENTRY_QUERY = `query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      title { romaji english }
      mediaListEntry {
        id status progress score(format: POINT_10_DECIMAL)
        startedAt   { year month day }
        completedAt { year month day }
      }
    }
  }`;

  const buildPickerHtml = (results, searchTitle) => {
    const noResultsMsg = !results.length
      ? `<p class="tracker-info-msg">No results for "${escapeHtml(searchTitle)}".</p>`
      : '';
    return `
      <div class="tracker-search-bar">
        <input type="text" id="trRetryInput" class="input" value="${escapeHtml(searchTitle)}" placeholder="Search AniList…">
        <button class="btn primary" id="trRetryBtn">Search</button>
      </div>
      ${noResultsMsg}
      ${results.length ? `<div class="tracker-picker" id="trackerPicker">
        ${results.map(m => {
          const title = m.title?.english || m.title?.romaji || m.title?.native || '';
          const fmt   = m.format ? m.format.replace(/_/g, ' ') : '';
          const yr    = m.startDate?.year || '';
          const cover = m.coverImage?.large || m.coverImage?.medium || '';
          return `<button class="tracker-pick-item" data-id="${m.id}" title="${escapeHtml(title)}">
            <div class="tracker-pick-cover">${cover
              ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">`
              : '<div class="tracker-pick-no-cover">?</div>'}
            </div>
            <div class="tracker-pick-info">
              <span class="tracker-pick-title">${escapeHtml(title)}</span>
              <span class="tracker-pick-meta">${[fmt, yr].filter(Boolean).join(' · ')}</span>
            </div>
          </button>`;
        }).join('')}
      </div>` : ''}`;
  };

  const buildFormHtml = (media) => {
    const entry = media.mediaListEntry;
    const displayTitle = media.title?.english || media.title?.romaji || manga.title;
    // Auto-fill progress from local reading history (persisted highest chapter per manga)
    const _localHighest = state.highestReadChapter?.[manga.id] || 0;
    const progressValue = Math.max(entry?.progress ?? 0, _localHighest) || '';
    return `
      <button type="button" class="btn secondary tracker-back-btn" id="trBackBtn">&#8592; Back to results</button>
      <div class="tracker-media-title">${escapeHtml(displayTitle)}</div>
      <form class="tracker-form" id="trackerForm" onsubmit="return false">
        <div class="tracker-field">
          <label class="tracker-label">Status</label>
          <select id="trStatus" class="input tracker-select">
            <option value="">— Not tracked —</option>
            ${AL_STATUSES.map(([v, l]) =>
              `<option value="${v}"${entry?.status === v ? ' selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div class="tracker-field">
          <label class="tracker-label">Chapter Progress</label>
          <input type="number" id="trProgress" class="input" min="0" step="1"
            value="${progressValue}" placeholder="0">
        </div>
        <div class="tracker-field">
          <label class="tracker-label">Score (0 – 10)</label>
          <input type="number" id="trScore" class="input" min="0" max="10" step="0.5"
            value="${entry?.score ?? ''}" placeholder="0">
        </div>
        <div class="tracker-dates">
          <div class="tracker-field">
            <label class="tracker-label">Start Date</label>
            <input type="date" id="trStart" class="input" value="${fmtDate(entry?.startedAt)}">
          </div>
          <div class="tracker-field">
            <label class="tracker-label">End Date</label>
            <input type="date" id="trEnd" class="input" value="${fmtDate(entry?.completedAt)}">
          </div>
        </div>
        <div class="tracker-footer">
          <div class="tracker-footer-left">
            ${entry ? `<button type="button" class="btn tracker-remove-btn" id="trRemoveBtn">Remove</button>` : ''}
          </div>
          <div class="tracker-footer-right">
            <p class="tracker-msg" id="trMsg"></p>
            <button type="submit" class="btn primary" id="trSaveBtn">Save to AniList</button>
          </div>
        </div>
      </form>`;
  };

  // Wire form interactivity (called after form is in the DOM)
  const wireForm = (media, results, searchTitle) => {
    document.getElementById('trBackBtn')?.addEventListener('click', () => {
      render(buildPickerHtml(results, searchTitle));
      wirePicker(results, searchTitle, media.id);
    });
    const entry = media.mediaListEntry;
    document.getElementById('trStatus').onchange = () => {
      const st = document.getElementById('trStatus').value;
      const startEl = document.getElementById('trStart');
      if ((st === 'CURRENT' || st === 'REPEATING') && !startEl.value) startEl.value = new Date().toISOString().slice(0, 10);
      if (st === 'COMPLETED') { const endEl = document.getElementById('trEnd'); if (!endEl.value) endEl.value = new Date().toISOString().slice(0, 10); }
    };
    document.getElementById('trSaveBtn').onclick = async () => {
      const status = document.getElementById('trStatus').value;
      if (!status) { document.getElementById('trMsg').textContent = 'Choose a status first.'; return; }
      const progress    = parseInt(document.getElementById('trProgress').value, 10) || 0;
      const score       = parseFloat(document.getElementById('trScore').value) || 0;
      const startedAt   = parseDate(document.getElementById('trStart').value);
      const completedAt = parseDate(document.getElementById('trEnd').value);
      const saveBtn = document.getElementById('trSaveBtn');
      saveBtn.disabled = true;
      document.getElementById('trMsg').textContent = 'Saving…';
      document.getElementById('trMsg').className = 'tracker-msg';
      try {
        const saveRes = await anilistGQL(
          `mutation ($m: Int, $st: MediaListStatus, $prog: Int, $sc: Float, $start: FuzzyDateInput, $end: FuzzyDateInput) {
            SaveMediaListEntry(mediaId: $m, status: $st, progress: $prog, score: $sc, startedAt: $start, completedAt: $end) { id }
          }`,
          { m: media.id, st: status, prog: progress, sc: score, start: startedAt, end: completedAt }
        );
        if (saveRes?.errors?.length) throw new Error(saveRes.errors[0].message);
        _alSetLink(manga.id, media.id);
        const _tBtn = document.getElementById('trackerBtn');
        if (_tBtn) { _tBtn.innerHTML = 'Tracker \u2713'; _tBtn.classList.add('btn-tracker--tracked'); }
        document.getElementById('trMsg').textContent = '\u2713 Saved!';
        document.getElementById('trMsg').className = 'tracker-msg tracker-msg-ok';
        setTimeout(() => closeModal(), 900);
      } catch (err) {
        document.getElementById('trMsg').textContent = `Error: ${err.message}`;
        document.getElementById('trMsg').className = 'tracker-msg tracker-msg-err';
        saveBtn.disabled = false;
      }
    };
    if (entry) {
      document.getElementById('trRemoveBtn').onclick = async () => {
        if (!confirm('Remove this manga from your AniList?')) return;
        document.getElementById('trRemoveBtn').disabled = true;
        try {
          await anilistGQL(`mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }`, { id: entry.id });
          showToast('AniList', 'Removed from list.', 'info');
          closeModal();
        } catch (err) {
          showToast('AniList Error', err.message, 'error');
          document.getElementById('trRemoveBtn').disabled = false;
        }
      };
    }
  };

  const wirePicker = (results, searchTitle, selectedId = null) => {
    const retryBtn = document.getElementById('trRetryBtn');
    const retryInput = document.getElementById('trRetryInput');
    if (retryBtn) retryBtn.onclick = () => { const v = retryInput?.value.trim(); if (v) searchAndPick(v); };
    if (retryInput) retryInput.onkeydown = (e) => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) searchAndPick(v); } };
    document.getElementById('trackerPicker')?.querySelectorAll('.tracker-pick-item').forEach(btn => {
      if (String(selectedId) === btn.dataset.id) btn.classList.add('tracker-pick-item--selected');
      btn.onclick = async () => {
        const id = parseInt(btn.dataset.id, 10);
        document.querySelectorAll('.tracker-pick-item').forEach(b => b.classList.remove('tracker-pick-item--selected'));
        btn.classList.add('tracker-pick-item--selected');
        render(`<div class="muted" style="padding:2rem 0;text-align:center">Loading…</div>`);
        try {
          const r = await anilistGQL(ENTRY_QUERY, { id });
          const m = r?.data?.Media;
          if (m) { render(buildFormHtml(m)); wireForm(m, results, searchTitle); }
          else render(`<p class="tracker-info-msg">Could not load entry.</p>`);
        } catch (err) { render(`<p class="tracker-info-msg">Error: ${escapeHtml(err.message)}</p>`); }
      };
    });
  };

  const searchAndPick = async (searchTitle) => {
    render(`<div class="muted" style="padding:2rem 0;text-align:center">Searching AniList…</div>`);
    try {
      const gqlResult = await anilistGQL(SEARCH_QUERY, { s: searchTitle });
      const results = gqlResult?.data?.Page?.media || [];
      render(buildPickerHtml(results, searchTitle));
      wirePicker(results, searchTitle);
    } catch (err) {
      render(`<p class="tracker-info-msg">Error: ${escapeHtml(err.message)}</p>
        <div class="tracker-search-bar" style="margin-top:.5rem">
          <input type="text" id="trRetryInput" class="input" value="${escapeHtml(searchTitle)}" placeholder="Search AniList…">
          <button class="btn primary" id="trRetryBtn">Search</button>
        </div>`);
      document.getElementById('trRetryBtn').onclick = () => { const v = document.getElementById('trRetryInput').value.trim(); if (v) searchAndPick(v); };
    }
  };

  try {
    const linkedId = _alGetLink(manga.id);
    if (linkedId) {
      // Already tracked — skip search, load form directly for the linked AniList entry
      const r = await anilistGQL(ENTRY_QUERY, { id: linkedId });
      const m = r?.data?.Media;
      if (m) { render(buildFormHtml(m)); wireForm(m, [], manga.title); }
      else {
        // Stale link — fallback to search
        const gqlResult = await anilistGQL(SEARCH_QUERY, { s: manga.title });
        const results = gqlResult?.data?.Page?.media || [];
        render(buildPickerHtml(results, manga.title));
        wirePicker(results, manga.title);
      }
    } else {
      const gqlResult = await anilistGQL(SEARCH_QUERY, { s: manga.title });
      const results = gqlResult?.data?.Page?.media || [];
      render(buildPickerHtml(results, manga.title));
      wirePicker(results, manga.title);
    }
  } catch (err) {
    render(`<p class="tracker-info-msg">Error: ${escapeHtml(err.message)}</p>`);
  }
}
