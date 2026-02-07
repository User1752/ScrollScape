// ============================================================================
// API & STATE
// ============================================================================

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const state = {
  repos: [],
  availableSources: [],
  installedSources: {},
  currentSourceId: null,
  currentManga: null,
  currentChapter: null,
  currentChapterIndex: 0,
  currentPageIndex: 0,
  favorites: [],
  history: [],
  readChapters: new Set(),
  allChapters: [],
  selectedGenres: new Set(),
  selectedStatuses: new Set(),
  sortBy: "relevance",
  allGenres: [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy",
    "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
    "Supernatural", "Thriller", "Psychological", "School", "Shounen",
    "Shoujo", "Seinen", "Josei", "Martial Arts", "Sports"
  ],
  settings: {
    language: "pt",
    readingMode: "ltr",
    skipReadChapters: false,
    skipDuplicates: true,
    panWideImages: false
  },
  libraryTags: {}, // Novo: armazenar tags por manga
  selectedMangaForContext: null, // Novo: para context menu
  popularToday: [],
  lastReadPages: {},
  lastReadChapter: {},
  advancedFilters: {
    orderBy: "relevance",
    statuses: new Set(),
    tags: new Set()
  }
};

// ============================================================================
// UTILITIES
// ============================================================================
function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================
function loadSettings() {
  try {
    const saved = localStorage.getItem("manghuSettings");
    if (saved) {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    }
    const readChaps = localStorage.getItem("manghuReadChapters");
    if (readChaps) {
      state.readChapters = new Set(JSON.parse(readChaps));
    }
    const tags = localStorage.getItem("manghuLibraryTags");
    if (tags) {
      state.libraryTags = JSON.parse(tags);
    }
    const progress = localStorage.getItem("manghuReadingProgress");
    if (progress) {
      const parsed = JSON.parse(progress);
      state.lastReadPages = parsed.pages || {};
      state.lastReadChapter = parsed.chapters || {};
    }
  } catch (e) {
    console.warn("Erro ao carregar configurações:", e);
  }
}

function saveSettings() {
  localStorage.setItem("manghuSettings", JSON.stringify(state.settings));
  localStorage.setItem("manghuReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("manghuLibraryTags", JSON.stringify(state.libraryTags));
  localStorage.setItem("manghuReadingProgress", JSON.stringify({
    pages: state.lastReadPages,
    chapters: state.lastReadChapter
  }));
}

function markChapterAsRead(mangaId, chapterId) {
  const key = `${mangaId}:${chapterId}`;
  state.readChapters.add(key);
  saveSettings();
}

function isChapterRead(mangaId, chapterId) {
  const key = `${mangaId}:${chapterId}`;
  return state.readChapters.has(key);
}

function updateReadingProgress(mangaId, chapterId, pageIndex) {
  if (!mangaId || !chapterId) return;
  state.lastReadPages[`${mangaId}:${chapterId}`] = pageIndex;
  state.lastReadChapter[mangaId] = chapterId;
  saveSettings();
}

// ============================================================================
// STATE & RENDERING
// ============================================================================
async function refreshState() {
  try {
    const data = await api("/api/state");
    state.installedSources = data.installedSources || {};
    
    const libData = await api("/api/library");
    state.favorites = libData.favorites || [];
    state.history = libData.history || [];
    
    renderSourceSelect();
    await loadPopularToday();
    await loadRecentlyAdded();
    await loadLatestUpdates();
    updateStats();
    renderLibrary();
  } catch (e) {
    console.error("Erro ao carregar estado:", e);
  }
}

function renderSourceSelect() {
  const sel = $("sourceSelect");
  if (!sel) return;
  
  sel.innerHTML = "";
  const installed = Object.values(state.installedSources);
  
  if (installed.length === 0) {
    sel.innerHTML = `<option value="">(Instale uma fonte primeiro)</option>`;
    state.currentSourceId = null;
    return;
  }
  
  for (const s of installed) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  }
  
  if (!state.currentSourceId || !state.installedSources[state.currentSourceId]) {
    state.currentSourceId = installed[0].id;
  }
  sel.value = state.currentSourceId;
  sel.onchange = async () => {
    state.currentSourceId = sel.value;
    await loadPopularToday();
  };
}

