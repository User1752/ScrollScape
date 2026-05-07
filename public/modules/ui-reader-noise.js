// ============================================================================
// READER NOISE  –  animated film grain / static overlay during reading
// ============================================================================
// Uses a small off-screen canvas (200×150) rendered with random grey pixels
// and stretched to fill the reader via CSS image-rendering:pixelated.
// A Uint32Array view over the ImageData buffer makes pixel writes very fast.
// The animation is throttled to 24 fps with requestAnimationFrame.
// ============================================================================

(function () {
  /* ── internal state ────────────────────────────────────────────────────── */
  let _raf    = null;
  let _canvas = null;
  let _ctx    = null;
  let _img    = null;    // ImageData
  let _buf32  = null;    // Uint32Array view of _img.data
  let _lastTs = 0;

  const NOISE_W   = 200;
  const NOISE_H   = 150;
  const NOISE_FPS = 24;

  /* ── canvas initialisation ─────────────────────────────────────────────── */
  function _init() {
    _canvas = document.getElementById('readerNoiseCanvas');
    if (!_canvas) return false;
    _canvas.width  = NOISE_W;
    _canvas.height = NOISE_H;
    _ctx    = _canvas.getContext('2d');
    _img    = _ctx.createImageData(NOISE_W, NOISE_H);
    _buf32  = new Uint32Array(_img.data.buffer);
    return true;
  }

  /* ── frame renderer ────────────────────────────────────────────────────── */
  function _renderFrame() {
    if (!_ctx || !_buf32 || !_img) return;
    const len = _buf32.length;
    // TV static: mostly dark, occasional bright/grey flashes
    for (let i = 0; i < len; i++) {
      const r = Math.random();
      const v = r < 0.18 ? 255              // bright white flash
              : r < 0.35 ? ((r * 729) | 0)  // mid grey
              : 0;                           // dark
      _buf32[i] = 0xFF000000 | (v << 16) | (v << 8) | v;
    }
    _ctx.putImageData(_img, 0, 0);
  }

  /* ── animation loop ────────────────────────────────────────────────────── */
  function _loop(ts) {
    if (ts - _lastTs >= 1000 / NOISE_FPS) {
      _renderFrame();
      _lastTs = ts;
    }
    _raf = requestAnimationFrame(_loop);
  }

  /* ── public API ────────────────────────────────────────────────────────── */

  /** Start the noise animation (no-op if already running). */
  window.startReaderNoise = function startReaderNoise() {
    if (_raf !== null) return;
    if (!_canvas && !_init()) return;
    _loop(0);
  };

  /** Stop the noise animation and cancel the rAF. */
  window.stopReaderNoise = function stopReaderNoise() {
    if (_raf !== null) {
      cancelAnimationFrame(_raf);
      _raf = null;
    }
  };

  /**
   * Apply the current noise settings (enabled toggle + intensity + source) to the
   * reader.  Reads from state.settings.readerNoiseEnabled,
   * state.settings.readerNoiseIntensity, and state.settings.readerNoiseSource.
   * Safe to call any time.
   */
  window.applyReaderNoiseSetting = function applyReaderNoiseSetting() {
    const reader = document.getElementById('reader');
    if (!reader) return;

    const enabled   = state.settings.readerNoiseEnabled === true;
    const intensity = Math.max(0, Math.min(100, Number(state.settings.readerNoiseIntensity) || 50));
    const source    = state.settings.readerNoiseSource || 'generated';
    const useGif    = source === 'gif';

    reader.classList.toggle('reader-noise-active', enabled);

    // When wallpaper is active the reader bg should be black so the canvas/gif
    // fills the space. When off, restore the user's chosen colour.
    if (enabled) {
      reader.style.backgroundColor = '#000000';
    } else if (typeof applyReaderBackground === 'function') {
      applyReaderBackground();
    }

    // intensity is now 0-100 → opacity 0.00–1.00
    const opacity = (Math.max(0, Math.min(100, Number(state.settings.readerNoiseIntensity) || 50)) / 100).toFixed(2);

    const canvas = document.getElementById('readerNoiseCanvas');
    const gif    = document.getElementById('readerNoiseGif');

    if (canvas) {
      canvas.style.opacity = opacity;
      canvas.style.display = (!useGif && enabled) ? 'block' : 'none';
    }
    if (gif) {
      gif.style.opacity = opacity;
      // Update src to the selected file
      const gifFile = state.settings.readerNoiseGifFile || '';
      if (gifFile) gif.src = '/' + gifFile;
      gif.style.display = (useGif && enabled && gifFile) ? 'block' : 'none';
    }

    if (enabled && !useGif) {
      startReaderNoise();
    } else {
      stopReaderNoise();
    }
  };
}());
