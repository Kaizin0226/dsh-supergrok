import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('runtime source has no CLI credential, shell opener, curl, API-key fallback, or direct fetch', async () => {
  const names = (await readdir(join(root, 'lib'))).filter((name) => name.endsWith('.js'));
  const source = (await Promise.all(names.map((name) => readFile(join(root, 'lib', name), 'utf8')))).join('\n');
  for (const forbidden of [
    /from ['"]node:child_process['"]/,
    /execFile\s*\(/,
    /spawn\s*\(/,
    /\.grok[\\/]auth\.json/,
    /GROK_AUTH_FILE/,
    /GROK_HOME/,
    /api\.x\.ai/,
    /process\.env\.XAI_API_KEY/,
    /\bcurl\b.*--data/,
    /logger[^\n]*(?:error\?\.|error\.|\$\{error)/,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.doesNotMatch(source, /image attachment omitted/);
  assert.doesNotMatch(source, /\bgrok-\d+(?:\.\d+)+(?:[-._][a-z0-9]+)*\b/i);
  assert.doesNotMatch(source, /DEFAULT_MODEL|DEFAULT_REASONING_EFFORT|VALIDATED_IMAGE_MODEL/);
  assert.doesNotMatch(await readFile(join(root, 'lib', 'net.js'), 'utf8'), /return\s+(?:globalThis\.)?fetch\s*\(/);
});

test('all runtime JavaScript parses with XAI_API_KEY explicitly empty', async () => {
  const environment = { ...process.env };
  environment.XAI_API_KEY = '';
  const names = (await readdir(join(root, 'lib'))).filter((name) => name.endsWith('.js'));
  for (const name of names) {
    const result = spawnSync(process.execPath, ['--check', join(root, 'lib', name)], {
      env: environment,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
});

test('every provider request uses the host attributionHeaders contract', async () => {
  const protocol = await readFile(join(root, 'lib', 'protocol.js'), 'utf8');
  const net = await readFile(join(root, 'lib', 'net.js'), 'utf8');
  for (const source of [protocol, net]) {
    assert.match(source, /import \{ attributionHeaders \} from ['"]@deepseek-ai\/dsh-llm['"]/);
    assert.match(source, /\.\.\.attributionHeaders\(\)/);
  }
  const runtime = `${protocol}\n${net}`;
  assert.doesNotMatch(runtime, /['"]user-agent['"]\s*:/);
});
