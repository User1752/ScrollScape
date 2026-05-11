'use strict';

const crypto = require('crypto');

function safeId(id) {
  if (typeof id !== 'string') return null;
  return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : null;
}

function sha1Short(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 12);
}

function safeName(input) {
  return String(input || '').replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'chapter';
}

module.exports = {
  safeId,
  sha1Short,
  safeName,
};