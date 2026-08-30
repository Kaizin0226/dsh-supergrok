import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('package and DSH bundle identity are pinned', async () => {
  assert.equal(process.env.XAI_API_KEY, undefined);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8');
  assert.equal(pkg.version, '0.3.0-hardened.5');
  assert.equal(pkg.main, 'lib/index.js');
  assert.equal(pkg.exports?.['./client'], './lib/client.js');
  assert.equal(pkg.exports?.['./hardening'], './supergrok-hardening.json');
  assert.equal(pkg.dependencies?.undici, '7.29.0');
  const expectedPeers = {
    '@deepseek-ai/cordis': '4.0.1',
    '@deepseek-ai/dsh-credentials': '0.1.1-rc.2',
    '@deepseek-ai/dsh-llm': '0.1.1-rc.2',
    '@deepseek-ai/dsh-settings': '0.1.1-rc.2',
    '@deepseek-ai/schemastery': '3.18.1',
  };
  assert.deepEqual(pkg.peerDependencies, expectedPeers);
  assert.deepEqual(pkg.devDependencies, expectedPeers);
  assert.match(patch, /id: llm-grok-oauth/);
  assert.doesNotMatch(JSON.stringify(pkg.dsh?.market), /https?:\/\//);
});

test('fresh installed runtime can import the plugin entry without apply or network', async () => {
  const entry = await import('../lib/index.js');
  assert.equal(entry.PROVIDER, 'grok-oauth');
  assert.equal(entry.DEFAULT_MODEL, 'grok-4.6');
  assert.equal(entry.DEFAULT_REASONING_EFFORT, 'high');
  assert.equal(entry.CATALOG_SYNC_SECONDS, 3600);
  assert.equal(entry.MODELS_REFRESH_SECONDS_DEFAULT, 60);
  assert.equal(entry.MODELS_REFRESH_SECONDS_MIN, 10);
  assert.equal(entry.MODELS_REFRESH_SECONDS_MAX, 86400);
  assert.equal(entry.MODEL, 'grok-4.6');
  assert.equal(typeof entry.apply, 'function');
  assert.throws(() => entry.resolveOptions({ baseURL: 'https://evil.test' }), /not configurable/);
  assert.throws(() => entry.resolveOptions({ permission: 'full-access' }), /not configurable/);
  assert.throws(() => entry.resolveOptions({ model: 'grok-4.5' }), /model drift/);
  assert.throws(() => entry.resolveOptions({ reasoningEffort: 'low' }), /reasoning drift/);
  assert.equal(entry.resolveOptions({}).modelsRefreshSeconds, 60);
  assert.equal(entry.resolveOptions({ modelsRefreshSeconds: 10 }).modelsRefreshSeconds, 10);
  assert.equal(entry.resolveOptions({ modelsRefreshSeconds: 86400 }).modelsRefreshSeconds, 86400);
  assert.throws(() => entry.resolveOptions({ modelsRefreshSeconds: 9 }), /invalid modelsRefreshSeconds/);
  assert.throws(() => entry.resolveOptions({ modelsRefreshSeconds: 86401 }), /invalid modelsRefreshSeconds/);
});
