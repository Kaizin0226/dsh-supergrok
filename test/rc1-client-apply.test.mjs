import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('compiled client apply uses rc.1 remote.session and its direct RemoteResult, then unsubscribes', async () => {
  assert.equal(process.env.XAI_API_KEY === '', true, 'Use the credential-scrubbing test runner');
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let definition;
  const httpReads = [];
  const timers = new Set();
  const sandbox = vm.createContext({
    URL,
    window: { __ModuleLoader__: { load(value) { definition = value; } } },
    async fetch(path, options) {
      assert.ok(['/api/llm-grok-oauth/status', '/api/llm-grok-oauth/catalog-status'].includes(path));
      assert.equal(options.method, undefined, 'no OAuth mutations are allowed');
      httpReads.push(path);
      const body = path.endsWith('/catalog-status')
        ? { ok: true, catalog: { code: 'not_requested' } }
        : { ok: true, oauthStatus: 'signed-out' };
      return { ok: true, status: 200, async json() { return body; } };
    },
    setInterval(callback) { const token = { callback }; timers.add(token); return token; },
    clearInterval(token) { timers.delete(token); },
  });
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' });
  const client = definition.factory((id) => {
    if (id === 'react/jsx-runtime') return {};
    if (id === 'react') return { Fragment: Symbol('Fragment') };
    if (id === 'react-dom') return {};
    throw new Error(`unexpected browser import ${id}`);
  });
  assert.deepEqual(Array.from(client.inject), ['slots', 'locale', 'remote', 'remote.session', 'settingsScope']);
  const effects = [];
  const subscriptions = new Map();
  let slot;
  let scopeUnsubscribed = false;
  let calls = 0;
  let response = { ok: true, value: { groups: [
    { id: 'other', models: [{ id: 'not-grok' }] },
    { id: 'grok-oauth', models: [{ id: 'grok-fixture', name: 'Fixture', reasoning: {
      efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high',
    } }] },
  ], failures: [] } };
  const subscribe = (name, callback) => {
    subscriptions.set(name, callback);
    return () => subscriptions.delete(name);
  };
  // No connection.api and no ctx.get fallback: only rc.1's documented services exist.
  client.apply({
    effect(setup) { effects.push(setup()); },
    locale: { register() { return () => {}; } },
    settingsScope: { bind({ namespace }) {
      assert.equal(namespace, 'llm-grok-oauth');
      return {
        getSnapshot: () => ({ status: 'ready', writable: true, revision: 1, value: { modelsRefreshSeconds: 60 } }),
        subscribe: () => () => { scopeUnsubscribed = true; },
      };
    } },
    remote: { $on: subscribe, session: { async modelCatalog(...args) {
      assert.equal(args.length, 0);
      calls += 1;
      return response;
    } } },
    on: subscribe,
    slots: {
      inject(name, setup) { assert.equal(name, 'settings.action'); setup(); },
      register(entry) { slot = entry.inject(); return () => {}; },
    },
  });
  assert.ok(slot);
  await slot.loadDirectory();
  assert.equal(calls, 1);
  assert.equal(slot.hooks.grokCard.getSnapshot().directoryStatus, 'ready');
  assert.deepEqual(Array.from(slot.hooks.grokCard.getSnapshot().directoryModels, (model) => model.id), ['grok-fixture']);
  assert.equal(slot.hooks.grokCard.getSnapshot().directoryModels[0].defaultEffort, 'high');
  // Legacy nested envelopes must not accidentally appear successful.
  response = { result: response };
  await slot.loadDirectory();
  assert.equal(slot.hooks.grokCard.getSnapshot().directoryStatus, 'error');
  assert.equal(slot.hooks.grokCard.getSnapshot().directoryModels.length, 0);
  assert.ok(subscriptions.has('settings/document-updated'));
  for (const dispose of effects.reverse()) if (typeof dispose === 'function') dispose();
  assert.equal(subscriptions.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(scopeUnsubscribed, true);
  await slot.loadDirectory();
  assert.equal(calls, 2, 'disposed directory reader must not invoke the host');
  assert.ok(httpReads.includes('/api/llm-grok-oauth/status'));
});
