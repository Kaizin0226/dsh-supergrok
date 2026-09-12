import assert from 'node:assert/strict';
import test from 'node:test';
import { createUserMessage, createMessage, ToolCallId, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import {
  collectAuthorizedImageOccurrences as collect,
  collectAuthorizedImageOccurrencesFromEvents as collectEvents,
  collectHiddenImageAttachments as hidden,
  resolveAuthorizedImageOccurrence as resolve,
  isDurableImageAttachmentRef as valid,
} from 'dsh-attachment-history';
import { image, session, user, toolResult, compact, child } from './fixtures.mjs';

test('current native format preserves multi-image ordinal and repeated attachment occurrence', () => {
  const s = session();
  assert.equal(s.header.version, 3);
  user(s, [image('a'), image('b'), image('a', { name: 'later.png' })]);
  toolResult(s, [image('b'), image('c')]);
  assert.deepEqual(collect(s).map(x => [x.ref.attachmentId, x.seq, x.ordinal, x.source]), [
    ['a', 0, 0, 'user-message'], ['b', 0, 1, 'user-message'], ['a', 0, 2, 'user-message'],
    ['b', 1, 0, 'tool-result'], ['c', 1, 1, 'tool-result'],
  ]);
  assert.equal(resolve(s, 'a').ordinal, 2);
  assert.equal(resolve(s, 'a', { seq: 0, ordinal: 0 }).ref.name, undefined);
  assert.throws(() => resolve(s, 'a', { seq: 0, ordinal: 1 }), /authorized occurrence/);
});

test('native compaction hides references while explicit recall authority survives', () => {
  const s = session();
  user(s, [image('a'), image('b')]);
  user(s, [image('a')]);
  assert.deepEqual(hidden(s), []);
  compact(s);
  assert.deepEqual(hidden(s).map(x => [x.ref.attachmentId, x.occurrence, x.occurrences]), [
    ['a', { seq: 1, ordinal: 0 }, 2], ['b', { seq: 0, ordinal: 1 }, 1],
  ]);
  assert.equal(resolve(s, 'a').seq, 1);
  toolResult(s, [resolve(s, 'a').ref]);
  assert.deepEqual(hidden(s).map(x => x.ref.attachmentId), ['b']);
  compact(s);
  assert.equal(hidden(s).find(x => x.ref.attachmentId === 'a').occurrences, 3);
});

test('native restore retains hidden indexes and exact v3 occurrence coordinates', () => {
  const s = session();
  user(s, [image('a'), image('b')]);
  compact(s);
  const restored = Session.create(s.id, s.snapshotEvents(), s.header, s.inheritedEventCount);
  assert.deepEqual(hidden(restored), hidden(s));
  assert.deepEqual(restored.deriveMessages(), s.deriveMessages());
});

test('fork inheritance never grants child authority; own suffix starts at exact native boundary', () => {
  const parent = session('parent');
  user(parent, [image('parent-only')]);
  compact(parent);
  const fork = child(parent);
  assert.equal(fork.inheritedEventCount, parent.seq);
  assert.deepEqual(collect(fork), []);
  assert.throws(() => resolve(fork, 'parent-only'), /authorized occurrence/);
  const own = user(fork, [image('child-a'), image('child-b')]);
  compact(fork);
  assert.deepEqual(collect(fork).map(x => [x.seq, x.ordinal]), [[own.seq, 0], [own.seq, 1]]);
  assert.deepEqual(collectEvents(fork.snapshotEvents(), fork.inheritedEventCount), collect(fork));
});

test('pending native Inbox splices grant no authority until a user message is appended', () => {
  const s = session();
  const msg = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'image', attachment: image('queued') }] });
  s.append('agent/inbox/spliced', { target: 'next-turn', start: 0, inserted: [msg] });
  assert.deepEqual(collect(s), []);
  s.append('user/message', msg, { surfaceOp: 'append' });
  assert.deepEqual(collect(s).map(x => x.ref.attachmentId), ['queued']);
});

test('assistant output and surface replacements cannot create image recall authority', () => {
  const s = session();
  user(s, [image('allowed')]);
  s.append('assistant/message', { turn: 1, step: 1, stream: [], message: createMessage({
    role: 'assistant', source: { kind: 'model', provider: 'fixture', model: 'vision' },
    content: [{ type: 'image', attachment: image('assistant') }],
  }) }, { surfaceOp: 'append' });
  s.append('user/message', createUserMessage({ source: { kind: 'plugin', plugin: 'fixture' },
    content: [{ type: 'image', attachment: image('replacement') }],
  }), { surfaceOp: { op: 'replace', startSeq: 0, endSeq: 0 }, sourceEventSeqs: [0] });
  assert.deepEqual(collect(s).map(x => x.ref.attachmentId), ['allowed']);
  assert.throws(() => resolve(s, 'replacement'), /authorized occurrence/);
});

test('only canonical tool envelopes authorize recursively ordered image blocks', () => {
  const nested = { type: 'tool-result', toolCallId: ToolCallId('nested'), content: [{ type: 'image', attachment: image('b') }] };
  const msg = createToolResultMessage({ callId: ToolCallId('outer'), isError: false,
    content: [{ type: 'image', attachment: image('a') }, nested] });
  const event = { seq: 3, type: 'tool/result', surfaceOp: 'append', data: { message: msg } };
  assert.deepEqual(collectEvents([event]).map(x => [x.ref.attachmentId, x.ordinal]), [['a', 0], ['b', 1]]);
  const mismatch = structuredClone(event);
  mismatch.data.message.source.callId = 'different';
  assert.deepEqual(collectEvents([mismatch]), []);
  assert.deepEqual(collectEvents([{ ...event, type: 'user/message', data: createUserMessage({ source: { kind: 'user' }, content: [nested] }) }]), []);
});

test('malformed metadata and invalid inherited offsets fail at the authority boundary', () => {
  const ref = image('a', { originalDimensions: { width: 10, height: 20 } });
  assert.equal(valid(ref), true);
  for (const bad of [null, [], { ...ref, bytes: 0 }, { ...ref, width: NaN }, { ...ref, mediaType: 'image/bmp' },
    { ...ref, name: 7 }, { ...ref, originalDimensions: { width: 0, height: 20 } }]) assert.equal(valid(bad), false);
  assert.deepEqual(collectEvents([null, [], {}, { seq: -1 }, { seq: '0', surfaceOp: 'append' }]), []);
  for (const bad of [-1, NaN, 0.5, undefined + 1]) assert.throws(() => collectEvents([], bad), /inheritedEventCount/);
});
