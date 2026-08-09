// ============================================================================
// LOCAL MANGA IMPORT MODAL
// ============================================================================
let _importFile = null;

function showImportModal() {
  _importFile = null;
  if ($("importTitleInput"))  $("importTitleInput").value  = "";
  if ($("importFileName"))   { $("importFileName").textContent = ""; $("importFileName").classList.add("hidden"); }
  if ($("importProgress"))   $("importProgress").classList.add("hidden");
  if ($("importError"))      { $("importError").textContent = ""; $("importError").classList.add("hidden"); }
  if ($("importSubmitBtn"))  $("importSubmitBtn").disabled = true;
  if ($("importFileInput"))  $("importFileInput").value = "";
  $("importLocalModal").classList.remove("hidden");

  // Drag and drop
  const zone = $("importDropZone");
  if (zone && !zone._ddBound) {
    zone._ddBound = true;
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drop-active"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop-active"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("drop-active");
      const file = e.dataTransfer.files[0];
      if (file) setImportFile(file);
    });
  }
}

function closeImportModal() {
  $("importLocalModal").classList.add("hidden");
  _importFile = null;
}

function onImportFileSelected(event) {
  const file = event.target.files[0];
  if (file) setImportFile(file);
}

function setImportFile(file) {
  const allowed = ['.cbz', '.cbr', '.zip', '.pdf', '.epub'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    if ($("importError")) { $("importError").textContent = "Unsupported format. Use CBZ, CBR, ZIP, PDF or EPUB."; $("importError").classList.remove("hidden"); }
    return;
  }
  _importFile = file;
  if ($("importFileName"))  { $("importFileName").textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`; $("importFileName").classList.remove("hidden"); }
  if ($("importError"))     $("importError").classList.add("hidden");
  if ($("importSubmitBtn")) $("importSubmitBtn").disabled = false;
  // Pre-fill title from filename if empty
  const titleInput = $("importTitleInput");
  if (titleInput && !titleInput.value) {
    titleInput.value = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[_\-]+/g, ' ');
  }
}

async function submitImport() {
  if (!_importFile) return;
  const title = $("importTitleInput")?.value?.trim() || "";
  const submitBtn = $("importSubmitBtn");
  const progressEl = $("importProgress");
  const errorEl   = $("importError");
  const fillEl    = $("importProgressFill");
  const labelEl   = $("importProgressLabel");

  if (submitBtn) submitBtn.disabled = true;
  if (errorEl)  { errorEl.textContent = ""; errorEl.classList.add("hidden"); }
  if (progressEl) progressEl.classList.remove("hidden");
  if (fillEl)   fillEl.style.width = "10%";
  if (labelEl)  labelEl.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("file", _importFile);
    if (title) formData.append("title", title);

    // Simulate progress while uploading
    let pct = 10;
    const progTimer = setInterval(() => {
      pct = Math.min(pct + 5, 85);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (labelEl) labelEl.textContent = pct < 50 ? "Uploading..." : "Extracting...";
    }, 400);

    const resp = await fetch("/api/local/import", { method: "POST", body: formData });
    clearInterval(progTimer);

    if (fillEl)   fillEl.style.width = "100%";
    if (labelEl)  labelEl.textContent = "Done!";

    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || "Import failed");

    state.localManga.push(data.manga);

    // For PDFs, render page 1 via PDF.js and upload as cover image
    if (_importFile.name.toLowerCase().endsWith('.pdf') && window.pdfjsLib && data.manga?.id) {
      try {
        if (labelEl) labelEl.textContent = "Generating cover...";
        const fileUrl = URL.createObjectURL(_importFile);
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        URL.revokeObjectURL(fileUrl);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
        if (blob) {
          const coverResp = await fetch(`/api/local/${data.manga.id}/cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob
          });
          if (coverResp.ok) {
            const coverData = await coverResp.json();
            data.manga.cover = coverData.cover;
            const idx = state.localManga.findIndex(m => m.id === data.manga.id);
            if (idx !== -1) state.localManga[idx].cover = coverData.cover;
          }
        }
      } catch (coverErr) {
        dbg.warn(dbg.ERR_COVER, 'Cover generation failed', coverErr);
      }
    }

    // For EPUBs, ask epub.js for the book's own declared cover image
    // (falls back to nothing if the EPUB doesn't define one — same
    // "best effort" spirit as the PDF branch above).
    //
    // Must hand epub.js an ArrayBuffer, not a blob: URL string: epub.js
    // picks how to parse an input by sniffing the URL's file extension
    // when given a string, and a blob: URL has none (e.g.
    // "blob:http://host/<uuid>") — it gets misread as an unpacked-book
    // directory and epub.js goes looking for a container.xml that was
    // never there, a lookup that neither resolves nor rejects. Passing
    // the raw bytes sidesteps that type-sniffing path entirely.
    if (_importFile.name.toLowerCase().endsWith('.epub') && window.ePub && data.manga?.id) {
      let book = null;
      try {
        if (labelEl) labelEl.textContent = "Generating cover...";
        const arrayBuffer = await _importFile.arrayBuffer();
        book = ePub(arrayBuffer);
        const coverUrl = await Promise.race([
          book.coverUrl(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('EPUB cover lookup timed out')), 8000)),
        ]);
        if (coverUrl) {
          const blob = await (await fetch(coverUrl)).blob();
          const coverResp = await fetch(`/api/local/${data.manga.id}/cover`, {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'image/jpeg' },
            body: blob
          });
          if (coverResp.ok) {
            const coverData = await coverResp.json();
            data.manga.cover = coverData.cover;
            const idx = state.localManga.findIndex(m => m.id === data.manga.id);
            if (idx !== -1) state.localManga[idx].cover = coverData.cover;
          }
          URL.revokeObjectURL(coverUrl);
        }
      } catch (coverErr) {
        dbg.warn(dbg.ERR_COVER, 'EPUB cover generation failed', coverErr);
      } finally {
        if (book) book.destroy();
      }
    }

    showToast("Imported!", data.manga.title, "success");
    setTimeout(() => {
      closeImportModal();
      renderLibrary();
    }, 600);
  } catch (e) {
    if (progressEl) progressEl.classList.add("hidden");
    if (errorEl)    { errorEl.textContent = e.message; errorEl.classList.remove("hidden"); }
    if (submitBtn)  submitBtn.disabled = false;
  }
}

