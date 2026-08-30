import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const clientPath = resolve('lib/client.js');
const clientSource = await readFile(clientPath, 'utf8');
const runnerSource = await readFile(resolve('test/run-tests.mjs'), 'utf8');

function loadClientTestContract() {
  let definition;
  const context = vm.createContext({
    URL,
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
    },
  });
  vm.runInContext(clientSource, context, { filename: clientPath });
  assert.ok(definition);
  const exports = definition.factory((id) => {
    if (id === 'react/jsx-runtime') return {};
    if (id === 'react') return { Fragment: Symbol('Fragment') };
    if (id === 'react-dom') return {};
    throw new Error(`unexpected client dependency: ${id}`);
  });
  return exports.__test;
}

const contract = loadClientTestContract();

function directoryResponse(groups) {
  return { result: { ok: true, value: { groups, failures: [] } } };
}

test('client directory keeps every SuperGrok model and its owned efforts in one exact provider group', () => {
  const models = contract.normalizeDirectoryResponse(directoryResponse([
    { id: 'other', name: 'Other', models: [{ id: 'not-grok', name: 'Ignore me' }] },
    {
      id: 'grok-oauth',
      name: 'SuperGrok (DSH OAuth)',
      models: [
        {
          id: 'grok-4.6',
          name: 'Grok 4.6',
          reasoning: {
            efforts: [
              { id: 'xhigh', name: 'XHigh' },
              { id: 'high', name: 'High' },
            ],
            defaultEffort: 'high',
          },
        },
        {
          id: 'grok-4.5',
          name: 'Grok 4.5',
          reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' },
        },
      ],
    },
  ]));
  assert.deepEqual(Array.from(models, (model) => model.id), ['grok-4.6', 'grok-4.5']);
  assert.deepEqual(Array.from(models[0].efforts, (effort) => effort.id), ['xhigh', 'high']);
  assert.equal(models[0].defaultEffort, 'high');
  assert.equal(models[1].defaultEffort, 'high');
});

test('client directory fails closed on missing, duplicate, or unsafe SuperGrok groups without echoing provider text', () => {
  const secret = 'provider-secret-must-not-surface';
  const cases = [
    { value: { result: { ok: false, error: { message: secret } } }, code: 'directory_unavailable' },
    { value: directoryResponse([]), code: 'directory_unavailable' },
    {
      value: directoryResponse([
        { id: 'grok-oauth', models: [] },
        { id: 'grok-oauth', models: [] },
      ]),
      code: 'directory_invalid',
    },
    {
      value: directoryResponse([{ id: 'grok-oauth', models: [{ id: 'grok-bad/id', name: secret }] }]),
      code: 'directory_invalid',
    },
    {
      value: directoryResponse([{ id: 'grok-oauth', models: [
        { id: 'grok-one', name: 'One' },
        { id: 'grok-one', name: 'Duplicate' },
      ] }]),
      code: 'directory_invalid',
    },
  ];
  for (const entry of cases) {
    assert.throws(
      () => contract.normalizeDirectoryResponse(entry.value),
      (error) => error.code === entry.code && !error.message.includes(secret),
    );
  }
});

test('stock Edit takeover matches only the exact SuperGrok provider action in Chinese or English', () => {
  assert.equal(contract.stockEditLabelMatches('编辑 SuperGrok（DSH OAuth） (grok-oauth)', '编辑'), true);
  assert.equal(contract.stockEditLabelMatches('Edit SuperGrok (DSH OAuth) (grok-oauth)', 'Edit'), true);
  assert.equal(contract.stockEditLabelMatches('Delete SuperGrok (DSH OAuth) (grok-oauth)', 'Delete'), false);
  assert.equal(contract.stockEditLabelMatches('Delete SuperGrok (DSH OAuth) (grok-oauth)', 'Edit'), false);
  assert.equal(contract.stockEditLabelMatches('管理 SuperGrok', '管理'), false);
  assert.equal(contract.stockEditLabelMatches('Edit xAI (xai)', 'Edit'), false);
});

test('settings invalidation accepts only the exact SuperGrok settings namespace', () => {
  assert.equal(contract.isOwnSettingsDocument('llm-grok-oauth'), true);
  assert.equal(contract.isOwnSettingsDocument('llm-xai'), false);
  assert.equal(contract.isOwnSettingsDocument('llm-grok-oauth-extra'), false);
  assert.equal(contract.isOwnSettingsDocument(undefined), false);
  assert.equal(contract.isOwnSettingsDocument({ namespace: 'llm-grok-oauth' }), false);
});

