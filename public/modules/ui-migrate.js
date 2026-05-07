// ============================================================================
// LIBRARY MIGRATION
// Lets the user move manga from one source to another, with per-manga
// chapter-count comparison so they can pick the best-updated source.
// ============================================================================

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Group favorites by sourceId and return sorted array of { sourceId, count, mangas }. */
function _migrateGroupBySource() {
  const map = new Map();
  // Agrupa todos os mangas sem source sob o mesmo grupo 'unknown'
  for (const m of (state.favorites || [])) {
    let sid = m.sourceId;
    if (!sid || sid === 'unknown' || sid === 'null' || sid === 'undefined') sid = 'unknown';
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(m);
  }
  return [...map.entries()]
    .map(([sourceId, mangas]) => ({ sourceId, count: mangas.length, mangas }))
    .sort((a, b) => b.count - a.count);
}

/** Source display name — uses installed sources info if available. */
function _srcName(sourceId) {
  if (sourceId === 'unknown') return 'Sem source';
  if (sourceId === 'anilist') return 'AniList (placeholder)';
  return state.installedSources?.[sourceId]?.name || sourceId;
}

function _normSourceId(sourceId) {
  return sourceId || 'unknown';
}

function _migrateStoreKeyPart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_');
}

function _migrateStatusKey(mangaId, sourceId) {
  return `${_migrateStoreKeyPart(mangaId)}:${_migrateStoreKeyPart(sourceId || 'unknown')}`;
}

function _cleanTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _titleSimilarity(a, b) {
  const aa = _cleanTitle(a);
  const bb = _cleanTitle(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.9;
  const sa = new Set(aa.split(' '));
  const sb = new Set(bb.split(' '));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.max(sa.size, sb.size);
}

async function _sourceSearch(sourceId, query) {
  return fetch(`/api/source/${encodeURIComponent(sourceId)}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, page: 1 }),
  }).then(res => res.json());
}

async function _getInstalledTargetSources(fromSourceId) {
  try {
    const stateData = await api('/api/state');
    return Object.keys(stateData?.installedSources || {})
      .filter(sid => sid !== 'local' && sid !== fromSourceId);
  } catch (_) {
    return Object.keys(state.installedSources || {})
      .filter(sid => sid !== 'local' && sid !== fromSourceId);
  }
}

async function _isMigratableManga(manga, targetSources) {
  const title = String(manga?.title || '').trim();
  if (!title || !targetSources.length) return false;

  for (const sid of targetSources) {
    try {
      const r = await _sourceSearch(sid, title);
      const candidates = (r?.results || []).slice(0, 6);
      for (const c of candidates) {
        if (!c?.id) continue;
        if (_titleSimilarity(title, c.title || '') >= 0.2) return true;
      }
    } catch (_) {
      // Ignore failing source and continue checking others.
    }
  }
  return false;
}

async function _filterMigratableMangas(mangas, fromSourceId) {
  const targetSources = await _getInstalledTargetSources(fromSourceId);
  if (!targetSources.length) return [];

  const BATCH = 6;
  const out = [];
  for (let i = 0; i < mangas.length; i += BATCH) {
    const chunk = mangas.slice(i, i + BATCH);
    const flags = await Promise.all(chunk.map(m => _isMigratableManga(m, targetSources)));
    flags.forEach((ok, idx) => {
      if (ok) out.push(chunk[idx]);
    });
  }
  return out;
}

async function _sourceChaptersCount(sourceId, mangaId) {
  try {
    const r = await fetch(`/api/source/${encodeURIComponent(sourceId)}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mangaId }),
    }).then(res => res.json());
    const ch = r?.chapters || [];
    return Array.isArray(ch) ? ch.length : null;
  } catch (_) {
    return null;
  }
}

