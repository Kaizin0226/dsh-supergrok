import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SSE_EVENT_BYTES,
  MAX_SSE_LINE_BYTES,
  parseSse,
  serializeChatRequest,
  serializeResponsesRequest,
  translateChat,
} from '../lib/wire.js';

function options(overrides = {}) {
  return {
    model: 'grok-4.6',
    reasoningEffort: 'high',
    system: 'system',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'tool-call', id: 'call-1', name: 'lookup', arguments: '{"q":"x"}' }] },
      { role: 'user', content: [{ type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'text', text: 'ok' }] }] },
    ],
    tools: [{ name: 'lookup', description: 'lookup', parameters: { type: 'object' } }],
    ...overrides,
  };
}

test('Responses and chat serializers preserve high reasoning and tool round trips', () => {
  const responses = serializeResponsesRequest(options(), {});
  assert.deepEqual(responses.reasoning, { effort: 'high' });
  assert.ok(responses.input.some((entry) => entry.type === 'function_call'));
  assert.ok(responses.input.some((entry) => entry.type === 'function_call_output'));
  const chat = serializeChatRequest(options(), {});
  assert.equal(chat.reasoning_effort, 'high');
  assert.ok(chat.messages.some((entry) => entry.role === 'tool'));
  assert.equal(chat.tools[0].function.name, 'lookup');
});

test('Responses and chat serializers preserve another exact dynamic model and effort', () => {
  const selected = options({ model: 'grok-4.7-fast', reasoningEffort: 'low' });
  const responses = serializeResponsesRequest(selected, {});
  const chat = serializeChatRequest(selected, {});
  assert.equal(responses.model, 'grok-4.7-fast');
  assert.deepEqual(responses.reasoning, { effort: 'low' });
  assert.equal(chat.model, 'grok-4.7-fast');
  assert.equal(chat.reasoning_effort, 'low');
});

async function expectSseFailure(bytes, expectedCode) {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(bytes); },
    cancel() { cancelled = true; },
  });
  const iterator = parseSse(body, 'data')[Symbol.asyncIterator]();
  await assert.rejects(iterator.next(), { code: expectedCode });
  assert.equal(cancelled, true);
}

test('SSE parser caps lines/events and rejects malformed UTF-8', async () => {
  await expectSseFailure(new TextEncoder().encode(`data: ${'x'.repeat(MAX_SSE_LINE_BYTES + 1)}`), 'SSE_LIMIT');
  const half = Math.floor(MAX_SSE_EVENT_BYTES / 2) + 16;
  await expectSseFailure(new TextEncoder().encode(`data: ${'a'.repeat(half)}\ndata: ${'b'.repeat(half)}\n`), 'SSE_LIMIT');
  await expectSseFailure(Uint8Array.from([0x64, 0x61, 0x74, 0x61, 0x3a, 0x20, 0xc3, 0x28]), 'MALFORMED_RESPONSE');
});

test('chat translator parses reasoning, tool calls, usage and terminal reason', async () => {
  async function* events() {
    yield JSON.stringify({ choices: [{ delta: { reasoning_content: 'think' } }] });
    yield JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call', function: { name: 'lookup', arguments: '{"q":' } }] } }] });
    yield JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 5, completion_tokens: 3 } });
    yield '[DONE]';
  }
  const chunks = [];
  for await (const chunk of translateChat(events())) chunks.push(chunk);
  assert.ok(chunks.some((chunk) => chunk.type === 'reasoning-delta'));
  assert.ok(chunks.some((chunk) => chunk.type === 'tool-call-delta'));
  assert.ok(chunks.some((chunk) => chunk.type === 'usage'));
  assert.deepEqual(chunks.at(-1), { type: 'finish', reason: { kind: 'tool-calls' } });
});

test('SSE parser actively cancels a stalled reader on abort', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled = true; },
  });
  const controller = new AbortController();
  const iterator = parseSse(body, 'data', undefined, controller.signal)[Symbol.asyncIterator]();
  const pending = iterator.next();
  controller.abort(new Error('stop'));
  await assert.rejects(pending, /stop/);
  assert.equal(cancelled, true);
});
