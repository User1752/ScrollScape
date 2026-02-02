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
  currentPageIndex: 0,
  favorites: [],
  history: [],
  readChapters: new Set(),
  settings: {
    language: "pt",
    readingMode: "ltr"
  }
};

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

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
  } catch (e) {
    console.warn("Erro ao carregar configurações:", e);
  }
}

function saveSettings() {
  localStorage.setItem("manghuSettings", JSON.stringify(state.settings));
  localStorage.setItem("manghuReadChapters", JSON.stringify([...state.readChapters]));
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

function renderLibrary() {
  const libDiv = $("library");
  if (!libDiv) return;
  
  if (state.favorites.length === 0) {
    libDiv.innerHTML = `<div class="muted">Nenhum favorito adicionado</div>`;
  } else {
    libDiv.innerHTML = state.favorites.map(m => `
      <div class="result-item" data-continue-read="${m.id}_${m.sourceId}">
        ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : ""}
        <div class="result-info">
          <div class="result-title">${escapeHtml(m.title)}</div>
          <div class="result-author">${escapeHtml(m.author || "")}</div>
          <button class="btn secondary" data-remove-fav="${m.id}_${m.sourceId}" style="margin-top:0.5rem; font-size:0.85rem; padding:0.5rem 1rem;">Remover</button>
        </div>
      </div>
    `).join(""); // CORRIGIDO - linha 129

    libDiv.querySelectorAll("[data-remove-fav]").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const [mangaId, sourceId] = btn.dataset.removeFav.split("_");
        try {
          await api("/api/library/remove", {
            method: "POST",
            body: JSON.stringify({ mangaId, sourceId })
          });
          await refreshState();
        } catch (e) {
          console.error(e);
        }
      };
    });

    libDiv.querySelectorAll("[data-continue-read]").forEach(el => {
      el.onclick = async () => {
        const [mangaId, sourceId] = el.dataset.continueRead.split("_");
        state.currentSourceId = sourceId;
        setView("discover");
        await loadMangaDetails(mangaId);
      };
    });
  }

  const histDiv = $("history");
  if (!histDiv) return;
  
  if (state.history.length === 0) {
    histDiv.innerHTML = `<div class="muted">Nenhuma leitura recente</div>`;
  } else {
    histDiv.innerHTML = state.history.slice(0, 20).map(m => `
      <div class="result-item">
        ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : ""}
        <div class="result-info">
          <div class="result-title">${escapeHtml(m.title)}</div>
          <div class="result-author">${new Date(m.readAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    `).join("");
  }
}

async function search() {
  const query = $("searchInput").value.trim();
  if (!query || !state.currentSourceId) {
    $("searchStatus").textContent = "Selecione uma fonte e insira um termo de pesquisa.";
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
    } else {
      resultsDiv.innerHTML = results.map(m => `
        <div class="result-item" data-manga-id="${escapeHtml(m.id)}">
          ${m.cover ? `<img src="${escapeHtml(m.cover)}" alt="${escapeHtml(m.title)}">` : ""}
          <div class="result-info">
            <div class="result-title">${escapeHtml(m.title)}</div>
            <div class="result-author">${escapeHtml(m.author || "Autor desconhecido")}</div>
          </div>
        </div>
      `).join(""); // CORRIGIDO - linha 203

      resultsDiv.querySelectorAll("[data-manga-id]").forEach(el => {
        el.onclick = async () => {
          const mangaId = el.dataset.mangaId;
          await loadMangaDetails(mangaId);
        };
      });
    }

    $("searchStatus").textContent = `${results.length} resultado(s) encontrado(s)`;
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

async function loadChapters() {
  if (!state.currentManga) return;

  const chapDiv = $("chapters");
  chapDiv.innerHTML = `<div class="muted">Carregando capítulos...</div>`;

  try {
    const result = await api(`/api/source/${state.currentSourceId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ mangaId: state.currentManga.id })
    });

    const chapters = result.chapters || [];

    if (chapters.length === 0) {
      chapDiv.innerHTML = `<div class="muted">Nenhum capítulo encontrado</div>`;
    } else {
      chapDiv.innerHTML = `
        <div class="chapters-header">
          <strong>${chapters.length} Capítulo${chapters.length !== 1 ? "s" : ""} Disponíve${chapters.length !== 1 ? "is" : "l"}</strong>
        </div>
        <div class="chapters-list">
          ${chapters.map((ch, i) => {
            const isRead = isChapterRead(state.currentManga.id, ch.id);
            return `
              <div class="chapter-item ${isRead ? 'chapter-read' : ''}" data-chapter-id="${escapeHtml(ch.id)}" data-chapter-name="${escapeHtml(ch.name || `Capítulo ${ch.chapter || i + 1}`)}">
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
          await loadChapter(chapterId, chapterName);
        };
      });
    }
  } catch (e) {
    chapDiv.innerHTML = `<div class="muted">Erro: ${e.message}</div>`;
  }
}

async function loadChapter(chapterId, chapterName) {
  $("searchStatus").textContent = "Carregando capítulo...";
  try {
    const result = await api(`/api/source/${state.currentSourceId}/pages`, {
      method: "POST",
      body: JSON.stringify({ chapterId })
    });

    state.currentChapter = result;
    state.currentChapter.name = chapterName;
    state.currentChapter.id = chapterId;
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
    pageWrap.innerHTML = page.img ? `<img src="${escapeHtml(page.img)}" alt="Página ${idx + 1}">` : `<div class="muted">Página não disponível</div>`;

    $("pageCounter").textContent = `${idx + 1} / ${pages.length}`;
    $("prevPage").disabled = idx === 0;
    $("nextPage").disabled = idx === pages.length - 1;
    $("prevPage").style.display = "block";
    $("nextPage").style.display = "block";
  }
}

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

        <div class="setting-group">
          <button class="btn" id="clearReadBtn">Limpar Histórico de Leitura</button>
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

  $("clearReadBtn").onclick = () => {
    if (confirm("Limpar todo o histórico de leitura?")) {
      state.readChapters.clear();
      saveSettings();
      if (state.currentManga) loadChapters();
      modal.remove();
    }
  };
}

function setView(view) {
  const views = ["discover", "library"];
  for (const v of views) {
    const el = $(`view-${v}`);
    if (el) el.classList.toggle("hidden", v !== view);
  }
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function bindUI() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => setView(btn.dataset.view);
  });

  const searchBtn = $("searchBtn");
  const searchInput = $("searchInput");
  if (searchBtn) searchBtn.onclick = search;
  if (searchInput) searchInput.onkeypress = (e) => { if (e.key === "Enter") search(); };

  const closeReader = $("closeReader");
  const prevPage = $("prevPage");
  const nextPage = $("nextPage");
  
  if (closeReader) closeReader.onclick = () => $("reader").classList.add("hidden");
  if (prevPage) prevPage.onclick = () => { 
    if (state.settings.readingMode === "rtl") {
      state.currentPageIndex++; 
    } else {
      state.currentPageIndex--;
    }
    renderPage(); 
  };
  if (nextPage) nextPage.onclick = () => { 
    if (state.settings.readingMode === "rtl") {
      state.currentPageIndex--; 
    } else {
      state.currentPageIndex++;
    }
    renderPage(); 
  };

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "tab";
  settingsBtn.innerHTML = "⚙️";
  settingsBtn.onclick = showSettings;
  const tabsNav = document.querySelector(".tabs");
  if (tabsNav) tabsNav.appendChild(settingsBtn);
}

(async function main() {
  loadSettings();
  bindUI();
  await refreshState();
})();
