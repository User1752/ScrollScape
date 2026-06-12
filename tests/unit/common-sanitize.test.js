'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { safeManga, isSafeUrl } = require('../../server/modules/common/sanitize');

test('safeManga returns sanitized shape and caps lengths', () => {
  const input = {
    id: 'abc',
    title: 'T'.repeat(500),
    cover: 'https://example.com/cover.webp',
    genres: ['Action', 123, null],
  };

  const out = safeManga(input);

  assert.equal(out.id, 'abc');
  assert.equal(out.title.length, 300);
  assert.deepEqual(out.genres, ['Action', '123', '']);
  assert.equal(out.cover, 'https://example.com/cover.webp');
});

test('safeManga returns empty object for invalid input', () => {
  assert.deepEqual(safeManga(null), {});
  assert.deepEqual(safeManga('x'), {});
});

test('isSafeUrl accepts regular public urls', () => {
  assert.equal(isSafeUrl('https://example.org/path?a=1'), true);
  assert.equal(isSafeUrl('http://mangadex.org/title/123'), true);
});

test('isSafeUrl rejects invalid protocol and local/private hosts', () => {
  assert.equal(isSafeUrl('file:///etc/passwd'), false);
  assert.equal(isSafeUrl('http://localhost:3000'), false);
  assert.equal(isSafeUrl('http://127.0.0.1'), false);
  assert.equal(isSafeUrl('http://10.0.0.12'), false);
  assert.equal(isSafeUrl('http://192.168.1.3'), false);
  assert.equal(isSafeUrl('http://172.16.0.2'), false);
  assert.equal(isSafeUrl('http://[::1]/x'), false);
});
