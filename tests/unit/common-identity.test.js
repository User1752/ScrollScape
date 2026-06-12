'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { safeId, sha1Short, safeName } = require('../../server/modules/common/identity');

test('safeId accepts expected ids and rejects unsafe patterns', () => {
  assert.equal(safeId('manga-123_abc'), 'manga-123_abc');
  assert.equal(safeId('A'.repeat(80)), 'A'.repeat(80));
  assert.equal(safeId('../etc/passwd'), null);
  assert.equal(safeId('id with spaces'), null);
  assert.equal(safeId('A'.repeat(81)), null);
  assert.equal(safeId(42), null);
});

test('sha1Short is deterministic and returns 12 chars', () => {
  const a = sha1Short('scrollscape');
  const b = sha1Short('scrollscape');
  assert.equal(a, b);
  assert.equal(a.length, 12);
});

test('safeName normalizes invalid chars and has fallback', () => {
  assert.equal(safeName('chapter: 1/2?'), 'chapter_ 1_2_');
  assert.equal(safeName(''), 'chapter');
  assert.equal(safeName(null), 'chapter');
});
