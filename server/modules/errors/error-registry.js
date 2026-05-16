// Error registry helper for ScrollScape
'use strict';

const fs = require('fs').promises;

async function registerKnownError({
  logPath,
  code,
  area,
  message,
  details = {}
}) {
  const now = new Date().toISOString();
  let entries = [];
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }
  const existing = entries.find((entry) =>
    entry.code === code &&
    entry.area === area &&
    entry.message === message
  );
  if (existing) {
    existing.lastSeenAt = now;
    existing.count = (existing.count || 1) + 1;
    existing.details = details;
  } else {
    entries.push({
      code,
      area,
      message,
      details,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1
    });
  }
  await fs.writeFile(logPath, JSON.stringify(entries, null, 2), 'utf8');
}

module.exports = {
  registerKnownError
};
