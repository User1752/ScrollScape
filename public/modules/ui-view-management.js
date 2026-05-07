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
    const libStatusFilter = $("libraryStatusFilter");
    if (libStatusFilter) {
      // Reset user override so default is reapplied on each visit
      libStatusFilter.dataset.userChanged = "";
      const def = state.settings.libraryDefaultStatusFilter || "all";
      libStatusFilter.value = def;
      // Dispatch change so the custom select component syncs its visible label;
      // use a flag so the onchange handler knows to skip the user-changed marking.
      libStatusFilter.dataset.settingSync = "1";
      libStatusFilter.dispatchEvent(new Event("change", { bubbles: true }));
      libStatusFilter.dataset.settingSync = "";
    }
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