/** Fetch first-result chapter count from a single source for a title. Returns null on miss. */
async function _chapCount(sourceId, title) {
  try {
    const titleStr = String(title || '').trim();
    if (!titleStr) return null;
    const MIN_SIM = 0.55;

    const queries = [...new Set([
      titleStr,
      titleStr.split(':')[0]?.trim(),
      titleStr.split('-')[0]?.trim(),
      _cleanTitle(titleStr),
    ].filter(Boolean))].slice(0, 4);

    let best = null;

    for (const q of queries) {
      const r = await _sourceSearch(sourceId, q);
      const candidates = (r?.results || []).slice(0, 8);
      for (const c of candidates) {
        if (!c?.id) continue;
        const sim = _titleSimilarity(titleStr, c.title || '');
        let chapCount = Number.isFinite(Number(c.lastChapter)) ? Number(c.lastChapter) : null;
        if (chapCount === null) {
          chapCount = await _sourceChaptersCount(sourceId, c.id);
        }

        const rank = sim * 1000 + (chapCount || 0);
        if (sim < MIN_SIM) continue;

        if (!best || rank > best.rank) {
          best = {
            rank,
            chapCount,
            mangaId: c.id,
            cover: c.cover,
            title: c.title || titleStr,
          };
        }
      }
      if (best && best.chapCount !== null && best.chapCount > 0) break;
    }

    if (!best) return null;
    return {
      chapCount: best.chapCount,
      mangaId: best.mangaId,
      cover: best.cover,
      title: best.title,
    };
  } catch (_) { return null; }
}

// ── State for the modal ───────────────────────────────────────────────────────

let _migrateSelectedMangas  = []; // { id, sourceId, title, cover }
let _migrateFromSourceId    = null;

// ── Step 1 — Source overview ──────────────────────────────────────────────────

