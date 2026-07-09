import re

path = 'public/css-modules/library.css'
with open(path, 'r', encoding='utf-8') as f:
    css = f.read()

# Find start: first occurrence of the card rule
START_MARKER = '.library-card.library-card-bookshelf.library-card-bookshelf-stripe {'
# Find end: the non-stripe bookshelf responsive block
END_MARKER = '@media (max-width: 900px) {\r\n  .library-grid.library-grid-bookshelf {'

si = css.index(START_MARKER)
ei = css.index(END_MARKER)

print(f'START={si} END={ei}')

before = css[:si]
after  = css[ei:]

new_block = r"""/* ── CARD WRAPPER ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe {
  --book-spine-base: color-mix(in srgb, var(--book-spine-color, #7a5f45) 88%, #0e0b08);
  width: 100%;
  min-width: 0;
  max-width: 112px;
  justify-self: center;
  align-self: end;
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
  z-index: 1;
  transform: translateY(0);
  transform-origin: center bottom;
  transition: transform 0.26s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe::before,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe::after {
  display: none;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe:hover,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe:focus-within {
  z-index: 38;
  transform: translateY(-10px);
}

/* ── COVER WRAPPER ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-cover {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 140px;
  background: transparent;
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── BOOK3D: flat container, no 3D rotation ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 140px;
  transform: none !important;
  transition: none;
}

/* ── SPINE: only face visible at rest. Synthetic, no real image ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine {
  position: absolute;
  inset: 0;
  border-radius: 4px 8px 8px 4px;
  background:
    linear-gradient(168deg,
      color-mix(in srgb, var(--book-spine-color, #7a5f45) 72%, white 28%) 0%,
      color-mix(in srgb, var(--book-spine-color, #7a5f45) 90%, black 10%) 52%,
      color-mix(in srgb, var(--book-spine-color, #7a5f45) 58%, black 42%) 100%),
    repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0 2px, rgba(0,0,0,0.07) 2px 4px);
  box-shadow:
    inset -3px 0 0 rgba(255,255,255,0.22),
    inset 2px 0 0 rgba(0,0,0,0.18),
    2px 0 8px rgba(0,0,0,0.32);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.15rem 0.3rem;
  overflow: hidden;
  z-index: 1;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 4px;
  right: 4px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--book-spine-accent, #e29a68) 80%, white 20%), transparent);
  opacity: 0.9;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-title {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, #f6ebe0 90%, var(--book-spine-accent, #e29a68));
  line-height: 1.08;
  max-height: calc(100% - 1.4rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.3);
  margin-top: 0.36rem;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-meta {
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(255,242,220,0.88);
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(0,0,0,0.45);
}

/* ── COVER PREVIEW: only on hover, clean undistorted image ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover-preview {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(8px) scale(0.92);
  width: clamp(96px, 150%, 168px);
  aspect-ratio: 3 / 4.2;
  border-radius: 6px 10px 10px 6px;
  overflow: hidden;
  background: var(--bg-tertiary, #1a1a2e);
  box-shadow: 0 18px 36px rgba(0,0,0,0.68), 0 2px 0 rgba(255,255,255,0.1) inset;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.24s cubic-bezier(.18,.82,.24,1);
  z-index: 40;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe:hover .book3d-cover-preview,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe:focus-within .book3d-cover-preview {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
  pointer-events: auto;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover-preview > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover-preview .book3d-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover-preview-cta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.32rem 0.4rem 0.36rem;
  text-align: center;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  background: linear-gradient(0deg, rgba(0,0,0,0.74) 0%, transparent 100%);
  pointer-events: none;
}

/* ── SHADOW ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-shadow {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: -10px;
  height: 12px;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.08) 70%, transparent 100%);
  filter: blur(1px);
  opacity: 0.72;
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe:hover .book3d-shadow,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe:focus-within .book3d-shadow {
  opacity: 0.94;
  transform: scaleX(1.18);
}

/* ── SOURCE LABEL (always visible below the spine) ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-label {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  color: color-mix(in srgb, var(--text-secondary) 80%, #f8f2e6);
  text-transform: uppercase;
  pointer-events: none;
  opacity: 0.9;
  margin-top: 0.28rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── PLACEHOLDER (no cover) ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  width: 100%;
  height: 100%;
  color: color-mix(in srgb, var(--text-secondary) 74%, white 26%);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-align: center;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-placeholder-icon {
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.85;
}

.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-placeholder-label {
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  opacity: 0.85;
}

/* ── HIDE unused elements ── */
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-info,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-inline-action,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .btn-read.btn-read-inline,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-overlay,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-source-badge,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-status,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .library-card-chapters-count,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-case,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-pages,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-shine,
.library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover {
  display: none !important;
}

/* ── LOCAL SECTION HEADER ── */
.library-grid.library-grid-bookshelf.library-grid-bookshelf-stripe .local-section-header {
  grid-column: 1 / -1;
  margin: 0.08rem 0 0.55rem;
  color: color-mix(in srgb, var(--primary) 44%, white 56%);
}

/* ── RESPONSIVE ── */
@media (max-width: 1200px) {
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe {
    max-width: 80px;
  }
}

@media (max-width: 900px) {
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe {
    max-width: 64px;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-title {
    font-size: 0.48rem;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-meta {
    font-size: 0.44rem;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-label {
    font-size: 0.44rem;
  }
}

@media (max-width: 600px) {
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe {
    max-width: 52px;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-title {
    font-size: 0.42rem;
    letter-spacing: 0.02em;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-spine-meta {
    font-size: 0.38rem;
  }
}

@media (hover: none), (pointer: coarse) {
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe:active .book3d-cover-preview {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
    pointer-events: auto;
  }
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe:active {
    z-index: 38;
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe,
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-cover-preview,
  .library-card.library-card-bookshelf.library-card-bookshelf-stripe .book3d-shadow {
    transition-duration: 0.01ms;
  }
}

"""

result = before + new_block + after
with open(path, 'w', encoding='utf-8') as f:
    f.write(result)

print(f'DONE. Total bytes: {len(result)}')
