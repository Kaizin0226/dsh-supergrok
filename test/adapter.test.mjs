import assert from 'node:assert/strict';
import test from 'node:test';
import { GrokAdapter } from '../lib/adapter.js';

function settings(overrides = {}) {
  return () => ({
    modelsRefreshSeconds: 300,
    defaultContextWindow: 131072,
    streamIdleTimeoutMs: 1000,
    requestTimeoutMs: 1000,
    maxRequestBodyBytes: 40000000,
    ...overrides,
  });
}

function entitled(id = 'grok-live-current', efforts = ['high'], overrides = {}) {
  return {
    id, name: id, apiBackend: 'chat', supportsReasoning: true,
    efforts: efforts.map((effort) => ({ id: effort, name: `${effort} effort` })),
    defaultEffort: efforts.includes('high') ? 'high' : efforts[0], contextWindow: 131072,
    inputModalities: ['text'],
    capabilityProvenance: 'grok-oauth-live-catalog/v1:explicit-modalities',
    ...overrides,
  };
}

function generateOptions(signal = new AbortController().signal, overrides = {}) {
  return {
    model: 'grok-live-current',
    reasoningEffort: 'high',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    signal,
    ...overrides,
  };
}

function seedCatalog(adapter, models = [entitled()]) {
  adapter.catalogCache = {
    at: Date.now(), live: true, models: Object.freeze(models), fingerprint: 'test-fixture',
    catalogRevision: `sha256:${'0'.repeat(64)}`,
  };
}

test('final UTF-8 request budget includes complete serialized messages and rejects before token or POST', async () => {
  const payloads = [];
  let tokens = 0;
  let budget = 40000000;
  const adapter = new GrokAdapter(() => settings({ maxRequestBodyBytes: budget })(), {
    async getAccessToken() { tokens++; return 'fixture-only'; },
  }, undefined, { fetch: async (_url, init, purpose) => {
    if (purpose === 'catalog') return liveCatalog([catalogModel('grok-live-current')]);
    payloads.push(init.body); return successResponse();
  } });
  seedCatalog(adapter);
  const options = generateOptions(undefined, {
    system: '中文系统说明',
    messages: [{ role: 'user', content: [{ type: 'text', text: '中文消息' }] }],
    tools: [{ name: 'fixture', description: '工具说明', parameters: { type: 'object', properties: {} } }],
  });
  await drain(adapter.stream(options));
  const exact = Buffer.byteLength(payloads[0], 'utf8');
  assert.ok(exact > payloads[0].length);
  budget = exact;
  await drain(adapter.stream(options));
  budget = exact - 1;
  await assert.rejects(drain(adapter.stream(options)), { code: 'REQUEST_BODY_TOO_LARGE' });
  assert.equal(payloads.length, 2);
  assert.equal(tokens, 5); // Three catalog authentications, only two inference authentications.
});

test('prepared image notices remain separate from wire input and reuse bytes only for unchanged occurrences', async () => {
  const ref = { attachmentId: 'sha256:fixture', mediaType: 'image/png', width: 4000, height: 1000, bytes: 12345 };
  let reads = 0;
  let posts = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'fixture'; } }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]);
      posts++; return successResponse();
    },
    resolveAttachments: () => ({ async readImageRequest() {
      reads++;
      return { attachment: ref, variantId: 'sha256:variant', data: new Uint8Array([1, 2, 3]), bytes: 3,
        mediaType: 'image/jpeg', width: 2000, height: 500, depth: 'uchar', space: 'srgb' };
    } }),
  });
  seedCatalog(adapter, [entitled(undefined, undefined, { inputModalities: ['text', 'image'] })]);
  const options = generateOptions(undefined, { provider: 'grok-oauth', messages: [{ role: 'user', content: [
    { type: 'image', attachment: ref }, { type: 'image', attachment: ref },
  ] }] });
  const call = await adapter.prepareCall('grok-oauth', options.model);
  const notices = await call.prepareInput(options);
  assert.equal(reads, 1);
  assert.equal(posts, 0);
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /4000×1000.*2000×500/);
  assert.match(notices[0].summary, /尚未确认模型接收/);
  assert.doesNotMatch(JSON.stringify(notices), /base64|AQID|[A-Z]:\\/);
  await drain(call.stream(options));
  assert.equal(reads, 1);
  const drift = await adapter.prepareCall('grok-oauth', options.model);
  await drift.prepareInput(options);
  await assert.rejects(drain(drift.stream({ ...options, messages: [] })), { code: 'INVALID_PREPARED_CALL' });
  assert.equal(posts, 1);
});

