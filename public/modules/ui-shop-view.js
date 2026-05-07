// ============================================================================
// SHOP VIEW
// ============================================================================

const CUSTOM_THEME_PRESET_IDS_KEY = 'scrollscape_theme_preset_ids';

function getThemePresetIds() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_THEME_PRESET_IDS_KEY) || '[]'); }
  catch { return []; }
}

function saveThemePresetIds(ids) {
  localStorage.setItem(CUSTOM_THEME_PRESET_IDS_KEY, JSON.stringify(ids));
}

function isPresetInThemes(id) {
  return getThemePresetIds().includes(id);
}

function addPresetToThemes(id) {
  const ids = getThemePresetIds();
  if (!ids.includes(id)) {
    ids.push(id);
    saveThemePresetIds(ids);
  }
}

function removePresetFromThemes(id) {
  saveThemePresetIds(getThemePresetIds().filter(x => x !== id));
}

function togglePresetInThemes(id) {
  const added = isPresetInThemes(id);
  if (added) removePresetFromThemes(id);
  else addPresetToThemes(id);

  const btn = document.getElementById(`preset-theme-btn-${id}`);
  if (btn) {
    const nowAdded = !added;
    btn.textContent = nowAdded ? t('action.addedToThemes') : t('action.addToThemes');
    btn.classList.toggle('is-added-theme', nowAdded);
  }

  if (!document.getElementById('view-themes')?.classList.contains('hidden')) {
    renderThemesView();
  }

  showToast(nowAddedMessage(!added), '', 'info');
}

function nowAddedMessage(added) {
  return added ? t('themes.toastPresetAdded') : t('themes.toastPresetRemoved');
}

function getThemePresets() {
  const ids = new Set(getThemePresetIds());
  if (typeof getCustomPresets !== 'function') return [];
  return getCustomPresets().filter(p => ids.has(p.id));
}

function openThemeSettings(themeId) {
  setActiveTheme(themeId);
  setView('customize');
  showToast(t('themes.toastSelectedTitle'), t('themes.toastSelectedBody'), 'info');
}

function openPresetThemeSettings(presetId) {
  setView('customize');
  if (typeof editCustomPreset === 'function') editCustomPreset(presetId);
}

function renderThemesView() {
  const tr = (key) => t(key);
  const ownedGrid = document.getElementById('themesOwnedGrid');
  const customGrid = document.getElementById('themesCustomGrid');
  if (!ownedGrid || !customGrid) return;

  updateApBadge();

  const purchased = getPurchasedThemes();
  const activeTheme = getActiveTheme();
  const activeCustom = (typeof getActiveCustom === 'function' ? getActiveCustom() : null) || {};

  const ownedThemes = SHOP_THEMES.filter(t => purchased.includes(t.id));
  ownedGrid.innerHTML = ownedThemes.length
    ? ownedThemes.map(t => {
        const isActive = !activeCustom?.id && activeTheme === t.id;
        return `
          <div class="shop-card ${isActive ? 'shop-active' : 'shop-owned'}">
            <div class="shop-card-preview" style="background:${t.preview}"></div>
            <div class="shop-card-body">
              <div class="shop-card-name">${escapeHtml(t.name)}</div>
              <div class="shop-card-desc">${escapeHtml(t.desc || tr('themes.unlockedFallback'))}</div>
              <div class="theme-hub-actions">
                ${isActive
                  ? `<button class="shop-btn shop-btn-active" disabled>${escapeHtml(tr('action.active'))}</button>`
                  : `<button class="shop-btn shop-btn-owned" onclick="setActiveTheme('${t.id}');renderThemesView()">${escapeHtml(tr('action.apply'))}</button>`}
                <button class="shop-btn shop-btn-buy" onclick="openThemeSettings('${t.id}')">${escapeHtml(tr('action.settings'))}</button>
              </div>
            </div>
          </div>`;
      }).join('')
    : `<p class="theme-empty">${escapeHtml(tr('themes.noUnlocked'))}</p>`;

  const themePresets = getThemePresets();
  customGrid.innerHTML = themePresets.length
    ? themePresets.map(p => {
        const isActive = activeCustom.id === p.id;
        const preview = p.bgUrl
          ? `linear-gradient(rgba(0,0,0,${(p.bgDim || 0) / 100}), rgba(0,0,0,${(p.bgDim || 0) / 100})), url('${escapeHtml(p.bgUrl)}') center/cover`
          : 'linear-gradient(135deg,#1f2438,#2b3048)';
        return `
          <div class="shop-card ${isActive ? 'shop-active' : 'shop-owned'}">
            <div class="shop-card-preview" style="background:${preview}"></div>
            <div class="shop-card-body">
              <div class="shop-card-name">${escapeHtml(p.name || tr('themes.customPresetFallback'))}</div>
              <div class="shop-card-desc">${escapeHtml(tr('themes.customPresetDesc'))}</div>
              <div class="theme-hub-actions">
                ${isActive
                  ? `<button class="shop-btn shop-btn-active" disabled>${escapeHtml(tr('action.active'))}</button>`
                  : `<button class="shop-btn shop-btn-owned" onclick="applyCustomPreset('${p.id}');renderThemesView()">${escapeHtml(tr('action.apply'))}</button>`}
                <button class="shop-btn shop-btn-buy" onclick="openPresetThemeSettings('${p.id}')">${escapeHtml(tr('action.settings'))}</button>
                <button class="shop-btn shop-btn-remove" onclick="removePresetFromThemes('${p.id}');renderThemesView()">${escapeHtml(tr('action.remove'))}</button>
              </div>
            </div>
          </div>`;
      }).join('')
    : `<p class="theme-empty">${escapeHtml(tr('themes.noAddedPresets'))}</p>`;

  const shopBtn = document.getElementById('openThemeShopBtn');
  if (shopBtn) shopBtn.onclick = () => setView('shop');

  const customizeBtn = document.getElementById('openThemeCustomizeBtn');
  if (customizeBtn) customizeBtn.onclick = () => setView('customize');
}

