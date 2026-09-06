import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SSE_EVENT_BYTES,
  MAX_SSE_LINE_BYTES,
  parseSse,
  serializeChatRequest,
  serializeResponsesRequest,
  translateChat,
  translateResponses,
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

function image(attachmentId) {
  return { type: 'image', attachment: { attachmentId, mediaType: 'image/png', bytes: 3, width: 32, height: 32 } };
}

function prepared(...ids) {
  return new Map(ids.map((id, index) => [id, {
    dataUrl: `data:image/png;base64,${index === 0 ? 'AQID' : 'BAUG'}`,
  }]));
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

test('Responses and chat serializers preserve ordered user/history images and nested tool-result images', () => {
  const requestImages = prepared('image-one', 'image-two');
  const selected = options({
    messages: [
      { role: 'user', content: [
        { type: 'text', text: 'before' }, image('image-one'), { type: 'text', text: 'after' },
      ] },
      { role: 'assistant', content: [
        { type: 'tool-call', id: 'call-1', name: 'inspect', arguments: '{}' },
      ] },
      { role: 'user', content: [{
        type: 'tool-result', toolCallId: 'call-1', content: [
          { type: 'text', text: 'tool text' }, image('image-two'),
        ],
      }] },
    ],
  });

  const responses = serializeResponsesRequest(selected, {}, requestImages);
  assert.deepEqual(responses.input[0].content.map((part) => part.type), ['input_text', 'input_image', 'input_text']);
  assert.equal(responses.input[0].content[1].image_url, 'data:image/png;base64,AQID');
  assert.equal(responses.input[2].type, 'function_call_output');
  assert.equal(responses.input[2].call_id, 'call-1');
  assert.deepEqual(responses.input[2].output.map((part) => part.type), ['input_text', 'input_image']);
  assert.equal(responses.input[2].output[0].text, 'tool text');
  assert.equal(responses.input[2].output[1].image_url, 'data:image/png;base64,BAUG');
  assert.equal(responses.input.length, 3);
  assert.equal(responses.input.filter((entry) => entry.type === 'message' && entry.role === 'user').length, 1);
  assert.deepEqual(responses.reasoning, { effort: 'high' });
  assert.equal(responses.tools[0].name, 'lookup');

  const chat = serializeChatRequest(selected, {}, requestImages);
  const user = chat.messages.find((message) => message.role === 'user' && Array.isArray(message.content));
  assert.deepEqual(user.content.map((part) => part.type), ['text', 'image_url', 'text']);
  assert.equal(user.content[1].image_url.url, 'data:image/png;base64,AQID');
  const toolIndex = chat.messages.findIndex((message) => message.role === 'tool');
  assert.equal(chat.messages[toolIndex].tool_call_id, 'call-1');
  assert.deepEqual(chat.messages[toolIndex].content.map((part) => part.type), ['text', 'image_url']);
  assert.equal(chat.messages[toolIndex].content[0].text, 'tool text');
  assert.equal(chat.messages[toolIndex].content[1].image_url.url, 'data:image/png;base64,BAUG');
  assert.equal(chat.messages.filter((message) => message.role === 'user').length, 1);
  assert.equal(chat.reasoning_effort, 'high');
  assert.equal(chat.tools[0].function.name, 'lookup');
  assert.doesNotMatch(JSON.stringify({ responses, chat }), /image attachment omitted/);
});

test('image-only and failed tool results stay inside their correlated tool result blocks', () => {
  const requestImages = prepared('tool-image');
  const selected = options({
    messages: [
      { role: 'assistant', content: [
        { type: 'tool-call', id: 'call-image', name: 'inspect', arguments: '{}' },
      ] },
      { role: 'user', content: [{
        type: 'tool-result', toolCallId: 'call-image', isError: true, content: [image('tool-image')],
      }] },
    ],
  });
  const responses = serializeResponsesRequest(selected, {}, requestImages);
  const output = responses.input.find((entry) => entry.type === 'function_call_output');
  assert.equal(output.call_id, 'call-image');
  assert.deepEqual(output.output.map((part) => part.type), ['input_text', 'input_image']);
  assert.equal(output.output[0].text, '[tool error] (no output)');
  assert.equal(responses.input.some((entry) => entry.type === 'message' && entry.role === 'user'), false);

  const chat = serializeChatRequest(selected, {}, requestImages);
  const tool = chat.messages.find((message) => message.role === 'tool');
  assert.equal(tool.tool_call_id, 'call-image');
  assert.deepEqual(tool.content.map((part) => part.type), ['text', 'image_url']);
  assert.equal(tool.content[0].text, '[tool error] (no output)');
  assert.equal(chat.messages.some((message) => message.role === 'user'), false);
});

test('historical user images are serialized on every request while text-only shapes stay compact', () => {
  const requestImages = prepared('history-one', 'history-two');
  const messages = [
    { role: 'user', content: [image('history-one')] },
    { role: 'assistant', content: [{ type: 'text', text: 'seen' }] },
    { role: 'user', content: [{ type: 'text', text: 'again' }, image('history-two')] },
  ];
  const responses = serializeResponsesRequest(options({ messages }), {}, requestImages);
  const chat = serializeChatRequest(options({ messages }), {}, requestImages);
  assert.equal(JSON.stringify(responses).match(/data:image\/png;base64/g)?.length, 2);
  assert.equal(JSON.stringify(chat).match(/data:image\/png;base64/g)?.length, 2);

  const textMessages = [{ role: 'user', content: [
    { type: 'text', text: 'a' }, { type: 'text', text: 'b' },
  ] }];
  assert.deepEqual(
    serializeResponsesRequest(options({ messages: textMessages }), {}).input[0].content,
    [{ type: 'input_text', text: 'a\nb' }],
  );
  assert.equal(serializeChatRequest(options({ messages: textMessages }), {}).messages.at(-1).content, 'a\nb');
});

test('serializers reject illegal image roles and unprepared images before wire dispatch', () => {
  for (const role of ['assistant', 'system']) {
    const selected = options({ messages: [{ role, content: [image('illegal')] }] });
    assert.throws(() => serializeResponsesRequest(selected, {}, prepared('illegal')), { code: 'UNSUPPORTED_CONTENT' });
    assert.throws(() => serializeChatRequest(selected, {}, prepared('illegal')), { code: 'UNSUPPORTED_CONTENT' });
  }
  const selected = options({ messages: [{ role: 'user', content: [image('missing')] }] });
  assert.throws(() => serializeResponsesRequest(selected, {}), { code: 'INVALID_REQUEST' });
  assert.throws(() => serializeChatRequest(selected, {}), { code: 'INVALID_REQUEST' });
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

test('Responses translator preserves reasoning, text, tool calls, usage and terminal reason', async () => {
  async function* events() {
    yield { type: 'response.output_item.added', output_index: 0, item: {
      type: 'function_call', call_id: 'call', name: 'lookup', arguments: '',
    } };
    yield { type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"q":"x"}' };
    yield { type: 'response.output_item.done', output_index: 0, item: {
      type: 'function_call', call_id: 'call', name: 'lookup', arguments: '{"q":"x"}',
    } };
    yield { type: 'response.reasoning_summary_text.delta', output_index: 1, summary_index: 0, delta: 'think' };
    yield { type: 'response.reasoning_summary_text.done', output_index: 1, summary_index: 0 };
    yield { type: 'response.output_text.delta', output_index: 2, content_index: 0, delta: 'answer' };
    yield { type: 'response.output_text.done', output_index: 2, content_index: 0, text: 'answer' };
    yield { type: 'response.completed', response: { usage: {
      input_tokens: 9,
      output_tokens: 4,
      input_tokens_details: { cached_tokens: 2 },
      output_tokens_details: { reasoning_tokens: 1 },
    } } };
  }
  const chunks = [];
  for await (const chunk of translateResponses(events())) chunks.push(chunk);
  assert.ok(chunks.some((chunk) => chunk.type === 'reasoning-delta'));
  assert.ok(chunks.some((chunk) => chunk.type === 'text-delta'));
  assert.ok(chunks.some((chunk) => chunk.type === 'tool-call-delta'));
  assert.deepEqual(chunks.find((chunk) => chunk.type === 'usage')?.usage, {
    inputTokens: 7, outputTokens: 4, cacheReadTokens: 2, reasoningTokens: 1,
  });
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