// ============================================================================
// POPULAR TODAY
// ============================================================================
async function loadPopularToday() {
  const row = $("popularRow");
  if (!row || !state.currentSourceId) return;

  row.innerHTML = `<div class="muted">Carregando populares do dia...</div>`;

  try {
    if (state.currentSourceId !== "mangadex") {
      row.innerHTML = `<div class="muted">Populares do dia indisponível para esta fonte.</div>`;
      return;
    }

    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1 })
    });

    const list = (result.results || []).slice(0, 10);
    if (list.length === 0) {
      row.innerHTML = `<div class="muted">Sem populares do dia.</div>`;
      return;
    }

    row.innerHTML = list.map(m => `
      <div class="manga-card" data-manga-id="${escapeHtml(m.id)}">
        <div class="manga-card-cover">
          ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : '<div class="no-cover">?</div>'}
        </div>
        <div class="manga-card-info">
          <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
          <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
        </div>
      </div>
    `).join("");

    row.querySelectorAll("[data-manga-id]").forEach(el => {
      el.onclick = async () => {
        const mangaId = el.dataset.mangaId;
        await loadMangaDetails(mangaId);
      };
    });
  } catch (e) {
    row.innerHTML = `<div class="muted">Erro ao carregar populares do dia.</div>`;
  }
}

// ============================================================================
// RECENTLY ADDED & LATEST UPDATES
// ============================================================================
async function loadRecentlyAdded() {
  const row = $("recentlyAddedRow");
  if (!row || !state.currentSourceId) return;

  row.innerHTML = `<div class="muted">Carregando mangás recentes...</div>`;

  try {
    if (state.currentSourceId !== "mangadex") {
      row.innerHTML = `<div class="muted">Indisponível para esta fonte.</div>`;
      return;
    }

    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ 
        query: "*", 
        page: 1,
        orderBy: "createdAt"
      })
    });

    const list = (result.results || []).slice(0, 12);
    if (list.length === 0) {
      row.innerHTML = `<div class="muted">Sem mangás recentes.</div>`;
      return;
    }

    renderMangaGrid(row, list);
  } catch (e) {
    row.innerHTML = `<div class="muted">Erro ao carregar mangás recentes.</div>`;
  }
}

async function loadLatestUpdates() {
  const row = $("latestUpdatesRow");
  if (!row || !state.currentSourceId) return;

  row.innerHTML = `<div class="muted">Carregando mangás atualizados...</div>`;

  try {
    if (state.currentSourceId !== "mangadex") {
      row.innerHTML = `<div class="muted">Indisponível para esta fonte.</div>`;
      return;
    }

    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ 
        query: "*", 
        page: 1,
        orderBy: "latestUploadedChapter"
      })
    });

    const list = (result.results || []).slice(0, 12);
    if (list.length === 0) {
      row.innerHTML = `<div class="muted">Sem atualizações recentes.</div>`;
      return;
    }

    renderMangaGrid(row, list);
  } catch (e) {
    row.innerHTML = `<div class="muted">Erro ao carregar atualizações.</div>`;
  }
}