function renderShopView() {
  const tr = (key) => t(key);
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  updateApBadge();
  const ap        = getAvailableAP();
  const purchased = getPurchasedThemes();
  const active    = getActiveTheme();
  grid.innerHTML = SHOP_THEMES.map(t => {
    const owned    = purchased.includes(t.id);
    const isActive = active === t.id;
    const canAfford = ap >= t.cost;
    let btn, badge = '';
    if (isActive) {
      btn = `<button class="shop-btn shop-btn-active" disabled>${escapeHtml(tr('action.active'))}</button>`;
      badge = `<span class="shop-active-badge">&#x2713; ${escapeHtml(tr('action.active'))}</span>`;
    } else if (owned) {
      btn = `<button class="shop-btn shop-btn-owned" onclick="setActiveTheme('${t.id}');renderShopView()">${escapeHtml(tr('action.apply'))}</button>`;
    } else if (t.cost === 0) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="addPurchasedTheme('${t.id}');setActiveTheme('${t.id}');renderShopView()">${escapeHtml(tr('shop.getFree'))}</button>`;
    } else if (canAfford) {
      btn = `<button class="shop-btn shop-btn-buy" onclick="buyTheme('${t.id}')">${escapeHtml(tr('action.buy'))}</button>`;
    } else {
      btn = `<button class="shop-btn shop-btn-afford" disabled>${escapeHtml(tr('shop.need'))} ${t.cost} AP</button>`;
    }
    const costStr = t.cost === 0 ? `<span style="color:var(--success)">${escapeHtml(tr('shop.free'))}</span>` : `<span class="ap-star">&#x2B50;</span>${t.cost} AP`;
    return `
      <div class="shop-card ${isActive ? 'shop-active' : owned ? 'shop-owned' : ''}">
        <div class="shop-card-preview" style="background:${t.preview}"></div>
        <div class="shop-card-body">
          <div class="shop-card-name">${escapeHtml(t.name)}</div>
          <div class="shop-card-desc">${escapeHtml(t.desc)}</div>
          <div class="shop-card-footer">
            <span class="shop-card-cost">${costStr}</span>
            ${btn}
          </div>
          ${badge}
        </div>
      </div>`;
  }).join('');
}

function buyTheme(id) {
  const theme = SHOP_THEMES.find(x => x.id === id);
  if (!theme) return;
  const ap = getAvailableAP();
  if (ap < theme.cost) { showToast(t('shop.toastNotEnoughAp'), `${t('shop.need')} ${theme.cost} AP`, 'warning'); return; }
  spendAP(theme.cost);
  addPurchasedTheme(id);
  setActiveTheme(id);
  showToast(t('shop.toastThemeUnlocked'), theme.name, 'success');
  renderShopView();
  updateApBadge();
}

window.getThemePresetIds = getThemePresetIds;
window.isPresetInThemes = isPresetInThemes;
window.togglePresetInThemes = togglePresetInThemes;
window.removePresetFromThemes = removePresetFromThemes;
window.openThemeSettings = openThemeSettings;
window.openPresetThemeSettings = openPresetThemeSettings;