for (const backend of ['chat_completions', 'responses']) test(`${backend}: budget counts repeated base64 occurrences and preparation cancellation sends no inference`, async () => {
  const ref = { attachmentId: 'sha256:budget-fixture', mediaType: 'image/png', width: 32, height: 32, bytes: 9 };
  const controller = new AbortController();
  let budget = 40000000, reads = 0, cancelled = false;
  const payloads = [];
  const adapter = new GrokAdapter(() => settings({ maxRequestBodyBytes: budget })(), {
    async getAccessToken() { return 'fixture'; },
  }, undefined, {
    fetch: async (_url, init, purpose) => {
      if (purpose === 'catalog') return liveCatalog([catalogModel('grok-live-current', ['high'], {
        apiBackend: backend, inputModalities: ['text', 'image'],
      })]);
      payloads.push(init.body);
      return backend === 'responses' ? responsesSuccessResponse() : successResponse();
    },
    resolveAttachments: () => ({ async readImageRequest() {
      reads++;
      if (cancelled) controller.abort();
      return { attachment: ref, variantId: 'sha256:unchanged', data: new Uint8Array(9), bytes: 9,
        mediaType: 'image/png', width: 32, height: 32, depth: 'uchar', space: 'srgb' };
    } }),
  });
  const options = generateOptions(controller.signal, { messages: [{ role: 'user', content: [
    { type: 'text', text: '两次同图' }, { type: 'image', attachment: ref }, { type: 'image', attachment: ref },
  ] }] });
  const first = await adapter.prepareCall('grok-oauth', options.model);
  assert.deepEqual(await first.prepareInput(options), []);
  await drain(first.stream(options));
  assert.equal(reads, 1);
  assert.equal(payloads[0].split('data:image/png;base64,').length - 1, 2);
  budget = Buffer.byteLength(payloads[0], 'utf8') - 1;
  const tooBig = await adapter.prepareCall('grok-oauth', options.model);
  await tooBig.prepareInput(options);
  await assert.rejects(drain(tooBig.stream(options)), { code: 'REQUEST_BODY_TOO_LARGE' });
  assert.equal(payloads.length, 1);
  cancelled = true;
  const aborted = await adapter.prepareCall('grok-oauth', options.model);
  await assert.rejects(aborted.prepareInput(options), { name: 'AbortError' });
  await assert.rejects(drain(aborted.stream(options)), { name: 'AbortError' });
  assert.equal(payloads.length, 1);
});

