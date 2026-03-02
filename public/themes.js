/**
 * themes.js â€” Community Themes for Manghu
 * =========================================
 * This file is loaded before app.js. Add your theme here and it will
 * automatically appear in the AP Shop.
 *
 * â”€â”€ HOW TO ADD A THEME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  1. Push a new object into COMMUNITY_THEMES (below "Add more themes here").
 *  2. Fill: id, name, desc, cost, primary, primaryDark, primaryLight, preview.
 *  3. Write your CSS in the `css` property using [data-color-theme="your-id"]{}.
 *  4. Optional: implement onApply() / onRemove() for DOM side-effects (GIFs etc).
 *  5. Reload the page â€” your theme appears in Settings â†’ AP Shop.
 *
 * â”€â”€ THEME OBJECT SCHEMA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  {
 *    id:           string   â€” unique kebab-case key (e.g. "my-theme")
 *    name:         string   â€” display name
 *    desc:         string   â€” short tagline
 *    cost:         number   â€” AP cost (0 = free)
 *    primary:      string   â€” main accent hex colour
 *    primaryDark:  string   â€” darker variant
 *    primaryLight: string   â€” lighter variant
 *    preview:      string   â€” CSS background value shown in shop card
 *    css:          string   â€” all CSS rules (template literal recommended)
 *    onApply?():   void     â€” called when theme is activated
 *    onRemove?():  void     â€” called when switching away
 *  }
 */

