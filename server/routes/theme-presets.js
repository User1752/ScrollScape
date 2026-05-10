/**
 * routes/theme-presets.js — Persist custom theme presets on disk
 *
 * Endpoints:
 *   GET /api/theme-presets  — Returns { presets: [...] }
 *   PUT /api/theme-presets  — Replaces preset list from body.presets
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

let PRESETS_DIR = '';
let PRESETS_FILE = '';

function configure(opts) {
  PRESETS_DIR = opts?.presetsDir || '';
  PRESETS_FILE = path.join(PRESETS_DIR, 'custom-presets.json');
}

function _safeStr(v, max = 500) {
  return String(v ?? '').slice(0, max);
}

function _safeNum(v, fallback = 0, min = 0, max = 100) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizePreset(input) {
  if (!input || typeof input !== 'object') return null;
  const id = _safeStr(input.id, 120).trim();
  if (!id) return null;
  const hasAccent = Object.prototype.hasOwnProperty.call(input, 'accentColor');
  const accentSource = hasAccent ? input.accentColor : input.paletteColor;
  return {
    id,
    name: _safeStr(input.name, 80).trim() || 'My Preset',
    bgUrl: _safeStr(input.bgUrl, 1500),
    bgDim: _safeNum(input.bgDim, 0),
    bgOpac: _safeNum(input.bgOpac, 0),
    charUrl: _safeStr(input.charUrl, 1500),
    charDim: _safeNum(input.charDim, 0),
    charDark: _safeNum(input.charDark, 0),
    headerUrl: _safeStr(input.headerUrl, 1500),
    headerDim: _safeNum(input.headerDim, 0),
    headerOpac: _safeNum(input.headerOpac, 0),
    headerPosX: _safeNum(input.headerPosX, 50),
    headerPosY: _safeNum(input.headerPosY, 50),
    cornerUrl: _safeStr(input.cornerUrl, 1500),
    cornerDim: _safeNum(input.cornerDim, 0),
    cornerDark: _safeNum(input.cornerDark, 0),
    paletteColor: _safeStr(input.paletteColor, 20),
    buttonColor: _safeStr(input.buttonColor, 20),
    accentColor: _safeStr(accentSource, 20),
    fontFamily: _safeStr(input.fontFamily, 200),
  };
}

async function readPresets() {
  if (!PRESETS_FILE) throw new Error('Theme presets route not configured');
  try {
    const raw = await fsp.readFile(PRESETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.presets) ? parsed.presets : [];
  } catch {
    return [];
  }
}

async function writePresets(presets) {
  if (!PRESETS_FILE) throw new Error('Theme presets route not configured');
  await fsp.mkdir(PRESETS_DIR, { recursive: true });
  const payload = { presets, updatedAt: new Date().toISOString() };
  await fsp.writeFile(PRESETS_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

function registerThemePresetRoutes(router) {
  router.get('/api/theme-presets', asyncHandler(async (_req, res) => {
    const presets = await readPresets();
    res.json({ presets });
  }));

  router.put('/api/theme-presets', asyncHandler(async (req, res) => {
    const incoming = Array.isArray(req.body?.presets) ? req.body.presets : [];
    const safe = incoming.map(sanitizePreset).filter(Boolean).slice(0, 200);
    await writePresets(safe);
    res.json({ ok: true, presets: safe });
  }));
}

module.exports = { configure, registerThemePresetRoutes };