function renderMangaGrid(container, mangaList) {
  container.innerHTML = mangaList.map(m => `
    <div class="manga-card" data-manga-id="${escapeHtml(m.id)}">
      <div class="manga-card-cover">
        ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : '<div class="no-cover">?</div>'}
      </div>
      <div class="manga-card-info">
        <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
        <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-manga-id]").forEach(el => {
    el.onclick = async () => {
      const mangaId = el.dataset.mangaId;
      await loadMangaDetails(mangaId);
    };
  });
}

// ============================================================================
// STATISTICS
// ============================================================================
function updateStats() {
  const totalLibrary = state.favorites.length;
  const completed = state.favorites.filter(m => m.status === "completed").length;
  const chaptersRead = state.readChapters.size;

  const statTotal = $("statTotalLibrary");
  const statCompleted = $("statCompleted");
  const statChapters = $("statChaptersRead");

  if (statTotal) statTotal.textContent = totalLibrary;
  if (statCompleted) statCompleted.textContent = completed;
  if (statChapters) statChapters.textContent = chaptersRead;
}

// ============================================================================
// LIBRARY RENDERING
// ============================================================================
function renderLibrary() {
  const libraryGrid = $("library-grid");
  if (!libraryGrid) return;

  if (state.favorites.length === 0) {
    libraryGrid.innerHTML = `<div class="muted">Nenhum mangá nos favoritos. Adicione seus mangás favoritos para vê-los aqui!</div>`;
    return;
  }

  libraryGrid.innerHTML = state.favorites.map(manga => `
    <div class="library-card" data-manga-id="${escapeHtml(manga.id)}" data-source-id="${escapeHtml(manga.sourceId || state.currentSourceId)}">
      <div class="library-card-cover">
        ${manga.cover ? `<img src="${escapeHtml(manga.cover)}" alt="${escapeHtml(manga.title)}">` : '<div class="no-cover">?</div>'}
        <div class="library-card-overlay">
          <button class="btn-read">📖 Continuar Leitura</button>
        </div>
      </div>
      <div class="library-card-info">
        <h3 class="library-card-title">${escapeHtml(manga.title)}</h3>
        <p class="library-card-author">${escapeHtml(manga.author || "")}</p>
      </div>
    </div>
  `).join("");

  libraryGrid.querySelectorAll(".library-card").forEach(card => {
    const mangaId = card.dataset.mangaId;
    const sourceId = card.dataset.sourceId;
    
    card.onclick = async (e) => {
      if (e.target.closest(".btn-read")) {
        // Se clicar no botão "Continuar Leitura"
        const savedSourceId = state.currentSourceId;
        state.currentSourceId = sourceId;
        await loadMangaDetails(mangaId);
        state.currentSourceId = savedSourceId;
      } else {
        // Se clicar no card
        const savedSourceId = state.currentSourceId;
        state.currentSourceId = sourceId;
        await loadMangaDetails(mangaId);
        state.currentSourceId = savedSourceId;
      }
    };
  });
}

// ============================================================================
// SEARCH & MANGA DETAILS
// ============================================================================
async function search() {
  const query = $("searchInput").value.trim();
  
  if (!state.currentSourceId) {
    $("searchStatus").textContent = "Selecione uma fonte primeiro.";
    return;
  }
  
  if (!query) {
    $("searchStatus").textContent = "Digite um termo de pesquisa.";
    return;
  }

  $("searchStatus").textContent = "Pesquisando...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query, page: 1 })
    });

    const results = result.results || [];
    const resultsDiv = $("results");

    if (results.length === 0) {
      resultsDiv.innerHTML = `<div class="muted">Nenhum resultado encontrado</div>`;
      $("searchStatus").textContent = "0 resultado(s) encontrado(s)";
    } else {
      renderMangaGrid(resultsDiv, results);
      $("searchStatus").textContent = `${results.length} resultado(s) encontrado(s)`;
    }
  } catch (e) {
    $("searchStatus").textContent = `Erro: ${e.message}`;
  }
}

async function loadMangaDetails(mangaId) {
  $("searchStatus").textContent = "Carregando detalhes...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/mangaDetails`, {
      method: "POST",
      body: JSON.stringify({ mangaId })
    });

    state.currentManga = result;
    
    // Verificar se já está nos favoritos
    const isFavorited = state.favorites.some(m => 
      m.id === result.id && m.sourceId === state.currentSourceId
    );
    
    // Mostrar página de detalhes
    setView("manga-details");
    
    const detDiv = $("details");
    detDiv.innerHTML = `
      <div class="manga-details">
        ${result.cover ? `
          <div class="manga-cover">
            <img src="${escapeHtml(result.cover)}" alt="${escapeHtml(result.title)}">
          </div>
        ` : ""}
        <div class="manga-info">
          <h2 class="manga-title">${escapeHtml(result.title)}</h2>
          ${result.altTitle ? `<p class="manga-alt-title">${escapeHtml(result.altTitle)}</p>` : ""}
          ${result.author ? `<p class="manga-author">✍️ ${escapeHtml(result.author)}</p>` : ""}
          
          <div class="manga-meta">
            ${result.status ? `<span class="badge badge-${result.status === 'ongoing' ? 'success' : 'secondary'}">${escapeHtml(result.status)}</span>` : ""}
            ${result.year ? `<span class="badge">📅 ${escapeHtml(result.year)}</span>` : ""}
          </div>

          ${result.genres && result.genres.length > 0 ? `
            <div class="manga-genres">
              ${result.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join("")}
            </div>
          ` : ""}

          ${result.description ? `
            <div class="manga-description">
              <p>${escapeHtml(result.description)}</p>
            </div>
          ` : ""}

          <div class="manga-actions">
            <button class="btn" id="addFavBtn">${isFavorited ? '❤️ Remover dos Favoritos' : '⭐ Adicionar aos Favoritos'}</button>
          </div>
        </div>
      </div>
    `;

    $("addFavBtn").onclick = async () => {
      try {
        const response = await api("/api/favorites/toggle", {
          method: "POST",
          body: JSON.stringify({
            mangaId: state.currentManga.id,
            sourceId: state.currentSourceId,
            manga: state.currentManga
          })
        });
        
        if (response.isFavorite) {
          $("addFavBtn").textContent = "❤️ Remover dos Favoritos";
          $("addFavBtn").style.background = "linear-gradient(135deg, var(--danger) 0%, #c42a2a 100%)";
        } else {
          $("addFavBtn").textContent = "⭐ Adicionar aos Favoritos";
          $("addFavBtn").style.background = "";
        }
        
        await refreshState();
      } catch (e) {
        console.error(e);
        alert("Erro ao atualizar favoritos");
      }
    };

    await loadChapters();
    $("searchStatus").textContent = "";
  } catch (e) {
    $("searchStatus").textContent = `Erro: ${e.message}`;
  }
}

