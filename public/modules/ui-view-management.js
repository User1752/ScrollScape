// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

function setView(view, context = {}, replace = false) {
  // Update navigation manager
  navigationManager.navigateTo(view, context, replace);

  const ALL_VIEWS = ["discover", "library", "manga-details", "advanced-search", "analytics", "history", "achievements", "shop", "customize", "calendar"];
  for (const v of ALL_VIEWS) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }

  // Sync sidebar active state
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle("active", linkView === view);
  });

  // On-enter actions per view
  const libSideActions = $("librarySideActions");
  if (libSideActions) libSideActions.classList.toggle("active", view === "library");

  if (view === "library") {
    renderLibrary();
  } else if (view === "analytics") {
    renderAnalyticsView();
  } else if (view === "history") {
    renderHistoryView();
  } else if (view === "achievements") {
    renderAchievementsView();
  } else if (view === "shop") {
    renderShopView();
  } else if (view === "customize") {
    renderCustomizeView();
  } else if (view === "calendar") {
    renderCalendarView();
  } else if (view === "manga-details") {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Restore context if available
    const ctx = navigationManager.getContext();
    if (ctx.mangaId && ctx.sourceId) {
      // Context is already set, renderMangaDetails will use it
    }
  }
}

