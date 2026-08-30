import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLIENT_IDENTIFIER,
  CLIENT_VERSION,
  DEFAULT_MODEL,
  PROVIDER,
} from '../lib/constants.js';
import {
  assertFixedInvocation,
  buildProtocolHeaders,
  entitledModelFromCatalog,
  entitledModelsFromCatalog,
} from '../lib/protocol.js';

function reasoningModel(id, efforts = ['low', 'high'], overrides = {}) {
  return {
    model: id,
    name: id,
    supportedInApi: true,
    supportsReasoningEffort: true,
    reasoningEfforts: efforts,
    apiBackend: 'responses',
    ...overrides,
  };
}

test('protocol headers carry the exact safe selected model and truthful client identity', () => {
  const headers = buildProtocolHeaders({
    accessToken: 'a'.repeat(2048),
    model: 'grok-4.7-fast',
    requestId: 'req-1',
    sessionId: 'session-1',
    conversationId: 'conversation-1',
    operation: 'inference',
  });
  assert.equal(headers.authorization, `Bearer ${'a'.repeat(2048)}`);
  assert.equal(headers['x-xai-token-auth'], 'xai-grok-cli');
  assert.equal(headers['x-authenticateresponse'], 'authenticate-response');
  assert.equal(headers['x-grok-client-mode'], 'headless');
  assert.equal(headers['x-grok-client-identifier'], CLIENT_IDENTIFIER);
  assert.equal(headers['x-grok-client-version'], CLIENT_VERSION);
  assert.equal(headers['x-grok-model-override'], 'grok-4.7-fast');
  assert.equal(headers['x-grok-req-id'], 'req-1');
  assert.equal(headers['x-grok-session-id'], 'session-1');
  assert.equal(headers['x-grok-conv-id'], 'conversation-1');
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.accept, 'text/event-stream');
  assert.equal(
    headers['user-agent'],
    'deepseek-harness/0.1.1-rc.2 (+https://github.com/deepseek-ai/deepseek-harness)',
  );
  assert.equal(headers['x-grok-agent-id'], undefined);
});

test('protocol rejects unsafe dynamic ids, header injection, oversized tokens and caller headers', () => {
  const base = { accessToken: 'token', model: DEFAULT_MODEL };
  for (const model of ['xai/grok-4', 'grok-4/../../x', 'grok-UPPER', `grok-${'x'.repeat(129)}`]) {
    assert.throws(() => buildProtocolHeaders({ ...base, model }), /unsafe model id/);
  }
  assert.throws(() => buildProtocolHeaders({ ...base, accessToken: 'x\r\nX-Evil: yes' }), /access token/);
  assert.throws(() => buildProtocolHeaders({ ...base, accessToken: 'x'.repeat(8193) }), /access token/);
  assert.throws(() => buildProtocolHeaders({ ...base, requestId: 'x'.repeat(129) }), /request id/);
  assert.throws(() => buildProtocolHeaders({ ...base, extra: { 'x-userid': 'attacker' } }), /unknown protocol option/);
  assert.throws(() => buildProtocolHeaders({ ...base, authorization: 'other' }), /unknown protocol option/);
  assert.throws(() => buildProtocolHeaders({ ...base, operation: 'other' }), /unknown protocol operation/);
  assert.throws(() => assertFixedInvocation({ provider: 'xai', model: DEFAULT_MODEL }), /provider drift/);
  assert.throws(
    () => assertFixedInvocation({ provider: PROVIDER, model: DEFAULT_MODEL, reasoningEffort: 'high/evil' }),
    /unsafe reasoning effort/,
  );
  assert.deepEqual(
    assertFixedInvocation({ provider: PROVIDER, model: 'grok-4.7-fast', reasoningEffort: 'low' }),
    { model: 'grok-4.7-fast', reasoningEffort: 'low' },
  );
});

