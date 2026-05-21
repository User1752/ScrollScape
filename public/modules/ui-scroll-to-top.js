// ============================================================================
// SCROLL TO TOP BUTTON
// Shows a floating "back to top" button in the bottom-right corner when the
// user scrolls past the #readingStatusSection (manga details page).
// The button is only visible on the manga details view.
// ============================================================================

(function () {
  'use strict';

  // The sentinel element: the reading status section at the top of the page.
  const SENTINEL_ID = 'readingStatusSection';
  // The details view that must be active for the button to appear.
  const DETAILS_VIEW_ID = 'view-manga-details';

  let _btn = null;
  let _observer = null;
  let _isVisible = false;

  // ── Button creation ────────────────────────────────────────────────────────

  function _createButton() {
    const btn = document.createElement('button');
    btn.id = 'scrollToTopBtn';
    btn.className = 'scroll-to-top-btn';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.setAttribute('title', 'Scroll to top');

    // Inline SVG arrow-up so there is no external dependency.
    btn.innerHTML =
      '<svg class="scroll-to-top-btn__icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<polyline points="18 15 12 9 6 15"/>' +
      '</svg>';

    btn.addEventListener('click', _scrollToTop);
    document.body.appendChild(btn);
    return btn;
  }

  // ── Scroll behaviour ───────────────────────────────────────────────────────

  function _scrollToTop() {
    const detailsView = document.getElementById(DETAILS_VIEW_ID);
    if (detailsView) {
      detailsView.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Fallback: also scroll the document root.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Visibility control ─────────────────────────────────────────────────────

  function _show() {
    if (_isVisible) return;
    _isVisible = true;
    if (_btn) _btn.classList.add('is-visible');
  }

  function _hide() {
    if (!_isVisible) return;
    _isVisible = false;
    if (_btn) _btn.classList.remove('is-visible');
  }

  // ── IntersectionObserver for the sentinel element ──────────────────────────

  function _attachObserver() {
    const sentinel = document.getElementById(SENTINEL_ID);
    if (!sentinel) return;

    if (_observer) {
      _observer.disconnect();
    }

    _observer = new IntersectionObserver(
      function (entries) {
        const detailsView = document.getElementById(DETAILS_VIEW_ID);
        const detailsVisible =
          detailsView && !detailsView.classList.contains('hidden');

        if (!detailsVisible) {
          // Details view is not active — always hide.
          _hide();
          return;
        }

        const entry = entries[0];

        if (entry.isIntersecting) {
          // Sentinel is visible — reading status is on screen.
          _hide();
          return;
        }

        // Sentinel is off-screen. Determine whether it is above or below.
        // top < 0  → sentinel scrolled above the viewport (user passed it) → show.
        // top > 0  → sentinel is below the viewport (not yet reached)      → hide.
        if (entry.boundingClientRect.top < 0) {
          _show();
        } else {
          _hide();
        }
      },
      {
        root: null,
        threshold: 0,
      }
    );

    _observer.observe(sentinel);
  }

  // ── React to view changes ──────────────────────────────────────────────────
  // When the active view changes, re-evaluate visibility without waiting for a
  // scroll event. We patch the global setView function after it is defined.

  function _onViewChange() {
    const detailsView = document.getElementById(DETAILS_VIEW_ID);
    const detailsVisible =
      detailsView && !detailsView.classList.contains('hidden');

    if (!detailsVisible) {
      // Hide immediately when leaving the manga details view.
      _hide();
      return;
    }

    // Re-attach observer in case a new manga was loaded (sentinel re-rendered).
    _attachObserver();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  function init() {
    if (_btn) return;

    _btn = _createButton();

    // Observe the sentinel element as soon as it exists.
    _attachObserver();

    // Intercept the global setView so we react to view changes.
    if (typeof window.setView === 'function') {
      const _originalSetView = window.setView;
      window.setView = function () {
        _originalSetView.apply(this, arguments);
        // Give the DOM a tick to apply the hidden/visible classes.
        requestAnimationFrame(_onViewChange);
      };
    }

    // Also re-attach the observer when manga details finish rendering,
    // since renderReadingStatusSection replaces the sentinel's innerHTML.
    if (typeof window.renderReadingStatusSection === 'function') {
      const _originalRender = window.renderReadingStatusSection;
      window.renderReadingStatusSection = function () {
        _originalRender.apply(this, arguments);
        // Re-observe after the sentinel content changes.
        requestAnimationFrame(_attachObserver);
      };
    }
  }

  // Wait until the DOM is fully ready before initialising.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
