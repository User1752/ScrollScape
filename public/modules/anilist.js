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
  try { return JSON.parse(localStorage.getItem('scrollscape_al_links') || '{}')[mangaId] || null; } catch { return null; }
}
function _alSetLink(mangaId, anilistId) {
  try {
    const l = JSON.parse(localStorage.getItem('scrollscape_al_links') || '{}');
    l[mangaId] = anilistId;
    localStorage.setItem('scrollscape_al_links', JSON.stringify(l));
  } catch {}
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
    }
  } catch (_) {
    showToast('AniList', 'Connected but could not fetch profile.', 'warning');
  }
}

// ============================================================================
// ANILIST TRACKER MODAL
// ============================================================================

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
