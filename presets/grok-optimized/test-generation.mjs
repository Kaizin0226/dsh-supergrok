/** Offline persona-generation check against an explicitly selected DSH runtime. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [runtimeArg, baselineArg, outputArg] = process.argv.slice(2);
if (!runtimeArg || !baselineArg || !outputArg) {
  throw new Error('Usage: node test-generation.mjs <runtime-root> <baseline-preset> <test-output-directory>');
}
const runtime = resolve(runtimeArg);
const output = resolve(outputArg);
const requireRuntime = createRequire(join(runtime, 'package.json'));
const load = name => import(pathToFileURL(requireRuntime.resolve(name)).href);
const { Context } = await load('@deepseek-ai/cordis');
const { default: Loader } = await load('@deepseek-ai/cordis-plugin-loader');
const { default: Include } = await load('@deepseek-ai/cordis-plugin-include');
const { default: Group } = await load('@deepseek-ai/cordis-plugin-group');
const { default: Llm, createUserMessage } = await load('@deepseek-ai/dsh-llm');
const { default: Sessions, SessionId } = await load('@deepseek-ai/dsh-session');
const { default: Projections } = await load('@deepseek-ai/dsh-session-projection');
const { default: Prompts } = await load('@deepseek-ai/dsh-system-prompt');
const { default: Tools } = await load('@deepseek-ai/dsh-tools');
const { default: Agents, assembleContextFor } = await load('@deepseek-ai/dsh-agent');
const { default: Loop } = await load('@deepseek-ai/dsh-agent-loop');
const { default: Presets } = await load('@deepseek-ai/dsh-agent-presets');
const personaModuleUrl = pathToFileURL(requireRuntime.resolve('@deepseek-ai/dsh-persona')).href;

function personaRow(text) {
  text = text.replace(/\r\n?/g, '\n');
  const start = text.indexOf('- id: persona\n');
  const end = text.indexOf('\n- id: agent-instructions', start);
  assert.ok(start >= 0 && end > start);
  return text.slice(start, end).replace("name: '@deepseek-ai/dsh-persona'", `name: '${personaModuleUrl}'`);
}
const before = personaRow(await readFile(join(resolve(baselineArg), 'agent.cordis.yml'), 'utf8'));
const after = personaRow(await readFile(join(import.meta.dirname, 'agent.cordis.yml'), 'utf8'));
const marker = '使用完整、易懂的句子';
assert.ok(!before.includes(marker) && after.includes(marker));
await mkdir(output, { recursive: true });
const root = await mkdtemp(join(output, 'persona-generation-'));
await mkdir(join(root, 'grok-optimized'));
const composition = join(root, 'grok-optimized', 'agent.cordis.yml');
await writeFile(composition, before);

const ctx = new Context();
const fibers = [];
async function mount(plugin, config) {
  const fiber = await ctx.plugin(plugin, config);
  fibers.push(fiber);
}
ctx.baseUrl = pathToFileURL(runtime).href + '/';
await mount(Loader);
ctx.loader.builtins.include = Include;
ctx.loader.builtins.group = Group;
for (const plugin of [Llm, Sessions, Projections]) await mount(plugin);
await mount(Prompts, { personaPrefix: '' });
await mount(Tools);
await mount(Agents);
await mount(Loop, { agents: [] });
await mount(Presets, {
  default: 'grok-optimized', roots: [{ path: root, trust: 'user' }],
  includeShippedRoot: false, includeUserRoot: false,
});
const handles = new Set();
async function create(id, seed) {
  const handle = await ctx.agents.create({
    sessionId: SessionId(id), seed, meta: { agentPreset: 'grok-optimized' },
    agentOptions: { provider: 'synthetic', model: 'synthetic-no-network' },
    setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, 'grok-optimized'); },
  });
  handles.add(handle);
  return handle;
}
async function dispose(handle) { await handle.dispose(); handles.delete(handle); }
async function prompt(handle) {
  const assembled = await ctx.systemPrompt.assemble(assembleContextFor(handle.agent));
  return JSON.stringify(assembled.sections);
}
try {
  const liveOld = await create('synthetic-live-old');
  const savedOld = await create('synthetic-resume');
  savedOld.agent.session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [
    { type: 'text', text: 'Synthetic history retained across persona maintenance.' },
    { type: 'image', attachment: { attachmentId: 'synthetic-image', mediaType: 'image/png', bytes: 10, width: 64, height: 64 } },
  ] }), { surfaceOp: 'append' });
  savedOld.agent.session.append('user/message', createUserMessage({
    source: { kind: 'plugin', plugin: 'synthetic-image-preparation' },
    content: [{ type: 'text', text: 'Prepared only; model delivery not established.' }],
  }), { surfaceOp: 'append' });
  const seed = savedOld.agent.session.snapshotEvents();
  const originalMessages = savedOld.agent.session.deriveMessages();
  await dispose(savedOld);
  await writeFile(composition, after);
  const resumedNew = await create('synthetic-resume', seed);
  assert.ok(!(await prompt(liveOld)).includes(marker));
  assert.ok((await prompt(resumedNew)).includes(marker));
  assert.deepEqual(resumedNew.agent.session.deriveMessages(), originalMessages);
  console.log('PASS live-old composition remains unchanged; native cold replay uses 0.9.1');
  const child = await ctx.agents.create({
    sessionId: SessionId('synthetic-old-child'), parentAgent: liveOld.agent,
    setup: childCtx => { ctx.agentPresets.composeFrom(childCtx, liveOld.agent.ctx); },
  });
  handles.add(child);
  assert.ok(!(await prompt(child)).includes(marker));
  console.log('PASS a child joins its parent generation instead of the newly installed persona');
  await dispose(resumedNew);
  const reconstructed = await create('synthetic-resume', seed);
  assert.ok((await prompt(reconstructed)).includes(marker));
  await dispose(reconstructed);
  await writeFile(composition, before);
  const rolledBack = await create('synthetic-resume', seed);
  assert.ok(!(await prompt(rolledBack)).includes(marker));
  assert.deepEqual(rolledBack.agent.session.deriveMessages(), originalMessages);
  assert.deepEqual(seed.slice(0, originalMessages.length).map(event => event.data),
    rolledBack.agent.session.snapshotEvents().slice(0, originalMessages.length).map(event => event.data));
  console.log('PASS targeted reconstruction and rollback retain synthetic text, image and plugin history');
  console.log('LIMIT: persona-only native composition/replay; no production restart, persistence backend or model call');
} finally {
  for (const handle of handles) await handle.dispose();
  for (const fiber of fibers.reverse()) await fiber.dispose();
}