function showMigrateModal() {
  document.getElementById('migrateModal')?.remove();

  const groups = _migrateGroupBySource();

  const rows = groups.length === 0
    ? `<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:var(--text-muted)">Library is empty.</td></tr>`
    : groups.map(g => `
        <tr class="migrate-source-row" data-source-id="${escapeHtml(g.sourceId)}" style="cursor:pointer">
          <td style="padding:0.6rem 0.8rem">
            <span class="migrate-source-name">${escapeHtml(_srcName(g.sourceId))}</span>
            ${g.sourceId === 'anilist' || g.sourceId === 'unknown'
              ? `<span class="migrate-badge-warn">no source</span>` : ''}
          </td>
          <td style="padding:0.6rem 0.8rem;text-align:right;font-variant-numeric:tabular-nums">${g.count}</td>
          <td style="padding:0.6rem 0.8rem;text-align:right;color:var(--text-muted);font-size:0.82rem">Select →</td>
        </tr>`
      ).join('');

  const modal = document.createElement('div');
  modal.id = 'migrateModal';
  modal.className = 'settings-modal';
  modal.innerHTML = `
    <div class="settings-content" style="width:min(96vw,1080px);max-width:1080px;max-height:96vh;overflow:auto;border:1px solid rgba(130,80,255,0.25);box-shadow:0 16px 50px rgba(0,0,0,0.55)">
      <div class="settings-header">
        <h2>Migrate Library</h2>
        <button class="btn secondary" id="migrateBtnClose">&#x2715;</button>
      </div>
      <div class="settings-body">
        <p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.88rem">
          Select a source to see its manga, then pick which ones to migrate to another source.
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid rgba(130,80,255,0.2)">
              <th style="text-align:left;padding:0.4rem 0.8rem;font-size:0.78rem;color:var(--text-muted);font-weight:500">Source</th>
              <th style="text-align:right;padding:0.4rem 0.8rem;font-size:0.78rem;color:var(--text-muted);font-weight:500">Manga</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="migrateSourceRows">${rows}</tbody>
        </table>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.getElementById('migrateBtnClose').onclick = () => modal.remove();

  modal.querySelectorAll('.migrate-source-row').forEach(row => {
    row.onmouseenter = () => row.style.background = 'rgba(130,80,255,0.07)';
    row.onmouseleave = () => row.style.background = '';
    row.onclick = () => {
      _migrateFromSourceId = row.dataset.sourceId;
      _migrateSelectedMangas = [];
      _migrateShowStep2(modal, groups.find(g => g.sourceId === _migrateFromSourceId));
    };
  });
}

// ── Step 2 — Manga picker ─────────────────────────────────────────────────────

function _migrateShowStep2(modal, group) {
  const { sourceId, mangas } = group;

  const rows = mangas.map(m => {
    const currentSource = _normSourceId(m.sourceId || sourceId);
    const key    = _migrateStatusKey(m.id, currentSource);
    const status = state.readingStatus[key]?.status;
    const badge  = status ? `<span class="status-badge status-badge-${status}" style="font-size:0.7rem;padding:2px 6px">${statusLabel(status)}</span>` : '';
    return `
      <label class="migrate-manga-row" data-manga-id="${escapeHtml(m.id)}" data-source-id="${escapeHtml(currentSource)}" style="display:flex;align-items:center;gap:0.9rem;padding:0.65rem 0.75rem;border-radius:10px;cursor:pointer;transition:background-color .15s ease">
        <input type="checkbox" class="migrate-manga-chk migrate-chk" value="${escapeHtml(m.id)}">
        ${m.cover ? `<img src="${escapeHtml(m.cover)}" style="width:56px;height:76px;object-fit:cover;border-radius:7px;flex-shrink:0" loading="lazy" onerror="this.style.display='none'">` : `<div style="width:56px;height:76px;background:rgba(130,80,255,0.12);border-radius:7px;flex-shrink:0"></div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:1.05rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.title || m.id)}</div>
          ${badge}
        </div>
      </label>`;
  }).join('');

  modal.querySelector('.settings-content').innerHTML = `
    <div class="settings-header">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <button class="btn secondary" id="migrateBtnBack" style="padding:4px 10px;font-size:0.8rem">← Back</button>
        <h2 style="font-size:1.2rem">${escapeHtml(_srcName(sourceId))} — pick manga</h2>
      </div>
      <button class="btn secondary" id="migrateBtnClose2">&#x2715;</button>
    </div>
    <div class="settings-body" style="padding-bottom:0">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
        <label style="font-size:0.92rem;display:flex;align-items:center;gap:0.55rem;cursor:pointer;font-weight:500">
          <input type="checkbox" id="migrateSelectAll" class="migrate-chk"> Select all
        </label>
        <span id="migrateSelCount" style="font-size:0.88rem;color:var(--text-muted)">0 selected</span>
      </div>
      <div id="migrateMangaList" style="max-height:74vh;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:4px">${rows}</div>
    </div>
    <div style="padding:0.75rem 1.2rem;border-top:1px solid rgba(130,80,255,0.15);display:flex;justify-content:flex-end">
      <button class="btn primary" id="migrateBtnNext" disabled>Next →</button>
    </div>`;

  document.getElementById('migrateBtnClose2').onclick = () => modal.remove();
  document.getElementById('migrateBtnBack').onclick   = () => { showMigrateModal(); modal.remove(); };

  const updateCount = () => {
    const n = modal.querySelectorAll('.migrate-manga-chk:checked').length;
    document.getElementById('migrateSelCount').textContent = `${n} selected`;
    document.getElementById('migrateBtnNext').disabled = n === 0;
    document.getElementById('migrateSelectAll').indeterminate = n > 0 && n < mangas.length;
    document.getElementById('migrateSelectAll').checked = n === mangas.length && mangas.length > 0;
  };

  document.getElementById('migrateSelectAll').onchange = (e) => {
    modal.querySelectorAll('.migrate-manga-chk').forEach(chk => { chk.checked = e.target.checked; });
    updateCount();
  };

  modal.querySelectorAll('.migrate-manga-chk').forEach(chk => { chk.onchange = updateCount; });

  // Row hover
  modal.querySelectorAll('.migrate-manga-row').forEach(row => {
    row.onmouseenter = () => row.style.background = 'rgba(130,80,255,0.07)';
    row.onmouseleave = () => row.style.background = '';
  });

  document.getElementById('migrateBtnNext').onclick = () => {
    _migrateSelectedMangas = [];
    modal.querySelectorAll('.migrate-manga-chk:checked').forEach(chk => {
      const row = chk.closest('.migrate-manga-row');
      const mid = row.dataset.mangaId;
      const sid = _normSourceId(row.dataset.sourceId);
      const fav = state.favorites.find(f => f.id === mid && _normSourceId(f.sourceId) === sid);
      if (fav) _migrateSelectedMangas.push(fav);
    });
    if (!_migrateSelectedMangas.length) {
      showToast('Migration', 'No valid manga selected. Try selecting again.', 'warning');
      return;
    }
    _migrateShowStep3(modal);
  };
}

