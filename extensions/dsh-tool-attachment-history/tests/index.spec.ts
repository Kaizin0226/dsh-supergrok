import { describe, expect, it } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Inbox } from '@deepseek-ai/dsh-agent'
import { createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { renderHiddenImageIndex, safeImageDisplayName } from 'dsh-tool-attachment-history'

function ref(index: number, name?: string): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(`attachment-${String(index).padStart(2, '0')}-${'x'.repeat(64)}`),
    mediaType: 'image/png',
    bytes: 10,
    width: 2,
    height: 2,
    ...name === undefined ? {} : { name },
  }
}

function compactRef(index: number): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(`a${index}`),
    mediaType: 'image/png',
    bytes: 1,
    width: 1,
    height: 1,
  }
}

function hiddenAgent(
  count: number,
  makeRef: (index: number) => ImageAttachmentRef = index => ref(index, `fixture\\private\\secret-${index}\n.png`),
): Agent {
  const id = SessionId(`index-${count}`)
  const session = Session.create(id)
  const seqs: number[] = []
  for (let index = 0; index < count; index++) {
    seqs.push(session.append('user/message', createUserMessage({
      content: [{ type: 'image', attachment: makeRef(index) }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' }).seq)
  }
  if (seqs.length > 0) {
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'compacted' }],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      }),
    }, {
      surfaceOp: { op: 'replace', start: seqs[0]!, end: seqs.at(-1)! },
      sourceEventSeqs: seqs,
    })
  }
  return {
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: {} as Agent['ctx'],
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel: () => {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

describe('hidden historical image index', () => {
  it('strips path/control data from untrusted display names', () => {
    expect(safeImageDisplayName('fixture\\private\\folder\\photo\u0000.png')).toBe('photo.png')
    expect(safeImageDisplayName('/var/tmp/photo.png')).toBe('photo.png')
    expect(safeImageDisplayName(undefined)).toBeUndefined()
    expect(safeImageDisplayName('\u0000\n')).toBeUndefined()
    expect(safeImageDisplayName('x'.repeat(121))).toBe('x'.repeat(120))
  })

  it('returns no context when the current surface has no hidden image', () => {
    expect(renderHiddenImageIndex(hiddenAgent(0))).toBe('')
  })

  it('renders an unnamed compact entry without an omission footer', () => {
    const text = renderHiddenImageIndex(hiddenAgent(1, compactRef))
    expect(text).toContain('{"attachmentId":"a0"')
    expect(text).not.toContain('"name"')
    expect(text).not.toContain('Omitted')
  })

  it('reports a singular omission when the byte bound leaves one older entry', () => {
    const text = renderHiddenImageIndex(hiddenAgent(2, index => index === 0
      ? { ...compactRef(index), attachmentId: AttachmentId(`older-${'x'.repeat(4096)}`) }
      : compactRef(index)))
    expect(text.split('\n').filter(line => line.startsWith('{'))).toHaveLength(1)
    expect(text).toContain('Omitted 1 older historical image reference.')
  })

  it('is newest-first, bounded to 4096 UTF-8 bytes and reports omissions', () => {
    const text = renderHiddenImageIndex(hiddenAgent(48))
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(4096)
    expect(text).toContain('attachment-47-')
    expect(text).not.toContain('fixture\\private')
    expect(text).toMatch(/Omitted \d+ older historical image references\./u)
    expect(text.split('\n').filter(line => line.startsWith('{')).length).toBeLessThanOrEqual(32)
  })
})
