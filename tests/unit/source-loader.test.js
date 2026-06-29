const test = require('node:test');
const assert = require('node:assert');
const { createSourceLoaderCore } = require('../../server/modules/source-loader/core');

test('Source Loader - Path Confinement', async (t) => {
  const core = createSourceLoaderCore({ safeId: (id) => id });
  core.configure({ sourcesDir: '/data/sources', snapSourcesDir: '/snap/sources', isPkg: false });

  await t.test('resolves valid source path', () => {
    // Cannot easily test absolute path resolution across OSs without mocking path, 
    // but we can check if it returns a string ending with id.js
    const id = 'test_source';
    const p = core.sourcePath(id);
    assert.ok(p.endsWith('test_source.js'), 'Path should end with source id.js');
  });
});

test('Source Loader - Module Validation', async (t) => {
  const core = createSourceLoaderCore();
  
  await t.test('detectRepoKind returns correct type', () => {
    assert.strictEqual(core.detectRepoKind({ sources: [] }), 'jsrepo');
    assert.strictEqual(core.detectRepoKind([]), 'tachiyomi');
    assert.strictEqual(core.detectRepoKind({ extensions: [] }), 'tachiyomi');
    assert.strictEqual(core.detectRepoKind({ foo: 'bar' }), 'unknown');
  });
});
