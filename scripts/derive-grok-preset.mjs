import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'presets', 'grok-optimized');
const read = name => readFileSync(resolve(root, name), 'utf8').replace(/\r\n?/g, '\n');
const check = process.argv.includes('--check');
const write = (name, content) => {
  if (check) {
    if (read(name) !== content) throw new Error(`Derived preset differs: ${name}`);
  } else writeFileSync(resolve(root, name), content);
};
const metadata = JSON.parse(read('package.json'));
const components = JSON.parse(readFileSync(resolve(root, '..', '..', 'components.lock.json'), 'utf8'));
if (metadata.version !== components.preset.version || components.preset.id !== 'grok-optimized') {
  throw new Error('Preset package and component versions disagree');
}
const upstream = read('upstream-standard.cordis.yml');
const persona = read('persona-prefix.md').trimEnd();
const marker = '# ── background jobs';
if (upstream.split(marker).length !== 2 || upstream.includes('name: dsh-tool-attachment-history')) {
  throw new Error('Unexpected pinned standard composition');
}
const extension = '# Local distribution extension: explicit historical image recall.\n'
  + '- id: tool-attachment-history\n  name: dsh-tool-attachment-history\n\n';
const standard = upstream.replace(marker, extension + marker);
const start = standard.indexOf('- id: persona\n');
const end = standard.indexOf('\n- id: agent-instructions', start);
if (start < 0 || end <= start) throw new Error('Pinned persona boundaries are missing');
const personaRow = '- id: persona\n  # Adapted for DSH by Kaizin0226; MIT and Apache-2.0. See SOURCE-PROVENANCE.md and NOTICE.\n  name: \'@deepseek-ai/dsh-persona\'\n  config:\n'
  + '    suffix: Your working directory is {{cwd}}.\n    prefix: |\n'
  + persona.split('\n').map(line => line ? '      ' + line : '').join('\n') + '\n';
let agent = standard.slice(0, start) + personaRow + standard.slice(end);
agent = agent.replace(marker, '- id: grok-work-state-context\n  name: dsh-grok-work-state-context\n\n' + marker);
write('standard.cordis.yml', standard);
write('agent.cordis.yml', agent);
const hash = text => createHash('sha256').update(text).digest('hex');
write('base-lock.json', JSON.stringify({ schemaVersion: 7, presetId: 'grok-optimized', presetVersion: metadata.version,
  upstream: { tag: components.dsh.upstreamTag, commit: components.dsh.upstreamCommit, standardSha256: hash(upstream) },
  distribution: { version: components.distribution.version, standardSha256: hash(standard), localExtensions: ['dsh-tool-attachment-history@1.2.0'] },
  presetOnlyExtensions: ['dsh-grok-work-state-context@1.2.0'],
  referenceLockSha256: hash(read('reference-lock.json')),
  personaSha256: hash(persona), payload: { 'agent.cordis.yml': hash(agent), 'preset.yml': hash(read('preset.yml')) },
}, null, 2) + '\n');
const names = ['agent.cordis.yml', 'preset.yml'];
const tree = createHash('sha256');
const files = names.map(name => {
  const bytes = readFileSync(resolve(root, name));
  tree.update(name).update(Buffer.from([0])).update(bytes).update(Buffer.from([0]));
  return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase() };
});
write('runtime-manifest.example.json', JSON.stringify({ schemaVersion: 1, presetId: 'grok-optimized', version: metadata.version,
  targetTemplate: '<DSH_DATA_DIR>/.agent-presets/grok-optimized', fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), treeSha256: tree.digest('hex').toUpperCase(), files,
}, null, 2) + '\n');
console.log('Derived Grok and local standard compositions from the pinned official standard.');
