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
const metadata = JSON.parse(readFileSync(join(candidateRoot, 'package.json'), 'utf8'));
const referencesText = readFileSync(join(candidateRoot, 'reference-lock.json'), 'utf8');
const references = JSON.parse(referencesText);

assert.equal(lstatSync(candidateRoot).isSymbolicLink(), false, 'preset source must not be a symbolic link');
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.presetId, 'grok-optimized');
assert.equal(manifest.targetTemplate, '<DSH_DATA_DIR>/.agent-presets/grok-optimized');
assert.equal(components.preset.id, manifest.presetId);
assert.equal(components.preset.version, manifest.version);
assert.equal(metadata.version, manifest.version);
assert.equal(components.preset.designReferences, 'presets/grok-optimized/reference-lock.json');
assert.ok(metadata.files.includes('reference-lock.json'));
assert.ok(metadata.files.includes('RELEASE-NOTES.md'));
assert.equal(references.schemaVersion, 1);
assert.equal(references.repository + '.git', components.grokBuildProtocolReference.repository);
assert.equal(references.protocol.commit, components.grokBuildProtocolReference.commit);
assert.equal(references.protocol.packageVersion, components.grokBuildProtocolReference.packageVersion);
assert.equal(references.protocol.status, 'unchanged-protocol-reference');
assert.notEqual(references.behavior.commit, references.protocol.commit);
assert.equal(references.images.commit, references.behavior.commit);
for (const reference of [references.behavior, references.images]) {
  assert.match(reference.commit, /^[0-9a-f]{40}$/);
  assert.ok(reference.files.length > 0);
  assert.ok(reference.files.every(file => file.startsWith('crates/') && !file.includes('..')));
}

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
assert.match(preset, /继承标准工具和历史图片召回，增加工作状态恢复与任务纪律/);
assert.match(agent, /你是 DSH Agent，当前由 \{\{model\}\} 提供推理/);
assert.match(agent, /目标和权限边界明确后自主推进/);
assert.match(agent, /只调用真实可见且未禁用的工具/);
assert.match(agent, /完成前运行与风险相称的检查/);
assert.match(agent, /结论先行、沟通简洁/);
assert.match(agent, /实际使用本 preset 已提供且未禁用的 DSH 原生子 Agent/);
assert.match(agent, /使用完整、易懂的句子/);
assert.match(agent, /必要的新术语首次解释/);
assert.match(agent, /不用注释、忽略检查或无关占位代替解决问题/);
assert.match(agent, /历史记忆只作参考/);
assert.match(agent, /不因此自动搜索或写入记忆/);
assert.match(agent, /诊断负责查明原因，除非用户同时要求修复/);
assert.match(agent, /不得根据文件名、说明文字、历史印象或模型名称猜测/);
assert.match(agent, /无输出、等待超时或取消请求被接受，都不表示任务已经结束/);
assert.match(agent, /父会话必须复核子 Agent 的证据/);
assert.match(agent, /优先遵守用户指定的语言、格式和详细度/);
assert.doesNotMatch(agent, /^\s*complete\s*:/m, 'host governance must remain visible');

const personaEnd = agent.indexOf('\n- id: agent-instructions');
const personaStart = agent.indexOf('    prefix: |');
assert.notEqual(personaStart, -1, 'persona text is missing');
assert.notEqual(personaEnd, -1, 'persona boundary is missing');
const persona = agent.slice(personaStart, personaEnd);
assert.doesNotMatch(persona, /\bgrok-[A-Za-z0-9._-]+\b/i, 'persona must not bind a concrete model');
assert.doesNotMatch(persona, /\bxai\b|api\s*key|base\s*url|oauth|openrouter/i, 'persona must not configure a provider or authentication route');

const pinned = normalize(readFileSync(join(candidateRoot, 'upstream-standard.cordis.yml'), 'utf8'));
const standard = normalize(readFileSync(join(candidateRoot, 'standard.cordis.yml'), 'utf8'));
const lock = JSON.parse(readFileSync(join(candidateRoot, 'base-lock.json'), 'utf8'));
assert.equal(lock.upstream.tag, components.dsh.upstreamTag);
assert.equal(lock.upstream.commit, components.dsh.upstreamCommit);
assert.equal(lock.upstream.standardSha256, digest(Buffer.from(pinned)).toLowerCase());
assert.equal(lock.distribution.standardSha256, digest(Buffer.from(standard)).toLowerCase());
assert.equal(lock.presetVersion, manifest.version);
assert.equal(lock.referenceLockSha256, digest(Buffer.from(normalize(referencesText))).toLowerCase());
assert.match(agent, /suffix: Your working directory is \{\{cwd\}\}\./);
assert.match(standard, /name: dsh-tool-attachment-history/);
assert.doesNotMatch(standard, /name: dsh-grok-work-state-context/);
assert.match(agent, /name: dsh-grok-work-state-context/);
assert.equal(standard.replace('# Local distribution extension: explicit historical image recall.\n- id: tool-attachment-history\n  name: dsh-tool-attachment-history\n\n', ''), pinned,
  'local standard must retain the complete official composition');
function withoutPersona(composition) {
  const start = composition.indexOf('- id: persona\n');
  const end = composition.indexOf('\n- id: agent-instructions', start);
  assert.ok(start >= 0 && end > start);
  return composition.slice(0, start) + composition.slice(end);
}
const workStateRow = '- id: grok-work-state-context\n  name: dsh-grok-work-state-context\n\n';
assert.equal(agent.split(workStateRow).length, 2, 'work-state mounts exactly once');
assert.equal(withoutPersona(agent.replace(workStateRow, '')), withoutPersona(standard),
  'every non-persona capability must match local standard except the audited work-state row');
assert.equal(agent.split('name: dsh-tool-attachment-history').length, 2);
assert.equal(standard.split('name: dsh-tool-attachment-history').length, 2);

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
console.log('PASS full capability parity and separate design/protocol references');
console.log('PASS persona text contracts (not online model-behavior acceptance)');
