// ============================================================================
// GENRE / AUTHOR NAVIGATION
// ============================================================================

async function searchByAuthor(author) {
  if (!author) return;
  if (!state.currentSourceId) { showToast("Select a source first", "", "warning"); return; }
  setView("advanced-search");
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  state.advancedFilters.tags.clear();
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(c => c.classList.remove("active"));
  const statusEl = $("advancedSearchStatus");
  const resultsDiv = $("advancedResults");
  if (statusEl) statusEl.textContent = `Searching author: "${author}"...`;
  try {
    const result = await api(`/api/source/${state.currentSourceId}/authorSearch`, {
      method: "POST",
      body: JSON.stringify({ authorName: author })
    });
    const results = await _filterMangaWithoutChapters(result.results || [], state.currentSourceId);
    if (!results.length) {
      if (resultsDiv) resultsDiv.innerHTML = `<div class="muted">No results found for author "${escapeHtml(author)}"</div>`;
      if (statusEl) statusEl.textContent = `0 result(s) for author "${author}"`;
      return;
    }
    renderMangaGrid(resultsDiv, results);
    if (statusEl) statusEl.textContent = `${results.length} result(s) for author "${author}"`;
  } catch (e) {
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

function searchByGenre(genre) {
  // Clear existing tag filters and add the selected genre
  state.advancedFilters.tags.clear();
  state.advancedFilters.tags.add(genre.toLowerCase());

  // Navigate to advanced search view
  setView("advanced-search");

  // Visually activate the matching genre chip in the advanced search UI
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(chip => {
    const chipTag = chip.dataset.tag || "";
    const isMatch = chipTag.toLowerCase() === genre.toLowerCase();
    chip.classList.toggle("active", isMatch);
    if (isMatch) state.advancedFilters.tags.add(chipTag);
  });

  // Pre-fill the search input and run the search
  const advInput = $("advancedSearchInput");
  if (advInput) advInput.value = "";
  advancedSearch();
}