function successResponse() {
  const event = JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] });
  return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function responsesSuccessResponse() {
  const events = [
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'ok' },
    { type: 'response.output_text.done', output_index: 0, content_index: 0, text: 'ok' },
    { type: 'response.completed', response: { usage: { input_tokens: 1, output_tokens: 1 } } },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function drain(iterable) {
  const out = [];
  for await (const chunk of iterable) out.push(chunk);
  return out;
}

function catalogSuccess() {
  return new Response(JSON.stringify({ models: [{
    model: 'grok-live-current',
    supportedInApi: true,
    supportsReasoningEffort: true,
    reasoningEfforts: ['high'],
    apiBackend: 'chat_completions',
  }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function liveCatalog(models) {
  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function catalogModel(id, efforts = ['high'], overrides = {}) {
  return {
    model: id,
    name: id,
    supportedInApi: true,
    supportsReasoningEffort: true,
    reasoningEfforts: efforts,
    apiBackend: 'chat_completions',
    ...overrides,
  };
}

test('catalog 401 refreshes and replays the same path once with stable affinity', async () => {
  const tokenArguments = [];
  const calls = [];
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken(rejected) {
      tokenArguments.push(rejected);
      return rejected === undefined ? 'old' : 'new';
    },
  }, undefined, {
    fetch: async (_url, init) => {
      calls.push(init.headers);
      return calls.length === 1 ? new Response('{}', { status: 401 }) : catalogSuccess();
    },
  });
  const models = await adapter.listModels('grok-oauth');
  assert.equal(models.length, 1);
  assert.deepEqual(tokenArguments, [undefined, 'old']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]['x-grok-session-id'], calls[1]['x-grok-session-id']);
  assert.equal(calls[0]['x-grok-conv-id'], calls[1]['x-grok-conv-id']);
  assert.notEqual(calls[0]['x-grok-req-id'], calls[1]['x-grok-req-id']);
  assert.equal(calls[0]['x-grok-model-override'], undefined);
  assert.equal(calls[1]['x-grok-model-override'], undefined);
});

test('catalog never performs a second 401 replay and acceptance mode performs zero', async () => {
  for (const acceptance of [false, true]) {
    if (acceptance) process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
    let calls = 0;
    const tokenArguments = [];
    const adapter = new GrokAdapter(settings(), {
      async getAccessToken(rejected) {
        tokenArguments.push(rejected);
        return rejected === undefined ? 'old' : 'new';
      },
    }, undefined, {
      fetch: async () => {
        calls += 1;
        return new Response('{}', { status: 401 });
      },
    });
    assert.deepEqual(await adapter.listModels('grok-oauth'), []);
    assert.equal(calls, acceptance ? 1 : 2);
    assert.deepEqual(tokenArguments, acceptance ? [undefined] : [undefined, 'old']);
    delete process.env.DSH_SUPERGROK_ACCEPTANCE;
  }
});

test('catalog shares one 401 replay budget across models and models-v2 paths', async () => {
  const tokenArguments = [];
  const responses = [
    new Response('{}', { status: 401 }),
    new Response('{}', { status: 404 }),
    new Response('{}', { status: 401 }),
  ];
  let calls = 0;
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken(rejected) {
      tokenArguments.push(rejected);
      return rejected === undefined ? 'old' : 'new';
    },
  }, undefined, {
    fetch: async () => {
      calls += 1;
      return responses.shift();
    },
  });
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  assert.equal(calls, 3);
  assert.deepEqual(tokenArguments, [undefined, 'old']);
});

test('dynamic catalog lists all models and resolves exact model-owned efforts', async () => {
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken() { return 'access'; },
  }, undefined, {
    fetch: async () => liveCatalog([
      catalogModel('grok-live-current', ['low', 'high']),
      catalogModel('grok-live-next', ['minimal', 'low'], {
        defaultReasoningEffort: 'low', contextWindow: 262144, maxCompletionTokens: 32768,
        inputModalities: ['text', 'image'],
      }),
      {
        model: 'grok-code', name: 'Grok Code', supportedInApi: true,
        supportsReasoningEffort: false, reasoningEfforts: [], apiBackend: 'responses',
      },
    ]),
  });
  const listed = await adapter.listModels('grok-oauth');
  assert.deepEqual(listed.map((model) => model.id), ['grok-live-current', 'grok-live-next', 'grok-code']);
  const resolved = await adapter.resolveModel('grok-oauth', 'grok-live-next');
  assert.deepEqual(resolved.reasoning.efforts.map((effort) => effort.id), ['minimal', 'low']);
  assert.equal(resolved.reasoning.defaultEffort, 'low');
  assert.equal(resolved.context.contextWindow, 262144);
  assert.equal(resolved.defaultMaxTokens, 32768);
  assert.deepEqual(listed[1].inputModalities, ['text', 'image']);
  assert.deepEqual(resolved.inputModalities, ['text', 'image']);
  assert.equal(resolved.backend, 'chat');
  assert.equal(resolved.capabilityProvenance, 'grok-oauth-live-catalog/v1:explicit-modalities');
  assert.match(resolved.catalogRevision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(listed[1].backend, resolved.backend);
  assert.equal(listed[1].capabilityProvenance, resolved.capabilityProvenance);
  assert.equal(listed[1].catalogRevision, resolved.catalogRevision);
  const noReasoning = await adapter.resolveModel('grok-oauth', 'grok-code');
  assert.equal(noReasoning.reasoning, undefined);
});

test('prepared DSH turn freezes one live catalog revision across both tool-loop inference legs', async () => {
  let catalogCalls = 0;
  let inferenceCalls = 0;
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken() { return 'access'; },
  }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        catalogCalls += 1;
        return liveCatalog([catalogModel('grok-live-current', ['high'], {
          inputModalities: ['text'],
          contextWindow: catalogCalls === 1 ? 131072 : 262144,
        })]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  const dispatchContext = { sessionId: 'session-turn-freeze', turn: 7 };
  const first = await adapter.prepareCall('grok-oauth', 'grok-live-current', undefined, dispatchContext);
  const revision = first.model.catalogRevision;
  await drain(first.stream(generateOptions(undefined, {
    provider: 'grok-oauth', sessionId: dispatchContext.sessionId, turn: dispatchContext.turn,
  })));
  const second = await adapter.prepareCall('grok-oauth', 'grok-live-current', undefined, dispatchContext);
  assert.equal(second.model.catalogRevision, revision);
  await drain(second.stream(generateOptions(undefined, {
    provider: 'grok-oauth', sessionId: dispatchContext.sessionId, turn: dispatchContext.turn,
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'tool-call', id: 'call-1', name: 'lookup', arguments: '{}' }] },
      { role: 'user', content: [{ type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'text', text: 'ok' }] }] },
    ],
  })));
  assert.equal(catalogCalls, 1);
  assert.equal(inferenceCalls, 2);

  const next = await adapter.prepareCall('grok-oauth', 'grok-live-current', undefined, {
    sessionId: dispatchContext.sessionId,
    turn: 8,
  });
  assert.notEqual(next.model.catalogRevision, revision);
  assert.equal(catalogCalls, 2);
});

