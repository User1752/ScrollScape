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
  selectedMangaForContext: null // Novo: para context menu
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
  } catch (e) {
    console.warn("Erro ao carregar configurações:", e);
  }
}

function saveSettings() {
  localStorage.setItem("manghuSettings", JSON.stringify(state.settings));
  localStorage.setItem("manghuReadChapters", JSON.stringify([...state.readChapters]));
  localStorage.setItem("manghuLibraryTags", JSON.stringify(state.libraryTags));
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
  sel.onchange = () => { state.currentSourceId = sel.value; };
}

// ============================================================================
// LIBRARY RENDERING
// ============================================================================
function renderLibrary() {
  const libDiv = $("library");
  if (!libDiv) return;
  
  if (state.favorites.length === 0) {
    libDiv.innerHTML = `<div class="muted">Sua biblioteca está vazia. Adicione mangás aos favoritos!</div>`;
    $("libraryCount").textContent = "0 mangás";
    return;
  }

  // Grid de cards de biblioteca
  libDiv.innerHTML = state.favorites.map(m => {
    const tags = state.libraryTags[`${m.id}_${m.sourceId}`] || [];
    return `
      <div class="library-card" data-manga-id="${m.id}_${m.sourceId}" data-manga-json='${JSON.stringify(m)}'>
        <div class="library-card-cover">
          ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : '<div class="no-cover">?</div>'}
          <div class="library-card-overlay">
            <button class="btn-read" data-action="continue">▶ Continuar Lendo</button>
          </div>
        </div>
        <div class="library-card-info">
          <h3 class="library-card-title">${escapeHtml(m.title)}</h3>
          <p class="library-card-author">${escapeHtml(m.author || "")}</p>
          ${tags.length > 0 ? `
            <div class="library-card-tags">
              ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  $("libraryCount").textContent = `${state.favorites.length} mangá${state.favorites.length !== 1 ? "s" : ""}`;

  // Eventos de clique direito
  libDiv.querySelectorAll(".library-card").forEach(el => {
    el.oncontextmenu = (e) => {
      e.preventDefault();
      const mangaJson = JSON.parse(el.dataset.mangaJson);
      showContextMenu(e, el.dataset.mangaId, mangaJson);
    };

    // Clique esquerdo para continuar lendo
    const btnRead = el.querySelector(".btn-read");
    if (btnRead) {
      btnRead.onclick = async (e) => {
        e.stopPropagation();
        const [mangaId, sourceId] = el.dataset.mangaId.split("_");
        state.currentSourceId = sourceId;
        const mangaJson = JSON.parse(el.dataset.mangaJson);
        state.currentManga = mangaJson;
        await loadChapters();
        setView("manga-details");
      };
    }
  });
}

function showContextMenu(event, mangaId, mangaData) {
  const menu = $("contextMenu");
  menu.classList.remove("hidden");
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";

  state.selectedMangaForContext = { id: mangaId, data: mangaData };

  // Remover listeners antigos
  const oldButtons = menu.querySelectorAll(".context-item");
  oldButtons.forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });

  // Adicionar novos listeners
  menu.querySelectorAll(".context-item").forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      const [mangaId, sourceId] = state.selectedMangaForContext.id.split("_");

      if (action === "mark-read") {
        // Marcar todos os capítulos como lidos
        state.allChapters.forEach(ch => {
          markChapterAsRead(mangaId, ch.id);
        });
        alert("Todos os capítulos marcados como lidos!");
        await renderLibrary();
      } else if (action === "mark-unread") {
        // Desmarcar todos os capítulos
        state.allChapters.forEach(ch => {
          const key = `${mangaId}:${ch.id}`;
          state.readChapters.delete(key);
        });
        saveSettings();
        alert("Todos os capítulos marcados como não lidos!");
        await renderLibrary();
      } else if (action === "download") {
        alert("Feature em desenvolvimento: Download de capítulos");
      } else if (action === "tag") {
        const tagName = prompt("Insira o nome da tag:");
        if (tagName) {
          const key = state.selectedMangaForContext.id;
          if (!state.libraryTags[key]) {
            state.libraryTags[key] = [];
          }
          if (!state.libraryTags[key].includes(tagName)) {
            state.libraryTags[key].push(tagName);
            localStorage.setItem("manghuLibraryTags", JSON.stringify(state.libraryTags));
            await renderLibrary();
          }
        }
      }

      menu.classList.add("hidden");
    };
  });

  // Fechar menu ao clicar fora
  document.onclick = () => {
    menu.classList.add("hidden");
  };
}

