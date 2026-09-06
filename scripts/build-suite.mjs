import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { 'work-dir': { type: 'string' }, phase: { type: 'string', default: 'all' } } });
if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Node.js 24 is required');
if (!values['work-dir']) throw Error('--work-dir is required');
const work = resolve(values['work-dir']);
if (work === root || work.startsWith(root + '/') || work.startsWith(root + '\\')) throw Error('Build outside the checkout');
const artifacts = join(work, 'artifacts');
const kit = join(work, 'suite-kit');
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const env = { ...process.env, npm_config_cache: join(work, 'npm-cache'), DSH_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(env)) if (/API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete env[key];
env.XAI_API_KEY = '';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const run = (args, cwd = kit) => {
  const r = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`${args[0]} exited ${r.status}`);
};
// Preserve every registry resolution from the reviewed lock; refresh only locally built tarball bytes.
function lockedGraph(template, destination, packed) {
  const lock = read(join(root, 'build-locks', template));
  const manifest = read(join(destination, 'package.json'));
  const ordered = object => JSON.stringify(Object.entries(object ?? {}).sort());
  if (ordered(lock.packages[''].dependencies) !== ordered(manifest.dependencies)
    || ordered(lock.packages[''].devDependencies) !== ordered(manifest.devDependencies)) throw Error('Build dependencies differ from the reviewed lock');
  for (const p of packed) {
    const entry = lock.packages[`node_modules/${p.name}`];
    if (!entry || entry.version !== p.version || !entry.resolved?.startsWith('file:')) throw Error('Missing local package lock');
    entry.integrity = 'sha512-' + createHash('sha512').update(readFileSync(join(artifacts, p.file))).digest('base64');
  }
  save(join(destination, 'package-lock.json'), lock);
}
const core = read(join(artifacts, 'core-packages.json'));
const names = ['dsh-attachment-history', 'dsh-tool-attachment-history', 'dsh-grok-work-state-context'];
const dependencies = { '@deepseek-ai/dsh': '0.1.2-rc.1' };
const overrides = {};
for (const p of core) {
  const spec = `file:${relative(kit, join(artifacts, p.file)).replaceAll('\\', '/')}`;
  dependencies[p.name] = spec;
  overrides[p.name] = `$${p.name}`;
}
mkdirSync(kit, { recursive: true });
if (values.phase === 'all' || values.phase === 'prepare') {
  for (const name of names) {
    const target = join(kit, 'extensions', name);
    if (existsSync(target)) throw Error('Suite source already prepared; choose another work directory or use a later phase');
    cpSync(join(root, 'extensions', name), target, { recursive: true });
    const manifest = read(join(target, 'package.json'));
    for (const [peer, version] of Object.entries(manifest.peerDependencies ?? {})) {
      if (!dependencies[peer] && !names.includes(peer)) dependencies[peer] = version;
    }
    delete manifest.devDependencies;
    save(join(target, 'package.json'), manifest);
    dependencies[name] = `file:extensions/${name}`;
  }
  Object.assign(dependencies, {
    '@deepseek-ai/cordis-plugin-loader': '1.0.3',
    '@deepseek-ai/cordis-plugin-include': '1.0.7',
  });
  save(join(kit, 'package.json'), { name: 'dsh-supergrok-build-kit', version: '0.7.0', private: true, type: 'module', dependencies, overrides,
    devDependencies: { typescript: '5.9.3', vitest: '4.1.11', '@types/node': '24.13.3' } });
  cpSync(join(root, 'presets'), join(kit, 'presets'), { recursive: true });
  lockedGraph('suite-kit.lock.json', kit, core);
  run([npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
}
if (values.phase === 'all' || values.phase === 'compile') {
  for (const name of names.slice(0, 2)) run([join(kit, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], join(kit, 'extensions', name));
}
if (values.phase === 'all' || values.phase === 'test') {
  run([join(kit, 'node_modules/vitest/vitest.mjs'), 'run', 'extensions/dsh-attachment-history/tests', 'extensions/dsh-tool-attachment-history/tests']);
}
if (values.phase === 'all' || values.phase === 'pack') {
  const packed = [...core];
  for (const name of names) {
    const path = join(kit, 'extensions', name);
    const manifest = read(join(path, 'package.json'));
    run([npm, 'pack', '--ignore-scripts', '--pack-destination', artifacts], path);
    packed.push({ name, version: manifest.version, file: `${name}-${manifest.version}.tgz` });
  }
  run([npm, 'pack', '--ignore-scripts', '--pack-destination', artifacts], root);
  const provider = read(join(root, 'package.json'));
  packed.push({ name: provider.name, version: provider.version, file: `${provider.name}-${provider.version}.tgz` });
  const bundle = join(work, 'bundle');
  mkdirSync(join(bundle, 'vendor'), { recursive: true });
  const runtimeDependencies = { '@deepseek-ai/dsh': '0.1.2-rc.1' };
  const runtimeOverrides = {};
  for (const p of packed) {
    cpSync(join(artifacts, p.file), join(bundle, 'vendor', p.file));
    runtimeDependencies[p.name] = `file:vendor/${p.file}`;
    runtimeOverrides[p.name] = `$${p.name}`;
    p.sha256 = createHash('sha256').update(readFileSync(join(artifacts, p.file))).digest('hex');
  }
  // Keep the complete dependency graph in the distribution, with no private paths.
  save(join(bundle, 'package.json'), { name: 'dsh-supergrok-runtime', version: '0.7.0', private: true, type: 'module',
    dependencies: runtimeDependencies, overrides: runtimeOverrides });
  mkdirSync(join(bundle, 'preset'), { recursive: true });
  const presetFiles = ['agent.cordis.yml', 'preset.yml', 'package.json', 'base-lock.json', 'PROVENANCE.md', 'LICENSE', 'NOTICE', 'Grok-Build-Apache-2.0.txt'];
  for (const file of presetFiles) cpSync(join(root, 'presets/grok-optimized', file), join(bundle, 'preset', file));
  lockedGraph('runtime.lock.json', bundle, packed);
  const files = {};
  for (const file of ['package.json', 'package-lock.json', ...packed.map(p => `vendor/${p.file}`), ...presetFiles.map(p => `preset/${p}`)]) {
    files[file] = createHash('sha256').update(readFileSync(join(bundle, file))).digest('hex');
  }
  save(join(bundle, 'suite-manifest.json'), { schemaVersion: 1, upstreamCommit: 'a66e4702047846cdaa10c66c9d3df3951f5ea70d', packages: packed, files });
  console.log('Packaged source-built components and a portable locked runtime bundle.');
}
if (!['all', 'prepare', 'compile', 'test', 'pack'].includes(values.phase)) throw Error('Unknown suite phase');