// ============================================================================
// CHAPTERS MANAGEMENT
// ============================================================================
async function loadChapters() {
  if (!state.currentManga) return;

  const chapDiv = $("chapters");
  chapDiv.innerHTML = `<div class="muted">Carregando capítulos...</div>`;

  try {
    const result = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId: state.currentManga.id })
    });

    state.allChapters = result.chapters || [];

    let displayChapters = state.allChapters;
    if (state.settings.skipReadChapters) {
      displayChapters = state.allChapters.filter(ch => 
        !isChapterRead(state.currentManga.id, ch.id)
      );
    }

    if (displayChapters.length === 0) {
      chapDiv.innerHTML = `<div class="muted">${state.settings.skipReadChapters ? "Todos os capítulos foram lidos" : "Nenhum capítulo encontrado"}</div>`;
    } else {
      chapDiv.innerHTML = `
        <div class="chapters-header">
          <strong>${displayChapters.length} Capítulo${displayChapters.length !== 1 ? "s" : ""} ${state.settings.skipReadChapters ? "Não Lido" + (displayChapters.length !== 1 ? "s" : "") : "Disponíve" + (displayChapters.length !== 1 ? "is" : "l")}</strong>
        </div>
        <div class="chapters-list">
          ${displayChapters.map((ch, i) => {
            const isRead = isChapterRead(state.currentManga.id, ch.id);
            const actualIndex = state.allChapters.findIndex(c => c.id === ch.id);
            return `
              <div class="chapter-item ${isRead ? 'chapter-read' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-index="${actualIndex}" data-chapter-name="${escapeHtml(ch.name || `Capítulo ${ch.chapter || i + 1}`)}">
                <div class="chapter-info">
                  <div class="chapter-name">${escapeHtml(ch.name || `Capítulo ${ch.chapter || i + 1}`)}</div>
                  ${ch.date ? `<div class="chapter-date">${new Date(ch.date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}</div>` : ""}
                </div>
                <div class="chapter-action">
                  ${isRead ? `<span class="read-badge">✓</span>` : ""}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      chapDiv.querySelectorAll("[data-chapter-id]").forEach(el => {
        el.onclick = async () => {
          const chapterId = el.dataset.chapterId;
          const chapterName = el.dataset.chapterName;
          const chapterIndex = parseInt(el.dataset.chapterIndex);
          await loadChapter(chapterId, chapterName, chapterIndex);
        };
      });
    }
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Erro: ${e.message}</div>`;
  }
}

async function loadChapter(chapterId, chapterName, chapterIndex, startPageIndex = 0) {
  $("searchStatus").textContent = "Carregando capítulo...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });

    state.currentChapter = result;
    state.currentChapter.name = chapterName;
    state.currentChapter.id = chapterId;
    state.currentChapterIndex = chapterIndex;

    const maxIndex = Math.max((state.currentChapter.pages?.length || 1) - 1, 0);
    state.currentPageIndex = Math.min(Math.max(startPageIndex, 0), maxIndex);

    markChapterAsRead(state.currentManga.id, chapterId);

    await api("/api/history/add", {
      method: "POST",
      body: JSON.stringify({
        mangaId: state.currentManga.id,
        sourceId: state.currentSourceId,
        manga: state.currentManga,
        chapterId
      })
    });

    showReader();
    renderPage();
    $("searchStatus").textContent = "";
    await loadChapters();
  } catch (e) {
    $("searchStatus").textContent = `Erro: ${e.message}`;
  }
}

// ============================================================================
// CHAPTER NAVIGATION
// ============================================================================
function getNextChapterIndex(currentIndex) {
  if (!state.settings.skipDuplicates || !state.allChapters.length) {
    return currentIndex + 1;
  }

  const currentChapter = state.allChapters[currentIndex];
  const currentChapterNum = currentChapter?.chapter;

  for (let i = currentIndex + 1; i < state.allChapters.length; i++) {
    const nextChapter = state.allChapters[i];
    if (nextChapter.chapter !== currentChapterNum) {
      return i;
    }
  }

  return currentIndex + 1;
}

function getPrevChapterIndex(currentIndex) {
  if (!state.settings.skipDuplicates || !state.allChapters.length) {
    return currentIndex - 1;
  }

  const currentChapter = state.allChapters[currentIndex];
  const currentChapterNum = currentChapter?.chapter;

  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevChapter = state.allChapters[i];
    if (prevChapter.chapter !== currentChapterNum) {
      return i;
    }
  }

  return currentIndex - 1;
}

async function goToNextChapter() {
  const nextIndex = getNextChapterIndex(state.currentChapterIndex);
  if (nextIndex >= state.allChapters.length) {
    alert("Este é o último capítulo!");
    return;
  }

  const nextChapter = state.allChapters[nextIndex];
  await loadChapter(nextChapter.id, nextChapter.name || `Capítulo ${nextChapter.chapter || nextIndex + 1}`, nextIndex);
}

async function goToPrevChapter() {
  const prevIndex = getPrevChapterIndex(state.currentChapterIndex);
  if (prevIndex < 0) {
    alert("Este é o primeiro capítulo!");
    return;
  }

  const prevChapter = state.allChapters[prevIndex];
  await loadChapter(prevChapter.id, prevChapter.name || `Capítulo ${prevChapter.chapter || prevIndex + 1}`, prevIndex);
}

// ============================================================================
// READER & PAGE RENDERING
// ============================================================================
function showReader() {
  $("reader").classList.remove("hidden");
  const chapterName = state.currentChapter?.name || "Capítulo";
  $("readerTitle").textContent = `${escapeHtml(state.currentManga?.title || "")} - ${escapeHtml(chapterName)}`;
  
  const pageWrap = $("pageWrap");
  const readerContent = $("reader").querySelector(".reader-content");
  
  // Limpar classes antigas
  pageWrap.className = "page-wrap";
  readerContent.className = "reader-content";
  
  // Adicionar classe do modo de leitura
  pageWrap.classList.add(`reading-mode-${state.settings.readingMode}`);
  readerContent.classList.add(`reading-mode-${state.settings.readingMode}`);
}

function renderPage() {
  if (!state.currentChapter?.pages) return;

  const pages = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const readerContent = pageWrap.closest(".reader-content");
  const idx = state.currentPageIndex;
  const mode = state.settings.readingMode;

  if (mode === "webtoon") {
    // Modo webtoon: todas as páginas em coluna vertical (torre)
    const webtoonHTML = pages
      .filter(page => page.img)
      .map((page, i) => `<img src="${escapeHtml(page.img)}" alt="Página ${i + 1}" class="webtoon-page" loading="lazy">`)
      .join("");
    
    pageWrap.innerHTML = webtoonHTML;
    
    $("pageCounter").textContent = `Modo Webtoon (${pages.length} páginas)`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
    
    // Scroll para o topo quando carregar novo capítulo
    if (readerContent) {
      setTimeout(() => {
        readerContent.scrollTop = 0;
      }, 100);
    }
    
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, 0);
  } else {
    // Modo página por página (LTR/RTL)
    if (idx < 0 || idx >= pages.length) return;

    const page = pages[idx];
    const imgClass = state.settings.panWideImages ? "page-img pannable" : "page-img";
    pageWrap.innerHTML = page.img ? `<img src="${escapeHtml(page.img)}" alt="Página ${idx + 1}" class="${imgClass}">` : `<div class="muted">Página não disponível</div>`;

    if (state.settings.panWideImages) {
      const img = pageWrap.querySelector("img");
      if (img) {
        img.onload = () => {
          if (img.naturalWidth > pageWrap.clientWidth) {
            let isDragging = false;
            let startX;
            let scrollLeft;

            pageWrap.style.cursor = "grab";
            pageWrap.style.overflowX = "auto";

            pageWrap.onmousedown = (e) => {
              isDragging = true;
              pageWrap.style.cursor = "grabbing";
              startX = e.pageX - pageWrap.offsetLeft;
              scrollLeft = pageWrap.scrollLeft;
            };

            pageWrap.onmouseleave = () => {
              isDragging = false;
              pageWrap.style.cursor = "grab";
            };

            pageWrap.onmouseup = () => {
              isDragging = false;
              pageWrap.style.cursor = "grab";
            };

            pageWrap.onmousemove = (e) => {
              if (!isDragging) return;
              e.preventDefault();
              const x = e.pageX - pageWrap.offsetLeft;
              const walk = (x - startX) * 2;
              pageWrap.scrollLeft = scrollLeft - walk;
            };
          }
        };
      }
    }

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = idx === 0;
    $("nextPage").disabled = idx === pages.length - 1;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
    updateReadingProgress(state.currentManga?.id, state.currentChapter?.id, idx);
  }
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================
function showSettings() {
  const modal = document.createElement("div");
  modal.className = "settings-modal";
  modal.innerHTML = `
    <div class="settings-content">
      <div class="settings-header">
        <h2>⚙️ Configurações</h2>
        <button class="btn secondary" id="closeSettings">✕</button>
      </div>
      
      <div class="settings-body">
        <div class="setting-group">
          <label>Modo de Leitura</label>
          <select id="modeSelect" class="input">
            <option value="ltr" ${state.settings.readingMode === "ltr" ? "selected" : ""}>Esquerda para Direita</option>
            <option value="rtl" ${state.settings.readingMode === "rtl" ? "selected" : ""}>Direita para Esquerda (Manga)</option>
            <option value="webtoon" ${state.settings.readingMode === "webtoon" ? "selected" : ""}>Webtoon (Scroll Vertical)</option>
          </select>
        </div>

        <div class="settings-divider"></div>
        <h3 class="settings-subsection">Configurações Avançadas</h3>

        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Ocultar capítulos já lidos</span>
            <input type="checkbox" id="skipReadToggle" ${state.settings.skipReadChapters ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Esconde capítulos que você já terminou de ler</p>
        </div>

        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Pular capítulos duplicados na leitura</span>
            <input type="checkbox" id="skipDuplicatesToggle" ${state.settings.skipDuplicates ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Ao ler, avança automaticamente pulando duplicados do mesmo número</p>
        </div>

        <div class="setting-group">
          <label class="toggle-label">
            <span class="toggle-text">Panorâmica em imagens largas</span>
            <input type="checkbox" id="panWideToggle" ${state.settings.panWideImages ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
          <p class="setting-description">Permite deslocar horizontalmente em páginas duplas</p>
        </div>

        <div class="settings-divider"></div>

        <div class="setting-group">
          <button class="btn secondary" id="clearReadBtn">Limpar Histórico de Leitura</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  $("closeSettings").onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  $("modeSelect").onchange = (e) => {
    state.settings.readingMode = e.target.value;
    saveSettings();
    if (state.currentChapter) {
      showReader();
      renderPage();
    }
  };

  $("skipReadToggle").onchange = (e) => {
    state.settings.skipReadChapters = e.target.checked;
    saveSettings();
    if (state.currentManga) loadChapters();
  };

  $("skipDuplicatesToggle").onchange = (e) => {
    state.settings.skipDuplicates = e.target.checked;
    saveSettings();
  };

  $("panWideToggle").onchange = (e) => {
    state.settings.panWideImages = e.target.checked;
    saveSettings();
    if (state.currentChapter) renderPage();
  };

  $("clearReadBtn").onclick = () => {
    if (confirm("Limpar todo o histórico de leitura?")) {
      state.readChapters.clear();
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
    }
  };
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================
function setView(view) {
  const views = ["discover", "library", "manga-details", "advanced-search"];
  for (const v of views) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }
  
  // Renderizar biblioteca quando a view for ativada
  if (view === "library") {
    renderLibrary();
  }
  
  // Atualizar tabs apenas se não for manga-details
  if (view !== "manga-details") {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
      if ((view === "discover" && link.textContent.trim() === "Home") ||
          (view === "library" && link.textContent.trim() === "Biblioteca") ||
          (view === "advanced-search" && link.textContent.trim() === "Procura Avançada")) {
        link.classList.add("active");
      }
    });
  }
}

