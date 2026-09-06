import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AttachmentId, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  SaveImageAttachment,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import {
  ToolCallId,
  createMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt, { renderContextSnapshot } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import * as AttachmentHistory from 'dsh-tool-attachment-history'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

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

class MemoryAttachmentStore extends AttachmentStore {
  readonly imageLimits: ImageAttachmentLimits = {
    maxImageBytes: 1024,
    maxImagesPerMessage: 20,
    maxMessageImageBytes: 4096,
    maxImagePixels: 100,
    maxImageDimension: 10,
    mediaTypes: ['image/png'],
  }

  readonly reads: ImageAttachmentRef[] = []

  validateImage(_input: SaveImageAttachment): Promise<void> { return Promise.resolve() }
  saveImage(_input: SaveImageAttachment): Promise<ImageAttachmentRef> { return Promise.reject(new Error('unused')) }
  readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment> {
    signal?.throwIfAborted()
    this.reads.push(ref)
    if (ref.attachmentId === 'corrupt') return Promise.reject(new Error('attachment integrity check failed'))
    if (ref.attachmentId === 'identity-drift') {
      return Promise.resolve({ ref: image('different-image'), data: Uint8Array.of(1, 2, 3) })
    }
    return Promise.resolve({ ref, data: Uint8Array.of(1, 2, 3) })
  }
}

/** Retrieve the Loader-mounted fixture store without keeping a parallel singleton. */
function store(ctx: Context): MemoryAttachmentStore {
  return ctx.attachments as MemoryAttachmentStore
}

/** Require and return the first diagnostic text block from a tool result. */
function firstText(result: ToolExecutionResult): string {
  const block = result.content[0]
  if (block?.type !== 'text') throw new Error('expected the first tool-result block to be text')
  return block.text
}

function agent(ctx: Context, id: string, ref?: ImageAttachmentRef): Agent {
  const scope = ctx.plugin(() => {})
  const sessionId = SessionId(id)
  const session = Session.create(sessionId)
  session.append('turn/start', { turn: 1 })
  session.append('request/header', {
    header: { config: { provider: 'mock', model: 'vision' } },
    reason: 'initial',
  })
  session.append('request/context', {
    provider: 'mock',
    model: 'vision',
    inputModalities: ['text', 'image'],
    backend: 'responses',
    capabilityProvenance: 'fixture-catalog',
    catalogRevision: 'fixture-r1',
  })
  if (ref !== undefined) {
    const original = session.append('user/message', createUserMessage({
      content: [{ type: 'image', attachment: ref }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'compacted' }],
        source: { kind: 'model', provider: 'mock', model: 'vision' },
      }),
    }, {
      surfaceOp: { op: 'replace', start: original.seq, end: original.seq },
      sourceEventSeqs: [original.seq],
    })
  }
  const value: Agent = {
    id: sessionId,
    options: { provider: 'mock', model: 'vision' },
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: scope.ctx,
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-attachment-history-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@fixture/attachments'",
    "- name: 'dsh-tool-attachment-history'",
    '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@fixture/attachments', MemoryAttachmentStore],
    ['dsh-tool-attachment-history', AttachmentHistory],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe('historical image recall through real Loader composition', () => {
  it('ships one generic tool-attachment-history row only in the grok-optimized user preset', async () => {
    const source = await readFile(join(process.cwd(), '..', 'grok-optimized-preset', 'agent.cordis.yml'), 'utf8')
    expect(source.match(/id: tool-attachment-history/gu)).toHaveLength(1)
    expect(source).toContain('name: dsh-tool-attachment-history')
    expect(source.indexOf('id: tool-fs-search')).toBeLessThan(source.indexOf('id: tool-attachment-history'))
  })

  it('snapshots the actual schema and logged runtime-context text, then returns a verified native image', async () => {
    const ctx = await boot()
    const ref = image('authorized-image', 'fixture\\private\\evidence.png')
    const owner = agent(ctx, 'loader-owner', ref)
    const schema = ctx.tools.schemas().find(item => item.name === 'recall_image_attachment')
    expect(schema).toMatchInlineSnapshot(`
      {
        "description": "Recall a durable historical image already authorized by the current session transcript after compaction or pruning hid it from the current context. Use only attachmentId and the optional occurrence advertised by the historical-image context; the harness derives session identity and all storage metadata. Requires the exact current route to explicitly support image input.",
        "name": "recall_image_attachment",
        "parameters": {
          "additionalProperties": false,
          "properties": {
            "attachmentId": {
              "description": "Opaque attachment id shown by the historical-image context.",
              "type": "string",
            },
            "occurrence": {
              "additionalProperties": false,
              "description": "Optional exact occurrence shown by the historical-image context.",
              "properties": {
                "ordinal": {
                  "type": "integer",
                },
                "seq": {
                  "type": "integer",
                },
              },
              "required": [
                "seq",
                "ordinal",
              ],
              "type": "object",
            },
          },
          "required": [
            "attachmentId",
          ],
          "type": "object",
        },
      }
    `)
    const assembly = await ctx.systemPrompt.assemble({ agent: owner })
    expect(renderContextSnapshot(assembly)).toMatchInlineSnapshot(`
      "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

      Historical image references no longer present on the current context surface. Use recall_image_attachment with attachmentId and, when shown, occurrence. The reference is advisory; recall verifies current-session authority, route capability, and stored bytes.
      {\"attachmentId\":\"authorized-image\",\"occurrence\":{\"seq\":3,\"ordinal\":0},\"occurrences\":1,\"name\":\"evidence.png\",\"mediaType\":\"image/png\",\"width\":2,\"height\":2}"
    `)
    expect(renderContextSnapshot(await ctx.systemPrompt.assemble({})))
      .not.toContain('Historical image references')
    expect(ctx.tools.executionMode({
      signal: new AbortController().signal,
      callId: ToolCallId('classify-recall'),
      name: 'recall_image_attachment',
      arguments: { attachmentId: 'authorized-image' },
      agent: owner,
    })).toEqual({ kind: 'parallel' })
    expect(ctx.tools.get('recall_image_attachment')?.presentCall?.({ attachmentId: 'authorized-image' }))
      .toEqual({ card: 'generic', title: 'Recall historical image', kind: 'read' })

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('recall'),
      name: 'recall_image_attachment',
      arguments: { attachmentId: 'authorized-image', occurrence: { seq: 3, ordinal: 0 } },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(result.content.map(block => block.type)).toEqual(['text', 'image'])
    expect(result.content[1]).toEqual({ type: 'image', attachment: ref })
    expect(store(ctx).reads).toEqual([ref])
  }, 30_000)

  it('preserves optional original dimensions, omits an absent name, and reports repeated authority', async () => {
    const ctx = await boot()
    const ref: ImageAttachmentRef = {
      attachmentId: AttachmentId('repeated-image'),
      mediaType: 'image/png',
      bytes: 10,
      width: 2,
      height: 2,
      originalDimensions: { width: 4, height: 4 },
    }
    const owner = agent(ctx, 'repeated-owner', ref)
    const repeated = owner.session.append('user/message', createUserMessage({
      content: [{ type: 'image', attachment: ref }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    owner.session.append('assistant/message', {
      turn: 1,
      step: 2,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'compacted again' }],
        source: { kind: 'model', provider: 'mock', model: 'vision' },
      }),
    }, {
      surfaceOp: { op: 'replace', start: repeated.seq, end: repeated.seq },
      sourceEventSeqs: [repeated.seq],
    })

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('repeated'),
      name: 'recall_image_attachment',
      arguments: { attachmentId: 'repeated-image' },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(firstText(result)).toContain('(2 authorized occurrences).')
    expect(firstText(result)).not.toContain('display name')
    expect(result.content[1]).toEqual({ type: 'image', attachment: ref })
  }, 30_000)

  it('rejects missing ownership, blank ids, malformed occurrences, and non-object argument roots', async () => {
    const ctx = await boot()
    const owner = agent(ctx, 'invalid-inputs', image('authorized'))
    const calls: Array<{ label: string; arguments: unknown; agent?: Agent; message?: string }> = [
      { label: 'no-agent', arguments: { attachmentId: 'authorized' }, message: 'requires an owning agent session' },
      { label: 'blank-id', arguments: { attachmentId: '   ' }, agent: owner, message: 'non-empty string' },
      {
        label: 'unsafe-seq',
        arguments: { attachmentId: 'authorized', occurrence: { seq: Number.MAX_SAFE_INTEGER + 1, ordinal: 0 } },
        agent: owner,
        message: 'non-negative integers',
      },
      {
        label: 'unsafe-ordinal',
        arguments: { attachmentId: 'authorized', occurrence: { seq: 0, ordinal: Number.MAX_SAFE_INTEGER + 1 } },
        agent: owner,
        message: 'non-negative integers',
      },
      {
        label: 'negative-seq',
        arguments: { attachmentId: 'authorized', occurrence: { seq: -1, ordinal: 0 } },
        agent: owner,
        message: 'non-negative integers',
      },
      {
        label: 'negative-ordinal',
        arguments: { attachmentId: 'authorized', occurrence: { seq: 0, ordinal: -1 } },
        agent: owner,
        message: 'non-negative integers',
      },
      { label: 'null-root', arguments: null, agent: owner },
      { label: 'array-root', arguments: [], agent: owner },
      { label: 'string-root', arguments: 'forged', agent: owner },
    ]

    for (const item of calls) {
      const result = await ctx.tools.execute({
        signal: new AbortController().signal,
        callId: ToolCallId(item.label),
        name: 'recall_image_attachment',
        arguments: item.arguments,
        ...item.agent === undefined ? {} : { agent: item.agent },
      })
      expect(result.isError, item.label).toBe(true)
      if (item.message !== undefined) {
        expect(firstText(result), item.label).toContain(item.message)
      }
    }
    expect(store(ctx).reads).toEqual([])
  }, 30_000)

  it.each([
    {
      label: 'unknown backend',
      mutate: (owner: Agent) => owner.session.append('request/context', {
        provider: 'mock', model: 'vision', inputModalities: ['text', 'image'],
      }),
      message: 'unknown backend',
    },
    {
      label: 'unrecognized backend',
      mutate: (owner: Agent) => owner.session.append('request/context', {
        provider: 'mock', model: 'vision', inputModalities: ['text', 'image'], backend: 'future-responses' as never,
      }),
      message: 'unknown backend',
    },
    {
      label: 'text-only route',
      mutate: (owner: Agent) => owner.session.append('request/context', {
        provider: 'mock', model: 'vision', inputModalities: ['text'], backend: 'responses',
      }),
      message: 'does not explicitly declare image input',
    },
    {
      label: 'route drift',
      mutate: (owner: Agent) => owner.session.append('request/context', {
        provider: 'mock', model: 'other', inputModalities: ['text', 'image'], backend: 'responses',
      }),
      message: 'unavailable or have drifted',
    },
  ])('fails closed before storage I/O for $label', async ({ mutate, message }) => {
    const ctx = await boot()
    const owner = agent(ctx, 'fail-closed', image('authorized'))
    mutate(owner)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('rejected'),
      name: 'recall_image_attachment',
      arguments: { attachmentId: 'authorized' },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(firstText(result)).toContain(message)
    expect(store(ctx).reads).toEqual([])
  }, 30_000)

  it('rejects a forged or other-session id before storage I/O', async () => {
    const ctx = await boot()
    const owner = agent(ctx, 'session-a', image('only-a'))
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('forged'),
      name: 'recall_image_attachment',
      arguments: { attachmentId: 'only-b' },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(firstText(result)).toContain('not an authorized occurrence in the current session')
    expect(store(ctx).reads).toEqual([])
  }, 30_000)

  it.each(['path', 'url', 'mime', 'mediaType', 'bytes', 'sessionId'])(
    'rejects the undeclared %s argument before storage I/O',
    async (field) => {
      const ctx = await boot()
      const owner = agent(ctx, `extra-${field}`, image('authorized'))
      const result = await ctx.tools.execute({
        signal: new AbortController().signal,
        callId: ToolCallId(`extra-${field}`),
        name: 'recall_image_attachment',
        arguments: { attachmentId: 'authorized', [field]: 'forged' },
        agent: owner,
      })
      expect(result.isError).toBe(true)
      expect(firstText(result)).toContain('is not a declared recall argument')
      expect(store(ctx).reads).toEqual([])
    },
    30_000,
  )

  it.each([
    ['corrupt', 'attachment integrity check failed'],
    ['identity-drift', 'different image identity'],
  ])('returns no image when the store rejects %s', async (id, message) => {
    const ctx = await boot()
    const ref = image(id)
    const owner = agent(ctx, `store-${id}`, ref)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId(`store-${id}`),
      name: 'recall_image_attachment',
      arguments: { attachmentId: id },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(result.content.some(block => block.type === 'image')).toBe(false)
    expect(firstText(result)).toContain(message)
    expect(store(ctx).reads).toEqual([ref])
  }, 30_000)
})