// ── Step 3 — Source comparison + confirm ──────────────────────────────────────

async function _migrateShowStep3(modal) {
  // Show loading state
  modal.querySelector('.settings-content').innerHTML = `
    <div class="settings-header">
      <h2 style="font-size:1.05rem">Comparing sources…</h2>
      <button class="btn secondary" id="migrateBtnClose3">&#x2715;</button>
    </div>
    <div class="settings-body" style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 1rem"></div>
      Searching all sources for ${_migrateSelectedMangas.length} manga…
    </div>`;
  document.getElementById('migrateBtnClose3').onclick = () => modal.remove();

  // Get installed source IDs (exclude the from-source and 'local')
  let stateData;
  try { stateData = await api('/api/state'); } catch (_) {}
  const allSources = Object.keys(stateData?.installedSources || {})
    .filter(sid => sid !== 'local');

  // Fetch chapter counts from all sources for each manga (batches of 5 manga)
  const BATCH = 5;
  // results[i] = { manga, sourceResults: { sourceId → { chapCount, mangaId, cover, title } | null } }
  const results = [];

  for (let i = 0; i < _migrateSelectedMangas.length; i += BATCH) {
    const chunk = _migrateSelectedMangas.slice(i, i + BATCH);
    const chunkData = await Promise.all(chunk.map(async (manga) => {
      const sourceResults = {};
      await Promise.all(allSources.map(async (sid) => {
        const bySearch = await _chapCount(sid, manga.title);
        if (bySearch) {
          sourceResults[sid] = bySearch;
          return;
        }

        // Fallback: if this is the current source and we already have a manga ID,
        // ask chapters directly so current source is never blank when reachable.
        if (sid === manga.sourceId && manga.id) {
          const directCount = await _sourceChaptersCount(sid, manga.id);
          if (directCount !== null) {
            sourceResults[sid] = {
              chapCount: directCount,
              mangaId: manga.id,
              cover: manga.cover,
              title: manga.title,
            };
            return;
          }
        }

        sourceResults[sid] = null;
      }));
      return { manga, sourceResults };
    }));
    results.push(...chunkData);
  }

  const targetSources = allSources.filter(sid => sid !== _migrateFromSourceId);
  const migratableResults = results.filter(({ sourceResults }) =>
    targetSources.some(sid => !!sourceResults[sid]?.mangaId)
  );

  if (!migratableResults.length) {
    modal.querySelector('.settings-content').innerHTML = `
      <div class="settings-header">
        <div style="display:flex;align-items:center;gap:0.6rem">
          <button class="btn secondary" id="migrateBtnBackNone" style="padding:4px 10px;font-size:0.8rem">← Back</button>
          <h2 style="font-size:1.05rem">Choose target source</h2>
        </div>
        <button class="btn secondary" id="migrateBtnCloseNone">&#x2715;</button>
      </div>
      <div class="settings-body" style="padding:2rem 1.2rem">
        <div style="border:1px solid rgba(130,80,255,0.2);background:rgba(130,80,255,0.08);padding:1rem;border-radius:10px;color:var(--text-muted)">
          None of the selected manga has a valid match in installed target sources.
        </div>
      </div>`;

    document.getElementById('migrateBtnCloseNone').onclick = () => modal.remove();
    document.getElementById('migrateBtnBackNone').onclick = () => {
      const groups = _migrateGroupBySource();
      const group  = groups.find(g => g.sourceId === _migrateFromSourceId);
      if (group) _migrateShowStep2(modal, group);
    };
    return;
  }

  _migrateShowStep3Table(modal, migratableResults, allSources);
}