// ============================================================================
// SEARCH & MANGA DETAILS
// ============================================================================
async function search() {
  const query = $("searchInput").value.trim();
  
  const hasFilters = state.selectedGenres.size > 0 || state.selectedStatuses.size > 0;
  
  if (!state.currentSourceId) {
    $("searchStatus").textContent = "Selecione uma fonte primeiro.";
    return;
  }
  
  if (!query && !hasFilters) {
    $("searchStatus").textContent = "Digite um termo de pesquisa ou selecione pelo menos um filtro.";
    return;
  }

  $("searchStatus").textContent = "Pesquisando...";
  try {
    const searchQuery = query || "*";
    
    const result = await api(`/api/source/${state.currentSourceId}/search`, {
      method: "POST",
      body: JSON.stringify({ query: searchQuery, page: 1 })
    });

    let results = result.results || [];
    results = filterAndSortResults(results);

    const resultsDiv = $("results");

    if (results.length === 0) {
      resultsDiv.innerHTML = `<div class="muted">Nenhum resultado encontrado com os filtros selecionados</div>`;
    } else {
      // Grid de cards (AsuraScans style)
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

    const filterInfo = hasFilters ? ` (com filtros)` : "";
    $("searchStatus").textContent = `${results.length} resultado(s) encontrado(s)${filterInfo}`;
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
            <button class="btn" id="addFavBtn">⭐ Adicionar aos Favoritos</button>
          </div>
        </div>
      </div>
    `;

    $("addFavBtn").onclick = async () => {
      try {
        await api("/api/library/add", {
          method: "POST",
          body: JSON.stringify({
            mangaId: state.currentManga.id,
            sourceId: state.currentSourceId,
            manga: state.currentManga
          })
        });
        $("addFavBtn").textContent = "✓ Adicionado";
        $("addFavBtn").disabled = true;
        await refreshState();
      } catch (e) {
        console.error(e);
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

async function loadChapter(chapterId, chapterName, chapterIndex) {
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
    state.currentPageIndex = 0;

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
  pageWrap.className = "page-wrap";
  pageWrap.classList.add(`reading-mode-${state.settings.readingMode}`);
}

function renderPage() {
  if (!state.currentChapter?.pages) return;

  const pages = state.currentChapter.pages;
  const pageWrap = $("pageWrap");
  const idx = state.currentPageIndex;
  const mode = state.settings.readingMode;

  if (mode === "webtoon") {
    pageWrap.innerHTML = pages.map((page, i) => 
      page.img ? `<img src="${escapeHtml(page.img)}" alt="Página ${i + 1}" class="webtoon-page">` : ""
    ).join("");
    $("pageCounter").textContent = `Modo Webtoon (${pages.length} páginas)`;
    $("prevPage").style.display = "none";
    $("nextPage").style.display = "none";
  } else {
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
  const views = ["discover", "library", "manga-details"];
  for (const v of views) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }
  
  // Atualizar tabs apenas se não for manga-details
  if (view !== "manga-details") {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
      if ((view === "discover" && link.textContent.trim() === "Home") ||
          (view === "library" && link.textContent.trim() === "Biblioteca")) {
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

  // Nav Links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const text = link.textContent.trim();
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      if (text === "Home") setView("discover");
      else if (text === "Biblioteca") setView("library");
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
}

// ============================================================================
// FILTERS MANAGEMENT
// ============================================================================
function initializeFilters() {
  renderGenreFilter();
  renderStatusFilter();
  
  const sortFilter = $("sortFilter");
  if (sortFilter) {
    sortFilter.onchange = (e) => {
      state.sortBy = e.target.value;
      // Auto-pesquisar se já houver resultados
      const resultsDiv = $("results");
      if (resultsDiv && resultsDiv.children.length > 0) {
        search();
      }
    };
  }
}

function renderGenreFilter() {
  const genreChips = document.querySelector(".genre-chips");
  if (!genreChips) return;

  genreChips.innerHTML = state.allGenres.map(genre => `
    <div class="genre-chip" data-genre="${genre}">
      ${genre}
    </div>
  `).join("");

  genreChips.querySelectorAll(".genre-chip").forEach(chip => {
    chip.onclick = () => {
      const genre = chip.dataset.genre;
      if (state.selectedGenres.has(genre)) {
        state.selectedGenres.delete(genre);
        chip.classList.remove("active");
      } else {
        state.selectedGenres.add(genre);
        chip.classList.add("active");
      }
      
      // Auto-pesquisar se já houver resultados ou se tiver filtros ativos
      const resultsDiv = $("results");
      const hasFilters = state.selectedGenres.size > 0 || state.selectedStatuses.size > 0;
      if ((resultsDiv && resultsDiv.children.length > 0) || hasFilters) {
        search();
      }
    };
  });
}

function renderStatusFilter() {
  const statusFilter = document.querySelector(".status-filter");
  if (!statusFilter) return;

  const statuses = [
    { value: "ongoing", label: "Em Publicação", icon: "📖" },
    { value: "completed", label: "Completo", icon: "✅" },
    { value: "hiatus", label: "Hiato", icon: "⏸️" },
    { value: "cancelled", label: "Cancelado", icon: "❌" }
  ];
  
  statusFilter.innerHTML = statuses.map(status => `
    <label class="filter-checkbox">
      <input type="checkbox" value="${status.value}" class="status-check">
      <span>${status.icon} ${status.label}</span>
    </label>
  `).join("");

  statusFilter.querySelectorAll(".status-check").forEach(check => {
    check.onchange = (e) => {
      if (e.target.checked) {
        state.selectedStatuses.add(e.target.value);
      } else {
        state.selectedStatuses.delete(e.target.value);
      }
      
      // Auto-pesquisar se já houver resultados ou se tiver filtros ativos
      const resultsDiv = $("results");
      const hasFilters = state.selectedGenres.size > 0 || state.selectedStatuses.size > 0;
      if ((resultsDiv && resultsDiv.children.length > 0) || hasFilters) {
        search();
      }
    };
  });
}

function filterAndSortResults(results) {
  let filtered = results;

  // Filtrar por gênero
  if (state.selectedGenres.size > 0) {
    filtered = filtered.filter(manga => {
      const mangaGenres = manga.genres || [];
      return Array.from(state.selectedGenres).some(genre =>
        mangaGenres.some(g => g.toLowerCase().includes(genre.toLowerCase()))
      );
    });
  }

  // Filtrar por status
  if (state.selectedStatuses.size > 0) {
    filtered = filtered.filter(manga =>
      state.selectedStatuses.has(manga.status?.toLowerCase())
    );
  }

  // Ordenar
  switch (state.sortBy) {
    case "trending":
      filtered = filtered.sort(() => Math.random() - 0.5);
      break;
    case "views":
      filtered = filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
    case "relevance":
    default:
      break;
  }

  return filtered;
}

// ============================================================================
// INITIALIZATION
// ============================================================================
(async function main() {
  loadSettings();
  await refreshState();
  bindUI();
})();