// ============================================================================
// UI BINDING
// ============================================================================
function bindUI() {
  initializeFilters();
  initAdvancedFilters();

  const sidebarToggle = $("sidebarToggle");
  const sidebarBackdrop = $("sidebarBackdrop");
  if (sidebarToggle) {
    sidebarToggle.onclick = () => document.body.classList.toggle("sidebar-open");
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.onclick = () => document.body.classList.remove("sidebar-open");
  }

  // Nav Links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const text = link.textContent.trim();
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      if (text === "Home") {
        setView("discover");
      } else if (text === "Biblioteca") {
        setView("library");
      } else if (text === "Procura Avançada") {
        setView("advanced-search");
      }

      document.body.classList.remove("sidebar-open");
    };
  });

  // Back button
  const backBtn = $("backBtn");
  if (backBtn) {
    backBtn.onclick = () => setView("discover");
  }

  // Search
  const searchBtn = $("searchBtn");
  const searchInput = $("searchInput");
  if (searchBtn) searchBtn.onclick = search;
  if (searchInput) searchInput.onkeypress = (e) => { if (e.key === "Enter") search(); };

  // Settings Button (inline)
  const settingsBtn = $("btn-settings");
  if (settingsBtn) {
    settingsBtn.onclick = showSettings;
  }

  // Settings Button (sidebar)
  const settingsBtnSidebar = $("btn-settings-sidebar");
  if (settingsBtnSidebar) {
    settingsBtnSidebar.onclick = showSettings;
  }

  // Reader Controls
  const closeReader = $("closeReader");
  const prevPage = $("prevPage");
  const nextPage = $("nextPage");
  
  if (closeReader) closeReader.onclick = () => $("reader").classList.add("hidden");
  
  if (prevPage) prevPage.onclick = () => { 
    if (state.currentPageIndex === 0) {
      goToPrevChapter();
    } else {
      if (state.settings.readingMode === "rtl") {
        state.currentPageIndex++; 
      } else {
        state.currentPageIndex--;
      }
      renderPage();
    }
  };
  
  if (nextPage) nextPage.onclick = () => { 
    if (state.currentPageIndex === state.currentChapter?.pages?.length - 1) {
      goToNextChapter();
    } else {
      if (state.settings.readingMode === "rtl") {
        state.currentPageIndex--; 
      } else {
        state.currentPageIndex++;
      }
      renderPage();
    }
  };

  // Advanced Search
  const advancedSearchBtn = $("advancedSearchBtn");
  const advancedSearchInput = $("advancedSearchInput");
  const randomMangaBtn = $("randomMangaBtn");
  
  if (advancedSearchBtn) advancedSearchBtn.onclick = advancedSearch;
  if (advancedSearchInput) advancedSearchInput.onkeypress = (e) => { if (e.key === "Enter") advancedSearch(); };
  if (randomMangaBtn) randomMangaBtn.onclick = randomManga;
}

