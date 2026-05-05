/**
 * customSelect.js — Premium custom dropdown replacement for <select> elements.
 * Uses event delegation (single global listeners) for optimal performance.
 * Auto-initialises on DOMContentLoaded and watches for dynamically added selects.
 */
(function () {
  'use strict';

  const ATTR = 'data-cs-init';
  const SVG_ARROW = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 5 7 10 12 5"/></svg>';
  const SVG_CHECK = '<svg class="cs-check" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 6.5 4.5 9.5 10.5 2.5"/></svg>';

  function closeDropdown(trigger, list, immediate = false) {
    if (!trigger || !list) return;
    trigger.classList.remove('cs-open');
    trigger.setAttribute('aria-expanded', 'false');

    if (list._csCloseTimer) {
      clearTimeout(list._csCloseTimer);
      list._csCloseTimer = null;
    }

    if (immediate || list.classList.contains('cs-hidden')) {
      list.classList.remove('cs-closing');
      list.classList.add('cs-hidden');
      return;
    }

    list.classList.add('cs-closing');
    list._csCloseTimer = setTimeout(() => {
      list.classList.remove('cs-closing');
      list.classList.add('cs-hidden');
      list._csCloseTimer = null;
    }, 165);
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const getLabel = (opt) => opt ? opt.textContent.trim() : '';

  /* ── Close every open dropdown (except `except`) ─────────────────────── */
  function closeAll(except) {
    document.querySelectorAll('.cs-trigger.cs-open').forEach(t => {
      if (t === except) return;
      const list = t.nextElementSibling;
      closeDropdown(t, list, false);
    });
  }

  /* ── Build custom wrapper for one native <select> ────────────────────── */
  function buildCustomSelect(native) {
    if (!native || native.hasAttribute(ATTR)) return;
    native.setAttribute(ATTR, '1');

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'cs-wrapper';
    if (native.classList.contains('form-control'))   wrapper.classList.add('cs-form-control');
    if (native.classList.contains('form-control-sm')) wrapper.classList.add('cs-sm');
    if (native.classList.contains('filter-dropdown')) wrapper.classList.add('cs-filter-dropdown');
    if (native.classList.contains('language-selector')) wrapper.classList.add('cs-lang');
    if (native.style.width) wrapper.style.width = native.style.width;
    if (native.id) wrapper.dataset.csFor = native.id;
    native.parentNode.insertBefore(wrapper, native);
    wrapper.appendChild(native);

    // Trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    // Options list container
    const list = document.createElement('div');
    list.className = 'cs-list cs-hidden';
    list.setAttribute('role', 'listbox');

    /* Sync trigger label with native value */
    function syncTrigger() {
      const sel = native.options[native.selectedIndex];
      trigger.innerHTML = `<span class="cs-value">${getLabel(sel)}</span><span class="cs-arrow">${SVG_ARROW}</span>`;
    }

    /* Build option items (uses DocumentFragment for batch DOM insert) */
    function buildItems() {
      const frag = document.createDocumentFragment();
      const opts = native.options;
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        if (opt.value === '' && !opt.textContent.trim() && opts.length > 1) continue;
        const item = document.createElement('div');
        item.className = 'cs-option' + (opt.selected ? ' cs-selected' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(opt.selected));
        item.dataset.value = opt.value;
        item.dataset.idx = String(i);
        const label = document.createElement('span');
        label.className = 'cs-opt-label';
        label.textContent = opt.textContent.trim();
        item.appendChild(label);
        if (opt.selected) item.insertAdjacentHTML('beforeend', SVG_CHECK);
        frag.appendChild(item);
      }
      list.textContent = '';
      list.appendChild(frag);
    }

    /* Position & open */
    function open() {
      buildItems();
      const rect = wrapper.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = below < 240 && rect.top > 240;
      list.style.bottom = above ? '100%' : 'auto';
      list.style.top = above ? 'auto' : '100%';
      list.style.marginBottom = above ? '6px' : '';
      list.style.marginTop = above ? '' : '6px';
      list.classList.toggle('cs-above', above);
      list.classList.toggle('cs-below', !above);
      if (list._csCloseTimer) {
        clearTimeout(list._csCloseTimer);
        list._csCloseTimer = null;
      }
      list.classList.remove('cs-closing');
      list.classList.remove('cs-hidden');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('cs-open');
      requestAnimationFrame(() => {
        const sel = list.querySelector('.cs-selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      });
    }

    function close() {
      closeDropdown(trigger, list, false);
    }

    function toggle() {
      const isOpen = trigger.classList.contains('cs-open');
      closeAll(isOpen ? null : trigger);
      if (!isOpen) open(); else close();
    }

    function selectByIndex(idx) {
      if (idx < 0 || idx >= native.options.length) return;
      native.selectedIndex = idx;
      native.dispatchEvent(new Event('change', { bubbles: true }));
      syncTrigger();
      buildItems();
      requestAnimationFrame(() => {
        const items = list.querySelectorAll('.cs-option');
        if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
      });
    }

    /* Delegated click on option items */
    list.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.cs-option');
      if (!item) return;
      e.preventDefault();
      const idx = parseInt(item.dataset.idx, 10);
      if (!isNaN(idx)) {
        native.selectedIndex = idx;
        native.dispatchEvent(new Event('change', { bubbles: true }));
        syncTrigger();
      }
      close();
    });

    /* Toggle on trigger click */
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    /* Keyboard navigation */
    trigger.addEventListener('keydown', (e) => {
      const isOpen = trigger.classList.contains('cs-open');
      const { key } = e;
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { open(); return; }
        const curr = native.selectedIndex;
        selectByIndex(key === 'ArrowDown'
          ? Math.min(curr + 1, native.options.length - 1)
          : Math.max(curr - 1, 0));
      } else if (key === 'Enter' || key === ' ') {
        e.preventDefault(); toggle();
      } else if (key === 'Escape') {
        close();
      } else if (key === 'Home') {
        e.preventDefault(); if (isOpen) selectByIndex(0);
      } else if (key === 'End') {
        e.preventDefault(); if (isOpen) selectByIndex(native.options.length - 1);
      }
    });

    /* Watch native <select> for external changes */
    const mo = new MutationObserver(syncTrigger);
    mo.observe(native, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
    native.addEventListener('change', syncTrigger);

    /* Assemble */
    syncTrigger();
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
  }

  /* ── Global event delegation (2 listeners total, not per-instance) ───── */
  document.addEventListener('click', () => closeAll(null));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(null); });

  /* ── Init & MutationObserver for dynamic selects ─────────────────────── */
  function initAll() {
    document.querySelectorAll('select:not([' + ATTR + '])').forEach(buildCustomSelect);
  }

  function startObserver() {
    initAll();
    const mo = new MutationObserver((mutations) => {
      let found = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'SELECT' && !node.hasAttribute(ATTR)) { found = true; break; }
          if (node.querySelector?.('select:not([' + ATTR + '])')) { found = true; break; }
        }
        if (found) break;
      }
      if (found) initAll();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  window.initCustomSelects = initAll;
  window.buildCustomSelect = buildCustomSelect;
})();
