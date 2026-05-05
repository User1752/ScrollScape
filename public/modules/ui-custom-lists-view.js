// ============================================================================
// CUSTOM LISTS / CATEGORIES VIEW
// Full CRUD: create, edit, delete categories + assign multiple categories to manga.
// ============================================================================

// ── API helpers ──────────────────────────────────────────────────────────────

async function _listsReload() {
  try {
    const data = await api('/api/lists');
    state.customLists = data.lists || [];
  } catch (e) {
    dbg.error('LISTS', 'Failed to reload lists', e);
  }
}

// ── Main management modal ────────────────────────────────────────────────────

async function showManageCategoriesModal() {
  await _listsReload();

  document.querySelector('.manage-categories-modal')?.remove();

  const modal = document.createElement('div');
  modal.className = 'settings-modal manage-categories-modal';

  const renderGrid = () => {
    if (state.customLists.length === 0) {
      return `<div class="muted" style="text-align:center;padding:3rem 0">
        <p style="font-size:1.05rem;margin-bottom:0.5rem">No categories yet.</p>
        <p>Create categories to organise your library.</p>
      </div>`;
    }
    return `<div class="lists-grid" style="margin-top:1rem">` +
      state.customLists.map(list => {
        const count = list.mangaItems?.length || 0;
        return `
          <div class="list-card" data-list-id="${escapeHtml(list.id)}">
            <div class="list-card-actions">
              <button class="btn-icon btn-icon-edit"   data-action="edit"   data-list-id="${escapeHtml(list.id)}" title="Edit">&#9998;</button>
              <button class="btn-icon btn-icon-delete" data-action="delete" data-list-id="${escapeHtml(list.id)}" title="Delete">&#128465;</button>
            </div>
            <div class="list-card-title">${escapeHtml(list.name)}</div>
            <div class="list-card-meta">
              <span class="list-card-count">${count} manga</span>
            </div>
          </div>`;
      }).join('') + `</div>`;
  };

  modal.innerHTML = `
    <div class="settings-content" style="max-width:700px;max-height:85vh;overflow-y:auto">
      <div class="settings-header">
        <h2>Manage Categories</h2>
        <button class="btn secondary" id="closeMgmtModal">&#x2715;</button>
      </div>
      <div class="settings-body">
        <div style="margin-bottom:1rem">
          <button class="btn primary" id="btnCreateListMgmt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Category
          </button>
        </div>
        <div id="mgmt-lists-grid">${renderGrid()}</div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const refresh = async () => {
    await _listsReload();
    $('mgmt-lists-grid').innerHTML = renderGrid();
    renderLibrary(); // update filter dropdown and chips
  };

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  $('closeMgmtModal').onclick = () => { modal.remove(); };

  $('btnCreateListMgmt').onclick = () => showListFormModal(null, refresh);

  $('mgmt-lists-grid').addEventListener('click', async (e) => {
    const editBtn   = e.target.closest('[data-action="edit"]');
    const deleteBtn = e.target.closest('[data-action="delete"]');
    const card      = e.target.closest('.list-card');

    if (editBtn) {
      const list = state.customLists.find(l => l.id === editBtn.dataset.listId);
      if (list) showListFormModal(list, refresh);
      return;
    }
    if (deleteBtn) {
      await _deleteList(deleteBtn.dataset.listId, refresh);
      return;
    }
    if (card) {
      const list = state.customLists.find(l => l.id === card.dataset.listId);
      if (list) showListDetailModal(list, refresh);
    }
  });
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function showListFormModal(list = null, onDone = null) {
  document.querySelector('.list-form-modal')?.remove();

  const isEdit = !!list;
  const modal  = document.createElement('div');
  modal.className = 'settings-modal list-form-modal';
  modal.innerHTML = `
    <div class="settings-content" style="max-width:480px">
      <div class="settings-header">
        <h2>${isEdit ? 'Edit Category' : 'New Category'}</h2>
        <button class="btn secondary" id="closeListForm">&#x2715;</button>
      </div>
      <div class="settings-body">
        <div class="setting-group">
          <label>Name <span style="color:var(--danger)">*</span></label>
          <input type="text" id="listNameInput" class="input" maxlength="100"
                 value="${isEdit ? escapeHtml(list.name) : ''}" placeholder="Category name…" autocomplete="off">
        </div>
        <div class="setting-group" style="display:flex;gap:8px">
          <button class="btn primary" id="saveListBtn">${isEdit ? 'Save Changes' : 'Create'}</button>
          <button class="btn secondary" id="closeListForm2">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  $('closeListForm').onclick  = () => modal.remove();
  $('closeListForm2').onclick = () => modal.remove();

  $('saveListBtn').onclick = async () => {
    const name = $('listNameInput').value.trim();
    if (!name) { showToast('Category', 'Name is required.', 'warning'); return; }

    const saveBtn = $('saveListBtn');
    saveBtn.disabled = true;

    try {
      if (isEdit) {
        await api(`/api/lists/${list.id}`, { method: 'PUT', body: JSON.stringify({ name }) });
        showToast('Category', `"${name}" updated.`, 'success');
      } else {
        await api('/api/lists', { method: 'POST', body: JSON.stringify({ name }) });
        showToast('Category', `"${name}" created.`, 'success');
      }
      modal.remove();
      if (onDone) await onDone();
      else showManageCategoriesModal();
    } catch (err) {
      showToast('Error', err.message || 'Could not save category.', 'error');
      saveBtn.disabled = false;
    }
  };

  // Focus the name field
  setTimeout(() => $('listNameInput')?.focus(), 50);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function _deleteList(listId, onDone = null) {
  const list = state.customLists.find(l => l.id === listId);
  if (!list) return;
  const count = list.mangaItems?.length || 0;
  const msg   = count > 0
    ? `Delete category "${list.name}"? It contains ${count} manga (they won't be deleted).`
    : `Delete category "${list.name}"?`;
  if (!confirm(msg)) return;

  try {
    await api(`/api/lists/${listId}`, { method: 'DELETE' });
    showToast('Category', `"${list.name}" deleted.`, 'info');
    if (onDone) await onDone();
    else showManageCategoriesModal();
  } catch (err) {
    showToast('Error', err.message || 'Could not delete category.', 'error');
  }
}

// ── Detail modal (manga inside a category) ────────────────────────────────────

function showListDetailModal(list, onDone = null) {
  document.querySelector('.list-detail-modal')?.remove();

  const modal = document.createElement('div');
  modal.className = 'settings-modal list-detail-modal';

  const renderItems = () => {
    const items = list.mangaItems || [];
    if (items.length === 0) {
      return `<div class="muted" style="padding:2rem 0;text-align:center">No manga in this category yet.<br>Add manga from the Library or manga detail page.</div>`;
    }
    return `<div class="lists-grid" style="margin-top:1rem">` +
      items.map(m => `
        <div class="list-card" style="cursor:default">
          <div class="list-card-actions">
            <button class="btn-icon btn-icon-delete" data-action="remove-from-list" data-manga-id="${escapeHtml(m.id)}" title="Remove from category">&#x2715;</button>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="" style="width:40px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0">` : '<div style="width:40px;height:56px;background:var(--bg-tertiary);border-radius:4px;flex-shrink:0"></div>'}
            <div>
              <div class="list-card-title" style="font-size:0.9rem">${escapeHtml(m.title || '')}</div>
              ${m.sourceId ? `<div style="font-size:0.75rem;color:var(--text-secondary)">${escapeHtml(m.sourceId)}</div>` : ''}
            </div>
          </div>
        </div>`).join('') + `</div>`;
  };

  modal.innerHTML = `
    <div class="settings-content" style="max-width:700px;max-height:80vh;overflow-y:auto">
      <div class="settings-header">
        <h2>${escapeHtml(list.name)}</h2>
        <button class="btn secondary" id="closeListDetail">&#x2715;</button>
      </div>
      <div class="settings-body">
        <div id="listDetailItems">${renderItems()}</div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  $('closeListDetail').onclick = () => modal.remove();

  modal.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-action="remove-from-list"]');
    if (!removeBtn) return;
    const mangaId = removeBtn.dataset.mangaId;
    try {
      await api(`/api/lists/${list.id}/manga/${mangaId}`, { method: 'DELETE' });
      list.mangaItems = list.mangaItems.filter(m => m.id !== mangaId);
      $('listDetailItems').innerHTML = renderItems();
      // Sync state and update library chips
      const idx = state.customLists.findIndex(l => l.id === list.id);
      if (idx >= 0) state.customLists[idx] = { ...list };
      renderLibrary();
    } catch (err) {
      showToast('Error', err.message || 'Could not remove manga.', 'error');
    }
  });
}

