import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, renderHiddenImageIndex, safeImageDisplayName, assertCurrentRouteCanRecallImage } from 'dsh-tool-attachment-history';
import { image, session, user, compact, agent, child, toolResult } from './fixtures.mjs';

function harness(s, options = {}) {
  const reads = [], routes = [], contexts = [];
  let definition;
  const ctx = {
    get: () => options.noLlm ? undefined : { resolveModelInfo: async (...args) => {
      routes.push(args);
      return { inputModalities: options.modalities ?? ['text', 'image'] };
    } },
    attachments: { readImage: async (ref, signal) => {
      reads.push({ ref, signal });
      signal.throwIfAborted();
      if (options.readError) throw options.readError;
      return { ref: options.storedRef ?? ref, data: new Uint8Array(ref.bytes) };
    } },
    systemPrompt: { context: value => contexts.push(value) },
    tools: { register: value => { definition = value; } },
  };
  apply(ctx);
  const signal = new AbortController().signal;
  const exec = { agent: agent(s), signal };
  return { ctx, reads, routes, contexts, definition, exec };
}

test('recall validates the exact route and reads canonical stored reference only', async () => {
  const s = session();
  const ref = image('a', { name: 'sample.png', originalDimensions: { width: 20, height: 30 } });
  user(s, [ref]);
  compact(s);
  const f = harness(s);
  const value = await f.definition.execute({ attachmentId: 'a', occurrence: { seq: 0, ordinal: 0 } }, f.exec);
  assert.deepEqual(f.routes[0], ['fixture', 'vision', f.exec.signal]);
  assert.deepEqual(f.reads, [{ ref, signal: f.exec.signal }]);
  assert.deepEqual(value.image.originalDimensions, { width: 20, height: 30 });
  assert.equal(value.occurrences, 1);
  const blocks = f.definition.output.render({}, value);
  assert.equal(blocks[1].type, 'image');
  assert.deepEqual(blocks[1].attachment, ref);
  toolResult(s, [blocks[1].attachment]);
  assert.equal(renderHiddenImageIndex(f.exec.agent), '');
  compact(s);
  assert.match(renderHiddenImageIndex(f.exec.agent), /"occurrences":2/);
});

test('request header route takes precedence over static Agent options', async () => {
  const s = session();
  s.append('request/header', { turn: 1, step: 1, header: { config: { provider: 'routed', model: 'current' } } });
  const f = harness(s);
  await assertCurrentRouteCanRecallImage(f.ctx, f.exec);
  assert.deepEqual(f.routes[0].slice(0, 2), ['routed', 'current']);
});

test('missing, unknown or text-only capability refuses before attachment reads', async () => {
  for (const options of [{ noLlm: true }, { modalities: [] }, { modalities: ['text'] }]) {
    const s = session(); user(s, [image('a')]);
    const f = harness(s, options);
    await assert.rejects(f.definition.execute({ attachmentId: 'a' }, f.exec), /current model route|image input/);
    assert.equal(f.reads.length, 0);
  }
});

test('wrong session, wrong occurrence and caller metadata cannot bypass authority', async () => {
  const s = session(); user(s, [image('a'), image('b')]);
  const f = harness(s);
  for (const args of [
    { attachmentId: 'absent' }, { attachmentId: 'a', occurrence: { seq: 0, ordinal: 1 } },
    { attachmentId: 'a', sessionId: 'other' }, { attachmentId: 'a', path: '/synthetic/image' },
    { attachmentId: 'a', image: image('a') }, { attachmentId: 'a', occurrence: { seq: 0, ordinal: 0, other: true } },
    { attachmentId: 'a', occurrence: { seq: -1, ordinal: 0 } },
  ]) await assert.rejects(f.definition.execute(args, f.exec));
  assert.equal(f.reads.length, 0);
  const fork = harness(child(s));
  await assert.rejects(fork.definition.execute({ attachmentId: 'a' }, fork.exec), /authorized occurrence/);
  assert.equal(fork.reads.length, 0);
});

test('attachment integrity failures and identity mismatch propagate; cancellation is not swallowed', async () => {
  const s = session(); user(s, [image('a')]);
  for (const options of [
    { readError: new Error('synthetic corrupt bytes') }, { storedRef: image('different') },
  ]) {
    const f = harness(s, options);
    await assert.rejects(f.definition.execute({ attachmentId: 'a' }, f.exec), /corrupt bytes|different image identity/);
  }
  const f = harness(s);
  f.exec.signal = AbortSignal.abort(new Error('synthetic cancellation'));
  await assert.rejects(f.definition.execute({ attachmentId: 'a' }, f.exec), /synthetic cancellation/);
});

test('hidden index never reads image bytes and bounds newest-first metadata with exact omission count', () => {
  const s = session();
  for (let i = 0; i < 80; i++) user(s, [image(`img-${i}`, { name: `/synthetic/folder/${'图'.repeat(70)}${i}.png` })]);
  compact(s);
  const f = harness(s);
  const text = f.contexts[0].text({ agent: f.exec.agent });
  assert.ok(Buffer.byteLength(text) <= 4096);
  const lines = text.split('\n').filter(x => x.startsWith('{')).map(JSON.parse);
  assert.equal(lines[0].attachmentId, 'img-79');
  assert.ok(lines.length <= 32);
  assert.match(text, new RegExp(`Omitted ${80 - lines.length} older`));
  assert.equal(text.includes('/synthetic/folder'), false);
  assert.equal(f.reads.length, 0);
  assert.equal(f.routes.length, 0);
  assert.equal(f.contexts[0].text({}), '');
});

test('display names strip path prefixes and control characters without accepting metadata authority', () => {
  assert.equal(safeImageDisplayName('/synthetic/a\u0000.png'), 'a.png');
  assert.equal(safeImageDisplayName('X:\\synthetic\\a.png'), 'a.png');
  assert.equal(safeImageDisplayName('\u0000\n'), undefined);
  assert.equal(safeImageDisplayName('a'.repeat(121)).length, 120);
});