// ============================================================================
// FILTERS MANAGEMENT
// ============================================================================
function initializeFilters() {
  // Removido da home - agora apenas na advanced search
}

function renderGenreFilter() {
  // Mantido apenas para advanced search
}

function renderStatusFilter() {
  // Mantido apenas para advanced search
}

function filterAndSortResults(results) {
  // Mantido apenas para advanced search
  return results;
}

// ============================================================================
// ADVANCED SEARCH
// ============================================================================
async function advancedSearch() {
  const query = $("advancedSearchInput").value.trim();
  const orderBy = $("advancedOrderBy").value;
  
  if (!state.currentSourceId) {
    $("advancedSearchStatus").textContent = "Selecione uma fonte primeiro.";
    return;
  }

  $("advancedSearchStatus").textContent = "Pesquisando...";
  try {
    const searchQuery = query || "*";
    
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ 
        query: searchQuery, 
        page: 1,
        orderBy,
        statuses: Array.from(state.advancedFilters.statuses),
        tags: Array.from(state.advancedFilters.tags)
      })
    });

    let results = result.results || [];
    
    // Aplicar filtros locais
    if (state.advancedFilters.statuses.size > 0) {
      results = results.filter(m => state.advancedFilters.statuses.has(m.status?.toLowerCase()));
    }

    if (state.advancedFilters.tags.size > 0) {
      results = results.filter(m => {
        const mangaTags = (m.genres || []).map(g => g.toLowerCase());
        return Array.from(state.advancedFilters.tags).some(tag => 
          mangaTags.some(mt => mt.includes(tag.toLowerCase()))
        );
      });
    }

    const resultsDiv = $("advancedResults");

    if (results.length === 0) {
      resultsDiv.innerHTML = `<div class="muted">Nenhum resultado encontrado</div>`;
    } else {
      resultsDiv.innerHTML = results.map(m => `
        <div class="manga-card" data-manga-id="${escapeHtml(m.id)}">
          <div class="manga-card-cover">
            ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : '<div class="no-cover">?</div>'}
          </div>
          <div class="manga-card-info">
            <h3 class="manga-card-title">${escapeHtml(m.title)}</h3>
            <p class="manga-card-author">${escapeHtml(m.author || "")}</p>
          </div>
        </div>
      `).join("");

      resultsDiv.querySelectorAll("[data-manga-id]").forEach(el => {
        el.onclick = async () => {
          const mangaId = el.dataset.mangaId;
          await loadMangaDetails(mangaId);
        };
      });
    }

    $("advancedSearchStatus").textContent = `${results.length} resultado(s) encontrado(s)`;
  } catch (e) {
    $("advancedSearchStatus").textContent = `Erro: ${e.message}`;
  }
}

