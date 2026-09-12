/**
 * Same-session historical image recall plus a bounded hidden-image context.
 * The session log remains authority and the attachment service remains the
 * only byte store and integrity checker.
 * @module dsh-tool-attachment-history
 */

import { Buffer } from 'node:buffer'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool, ToolArgsError } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolDefinition, ToolExecution } from '@deepseek-ai/dsh-tools'
import {
  collectAuthorizedImageOccurrences,
  collectHiddenImageAttachments,
  resolveAuthorizedImageOccurrence,
} from 'dsh-attachment-history'

export * from 'dsh-attachment-history'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-attachment-history'
/** Services required for tool registration, native reads, and durable context assembly. */
export const inject = ['attachments', 'systemPrompt', 'tools']

const MAX_INDEX_BYTES = 4096
const MAX_INDEX_ATTACHMENTS = 32
const INDEX_CONTEXT_NAME = 'attachment-history:hidden-images'
const RECALL_ARGUMENT_KEYS = new Set(['attachmentId', 'occurrence'])

const IMAGE_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: true,
  properties: {
    attachmentId: { type: 'string', required: true },
    mediaType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], required: true },
    bytes: { type: 'integer', required: true },
    width: { type: 'integer', required: true },
    height: { type: 'integer', required: true },
    name: { type: 'string' },
    originalDimensions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        width: { type: 'integer', required: true },
        height: { type: 'integer', required: true },
      },
    },
  },
} as const

/** Canonical output retained in the tool/result event. */
export interface RecalledImageValue {
  attachmentId: AttachmentId
  occurrence: { seq: number; ordinal: number }
  occurrences: number
  image: {
    attachmentId: AttachmentId
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name?: string
    originalDimensions?: { width: number; height: number }
  }
}

/**
 * Strip control characters, path prefixes, and excess display text from an untrusted name.
 * @param value - optional untrusted stored display name.
 * @returns a bounded basename for display, or undefined when no safe text remains.
 */
export function safeImageDisplayName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const leaf = value.slice(Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\')) + 1)
  const clean = leaf.replace(/[\u0000-\u001F\u007F]/gu, '').trim().slice(0, 120)
  return clean.length === 0 ? undefined : clean
}

/** Re-brand the validated canonical output into the native image reference. */
function imageRefFromValue(image: RecalledImageValue['image']): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
    ...image.originalDimensions === undefined ? {} : { originalDimensions: { ...image.originalDimensions } },
  }
}

/** Render one recalled image as a short evidence envelope plus its native block. */
function recalledImageContent(value: RecalledImageValue): ContentBlock[] {
  const name = safeImageDisplayName(value.image.name)
  return [{
    type: 'text',
    text: `Recalled historical image ${JSON.stringify(value.attachmentId)}`
      + ` from session occurrence ${value.occurrence.seq}:${value.occurrence.ordinal}`
      + ` (${value.occurrences} authorized occurrence${value.occurrences === 1 ? '' : 's'})`
      + `${name === undefined ? '' : `, display name ${JSON.stringify(name)}`}.`,
  }, {
    type: 'image',
    attachment: imageRefFromValue(value.image),
  }]
}

/**
 * Resolve the native routed model and require explicit image input. Uses the
 * same public route APIs as the target host's read_image; no provider requests
 * or legacy capability event are used to decide attachment access.
 * @param ctx - current scoped native services.
 * @param exec - exact tool execution, including its native cancellation signal.
 */
export async function assertCurrentRouteCanRecallImage(ctx: Context, exec: ToolExecution): Promise<void> {
  const routed = exec.agent?.session.requestHeader()?.config
  const provider = routed?.provider ?? exec.agent?.options.provider
  const model = routed?.model ?? exec.agent?.options.model
  const llm = ctx.get('llm')
  if (provider === undefined || model === undefined || llm === undefined) {
    throw new Error('cannot recall an image: exact current model route is unavailable')
  }
  const info = await llm.resolveModelInfo(provider, model, exec.signal)
  if (info.inputModalities?.includes('image') !== true) {
    throw new Error(`cannot recall an image: current model ${JSON.stringify(model)} does not explicitly declare image input`)
  }
}

/** Build one sanitized JSON line for the hidden-image context. */
function hiddenLine(item: ReturnType<typeof collectHiddenImageAttachments>[number]): string {
  const displayName = safeImageDisplayName(item.ref.name)
  return JSON.stringify({
    attachmentId: item.ref.attachmentId,
    occurrence: item.occurrence,
    occurrences: item.occurrences,
    ...displayName === undefined ? {} : { name: displayName },
    mediaType: item.ref.mediaType,
    width: item.ref.width,
    height: item.ref.height,
  })
}

/**
 * Render the bounded newest-first advisory index. Integrity is deliberately
 * deferred to tool execution and `AttachmentStore.readImage`.
 * @param agent - agent whose current session owns the index.
 * @returns model-visible context text, or an empty string when nothing is hidden.
 */
