// ============================================================================
// INTERNATIONALIZATION (i18n)
// Provides translations, current-language tracking, and DOM auto-translation.
//
// Usage:
//   t("nav.home")           → "Home" (or Portuguese equivalent if lang="pt")
//   setLanguage("pt")       → persists choice, re-renders all [data-i18n] nodes
//   applyTranslations()     → re-render all [data-i18n*] attributes
// ============================================================================

/** @type {Record<string, Record<string, string>>} */
const translations = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.search": "Advanced Search",
    "nav.library": "Library",
    "nav.analytics": "Analytics",
    "nav.settings": "Settings",
    
    // Home
    "home.title": "Discover & Read Manga",
    "home.subtitle": "Access thousands of manga titles from multiple sources, track your reading progress, and enjoy a seamless reading experience — all in one place.",
    "home.tag": "Your Ultimate Manga Destination",
    "home.sources": "Sources",
    "home.search": "Search Manga",
    "home.searchPlaceholder": "Enter manga title...",
    "home.searchBtn": "Search",
    
    // Features
    "features.search.title": "Advanced Search",
    "features.search.desc": "Find exactly what you're looking for with powerful filters and sorting options",
    "features.reader.title": "Smart Reader",
    "features.reader.desc": "Enhanced reading experience with multiple modes, auto-scroll, and zoom controls",
    "features.track.title": "Track Progress",
    "features.track.desc": "Keep track of what you've read with analytics and achievements",
    "features.sources.title": "Multiple Sources",
    "features.sources.desc": "Access manga from MangaDex, MangaNato, Asura Scans, and more in one app",
    
    // Search & Filters
    "search.filters": "Filters",
    "search.genres": "Genres",
    "search.status": "Status",
    "search.sortBy": "Sort By",
    "search.relevance": "Relevance",
    "search.rating": "Rating",
    "search.alphabetical": "Alphabetical",
    "search.recent": "Recent",
    
    // Manga Details
    "manga.addToLibrary": "Add to Library",
    "manga.inLibrary": "In Library",
    "manga.status": "Status",
    "manga.author": "Author",
    "manga.artist": "Artist",
    "manga.genres": "Genres",
    "manga.description": "Description",
    "manga.chapters": "Chapters",
    "manga.readingStatus": "Reading Status",
    
    // Chapters
    "chapters.available": "Available",
    "chapters.unread": "Unread",
    "chapters.checkIntegrity": "Check Integrity",
    "chapters.bulkDownload": "Bulk Download",
    "chapters.download": "Download",
    "chapters.read": "Read",
    
    // Library
    "library.title": "My Library",
    "library.all": "All",
    "library.reading": "Reading",
    "library.completed": "Completed",
    "library.planToRead": "Plan to Read",
    "library.onHold": "On Hold",
    "library.dropped": "Dropped",
    
    // Reader
    "reader.close": "Close",
    "reader.previous": "Previous",
    "reader.next": "Next",
    "reader.zoomIn": "Zoom In",
    "reader.zoomOut": "Zoom Out",
    "reader.autoScroll": "Auto Scroll",
    "reader.settings": "Settings",
    
    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.readingMode": "Reading Mode",
    "settings.ltr": "Left to Right",
    "settings.rtl": "Right to Left",
    "settings.webtoon": "Webtoon",
    
    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.yes": "Yes",
    "common.no": "No",
    "common.apAvailable": "AP Available",

    // Sidebar
    "sidebar.browse": "Browse",
    "sidebar.myContent": "My Content",
    "sidebar.statsRewards": "Stats & Rewards",
    "settings.btn": "Settings",

    // Navigation extras
    "nav.history": "History",
    "nav.achievements": "Achievements",
    "nav.themes": "Themes",
    "nav.shop": "Theme Shop",
    "nav.customize": "Customization",

    // Discover sections
    "home.recommended": "Recommended For You",
    "home.allTimePopular": "Most Popular of All Time",
    "home.popularToday": "Most Popular Today",
    "home.recentlyAdded": "Recently Added",
    "home.latestUpdates": "Latest Updates",

    // Analytics
    "analytics.title": "My Reading Analytics",
    "analytics.chaptersRead": "Chapters Read",
    "analytics.timeSpent": "Time Spent",
    "analytics.meanScore": "Mean Score",
    "analytics.inLibrary": "In Library",
    "analytics.byStatus": "Library by Status",
    "analytics.recentSessions": "Recent Reading Sessions",

    // Achievements page
    "achievements.title": "Achievements",
    "achievements.subtitle": "Unlock achievements by reading manga — each one earns 1 AP",

    // Shop
    "shop.subtitle": "Spend your Achievement Points on exclusive themes",
    "shop.free": "Free",
    "shop.need": "Need",
    "shop.getFree": "Get Free",
    "shop.toastNotEnoughAp": "Not enough AP",
    "shop.toastThemeUnlocked": "Theme unlocked!",

    // Themes hub
    "themes.subtitle": "Themes you bought and presets you created",
    "themes.btnCustomize": "Customization",
    "themes.btnOpenShop": "Open Shop",
    "themes.ownedTitle": "Owned Themes",
    "themes.customPresetsTitle": "Your Theme Presets",
    "themes.unlockedFallback": "Unlocked theme",
    "themes.customPresetFallback": "Custom Preset",
    "themes.customPresetDesc": "Preset created by you",
    "themes.noUnlocked": "No unlocked themes yet.",
    "themes.noAddedPresets": "No presets added to Themes yet.",
    "themes.toastPresetAdded": "Preset added to Themes",
    "themes.toastPresetRemoved": "Preset removed from Themes",
    "themes.toastSelectedTitle": "Theme selected",
    "themes.toastSelectedBody": "Open customization to adjust images",

    // Actions
    "action.active": "Active",
    "action.apply": "Apply",
    "action.settings": "Settings",
    "action.remove": "Remove",
    "action.edit": "Edit",
    "action.buy": "Buy",
    "action.load": "Load",
    "action.addToThemes": "Add to Themes",
    "action.addedToThemes": "Added to Themes",
    "action.resetAll": "Reset All",
    "action.reset": "Clear",
    "action.savePreset": "Save Preset",
    "action.editPresets": "Edit Presets",

    // Customization
    "customization.subtitle": "Personalize your interface with custom images",
    "customization.background.title": "Background",
    "customization.background.desc": "Full-page wallpaper",
    "customization.leftColumn.title": "Left Column",
    "customization.leftColumn.desc": "Character art along the left sidebar",
    "customization.header.title": "Header",
    "customization.header.desc": "Image in the top bar",
    "customization.header.focusX": "Horizontal focus",
    "customization.header.focusY": "Vertical focus",
    "customization.corner.title": "Corner Card",
    "customization.corner.desc": "Small card at bottom-left corner",
    "customization.imageUrl": "Image URL",
    "customization.darkness": "Darkness",
    "customization.transparency": "Transparency",
    "customization.palette.title": "Colour Palette",
    "customization.palette.desc": "Accent colours used across the interface",
    "customization.palette.toggleTitle": "Toggle colour picker",
    "customization.font.title": "Typography",
    "customization.font.desc": "Choose the interface font for this preset",
    "customization.font.familyLabel": "Font family",
    "customization.primary": "Primary",
    "customization.dark": "Dark",
    "customization.light": "Light",
    "customization.hex": "Hex",
    "customization.sampler.title": "Image Colour Sampler",
    "customization.sampler.desc": "Load an image, hover to preview, click to pick a colour into the palette",
    "customization.sampler.urlPlaceholder": "Paste image URL and press Enter...",
    "customization.sampler.uploadLabel": "or upload a file",
    "customization.sampler.noImage": "No image loaded",
    "customization.sampler.recent": "Recent picks",
    "customization.presetNamePlaceholder": "Preset name...",
    "customization.savedPresets": "Saved Presets",
    "customization.noSavedPresets": "No saved presets yet",
    "customization.defaultPresetName": "My Preset",
    "customization.toastApplied": "Customization applied",
    "customization.toastPresetSaved": "Preset saved!",
    "customization.toastReset": "Customization reset",
    "customization.toastSamplerTitle": "Sampler",
    "customization.toastSamplerError": "Could not load image (check URL / CORS)",
    "customization.toastColorPicked": "Colour picked",
    "customization.toastPresetApplied": "Preset applied",
    "customization.button.title": "Button Colour",
    "customization.button.desc": "Override the colour used for all buttons",
    "customization.button.colorLabel": "Button colour",
    "customization.button.previewPrimary": "Primary",
    "customization.button.previewSecondary": "Secondary",
    "customization.toastLoadedEditing": "Loaded for editing",
    "customization.updatePreset": "Update Preset",

    // History
    "history.title": "Reading History",

    // Manga details
    "manga.back": "Back",

    // Context menu
    "context.markRead": "Mark as Read",
    "context.markUnread": "Mark as Unread",
    "context.remove": "Remove from Library",

    // Calendar
    "nav.calendar": "Calendar",
    "calendar.title": "Release Calendar",
    "calendar.noReleases": "No releases this month",
    "calendar.loading": "Loading releases...",
    "calendar.chapter": "Ch.",
    "calendar.today": "Today",
    "calendar.estimated": "Estimated",
    "calendar.releasing": "Also releasing this month (no schedule data)",
    "calendar.days.sun": "Sun",
    "calendar.days.mon": "Mon",
    "calendar.days.tue": "Tue",
    "calendar.days.wed": "Wed",
    "calendar.days.thu": "Thu",
    "calendar.days.fri": "Fri",
    "calendar.days.sat": "Sat"
  },
  pt: {
    // Navigation
    "nav.home": "Início",
    "nav.search": "Pesquisa Avançada",
    "nav.library": "Biblioteca",
    "nav.analytics": "Estatísticas",
    "nav.settings": "Definições",
    
    // Home  
    "home.title": "Descobre & Lê Mangá",
    "home.subtitle": "Acede a milhares de títulos de mangá de várias fontes, acompanha o teu progresso de leitura e desfruta de uma experiência perfeita — tudo num só lugar.",
    "home.tag": "O Teu Destino de Mangá",
    "home.sources": "Fontes",
    "home.search": "Pesquisar Mangá",
    "home.searchPlaceholder": "Escreve o título do mangá...",
    "home.searchBtn": "Pesquisar",
    
    // Features
    "features.search.title": "Pesquisa Avançada",
    "features.search.desc": "Encontra exatamente o que procuras com filtros poderosos e opções de ordenação",
    "features.reader.title": "Leitor Inteligente",
    "features.reader.desc": "Experiência de leitura melhorada com múltiplos modos, deslocação automática e controlos de zoom",
    "features.track.title": "Acompanha o Progresso",
    "features.track.desc": "Mantém o controlo do que leste com estatísticas, conquistas e listas personalizadas",
    "features.sources.title": "Múltiplas Fontes",
    "features.sources.desc": "Acede a mangá do MangaDex, MangaNato, Asura Scans e muito mais numa só aplicação",
    
    // Search & Filters
    "search.filters": "Filtros",
    "search.genres": "Géneros",
    "search.status": "Status",
    "search.sortBy": "Ordenar Por",
    "search.relevance": "Relevância",
    "search.rating": "Avaliação",
    "search.alphabetical": "Alfabética",
    "search.recent": "Recentes",
    
    // Manga Details
    "manga.addToLibrary": "Adicionar à Biblioteca",
    "manga.inLibrary": "Na Biblioteca",
    "manga.status": "Status",
    "manga.author": "Autor",
    "manga.artist": "Artista",
    "manga.genres": "Géneros",
    "manga.description": "Descrição",
    "manga.chapters": "Capítulos",
    "manga.readingStatus": "Status de Leitura",
    
    // Chapters
    "chapters.available": "Disponíveis",
    "chapters.unread": "Não Lidos",
    "chapters.checkIntegrity": "Verificar Integridade",
    "chapters.bulkDownload": "Download em Massa",
    "chapters.download": "Transferir",
    "chapters.read": "Ler",
    
    // Library
    "library.title": "A Minha Biblioteca",
    "library.all": "Todos",
    "library.reading": "A Ler",
    "library.completed": "Concluídos",
    "library.planToRead": "Quero Ler",
    "library.onHold": "Em Pausa",
    "library.dropped": "Abandonados",
    
    // Reader
    "reader.close": "Fechar",
    "reader.previous": "Anterior",
    "reader.next": "Seguinte",
    "reader.zoomIn": "Aumentar Zoom",
    "reader.zoomOut": "Diminuir Zoom",
    "reader.autoScroll": "Deslocação Automática",
    "reader.settings": "Definições",
    
    // Settings
    "settings.title": "Definições",
    "settings.language": "Idioma",
    "settings.theme": "Tema",
    "settings.readingMode": "Modo de Leitura",
    "settings.ltr": "Esquerda para Direita",
    "settings.rtl": "Direita para Esquerda",
    "settings.webtoon": "Webtoon",
    
    // Common
    "common.loading": "A carregar...",
    "common.error": "Erro",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.delete": "Eliminar",
    "common.close": "Fechar",
    "common.confirm": "Confirmar",
    "common.yes": "Sim",
    "common.no": "Não",
    "common.apAvailable": "AP Disponíveis",

    // Sidebar
    "sidebar.browse": "Explorar",
    "sidebar.myContent": "O Meu Conteúdo",
    "sidebar.statsRewards": "Estatísticas & Recompensas",
    "settings.btn": "Definições",

    // Navigation extras
    "nav.history": "Histórico",
    "nav.achievements": "Conquistas",
    "nav.themes": "Temas",
    "nav.shop": "Loja de Temas",
    "nav.customize": "Personalização",

    // Discover sections
    "home.recommended": "Recomendado Para Ti",
    "home.allTimePopular": "Mais Popular de Sempre",
    "home.popularToday": "Mais Popular Hoje",
    "home.recentlyAdded": "Adicionado Recentemente",
    "home.latestUpdates": "Últimas Atualizações",

    // Analytics
    "analytics.title": "As Minhas Estatísticas de Leitura",
    "analytics.chaptersRead": "Capítulos Lidos",
    "analytics.timeSpent": "Tempo Gasto",
    "analytics.meanScore": "Pontuação Média",
    "analytics.inLibrary": "Na Biblioteca",
    "analytics.byStatus": "Biblioteca por Estado",
    "analytics.recentSessions": "Sessões de Leitura Recentes",

    // Achievements page
    "achievements.title": "Conquistas",
    "achievements.subtitle": "Desbloqueia conquistas ao ler mangá — cada uma vale 1 AP",

    // Shop
    "shop.subtitle": "Gasta os teus Pontos de Conquista em temas exclusivos",
    "shop.free": "Grátis",
    "shop.need": "Precisas de",
    "shop.getFree": "Obter Grátis",
    "shop.toastNotEnoughAp": "AP insuficientes",
    "shop.toastThemeUnlocked": "Tema desbloqueado!",

    // Hub de temas
    "themes.subtitle": "Temas comprados e presets criados por ti",
    "themes.btnCustomize": "Personalização",
    "themes.btnOpenShop": "Abrir Loja",
    "themes.ownedTitle": "Temas Comprados",
    "themes.customPresetsTitle": "Os Teus Presets de Tema",
    "themes.unlockedFallback": "Tema desbloqueado",
    "themes.customPresetFallback": "Preset Personalizado",
    "themes.customPresetDesc": "Preset criado por ti",
    "themes.noUnlocked": "Ainda não tens temas desbloqueados.",
    "themes.noAddedPresets": "Ainda não adicionaste presets aos Temas.",
    "themes.toastPresetAdded": "Preset adicionado aos Temas",
    "themes.toastPresetRemoved": "Preset removido dos Temas",
    "themes.toastSelectedTitle": "Tema selecionado",
    "themes.toastSelectedBody": "Abre a personalização para ajustar imagens",

    // Ações
    "action.active": "Ativo",
    "action.apply": "Aplicar",
    "action.settings": "Definições",
    "action.remove": "Remover",
    "action.edit": "Editar",
    "action.buy": "Comprar",
    "action.load": "Carregar",
    "action.addToThemes": "Adicionar aos Temas",
    "action.addedToThemes": "Adicionado aos Temas",
    "action.resetAll": "Repor Tudo",
    "action.reset": "Limpar",
    "action.savePreset": "Guardar Preset",
    "action.editPresets": "Editar Presets",

    // Personalização
    "customization.subtitle": "Personaliza a interface com imagens próprias",
    "customization.background.title": "Fundo",
    "customization.background.desc": "Imagem de fundo da página",
    "customization.leftColumn.title": "Coluna Esquerda",
    "customization.leftColumn.desc": "Arte de personagem junto à barra lateral",
    "customization.header.title": "Cabeçalho",
    "customization.header.desc": "Imagem na barra superior",
    "customization.header.focusX": "Foco horizontal",
    "customization.header.focusY": "Foco vertical",
    "customization.corner.title": "Cartão de Canto",
    "customization.corner.desc": "Cartão pequeno no canto inferior esquerdo",
    "customization.imageUrl": "URL da Imagem",
    "customization.darkness": "Escurecimento",
    "customization.transparency": "Transparência",
    "customization.palette.title": "Paleta de Cores",
    "customization.palette.desc": "Cores de destaque usadas em toda a interface",
    "customization.palette.toggleTitle": "Mostrar/ocultar seletor de cor",
    "customization.font.title": "Tipografia",
    "customization.font.desc": "Escolhe a fonte da interface para este preset",
    "customization.font.familyLabel": "Família da fonte",
    "customization.primary": "Primária",
    "customization.dark": "Escura",
    "customization.light": "Clara",
    "customization.hex": "Hex",
    "customization.sampler.title": "Amostrador de Cores da Imagem",
    "customization.sampler.desc": "Carrega uma imagem, passa o rato para pré-visualizar e clica para escolher uma cor para a paleta",
    "customization.sampler.urlPlaceholder": "Cola o URL da imagem e prime Enter...",
    "customization.sampler.uploadLabel": "ou envia um ficheiro",
    "customization.sampler.noImage": "Nenhuma imagem carregada",
    "customization.sampler.recent": "Escolhas recentes",
    "customization.presetNamePlaceholder": "Nome do preset...",
    "customization.savedPresets": "Presets Guardados",
    "customization.noSavedPresets": "Ainda não tens presets guardados",
    "customization.defaultPresetName": "O Meu Preset",
    "customization.toastApplied": "Personalização aplicada",
    "customization.toastPresetSaved": "Preset guardado!",
    "customization.toastReset": "Personalização reposta",
    "customization.toastSamplerTitle": "Amostrador",
    "customization.toastSamplerError": "Não foi possível carregar a imagem (verifica URL / CORS)",
    "customization.toastColorPicked": "Cor selecionada",
    "customization.toastPresetApplied": "Preset aplicado",
    "customization.button.title": "Cor dos Botões",
    "customization.button.desc": "Substitui a cor usada em todos os botões",
    "customization.button.colorLabel": "Cor dos botões",
    "customization.button.previewPrimary": "Primário",
    "customization.button.previewSecondary": "Secundário",
    "customization.toastLoadedEditing": "Preset carregado para edição",
    "customization.updatePreset": "Atualizar Preset",

    // History
    "history.title": "Histórico de Leitura",

    // Manga details
    "manga.back": "Voltar",

    // Context menu
    "context.markRead": "Marcar como Lido",
    "context.markUnread": "Marcar como Não Lido",
    "context.remove": "Remover da Biblioteca",

    // Calendário
    "nav.calendar": "Calendário",
    "calendar.title": "Calendário de Lançamentos",
    "calendar.noReleases": "Sem lançamentos este mês",
    "calendar.loading": "A carregar lançamentos...",
    "calendar.chapter": "Cap.",
    "calendar.today": "Hoje",
    "calendar.estimated": "Estimado",
    "calendar.releasing": "Também a lançar este mês (sem dados de calendário)",
    "calendar.days.sun": "Dom",
    "calendar.days.mon": "Seg",
    "calendar.days.tue": "Ter",
    "calendar.days.wed": "Qua",
    "calendar.days.thu": "Qui",
    "calendar.days.fri": "Sex",
    "calendar.days.sat": "Sáb"
  }
};

// ── Runtime state ─────────────────────────────────────────────────────────

/** ISO 639-1 code of the active language. Persisted to localStorage. */
let currentLanguage = localStorage.getItem('language') || 'en';

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Look up a translation key in the current language, falling back to English.
 *
 * @param {string} key - Dot-separated translation key, e.g. "nav.home"
 * @returns {string} Translated string (or the key itself if not found)
 */
function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

/**
 * Switch the active language and re-render all translated DOM nodes.
 *
 * @param {"en"|"pt"|string} lang - New language code
 */
function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  applyTranslations();
  const btn = document.getElementById('langToggleBtn');
  if (btn) btn.textContent = lang.toUpperCase();
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
