import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { createUserMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm';

export function image(id, extra = {}) {
  return { attachmentId: AttachmentId(id), mediaType: 'image/png', bytes: 10, width: 2, height: 2, ...extra };
}
export function session(id = 'fixture') { return Session.create(SessionId(id)); }
export function user(session, refs) {
  return session.append('user/message', createUserMessage({
    content: refs.map(attachment => ({ type: 'image', attachment })), source: { kind: 'user' },
  }), { surfaceOp: 'append' });
}
export function toolResult(session, refs, callId = 'fixture-call') {
  return session.append('tool/result', {
    turn: 1, step: 1,
    message: createToolResultMessage({ callId: ToolCallId(callId), isError: false,
      content: refs.map(attachment => ({ type: 'image', attachment })),
    }),
  }, { surfaceOp: 'append' });
}
export function compact(session) {
  const events = session.snapshotEvents();
  const nodes = [...session.surface.nodes].filter(seq => events[seq]?.type !== 'system/message');
  return session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Synthetic compacted context.' }],
    source: { kind: 'plugin', plugin: 'synthetic-compaction' },
  }), { surfaceOp: { op: 'replace', startSeq: nodes[0], endSeq: nodes.at(-1) }, sourceEventSeqs: nodes });
}
export function agent(session, options = { provider: 'fixture', model: 'vision' }) {
  // These extensions consume the public Agent read face; they never construct or drive an Inbox.
  return { id: session.id, session, options, status: 'idle' };
}
export function child(parent, id = 'child') {
  return Session.create(SessionId(id), parent.snapshotEvents(), {
    ...parent.header, id: SessionId(id), parentSession: parent.id,
    isSeeded: true, origin: 'subagent', createdAt: 1,
  }, parent.seq);
}