test('prepared DSH turn fails closed after catalog generation drift and never guesses stream scope', async () => {
  let catalogCalls = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        catalogCalls += 1;
        return liveCatalog([catalogModel('grok-live-current')]);
      }
      return successResponse();
    },
  });
  const context = { sessionId: 'session-generation-drift', turn: 3 };
  await adapter.prepareCall('grok-oauth', 'grok-live-current', undefined, context);
  adapter.invalidateCatalog();
  await assert.rejects(
    adapter.prepareCall('grok-oauth', 'grok-live-current', undefined, context),
    /generation changed inside one DSH turn/,
  );
  await assert.rejects(
    drain(adapter.stream(generateOptions(undefined, { provider: 'grok-oauth', sessionId: context.sessionId, turn: context.turn }))),
    /prepared-call seam/,
  );
  assert.equal(catalogCalls, 1);
});

test('catalog fingerprint and model registry update when only input capability changes', async () => {
  const replies = [
    liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text'] })]),
    liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]),
  ];
  let notifications = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    catalogChanged: () => { notifications += 1; },
    fetch: async () => replies.shift(),
  });
  const before = (await adapter.listModels('grok-oauth'))[0];
  assert.deepEqual(before.inputModalities, ['text']);
  await adapter.refreshCatalog();
  assert.equal(notifications, 1);
  const after = (await adapter.listModels('grok-oauth'))[0];
  assert.deepEqual(after.inputModalities, ['text', 'image']);
  assert.notEqual(after.catalogRevision, before.catalogRevision);
});

test('catalog revision is canonical public capability state and excludes credentials', async () => {
  const token = 'secret-token-that-must-not-affect-revision';
  const documents = [
    [
      catalogModel('grok-live-b', ['high'], { apiBackend: 'responses', inputModalities: ['text'] }),
      catalogModel('grok-live-a', ['low', 'high'], {
        apiBackend: 'chat', inputModalities: ['text', 'image'], defaultReasoningEffort: 'low',
      }),
    ],
    [
      catalogModel('grok-live-a', ['high', 'low'], {
        apiBackend: 'chat_completions', inputModalities: ['image', 'text'], defaultReasoningEffort: 'low',
      }),
      catalogModel('grok-live-b', ['high'], { apiBackend: 'responses', inputModalities: ['text'] }),
    ],
  ];
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return token; } }, undefined, {
    fetch: async () => liveCatalog(documents.shift()),
  });
  const first = await adapter.listModels('grok-oauth');
  const revision = first[0].catalogRevision;
  assert.match(revision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.every((entry) => entry.catalogRevision === revision), true);
  assert.equal(revision.includes(token), false);
  await adapter.refreshCatalog();
  const second = await adapter.listModels('grok-oauth');
  assert.equal(second[0].catalogRevision, revision);
});

test('missing or unknown live backend excludes the entry instead of guessing', async () => {
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async () => liveCatalog([
      { ...catalogModel('grok-live-missing-backend'), apiBackend: undefined },
      catalogModel('grok-live-unknown-backend', ['high'], { apiBackend: 'messages' }),
      catalogModel('grok-live-responses', ['high'], { apiBackend: 'responses' }),
    ]),
  });
  const listed = await adapter.listModels('grok-oauth');
  assert.deepEqual(listed.map((entry) => entry.id), ['grok-live-responses']);
  assert.equal(listed[0].backend, 'responses');
});

test('image inference uses DSH readImageRequest before dispatch and serializes the prepared data URL', async () => {
  const ref = { attachmentId: 'sha256-image', mediaType: 'image/png', bytes: 3, width: 32, height: 32 };
  const reads = [];
  let inference;
  const signal = new AbortController().signal;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    resolveAttachments: () => ({
      async readImageRequest(seenRef, policy, seenSignal) {
        reads.push({ seenRef, policy, seenSignal });
        return {
          attachment: seenRef,
          data: Uint8Array.from([1, 2, 3]),
          mediaType: 'image/png',
          bytes: 3,
          width: 32,
          height: 32,
          depth: 'uchar',
          space: 'srgb',
          hasAlpha: false,
        };
      },
    }),
    fetch: async (url, init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]);
      }
      inference = { url, init };
      return successResponse();
    },
  });
  await drain(adapter.stream(generateOptions(signal, {
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'inspect' }, { type: 'image', attachment: ref },
    ] }],
  })));
  assert.equal(reads.length, 1);
  assert.equal(reads[0].seenRef, ref);
  assert.equal(reads[0].seenSignal, signal);
  assert.deepEqual(reads[0].policy, { maxPixels: 1024, maxBytes: 1_500_000 });
  assert.match(inference.url, /\/chat\/completions$/);
  const body = JSON.parse(inference.init.body);
  assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,AQID');
});

