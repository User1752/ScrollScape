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
  lastResults: [],
  currentManga: null,
  currentChapters: [],
  currentPages: [],
  currentPageIndex: 0
};

function $(id) { return document.getElementById(id); }

function setView(view) {
  const views = ["read", "sources", "about"];
  for (const v of views) {
    $(`view-${v}`).classList.toggle("hidden", v !== view);
  }
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function refreshState() {
  const data = await api("/api/state");
  state.repos = data.repos || [];
  state.availableSources = data.availableSources || [];
  state.installedSources = data.installedSources || {};
  renderSourcesUI();
  renderSourceSelect();
}

function renderSourceSelect() {
  const sel = $("sourceSelect");
  sel.innerHTML = "";
  const installed = Object.values(state.installedSources);
  if (installed.length === 0) {
    sel.innerHTML = `<option value="">(Sem fontes instaladas)</option>`;
    state.currentSourceId = null;
    return;
  }
  for (const s of installed) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.id})`;
    sel.appendChild(opt);
  }
  if (!state.currentSourceId || !state.installedSources[state.currentSourceId]) {
    state.currentSourceId = installed[0].id;
  }
  sel.value = state.currentSourceId;
  sel.onchange = () => { state.currentSourceId = sel.value; };
}

function renderSourcesUI() {
  // repos
  const reposDiv = $("repos");
  if (state.repos.length === 0) {
    reposDiv.innerHTML = `<div class="muted">Sem repos. Adiciona um URL acima.</div>`;
  } else {
    reposDiv.innerHTML = state.repos.map(r => `
      <div class="item">
        <div class="title">${escapeHtml(r.name || r.url)}</div>
        <div class="sub">${escapeHtml(r.url)}</div>
        <div class="sub muted">Tipo: ${escapeHtml(r.kind || "jsrepo")}</div>
        <div class="actions">
          <button class="btn secondary" data-delrepo="${escapeHtml(r.url)}">Remover</button>
        </div>
      </div>
    `).join("");
    reposDiv.querySelectorAll("[data-delrepo]").forEach(btn => {
      btn.onclick = async () => {
        try {
          await api(`/api/repos?url=${encodeURIComponent(btn.dataset.delrepo)}`, { method: "DELETE" });
          await refreshState();
        } catch (e) {
          $("repoStatus").textContent = `Erro: ${e.message}`;
        }
      };
    });
  }

  // available sources
  const avDiv = $("availableSources");
  if (state.availableSources.length === 0) {
    avDiv.innerHTML = `<div class="muted">Sem fontes disponíveis (ou repos indisponíveis).</div>`;
  } else {
    avDiv.innerHTML = state.availableSources.map(s => {
      const installed = !!state.installedSources[s.id];
      const installable = !!s.installable && s.kind === "js";
      const note = s.note ? `<div class="sub muted">${escapeHtml(s.note)}</div>` : "";

      return `
        <div class="item">
          <div class="title">${escapeHtml(s.name)} <span class="muted">(${escapeHtml(s.id)})</span></div>
          <div class="sub">Repo: ${escapeHtml(s.repoName || "")} · Versão: ${escapeHtml(s.version || "")}</div>
          <div class="sub muted">Tipo: ${escapeHtml(s.kind || "")}</div>
          ${note}
          <div class="actions">
            ${
              installed
                ? `<button class="btn secondary" disabled>Instalada</button>`
                : installable
                  ? `<button class="btn" data-install="${escapeHtml(s.id)}">Instalar</button>`
                  : `<button class="btn secondary" disabled title="Não executável (APK Tachiyomi/Mihon)">Não instalável</button>`
            }
          </div>
        </div>
      `;
    }).join("");

    avDiv.querySelectorAll("[data-install]").forEach(btn => {
      btn.onclick = async () => {
        $("repoStatus").textContent = "A instalar...";
        try {
          await api("/api/sources/install", {
            method: "POST",
            body: JSON.stringify({ id: btn.dataset.install })
          });
          $("repoStatus").textContent = "Instalada com sucesso.";
          await refreshState();
        } catch (e) {
          $("repoStatus").textContent = `Erro: ${e.message}`;
        }
      };
    });
  }

  // installed sources
  const insDiv = $("installedSources");
  const installed = Object.values(state.installedSources);
  if (installed.length === 0) {
    insDiv.innerHTML = `<div class="muted">Nenhuma fonte instalada.</div>`;
  } else {
    insDiv.innerHTML = installed.map(s => `
      <div class="item">
        <div class="title">${escapeHtml(s.name)} <span class="muted">(${escapeHtml(s.id)})</span></div>
        <div class="sub">Versão: ${escapeHtml(s.version || "")} · ${escapeHtml(s.author || "")}</div>
        <div class="actions">
          <button class="btn secondary" data-uninstall="${escapeHtml(s.id)}">Desinstalar</button>
        </div>
      </div>
    `).join("");

    insDiv.querySelectorAll("[data-uninstall]").forEach(btn => {
      btn.onclick = async () => {
        $("repoStatus").textContent = "A desinstalar...";
        try {
          await api("/api/sources/uninstall", {
            method: "POST",
            body: JSON.stringify({ id: btn.dataset.uninstall })
          });
          $("repoStatus").textContent = "Desinstalada.";
          await refreshState();
        } catch (e) {
          $("repoStatus").textContent = `Erro: ${e.message}`;
        }
      };
    });
  }
}

// --- O resto do teu app.js (search, manga details, chapters, pages, reader) mantém igual ---
// Para simplificar, assume que já tens essas funções no teu ficheiro.
// Se quiseres, cola o teu app.js atual e eu devolvo tudo já integrado num único ficheiro.

function bindUI() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => setView(btn.dataset.view);
  });
  setView("read");

  $("addRepoBtn").onclick = async () => {
    const url = $("repoUrl").value.trim();
    $("repoStatus").textContent = "A adicionar repo...";
    try {
      await api("/api/repos", { method: "POST", body: JSON.stringify({ url }) });
      $("repoStatus").textContent = "Repo adicionada.";
      $("repoUrl").value = "";
      await refreshState();
    } catch (e) {
      $("repoStatus").textContent = `Erro: ${e.message}`;
    }
  };
}

(async function main() {
  bindUI();
  await refreshState();
})();
