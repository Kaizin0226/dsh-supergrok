import { describe, expect, it } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import {
  ToolCallId,
  createMessage,
  createToolResultMessage,
  createUserMessage,
  freezeMessage,
} from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  collectAuthorizedImageOccurrences,
  collectAuthorizedImageOccurrencesFromEvents,
  collectHiddenImageAttachments,
  isDurableImageAttachmentRef,
  resolveAuthorizedImageOccurrence,
} from 'dsh-attachment-history'

function image(id: string, name = `${id}.png`): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(id),
    mediaType: 'image/png',
    bytes: 10,
    width: 2,
    height: 2,
    name,
  }
}

function userImage(session: Session, ref: ImageAttachmentRef): number {
  return session.append('user/message', createUserMessage({
    content: [{ type: 'image', attachment: ref }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' }).seq
}

function replaceWithText(session: Session, start: number, end: number, sourceEventSeqs: number[]): void {
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'compacted' }],
      source: { kind: 'model', provider: 'mock', model: 'mock' },
    }),
  }, { surfaceOp: { op: 'replace', start, end }, sourceEventSeqs })
}

describe('authoritative image occurrence collection', () => {
  it('validates every durable image reference field at the persisted-object boundary', () => {
    const valid = image('valid')
    expect(isDurableImageAttachmentRef(valid)).toBe(true)
    expect(isDurableImageAttachmentRef({
      ...valid,
      originalDimensions: { width: 4, height: 4 },
    })).toBe(true)
    for (const invalid of [
      null,
      'image',
      [],
      { ...valid, attachmentId: '' },
      { ...valid, attachmentId: 1 },
      { ...valid, mediaType: 1 },
      { ...valid, mediaType: 'image/bmp' },
      { ...valid, bytes: '10' },
      { ...valid, bytes: 0 },
      { ...valid, width: '2' },
      { ...valid, width: 0 },
      { ...valid, height: '2' },
      { ...valid, height: 0 },
      { ...valid, name: 1 },
      { ...valid, originalDimensions: null },
      { ...valid, originalDimensions: 'large' },
      { ...valid, originalDimensions: { width: '4', height: 4 } },
      { ...valid, originalDimensions: { width: 0, height: 4 } },
      { ...valid, originalDimensions: { width: 4, height: '4' } },
      { ...valid, originalDimensions: { width: 4, height: 0 } },
    ]) expect(isDurableImageAttachmentRef(invalid)).toBe(false)
  })

  it('ignores malformed, non-append, inherited, and non-authoritative event carriers', () => {
    const valid = image('valid')
    const malformed = [
      null,
      [],
      'event',
      {},
      { seq: '1', surfaceOp: 'append', type: 'user/message', data: { content: [] } },
      { seq: 1, surfaceOp: 'append', type: 'user/message', data: { content: [{ type: 'image', attachment: valid }] } },
      { seq: 3, surfaceOp: { op: 'insert' }, type: 'user/message', data: { content: [{ type: 'image', attachment: valid }] } },
      { seq: 4, surfaceOp: 'append', type: 'user/message', data: null },
      { seq: 5, surfaceOp: 'append', type: 'user/message', data: [] },
      { seq: 6, surfaceOp: 'append', type: 'other', data: {} },
      { seq: 7, surfaceOp: 'append', type: 'user/message', data: { content: 'not-blocks' } },
      { seq: 8, surfaceOp: 'append', type: 'tool/result', data: { message: null } },
      { seq: 9, surfaceOp: 'append', type: 'tool/result', data: { message: [] } },
      { seq: 10, surfaceOp: 'append', type: 'tool/result', data: { message: { content: 'not-blocks' } } },
      {
        seq: 11,
        surfaceOp: 'append',
        type: 'tool/result',
        data: {
          message: {
            content: [null, [], 'block', { type: 'image', attachment: valid }, { type: 'tool-result', content: 'bad' }],
          },
        },
      },
      {
        seq: 12,
        surfaceOp: 'append',
        type: 'user/message',
        data: { content: [null, [], 'block', { type: 'image', attachment: null }] },
      },
    ]
    expect(collectAuthorizedImageOccurrencesFromEvents(malformed, 2)).toEqual([])
  })

  it('accepts direct user images and recursive typed tool-result images only', () => {
    const session = Session.create(SessionId('authority'))
    const user = image('user')
    const nested = image('nested')
    userImage(session, user)
    session.append('user/message', createUserMessage({
      content: [{
        type: 'tool-result',
        toolCallId: ToolCallId('not-a-user-authority'),
        content: [{ type: 'image', attachment: image('user-nested-ignored') }],
      }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('outer'),
        isError: false,
        content: [
          { type: 'image', attachment: image('direct-tool-content') },
          {
            type: 'tool-result',
            toolCallId: ToolCallId('empty-inner'),
            content: [{ type: 'text', text: 'not this one' }],
          },
          {
            type: 'tool-result',
            toolCallId: ToolCallId('inner'),
            content: [{ type: 'image', attachment: nested }],
          },
        ],
      }),
    }, { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1,
      step: 2,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'image', attachment: image('assistant-ignored') }],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })

    expect(collectAuthorizedImageOccurrences(session).map(item => ({
      id: item.ref.attachmentId,
      seq: item.seq,
      ordinal: item.ordinal,
      source: item.source,
    }))).toEqual([
      { id: 'user', seq: 0, ordinal: 0, source: 'user-message' },
      { id: 'direct-tool-content', seq: 2, ordinal: 0, source: 'tool-result' },
      { id: 'nested', seq: 2, ordinal: 1, source: 'tool-result' },
    ])
  })

  it('rejects forged tool-result envelopes and malformed nested carriers', () => {
    const first = image('first-outer')
    const second = image('second-outer')
    const forged = image('forged-sibling')
    const occurrences = collectAuthorizedImageOccurrencesFromEvents([{
      type: 'tool/result',
      seq: 7,
      surfaceOp: 'append',
      data: {
        message: {
          content: [
            { type: 'image', attachment: forged },
            { type: 'tool-result', content: [{ type: 'image', attachment: first }] },
            { type: 'tool-result', content: [{
              type: 'tool-result',
              content: [{ type: 'image', attachment: second }],
            }] },
          ],
        },
      },
    }])

    expect(occurrences).toEqual([])
  })

  it('subtracts actual surface references rather than guessing from compaction sequence', () => {
    const session = Session.create(SessionId('surface-subtraction'))
    const ref = image('retained')
    const original = session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: ToolCallId('original'),
        isError: false,
        content: [{ type: 'image', attachment: ref }],
      }),
    }, { surfaceOp: 'append' })
    const replacementContent = createToolResultMessage({
      callId: ToolCallId('original'),
      isError: false,
      content: [{ type: 'text', text: 'pruned text' }, { type: 'image', attachment: ref }],
    }).content
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: freezeMessage({
        ...original.data.message,
        content: replacementContent,
      }),
    }, {
      surfaceOp: { op: 'replace', start: original.seq, end: original.seq },
      sourceEventSeqs: [original.seq],
    })

    expect(collectHiddenImageAttachments(session)).toEqual([])
  })

  it('groups repeated ids, keeps the latest occurrence and resolves exact locators', () => {
    const session = Session.create(SessionId('grouped'))
    const first = userImage(session, image('same', 'fixture\\private\\first.png'))
    const second = userImage(session, image('same', '/tmp/latest.png'))
    replaceWithText(session, first, second, [first, second])

    expect(collectHiddenImageAttachments(session)).toEqual([{
      ref: image('same', '/tmp/latest.png'),
      occurrence: { seq: second, ordinal: 0 },
      occurrences: 2,
    }])
    expect(resolveAuthorizedImageOccurrence(session, AttachmentId('same')).seq).toBe(second)
    expect(resolveAuthorizedImageOccurrence(session, AttachmentId('same'), { seq: first, ordinal: 0 }).seq).toBe(first)
    expect(() => resolveAuthorizedImageOccurrence(session, AttachmentId('same'), { seq: 99, ordinal: 0 }))
      .toThrow('not an authorized occurrence in the current session')
    expect(() => resolveAuthorizedImageOccurrence(session, AttachmentId('other')))
      .toThrow('not an authorized occurrence in the current session')
  })

  it('sorts images from one event by newest ordinal when their sequence is equal', () => {
    const session = Session.create(SessionId('same-seq-order'))
    const original = session.append('user/message', createUserMessage({
      content: [
        { type: 'image', attachment: image('first') },
        { type: 'image', attachment: image('second') },
      ],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    replaceWithText(session, original.seq, original.seq, [original.seq])

    expect(collectHiddenImageAttachments(session).map(item => item.ref.attachmentId))
      .toEqual(['second', 'first'])
  })

  it('does not let a child recall an inherited fork-seed image', () => {
    const parent = Session.create(SessionId('parent'))
    userImage(parent, image('parent-only'))
    const childId = SessionId('child')
    const seed = parent.snapshotEvents()
    const child = Session.create(childId, seed, {
      version: SESSION_FORMAT_VERSION,
      id: childId,
      createdAt: 1,
      parentSession: parent.id,
      isSeeded: true,
      origin: 'subagent',
    }, seed.length)
    userImage(child, image('child-owned'))

    expect(collectAuthorizedImageOccurrences(child).map(item => item.ref.attachmentId))
      .toEqual(['child-owned'])
    expect(() => resolveAuthorizedImageOccurrence(child, AttachmentId('parent-only')))
      .toThrow('not an authorized occurrence in the current session')
    expect(resolveAuthorizedImageOccurrence(child, AttachmentId('child-owned')).ref.attachmentId).toBe('child-owned')
  })
})
