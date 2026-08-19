'use strict';

// Pure statistics helpers behind the calendar's "predicted release" dates:
// given a manga's recent chapter-to-chapter intervals, guess its cadence
// (weekly/biweekly/monthly/irregular) and how confident that guess is.
const MAX_INTERVALS = 8;

// Deterministic (not cryptographic) string hash — used to derive a stable
// per-manga jitter/skip pattern for predicted dates, so the same manga's
// predictions don't visibly shuffle between two calendar requests.
function seededHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function analyseIntervals(allIntervals) {
  const recent = allIntervals.slice(-MAX_INTERVALS);
  if (!recent.length) return { intervalMs: null, cadence: 'irregular', confidence: 'low' };

  const intervalMs = median(recent);
  const dayMs = 86_400_000;
  let scoreWeekly = 0;
  let scoreBiweekly = 0;
  let scoreMonthly = 0;

  for (const ms of recent) {
    const days = ms / dayMs;
    if (days >= 6 && days <= 8) scoreWeekly++;
    if (days >= 12 && days <= 16) scoreBiweekly++;
    if (days >= 26 && days <= 35) scoreMonthly++;
  }

  const threshold = Math.ceil(recent.length * 0.6);
  let cadence = 'irregular';
  if (scoreWeekly >= threshold) cadence = 'weekly';
  else if (scoreBiweekly >= threshold) cadence = 'biweekly';
  else if (scoreMonthly >= threshold) cadence = 'monthly';

  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const stdDev = Math.sqrt(recent.reduce((sum, value) => sum + (value - mean) ** 2, 0) / recent.length);
  const stdDevDays = stdDev / dayMs;
  let confidence = stdDevDays <= 1 ? 'high' : stdDevDays <= 4 ? 'medium' : 'low';
  if (cadence === 'irregular') confidence = 'low';

  return { intervalMs, cadence, confidence };
}

module.exports = { seededHash, analyseIntervals };