function _migrateShowStep3Table(modal, results, allSources) {
  const targetSources = allSources.filter(sid => sid !== _migrateFromSourceId);
  const rowKeyFor = (manga) => `${manga.id}::${_normSourceId(manga.sourceId)}`;

  if (targetSources.length === 0) {
    modal.querySelector('.settings-content').innerHTML = `
      <div class="settings-header">
        <div style="display:flex;align-items:center;gap:0.6rem">
          <button class="btn secondary" id="migrateBtnBackNoSources" style="padding:4px 10px;font-size:0.8rem">← Back</button>
          <h2 style="font-size:1.2rem">Choose target source</h2>
        </div>
        <button class="btn secondary" id="migrateBtnCloseNoSources">&#x2715;</button>
      </div>
      <div class="settings-body" style="padding:2rem 1.2rem">
        <div style="border:1px solid rgba(130,80,255,0.2);background:rgba(130,80,255,0.08);padding:1rem;border-radius:10px;color:var(--text-muted)">
          No target sources available. Install at least one source different from <strong>${escapeHtml(_srcName(_migrateFromSourceId))}</strong>.
        </div>
      </div>`;

    document.getElementById('migrateBtnCloseNoSources').onclick = () => modal.remove();
    document.getElementById('migrateBtnBackNoSources').onclick = () => {
      const groups = _migrateGroupBySource();
      const group  = groups.find(g => g.sourceId === _migrateFromSourceId);
      if (group) _migrateShowStep2(modal, group);
    };
    return;
  }

  // Build table HTML
  const colHeaders = allSources.map(sid =>
    `<th style="padding:0.5rem 0.75rem;font-size:0.85rem;color:var(--text-muted);font-weight:600;text-align:center;white-space:nowrap">${escapeHtml(_srcName(sid))}</th>`
  ).join('');

  const tableRows = results.map(({ manga, sourceResults }) => {
    const rowKey = rowKeyFor(manga);
    // Find max chapter count across all sources to highlight best
    const counts = allSources.map(sid => sourceResults[sid]?.chapCount ?? -1);
    const maxCount = Math.max(...counts);

    const cells = allSources.map((sid) => {
      const info  = sourceResults[sid];
      const count = info?.chapCount ?? null;
      const isBest = count !== null && count === maxCount && maxCount >= 0;
      const isCurrent = sid === manga.sourceId;
      let cellStyle = 'padding:0.5rem 0.75rem;text-align:center;font-variant-numeric:tabular-nums;font-size:0.95rem;';
      if (isBest)    cellStyle += 'color:#7cfc88;font-weight:700;';
      else if (isCurrent) cellStyle += 'color:var(--primary);font-weight:600;';
      else           cellStyle += 'color:var(--text-muted);';
      const label = count !== null ? String(count) : '—';
      const crown = isBest && !isCurrent ? ' 👑' : '';

      if (isCurrent) {
        return `<td style="${cellStyle}">${label}${crown}</td>`;
      }

      if (!info?.mangaId) {
        return `<td style="${cellStyle}">${label}</td>`;
      }

      return `<td style="${cellStyle}">
        <label style="display:inline-flex;align-items:center;gap:0.55rem;cursor:pointer">
          <input
            type="checkbox"
            class="migrate-target-chk migrate-chk"
            data-row-key="${escapeHtml(rowKey)}"
            data-target-source="${escapeHtml(sid)}"
          >
          <span>${label}${crown}</span>
        </label>
      </td>`;
    }).join('');

    return `
      <tr data-row-key="${escapeHtml(rowKey)}" style="border-bottom:1px solid rgba(130,80,255,0.08)">
        <td style="padding:0.5rem 0.75rem;max-width:220px">
          <div style="display:flex;align-items:center;gap:0.6rem">
            ${manga.cover ? `<img src="${escapeHtml(manga.cover)}" style="width:44px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0" loading="lazy" onerror="this.style.display='none'">` : ''}
            <span style="font-size:0.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${escapeHtml(manga.title || manga.id)}</span>
          </div>
        </td>
        ${cells}
      </tr>`;
  }).join('');

  modal.querySelector('.settings-content').innerHTML = `
    <div class="settings-header">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <button class="btn secondary" id="migrateBtnBack3" style="padding:4px 10px;font-size:0.8rem">← Back</button>
        <h2 style="font-size:1.2rem">Choose target source</h2>
      </div>
      <button class="btn secondary" id="migrateBtnClose4">&#x2715;</button>
    </div>
    <div class="settings-body" style="padding-bottom:0">
      <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:0.75rem">
        Chapter counts show the top search result per source.
        <span style="color:#7cfc88">Green / 👑</span> = most chapters.
        Current source highlighted in <span style="color:var(--primary)">purple</span>. Only one checkbox per manga row.
      </p>
      <div style="overflow-x:auto;max-height:78vh;overflow-y:auto;border:1px solid rgba(130,80,255,0.16);border-radius:10px">
        <table style="width:100%;border-collapse:collapse;min-width:900px">
          <thead style="position:sticky;top:0;background:var(--bg-card,#1a1a2e);z-index:1">
            <tr style="border-bottom:1px solid rgba(130,80,255,0.2)">
              <th style="text-align:left;padding:0.5rem 0.75rem;font-size:0.85rem;color:var(--text-muted);font-weight:600">Manga</th>
              ${colHeaders}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
    <div style="padding:0.75rem 1.2rem;border-top:1px solid rgba(130,80,255,0.15);display:flex;justify-content:space-between;align-items:center">
      <span id="migrateChoiceCount" style="font-size:0.9rem;color:var(--text-muted)">0 manga with target selected</span>
      <button class="btn primary" id="migrateBtnConfirm" disabled>Migrate Selected</button>
    </div>`;

  const contentEl = modal.querySelector('.settings-content');
  if (contentEl) {
    contentEl.style.width = 'min(98vw, 1320px)';
    contentEl.style.maxWidth = '1320px';
    contentEl.style.maxHeight = '96vh';
  }

  document.getElementById('migrateBtnClose4').onclick = () => modal.remove();
  document.getElementById('migrateBtnBack3').onclick = () => {
    const groups = _migrateGroupBySource();
    const group  = groups.find(g => g.sourceId === _migrateFromSourceId);
    _migrateShowStep2(modal, group);
  };

  const selectedTargets = new Map(); // rowKey -> sourceId
  const updateChoiceCount = () => {
    const n = selectedTargets.size;
    const countEl = document.getElementById('migrateChoiceCount');
    if (countEl) countEl.textContent = `${n} manga with target selected`;
    const btn = document.getElementById('migrateBtnConfirm');
    if (btn) btn.disabled = n === 0;
  };

  modal.querySelectorAll('.migrate-target-chk').forEach(chk => {
    chk.onchange = (e) => {
      const rowKey = chk.dataset.rowKey;
      const sid = chk.dataset.targetSource;
      if (!rowKey || !sid) return;

      if (chk.checked) {
        modal.querySelectorAll('.migrate-target-chk').forEach(other => {
          if (other.dataset.rowKey !== rowKey) return;
          if (other !== chk) other.checked = false;
        });
        selectedTargets.set(rowKey, sid);
      } else if (selectedTargets.get(rowKey) === sid) {
        selectedTargets.delete(rowKey);
      }

      updateChoiceCount();
    };
  });

  document.getElementById('migrateBtnConfirm').onclick = async () => {
    await _migrateExecute(modal, results, selectedTargets, rowKeyFor);
  };
}