async function randomManga() {
  if (!state.currentSourceId) {
    alert("Selecione uma fonte primeiro.");
    return;
  }

  $("advancedSearchStatus").textContent = "Buscando manga aleatório...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: "*", page: 1, orderBy: "random" })
    });

    const results = result.results || [];
    if (results.length > 0) {
      const randomIndex = Math.floor(Math.random() * results.length);
      const randomManga = results[randomIndex];
      await loadMangaDetails(randomManga.id);
    } else {
      $("advancedSearchStatus").textContent = "Nenhum manga encontrado";
    }
  } catch (e) {
    $("advancedSearchStatus").textContent = `Erro: ${e.message}`;
  }
}

function initAdvancedFilters() {
  // Status checkboxes
  document.querySelectorAll(".advanced-status-check").forEach(check => {
    check.onchange = (e) => {
      if (e.target.checked) {
        state.advancedFilters.statuses.add(e.target.value);
      } else {
        state.advancedFilters.statuses.delete(e.target.value);
      }
    };
  });

  // Tag chips
  document.querySelectorAll(".advanced-tags-section .genre-chip").forEach(chip => {
    chip.onclick = () => {
      const tag = chip.dataset.tag;
      if (state.advancedFilters.tags.has(tag)) {
        state.advancedFilters.tags.delete(tag);
        chip.classList.remove("active");
      } else {
        state.advancedFilters.tags.add(tag);
        chip.classList.add("active");
      }
    };
  });

  // Order by
  const orderBy = $("advancedOrderBy");
  if (orderBy) {
    orderBy.onchange = (e) => {
      state.advancedFilters.orderBy = e.target.value;
    };
  }

  // Advanced source select
  const advancedSourceSelect = $("advancedSourceSelect");
  if (advancedSourceSelect) {
    advancedSourceSelect.innerHTML = "";
    const installed = Object.values(state.installedSources);
    
    if (installed.length === 0) {
      advancedSourceSelect.innerHTML = `<option value="">(Instale uma fonte primeiro)</option>`;
      return;
    }
    
    for (const s of installed) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      advancedSourceSelect.appendChild(opt);
    }
    
    if (state.currentSourceId && state.installedSources[state.currentSourceId]) {
      advancedSourceSelect.value = state.currentSourceId;
    } else if (installed.length > 0) {
      state.currentSourceId = installed[0].id;
      advancedSourceSelect.value = state.currentSourceId;
    }
    
    advancedSourceSelect.onchange = async () => {
      state.currentSourceId = advancedSourceSelect.value;
    };
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
(async function main() {
  loadSettings();
  await refreshState();
  bindUI();
})();