async function generateMissingPDFCovers() {
  // Wait up to 10 s for PDF.js to load from CDN
  if (!window.pdfjsLib) {
    await new Promise(resolve => {
      let waited = 0;
      const iv = setInterval(() => {
        waited += 250;
        if (window.pdfjsLib || waited >= 10000) { clearInterval(iv); resolve(); }
      }, 250);
    });
  }
  if (!window.pdfjsLib) return;
  const pending = state.localManga.filter(m => m.cover && m.cover.endsWith('.pdf'));
  for (const manga of pending) {
    try {
      const pdf = await pdfjsLib.getDocument(manga.cover).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) continue;
      const resp = await fetch(`/api/local/${manga.id}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob
      });
      if (resp.ok) {
        const data = await resp.json();
        manga.cover = data.cover;
      }
    } catch (e) {
      dbg.warn(dbg.ERR_COVER, `Cover generation failed for ${manga.id}`, e);
    }
  }
  if (pending.length > 0) renderLibrary();
}

async function generateMissingEpubCovers() {
  // Wait up to 10 s for epub.js to load from CDN (same convention as the
  // PDF.js wait above).
  if (!window.ePub) {
    await new Promise(resolve => {
      let waited = 0;
      const iv = setInterval(() => {
        waited += 250;
        if (window.ePub || waited >= 10000) { clearInterval(iv); resolve(); }
      }, 250);
    });
  }
  if (!window.ePub) return;
  const pending = state.localManga.filter(m => m.cover && m.cover.endsWith('.epub'));
  for (const manga of pending) {
    let book = null;
    try {
      book = ePub(manga.cover);
      const coverUrl = await Promise.race([
        book.coverUrl(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('EPUB cover lookup timed out')), 8000)),
      ]);
      if (!coverUrl) continue; // EPUB has no declared cover image — leave as-is
      const blob = await (await fetch(coverUrl)).blob();
      URL.revokeObjectURL(coverUrl);
      const resp = await fetch(`/api/local/${manga.id}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob
      });
      if (resp.ok) {
        const data = await resp.json();
        manga.cover = data.cover;
      }
    } catch (e) {
      dbg.warn(dbg.ERR_COVER, `EPUB cover generation failed for ${manga.id}`, e);
    } finally {
      if (book) book.destroy();
    }
  }
  if (pending.length > 0) renderLibrary();
}

