import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('package and DSH bundle identity are pinned', async () => {
  assert.equal(process.env.XAI_API_KEY === '', true, 'Use the credential-scrubbing test runner');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8');
  assert.equal(pkg.version, '0.9.0-hardened.1');
  assert.equal(pkg.main, 'lib/index.js');
  assert.equal(pkg.exports?.['./client'], './lib/client.js');
  assert.equal(pkg.exports?.['./hardening'], './supergrok-hardening.json');
  assert.equal(pkg.dependencies?.undici, '7.30.0');
  const expectedDevDependencies = {
    '@deepseek-ai/dsh-attachment': '0.2.0-rc.2',
    '@deepseek-ai/cordis': '4.0.4',
    '@deepseek-ai/dsh-credentials': '0.2.0-rc.2',
    '@deepseek-ai/dsh-llm': '0.2.0-rc.2',
    '@deepseek-ai/dsh-settings': '0.2.0-rc.2',
    '@deepseek-ai/schemastery': '3.18.4',
  };
  const expectedPeers = {
    ...expectedDevDependencies,
    '@deepseek-ai/dsh-llm': '0.2.0-rc.2',
  };
  assert.deepEqual(pkg.peerDependencies, expectedPeers);
  assert.deepEqual(Object.fromEntries(Object.entries(pkg.devDependencies).filter(([name])=>name!=='playwright')), expectedDevDependencies);
  assert.match(patch, /id: llm-grok-oauth/);
  assert.doesNotMatch(JSON.stringify(pkg.dsh?.market), /https?:\/\//);
});

test('fresh installed runtime can import the plugin entry without apply or network', async () => {
  const entry = await import('../lib/index.js');
  assert.equal(entry.PROVIDER, 'grok-oauth');
  assert.equal(entry.DEFAULT_MODEL, undefined);
  assert.equal(entry.DEFAULT_REASONING_EFFORT, undefined);
  assert.equal(entry.CATALOG_SYNC_SECONDS, 3600);
  assert.equal(entry.MODELS_REFRESH_SECONDS_DEFAULT, 60);
  assert.equal(entry.MODELS_REFRESH_SECONDS_MIN, 10);
  assert.equal(entry.MODELS_REFRESH_SECONDS_MAX, 86400);
  assert.equal(entry.MODEL, undefined);
  assert.equal(typeof entry.apply, 'function');
  assert.throws(() => entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', baseURL: 'https://evil.test' }), /not configurable/);
  assert.throws(() => entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', permission: 'full-access' }), /not configurable/);
  assert.equal(entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', model: 'grok-legacy', reasoningEffort: 'legacy' }).model, undefined);
  assert.equal(entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', model: 'grok-legacy', reasoningEffort: 'legacy' }).reasoningEffort, undefined);
  assert.equal(entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1',}).modelsRefreshSeconds, 60);
  assert.equal(entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', modelsRefreshSeconds: 10 }).modelsRefreshSeconds, 10);
  assert.equal(entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', modelsRefreshSeconds: 86400 }).modelsRefreshSeconds, 86400);
  assert.throws(() => entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', modelsRefreshSeconds: 9 }), /invalid modelsRefreshSeconds/);
  assert.throws(() => entry.resolveOptions({ proxyUrl: 'http://127.0.0.1:1', modelsRefreshSeconds: 86401 }), /invalid modelsRefreshSeconds/);
});
