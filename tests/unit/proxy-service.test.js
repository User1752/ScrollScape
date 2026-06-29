const test = require('node:test');
const assert = require('node:assert');
const { createProxyService } = require('../../server/modules/proxy/service');

test('Proxy Service - Security boundaries', async (t) => {
  const isSafeUrlMock = (url) => {
    // Basic mock logic mimicking actual isSafeUrl
    if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
    return true;
  };

  const service = createProxyService({ isSafeUrl: isSafeUrlMock });

  await t.test('Rejects invalid URLs', async () => {
    await assert.rejects(
      () => service.fetchProxyImage({ url: 'http://localhost/image.png' }),
      { statusCode: 400, message: 'Invalid image URL' }
    );
  });

  await t.test('Rejects AniList missing query', async () => {
    await assert.rejects(
      () => service.proxyAniList({ variables: {} }),
      { statusCode: 400, message: 'Missing query' }
    );
  });
});
