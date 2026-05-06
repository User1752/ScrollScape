// ============================================================================
// READING STATUS
// ============================================================================

async function loadReadingStatus() {
  try {
    const data = await api("/api/user/status");
    state.readingStatus = data.readingStatus || {};
  } catch (e) { /* non-fatal */ }
}

function _statusStoreKeyPart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_');
}

function _statusStoreKey(mangaId, sourceId) {
  return `${_statusStoreKeyPart(mangaId)}:${_statusStoreKeyPart(sourceId || 'unknown')}`;
}

function getMangaStatus(mangaId, sourceId) {
  return state.readingStatus[_statusStoreKey(mangaId, sourceId)]?.status || null;
}

function renderReadingStatusSection(mangaId, sourceId) {
  const section = $("readingStatusSection");
  if (!section) return;
  const current = getMangaStatus(mangaId, sourceId);
  section.innerHTML = `
    <div class="status-selector-section">
      <span class="status-selector-label">Reading Status:</span>
      <select class="status-select" id="mangaStatusSelect">
        <option value="none" ${!current ? "selected" : ""}>— Not Set —</option>
        <option value="reading"      ${current === "reading"       ? "selected" : ""}>Reading</option>
        <option value="completed"    ${current === "completed"     ? "selected" : ""}>Completed</option>
        <option value="on_hold"      ${current === "on_hold"       ? "selected" : ""}>On Hold</option>
        <option value="plan_to_read" ${current === "plan_to_read"  ? "selected" : ""}>Plan to Read</option>
        <option value="dropped"      ${current === "dropped"       ? "selected" : ""}>Dropped</option>
      </select>
      ${current ? `<span class="status-badge status-badge-${current}">${statusLabel(current)}</span>` : ""}
    </div>
  `;
  $("mangaStatusSelect").onchange = async (e) => {
    const newStatus = e.target.value;
    try {
      await api("/api/user/status", {
        method: "POST",
        body: JSON.stringify({
          mangaId, sourceId, status: newStatus,
          mangaData: state.currentManga || {}
        })
      });
      const key = _statusStoreKey(mangaId, sourceId);
      state.readingStatus[key] = newStatus !== "none"
        ? { status: newStatus, updatedAt: new Date().toISOString() }
        : undefined;
      if (newStatus === "none") delete state.readingStatus[key];
      showToast("Status Updated", statusLabel(newStatus), "success");
      renderReadingStatusSection(mangaId, sourceId);
      renderLibrary();
      await checkAndUnlockAchievements();
    } catch (err) {
      showToast("Error", err.message, "error");
    }
  };
}

