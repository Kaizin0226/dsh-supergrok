import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const candidateRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(candidateRoot, '..', '..');
const deploymentRoot = join(repositoryRoot, 'deployment', 'windows');
const manifest = JSON.parse(readFileSync(join(candidateRoot, 'runtime-manifest.example.json'), 'utf8'));
const components = JSON.parse(readFileSync(join(repositoryRoot, 'components.lock.json'), 'utf8'));

assert.equal(lstatSync(candidateRoot).isSymbolicLink(), false, 'preset source must not be a symbolic link');
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.presetId, 'grok-optimized');
assert.equal(manifest.targetTemplate, '<DSH_DATA_DIR>/.agent-presets/grok-optimized');
assert.equal(components.preset.id, manifest.presetId);
assert.equal(components.preset.version, manifest.version);

function normalize(text) {
  return text.replace(/\r\n?/g, '\n');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function treeDigest(root, names) {
  const hash = createHash('sha256');
  for (const name of [...names].sort()) {
    hash.update(name, 'utf8');
    hash.update(Buffer.from([0]));
    hash.update(readFileSync(join(root, name)));
    hash.update(Buffer.from([0]));
  }
  return hash.digest('hex').toUpperCase();
}

const preset = normalize(readFileSync(join(candidateRoot, 'preset.yml'), 'utf8'));
const agent = normalize(readFileSync(join(candidateRoot, 'agent.cordis.yml'), 'utf8'));
assert.match(preset, /^name: DSH · Grok 优化模式$/m);
assert.match(preset, /仅优化自主推进、真实工具、验证闭环和简洁沟通行为/);
assert.match(agent, /你是 DSH Agent，当前由 \{\{model\}\} 提供推理/);
assert.match(agent, /目标和权限边界明确后自主推进/);
assert.match(agent, /只使用当前工具目录中真实存在的工具/);
assert.match(agent, /完成前运行与风险相称的检查/);
assert.match(agent, /结论先行，沟通简洁/);
assert.match(agent, /只使用本 preset 已提供且未禁用的 DSH 原生子 Agent/);
assert.doesNotMatch(agent, /^\s*complete\s*:/m, 'host governance must remain visible');

const personaEnd = agent.indexOf('\n- id: agent-instructions');
const personaStart = agent.indexOf('    text: |');
assert.notEqual(personaStart, -1, 'persona text is missing');
assert.notEqual(personaEnd, -1, 'persona boundary is missing');
const persona = agent.slice(personaStart, personaEnd);
assert.doesNotMatch(persona, /\bgrok-[A-Za-z0-9._-]+\b/i, 'persona must not bind a concrete model');
assert.doesNotMatch(persona, /\bxai\b|api\s*key|base\s*url|oauth|openrouter/i, 'persona must not configure a provider or authentication route');

for (const externalId of ['tool-subagent-codex', 'tool-subagent-claude-code']) {
  const start = agent.indexOf(`- id: ${externalId}`);
  assert.notEqual(start, -1, `${externalId} must remain represented for standard parity`);
  const end = agent.indexOf('\n    - id:', start + 1);
  assert.match(agent.slice(start, end === -1 ? undefined : end), /\n\s+disabled: true\n/);
}
assert.match(agent, /provider: spawn\n\s+toolName: subagent\n/);
assert.match(agent, /provider: fork\n\s+toolName: subagent_fork\n/);

let totalBytes = 0;
for (const entry of manifest.files) {
  const bytes = readFileSync(join(candidateRoot, entry.name));
  totalBytes += bytes.length;
  assert.equal(bytes.length, entry.bytes, `${entry.name}: byte length drifted`);
  assert.equal(digest(bytes), entry.sha256, `${entry.name}: source hash drifted`);
}
assert.equal(totalBytes, manifest.totalBytes);
assert.equal(treeDigest(candidateRoot, manifest.files.map((entry) => entry.name)), manifest.treeSha256);

for (const name of ['Install-GrokOptimizedPreset.ps1', 'Rollback-GrokOptimizedPreset.ps1']) {
  const script = normalize(readFileSync(join(deploymentRoot, name), 'utf8'));
  assert.match(script, /\[switch\]\$Apply/);
  assert.match(script, /\$CandidateRoot/);
  assert.match(script, /\$PresetParent/);
  assert.match(script, /\$BackupRoot/);
  assert.doesNotMatch(script, /\b[A-Za-z]:\\/, 'deployment source must contain no real absolute path');
  assert.doesNotMatch(script, /settings\.ya?ml/i, 'deployment must not edit DSH settings');
  assert.doesNotMatch(script, /(?:Start|Stop|Restart)-Process/i, 'deployment must not control processes');
  assert.doesNotMatch(script, /Remove-Item/i, 'deployment must use recoverable moves');
}

console.log('PASS portable Grok preset source and manifest');
console.log('PASS model/provider/auth-independent persona');
console.log('PASS disabled external delegation and preserved native subagents');
console.log('PASS parameterized dry-run deployment boundaries');