// ── Category assignment modal (shown from library / manga detail) ─────────────

async function showCategoryModal(manga) {
  document.querySelector('.category-assign-modal')?.remove();

  // Resolve a stable sourceId (required by backend endpoint)
  const resolvedSourceId = manga?.sourceId
    || state.currentSourceId
    || (state.favorites || []).find(f => String(f.id) === String(manga?.id))?.sourceId
    || '';

  if (!resolvedSourceId) {
    showToast('Categories', 'Could not resolve source for this manga.', 'warning');
    return;
  }

  // Ensure lists are up to date
  await _listsReload();

  // Get current categories for this manga
  let currentCategoryIds = [];
  try {
    const data = await api(`/api/lists/manga/${encodeURIComponent(manga.id)}/categories?sourceId=${encodeURIComponent(resolvedSourceId)}`);
    currentCategoryIds = data.categoryIds || [];
  } catch (_) {}

  const modal = document.createElement('div');
  modal.className = 'settings-modal category-assign-modal';

  const renderList = () => {
    if (state.customLists.length === 0) {
      return `<div class="muted" style="text-align:center;padding:1.5rem 0">No categories yet. Create one first.</div>`;
    }
    return state.customLists.map(l => {
      const checked = currentCategoryIds.includes(l.id);
      const count   = l.mangaItems?.length || 0;
      return `
        <label class="toggle-label" style="margin-bottom:0.75rem;cursor:pointer">
          <input type="checkbox" class="category-checkbox" value="${escapeHtml(l.id)}" ${checked ? 'checked' : ''} style="width:16px;height:16px;margin-right:8px;accent-color:var(--primary)">
          <span class="toggle-text" style="font-size:0.95rem">${escapeHtml(l.name)}</span>
          <span style="margin-left:auto;font-size:0.8rem;color:var(--text-secondary)">${count} manga</span>
        </label>`;
    }).join('');
  };

  modal.innerHTML = `
    <div class="settings-content" style="max-width:440px">
      <div class="settings-header">
        <h2>Assign Categories</h2>
        <button class="btn secondary" id="closeCatModal">&#x2715;</button>
      </div>
      <div class="settings-body">
        <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:0.9rem">${escapeHtml(manga.title || '')}</p>
        <div id="catCheckboxList">${renderList()}</div>
        <div style="display:flex;gap:8px;margin-top:1.5rem;flex-wrap:wrap">
          <button class="btn primary"   id="saveCatBtn">Save</button>
          <button class="btn secondary" id="newCatFromModal">+ New Category</button>
          <button class="btn secondary" id="closeCatModal2">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  $('closeCatModal').onclick  = () => modal.remove();
  $('closeCatModal2').onclick = () => modal.remove();

  $('newCatFromModal').onclick = async () => {
    modal.remove();
    showListFormModal(null, () => showCategoryModal(manga));
  };

  $('saveCatBtn').onclick = async () => {
    const checked = [...modal.querySelectorAll('.category-checkbox:checked')].map(cb => cb.value);
    const saveBtn = $('saveCatBtn');
    saveBtn.disabled = true;
    try {
      const payload = {
        mangaId: manga.id,
        sourceId: resolvedSourceId,
        categoryIds: checked,
        mangaData: { ...manga, sourceId: resolvedSourceId },
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
      // Refresh in-memory lists and update library card chips
      await _listsReload();
      modal.remove();
      showToast('Categories', 'Saved successfully.', 'success');
      renderLibrary();
    } catch (err) {
      showToast('Error', err.message || 'Could not save categories.', 'error');
      saveBtn.disabled = false;
    }
  };
}