test('live catalog returns every exact eligible model with model-owned reasoning metadata', () => {
  const models = entitledModelsFromCatalog({ models: [
    reasoningModel(DEFAULT_MODEL, [
      { id: 'low', name: 'Low' },
      { value: 'high', name: 'High', description: 'Most reasoning' },
    ], { contextWindow: 500000, maxCompletionTokens: 128000 }),
    {
      id: 'grok-code-fast',
      name: 'Grok Code Fast',
      supportedInApi: true,
      supportsReasoningEffort: false,
      reasoningEfforts: [],
      apiBackend: 'chat_completions',
    },
    reasoningModel('grok-hidden', ['high'], { hidden: true }),
    reasoningModel('grok-not-api', ['high'], { supportedInApi: false }),
    reasoningModel('grok-unknown-backend', ['high'], { apiBackend: 'messages' }),
    reasoningModel('other-model', ['high']),
  ] });
  assert.deepEqual(models.map((model) => model.id), [DEFAULT_MODEL, 'grok-code-fast', 'grok-not-api']);
  assert.deepEqual(models[0].efforts.map((effort) => effort.id), ['low', 'high']);
  assert.equal(models[0].efforts[1].description, 'Most reasoning');
  assert.equal(models[0].defaultEffort, 'high');
  assert.equal(models[0].contextWindow, 500000);
  assert.equal(models[0].maxTokens, 128000);
  assert.equal(models[1].supportsReasoning, false);
  assert.deepEqual(models[1].efforts, []);
  assert.equal(entitledModelFromCatalog({ models: [reasoningModel(DEFAULT_MODEL)] })?.id, DEFAULT_MODEL);
});

test('official array, camelCase, _meta and object-map catalog shapes are supported', () => {
  const camel = entitledModelsFromCatalog({ data: [{
    modelId: 'grok-4.7',
    name: 'Grok 4.7 live',
    contextWindow: 500000,
    maxCompletionTokens: 128000,
    apiBackend: 'responses',
    supportedInApi: true,
    supportsReasoningEffort: true,
    reasoningEfforts: [{ value: 'low' }, { id: 'high' }],
    defaultReasoningEffort: 'low',
  }] });
  assert.equal(camel[0].defaultEffort, 'low');
  assert.equal(camel[0].contextWindow, 500000);

  const meta = entitledModelsFromCatalog({ models: [{
    _meta: {
      model: 'grok-meta',
      apiBackend: 'chat_completions',
      supportedInApi: true,
      supportsReasoningEffort: true,
      reasoningEfforts: [{ id: 'high' }],
    },
  }] });
  assert.equal(meta[0].apiBackend, 'chat');

  const mapped = entitledModelsFromCatalog({ models: {
    'grok-map': {
      name: 'Mapped model',
      supportedInApi: true,
      supportsReasoningEffort: true,
      reasoningEfforts: ['medium', 'high'],
    },
  } });
  assert.equal(mapped[0].id, 'grok-map');
  assert.equal(mapped[0].apiBackend, 'chat');
});

test('pinned official Grok Build catalog defaults are accepted without supportedInApi', () => {
  const models = entitledModelsFromCatalog({ data: [
    {
      id: 'grok-4.6', model: 'grok-4.6', name: 'Grok 4.6', context_window: 500000,
      api_backend: 'responses', supports_reasoning_effort: true, reasoning_effort: 'high',
      reasoning_efforts: [
        { value: 'xhigh', label: 'Extra High Effort' },
        { value: 'high', label: 'High Effort', default: true },
        { value: 'medium', label: 'Medium Effort' },
        { value: 'low', label: 'Low Effort' },
      ],
    },
    {
      id: 'grok-4.5', model: 'grok-4.5', name: 'Grok 4.5', context_window: 500000,
      api_backend: 'responses', supports_reasoning_effort: true, reasoning_effort: 'high',
      reasoning_efforts: [
        { value: 'high', label: 'High Effort', default: true },
        { value: 'medium', label: 'Medium Effort' },
        { value: 'low', label: 'Low Effort' },
      ],
    },
  ] });
  assert.deepEqual(models.map((model) => model.id), ['grok-4.6', 'grok-4.5']);
  assert.deepEqual(models[0].efforts.map((effort) => effort.id), ['xhigh', 'high', 'medium', 'low']);
  assert.equal(models[0].defaultEffort, 'high');
  assert.equal(models[1].defaultEffort, 'high');
});