test('Responses model with omitted modalities uses the versionless image compatibility overlay', async () => {
  const ref = { attachmentId: 'sha256-implicit-image', mediaType: 'image/png', bytes: 3, width: 32, height: 32 };
  let reads = 0;
  let inferenceCalls = 0;
  let inferenceBody;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    resolveAttachments: () => ({
      async readImageRequest(seenRef) {
        reads += 1;
        return {
          attachment: seenRef,
          data: Uint8Array.from([1, 2, 3]),
          mediaType: 'image/png',
          bytes: 3,
          width: 32,
          height: 32,
          depth: 'uchar',
          space: 'srgb',
          hasAlpha: false,
        };
      },
    }),
    fetch: async (_url, init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { apiBackend: 'responses' })]);
      }
      inferenceCalls += 1;
      inferenceBody = JSON.parse(init.body);
      return responsesSuccessResponse();
    },
  });
  await drain(adapter.stream(generateOptions(undefined, {
    messages: [{ role: 'user', content: [
      { type: 'image', attachment: ref },
      { type: 'text', text: 'inspect' },
    ] }],
  })));
  assert.equal(reads, 1);
  assert.equal(inferenceCalls, 1);
  assert.equal(inferenceBody.input[0].content[0].type, 'input_image');
  assert.equal(inferenceBody.input[0].content[0].image_url, 'data:image/png;base64,AQID');
});

test('image capability, role, attachment-service and projection failures stop before inference I/O', async () => {
  const ref = { attachmentId: 'sha256-image', mediaType: 'image/png', bytes: 3, width: 32, height: 32 };
  const imageMessage = { role: 'user', content: [{ type: 'image', attachment: ref }] };

  let inferenceCalls = 0;
  let resolverCalls = 0;
  const textOnly = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    resolveAttachments: () => { resolverCalls += 1; return {}; },
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text'] })]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(drain(textOnly.stream(generateOptions(undefined, { messages: [imageMessage] }))), {
    code: 'UNSUPPORTED_CONTENT',
  });
  assert.equal(resolverCalls, 0);
  assert.equal(inferenceCalls, 0);

  const noService = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(drain(noService.stream(generateOptions(undefined, { messages: [imageMessage] }))), {
    code: 'UNSUPPORTED_CONTENT',
  });

  let reads = 0;
  const badProjection = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    resolveAttachments: () => ({ async readImageRequest() { reads += 1; throw new Error('private path'); } }),
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(drain(badProjection.stream(generateOptions(undefined, { messages: [imageMessage] }))), {
    code: 'INVALID_REQUEST',
  });
  assert.equal(reads, 1);

  const illegalRole = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    resolveAttachments: () => ({ async readImageRequest() { reads += 1; throw new Error('must not run'); } }),
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-current', ['high'], { inputModalities: ['text', 'image'] })]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(drain(illegalRole.stream(generateOptions(undefined, {
    messages: [{ role: 'assistant', content: [{ type: 'image', attachment: ref }] }],
  }))), { code: 'UNSUPPORTED_CONTENT' });
  assert.equal(reads, 1);
  assert.equal(inferenceCalls, 0);
});

test('dynamic inference uses one exact catalog-validated model and effort in header and body', async () => {
  let seen;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (url, init, purpose) => {
      if (purpose === 'catalog') return liveCatalog([catalogModel('grok-live-next', ['low', 'high'])]);
      seen = { url, init, purpose };
      return successResponse();
    },
  });
  await drain(adapter.stream(generateOptions(undefined, { model: 'grok-live-next', reasoningEffort: 'low' })));
  const body = JSON.parse(seen.init.body);
  assert.equal(seen.purpose, 'inference');
  assert.match(seen.url, /\/chat\/completions$/);
  assert.equal(seen.init.headers['x-grok-model-override'], 'grok-live-next');
  assert.equal(body.model, 'grok-live-next');
  assert.equal(body.reasoning_effort, 'low');
});