// ── Step 4 — Execute ──────────────────────────────────────────────────────────

async function _migrateExecute(modal, results, selectedTargets, rowKeyFor) {
  const btn = document.getElementById('migrateBtnConfirm');
  if (btn) { btn.disabled = true; btn.textContent = 'Migrating…'; }

  const selectedCount = selectedTargets?.size || 0;
  if (!selectedCount) {
    if (btn) { btn.disabled = false; btn.textContent = 'Migrate Selected'; }
    showToast('Migration', 'Select one target source per manga row before migrating.', 'warning');
    return;
  }

  // Build migration payloads — only migrate rows that found a target match
  const migrations = [];
  let skipped = 0;
  for (const { manga, sourceResults } of results) {
    const rowKey = rowKeyFor(manga);
    const toSourceId = selectedTargets.get(rowKey);
    if (!toSourceId) {
      console.warn('[MIGRATION] No target source selected for', manga);
      continue;
    }

    const info = sourceResults[toSourceId];
    if (!info?.mangaId) {
      console.warn('[MIGRATION] No mangaId found in target source', { manga, toSourceId, info });
      skipped++;
      continue;
    }
    // Garante que fromSourceId é sempre string ("unknown" se não houver)
    let fromSourceId = manga.sourceId;
    if (!fromSourceId || fromSourceId === null || fromSourceId === undefined) fromSourceId = 'unknown';
    migrations.push({
      fromMangaId:  manga.id,
      fromSourceId: fromSourceId,
      toMangaId:    info.mangaId,
      toSourceId,
      title:        info.title || manga.title,
      cover:        info.cover || manga.cover || '',
    });
    console.log('[MIGRATION] Prepared migration:', {
      fromMangaId: manga.id,
      fromSourceId,
      toMangaId: info.mangaId,
      toSourceId,
      title: info.title || manga.title
    });
  }
  console.log('[MIGRATION] Total migrations to send:', migrations.length);

  if (!migrations.length) {
    if (btn) { btn.disabled = false; btn.textContent = 'Migrate Selected'; }
    showToast('Migration', 'No valid matches found for the selected rows.', 'warning');
    return;
  }

  try {
    const res = await api('/api/library/migrate', {
      method: 'POST',
      body: JSON.stringify({ migrations }),
    });

    // ── Remap localStorage data for migrated manga ────────────────────────
    if (Array.isArray(res.migrations) && res.migrations.length > 0) {
      _migrateRemapLocalStorage(res.migrations);
    }

    // Refresh state
    try {
      const libData = await fetch('/api/library').then(r => r.json());
      state.favorites = libData.favorites || state.favorites;
      const statusData = await fetch('/api/user/status').then(r => r.json());
      state.readingStatus = statusData.readingStatus || state.readingStatus;
      const listsData = await api('/api/lists');
      state.customLists = listsData.lists || [];
      // Reload ratings so the UI reflects migrated scores immediately
      const ratingsData = await fetch('/api/ratings').then(r => r.json());
      state.ratings = ratingsData.ratings || state.ratings;
      renderLibrary();
    } catch (_) {}

    modal.remove();
    const parts = [`${res.migrated} manga migrated`];
    if (res.failed) parts.push(`${res.failed} failed`);
    if (skipped) parts.push(`${skipped} without match`);

    // AVISO ESPECIAL PARA SEM SOURCE
    // Verifica se algum dos migrados tinha sourceId 'unknown' e ficou sem status/review
    let semSourceWarn = false;
    if (Array.isArray(migrations)) {
      for (const m of migrations) {
        if ((m.fromSourceId === 'unknown' || !m.fromSourceId) && m.fromMangaId && m.toMangaId) {
          // Verifica se o novo manga ficou sem status
          const newKey = `${m.toMangaId}:${m.toSourceId}`.replace(/[^a-z0-9:_-]/gi, '_');
          if (!state.readingStatus[newKey]) {
            semSourceWarn = true;
            break;
          }
        }
      }
    }
    if (semSourceWarn) {
      parts.push('⚠️ Alguns mangas migrados de "sem source" não tinham progresso/status para copiar.');
    }

    showToast('Migration complete', parts.join(', '), (res.failed || skipped || semSourceWarn) ? 'warning' : 'success');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Migrate Selected'; }
    showToast('Migration failed', err.message, 'error');
  }
}