test('selector effort id is distinct from its canonical wire value', () => {
  const [model] = entitledModelsFromCatalog({ data: [reasoningModel('grok-alias-effort', [
    { id: 'deep', value: 'xhigh', label: 'Deep' },
    { value: 'high', default: true },
  ], { reasoningEffort: 'high' })] });
  assert.deepEqual(model.efforts.map(({ id, wireValue }) => ({ id, wireValue })), [
    { id: 'deep', wireValue: 'xhigh' },
    { id: 'high', wireValue: 'high' },
  ]);
  assert.equal(model.defaultEffort, 'high');
});

test('OAuth catalog does not filter the API-key-only visibility flag and derives reasoning from options', () => {
  const models = entitledModelsFromCatalog({ data: [
    reasoningModel('grok-subscription-only', ['high'], { supportedInApi: false }),
    {
      model: 'grok-derived-reasoning', supportedInApi: false,
      reasoningEfforts: [{ value: 'high', default: true }], apiBackend: 'responses',
    },
    { model: 'grok-no-reasoning', apiBackend: 'responses' },
  ] });
  assert.deepEqual(models.map((model) => model.id), [
    'grok-subscription-only', 'grok-derived-reasoning', 'grok-no-reasoning',
  ]);
  assert.equal(models[1].supportsReasoning, true);
  assert.equal(models[2].supportsReasoning, false);
});

test('every security-critical catalog alias must agree after normalization', () => {
  const conflicts = [
    [reasoningModel('grok-one', ['high'], { info: { model: 'grok-two' } }), /model id aliases conflict/],
    [reasoningModel('grok-one', ['high'], { hidden: false, info: { hidden: true } }), /hidden aliases conflict/],
    [reasoningModel('grok-one', ['high'], { userSelectable: true, _meta: { user_selectable: false } }), /user-selectable aliases conflict/],
    [reasoningModel('grok-one', ['high'], { supportedInApi: true, info: { supported_in_api: false } }), /API-support aliases conflict/],
    [reasoningModel('grok-one', ['high'], { supportsReasoningEffort: true, _meta: { supports_reasoning_effort: false } }), /reasoning-support aliases conflict/],
    [reasoningModel('grok-one', ['low', 'high'], { info: { reasoning_efforts: ['high'] } }), /reasoning effort aliases conflict/],
    [reasoningModel('grok-one', ['low', 'high'], {
      defaultReasoningEffort: 'low', info: { default_reasoning_effort: 'high' },
    }), /default reasoning effort aliases conflict/],
    [reasoningModel('grok-one', ['high'], { apiBackend: 'responses', info: { api_backend: 'chat' } }), /API backend aliases conflict/],
  ];
  for (const [model, expected] of conflicts) {
    assert.throws(() => entitledModelsFromCatalog({ models: [model] }), expected);
  }
  assert.equal(entitledModelsFromCatalog({ models: {
    'grok-map-key': reasoningModel('grok-map-value'),
  } })[0].id, 'grok-map-value');
  assert.throws(() => entitledModelsFromCatalog({ models: [reasoningModel('grok-hidden-conflict', ['high'], {
    hidden: true, apiBackend: 'responses', info: { api_backend: 'chat' },
  })] }), /API backend aliases conflict/);
  const equivalentBackendAliases = reasoningModel('grok-compatible', ['high'], {
    apiBackend: 'chat', info: { api_backend: 'chat_completions' },
  });
  assert.equal(entitledModelsFromCatalog({ models: [equivalentBackendAliases] })[0].apiBackend, 'chat');
});