export function renderHiddenImageIndex(agent: Agent): string {
  const hidden = collectHiddenImageAttachments(agent.session)
  if (hidden.length === 0) return ''
  const header = 'Historical image references no longer present on the current context surface. '
    + 'Use recall_image_attachment with attachmentId and, when shown, occurrence. '
    + 'The reference is advisory; recall verifies current-session authority, route capability, and stored bytes.'
  const lines = [header]
  const candidates = hidden.slice(0, MAX_INDEX_ATTACHMENTS)
  for (const item of candidates) {
    const line = hiddenLine(item)
    const includedAfter = lines.length
    const omittedAfter = hidden.length - includedAfter
    const footer = omittedAfter > 0 ? `Omitted ${omittedAfter} older historical image reference${omittedAfter === 1 ? '' : 's'}.` : undefined
    const candidate = [...lines, line, ...footer === undefined ? [] : [footer]].join('\n')
    if (Buffer.byteLength(candidate, 'utf8') > MAX_INDEX_BYTES) break
    lines.push(line)
  }
  const included = lines.length - 1
  const omitted = hidden.length - included
  if (omitted > 0) lines.push(`Omitted ${omitted} older historical image reference${omitted === 1 ? '' : 's'}.`)
  return lines.join('\n')
}

/** Close the typed helper's intentionally open parameter root for this authority-sensitive tool. */
function closeRecallArgumentRoot(tool: ToolDefinition): ToolDefinition {
  return {
    ...tool,
    parameters: { ...tool.parameters, additionalProperties: false },
    async execute(args, exec) {
      if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
        const extras = Object.keys(args).filter(key => !RECALL_ARGUMENT_KEYS.has(key))
        if (extras.length > 0) {
          throw new ToolArgsError(extras.map(key => `${JSON.stringify(key)} is not a declared recall argument`))
        }
      }
      return tool.execute(args, exec)
    },
  }
}

/** Register the recall tool and the dynamic hidden-image context projection. */
export function apply(ctx: Context): void {
  ctx.systemPrompt.context({
    name: INDEX_CONTEXT_NAME,
    order: 95,
    text: context => context.agent === undefined ? '' : renderHiddenImageIndex(context.agent),
  })
  ctx.tools.register(closeRecallArgumentRoot(defineTool({
    name: 'recall_image_attachment',
    description: 'Recall a durable historical image already authorized by the current session transcript after compaction or pruning hid it from the current context. '
      + 'Use only attachmentId and the optional occurrence advertised by the historical-image context; the harness derives session identity and all storage metadata. '
      + 'Requires the exact current route to explicitly support image input.',
    parameters: {
      attachmentId: { type: 'string', required: true, description: 'Opaque attachment id shown by the historical-image context.' },
      occurrence: {
        type: 'object',
        additionalProperties: false,
        description: 'Optional exact occurrence shown by the historical-image context.',
        properties: {
          seq: { type: 'integer', required: true },
          ordinal: { type: 'integer', required: true },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          attachmentId: { type: 'string', required: true },
          occurrence: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              seq: { type: 'integer', required: true },
              ordinal: { type: 'integer', required: true },
            },
          },
          occurrences: { type: 'integer', required: true },
          image: IMAGE_VALUE_SCHEMA,
        },
      },
      render: (_args, value) => recalledImageContent(value as RecalledImageValue),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('recall_image_attachment requires an owning agent session')
      if (args.attachmentId.trim().length === 0) throw new Error('attachmentId must be a non-empty string')
      if (args.occurrence !== undefined
        && (!Number.isSafeInteger(args.occurrence.seq)
          || !Number.isSafeInteger(args.occurrence.ordinal)
          || args.occurrence.seq < 0
          || args.occurrence.ordinal < 0)) {
        throw new Error('occurrence seq and ordinal must be non-negative integers')
      }
      await assertCurrentRouteCanRecallImage(ctx, exec)
      const attachmentId = AttachmentId(args.attachmentId)
      const occurrence = resolveAuthorizedImageOccurrence(exec.agent.session, attachmentId, args.occurrence)
      const stored = await ctx.attachments.readImage(occurrence.ref, exec.signal)
      if (stored.ref.attachmentId !== occurrence.ref.attachmentId) {
        throw new Error('attachment store returned a different image identity')
      }
      const occurrences = collectAuthorizedImageOccurrences(exec.agent.session)
        .filter(item => item.ref.attachmentId === stored.ref.attachmentId).length
      return {
        attachmentId: stored.ref.attachmentId,
        occurrence: { seq: occurrence.seq, ordinal: occurrence.ordinal },
        occurrences,
        image: {
          attachmentId: stored.ref.attachmentId,
          mediaType: stored.ref.mediaType,
          bytes: stored.ref.bytes,
          width: stored.ref.width,
          height: stored.ref.height,
          ...stored.ref.name === undefined ? {} : { name: stored.ref.name },
          ...stored.ref.originalDimensions === undefined
            ? {}
            : { originalDimensions: { ...stored.ref.originalDimensions } },
        },
      }
    },
    presentCall(): GenericCallView {
      return { card: 'generic', title: 'Recall historical image', kind: 'read' }
    },
  })))
}