/**
 * Remaps localStorage keys from old manga IDs to new manga IDs after a migration.
 * Handles: scrollscapeReadChapters, scrollscapeFlaggedChapters,
 *          scrollscapeReadingProgress, scrollscape_al_links (AniList tracker).
 * Keys are of the form "mangaId:chapterId" (for chapters) or "mangaId" (for progress).
 *
 * @param {Array<{fromMangaId:string, toMangaId:string}>} migrationPairs
 */
function _migrateRemapLocalStorage(migrationPairs) {
  try {
    // Build a fast lookup map
    const idMap = new Map(migrationPairs.map(p => [p.fromMangaId, p.toMangaId]));

    // ── readChapters ─────────────────────────────────────────────────────────
    const readRaw = localStorage.getItem('scrollscapeReadChapters');
    if (readRaw) {
      try {
        const arr = JSON.parse(readRaw);
        const remapped = arr.map(key => {
          const sep = key.indexOf(':');
          if (sep < 0) return key;
          const mid = key.slice(0, sep);
          const rest = key.slice(sep); // includes the colon
          const newMid = idMap.get(mid);
          return newMid ? newMid + rest : key;
        });
        localStorage.setItem('scrollscapeReadChapters', JSON.stringify(remapped));
        state.readChapters = new Set(remapped);
      } catch (_) {}
    }

    // ── flaggedChapters ──────────────────────────────────────────────────────
    const flagRaw = localStorage.getItem('scrollscapeFlaggedChapters');
    if (flagRaw) {
      try {
        const arr = JSON.parse(flagRaw);
        const remapped = arr.map(key => {
          const sep = key.indexOf(':');
          if (sep < 0) return key;
          const mid = key.slice(0, sep);
          const rest = key.slice(sep);
          const newMid = idMap.get(mid);
          return newMid ? newMid + rest : key;
        });
        localStorage.setItem('scrollscapeFlaggedChapters', JSON.stringify(remapped));
        state.flaggedChapters = new Set(remapped);
      } catch (_) {}
    }

    // ── readingProgress (pages, chapters, highestChapter) ────────────────────
    const progRaw = localStorage.getItem('scrollscapeReadingProgress');
    if (progRaw) {
      try {
        const prog = JSON.parse(progRaw);

        // `pages` and `chapters` keys are "mangaId:chapterId"
        const remapColonKeys = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          const out = {};
          for (const [key, val] of Object.entries(obj)) {
            const sep = key.indexOf(':');
            if (sep >= 0) {
              const mid = key.slice(0, sep);
              const rest = key.slice(sep);
              const newMid = idMap.get(mid);
              out[newMid ? newMid + rest : key] = val;
            } else {
              out[key] = val;
            }
          }
          return out;
        };

        // `highestChapter` keys are plain mangaId
        const remapPlainKeys = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          const out = {};
          for (const [key, val] of Object.entries(obj)) {
            const newKey = idMap.get(key) || key;
            out[newKey] = val;
          }
          return out;
        };

        prog.pages          = remapColonKeys(prog.pages);
        prog.chapters       = remapColonKeys(prog.chapters);
        prog.highestChapter = remapPlainKeys(prog.highestChapter);

        localStorage.setItem('scrollscapeReadingProgress', JSON.stringify(prog));
        // Sync in-memory state
        state.lastReadPages       = prog.pages          || {};
        state.lastReadChapter     = prog.chapters       || {};
        state.highestReadChapter  = prog.highestChapter || {};
      } catch (_) {}
    }

    // ── AniList tracker links (mangaId -> anilistId) ────────────────────────
    const alLinksRaw = localStorage.getItem('scrollscape_al_links');
    if (alLinksRaw) {
      try {
        const links = JSON.parse(alLinksRaw);
        if (links && typeof links === 'object') {
          const remapped = {};
          for (const [key, val] of Object.entries(links)) {
            remapped[idMap.get(key) || key] = val;
          }
          localStorage.setItem('scrollscape_al_links', JSON.stringify(remapped));
        }
      } catch (_) {}
    }
  } catch (_) {
    // Non-fatal — localStorage remap failure should not block the rest of the flow.
  }
}
