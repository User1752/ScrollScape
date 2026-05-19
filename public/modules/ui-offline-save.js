// ============================================================================
// OFFLINE SAVE
// ============================================================================

async function saveChapterOffline(chapterId, chapterName) {
  showToast("Saving...", `Saving "${chapterName}" for offline reading`, "info");
  try {
    const resp = await fetch("/api/local/save-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: state.currentSourceId,
        chapterId,
        chapterName,
        mangaTitle: state.currentManga?.title || "Unknown",
        mangaId: state.currentManga?.id || "",
        cover: state.currentManga?.cover || ""
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast("Error", err.error || "Could not save chapter offline", "error");
      return;
    }
    const data = await resp.json();
    if (data.skipped) {
      showToast("Already Saved", `"${chapterName}" is already in your offline library`, "info");
    } else {
      if (!state.offlineChapters) state.offlineChapters = new Set();
      state.offlineChapters.add(String(chapterId));
      if (typeof renderChaptersList === 'function') renderChaptersList();
      showToast("Saved Offline", `"${chapterName}" saved. Open the Library tab to read it offline.`, "success");
    }
  } catch (e) {
    showToast("Error", `Save offline failed: ${e.message}`, "error");
  }
}

async function saveBulkOffline(selectedChapters) {
  // Step 1 — start the save job on the server
  let jobId;
  try {
    const startResp = await fetch("/api/local/save-bulk/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: state.currentSourceId,
        mangaTitle: state.currentManga?.title || "Unknown",
        mangaId: state.currentManga?.id || "",
        cover: state.currentManga?.cover || "",
        chapters: selectedChapters
      })
    });
    if (!startResp.ok) {
      const err = await startResp.json().catch(() => ({}));
      showToast("Error", err.error || "Could not start offline save", "error");
      return;
    }
    ({ jobId } = await startResp.json());
  } catch (e) {
    showToast("Error", `Offline save failed: ${e.message}`, "error");
    return;
  }

  // Step 2 — show progress modal and listen to SSE
  showBulkProgressModal(selectedChapters.length);
  const saveModal = $("bulkProgressModal");
  if (saveModal) {
    const h2 = saveModal.querySelector("h2");
    if (h2) h2.textContent = "Saving Offline...";
  }

  await new Promise((resolve) => {
    const es = new EventSource(`/api/local/save-bulk/progress/${jobId}`);

    es.addEventListener('progress', (e) => {
      const { done, total, chapter } = JSON.parse(e.data);
      updateBulkProgress(done, total, chapter);
    });

    es.addEventListener('done', () => {
      es.close();
      updateBulkProgress(selectedChapters.length, selectedChapters.length, '');
      setTimeout(() => closeBulkProgressModal(), 800);
      
      if (!state.offlineChapters) state.offlineChapters = new Set();
      selectedChapters.forEach(ch => state.offlineChapters.add(String(ch.id)));
      if (typeof renderChaptersList === 'function') renderChaptersList();

      showToast("Saved to Library", `${selectedChapters.length} chapter(s) saved. Open the Library tab to read offline.`, "success");
      resolve();
    });

    es.addEventListener('error', (e) => {
      es.close();
      const msg = e.data ? JSON.parse(e.data).error : 'Unknown error';
      closeBulkProgressModal();
      showToast("Error", msg || "Offline save failed", "error");
      resolve();
    });
  });
}

