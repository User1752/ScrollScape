// ============================================================================
// modules/debug.js — ScrollScape Debug & Error Tracking
//
// Provides structured, categorised error logging with an in-app panel.
//
// USAGE:
//   dbg.error(dbg.ERR_API,      'Request failed', err)
//   dbg.warn (dbg.ERR_ANILIST,  'Token expired')
//   dbg.info (dbg.ERR_SETTINGS, 'Settings loaded', { count: 5 })
//
// TOGGLE PANEL:  Ctrl+Shift+D   (works any time)
// ENABLE PERMANENTLY:  localStorage.scrollscape_debug = '1'
//                      (adds a persistent DBG button bottom-right)
//
// DISABLE:  dbg.disable()  or clear the localStorage key
// ============================================================================

const dbg = (() => {
  'use strict';

  // ── Error codes ─────────────────────────────────────────────────────────
  const ERR_SETTINGS    = 'SETTINGS';
  const ERR_STATE       = 'STATE';
  const ERR_SOURCE      = 'SOURCE';
  const ERR_API         = 'API';
  const ERR_ANILIST     = 'ANILIST';
  const ERR_PDF         = 'PDF';
  const ERR_DOWNLOAD    = 'DOWNLOAD';
  const ERR_COVER       = 'COVER';
  const ERR_ANALYTICS   = 'ANALYTICS';
  const ERR_ACHIEVE     = 'ACHIEVEMENTS';
  const ERR_MANGAUPD    = 'MANGAUPDATES';
  const ERR_GLOBAL      = 'GLOBAL';

  // ── Internal state ────────────────────────────────────────────────────────
  let _log = [];          // circular buffer of entries
  let _panel = null;      // DOM panel element or null
  let _enabled = localStorage.getItem('scrollscape_debug') === '1';
  const MAX_ENTRIES = 300;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Record an entry ───────────────────────────────────────────────────────
  function _record(level, code, message, extra) {
    const entry = {
      t:       new Date().toISOString(),
      level,
      code,
      message: String(message),
      extra:   extra instanceof Error
        ? { name: extra.name, msg: extra.message, stack: extra.stack }
        : (extra !== undefined ? extra : null),
    };
    _log.push(entry);
    if (_log.length > MAX_ENTRIES) _log.shift();

    // Always forward to the native console
    const native = level === 'error' ? console.error    // eslint-disable-line no-console
      : level === 'warn'  ? console.warn                // eslint-disable-line no-console
      : console.log;                                    // eslint-disable-line no-console
    native(`[ScrollScape][${code}]`, message, ...(extra !== undefined ? [extra] : []));

    if (_panel) _refreshPanel();
  }

  // ── Public logging API ────────────────────────────────────────────────────
  function error(code, message, extra) { _record('error', code, message, extra); }
  function warn (code, message, extra) { _record('warn',  code, message, extra); }
  function info (code, message, extra) { _record('info',  code, message, extra); }

  // ── Global error catchers ─────────────────────────────────────────────────
  function _installGlobalHandlers() {
    window.addEventListener('error', (ev) => {
      _record('error', ERR_GLOBAL, ev.message || 'Uncaught error', {
        file:  ev.filename,
        line:  ev.lineno,
        col:   ev.colno,
        stack: ev.error?.stack || null,
      });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason;
      _record('error', ERR_GLOBAL, `Unhandled rejection: ${reason?.message ?? reason}`, {
        stack: reason?.stack || null,
      });
    });
  }

  // ── Panel CSS (injected once) ─────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('dbg-styles')) return;
    const s  = document.createElement('style');
    s.id = 'dbg-styles';
    s.textContent = `
      #dbg-panel {
        position: fixed; bottom: 0; right: 0;
        width: min(540px, 98vw); max-height: 52vh;
        background: #0c0c12; border: 1px solid #2e2e40;
        border-right: 0; border-bottom: 0;
        border-radius: 10px 0 0 0;
        font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11.5px;
        z-index: 99999; display: flex; flex-direction: column;
        box-shadow: -2px -2px 24px rgba(0,0,0,.7);
      }
      #dbg-panel .dbg-head {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px;
        background: #14141e; border-bottom: 1px solid #2e2e40; flex-shrink: 0;
        border-radius: 10px 0 0 0;
      }
      #dbg-panel .dbg-head-title { color: #a78bfa; font-weight: 700; font-size: 13px; flex: 1; }
      #dbg-panel .dbg-head-count { font-size: 11px; color: #555; white-space: nowrap; }
      #dbg-panel .dbg-btn {
        padding: 2px 9px; background: #22223a; border: 1px solid #3a3a52;
        border-radius: 4px; color: #aaa; cursor: pointer; font-size: 11px;
        transition: background .15s;
      }
      #dbg-panel .dbg-btn:hover { background: #3a3a52; color: #fff; }
      #dbg-panel .dbg-body { overflow-y: auto; flex: 1; }
      .dbg-entry {
        display: grid; grid-template-columns: 76px 58px 80px 1fr;
        align-items: start; gap: 6px; padding: 4px 14px;
        border-bottom: 1px solid #18182a; cursor: pointer;
      }
      .dbg-entry:hover  { background: #14141e; }
      .dbg-entry .dbg-extra { display: none; }
      .dbg-entry.expanded .dbg-extra { display: block; }
      .dbg-time  { color: #4a4a6a; font-size: 10px; padding-top: 2px; }
      .dbg-badge {
        display: inline-block; padding: 1px 5px; border-radius: 3px;
        font-size: 10px; font-weight: 700; text-align: center; line-height: 1.6;
      }
      .dbg-badge.error { background: #7f1d1d; color: #fca5a5; }
      .dbg-badge.warn  { background: #78350f; color: #fcd34d; }
      .dbg-badge.info  { background: #1e3a5f; color: #93c5fd; }
      .dbg-code  { color: var(--primary-light); font-size: 10px; margin-right: 3px; }
      .dbg-msg   { color: #c9d1d9; line-height: 1.5; word-break: break-word; }
      .dbg-extra {
        grid-column: 1 / -1; margin-top: 4px; padding: 6px 10px;
        background: #080812; border-radius: 4px;
        color: #86efac; white-space: pre-wrap; font-size: 10px;
        max-height: 120px; overflow-y: auto;
      }
      #dbg-toggle {
        position: fixed; bottom: 0; right: 0; z-index: 99998;
        background: #14141e; border: 1px solid #2e2e40;
        border-right: 0; border-bottom: 0;
        border-radius: 8px 0 0 0; padding: 5px 11px;
        cursor: pointer; font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 11px; color: #a78bfa;
        display: flex; align-items: center; gap: 6px;
        user-select: none; transition: background .15s;
      }
      #dbg-toggle:hover { background: #1e1e30; }
      #dbg-toggle .dbg-ec {
        background: #7f1d1d; color: #fca5a5;
        border-radius: 3px; padding: 0 5px;
        font-size: 10px; font-weight: 700;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Render panel content ──────────────────────────────────────────────────
  function _refreshPanel() {
    if (!_panel) return;
    const body    = _panel.querySelector('#dbg-body');
    const countEl = _panel.querySelector('#dbg-head-count');

    // Single pass: count errors and warnings simultaneously.
    let totalErrors = 0, totalWarns = 0;
    for (const e of _log) {
      if      (e.level === 'error') totalErrors++;
      else if (e.level === 'warn')  totalWarns++;
    }
    countEl.textContent =
      `${_log.length} entries · ${totalErrors} errors · ${totalWarns} warnings`;

    body.innerHTML = [..._log].reverse().map((e) => {
      const time  = e.t.slice(11, 23);
      const extra = e.extra ? JSON.stringify(e.extra, null, 2) : '';
      return `<div class="dbg-entry" onclick="this.classList.toggle('expanded')">
        <span class="dbg-time">${time}</span>
        <span class="dbg-badge ${e.level}">${e.level.toUpperCase()}</span>
        <span class="dbg-badge info" style="font-weight:400">${_esc(e.code)}</span>
        <span class="dbg-msg">${_esc(e.message)}</span>
        ${extra ? `<pre class="dbg-extra">${_esc(extra)}</pre>` : ''}
      </div>`;
    }).join('');

    // Update toggle button error count
    const toggleEl = document.getElementById('dbg-toggle');
    if (toggleEl) {
      let ec = toggleEl.querySelector('.dbg-ec');
      if (totalErrors > 0) {
        if (!ec) { ec = document.createElement('span'); ec.className = 'dbg-ec'; toggleEl.appendChild(ec); }
        ec.textContent = totalErrors;
      } else if (ec) {
        ec.remove();
      }
    }
  }

  // ── Build / destroy panel ─────────────────────────────────────────────────
  function _buildPanel() {
    _injectStyles();
    const el = document.createElement('div');
    el.id = 'dbg-panel';
    el.innerHTML = `
      <div class="dbg-head">
        <span class="dbg-head-title">ScrollScape Debug</span>
        <span class="dbg-head-count" id="dbg-head-count"></span>
        <button class="dbg-btn" id="dbg-copy-btn">Copy</button>
        <button class="dbg-btn" id="dbg-clear-btn">Clear</button>
        <button class="dbg-btn" id="dbg-close-btn">✕</button>
      </div>
      <div class="dbg-body" id="dbg-body"></div>
    `;
    document.body.appendChild(el);
    _panel = el;

    el.querySelector('#dbg-close-btn').onclick = hidePanel;
    el.querySelector('#dbg-clear-btn').onclick = () => { _log = []; _refreshPanel(); };
    el.querySelector('#dbg-copy-btn').onclick  = () => {
      const txt = JSON.stringify(_log, null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => {
          const btn = el.querySelector('#dbg-copy-btn');
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });
      }
    };
    _refreshPanel();
  }

  function showPanel() { if (_panel) { _refreshPanel(); return; } _buildPanel(); }
  function hidePanel() { _panel?.remove(); _panel = null; }
  function togglePanel() { _panel ? hidePanel() : showPanel(); }

  // ── Toggle button ─────────────────────────────────────────────────────────
  function _buildToggle() {
    if (document.getElementById('dbg-toggle')) return;
    _injectStyles();
    const btn = document.createElement('div');
    btn.id = 'dbg-toggle';
    btn.title = 'Debug panel  (Ctrl+Shift+D)';
    btn.innerHTML = '<span>DBG</span>';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
  }

  // ── Enable / disable ──────────────────────────────────────────────────────
  function enable() {
    _enabled = true;
    localStorage.setItem('scrollscape_debug', '1');
    if (document.body) _buildToggle();
    else document.addEventListener('DOMContentLoaded', _buildToggle);
    info('SYSTEM', 'Debug mode enabled');
  }

  function disable() {
    _enabled = false;
    localStorage.removeItem('scrollscape_debug');
    hidePanel();
    document.getElementById('dbg-toggle')?.remove();
  }

  function isEnabled() { return _enabled; }

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      if (!_enabled) enable();
      else togglePanel();
    }
  });

  // ── Auto-init ─────────────────────────────────────────────────────────────
  _installGlobalHandlers();
  if (_enabled) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _buildToggle);
    else _buildToggle();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // error codes
    ERR_SETTINGS, ERR_STATE, ERR_SOURCE, ERR_API,
    ERR_ANILIST, ERR_PDF, ERR_DOWNLOAD, ERR_COVER,
    ERR_ANALYTICS, ERR_ACHIEVE, ERR_MANGAUPD, ERR_GLOBAL,
    // logging
    error, warn, info,
    // panel
    showPanel, hidePanel, togglePanel,
    // control
    enable, disable, isEnabled,
    // log access
    getLog: () => [..._log],
  };
})();