test('one reasoningEfforts default flag is supported and must agree with independent default', () => {
  const flagged = entitledModelsFromCatalog({ models: [reasoningModel('grok-flagged', [
    { id: 'low' },
    { id: 'high', default: true },
  ])] });
  assert.equal(flagged[0].defaultEffort, 'high');

  const same = entitledModelsFromCatalog({ models: [reasoningModel('grok-flagged-same', [
    { id: 'low' },
    { id: 'high', default: true },
  ], { defaultReasoningEffort: 'high' })] });
  assert.equal(same[0].defaultEffort, 'high');

  assert.throws(() => entitledModelsFromCatalog({ models: [reasoningModel('grok-multiple-flags', [
    { id: 'low', default: true },
    { id: 'high', default: true },
  ])] }), /multiple reasoning efforts are marked default/);
  assert.throws(() => entitledModelsFromCatalog({ models: [reasoningModel('grok-flag-conflict', [
    { id: 'low' },
    { id: 'high', default: true },
  ], { defaultReasoningEffort: 'low' })] }), /conflicts with effort default flag/);

  assert.throws(() => entitledModelsFromCatalog({ models: [reasoningModel('grok-explicit-false-independent', [
    { id: 'low' },
    { id: 'high', default: false },
  ], { defaultReasoningEffort: 'high' })] }), /conflicts with explicit false flag/);

  const staticFallbackDenied = entitledModelsFromCatalog({ models: [reasoningModel(DEFAULT_MODEL, [
    { id: 'low' },
    { id: 'high', default: false },
  ])] });
  assert.equal(staticFallbackDenied[0].defaultEffort, undefined);

  assert.throws(() => entitledModelsFromCatalog({ models: [reasoningModel('grok-explicit-flag-conflict', [
    { id: 'low', default: false },
    { id: 'high', default: true },
  ], { info: { reasoning_efforts: [
    { id: 'low', default: false },
    { id: 'high', default: false },
  ] } })] }), /reasoning effort default flags conflict/);

  const omittedFlag = entitledModelsFromCatalog({ models: [reasoningModel('grok-omitted-flag', [
    { id: 'low', default: false },
    { id: 'high', default: true },
  ], { info: { reasoning_efforts: [
    { id: 'low' },
    { id: 'high' },
  ] } })] });
  assert.equal(omittedFlag[0].defaultEffort, 'high');

  const matchingFlags = entitledModelsFromCatalog({ models: [reasoningModel('grok-matching-flags', [
    { id: 'low', default: false },
    { id: 'high', default: true },
  ], { info: { reasoning_efforts: [
    { id: 'low', default: false },
    { id: 'high', default: true },
  ] } })] });
  assert.equal(matchingFlags[0].defaultEffort, 'high');
});

test('catalog fails closed on duplicate, ambiguous, oversized or malformed entitlement', () => {
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-dup'), reasoningModel('grok-dup')] }),
    /duplicate catalog model/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-effort', ['high', 'high'])] }),
    /duplicate reasoning effort/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-default', ['low'], { defaultReasoningEffort: 'high' })] }),
    /default reasoning effort is not supported/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-empty', [])] }),
    /reasoning efforts are invalid/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [{
      id: 'grok-conflict', supportedInApi: true, supportsReasoningEffort: false,
      reasoningEfforts: ['high'], apiBackend: 'responses',
    }] }),
    /non-reasoning model declares reasoning efforts/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-bad/id')] }),
    /unsafe model id/,
  );
  assert.throws(
    () => entitledModelsFromCatalog({ models: [reasoningModel('grok-bad-context', ['high'], { contextWindow: -1 })] }),
    /context window is invalid/,
  );
  assert.throws(() => entitledModelsFromCatalog({ models: Array.from({ length: 257 }, (_, index) => (
    reasoningModel(`grok-${index}`)
  )) }), /model count exceeded/);
  assert.throws(() => entitledModelsFromCatalog({}), /no supported model collection/);
  assert.throws(() => entitledModelsFromCatalog({ models: { 'grok-bad': 'not-an-object' } }), /map values/);
});
