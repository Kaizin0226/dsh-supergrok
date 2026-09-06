import assert from 'node:assert/strict';
import { GrokAdapter, LIVE_CANARY_MAX_INFERENCES } from '../lib/adapter.js';

const mode = process.argv[2];

function settings() {
  return () => ({
    modelsRefreshSeconds: 60,
    defaultContextWindow: 131072,
    streamIdleTimeoutMs: 1000,
    requestTimeoutMs: 1000,
    maxRequestBodyBytes: 40000000,
  });
}

function catalogResponse(status = 200) {
  return new Response(status === 200 ? JSON.stringify({ models: [{
    model: 'grok-live-canary',
    name: 'Grok live Canary',
    supportedInApi: true,
    supportsReasoningEffort: true,
    reasoningEfforts: ['high'],
    defaultReasoningEffort: 'high',
    inputModalities: ['text'],
    apiBackend: 'chat_completions',
  }] }) : '{}', {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function inferenceResponse(status = 200) {
  if (status !== 200) return new Response('{}', { status });
  const event = JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] });
  return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function options(turn = 1) {
  return {
    provider: 'grok-oauth',
    model: 'grok-live-canary',
    reasoningEffort: 'high',
    sessionId: 'live-canary-session',
    turn,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'probe' }] }],
  };
}

async function drain(iterable) {
  for await (const _chunk of iterable) {
    // Consume the complete provider stream.
  }
}

if (mode === 'two-leg') {
  assert.equal(LIVE_CANARY_MAX_INFERENCES, 2);
  let catalogCalls = 0;
  let inferenceCalls = 0;
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') {
        catalogCalls += 1;
        return catalogResponse();
      }
      inferenceCalls += 1;
      return inferenceResponse();
    },
  });
  const context = { sessionId: 'live-canary-session', turn: 1 };
  const first = await adapter.prepareCall('grok-oauth', 'grok-live-canary', undefined, context);
  await drain(first.stream(options()));
  const second = await adapter.prepareCall('grok-oauth', 'grok-live-canary', undefined, context);
  assert.equal(second.model.catalogRevision, first.model.catalogRevision);
  await drain(second.stream(options()));
  const third = await adapter.prepareCall('grok-oauth', 'grok-live-canary', undefined, context);
  await assert.rejects(drain(third.stream(options())), /inference budget 2 is exhausted/);
  assert.equal(catalogCalls, 1);
  assert.equal(inferenceCalls, 2);
} else if (mode === 'catalog-404') {
  assert.equal(LIVE_CANARY_MAX_INFERENCES, 1);
  const urls = [];
  const adapter = new GrokAdapter(settings(), { async getAccessToken() { return 'access'; } }, undefined, {
    fetch: async (url, _init, purpose) => {
      assert.equal(purpose, 'catalog');
      urls.push(url);
      return catalogResponse(404);
    },
  });
  assert.deepEqual(await adapter.listModels('grok-oauth'), []);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/models$/);
  assert.doesNotMatch(urls[0], /models-v2/);
} else if (mode === 'inference-401') {
  assert.equal(LIVE_CANARY_MAX_INFERENCES, 1);
  const tokenArguments = [];
  let inferenceCalls = 0;
  const adapter = new GrokAdapter(settings(), {
    async getAccessToken(rejected) {
      tokenArguments.push(rejected);
      return rejected === undefined ? 'access' : 'must-not-refresh';
    },
  }, undefined, {
    fetch: async (_url, _init, purpose) => {
      if (purpose === 'catalog') return catalogResponse();
      inferenceCalls += 1;
      return inferenceResponse(401);
    },
  });
  const context = { sessionId: 'live-canary-session', turn: 1 };
  const prepared = await adapter.prepareCall('grok-oauth', 'grok-live-canary', undefined, context);
  await assert.rejects(drain(prepared.stream(options())), /HTTP 401/);
  assert.equal(inferenceCalls, 1);
  assert.deepEqual(tokenArguments, [undefined, undefined]);
} else {
  throw new Error(`unknown probe mode: ${String(mode)}`);
}
