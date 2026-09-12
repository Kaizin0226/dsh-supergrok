import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { 'work-dir': { type: 'string' } } });
if (!values['work-dir']) throw Error('An explicit prepared build directory is required');
const work = resolve(values['work-dir']);
const source = join(work, 'upstream');
const state = JSON.parse(readFileSync(join(work, 'build-state.json')));
const lock = JSON.parse(readFileSync(join(root, 'patches/dsh/source.lock.json')));
if (state.upstreamCommit !== lock.commit) throw Error('SDK fixture requires the pinned build');
const env = { ...process.env, DSH_SNAPSHOT: 'replay', DSH_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: `--require="${join(root, 'test/offline-guard.cjs').replaceAll('\\', '/')}"` };
for (const key of Object.keys(env)) if (/API_KEY|TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete env[key];
for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP']) {
  env[key] = join(work, 'sdk-isolation', key === 'TMP' ? 'temp' : key.toLowerCase());
  mkdirSync(env[key], { recursive: true });
}
const result = spawnSync(process.execPath, [join(source, 'node_modules/vitest/vitest.mjs'), 'run',
  '--config', 'vitest.snapshot.config.ts', 'snapshots/sdk/sdk.snapshot.ts', '-t', 'prepared-input-notices', '--maxWorkers=1'],
  { cwd: source, env, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
