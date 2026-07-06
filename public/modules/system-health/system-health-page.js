// ============================================================================
// SYSTEM HEALTH PAGE
// ============================================================================

(function () {
  'use strict';

  function tr(key, fallback) {
    if (typeof t === 'function') {
      const value = t(key);
      if (value && value !== key) return value;
    }
    return fallback;
  }

  const ROUTE_MANIFEST = [
    { view: 'discover', labelKey: 'nav.home', fallbackLabel: 'Home', renderFn: null },
    { view: 'advanced-search', labelKey: 'nav.search', fallbackLabel: 'Advanced Search', renderFn: 'advancedSearch' },
    { view: 'library', labelKey: 'nav.library', fallbackLabel: 'Library', renderFn: 'renderLibrary' },
    { view: 'history', labelKey: 'nav.history', fallbackLabel: 'History', renderFn: 'renderHistoryView' },
    { view: 'calendar', labelKey: 'nav.calendar', fallbackLabel: 'Calendar', renderFn: 'renderCalendarView' },
    { view: 'analytics', labelKey: 'nav.analytics', fallbackLabel: 'Analytics', renderFn: 'renderAnalyticsView' },
    { view: 'achievements', labelKey: 'nav.achievements', fallbackLabel: 'Achievements', renderFn: 'renderAchievementsView' },
    { view: 'themes', labelKey: 'nav.themes', fallbackLabel: 'Themes', renderFn: 'renderThemesView' },
    { view: 'shop', labelKey: 'nav.shop', fallbackLabel: 'Shop', renderFn: 'renderShopView' },
    { view: 'customize', labelKey: 'nav.customize', fallbackLabel: 'Customize', renderFn: 'renderCustomizeView' },
    { view: 'system-health', labelKey: 'nav.systemHealth', fallbackLabel: 'System Health', renderFn: 'renderSystemHealthPage' },
    { view: 'manga-details', labelKey: 'systemHealth.route.mangaDetails', fallbackLabel: 'Manga Details', renderFn: 'loadMangaDetails' },
  ];

  let lastSmokeResult = null;
  let lastHealthData = null;
  let healthLoadedOnce = false;

  function esc(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function titleStatus(status) {
    if (status === 'fail') return tr('systemHealth.status.fail', 'Fail');
    if (status === 'warning') return tr('systemHealth.status.warning', 'Warning');
    return tr('systemHealth.status.pass', 'Pass');
  }

  function statusClass(status) {
    if (status === 'fail') return 'is-fail';
    if (status === 'warning') return 'is-warning';
    return 'is-pass';
  }

  function safeTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function safeHtmlById(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function formatTimestamp(iso) {
    if (!iso) return tr('systemHealth.status.never', 'Never');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function renderSummaryCards(healthData) {
    const overall = healthData?.overallStatus || 'fail';
    const dbStatus = healthData?.database?.status || 'fail';
    const smokeStatus = lastSmokeResult?.overallStatus || 'warning';
    const sourcesStatus = healthData?.sources?.status || 'warning';
    const sourceSummary = healthData?.sources?.summary || { total: 0, passing: 0, failing: 0 };

    const overallBadge = document.getElementById('systemHealthOverallBadge');
    const dbBadge = document.getElementById('systemHealthDatabaseBadge');
    const smokeBadge = document.getElementById('systemHealthSmokeBadge');
    const sourcesBadge = document.getElementById('systemHealthSourcesBadge');

    if (overallBadge) {
      overallBadge.className = 'sh-status-badge ' + statusClass(overall);
      overallBadge.textContent = titleStatus(overall);
    }
    if (dbBadge) {
      dbBadge.className = 'sh-status-badge ' + statusClass(dbStatus);
      dbBadge.textContent = titleStatus(dbStatus);
    }
    if (smokeBadge) {
      smokeBadge.className = 'sh-status-badge ' + statusClass(smokeStatus);
      smokeBadge.textContent = titleStatus(smokeStatus);
    }
    if (sourcesBadge) {
      sourcesBadge.className = 'sh-status-badge ' + statusClass(sourcesStatus);
      sourcesBadge.textContent = titleStatus(sourcesStatus);
    }

    safeTextById('systemHealthTimestamp', formatTimestamp(healthData?.app?.timestamp));
    safeTextById('systemHealthSmokeTimestamp', formatTimestamp(lastSmokeResult?.timestamp));
    safeTextById(
      'systemHealthSourcesSummary',
      sourceSummary.total > 0
        ? `${sourceSummary.passing}/${sourceSummary.total} ${tr('systemHealth.label.sourcesPassing', 'sources passing')}`
        : tr('systemHealth.status.noSourcesSummary', 'No sources detected')
    );
  }

  function renderSourceDiagnostics(sources) {
    const results = Array.isArray(sources?.results) ? sources.results : [];
    if (!results.length) {
      safeHtmlById('systemHealthSourcesGrid', `<p class="sh-empty">${esc(tr('systemHealth.status.noSources', 'No source diagnostics available.'))}</p>`);
      return;
    }

    safeHtmlById('systemHealthSourcesGrid', results.map((source) => `
      <div class="sh-module-card">
        <div class="sh-module-head">
          <span class="sh-module-label">${esc(source.name || source.id)}</span>
          <span class="sh-status-dot ${statusClass(source.status)}">${esc(titleStatus(source.status))}</span>
        </div>
        <p class="sh-module-id">${esc(source.id)}</p>
        <p class="sh-module-details">${esc(source.error || tr('systemHealth.status.sourceHealthy', 'Source is healthy'))}</p>
        ${source.errorCode ? `<p class="sh-module-id">${esc(source.errorCode)} · ${esc(source.errorLabel || '')}</p>` : ''}
        ${source.suggestedAction ? `<p class="sh-module-details">${esc(source.suggestedAction)}</p>` : ''}
      </div>
    `).join(''));
  }

  function renderSourceErrors(sources) {
    const entries = Array.isArray(sources?.recentErrors) ? sources.recentErrors : [];
    const catalog = Array.isArray(sources?.errorCatalog) ? sources.errorCatalog : [];
    if (!entries.length) {
      const catalogHtml = catalog.length
        ? `<div class="sh-card" style="margin-bottom:10px"><p class="sh-module-label">${esc(tr('systemHealth.section.errorList', 'Error list'))}</p>${catalog.map((item) => `<p class="sh-module-id">${esc(item.code)} · ${esc(item.label)} · x${esc(item.count)}</p>`).join('')}</div>`
        : '';
      safeHtmlById('systemHealthSourceErrors', `${catalogHtml}<p class="sh-empty">${esc(tr('systemHealth.status.noSourceErrors', 'No recent source errors recorded.'))}</p>`);
      return;
    }

    const catalogHtml = catalog.length
      ? `<div class="sh-card" style="margin-bottom:10px"><p class="sh-module-label">${esc(tr('systemHealth.section.errorList', 'Error list'))}</p>${catalog.map((item) => `<p class="sh-module-id">${esc(item.code)} · ${esc(item.label)} · x${esc(item.count)}</p>`).join('')}</div>`
      : '';

    safeHtmlById('systemHealthSourceErrors', `${catalogHtml}${entries.map((entry) => `
      <div class="sh-module-card">
        <div class="sh-module-head">
          <span class="sh-module-label">${esc(entry.area)}</span>
          <span class="sh-status-dot is-warning">${esc(tr('systemHealth.status.warning', 'Warning'))}</span>
        </div>
        <p class="sh-module-details">${esc(entry.message || '')}</p>
        <p class="sh-module-id">${esc(entry.errorCode || '')}${entry.errorLabel ? ` · ${esc(entry.errorLabel)}` : ''}${entry.code ? ` · ${esc(entry.code)}` : ''}${entry.count ? ` · x${esc(entry.count)}` : ''}${entry.lastSeenAt ? ` · ${esc(formatTimestamp(entry.lastSeenAt))}` : ''}</p>
        ${entry.suggestedAction ? `<p class="sh-module-details">${esc(entry.suggestedAction)}</p>` : ''}
      </div>
    `).join('')}`);
  }

  function buildErrorCopyPayload() {
    const health = lastHealthData || {};
    const sourceResults = Array.isArray(health?.sources?.results) ? health.sources.results : [];
    const recentErrors = Array.isArray(health?.sources?.recentErrors) ? health.sources.recentErrors : [];
    const failingSources = sourceResults.filter((s) => s.status === 'fail');
    const warnings = Array.isArray(health?.warnings) ? health.warnings : [];
    const errors = Array.isArray(health?.errors) ? health.errors : [];

    if (!failingSources.length && !recentErrors.length && !warnings.length && !errors.length) {
      return null;
    }

    return {
      copiedAt: new Date().toISOString(),
      overallStatus: health?.overallStatus || 'unknown',
      sources: {
        summary: health?.sources?.summary || { total: 0, passing: 0, failing: 0 },
        failing: failingSources,
        recentErrors,
      },
      warnings,
      errors,
    };
  }

  async function copyErrorsToClipboard() {
    const payload = buildErrorCopyPayload();
    if (!payload) {
      safeTextById('systemHealthLoadState', tr('systemHealth.copyErrorsEmpty', 'No errors to copy.'));
      return;
    }

    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      if (typeof showToast === 'function') {
        showToast(tr('systemHealth.copyErrorsBtn', 'Copy Errors'), tr('systemHealth.copyErrorsSuccess', 'Errors copied to clipboard.'), 'success');
      }
      safeTextById('systemHealthLoadState', tr('systemHealth.copyErrorsSuccess', 'Errors copied to clipboard.'));
    } catch (err) {
      safeTextById('systemHealthLoadState', `${tr('systemHealth.copyErrorsFailedPrefix', 'Failed to copy errors')}: ${err.message}`);
    }
  }

  function renderModules(modules) {
    const list = Array.isArray(modules) ? modules : [];
    if (!list.length) {
      safeHtmlById('systemHealthModulesGrid', `<p class=\"sh-empty\">${esc(tr('systemHealth.status.noModules', 'No module information available.'))}</p>`);
      return;
    }

    safeHtmlById('systemHealthModulesGrid', list.map(mod => `
      <div class=\"sh-module-card\">
        <div class=\"sh-module-head\">
          <span class=\"sh-module-label\">${esc(mod.label || mod.id)}</span>
          <span class=\"sh-status-dot ${statusClass(mod.status)}\">${esc(titleStatus(mod.status))}</span>
        </div>
        <p class=\"sh-module-id\">${esc(mod.id)}</p>
        <p class=\"sh-module-details\">${esc(mod.details || '')}</p>
      </div>
    `).join(''));
  }

  function renderHealthMessages(healthData) {
    const warnings = Array.isArray(healthData?.warnings) ? healthData.warnings : [];
    const errors = Array.isArray(healthData?.errors) ? healthData.errors : [];

    if (!warnings.length && !errors.length) {
      safeHtmlById('systemHealthMessages', `<p class=\"sh-empty\">${esc(tr('systemHealth.status.noWarnings', 'No warnings or errors reported.'))}</p>`);
      return;
    }

    const html = [];
    for (const msg of errors) {
      html.push(`<div class=\"sh-message sh-message-error\">${esc(msg)}</div>`);
    }
    for (const msg of warnings) {
      html.push(`<div class=\"sh-message sh-message-warning\">${esc(msg)}</div>`);
    }
    safeHtmlById('systemHealthMessages', html.join(''));
  }

  function renderSmokeChecks(smokeData, frontendChecks) {
    const backendChecks = Array.isArray(smokeData?.checks) ? smokeData.checks : [];
    const localChecks = Array.isArray(frontendChecks) ? frontendChecks : [];
    const checks = backendChecks.concat(localChecks);

    if (!checks.length) {
      safeHtmlById('systemHealthSmokeTableBody', `<tr><td colspan=\"5\" class=\"sh-empty\">${esc(tr('systemHealth.status.noSmokeChecks', 'No smoke checks executed.'))}</td></tr>`);
      return;
    }

    const rows = checks.map(check => {
      const duration = Number.isFinite(check.durationMs) ? `${Math.max(0, check.durationMs)} ms` : '-';
      return `
        <tr>
          <td>${esc(check.id)}</td>
          <td>${esc(check.label)}</td>
          <td><span class=\"sh-status-dot ${statusClass(check.status)}\">${esc(titleStatus(check.status))}</span></td>
          <td>${esc(duration)}</td>
          <td>${esc(check.details || '')}</td>
        </tr>
      `;
    }).join('');

    safeHtmlById('systemHealthSmokeTableBody', rows);
  }

  function computeFrontendOverall(checks) {
    if (checks.some(c => c.status === 'fail')) return 'fail';
    if (checks.some(c => c.status === 'warning')) return 'warning';
    return 'pass';
  }

  function runFrontendSmokeChecks() {
    const checks = [];
    const start = Date.now();

    function push(id, label, status, details) {
      checks.push({ id, label, status, details, durationMs: Date.now() - start });
    }

    const duplicateViews = [];
    const byView = {};
    for (const route of ROUTE_MANIFEST) {
      byView[route.view] = (byView[route.view] || 0) + 1;
    }
    for (const view of Object.keys(byView)) {
      if (byView[view] > 1) duplicateViews.push(view);
    }
    push(
      'fe-route-duplicates',
      tr('systemHealth.frontendCheck.routeDuplicates.label', 'Frontend routes have no duplicates'),
      duplicateViews.length ? 'fail' : 'pass',
      duplicateViews.length
        ? `${tr('systemHealth.frontendCheck.routeDuplicates.duplicatesPrefix', 'Duplicated views')}: ${duplicateViews.join(', ')}`
        : tr('systemHealth.frontendCheck.routeDuplicates.ok', 'No duplicates found in route manifest.')
    );

    const missingLabels = ROUTE_MANIFEST
      .map((route) => ({
        view: route.view,
        label: tr(route.labelKey, route.fallbackLabel),
      }))
      .filter((route) => !route.label || !route.label.trim())
      .map((route) => route.view);

    push(
      'fe-route-labels',
      tr('systemHealth.frontendCheck.routeLabels.label', 'Frontend routes have labels'),
      missingLabels.length ? 'warning' : 'pass',
      missingLabels.length
        ? `${tr('systemHealth.frontendCheck.routeLabels.missingPrefix', 'Missing labels for')}: ${missingLabels.join(', ')}`
        : tr('systemHealth.frontendCheck.routeLabels.ok', 'All routes define labels.')
    );

    const missingRender = ROUTE_MANIFEST
      .filter(r => r.renderFn)
      .filter(r => typeof window[r.renderFn] !== 'function')
      .map(r => `${r.view} -> ${r.renderFn}`);

    push(
      'fe-route-render-functions',
      tr('systemHealth.frontendCheck.routeRender.label', 'Frontend routes render functions exist'),
      missingRender.length ? 'warning' : 'pass',
      missingRender.length
        ? `${tr('systemHealth.frontendCheck.routeRender.missingPrefix', 'Missing functions')}: ${missingRender.join(', ')}`
        : tr('systemHealth.frontendCheck.routeRender.ok', 'All declared render functions are available.')
    );

    const sidebarViews = Array.from(document.querySelectorAll('.sidebar .nav-link[data-view]')).map(el => el.dataset.view);
    const manifestViews = new Set(ROUTE_MANIFEST.map(r => r.view));
    const missingFromManifest = sidebarViews.filter(v => !manifestViews.has(v));

    push(
      'fe-sidebar-manifest-match',
      tr('systemHealth.frontendCheck.sidebarMatch.label', 'Sidebar links exist in route manifest'),
      missingFromManifest.length ? 'fail' : 'pass',
      missingFromManifest.length
        ? `${tr('systemHealth.frontendCheck.sidebarMatch.missingPrefix', 'Sidebar views missing from manifest')}: ${missingFromManifest.join(', ')}`
        : tr('systemHealth.frontendCheck.sidebarMatch.ok', 'All sidebar links are mapped in route manifest.')
    );

    return {
      overallStatus: computeFrontendOverall(checks),
      checks,
      summary: {
        total: checks.length,
        pass: checks.filter(c => c.status === 'pass').length,
        warning: checks.filter(c => c.status === 'warning').length,
        fail: checks.filter(c => c.status === 'fail').length,
      },
    };
  }

  async function refreshHealth() {
    safeTextById('systemHealthLoadState', tr('systemHealth.status.loading', 'Loading health status...'));
    try {
      const healthData = await api('/api/system/health');
      lastHealthData = healthData;
      renderSummaryCards(healthData);
      renderSourceDiagnostics(healthData.sources || {});
      renderSourceErrors(healthData.sources || {});
      renderModules(healthData.modules || []);
      renderHealthMessages(healthData);
      safeTextById('systemHealthLoadState', tr('systemHealth.status.loaded', 'System health loaded.'));
    } catch (err) {
      safeTextById('systemHealthLoadState', `${tr('systemHealth.error.loadHealthPrefix', 'Failed to load health status')}: ${err.message}`);
      safeHtmlById('systemHealthSourcesGrid', `<p class="sh-empty">${esc(tr('systemHealth.error.sourceData', 'Could not load source diagnostics.'))}</p>`);
      safeHtmlById('systemHealthSourceErrors', `<p class="sh-empty">${esc(tr('systemHealth.error.sourceErrors', 'Could not load source error history.'))}</p>`);
      safeHtmlById('systemHealthModulesGrid', `<p class=\"sh-empty\">${esc(tr('systemHealth.error.moduleData', 'Could not load module data.'))}</p>`);
      safeHtmlById('systemHealthMessages', `<div class=\"sh-message sh-message-error\">${esc(err.message)}</div>`);
    }
  }

  async function runSmoke() {
    const runBtn = document.getElementById('systemHealthRunSmokeBtn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = tr('systemHealth.runSmokeBtnRunning', 'Running...');
    }

    safeTextById('systemHealthLoadState', tr('systemHealth.status.runningSmoke', 'Running smoke tests...'));

    try {
      const [backendSmoke, healthData] = await Promise.all([
        api('/api/system/smoke-test'),
        api('/api/system/health'),
      ]);
      lastHealthData = healthData;
      const frontendSmoke = runFrontendSmokeChecks();

      const combinedChecks = (backendSmoke.checks || []).concat(frontendSmoke.checks || []);
      const combinedStatus = computeFrontendOverall(combinedChecks);

      lastSmokeResult = {
        overallStatus: combinedStatus,
        checks: combinedChecks,
        timestamp: new Date().toISOString(),
      };

      renderSummaryCards(healthData);
      renderSourceDiagnostics(healthData.sources || {});
      renderSourceErrors(healthData.sources || {});
      renderModules(healthData.modules || []);
      renderHealthMessages(healthData);
      renderSmokeChecks(backendSmoke, frontendSmoke.checks);

      safeTextById(
        'systemHealthLoadState',
        `${tr('systemHealth.status.smokeFinishedPrefix', 'Smoke test finished')}: ${titleStatus(combinedStatus)} (backend ${backendSmoke.summary?.pass || 0} ${tr('systemHealth.status.pass', 'Pass').toLowerCase()} / ${backendSmoke.summary?.warning || 0} ${tr('systemHealth.status.warning', 'Warning').toLowerCase()} / ${backendSmoke.summary?.fail || 0} ${tr('systemHealth.status.fail', 'Fail').toLowerCase()}; frontend ${frontendSmoke.summary.pass} ${tr('systemHealth.status.pass', 'Pass').toLowerCase()} / ${frontendSmoke.summary.warning} ${tr('systemHealth.status.warning', 'Warning').toLowerCase()} / ${frontendSmoke.summary.fail} ${tr('systemHealth.status.fail', 'Fail').toLowerCase()}).`
      );
    } catch (err) {
      safeTextById('systemHealthLoadState', `${tr('systemHealth.error.smokeFailedPrefix', 'Smoke test failed')}: ${err.message}`);
      safeHtmlById('systemHealthSmokeTableBody', `<tr><td colspan=\"5\">${esc(err.message)}</td></tr>`);
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = tr('systemHealth.runSmokeBtn', 'Run Smoke Test');
      }
    }
  }

  function bindEvents() {
    const runBtn = document.getElementById('systemHealthRunSmokeBtn');
    const refreshBtn = document.getElementById('systemHealthRefreshBtn');
    const copyErrorsBtn = document.getElementById('systemHealthCopyErrorsBtn');

    if (runBtn && !runBtn.dataset.bound) {
      runBtn.dataset.bound = '1';
      runBtn.addEventListener('click', runSmoke);
    }

    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', refreshHealth);
    }

    if (copyErrorsBtn && !copyErrorsBtn.dataset.bound) {
      copyErrorsBtn.dataset.bound = '1';
      copyErrorsBtn.addEventListener('click', copyErrorsToClipboard);
    }
  }

  window.renderSystemHealthPage = async function renderSystemHealthPage() {
    bindEvents();
    if (!healthLoadedOnce) {
      healthLoadedOnce = true;
      await refreshHealth();
    }
  };
})();