(function () {
  'use strict';

  // â”€â”€ Initial D â€” internet asset URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // -- Gintama -- internet asset URLs
  const GT = {
    bg:   'https://4kwallpapers.com/images/wallpapers/gintama-ultrawide-3840x2160-16166.jpg',
    logo: 'https://upload.wikimedia.org/wikipedia/fr/0/06/Gintama_logo.png',
  };

  const ID = {
    // Toyota AE86 Sprinter Trueno â€” Wikimedia Commons (CC-BY-SA)
    ae86:  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Toyota-AE86-Coupe.jpg/640px-Toyota-AE86-Coupe.jpg',
    // Initial D wallpaper â€” user-supplied
    touge: 'https://wallpapercave.com/wp/wp12265576.png',
    // Initial D character art â€” user-supplied
    manga: 'https://cdn.shopify.com/s/files/1/0046/3234/6694/files/aa064dc5d822366e9c78f0ad2030b0b7_1024x1024.jpg?v=1624917394',
  };

  // â”€â”€ Dragon Ball Z â€” internet asset URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DB = {
    // Night starfield / cosmos â€” Unsplash (free)
    stars: 'https://images6.alphacoders.com/640/640445.jpg',
    // Goku artwork â€” Wikia CDN (no hotlink restriction)
    goku:  'https://i.pinimg.com/474x/61/9b/19/619b19ba4ff51486d2c149b8f22f6a3d.jpg',
  };

  // â”€â”€ One Piece â€” internet asset URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const OP = {
    // Ocean horizon at dusk â€” Unsplash (free)
    ocean: 'https://images5.alphacoders.com/132/1329624.png',
    // Monkey D. Luffy â€” Wikia CDN
    luffy: 'https://i.pinimg.com/736x/9e/f4/80/9ef48057131018eba89e8aa5ba953f35.jpg',
  };

  // â”€â”€ Samurai X (Rurouni Kenshin) â€” internet asset URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SX = {
    // Cherry blossom â€” Unsplash (free)
    sakura:  'https://wallpapers.com/images/hd/fierce-look-kenshin-of-samurai-x-b60h2obwliyfpyqo.jpg',
    // Himura Kenshin â€” Wikia CDN
    kenshin: 'https://i.pinimg.com/originals/e2/1b/e7/e21be7940e84806e38c6776bb450acf5.jpg',
  };

  // â”€â”€ Chainsaw Man â€” internet asset URLs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const CSM = {
    // Dark industrial night â€” Unsplash (free)
    dark:  'https://images3.alphacoders.com/131/1319293.jpeg',
    // Denji / Chainsaw Man â€” Wikia CDN
    denji: 'https://i.redd.it/ng7z0kf00t9a1.jpg',
  };

  /* ==========================================================================
   * COMMUNITY_THEMES â€” add your theme objects here â†“
   * ========================================================================== */
  const COMMUNITY_THEMES = [

    /* ------------------------------------------------------------------
     * INITIAL D — "Downhill battle on Akina"
     * ------------------------------------------------------------------ */
    {
      id:           'initiald',
      name:         'Initial D',
      desc:         'Downhill battle on Akina',
      cost:         15,
      primary:      '#E8001F',
      primaryDark:  '#A8001A',
      primaryLight: '#FF3355',
      preview:      'linear-gradient(105deg,#060B14 0%,#0B1525 40%,#E8001F 100%)',
      onApply()  { _injectThemeImages({ themeId:'initiald',   charUrl:ID.manga,   bannerUrl:ID.touge,   accent:'#E8001F', charOpacity:0.90, bannerDim:0.55 }); },
      onRemove() { _removeThemeImages('initiald'); },
      css: `
        @keyframes id-speedsweep {
          0%   { background-position: -100% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes id-redglow {
          0%,100% { text-shadow: 0 0 8px #E8001F, 0 0 20px rgba(232,0,31,.4); }
          50%     { text-shadow: 0 0 14px #FF3355, 0 0 35px rgba(255,51,85,.6); }
        }
        @keyframes id-scanline {
          0%   { transform: translateY(-100%); opacity: .03; }
          100% { transform: translateY(100vh);  opacity: .03; }
        }
        [data-color-theme="initiald"] {
          --primary:        #E8001F;
          --primary-dark:   #A8001A;
          --primary-light:  #FF3355;
          --bg-dark:        #060B14;
          --bg-secondary:   #0B1525;
          --bg-tertiary:    #112038;
          --text-primary:   #E8ECF4;
          --text-secondary: #5A7090;
          --border-color:   #1B2D47;
          --success:        #00D98B;
          --warning:        #FFB800;
          --danger:         #FF3355;
        }
        [data-color-theme="initiald"] body {
          background:
            linear-gradient(rgba(6,11,20,.78), rgba(6,11,20,.78)),
            url('https://wallpapercave.com/wp/wp12265576.png') center / cover fixed;
          color: #E8ECF4;
        }
        [data-color-theme="initiald"] body::before {
          content: '';
          position: fixed; inset: 0;
          pointer-events: none; z-index: 0;
          background-image: repeating-linear-gradient(100deg,transparent 0px,transparent 3px,rgba(232,0,31,.018) 3px,rgba(232,0,31,.018) 4px);
          background-size: 8px 100%;
        }
        [data-color-theme="initiald"] body::after {
          content: '';
          position: fixed; top: 0; left: 0; right: 0; height: 120px;
          pointer-events: none; z-index: 0;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,.015), transparent);
          animation: id-scanline 8s linear infinite;
        }
        [data-color-theme="initiald"] .app-shell { position: relative; z-index: 1; }
        [data-color-theme="initiald"] .topbar {
          background: linear-gradient(90deg,#060B14 0%,#0B1525 60%,rgba(232,0,31,.15) 100%);
          border-bottom: 2px solid #E8001F;
          box-shadow: 0 2px 20px rgba(232,0,31,.3);
        }
        [data-color-theme="initiald"] .app-brand { color: #E8001F; font-family: 'Orbitron', sans-serif; letter-spacing: .12em; }
        [data-color-theme="initiald"] .sidebar {
          background: linear-gradient(180deg,#060B14 0%,#0B1525 100%);
          border-right: 1px solid #1B2D47;
        }
        [data-color-theme="initiald"] .nav-link { color: #5A7090; }
        [data-color-theme="initiald"] .nav-link:hover { color: #E8ECF4; background: rgba(232,0,31,.12); }
        [data-color-theme="initiald"] .nav-link.active { color: #E8001F; background: rgba(232,0,31,.18); border-left: 3px solid #E8001F; }
        [data-color-theme="initiald"] .card { background: #0B1525; border: 1px solid #1B2D47; }
        [data-color-theme="initiald"] .card:hover { border-color: rgba(232,0,31,.5); box-shadow: 0 4px 20px rgba(232,0,31,.2); }
        [data-color-theme="initiald"] .btn-primary { background: #E8001F; border-color: #E8001F; }
        [data-color-theme="initiald"] .btn-primary:hover { background: #FF3355; }
        [data-color-theme="initiald"] ::-webkit-scrollbar-thumb { background: #E8001F; }
        [data-color-theme="initiald"] ::selection { background: rgba(232,0,31,.35); }
        [data-color-theme="initiald"] input:focus, [data-color-theme="initiald"] select:focus { border-color: #E8001F; box-shadow: 0 0 0 3px rgba(232,0,31,.2); }
        [data-color-theme="initiald"] .section-title, [data-color-theme="initiald"] h1, [data-color-theme="initiald"] h2, [data-color-theme="initiald"] h3 {
          color: #E8001F; font-family: 'Orbitron', sans-serif;
        }
        [data-color-theme="initiald"] hr { border-color: rgba(232,0,31,.3); }
        [data-color-theme="initiald"] .tab.active { border-bottom: 2px solid #E8001F; color: #E8001F; }
        [data-color-theme="initiald"] .progress-bar { background: linear-gradient(90deg, #E8001F, #FF3355); }
      `,
    },

    /* ------------------------------------------------------------------
     * DRAGON BALL Z — "Power up with Goku's energy"
     * ------------------------------------------------------------------ */
    {
      id:           'dragonball',
      name:         'Dragon Ball Z',
      desc:         "Power up with Goku's energy",
      cost:         15,
      primary:      '#FF6B00',
      primaryDark:  '#CC4400',
      primaryLight: '#FFB800',
      preview:      'linear-gradient(135deg,#FF6B00,#FFB800)',
      onApply()  { _injectThemeImages({ themeId:'dragonball', charUrl:DB.goku,    bannerUrl:DB.stars,   accent:'#FF6B00' }); },
      onRemove() { _removeThemeImages('dragonball'); },
      css: `
        @keyframes db-aura {
          0%,100% { box-shadow: 0 0 12px rgba(255,107,0,.5), 0 0 30px rgba(255,184,0,.2); }
          50%     { box-shadow: 0 0 24px rgba(255,107,0,.8), 0 0 60px rgba(255,184,0,.4); }
        }
        [data-color-theme="dragonball"] {
          --primary:        #FF6B00;
          --primary-dark:   #CC4400;
          --primary-light:  #FFB800;
          --bg-dark:        #0D0800;
          --bg-secondary:   #1A0F00;
          --bg-tertiary:    #251500;
          --text-primary:   #FFF5E0;
          --text-secondary: #8C6A30;
          --border-color:   #3D2A00;
          --success:        #00D98B;
          --warning:        #FFB800;
          --danger:         #FF3355;
        }
        [data-color-theme="dragonball"] body { background: linear-gradient(rgba(13,8,0,.80),rgba(13,8,0,.80)), url('https://images6.alphacoders.com/640/640445.jpg') center/cover fixed; color: #FFF5E0; }
        [data-color-theme="dragonball"] .app-shell { position:relative; z-index:1; }
        [data-color-theme="dragonball"] .topbar { background: linear-gradient(90deg,#0D0800,#1A0F00); border-bottom: 2px solid #FF6B00; box-shadow: 0 2px 20px rgba(255,107,0,.3); }
        [data-color-theme="dragonball"] .app-brand { color: #FFB800; font-weight: 900; letter-spacing: .08em; }
        [data-color-theme="dragonball"] .sidebar { background: linear-gradient(180deg,#0D0800,#1A0F00); border-right: 1px solid #3D2A00; }
        [data-color-theme="dragonball"] .nav-link { color: #8C6A30; }
        [data-color-theme="dragonball"] .nav-link:hover { color: #FFF5E0; background: rgba(255,107,0,.12); }
        [data-color-theme="dragonball"] .nav-link.active { color: #FFB800; background: rgba(255,107,0,.18); border-left: 3px solid #FF6B00; }
        [data-color-theme="dragonball"] .card { background: #1A0F00; border: 1px solid #3D2A00; }
        [data-color-theme="dragonball"] .card:hover { border-color: rgba(255,107,0,.5); box-shadow: 0 4px 20px rgba(255,107,0,.25); animation: db-aura 2s ease-in-out infinite; }
        [data-color-theme="dragonball"] .btn-primary { background: #FF6B00; border-color: #FF6B00; }
        [data-color-theme="dragonball"] .btn-primary:hover { background: #FFB800; }
        [data-color-theme="dragonball"] ::-webkit-scrollbar-thumb { background: #FF6B00; }
        [data-color-theme="dragonball"] ::selection { background: rgba(255,107,0,.35); }
        [data-color-theme="dragonball"] .section-title, [data-color-theme="dragonball"] h1, [data-color-theme="dragonball"] h2, [data-color-theme="dragonball"] h3 { color: #FFB800; }
        [data-color-theme="dragonball"] hr { border-color: rgba(255,107,0,.3); }
        [data-color-theme="dragonball"] .tab.active { border-bottom: 2px solid #FF6B00; color: #FF6B00; }
        [data-color-theme="dragonball"] .progress-bar { background: linear-gradient(90deg,#FF6B00,#FFB800); }
        [data-color-theme="dragonball"] input:focus, [data-color-theme="dragonball"] select:focus { border-color: #FF6B00; box-shadow: 0 0 0 3px rgba(255,107,0,.2); }
      `,
    },

    /* ------------------------------------------------------------------
     * ONE PIECE — "Set sail for adventure"
     * ------------------------------------------------------------------ */
    {
      id:           'onepiece',
      name:         'One Piece',
      desc:         'Set sail for adventure',
      cost:         15,
      primary:      '#E8473F',
      primaryDark:  '#AA2820',
      primaryLight: '#FF7060',
      preview:      'linear-gradient(135deg,#E8473F,#FFB347)',
      onApply()  { _injectThemeImages({ themeId:'onepiece',   charUrl:OP.luffy,   bannerUrl:OP.ocean,   accent:'#E8473F' }); },
      onRemove() { _removeThemeImages('onepiece'); },
      css: `
        @keyframes op-wave {
          0%   { transform: translateX(0) scaleY(1); }
          50%  { transform: translateX(-10px) scaleY(1.04); }
          100% { transform: translateX(0) scaleY(1); }
        }
        [data-color-theme="onepiece"] {
          --primary:        #E8473F;
          --primary-dark:   #AA2820;
          --primary-light:  #FF7060;
          --bg-dark:        #04111A;
          --bg-secondary:   #081E2E;
          --bg-tertiary:    #0D2B40;
          --text-primary:   #E8F4FF;
          --text-secondary: #4A7A9B;
          --border-color:   #0E3050;
          --success:        #00D98B;
          --warning:        #FFD700;
          --danger:         #E8473F;
        }
        [data-color-theme="onepiece"] body { background: linear-gradient(rgba(4,17,26,.80),rgba(4,17,26,.80)), url('https://images5.alphacoders.com/132/1329624.png') center/cover fixed; color: #E8F4FF; }
        [data-color-theme="onepiece"] .app-shell { position:relative; z-index:1; }
        [data-color-theme="onepiece"] .topbar { background: linear-gradient(90deg,#04111A,#081E2E); border-bottom: 2px solid #E8473F; box-shadow: 0 2px 20px rgba(232,71,63,.3); }
        [data-color-theme="onepiece"] .app-brand { color: #E8473F; font-weight: 900; }
        [data-color-theme="onepiece"] .sidebar { background: linear-gradient(180deg,#04111A,#081E2E); border-right: 1px solid #0E3050; }
        [data-color-theme="onepiece"] .nav-link { color: #4A7A9B; }
        [data-color-theme="onepiece"] .nav-link:hover { color: #E8F4FF; background: rgba(232,71,63,.12); }
        [data-color-theme="onepiece"] .nav-link.active { color: #E8473F; background: rgba(232,71,63,.18); border-left: 3px solid #E8473F; }
        [data-color-theme="onepiece"] .card { background: #081E2E; border: 1px solid #0E3050; }
        [data-color-theme="onepiece"] .card:hover { border-color: rgba(232,71,63,.5); box-shadow: 0 4px 20px rgba(232,71,63,.2); }
        [data-color-theme="onepiece"] .btn-primary { background: #E8473F; border-color: #E8473F; }
        [data-color-theme="onepiece"] .btn-primary:hover { background: #FF7060; }
        [data-color-theme="onepiece"] ::-webkit-scrollbar-thumb { background: #E8473F; }
        [data-color-theme="onepiece"] ::selection { background: rgba(232,71,63,.35); }
        [data-color-theme="onepiece"] .section-title, [data-color-theme="onepiece"] h1, [data-color-theme="onepiece"] h2, [data-color-theme="onepiece"] h3 { color: #E8473F; }
        [data-color-theme="onepiece"] hr { border-color: rgba(232,71,63,.3); }
        [data-color-theme="onepiece"] .tab.active { border-bottom: 2px solid #E8473F; color: #E8473F; }
        [data-color-theme="onepiece"] .progress-bar { background: linear-gradient(90deg,#E8473F,#FF7060); }
        [data-color-theme="onepiece"] input:focus, [data-color-theme="onepiece"] select:focus { border-color: #E8473F; box-shadow: 0 0 0 3px rgba(232,71,63,.2); }
      `,
    },

    /* ------------------------------------------------------------------
     * SAMURAI X — "The wandering swordsman"
     * ------------------------------------------------------------------ */
    {
      id:           'samuraix',
      name:         'Samurai X',
      desc:         'The wandering swordsman',
      cost:         15,
      primary:      '#C41E3A',
      primaryDark:  '#8B0000',
      primaryLight: '#E83050',
      preview:      'linear-gradient(135deg,#1A0A0A,#C41E3A)',
      onApply()  { _injectThemeImages({ themeId:'samuraix',   charUrl:SX.kenshin, bannerUrl:SX.sakura,  accent:'#C41E3A' }); },
      onRemove() { _removeThemeImages('samuraix'); },
      css: `
        @keyframes sx-glow {
          0%,100% { opacity:.7; }
          50%     { opacity:1; }
        }
        [data-color-theme="samuraix"] {
          --primary:        #C41E3A;
          --primary-dark:   #8B0000;
          --primary-light:  #E83050;
          --bg-dark:        #0A0505;
          --bg-secondary:   #140A0A;
          --bg-tertiary:    #1E0F0F;
          --text-primary:   #F5E6E6;
          --text-secondary: #7A4A4A;
          --border-color:   #2E1515;
          --success:        #00D98B;
          --warning:        #FFB800;
          --danger:         #E83050;
        }
        [data-color-theme="samuraix"] body { background: linear-gradient(rgba(10,5,5,.82),rgba(10,5,5,.82)), url('https://wallpapers.com/images/hd/fierce-look-kenshin-of-samurai-x-b60h2obwliyfpyqo.jpg') center/cover fixed; color: #F5E6E6; }
        [data-color-theme="samuraix"] .app-shell { position:relative; z-index:1; }
        [data-color-theme="samuraix"] .topbar { background: linear-gradient(90deg,#0A0505,#140A0A); border-bottom: 2px solid #C41E3A; box-shadow: 0 2px 20px rgba(196,30,58,.3); }
        [data-color-theme="samuraix"] .app-brand { color: #C41E3A; font-style: italic; }
        [data-color-theme="samuraix"] .sidebar { background: linear-gradient(180deg,#0A0505,#140A0A); border-right: 1px solid #2E1515; }
        [data-color-theme="samuraix"] .nav-link { color: #7A4A4A; }
        [data-color-theme="samuraix"] .nav-link:hover { color: #F5E6E6; background: rgba(196,30,58,.12); }
        [data-color-theme="samuraix"] .nav-link.active { color: #C41E3A; background: rgba(196,30,58,.18); border-left: 3px solid #C41E3A; }
        [data-color-theme="samuraix"] .card { background: #140A0A; border: 1px solid #2E1515; }
        [data-color-theme="samuraix"] .card:hover { border-color: rgba(196,30,58,.5); box-shadow: 0 4px 20px rgba(196,30,58,.2); }
        [data-color-theme="samuraix"] .btn-primary { background: #C41E3A; border-color: #C41E3A; }
        [data-color-theme="samuraix"] .btn-primary:hover { background: #E83050; }
        [data-color-theme="samuraix"] ::-webkit-scrollbar-thumb { background: #C41E3A; }
        [data-color-theme="samuraix"] ::selection { background: rgba(196,30,58,.35); }
        [data-color-theme="samuraix"] .section-title, [data-color-theme="samuraix"] h1, [data-color-theme="samuraix"] h2, [data-color-theme="samuraix"] h3 { color: #C41E3A; }
        [data-color-theme="samuraix"] hr { border-color: rgba(196,30,58,.25); }
        [data-color-theme="samuraix"] .tab.active { border-bottom: 2px solid #C41E3A; color: #C41E3A; }
        [data-color-theme="samuraix"] .progress-bar { background: linear-gradient(90deg,#8B0000,#C41E3A); }
        [data-color-theme="samuraix"] input:focus, [data-color-theme="samuraix"] select:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,.2); }
      `,
    },

    /* ------------------------------------------------------------------
     * CHAINSAW MAN — "Fear is the gasoline"
     * ------------------------------------------------------------------ */
    {
      id:           'chainsawman',
      name:         'Chainsaw Man',
      desc:         'Fear is the gasoline',
      cost:         15,
      primary:      '#CC0000',
      primaryDark:  '#880000',
      primaryLight: '#FF2222',
      preview:      'linear-gradient(135deg,#0A0000,#CC0000)',
      onApply()  { _injectThemeImages({ themeId:'chainsawman', charUrl:CSM.denji, bannerUrl:CSM.dark,   accent:'#CC0000' }); },
      onRemove() { _removeThemeImages('chainsawman'); },
      css: `
        @keyframes csm-flicker {
          0%,100% { opacity:1; }
          92%     { opacity:1; }
          93%     { opacity:.4; }
          94%     { opacity:1; }
          96%     { opacity:.6; }
          97%     { opacity:1; }
        }
        [data-color-theme="chainsawman"] {
          --primary:        #CC0000;
          --primary-dark:   #880000;
          --primary-light:  #FF2222;
          --bg-dark:        #080000;
          --bg-secondary:   #110000;
          --bg-tertiary:    #1A0000;
          --text-primary:   #F0E0E0;
          --text-secondary: #663333;
          --border-color:   #2A0000;
          --success:        #00D98B;
          --warning:        #FFB800;
          --danger:         #FF2222;
        }
        [data-color-theme="chainsawman"] body { background: linear-gradient(rgba(8,0,0,.82),rgba(8,0,0,.82)), url('https://images3.alphacoders.com/131/1319293.jpeg') center/cover fixed; color: #F0E0E0; }
        [data-color-theme="chainsawman"] .app-shell { position:relative; z-index:1; }
        [data-color-theme="chainsawman"] .topbar { background: linear-gradient(90deg,#080000,#110000); border-bottom: 2px solid #CC0000; box-shadow: 0 2px 20px rgba(204,0,0,.4); animation: csm-flicker 6s step-end infinite; }
        [data-color-theme="chainsawman"] .app-brand { color: #CC0000; font-weight: 900; letter-spacing: .05em; }
        [data-color-theme="chainsawman"] .sidebar { background: linear-gradient(180deg,#080000,#110000); border-right: 1px solid #2A0000; }
        [data-color-theme="chainsawman"] .nav-link { color: #663333; }
        [data-color-theme="chainsawman"] .nav-link:hover { color: #F0E0E0; background: rgba(204,0,0,.12); }
        [data-color-theme="chainsawman"] .nav-link.active { color: #FF2222; background: rgba(204,0,0,.2); border-left: 3px solid #CC0000; }
        [data-color-theme="chainsawman"] .card { background: #110000; border: 1px solid #2A0000; }
        [data-color-theme="chainsawman"] .card:hover { border-color: rgba(204,0,0,.6); box-shadow: 0 4px 24px rgba(204,0,0,.3); }
        [data-color-theme="chainsawman"] .btn-primary { background: #CC0000; border-color: #CC0000; }
        [data-color-theme="chainsawman"] .btn-primary:hover { background: #FF2222; }
        [data-color-theme="chainsawman"] ::-webkit-scrollbar-thumb { background: #CC0000; }
        [data-color-theme="chainsawman"] ::selection { background: rgba(204,0,0,.4); }
        [data-color-theme="chainsawman"] .section-title, [data-color-theme="chainsawman"] h1, [data-color-theme="chainsawman"] h2, [data-color-theme="chainsawman"] h3 { color: #CC0000; }
        [data-color-theme="chainsawman"] hr { border-color: rgba(204,0,0,.25); }
        [data-color-theme="chainsawman"] .tab.active { border-bottom: 2px solid #CC0000; color: #CC0000; }
        [data-color-theme="chainsawman"] .progress-bar { background: linear-gradient(90deg,#880000,#CC0000); }
        [data-color-theme="chainsawman"] input:focus, [data-color-theme="chainsawman"] select:focus { border-color: #CC0000; box-shadow: 0 0 0 3px rgba(204,0,0,.2); }
      `,
    },
    /* ------------------------------------------------------------------
     * GINTAMA -- "Odd Jobs Gin"
     * ------------------------------------------------------------------ */
    {
      id:           'gintama',
      name:         'Gintama',
      desc:         'Odd Jobs Gin  chaos, comedy & samurai soul',
      cost:         15,
      primary:      '#5BB8D4',
      primaryDark:  '#2E7A9A',
      primaryLight: '#8DD8F0',
      preview:      'linear-gradient(135deg,#050C18 0%,#0A1E35 50%,#5BB8D4 100%)',
      onApply()  { _injectThemeImages({ themeId:'gintama', charUrl:GT.logo, bannerUrl:GT.bg, accent:'#5BB8D4', charOpacity:0.55, bannerDim:0.0 }); },
      onRemove() { _removeThemeImages('gintama'); },
      css: `
        @keyframes gin-shimmer {
          0%,100% { text-shadow: 0 0 8px #5BB8D4, 0 0 20px rgba(91,184,212,.4); }
          50%     { text-shadow: 0 0 16px #8DD8F0, 0 0 40px rgba(141,216,240,.6); }
        }
        @keyframes gin-silver {
          0%,100% { opacity:.6; }
          50%     { opacity:1; }
        }
        [data-color-theme="gintama"] {
          --primary:        #5BB8D4;
          --primary-dark:   #2E7A9A;
          --primary-light:  #8DD8F0;
          --bg-dark:        #050C18;
          --bg-secondary:   #0A1828;
          --bg-tertiary:    #0F2238;
          --text-primary:   #D6EEF8;
          --text-secondary: #4A7A96;
          --border-color:   #132840;
          --success:        #4DD68C;
          --warning:        #F0C040;
          --danger:         #E05050;
        }
        [data-color-theme="gintama"] body {
          background:
            linear-gradient(rgba(5,12,24,.72), rgba(5,12,24,.72)),
            url('https://4kwallpapers.com/images/wallpapers/gintama-ultrawide-3840x2160-16166.jpg') center / cover fixed;
          color: #D6EEF8;
        }
        [data-color-theme="gintama"] body::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse at 20% 80%, rgba(91,184,212,.06) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(141,216,240,.04) 0%, transparent 60%);
        }
        [data-color-theme="gintama"] .app-shell { position: relative; z-index: 1; }
        [data-color-theme="gintama"] .topbar {
          background: linear-gradient(90deg, #050C18 0%, #0A1828 60%, rgba(91,184,212,.12) 100%);
          border-bottom: 2px solid #5BB8D4;
          box-shadow: 0 2px 24px rgba(91,184,212,.25);
        }
        [data-color-theme="gintama"] .app-brand {
          color: #8DD8F0;
          letter-spacing: .1em;
          animation: gin-shimmer 3s ease-in-out infinite;
        }
        [data-color-theme="gintama"] .sidebar {
          background: linear-gradient(180deg, #050C18 0%, #0A1828 100%);
          border-right: 1px solid #132840;
        }
        [data-color-theme="gintama"] .nav-link { color: #4A7A96; }
        [data-color-theme="gintama"] .nav-link:hover { color: #D6EEF8; background: rgba(91,184,212,.1); }
        [data-color-theme="gintama"] .nav-link.active { color: #8DD8F0; background: rgba(91,184,212,.18); border-left: 3px solid #5BB8D4; }
        [data-color-theme="gintama"] .card { background: rgba(10,24,40,.9); border: 1px solid #132840; }
        [data-color-theme="gintama"] .card:hover { border-color: rgba(91,184,212,.5); box-shadow: 0 4px 20px rgba(91,184,212,.2); }
        [data-color-theme="gintama"] .btn-primary { background: #5BB8D4; border-color: #5BB8D4; color: #050C18; font-weight:600; }
        [data-color-theme="gintama"] .btn-primary:hover { background: #8DD8F0; border-color: #8DD8F0; }
        [data-color-theme="gintama"] ::-webkit-scrollbar-thumb { background: #2E7A9A; }
        [data-color-theme="gintama"] ::selection { background: rgba(91,184,212,.35); }
        [data-color-theme="gintama"] input:focus, [data-color-theme="gintama"] select:focus { border-color: #5BB8D4; box-shadow: 0 0 0 3px rgba(91,184,212,.2); }
        [data-color-theme="gintama"] .section-title,
        [data-color-theme="gintama"] h1,
        [data-color-theme="gintama"] h2,
        [data-color-theme="gintama"] h3 { color: #5BB8D4; }
        [data-color-theme="gintama"] hr { border-color: rgba(91,184,212,.25); }
        [data-color-theme="gintama"] .tab.active { border-bottom: 2px solid #5BB8D4; color: #5BB8D4; }
        [data-color-theme="gintama"] .progress-bar { background: linear-gradient(90deg, #2E7A9A, #5BB8D4); }
      `,
    },


  ]; // ← end COMMUNITY_THEMES

  // â”€â”€ Shared image injection helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Injects a faded character image at the bottom of the sidebar
   * and a scenic banner at the top of the main container.
   * Uses real DOM elements â€” works regardless of CSS context.
   */
  function _injectThemeImages({ themeId, charUrl, bannerUrl, accent, charOpacity = 0.22, bannerDim = 0 }) {
    // â”€â”€ 1. Sidebar character watermark (fixed, bottom-left, same width as sidebar) â”€â”€
    if (charUrl) {
      const existing = document.getElementById(themeId + '-char');
      if (!existing) {
        const wrap = document.createElement('div');
        wrap.id = themeId + '-char';
        wrap.style.cssText = [
          'position:fixed', 'bottom:0', 'left:0', 'width:240px', 'height:210px',
          'border-radius:0 12px 0 0',
          'pointer-events:none', 'overflow:hidden', 'z-index:10',
          `-webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 42%)`,
          `mask-image:linear-gradient(to bottom,transparent 0%,black 42%)`,
          'background:rgba(0,0,0,0.18)',
        ].join(';');
        const img = document.createElement('img');
        img.src = charUrl;
        img.alt = '';
        img.style.cssText = [
          'position:absolute', 'bottom:0', 'left:0',
          'width:100%', 'height:100%',
          `opacity:${charOpacity}`, 'object-fit:cover',
        ].join(';');
        wrap.appendChild(img);
        document.body.appendChild(wrap);

        // Hide while the manga reader is open
        const readerEl = document.getElementById('reader');
        if (readerEl) {
          const _syncVis = () => { wrap.style.display = readerEl.classList.contains('hidden') ? '' : 'none'; };
          const _obs = new MutationObserver(_syncVis);
          _obs.observe(readerEl, { attributes: true, attributeFilter: ['class'] });
          wrap._readerObserver = _obs;
          _syncVis();
        }
      }
    }
  }

  function _removeThemeImages(themeId) {
    ['char'].forEach(suffix => {
      const el = document.getElementById(themeId + '-' + suffix);
      if (el) {
        if (el._readerObserver) el._readerObserver.disconnect();
        el.remove();
      }
    });
  }

  // â”€â”€ Registration: expose to app.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  window.COMMUNITY_THEMES = COMMUNITY_THEMES;

  // Inject all theme CSS immediately (before app.js runs, so selectors are ready)
  const style = document.createElement('style');
  style.id = 'community-themes-css';
  style.textContent = COMMUNITY_THEMES.map(t => t.css || '').join('\n');
  document.head.appendChild(style);

})();