test('dynamic inference maps a selector effort id to the official canonical wire value', async () => {
  let seen;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-live-next', [
          { id: 'deep', value: 'xhigh', label: 'Deep' },
          { value: 'high', default: true },
        ])]);
      }
      seen = init;
      return successResponse();
    },
  });
  const resolved = await adapter.resolveModel('grok-oauth', 'grok-live-next');
  assert.deepEqual(resolved.reasoning.efforts.map((effort) => effort.id), ['deep', 'high']);
  await drain(adapter.stream(generateOptions(undefined, {
    model: 'grok-live-next', reasoningEffort: 'deep',
  })));
  const body = JSON.parse(seen.body);
  assert.equal(body.reasoning_effort, 'xhigh');
  assert.equal(body.model, 'grok-live-next');
});

test('catalog diagnostic exposes only bounded enums and counts', async () => {
  const secret = 'never-emit-this-token-or-provider-body';
  const missing = new GrokAdapter(settings(), {
    async getAccessToken() { return undefined; },
  });
  assert.deepEqual(await missing.listModels('grok-oauth'), []);
  assert.equal(missing.catalogStatus().code, 'no_token');

  const empty = new GrokAdapter(settings(), {
    async getAccessToken() { return secret; },
  }, undefined, {
    fetch: async () => liveCatalog([{ model: 'not-grok', providerMessage: secret }]),
  });
  assert.deepEqual(await empty.listModels('grok-oauth'), []);
  assert.deepEqual(empty.catalogStatus(), {
    code: 'empty_entitlement',
    observedAt: empty.catalogStatus().observedAt,
    endpoint: '/models',
    httpStatus: 200,
    collectionShape: 'models-array',
    sourceCount: 1,
    acceptedCount: 0,
  });
  assert.equal(JSON.stringify(empty.catalogStatus()).includes(secret), false);

  const rejected = new GrokAdapter(settings(), {
    async getAccessToken() { return secret; },
  }, undefined, {
    fetch: async () => new Response(JSON.stringify({ error: secret }), { status: 426 }),
  });
  assert.deepEqual(await rejected.listModels('grok-oauth'), []);
  assert.equal(rejected.catalogStatus().code, 'http_error');
  assert.equal(rejected.catalogStatus().httpStatus, 426);
  assert.equal(JSON.stringify(rejected.catalogStatus()).includes(secret), false);
});

test('catalog failures never interpolate dependency error properties into logs', async () => {
  const secret = 'catalog-secret-in-error-code';
  const warnings = [];
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken() { throw Object.assign(new Error('also-secret'), { code: secret, oauthCode: secret }); },
  }, { warn(message) { warnings.push(message); } });
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  assert.equal(adapter.catalogStatus().code, 'token_error');
  assert.equal(warnings.length, 1);
  assert.equal(warnings.join('\n').includes(secret), false);
  assert.equal(warnings.join('\n').includes('also-secret'), false);
});

test('unknown model or model-owned effort rejects before token and inference network I/O', async () => {
  let tokenCalls = 0;
  let catalogCalls = 0;
  let inferenceCalls = 0;
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken() { tokenCalls += 1; return 'access'; },
  }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        catalogCalls += 1;
        return liveCatalog([catalogModel('grok-live-next', ['low'])]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(
    drain(adapter.stream(generateOptions(undefined, { model: 'grok-live-next', reasoningEffort: 'high' }))),
    /未授权 grok-live-next\/high/,
  );
  await assert.rejects(
    drain(adapter.stream(generateOptions(undefined, { model: 'grok-removed', reasoningEffort: 'low' }))),
    /未授权精确模型 grok-removed/,
  );
  assert.equal(tokenCalls, 2);
  assert.equal(catalogCalls, 2);
  assert.equal(inferenceCalls, 0);
});

test('inference force-refresh failure clears stale entitlement and rejects before inference dispatch', async () => {
  let inferenceCalls = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') throw Object.assign(new Error('proxy unavailable'), { code: 'proxy_request_failed' });
      inferenceCalls += 1;
      return successResponse();
    },
  });
  seedCatalog(adapter, [entitled('grok-live-current', ['high'])]);
  await assert.rejects(drain(adapter.stream(generateOptions())), /未授权精确模型 grok-live-current/);
  assert.equal(adapter.catalogIsLive(), false);
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  assert.equal(inferenceCalls, 0);
});

