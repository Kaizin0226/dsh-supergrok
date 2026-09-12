import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, globSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'work-dir': { type: 'string' }, 'upstream-source': { type: 'string' },
  phase: { type: 'string', default: 'all' },
} });
if (!values['work-dir']) throw Error('--work-dir must name a disposable build directory outside this checkout');
const work = resolve(values['work-dir']);
if (work === root || work.startsWith(root + '/') || work.startsWith(root + '\\')) throw Error('Build directory must be outside the source checkout');
if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Node.js 24 is required');
const lock = JSON.parse(readFileSync(join(root, 'patches/dsh/source.lock.json'), 'utf8'));
const source = join(work, 'upstream');
const tools = join(work, 'tools');
const artifacts = join(work, 'artifacts');
const environment = { ...process.env, DSH_TELEMETRY_DISABLED: '1', CI: '1' };
// Upstream scripts invoke pnpm again by name. Use our pinned bootstrap in all children.
const inheritedPath = Object.entries(environment).filter(([key]) => key.toLowerCase() === 'path').map(([,value]) => value).join(delimiter);
for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
environment.PATH = join(tools, 'node_modules', '.bin') + delimiter + inheritedPath;
environment.npm_config_cache = join(work, 'npm-cache');
environment.DSH_CLIENT_COMMIT_HASH = lock.commit;
for (const key of Object.keys(environment)) if (/API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete environment[key];
environment.XAI_API_KEY = '';
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
function run(command, args, cwd = work, extra = {}) {
  const result = spawnSync(command, args, { cwd, env: environment, stdio: 'inherit', windowsHide: true, ...extra });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed (${result.status})`);
  return result;
}
function json(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
mkdirSync(work, { recursive: true });
mkdirSync(artifacts, { recursive: true });
if (values.phase === 'all' || values.phase === 'prepare') {
  if (existsSync(source)) throw Error('Upstream directory already exists; use a fresh --work-dir or a later phase');
  const input = values['upstream-source'] ? resolve(values['upstream-source']) : join(work, 'upstream-git');
  if (!values['upstream-source']) run('git', ['clone', '--depth=1', '--branch', lock.tag, '--no-checkout', lock.repository, input]);
  const git = ['-c', `safe.directory=${input.replaceAll('\\', '/')}`, '-C', input];
  const revision = run('git', [...git, 'rev-parse', `${lock.tag}^{commit}`], work, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).stdout.trim();
  if (revision !== lock.commit) throw Error('Upstream tag does not match the reviewed commit');
  const archive = join(work, 'upstream.tar');
  const fd = openSync(archive, 'w');
  try { run('git', [...git, 'archive', '--format=tar', lock.commit], work, { stdio: ['ignore', fd, 'inherit'] }); }
  finally { closeSync(fd); }
  mkdirSync(source);
  run('tar', ['-xf', archive, '-C', source]);
  for (const name of lock.patches) run('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'apply', '--check', join(root, 'patches/dsh', name)], source);
  for (const name of lock.patches) run('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'apply', join(root, 'patches/dsh', name)], source);
  json(join(work, 'build-state.json'), { upstreamCommit: lock.commit, distributionVersion: lock.distributionVersion });
  console.log('Prepared clean upstream source and reviewed core patch.');
}
const state = JSON.parse(readFileSync(join(work, 'build-state.json'), 'utf8'));
if (state.upstreamCommit !== lock.commit || state.distributionVersion !== lock.distributionVersion) throw Error('Build state does not match source lock');
const pnpm = join(tools, 'node_modules/pnpm/bin/pnpm.cjs');
if (['all', 'build', 'test'].includes(values.phase) && !existsSync(pnpm)) {
  run(process.execPath, [npm, 'install', '--prefix', tools, '--ignore-scripts', '--no-audit', '--no-fund', lock.packageManager]);
}
if (values.phase === 'all' || values.phase === 'build') {
  run(process.execPath, [pnpm, 'install', '--frozen-lockfile', '--ignore-scripts', '--store-dir', join(work, 'pnpm-store')], source);
  run(process.execPath, [pnpm, 'run', 'build'], source);
  console.log('Built DSH host, client and web assets from source.');
}
if (values.phase === 'test') {
  run(process.execPath, ['--require', join(root, 'test/offline-guard.cjs'), join(source, 'node_modules/vitest/vitest.mjs'), 'run', '--maxWorkers=4',
    'packages/llm/llm/tests', 'packages/core/agent-loop/tests',
    'packages/api/session-controller/tests/session-models.host.spec.ts'], source);
}
if (values.phase === 'all' || values.phase === 'pack') {
  const packages = Object.entries(lock.packages).map(([path, version]) => ({ path, version,
    manifest: JSON.parse(readFileSync(join(source, path, 'package.json'), 'utf8')) }));
  const versions = new Map(packages.map(p => [p.manifest.name, p.version]));
  const workspaceVersions = new Map(globSync(['vendor/*/package.json', 'packages/*/*/package.json', 'apps/*/package.json'], { cwd: source })
    .map(path => { const m = JSON.parse(readFileSync(join(source, path), 'utf8')); return [m.name, m.version]; }));
  json(join(artifacts, 'release-family.json'), Object.fromEntries([...workspaceVersions].filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))));
  const report = [];
  for (const p of packages) {
    const destination = join(work, 'packages', p.manifest.name.replace('@deepseek-ai/', ''));
    mkdirSync(destination, { recursive: true });
    for (const name of ['lib', 'presets', 'README.md', 'LICENSE']) {
      const input = join(source, p.path, name);
      if (existsSync(input)) cpSync(input, join(destination, name), { recursive: true });
    }
    if (!existsSync(join(destination, 'LICENSE'))) cpSync(join(source, 'LICENSE'), join(destination, 'LICENSE'));
    // Preset provenance is byte-stable across Windows Git newline settings.
    for (const yaml of globSync('presets/**/*.yml', { cwd: destination })) {
      const path = join(destination, yaml);
      writeFileSync(path, readFileSync(path, 'utf8').replace(/\r\n?/g, '\n'));
    }
    p.manifest.version = p.version;
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, value] of Object.entries(p.manifest[field] ?? {})) {
        if (versions.has(name)) p.manifest[field][name] = versions.get(name);
        else if (value.startsWith('workspace:')) {
          const exactVersion = workspaceVersions.get(name);
          if (!exactVersion) throw Error(`Unresolved workspace dependency: ${name}`);
          p.manifest[field][name] = exactVersion;
        }
      }
    }
    if (p.manifest.name === '@deepseek-ai/dsh-agent-presets') {
      const presetRoot = join(root, 'presets/grok-optimized');
      const upstream = readFileSync(join(source, p.path, 'presets/standard/agent.cordis.yml'), 'utf8').replace(/\r\n?/g, '\n');
      if (upstream !== readFileSync(join(presetRoot, 'upstream-standard.cordis.yml'), 'utf8').replace(/\r\n?/g, '\n')) throw Error('Preset baseline differs from pinned upstream');
      cpSync(join(presetRoot, 'standard.cordis.yml'), join(destination, 'presets/standard/agent.cordis.yml'));
      p.manifest.peerDependencies['dsh-tool-attachment-history'] = '1.2.0';
    }
    delete p.manifest.devDependencies;
    delete p.manifest.scripts;
    json(join(destination, 'package.json'), p.manifest);
    run(process.execPath, [npm, 'pack', '--ignore-scripts', '--pack-destination', artifacts], destination);
    report.push({ name: p.manifest.name, version: p.version, file: `${p.manifest.name.replace('@', '').replace('/', '-')}-${p.version}.tgz` });
  }
  json(join(artifacts, 'core-packages.json'), report);
}
if (!['all', 'prepare', 'build', 'test', 'pack'].includes(values.phase)) throw Error('Unknown build phase');
