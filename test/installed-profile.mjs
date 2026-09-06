import assert from 'node:assert/strict';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';
import tls from 'node:tls';
import childProcess from 'node:child_process';
import http from 'node:http';

const profile = process.argv[2];
assert.ok(['web', 'headless'].includes(profile));
assert.ok(process.argv[3] && process.argv[4], 'Explicit isolated home and runtime required');
const home = resolve(process.argv[3]);
const runtime = resolve(process.argv[4]);
process.env.DSH_HOME = home;
process.env.DSH_TELEMETRY_DISABLED = '1';
process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
for (const key of Object.keys(process.env)) if (/API_KEY|TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete process.env[key];
process.env.XAI_API_KEY = '';
process.chdir(home);
const blocked = [];
const nativeConnect = net.Socket.prototype.connect;
const originalLog = console.log.bind(console);
console.log = (...args) => originalLog(...args.map(value => typeof value === 'string' ? value.replace(/([?&]token=)[^\s&]+/g, '$1<ephemeral-redacted>') : value));
const forbid = name => () => { blocked.push(name); throw Error(`Offline profile forbids ${name}`); };
globalThis.fetch = forbid('fetch');
net.Socket.prototype.connect = forbid('socket connect');
tls.connect = forbid('tls connect');
for (const name of ['spawn','exec','execFile','fork','spawnSync','execSync','execFileSync']) childProcess[name] = forbid(`child ${name}`);
syncBuiltinESMExports();
const installAnchor = realpathSync(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'));
const req = createRequire(installAnchor);
const imp = name => import(pathToFileURL(req.resolve(name)).href);
const presetLock = JSON.parse(readFileSync(resolve(home, '.agent-presets/grok-optimized/base-lock.json'), 'utf8'));
const standard = readFileSync(resolve(runtime, 'node_modules/@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml'));
assert.equal(createHash('sha256').update(standard).digest('hex'), presetLock.distribution.standardSha256);
const [{boot, loadProfile, loadLayeredEnv}, {provideCmdline}, {LlmAdapter}] = await Promise.all([
  imp('@deepseek-ai/dsh-app-boot'), imp('@deepseek-ai/dsh-cmdline'), imp('@deepseek-ai/dsh-llm'),
]);
let inferenceCount = 0;
class FixtureAdapter extends LlmAdapter {
  async resolveModel(provider, id) { return { provider, id, name: id, inputModalities: ['text','image'] }; }
  async *stream() {
    inferenceCount++;
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text: 'OFFLINE_PROFILE_OK' };
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'OFFLINE_PROFILE_OK' } };
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}
const loaded = loadProfile('offline-profile', profile, installAnchor, home);
const configPath = resolve(home, 'profiles', profile, 'cordis.yml');

const patches = [
  ...loaded.layers.flatMap(layer => layer.patches),
  { id: 'session-telemetry-otel', disabled: true },
  { id: 'session-title-llm', disabled: true },
  { id: 'agent-default-model', config: { provider: 'offline-fixture', model: 'synthetic' } },
];
const environment = loadLayeredEnv('offline-profile', home);
let resolveExit;
const exited = new Promise(resolve => { resolveExit = resolve; });
let ctx;
try {
  ctx = await boot('offline-profile', configPath, patches, host => {
    host.provide('dshLaunchEnvironment', environment);
    provideCmdline(host, { args: profile === 'web' ? ['--host','127.0.0.1','--port','0','--no-open'] : ['offline fixture only'], exit: resolveExit });
    host.inject(['llm'], scoped => { scoped.llm.registerAdapter(['offline-fixture'], new FixtureAdapter()); });
  });
  assert.ok(ctx.get('agentLoop'));
  assert.ok(ctx.get('llm'));
  const providerLoaded = ctx.llm.listProviders().some(p => p.id === 'grok-oauth');
  assert.equal(providerLoaded, true);
  if (profile === 'headless') assert.equal(await exited, 0);
  const presetChecks = [];
  const httpChecks = [];
  if (profile === 'web') {
    const server = ctx.webServer.server;
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    // Only this fixture-owned loopback listener is allowed through the guard.
    for (const encoding of ['gzip, deflate, br', 'identity']) {
      const status = await new Promise((resolveStatus, reject) => {
        const request = http.get({ host:'127.0.0.1', port:address.port, path:'/', headers:{'accept-encoding':encoding},
          agent:Object.assign(new http.Agent({keepAlive:false}), {createConnection: (_options, callback) => {
            const socket = new net.Socket(); nativeConnect.call(socket,{host:'127.0.0.1',port:address.port},callback);return socket;
          }}),
        }, response => { response.resume();response.on('end',()=>resolveStatus(response.statusCode)); });
        request.on('error',reject); request.setTimeout(5000,()=>request.destroy(Error('Local HTTP timeout')));
      });
      assert.ok(status >= 200 && status < 500);
      httpChecks.push({encoding,status});
    }
    const { assembleContextFor } = await imp('@deepseek-ai/dsh-agent');
    const { SessionId } = await imp('@deepseek-ai/dsh-session');
    for (const preset of ['standard', 'grok-optimized']) {
      const { agent } = await ctx.agents.create({
        sessionId: SessionId(`offline-${preset}-${Date.now()}`),
        meta: { cwd: home, agentPreset: preset },
        agentOptions: { provider: 'offline-fixture', model: 'synthetic' },
        setup: async scope => { await ctx.agentPresets.mount(scope, preset); },
      });
      const schemas = ctx.tools.schemas(agent);
      assert.equal(schemas.filter(schema => schema.name === 'recall_image_attachment').length, 1, preset);
      agent.session.append('todo/write', { todos: [{ content: 'offline-state-fixture', status: 'pending' }] });
      const prompt = await ctx.systemPrompt.assemble(assembleContextFor(agent));
      const workStateCount = prompt.contexts.filter(item => item.name === 'grok-optimized:work-state').length;
      assert.equal(workStateCount, preset === 'grok-optimized' ? 1 : 0);
      presetChecks.push({ preset, recallCount: 1, workStateCount, toolNames: schemas.map(schema => schema.name) });
    }
    assert.equal(ctx.agentPresets.defaultId, 'standard');
  }
  assert.deepEqual(blocked, []);
  const result = { profile, providerLoaded, startupPassed: true, inferenceCount, realModelRequests: 0, presetChecks, httpChecks, blocked };

  console.log(JSON.stringify(result));
} finally { await ctx?.fiber.dispose(); }
