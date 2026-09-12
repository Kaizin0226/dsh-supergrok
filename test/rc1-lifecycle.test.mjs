import assert from 'node:assert/strict';
import test from 'node:test';
import { Context, Service } from '@deepseek-ai/cordis';
import LlmRuntime from '@deepseek-ai/dsh-llm';
import { CredentialProvider } from '@deepseek-ai/dsh-credentials';
import { SettingsProvider } from '@deepseek-ai/dsh-settings';

// Exercise the installed 0.1.5-rc.2 service implementations, not legacy API mocks.
// Only storage and the web route sink are replaced; neither can touch disk or bind a port.
class MemorySettings extends SettingsProvider {
  constructor(ctx, options) { super(ctx); this.doc = structuredClone(options?.doc ?? {}); }
  get writable() { return true; }
  async load() { return structuredClone(this.doc); }
  async persist(ns, section) { this.doc[ns] = structuredClone(section); }
}

class EmptyCredentials extends CredentialProvider {
  constructor(ctx) { super(ctx); this.reads = 0; }
  async readRecord() { this.reads += 1; return undefined; }
  async modifyRecord() { throw new Error('credential mutation is forbidden in this test'); }
  async deleteRecord() { throw new Error('credential mutation is forbidden in this test'); }
}

class CapturingLlm extends LlmRuntime {
  registerAdapter(providers, adapter) {
    this.capturedAdapter = adapter;
    return super.registerAdapter(providers, adapter);
  }
}

class RouteSink extends Service {
  constructor(ctx) { super(ctx, 'webServer'); this.routes = new Map(); }
  register(route) {
    assert.ok(!this.routes.has(route.path), `duplicate route ${route.path}`);
    this.routes.set(route.path, route);
    return () => this.routes.delete(route.path);
  }
}

async function settleUntil(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), 'Cordis lifecycle did not settle');
}

test('real 0.1.5-rc.2 apply survives optional settings attach/change/detach/re-attach and disposes owned resources', async (t) => {
  assert.equal(process.env.XAI_API_KEY === '', true, 'Use the credential-scrubbing test runner');
  const previousAcceptance = process.env.DSH_SUPERGROK_ACCEPTANCE;
  process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
  t.after(() => {
    if (previousAcceptance === undefined) delete process.env.DSH_SUPERGROK_ACCEPTANCE;
    else process.env.DSH_SUPERGROK_ACCEPTANCE = previousAcceptance;
  });
  const entry = await import('../lib/index.js');
  assert.deepEqual(entry.inject, ['llm', 'credentials']);
  const ctx = new Context();
  const fibers = [];
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose(); });
  for (const service of [CapturingLlm, EmptyCredentials, RouteSink]) {
    const fiber = ctx.plugin(service);
    fibers.push(fiber);
    await fiber;
  }
  const consumer = ctx.plugin(entry, { proxyUrl: 'http://127.0.0.1:7897', modelsRefreshSeconds: 45 });
  fibers.push(consumer);
  await consumer;
  await settleUntil(() => ctx.llm.capturedAdapter !== undefined && ctx.webServer.routes.size === 6);
  const adapter = ctx.llm.capturedAdapter;
  assert.equal(adapter.settings().modelsRefreshSeconds, 45);
  assert.deepEqual(ctx.llm.listProviders().map((provider) => provider.id), ['grok-oauth']);
  assert.equal(ctx.llm.listConfigurableProviders()[0].settingsNs, 'llm-grok-oauth');

  const firstSettings = ctx.plugin(MemorySettings, { doc: { 'llm-grok-oauth': { modelsRefreshSeconds: 60 } } });
  fibers.push(firstSettings);
  await firstSettings;
  await settleUntil(() => adapter.settings().modelsRefreshSeconds === 60);
  await ctx.settings.update('llm-grok-oauth', { modelsRefreshSeconds: 120 });
  assert.equal(adapter.settings().modelsRefreshSeconds, 120);
  await firstSettings.dispose();
  await settleUntil(() => adapter.settings().modelsRefreshSeconds === 45);
  assert.deepEqual(ctx.llm.listProviders().map((provider) => provider.id), ['grok-oauth']);

  const nextSettings = ctx.plugin(MemorySettings, { doc: { 'llm-grok-oauth': { modelsRefreshSeconds: 90 } } });
  fibers.push(nextSettings);
  await nextSettings;
  await settleUntil(() => adapter.settings().modelsRefreshSeconds === 90);
  assert.equal(ctx.settings.describe().length, 1);
  await consumer.dispose();
  await settleUntil(() => ctx.settings.describe().length === 0 && ctx.webServer.routes.size === 0);
  assert.deepEqual(ctx.llm.listProviders(), []);
  assert.deepEqual(ctx.llm.listConfigurableProviders(), []);
  assert.ok(ctx.credentials.reads >= 1, 'hydration should read only the in-memory empty credential provider');
  assert.equal(adapter.catalogStatus().code, 'not_requested');
});
