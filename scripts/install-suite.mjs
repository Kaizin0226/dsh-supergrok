// Windows installation helpers. Every operation is a dry run unless --apply is supplied.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { resolveProxyUrl } from '../lib/net.js';

if (process.platform !== 'win32') throw Error('This installer currently supports Windows only');
if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Node.js 24 is required');
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  bundle: { type: 'string' }, runtime: { type: 'string' }, backups: { type: 'string' },
  data: { type: 'string' }, 'proxy-url': { type: 'string' }, receipt: { type: 'string' },
  apply: { type: 'boolean', default: false },
} });
const command = positionals[0];
if (positionals.length !== 1 || !['install', 'init', 'rollback'].includes(command)) throw Error('Choose install, init or rollback');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function fixed(name) {
  if (!values[name] || !isAbsolute(values[name])) throw Error(`--${name} requires an explicit absolute path`);
  const path = resolve(values[name]);
  if (path === parse(path).root) throw Error('A drive root is not an installation target');
  ordinaryAncestors(path);
  return path;
}
function ordinaryAncestors(path) {
  for (let cursor = path; ; cursor = dirname(cursor)) {
    // lstat also finds broken links, which existsSync intentionally does not.
    let stat;
    try { stat = lstatSync(cursor); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw Error('Installation boundaries must not contain links or junctions');
    if (dirname(cursor) === cursor) break;
  }
}
function separate(a, b) {
  const sameOrWithin = (parent, child) => {
    const rel = relative(parent, child);
    return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
  };
  if (sameOrWithin(a, b) || sameOrWithin(b, a)) throw Error('Bundle, runtime, data and backup boundaries must be separate');
}
function inside(parent, name) {
  if (typeof name !== 'string' || name.includes('\\') || isAbsolute(name) || name.split('/').some(part => part === '..' || part === '')) throw Error('Unsafe bundle file name');
  const path = resolve(parent, name);
  if (!path.startsWith(parent + sep)) throw Error('Bundle file escaped its root');
  ordinaryAncestors(path);
  if (!lstatSync(path).isFile()) throw Error('Bundle payload must consist of ordinary files');
  return path;
}
function verifiedBundle(bundle) {
  const manifest = json(inside(bundle, 'suite-manifest.json'));
  if (manifest.schemaVersion !== 1 || !manifest.files || !manifest.files['package-lock.json'] || !manifest.files['package.json']) throw Error('Incomplete bundle manifest');
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (!/^[a-f0-9]{64}$/.test(expected) || hash(inside(bundle, file)) !== expected) throw Error(`Bundle integrity mismatch: ${file}`);
  }
  for (const p of manifest.packages) if (manifest.files[`vendor/${p.file}`] !== p.sha256) throw Error('Package integrity declaration mismatch');
  return manifest;
}
const runtime = fixed('runtime');
if (command === 'install') {
  const bundle = fixed('bundle');
  const backups = fixed('backups');
  separate(runtime, bundle); separate(runtime, backups); separate(bundle, backups);
  if (parse(runtime).root.toLowerCase() !== parse(backups).root.toLowerCase()) throw Error('Backups must be on the runtime drive for recoverable renames');
  const manifest = verifiedBundle(bundle);
  if (existsSync(runtime)) {
    const marker = join(runtime, '.dsh-supergrok-install.json');
    if (!existsSync(marker) || json(marker).runtime !== runtime) throw Error('Existing target is not a managed suite runtime; choose a fresh directory');
  }
  console.log(JSON.stringify({ operation: command, apply: values.apply, bundle, runtime, backups, packages: manifest.packages.length }));
  if (values.apply) {
    const id = randomUUID();
    const transaction = join(backups, id);
    const candidate = join(transaction, 'candidate');
    const previous = existsSync(runtime) ? join(transaction, 'previous') : null;
    mkdirSync(candidate, { recursive: true });
    for (const file of Object.keys(manifest.files)) {
      mkdirSync(dirname(join(candidate, file)), { recursive: true });
      cpSync(inside(bundle, file), join(candidate, file));
    }
    cpSync(join(bundle, 'suite-manifest.json'), join(candidate, 'suite-manifest.json'));
    verifiedBundle(candidate);
    const env = { ...process.env, npm_config_cache: join(transaction, 'npm-cache') };
    for (const key of Object.keys(env)) if (/API_KEY|TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete env[key];
    const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    const result = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: candidate, env, stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('Candidate installation failed; existing runtime was not moved');
    if (!existsSync(join(candidate, 'node_modules/@deepseek-ai/dsh/lib/bin.js'))) throw Error('DSH entry point is missing');
    verifiedBundle(candidate);
    save(join(candidate, '.dsh-supergrok-install.json'), { id, runtime });
    const receipt = join(transaction, 'receipt.json');
    save(receipt, { schemaVersion: 1, id, runtime, previous, transaction });
    ordinaryAncestors(runtime); ordinaryAncestors(backups);
    mkdirSync(dirname(runtime), { recursive: true });
    if (previous) renameSync(runtime, previous);
    try { renameSync(candidate, runtime); }
    catch (error) { if (previous && !existsSync(runtime)) renameSync(previous, runtime); throw error; }
    console.log(`Installed. Rollback receipt: ${receipt}`);
  }
} else if (command === 'init') {
  const data = fixed('data');
  separate(runtime, data);
  const proxyUrl = resolveProxyUrl(values['proxy-url']);
  if (existsSync(data)) throw Error('Data target must be new; existing conversations and settings are never overwritten');
  if (!existsSync(join(runtime, '.dsh-supergrok-install.json'))) throw Error('Install the suite runtime first');
  console.log(JSON.stringify({ operation: command, apply: values.apply, runtime, data, proxyUrl, defaultPreset: 'standard' }));
  if (values.apply) {
    const candidate = data + '.candidate-' + randomUUID();
    mkdirSync(candidate, { recursive: true });
    cpSync(join(runtime, 'preset'), join(candidate, '.agent-presets/grok-optimized'), { recursive: true });
    for (const profile of ['web', 'headless']) {
      const directory = join(candidate, 'profiles', profile);
      mkdirSync(directory, { recursive: true });
      save(join(directory, 'package.json'), { name: `dsh-profile-${profile}`, private: true, dependencies: {},
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', profile === 'web' ? '@deepseek-ai/dsh-web-app' : '@deepseek-ai/dsh-headless', 'dsh-llm-grok-oauth'], patchReload: profile === 'web' ? 'live' : 'startup' } } });
      writeFileSync(join(directory, 'cordis.patch.yml'), `- id: llm-grok-oauth\n  config:\n    proxyUrl: ${JSON.stringify(proxyUrl)}\n`);
      writeFileSync(join(directory, 'cordis.yml'), '[]\n');
      symlinkSync(realpathSync(join(runtime, 'node_modules')), join(directory, 'node_modules'), 'junction');
    }
    ordinaryAncestors(data);
    renameSync(candidate, data);
    console.log('Initialized fresh data. Launch DSH yourself and complete your own OAuth login.');
  }
} else {
  const receiptPath = fixed('receipt');
  const receipt = json(receiptPath);
  if (receipt.schemaVersion !== 1 || receipt.runtime !== runtime || receipt.transaction !== dirname(receiptPath)
    || !/^[a-f0-9-]{36}$/.test(receipt.id) || receipt.transaction !== join(dirname(receipt.transaction), receipt.id)) throw Error('Receipt does not identify this exact runtime and transaction');
  separate(runtime, receipt.transaction);
  if (receipt.previous !== null && receipt.previous !== join(receipt.transaction, 'previous')) throw Error('Invalid previous-runtime boundary');
  const marker = json(join(runtime, '.dsh-supergrok-install.json'));
  if (marker.id !== receipt.id || marker.runtime !== runtime) throw Error('Runtime has changed since this installation');
  const displaced = join(receipt.transaction, 'rolled-back');
  ordinaryAncestors(displaced);
  if (existsSync(displaced)) throw Error('This rollback already ran');
  if (receipt.previous) { ordinaryAncestors(receipt.previous); if (!existsSync(receipt.previous)) throw Error('Previous runtime is missing'); }
  console.log(JSON.stringify({ operation: command, apply: values.apply, runtime, previous: receipt.previous, displaced }));
  if (values.apply) {
    renameSync(runtime, displaced);
    try { if (receipt.previous) renameSync(receipt.previous, runtime); }
    catch (error) { renameSync(displaced, runtime); throw error; }
    console.log('Rolled back. Displaced installation was preserved; user data was not changed.');
  }
}