test('refresh atomically adds/removes models, notifies only on fingerprint change, and clears stale entitlement on failure', async () => {
  const replies = [
    liveCatalog([catalogModel('grok-live-current')]),
    liveCatalog([catalogModel('grok-live-current')]),
    liveCatalog([catalogModel('grok-live-next', ['low'])]),
  ];
  let fail = false;
  let notifications = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    catalogChanged: () => { notifications += 1; },
    fetch: async () => {
      if (fail) throw Object.assign(new Error('proxy down'), { code: 'proxy_request_failed' });
      return replies.shift();
    },
  });
  assert.deepEqual((await adapter.listModels('grok-oauth')).map((model) => model.id), ['grok-live-current']);
  assert.equal(notifications, 0);
  await adapter.refreshCatalog();
  assert.equal(notifications, 0);
  await adapter.refreshCatalog();
  assert.equal(notifications, 1);
  assert.deepEqual((await adapter.listModels('grok-oauth')).map((model) => model.id), ['grok-live-next']);
  fail = true;
  await adapter.refreshCatalog();
  assert.equal(notifications, 2);
  assert.equal(adapter.catalogIsLive(), false);
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  await assert.rejects(adapter.resolveModel('grok-oauth', 'grok-live-next'), /未授权精确模型/);
});

test('forced and on-demand refreshes share one in-flight catalog request', async () => {
  let fetchCalls = 0;
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async () => {
      fetchCalls += 1;
      return response;
    },
  });
  const first = adapter.refreshCatalog();
  const second = adapter.refreshCatalog();
  assert.equal(fetchCalls, 0);
  await Promise.resolve();
  assert.equal(fetchCalls, 1);
  release(liveCatalog([catalogModel('grok-live-current')]));
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(fetchCalls, 1);
});

test('disposing the adapter aborts and generation-isolates an in-flight catalog refresh', async () => {
  let aborted = false;
  let notifications = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    catalogChanged: () => { notifications += 1; },
    fetch: async (_url, init) => new Promise((resolve, reject) => {
      const stop = () => {
        aborted = true;
        reject(Object.assign(new Error('aborted'), { code: 'timeout_or_abort' }));
      };
      if (init.signal.aborted) stop();
      else init.signal.addEventListener('abort', stop, { once: true });
    }),
  });
  const pending = adapter.refreshCatalog();
  await Promise.resolve();
  await Promise.resolve();
  adapter.disposeCatalog();
  const snapshot = await pending;
  assert.equal(aborted, true);
  assert.equal(snapshot.live, false);
  assert.equal(adapter.catalogIsLive(), false);
  assert.equal(notifications, 0);
});

test('catalog invalidation immediately starts a new generation and the old finally cannot clear it', async () => {
  let calls = 0;
  let releaseSecond;
  const secondResponse = new Promise((resolve) => { releaseSecond = resolve; });
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve, reject) => {
          const stop = () => reject(Object.assign(new Error('aborted old generation'), { code: 'secret-old-code' }));
          if (init.signal.aborted) stop();
          else init.signal.addEventListener('abort', stop, { once: true });
        });
      }
      return secondResponse;
    },
  });
  const first = adapter.refreshCatalog();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 1);
  adapter.invalidateCatalog();
  const second = adapter.refreshCatalog();
  const third = adapter.refreshCatalog();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  releaseSecond(liveCatalog([catalogModel('grok-live-next')]));
  const [, secondSnapshot, thirdSnapshot] = await Promise.all([first, second, third]);
  assert.deepEqual(secondSnapshot.models.map((model) => model.id), ['grok-live-next']);
  assert.equal(thirdSnapshot.fingerprint, secondSnapshot.fingerprint);
  assert.equal(adapter.catalogStatus().code, 'ok');
});

test('401 replay keeps one affinity, rotates request id, and passes rejected token', async () => {
  const tokenArguments = [];
  const oauth = {
    async getAccessToken(rejected) {
      tokenArguments.push(rejected);
      return rejected === undefined ? 'access-old' : 'access-new';
    },
  };
  const calls = [];
  const adapter = new GrokAdapter(settings(), oauth, undefined, {
    fetch: async (_url, init, purpose) => {
      if (purpose === 'catalog') return catalogSuccess();
      calls.push(init.headers);
      return calls.length === 1
        ? new Response('{"error":{"code":"unauthorized"}}', { status: 401, headers: { 'content-type': 'application/json' } })
        : successResponse();
    },
  });
  seedCatalog(adapter);
  const chunks = await drain(adapter.stream(generateOptions()));
  assert.ok(chunks.some((chunk) => chunk.type === 'finish'));
  assert.deepEqual(tokenArguments, [undefined, undefined, 'access-old']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]['x-grok-session-id'], calls[0]['x-grok-conv-id']);
  assert.equal(calls[1]['x-grok-session-id'], calls[1]['x-grok-conv-id']);
  assert.equal(calls[0]['x-grok-session-id'], calls[1]['x-grok-session-id']);
  assert.notEqual(calls[0]['x-grok-req-id'], calls[1]['x-grok-req-id']);
});

