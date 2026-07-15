// ============================================================================
// INTERNATIONALIZATION (i18n) API
// ============================================================================

const LANGUAGE_ALIASES = {
  pt: 'pt-PT',
  'pt-pt': 'pt-PT',
  'pt-PT': 'pt-PT',
  en: 'en-GB',
  eng: 'en-GB',
  'eng-eng': 'en-GB',
  'en-eng': 'en-GB',
  'en-GB': 'en-GB',
  'en-US': 'en-GB'
};

const translations = window.ScrollScapeI18nLocales || {};

let rawLang = localStorage.getItem('language') || 'en';
let currentLanguage = LANGUAGE_ALIASES[rawLang] || 'en-GB';

/**
 * Look up a translation key in the current language, falling back to English.
 *
 * @param {string} key - Dot-separated translation key, e.g. "nav.home"
 * @returns {string} Translated string (or the key itself if not found)
 */
function t(key) {
  return translations[currentLanguage]?.[key] || translations['en-GB']?.[key] || key;
}

/**
 * Same as t(key) but returns a fallback if the key is missing entirely, rather than returning the key.
 */
function tr(key, fallback) {
  const value = translations[currentLanguage]?.[key] || translations['en-GB']?.[key];
  return value !== undefined ? value : (fallback !== undefined ? fallback : key);
}

/**
 * Switch the active language and re-render all translated DOM nodes.
 *
 * @param {"en"|"pt"|string} lang - New language code
 */
function setLanguage(lang) {
  const canonical = LANGUAGE_ALIASES[lang] || 'en-GB';
  if (!translations[canonical]) return;
  currentLanguage = canonical;
  localStorage.setItem('language', lang);
  applyTranslations();
  const btn = document.getElementById('langToggleBtn');
  if (btn) btn.textContent = canonical.toUpperCase();
}

/**
 * Walk the DOM and apply translations to every element that carries a
 * data-i18n, data-i18n-placeholder, or data-i18n-title attribute.
 */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
}

// Expose to window for non-module compatibility
window.t = t;
window.tr = tr;
window.setLanguage = setLanguage;
window.applyTranslations = applyTranslations;
window.LANGUAGE_ALIASES = LANGUAGE_ALIASES;
