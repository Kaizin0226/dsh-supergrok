import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const probe = join(testDirectory, 'live-canary-probe.mjs');

function run(mode, budget, extraEnvironment = {}) {
  const environment = { ...process.env, ...extraEnvironment };
  environment.XAI_API_KEY = '';
  delete environment.DSH_SUPERGROK_ACCEPTANCE;
  environment.DSH_SUPERGROK_LIVE_CANARY_MAX_INFERENCES = budget;
  return spawnSync(process.execPath, [probe, mode], {
    cwd: join(testDirectory, '..'),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
}

test('live Canary freezes one catalog revision for two inference legs and rejects a third', () => {
  const result = run('two-leg', '2');
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('live Canary spends one catalog attempt and never follows 404 to models-v2', () => {
  const result = run('catalog-404', '1');
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('live Canary counts the first inference attempt and never replays a 401', () => {
  const result = run('inference-401', '1');
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('live Canary rejects invalid inference budgets and legacy acceptance combination at import', () => {
  const invalid = run('two-leg', '3');
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /must be exactly 1 or 2/);

  const environment = { ...process.env };
  environment.XAI_API_KEY = '';
  environment.DSH_SUPERGROK_ACCEPTANCE = '1';
  environment.DSH_SUPERGROK_LIVE_CANARY_MAX_INFERENCES = '1';
  const combined = spawnSync(process.execPath, [probe, 'catalog-404'], {
    cwd: join(testDirectory, '..'),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(combined.status, 0);
  assert.match(combined.stderr, /cannot be combined/);
});