test('refresh interval parser accepts only bounded whole seconds', () => {
  assert.equal(contract.parseRefreshSeconds('10'), 10);
  assert.equal(contract.parseRefreshSeconds(300), 300);
  assert.equal(contract.parseRefreshSeconds('86400'), 86400);
  for (const value of ['', '9', '10.5', '-10', '86401', '1e3', 'secret']) {
    assert.equal(contract.parseRefreshSeconds(value), undefined);
  }
});

test('client displays the fixed hourly background refresh and keeps the 60-second setting fallback', () => {
  assert.match(clientSource, /const BACKGROUND_SYNC_SECONDS = 3600;/);
  assert.match(clientSource, /modelsRefreshSeconds: parseRefreshSeconds\(value\.modelsRefreshSeconds\) \?\? 60/);
});

test('refresh write uses the bound settings scope and re-reads the committed modelsRefreshSeconds', async () => {
  let seen;
  let snapshot = {
    status: 'ready',
    writable: true,
    revision: 17,
    value: { modelsRefreshSeconds: 30 },
  };
  const scope = {
    getSnapshot: () => snapshot,
    async set(field, value) {
      seen = { field, value };
      snapshot = {
        ...snapshot,
        revision: 18,
        value: { ...snapshot.value, [field]: value },
      };
    },
  };
  const result = await contract.writeModelsRefreshSeconds(scope, '45');
  assert.equal(result.ok, true);
  assert.equal(result.value, 45);
  assert.deepEqual(seen, { field: 'modelsRefreshSeconds', value: 45 });
  assert.equal(snapshot.revision, 18);
});

test('refresh write rejects invalid, read-only, transport, and read-back failures without raw error propagation', async () => {
  let calls = 0;
  const invalid = await contract.writeModelsRefreshSeconds(
    { getSnapshot: () => ({ status: 'ready', writable: true, revision: 1 }), set: async () => { calls += 1; } },
    'models',
  );
  const readOnly = await contract.writeModelsRefreshSeconds(
    { getSnapshot: () => ({ status: 'ready', writable: false, revision: 1 }), set: async () => { calls += 1; } },
    '30',
  );
  const failed = await contract.writeModelsRefreshSeconds(
    {
      getSnapshot: () => ({ status: 'ready', writable: true, revision: 1 }),
      async set() { calls += 1; throw new Error('secret transport body'); },
    },
    '30',
  );
  const mismatchScope = {
    getSnapshot: () => ({ status: 'ready', writable: true, revision: 9, value: { modelsRefreshSeconds: 30 } }),
    async set() { calls += 1; },
  };
  const mismatch = await contract.writeModelsRefreshSeconds(
    mismatchScope,
    '31',
  );
  let readBack = { status: 'ready', writable: true, revision: 10, value: { modelsRefreshSeconds: 30 } };
  const becameReadOnly = await contract.writeModelsRefreshSeconds({
    getSnapshot: () => readBack,
    async set() {
      calls += 1;
      readBack = { ...readBack, writable: false };
    },
  }, '32');
  assert.deepEqual(JSON.parse(JSON.stringify([invalid, readOnly, failed, mismatch, becameReadOnly])), [
    { ok: false, code: 'invalid' },
    { ok: false, code: 'read_only' },
    { ok: false, code: 'failed' },
    { ok: false, code: 'failed' },
    { ok: false, code: 'read_only' },
  ]);
  assert.equal(calls, 3);
});

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolvePromise = resolveValue;
    rejectPromise = rejectValue;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

test('directory loader merges in-flight refreshes and commits only the latest generation', async () => {
  const first = deferred();
  const second = deferred();
  const reads = [first, second];
  const events = [];
  const loader = contract.createDirectoryLoader({
    read: async () => reads.shift().promise,
    loading: () => events.push('loading'),
    ready: (value) => events.push(`ready:${value}`),
    error: () => events.push('error'),
    reset: () => events.push('reset'),
  });
  const original = loader.load();
  const merged = loader.load();
  const alsoMerged = loader.load();
  assert.strictEqual(merged, original);
  assert.strictEqual(alsoMerged, original);
  first.resolve('stale');
  await new Promise((resolveValue) => setImmediate(resolveValue));
  assert.deepEqual(events, ['loading', 'loading']);
  second.resolve('fresh');
  await original;
  assert.deepEqual(events, ['loading', 'loading', 'ready:fresh']);
});

