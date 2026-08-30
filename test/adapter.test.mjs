import assert from 'node:assert/strict';
import test from 'node:test';
import { GrokAdapter } from '../lib/adapter.js';

function settings(overrides = {}) {
  return () => ({
    modelsRefreshSeconds: 300,
    defaultContextWindow: 131072,
    streamIdleTimeoutMs: 1000,
    requestTimeoutMs: 1000,
    ...overrides,
  });
}

function entitled(id = 'grok-4.6', efforts = ['high'], overrides = {}) {
  return {
    id, name: id, apiBackend: 'chat', supportsReasoning: true,
    efforts: efforts.map((effort) => ({ id: effort, name: `${effort} effort` })),
    defaultEffort: efforts.includes('high') ? 'high' : efforts[0], contextWindow: 131072,
    ...overrides,
  };
}

function generateOptions(signal = new AbortController().signal, overrides = {}) {
  return {
    model: 'grok-4.6',
    reasoningEffort: 'high',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    signal,
    ...overrides,
  };
}

function seedCatalog(adapter, models = [entitled()]) {
  adapter.catalogCache = {
    at: Date.now(), live: true, models: Object.freeze(models), fingerprint: 'test-fixture',
  };
}

function successResponse() {
  const event = JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] });
  return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {
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
    model: 'grok-4.6',
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
      catalogModel('grok-4.6', ['low', 'high']),
      catalogModel('grok-4.7-fast', ['minimal', 'low'], {
        defaultReasoningEffort: 'low', contextWindow: 262144, maxCompletionTokens: 32768,
      }),
      {
        model: 'grok-code', name: 'Grok Code', supportedInApi: true,
        supportsReasoningEffort: false, reasoningEfforts: [], apiBackend: 'responses',
      },
    ]),
  });
  const listed = await adapter.listModels('grok-oauth');
  assert.deepEqual(listed.map((model) => model.id), ['grok-4.6', 'grok-4.7-fast', 'grok-code']);
  const resolved = await adapter.resolveModel('grok-oauth', 'grok-4.7-fast');
  assert.deepEqual(resolved.reasoning.efforts.map((effort) => effort.id), ['minimal', 'low']);
  assert.equal(resolved.reasoning.defaultEffort, 'low');
  assert.equal(resolved.context.contextWindow, 262144);
  assert.equal(resolved.defaultMaxTokens, 32768);
  const noReasoning = await adapter.resolveModel('grok-oauth', 'grok-code');
  assert.equal(noReasoning.reasoning, undefined);
});

test('dynamic inference uses one exact catalog-validated model and effort in header and body', async () => {
  let seen;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (url, init, purpose) => {
      if (purpose === 'catalog') return liveCatalog([catalogModel('grok-4.7-fast', ['low', 'high'])]);
      seen = { url, init, purpose };
      return successResponse();
    },
  });
  await drain(adapter.stream(generateOptions(undefined, { model: 'grok-4.7-fast', reasoningEffort: 'low' })));
  const body = JSON.parse(seen.init.body);
  assert.equal(seen.purpose, 'inference');
  assert.match(seen.url, /\/chat\/completions$/);
  assert.equal(seen.init.headers['x-grok-model-override'], 'grok-4.7-fast');
  assert.equal(body.model, 'grok-4.7-fast');
  assert.equal(body.reasoning_effort, 'low');
});

test('dynamic inference maps a selector effort id to the official canonical wire value', async () => {
  let seen;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, init, purpose) => {
      if (purpose === 'catalog') {
        return liveCatalog([catalogModel('grok-4.7-fast', [
          { id: 'deep', value: 'xhigh', label: 'Deep' },
          { value: 'high', default: true },
        ])]);
      }
      seen = init;
      return successResponse();
    },
  });
  const resolved = await adapter.resolveModel('grok-oauth', 'grok-4.7-fast');
  assert.deepEqual(resolved.reasoning.efforts.map((effort) => effort.id), ['deep', 'high']);
  await drain(adapter.stream(generateOptions(undefined, {
    model: 'grok-4.7-fast', reasoningEffort: 'deep',
  })));
  const body = JSON.parse(seen.body);
  assert.equal(body.reasoning_effort, 'xhigh');
  assert.equal(body.model, 'grok-4.7-fast');
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
        return liveCatalog([catalogModel('grok-4.7-fast', ['low'])]);
      }
      inferenceCalls += 1;
      return successResponse();
    },
  });
  await assert.rejects(
    drain(adapter.stream(generateOptions(undefined, { model: 'grok-4.7-fast', reasoningEffort: 'high' }))),
    /未授权 grok-4.7-fast\/high/,
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
  seedCatalog(adapter, [entitled('grok-4.6', ['high'])]);
  await assert.rejects(drain(adapter.stream(generateOptions())), /未授权精确模型 grok-4.6/);
  assert.equal(adapter.catalogIsLive(), false);
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  assert.equal(inferenceCalls, 0);
});

test('refresh atomically adds/removes models, notifies only on fingerprint change, and clears stale entitlement on failure', async () => {
  const replies = [
    liveCatalog([catalogModel('grok-4.6')]),
    liveCatalog([catalogModel('grok-4.6')]),
    liveCatalog([catalogModel('grok-4.7', ['low'])]),
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
  assert.deepEqual((await adapter.listModels('grok-oauth')).map((model) => model.id), ['grok-4.6']);
  assert.equal(notifications, 0);
  await adapter.refreshCatalog();
  assert.equal(notifications, 0);
  await adapter.refreshCatalog();
  assert.equal(notifications, 1);
  assert.deepEqual((await adapter.listModels('grok-oauth')).map((model) => model.id), ['grok-4.7']);
  fail = true;
  await adapter.refreshCatalog();
  assert.equal(notifications, 2);
  assert.equal(adapter.catalogIsLive(), false);
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  await assert.rejects(adapter.resolveModel('grok-oauth', 'grok-4.7'), /未授权精确模型/);
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
  release(liveCatalog([catalogModel('grok-4.6')]));
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
  releaseSecond(liveCatalog([catalogModel('grok-4.7')]));
  const [, secondSnapshot, thirdSnapshot] = await Promise.all([first, second, third]);
  assert.deepEqual(secondSnapshot.models.map((model) => model.id), ['grok-4.7']);
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
