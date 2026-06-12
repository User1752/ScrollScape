'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAsyncHandler } = require('../../server/modules/http/async-handler');

function createMockRes() {
  return {
    headersSent: false,
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('createAsyncHandler returns 400 and message for expected errors', async () => {
  const wrap = createAsyncHandler('TEST');
  const handler = wrap(async () => {
    const err = new Error('Bad request');
    err.statusCode = 400;
    err.expected = true;
    throw err;
  });

  const req = { method: 'GET', originalUrl: '/x', params: {}, body: {} };
  const res = createMockRes();

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await handler(req, res, () => {});
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { ok: false, error: 'Bad request' });
});

test('createAsyncHandler returns fallback status/message', async () => {
  const handler = createAsyncHandler('TEST');
  const req = {};
  const res = {
    status: function (code) { this.statusCode = code; return this; },
    json: function (data) { this.body = data; }
  };

  const failingRoute = async () => {
    const err = new Error('boom');
    throw err;
  };

  await handler(failingRoute)(req, res, () => {});

  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.body, { ok: false, error: 'boom' });
});