test('directory loader reset and dispose prevent stale or late settlements from committing', async () => {
  const first = deferred();
  const second = deferred();
  const events = [];
  let reads = 0;
  const loader = contract.createDirectoryLoader({
    read: async () => (++reads === 1 ? first.promise : second.promise),
    loading: () => events.push('loading'),
    ready: (value) => events.push(`ready:${value}`),
    error: () => events.push('error'),
    reset: () => events.push('reset'),
  });
  const pending = loader.load();
  loader.reset();
  assert.strictEqual(loader.load(), pending);
  first.resolve('old-host');
  await new Promise((resolveValue) => setImmediate(resolveValue));
  loader.dispose();
  second.resolve('late-new-host');
  await pending;
  await loader.load();
  assert.deepEqual(events, ['loading', 'reset', 'loading']);
  assert.equal(reads, 2);
});

test('catalog diagnostics expose only allowlisted status metadata', () => {
  const normalized = contract.normalizeCatalogStatus({
    ok: true,
    oauthMessage: 'secret must be ignored',
    catalog: { code: 'ok', observedAt: 1234, acceptedCount: 2, providerBody: 'secret' },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), { code: 'ok', observedAt: 1234, acceptedCount: 2 });
  assert.throws(
    () => contract.normalizeCatalogStatus({ ok: true, catalog: { code: 'secret', observedAt: 1 } }),
    (error) => error.code === 'catalog_status_unavailable' && !error.message.includes('secret'),
  );
});

test('management response failures collapse secret bodies and URLs to fixed local codes', () => {
  const secret = 'secret-provider-body https://evil.example/token?value=secret';
  assert.throws(
    () => contract.acceptLocalJsonResponse({ ok: false, status: 500 }, { error: secret }, 'oauth_action_failed'),
    (error) => error.code === 'oauth_action_failed' && error.message === 'oauth_action_failed' && !error.message.includes(secret),
  );
  assert.throws(
    () => contract.acceptLocalJsonResponse({ ok: true, status: 200 }, secret, 'oauth_status_unavailable'),
    (error) => error.code === 'oauth_status_unavailable' && !error.message.includes(secret),
  );
});

test('management client is local-RPC/read-only for catalog and restores the stock Edit on disposal', () => {
  const scopeWrites = Array.from(clientSource.matchAll(/scope\.(?:set|unset)\(\s*["']([^"']+)/g), (match) => match[1]);
  const statusPollMarker = clientSource.indexOf('ui-llm-grok-oauth: status poll');
  const statusPoll = clientSource.slice(clientSource.lastIndexOf('ctx.effect(() => {', statusPollMarker), statusPollMarker);
  assert.match(clientSource, /api\.llm\.models\(\{\}\)/);
  assert.match(clientSource, /stockEdit\.style\.display = "none"/);
  assert.match(clientSource, /button\.style\.display = display/);
  assert.match(clientSource, /ctx\.remote\.\$on\("settings\/document-updated", refreshSettings\)/);
  assert.match(clientSource, /if \(isOwnSettingsDocument\(namespace\)\) refresh\(\)/);
  assert.match(clientSource, /ctx\.on\("connection\/reset", reset\)/);
  assert.deepEqual(scopeWrites, ['modelsRefreshSeconds']);
  assert.doesNotMatch(clientSource, /api\.settings\.mutate/);
  assert.doesNotMatch(clientSource, /body\.error|error\.message|HTTP \$\{response\.status\}/);
  assert.doesNotMatch(clientSource, /api\.sessions\.selectModel/);
  assert.doesNotMatch(clientSource, /\/responses|\/chat\/completions|api\.x\.ai/);
  assert.doesNotMatch(clientSource, /setInterval\s*\(\s*loadDirectory/);
  assert.doesNotMatch(statusPoll, /loadDirectory|directoryLoader|api\.llm\.models/);
  assert.match(runnerSource, /join\(testDirectory, 'client-ui\.test\.mjs'\)/);
});
