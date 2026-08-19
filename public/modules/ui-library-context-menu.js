// ── Library right-click context menu ─────────────────────────────────────────
// The per-manga/bulk-selection actions menu (mark status, categories,
// AniList status, download all, remove, migrate, edit tags). Depends on a
// handful of globals defined elsewhere in ui-library.js (resolveLibraryManga,
// _getLibraryActionTargets, normalizeLibraryId, _libStatusKey,
// getContextMenuPoint, _clearLibrarySelection, renderLibrary, showEditTagsModal)
// plus shared app globals (state, api, showToast, escapeHtml) — all plain
// global function calls, so this works the same from its own deferred script
// as it did inline.

function _closeLibraryContextMenu() {
  document.getElementById('libraryContextMenu')?.remove();
  document.removeEventListener('click', _ctxDocClickHandler, true);
  document.removeEventListener('keydown', _ctxMenuKeyHandler);
}

function _ctxMenuKeyHandler(e) {
  if (e.key === 'Escape') _closeLibraryContextMenu();
}

function _ctxDocClickHandler(e) {
  if (e?.target?.closest && e.target.closest('#libraryContextMenu')) return;
  _closeLibraryContextMenu();
}

async function showLibraryContextMenu(pointOrEvent, mangaInput, mangaCategories) {
  _closeLibraryContextMenu();

  // Try to cleanly resolve the manga context including the correct sourceId.
  const manga = resolveLibraryManga({
    mangaId: mangaInput.id,
    sourceId: mangaInput.sourceId,
    title: mangaInput.title
  }) || mangaInput; // fallback to input if resolution completely fails

  const actionMangas = _getLibraryActionTargets(manga);
  const isBulk = actionMangas.length > 1;
  const bulkPrefix = isBulk ? `Selected (${actionMangas.length})` : 'Current';

  const sourceId = normalizeLibraryId(manga.sourceId);
  if (!sourceId) {
    showToast('Categories', 'Could not resolve source for this manga.', 'warning');
    return;
  }
  const primaryKey = `${manga.id}:${sourceId}`;
  const legacyKey  = `${manga.id}:`;
  const currentCatIds = Array.from(new Set([
    ...(mangaCategories[primaryKey] || []),
    ...(mangaCategories[legacyKey] || []),
  ]));
  const statusKey = _libStatusKey(manga.id, sourceId);
  const currentStatus = state.readingStatus[statusKey]?.status || null;

  // Pre-fetch current categories from server for accuracy.
  // For bulk mode we keep the checkbox list empty by default to avoid accidental overwrite.
  let serverCatIds = [...currentCatIds];
  if (!isBulk) {
    try {
      const d = await api(`/api/lists/manga/${encodeURIComponent(manga.id)}/categories?sourceId=${encodeURIComponent(sourceId)}`);
      serverCatIds = d.categoryIds || currentCatIds;
    } catch (_) {}
  } else {
    serverCatIds = [];
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'libraryContextMenu';

  const _ico = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;

  const categoriesSection = (state.customLists || []).length > 0
    ? `<div class="context-divider"></div>
       <div class="ctx-categories-header">Categories</div>
       <div class="ctx-categories-list">
         ${(state.customLists || []).map(l => `
           <label class="ctx-cat-label">
             <input type="checkbox" class="ctx-cat-cb" value="${escapeHtml(l.id)}" ${serverCatIds.includes(l.id) ? 'checked' : ''}>
             <span>${escapeHtml(l.name)}</span>
           </label>`).join('')}
       </div>
       <div style="padding:0.35rem 0.55rem 0.6rem">
         <button class="btn primary ctx-save-cats-btn" style="width:100%;font-size:0.82rem;padding:0.42rem 0.75rem">${isBulk ? `Apply Categories to ${actionMangas.length}` : 'Save Categories'}</button>
       </div>`
    : `<div class="context-divider"></div>
       <div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">No categories — create one in the library bar</div>`;

  menu.innerHTML = `
    <div class="ctx-categories-header" style="padding-top:0.55rem;padding-bottom:0.35rem">${bulkPrefix} manga actions</div>
    <button class="context-item" id="ctxDownloadAll">${_ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')} ${isBulk ? `Download All Chapters (${actionMangas.length})` : 'Download All'}</button>
    <div class="context-divider"></div>
    ${!isBulk ? `<button class="context-item" id="ctxEditTags">${_ico('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>')} Edit Tags</button><div class="context-divider"></div>` : ''}
    ${!isBulk && sourceId !== 'local' ? `<button class="context-item" id="ctxChangeCover">${_ico('<rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>')} Change Cover</button><button class="context-item" id="ctxMigrateOne">${_ico('<path d="M8 7h13M13 3l4 4-4 4"/><path d="M16 17H3"/><path d="M7 13l-4 4 4 4"/>')} Migrate this manga</button><div class="context-divider"></div>` : ''}
    <button class="context-item ${currentStatus === 'completed' ? 'ctx-item-active' : ''}" id="ctxMarkCompleted">${_ico('<polyline points="20 6 9 17 4 12"/>')} ${isBulk ? 'Mark Selected as Completed' : 'Mark as Completed'}</button>
    <button class="context-item ${currentStatus === 'reading'   ? 'ctx-item-active' : ''}" id="ctxMarkReading">${_ico('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>')} ${isBulk ? 'Mark Selected as Reading' : 'Mark as Reading'}</button>
    <button class="context-item ${!currentStatus             ? 'ctx-item-active' : ''}" id="ctxRemoveStatus">${_ico('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>')} ${isBulk ? 'Mark Selected as Unread' : 'Mark as Unread'}</button>
    <div class="context-divider"></div>
    <button class="context-item" id="ctxRemoveFromLibrary">${_ico('<path d="M3 6h18M9 6v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6"/><path d="M10 11v6M14 11v6"/>')} ${isBulk ? 'Remove Selected from Library' : 'Remove from Library'}</button>
    ${typeof _alToken === 'function' && _alToken()
      ? `<div class="context-divider"></div>
         <div class="ctx-categories-header">AniList Status</div>
         <div style="padding:0.3rem 0.55rem 0.5rem">
           <select id="ctxAnilistStatus" class="input" style="width:100%;font-size:0.82rem">
             ${AL_BULK_STATUSES.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('')}
           </select>
         </div>
         <div style="padding:0 0.55rem 0.6rem">
           <button class="btn primary ctx-anilist-status-btn" style="width:100%;font-size:0.82rem;padding:0.42rem 0.75rem">${isBulk ? `Apply AniList Status to ${actionMangas.length}` : 'Apply AniList Status'}</button>
         </div>`
      : `<div class="context-divider"></div>
         <div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">Connect AniList in Settings to change status there too</div>`}
    ${sourceId !== 'local' ? categoriesSection : `<div class="context-divider"></div><div class="ctx-categories-header" style="opacity:0.5;font-style:italic;padding-bottom:0.5rem">Categories not supported for local manga</div>`}`;

  document.body.appendChild(menu);

  // Position: avoid going off-screen
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 240, mh = menu.offsetHeight || 300;
  
  let { x, y } = getContextMenuPoint(pointOrEvent);

  if (x + mw > vw - 8) x = vw - mw - 8;
  if (y + mh > vh - 8) y = vh - mh - 8;
  if (y < 8) y = 8;
  if (x < 8) x = 8;
  
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  // ── Actions ────────────────────────────────────────────────────────────────

  // Remove from Library (single or bulk)
  menu.querySelector('#ctxRemoveFromLibrary').onclick = async () => {
    if (!actionMangas.length) return;
    if (!confirm(isBulk ? `Remove ${actionMangas.length} manga from your library?` : 'Remove this manga from your library?')) return;
    let ok = 0, fail = 0;
    for (const m of actionMangas) {
      try {
        await ensureMangaNotInLibrary(m.id, m.sourceId);
        
        // Remove reading status
        const key = _libStatusKey(m.id, m.sourceId);
        if (state.readingStatus) delete state.readingStatus[key];
        ok++;
      } catch (err) {
        fail++;
      }
    }
    _clearLibrarySelection();
    renderLibrary();
    showToast('Removed', ok ? `${ok} manga removed${fail ? `, ${fail} failed` : ''}` : 'No manga removed', fail ? 'warning' : 'info');
    _closeLibraryContextMenu();
  };

  const editTagsBtn = menu.querySelector('#ctxEditTags');
  if (editTagsBtn) {
    editTagsBtn.onclick = () => {
      _closeLibraryContextMenu();
      showEditTagsModal(manga, sourceId);
    };
  }

  const changeCoverBtn = menu.querySelector('#ctxChangeCover');
  if (changeCoverBtn) {
    changeCoverBtn.onclick = () => {
      _closeLibraryContextMenu();
      if (typeof window.openMangaCoverPicker === 'function') {
        window.openMangaCoverPicker(manga, {
          sourceId,
          sourceCover: manga._sourceCover || manga.cover,
          currentCover: manga.cover,
        });
      }
    };
  }

  const migrateOneBtn = menu.querySelector('#ctxMigrateOne');
  if (migrateOneBtn) {
    migrateOneBtn.onclick = () => {
      _closeLibraryContextMenu();
      if (typeof showMigrateModalForManga === 'function') {
        showMigrateModalForManga({ ...manga, sourceId });
      } else {
        showToast('Migration', 'Migration UI is not ready yet.', 'warning');
      }
    };
  }

  // Download All
  menu.querySelector('#ctxDownloadAll').onclick = async () => {
    _closeLibraryContextMenu();
    showToast('Download', isBulk ? `Preparing ${actionMangas.length} manga…` : 'Loading chapters…', 'info');

    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid || sid === 'local') { fail++; continue; }

      try {
        state.currentSourceId = sid;
        state.currentManga = item;
        const cr = await api(`/api/source/${sid}/chapters`, {
          method: 'POST', body: JSON.stringify({ mangaId: item.id })
        });
        const chapters = (cr.chapters || []).map((ch, i) => ({
          id: ch.id,
          name: ch.name || `Chapter ${ch.chapter || i + 1}`,
        }));

        if (!chapters.length) { fail++; continue; }

        if (typeof downloadBulkChapters === 'function') {
          await downloadBulkChapters(chapters);
          ok++;
        } else {
          showBulkDownloadModal(cr.chapters || []);
          ok++;
          break;
        }
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    showToast('Download', `${ok} manga processed${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  // Status helpers
  const setStatus = async (status) => {
    _closeLibraryContextMenu();
    let ok = 0;
    let fail = 0;
    for (const item of actionMangas) {
      const sid = item.sourceId
        || state.currentSourceId
        || (state.favorites || []).find(f => String(f.id) === String(item.id))?.sourceId
        || '';
      if (!sid) { fail++; continue; }
      try {
        const res = await api('/api/user/status', {
          method: 'POST',
          body: JSON.stringify({ mangaId: item.id, sourceId: sid, status, mangaData: item }),
        });
        state.readingStatus = res.readingStatus || state.readingStatus;
        ok++;
      } catch (_) {
        fail++;
      }
    }

    _clearLibrarySelection();
    renderLibrary();
    const msg = status === 'none' ? 'set to unread' : `marked as ${statusLabel(status).toLowerCase()}`;
    showToast('Status', `${ok} manga ${msg}${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  };

  menu.querySelector('#ctxMarkCompleted').onclick = () => setStatus('completed');
  menu.querySelector('#ctxMarkReading').onclick   = () => setStatus('reading');
  menu.querySelector('#ctxRemoveStatus').onclick  = () => setStatus('none');

  // AniList status (single or bulk) — updates AniList itself (via
  // SaveMediaListEntry, auto-matching by title for anything not already
  // linked) and mirrors the result into local reading status, same as the
  // single-manga Tracker modal does, just looped over actionMangas.
  const anilistStatusBtn = menu.querySelector('.ctx-anilist-status-btn');
  if (anilistStatusBtn) {
    anilistStatusBtn.onclick = async () => {
      const status = menu.querySelector('#ctxAnilistStatus')?.value;
      if (!status) return;
      anilistStatusBtn.disabled = true;
      anilistStatusBtn.textContent = 'Applying…';
      try {
        const { ok, fail, unmatched } = await anilistBulkSetStatus(actionMangas, status);
        _closeLibraryContextMenu();
        _clearLibrarySelection();
        renderLibrary();
        const parts = [`${ok} updated on AniList`];
        if (unmatched) parts.push(`${unmatched} not found on AniList`);
        if (fail) parts.push(`${fail} failed`);
        showToast('AniList Status', `${parts.join(', ')}.`, (fail || unmatched) ? 'warning' : 'success');
      } catch (err) {
        showToast('AniList Error', err.message || 'Could not update AniList status.', 'error');
        anilistStatusBtn.disabled = false;
        anilistStatusBtn.textContent = isBulk ? `Apply AniList Status to ${actionMangas.length}` : 'Apply AniList Status';
      }
    };
  }

  // Save categories
  const saveCatsBtn = menu.querySelector('.ctx-save-cats-btn');
  if (saveCatsBtn) {
    saveCatsBtn.onclick = async (ev) => {
      ev.stopPropagation();
      const checked = [...menu.querySelectorAll('.ctx-cat-cb:checked')].map(cb => cb.value);
      saveCatsBtn.disabled = true;
      try {
        const payload = {
          mangaId: manga.id,
          sourceId,
          categoryIds: checked,
          mangaData: { ...manga, sourceId },
        };
        const applyForOne = async (oneManga) => {
          const oneSourceId = oneManga.sourceId
            || state.currentSourceId
            || (state.favorites || []).find(f => String(f.id) === String(oneManga.id))?.sourceId
            || '';
          if (!oneSourceId) throw new Error('Could not resolve source id for selected manga.');

          const onePayload = {
            mangaId: oneManga.id,
            sourceId: oneSourceId,
            categoryIds: checked,
            mangaData: { ...oneManga, sourceId: oneSourceId },
          };

          try {
            await api('/api/lists/manga-categories', {
              method: 'PUT',
              body: JSON.stringify(onePayload),
            });
          } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            const isRouteConflict = msg.includes('list not found') || msg.includes('category not found');
            if (!isRouteConflict) throw err;

            const current = await api(`/api/lists/manga/${encodeURIComponent(onePayload.mangaId)}/categories?sourceId=${encodeURIComponent(onePayload.sourceId)}`);
            const currentIds = new Set(current.categoryIds || []);
            const freshLists = await api('/api/lists');
            const validIds = new Set((freshLists.lists || []).map(l => l.id));
            const targetIds = new Set((onePayload.categoryIds || []).filter(id => validIds.has(id)));

            const toAdd = [...targetIds].filter(id => !currentIds.has(id));
            const toRemove = [...currentIds].filter(id => !targetIds.has(id));

            for (const listId of toAdd) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga`, {
                method: 'POST',
                body: JSON.stringify({ mangaData: onePayload.mangaData }),
              });
            }
            for (const listId of toRemove) {
              await api(`/api/lists/${encodeURIComponent(listId)}/manga/${encodeURIComponent(onePayload.mangaId)}`, {
                method: 'DELETE',
              });
            }
          }
        };

        let ok = 0;
        let fail = 0;
        for (const one of actionMangas) {
          try {
            await applyForOne(one);
            ok++;
          } catch (_) {
            fail++;
          }
        }

        await (async () => { try { const d = await api('/api/lists'); state.customLists = d.lists || []; } catch (_) {} })();
        _closeLibraryContextMenu();
        _clearLibrarySelection();
        renderLibrary();
        showToast('Categories', `${ok} manga updated${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
        saveCatsBtn.disabled = false;
      }
    };
  }

  // Prevent checkbox clicks from closing the menu
  menu.querySelectorAll('.ctx-cat-cb').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
  });
  menu.querySelectorAll('.ctx-cat-label').forEach(lbl => {
    lbl.addEventListener('click', e => e.stopPropagation());
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _ctxDocClickHandler, true);
    document.addEventListener('keydown', _ctxMenuKeyHandler);
  }, 0);
}

