import assert from 'node:assert/strict';
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { 'work-dir': { type: 'string' } } });
if (!values['work-dir']) throw Error('--work-dir is required');
const work = resolve(values['work-dir']);
if (work === root || work.startsWith(root + '/') || work.startsWith(root + '\\')) throw Error('Test outside the checkout');
const fixture = mkdtempSync(join(work, 'installed-test-'));
const runtime = join(fixture, 'runtime');
const data = join(fixture, 'data');
const backups = join(fixture, 'backups');
const env = { ...process.env, DSH_TEST_RUNTIME_ROOT: runtime, DSH_TEST_HOME: data, DSH_TELEMETRY_DISABLED: '1', DSH_SUPERGROK_ACCEPTANCE: '1' };
for (const key of Object.keys(env)) if (/API_KEY|TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete env[key];
env.XAI_API_KEY = '';
function run(args, expected = 0) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 240_000 });
  if (result.error) throw result.error;
  if (result.status !== expected) {
    process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    throw Error(`Installed verification exited ${result.status}; expected ${expected}`);
  }
  return result.stdout;
}
const installer = join(root, 'scripts/install-suite.mjs');
const installation = [installer, 'install', '--bundle', join(work, 'bundle'), '--runtime', runtime, '--backups', backups];
run(installation);
assert.equal(existsSync(runtime), false);
assert.equal(existsSync(backups), false);
run([...installation, '--apply']);
console.log('PASS clean locked runtime installation and default dry-run');
const initialization = [installer, 'init', '--runtime', runtime, '--data', data, '--proxy-url', 'http://127.0.0.1:1'];
run(initialization);
assert.equal(existsSync(data), false);
run([...initialization, '--apply']);
run([...initialization, '--apply'], 1);
const proxyReject = [...initialization]; proxyReject[proxyReject.length - 1] = 'https://example.invalid';
run(proxyReject, 1);
console.log('PASS fresh data initialization and overwrite/proxy refusal');
const packageTests = join(runtime, 'work-state-tests');
cpSync(join(root, 'extensions/dsh-grok-work-state-context'), packageTests, { recursive: true });
const files = globSync('tests/*.test.mjs', { cwd: packageTests }).map(file => join(packageTests, file));
console.log(run(['--test', ...files]));
for (const profile of ['web', 'headless']) {
  const output = run([join(root, 'test/installed-profile.mjs'), profile, data, runtime]);
  const result = output.split(/\r?\n/).filter(line => line.startsWith('{"profile":')).map(line => JSON.parse(line)).at(-1);
  assert.ok(result?.startupPassed);
  assert.equal(result.realModelRequests, 0);
  assert.equal(result.providerLoaded, true);
  assert.equal(result.inferenceCount, profile === 'headless' ? 1 : 0);
  console.log(`PASS actual ${profile} composition: ${JSON.stringify(result)}`);
}
const firstMarker = JSON.parse(readFileSync(join(runtime, '.dsh-supergrok-install.json')));
run([...installation, '--apply']);
const secondMarker = JSON.parse(readFileSync(join(runtime, '.dsh-supergrok-install.json')));
assert.notEqual(firstMarker.id, secondMarker.id);
const receipt = join(backups, secondMarker.id, 'receipt.json');
const rollback = [installer, 'rollback', '--runtime', runtime, '--receipt', receipt];
run(rollback);
assert.equal(JSON.parse(readFileSync(join(runtime, '.dsh-supergrok-install.json'))).id, secondMarker.id);
run([...rollback, '--apply']);
assert.equal(JSON.parse(readFileSync(join(runtime, '.dsh-supergrok-install.json'))).id, firstMarker.id);
assert.ok(existsSync(join(backups, secondMarker.id, 'rolled-back')));
assert.ok(existsSync(data));
console.log('PASS recoverable replacement and exact-receipt rollback; data preserved');
console.log('PASS installed suite verification (synthetic services only)');