test('acceptance mode never replays a 401', async () => {
  process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
  try {
    let calls = 0;
    const oauth = { async getAccessToken() { return 'access'; } };
    const { GrokAdapter: AcceptanceAdapter } = await import('../lib/adapter.js?acceptance-401');
    const adapter = new AcceptanceAdapter(settings(), oauth, undefined, {
      fetch: async (_url, _init, purpose) => {
        if (purpose === 'catalog') return catalogSuccess();
        calls += 1;
        return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
      },
    });
    seedCatalog(adapter);
    await assert.rejects(drain(adapter.stream(generateOptions())), /HTTP 401/);
    assert.equal(calls, 1);
  } finally {
    delete process.env.DSH_SUPERGROK_ACCEPTANCE;
  }
});

test('acceptance mode rejects a non-empty tool catalog before any network I/O', async () => {
  process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
  try {
    let tokenCalls = 0;
    let networkCalls = 0;
    const { GrokAdapter: AcceptanceAdapter } = await import('../lib/adapter.js?acceptance-no-tools');
    const adapter = new AcceptanceAdapter(
      settings(),
      { async getAccessToken() { tokenCalls += 1; return 'access'; } },
      undefined,
      { fetch: async () => { networkCalls += 1; return successResponse(); } },
    );
    const options = {
      ...generateOptions(),
      tools: [{ name: 'forbidden', description: 'must never reach the wire', inputSchema: {} }],
    };
    await assert.rejects(drain(adapter.stream(options)), /empty tool catalog/);
    assert.equal(tokenCalls, 0);
    assert.equal(networkCalls, 0);
  } finally {
    delete process.env.DSH_SUPERGROK_ACCEPTANCE;
  }
});

test('acceptance process latch permits only one inference fetch, including concurrent streams', async () => {
  process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
  try {
    let calls = 0;
    let releaseFirst;
    const firstResponse = new Promise((resolve) => { releaseFirst = () => resolve(successResponse()); });
    const { GrokAdapter: AcceptanceAdapter } = await import('../lib/adapter.js?acceptance-latch');
    const adapter = new AcceptanceAdapter(
      settings(),
      { async getAccessToken() { return 'access'; } },
      undefined,
      {
        fetch: async (_url, _init, purpose) => {
          if (purpose === 'catalog') return catalogSuccess();
          calls += 1;
          return firstResponse;
        },
      },
    );
    seedCatalog(adapter);

    const first = drain(adapter.stream(generateOptions()));
    const second = drain(adapter.stream(generateOptions()));
    await assert.rejects(second, /exactly one inference request/);
    assert.equal(calls, 1);
    releaseFirst();
    const chunks = await first;
    assert.ok(chunks.some((chunk) => chunk.type === 'finish'));

    await assert.rejects(drain(adapter.stream(generateOptions())), /exactly one inference request/);
    assert.equal(calls, 1);
  } finally {
    delete process.env.DSH_SUPERGROK_ACCEPTANCE;
  }
});

test('idle timeout and caller abort actively cancel a stalled response body', async () => {
  for (const mode of ['timeout', 'caller']) {
    let cancelled = false;
    const body = new ReadableStream({
      pull() { return new Promise(() => {}); },
      cancel() { cancelled = true; },
    });
    const controller = new AbortController();
    const adapter = new GrokAdapter(
      settings({ streamIdleTimeoutMs: mode === 'timeout' ? 20 : 1000 }),
      { async getAccessToken() { return 'access'; } },
      undefined,
      {
        fetch: async (_url, _init, purpose) => purpose === 'catalog'
          ? catalogSuccess()
          : new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      },
    );
    seedCatalog(adapter);
    const pending = drain(adapter.stream(generateOptions(controller.signal)));
    if (mode === 'caller') setTimeout(() => controller.abort(new Error('caller stop')), 20);
    await assert.rejects(pending, mode === 'timeout' ? /idle timeout/ : /aborted by caller/);
    assert.equal(cancelled, true);
  }
});

test('unsafe provider metadata is never copied into the LLM error', async () => {
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, _init, purpose) => purpose === 'catalog'
      ? catalogSuccess()
      : new Response('{"error":{"code":"bad\\r\\nX-Leak: secret"}}', {
        status: 403,
        headers: { 'content-type': 'application/json', 'x-request-id': 'bad value with spaces' },
      }),
  });
  seedCatalog(adapter);
  let caught;
  try { await drain(adapter.stream(generateOptions())); } catch (error) { caught = error; }
  assert.equal(caught?.providerCode, undefined);
  assert.equal(caught?.requestId, undefined);
  assert.doesNotMatch(String(caught), /X-Leak|bad value/);
});
