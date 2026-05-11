'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function createThemePresetService() {
  let presetsDir = '';
  let presetsFile = '';

  function configure(opts = {}) {
    presetsDir = opts.presetsDir || '';
    presetsFile = path.join(presetsDir, 'custom-presets.json');
  }

  function safeStr(v, max = 500) {
    return String(v ?? '').slice(0, max);
  }

  function safeNum(v, fallback = 0, min = 0, max = 100) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function sanitizePreset(input) {
    if (!input || typeof input !== 'object') return null;
    const id = safeStr(input.id, 120).trim();
    if (!id) return null;
    const hasAccent = Object.prototype.hasOwnProperty.call(input, 'accentColor');
    const accentSource = hasAccent ? input.accentColor : input.paletteColor;
    return {
      id,
      name: safeStr(input.name, 80).trim() || 'My Preset',
      bgUrl: safeStr(input.bgUrl, 1500),
      bgDim: safeNum(input.bgDim, 0),
      bgOpac: safeNum(input.bgOpac, 0),
      charUrl: safeStr(input.charUrl, 1500),
      charDim: safeNum(input.charDim, 0),
      charDark: safeNum(input.charDark, 0),
      headerUrl: safeStr(input.headerUrl, 1500),
      headerDim: safeNum(input.headerDim, 0),
      headerOpac: safeNum(input.headerOpac, 0),
      headerPosX: safeNum(input.headerPosX, 50),
      headerPosY: safeNum(input.headerPosY, 50),
      cornerUrl: safeStr(input.cornerUrl, 1500),
      cornerDim: safeNum(input.cornerDim, 0),
      cornerDark: safeNum(input.cornerDark, 0),
      paletteColor: safeStr(input.paletteColor, 20),
      buttonColor: safeStr(input.buttonColor, 20),
      accentColor: safeStr(accentSource, 20),
      fontFamily: safeStr(input.fontFamily, 200),
    };
  }

  async function getPresets() {
    if (!presetsFile) throw new Error('Theme presets route not configured');
    try {
      const raw = await fsp.readFile(presetsFile, 'utf8');
      const parsed = JSON.parse(raw);
      return { presets: Array.isArray(parsed?.presets) ? parsed.presets : [] };
    } catch {
      return { presets: [] };
    }
  }

  async function writePresets(presets) {
    if (!presetsFile) throw new Error('Theme presets route not configured');
    await fsp.mkdir(presetsDir, { recursive: true });
    const payload = { presets, updatedAt: new Date().toISOString() };
    await fsp.writeFile(presetsFile, JSON.stringify(payload, null, 2), 'utf8');
  }

  async function replacePresets({ presets } = {}) {
    const incoming = Array.isArray(presets) ? presets : [];
    const safe = incoming.map(sanitizePreset).filter(Boolean).slice(0, 200);
    await writePresets(safe);
    return { ok: true, presets: safe };
  }

  return {
    configure,
    getPresets,
    replacePresets,
  };
}

module.exports = { createThemePresetService };