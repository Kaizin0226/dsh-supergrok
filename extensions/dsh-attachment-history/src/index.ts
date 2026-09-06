/**
 * Authoritative same-session durable image occurrence collection.
 *
 * Append-origin user messages and typed tool results are the only authority.
 * The pure event-array face serves stored-artifact export; the Session face
 * additionally subtracts the current surface for compaction-aware indexing.
 * @module dsh-attachment-history
 */

import type { AttachmentId, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Session } from '@deepseek-ai/dsh-session'

const IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** One image occurrence authorized by an append-origin transcript event. */
export interface ImageAttachmentOccurrence {
  /** Complete durable reference recovered from the owning event. */
  readonly ref: ImageAttachmentRef
  /** Owning append-origin event sequence. */
  readonly seq: number
  /** Zero-based image discovery order within that event. */
  readonly ordinal: number
  /** The only two event families that grant recall authority. */
  readonly source: 'user-message' | 'tool-result'
}

/** One hidden attachment grouped across every authorized occurrence in the current session. */
export interface HiddenImageAttachment {
  /** Most recent complete reference for this attachment id. */
  readonly ref: ImageAttachmentRef
  /** Most recent authorized occurrence, used as an unambiguous recall locator. */
  readonly occurrence: Readonly<Pick<ImageAttachmentOccurrence, 'seq' | 'ordinal'>>
  /** Number of authorized occurrences carrying this attachment id. */
  readonly occurrences: number
}

/**
 * Runtime shape check shared by live history and stored-artifact export.
 * @param value - unknown persisted attachment-reference candidate.
 * @returns whether the value is a complete supported durable image reference.
 */
export function isDurableImageAttachmentRef(value: unknown): value is ImageAttachmentRef {
  if (typeof value !== 'object' || value === null) return false
  const ref = value as Record<string, unknown>
  if (typeof ref['attachmentId'] !== 'string' || ref['attachmentId'].length === 0) return false
  if (typeof ref['mediaType'] !== 'string' || !IMAGE_MEDIA_TYPES.has(ref['mediaType'])) return false
  if (!Number.isSafeInteger(ref['bytes']) || (ref['bytes'] as number) <= 0) return false
  if (!Number.isSafeInteger(ref['width']) || (ref['width'] as number) <= 0) return false
  if (!Number.isSafeInteger(ref['height']) || (ref['height'] as number) <= 0) return false
  if (ref['name'] !== undefined && typeof ref['name'] !== 'string') return false
  const original = ref['originalDimensions']
  if (original === undefined) return true
  if (typeof original !== 'object' || original === null) return false
  const dimensions = original as Record<string, unknown>
  return Number.isSafeInteger(dimensions['width']) && (dimensions['width'] as number) > 0
    && Number.isSafeInteger(dimensions['height']) && (dimensions['height'] as number) > 0
}

function messageRecord(value: unknown, role: 'user' | 'assistant'): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const message = value as Record<string, unknown>
  const source = message['source']
  if (typeof message['id'] !== 'string' || message['id'].length === 0
    || message['role'] !== role
    || !Array.isArray(message['content'])
    || typeof source !== 'object' || source === null || Array.isArray(source)
    || typeof (source as Record<string, unknown>)['kind'] !== 'string'
    || (source as Record<string, unknown>)['kind'] === '') return undefined
  return message
}

function toolResultBlock(value: unknown, callId?: string): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const block = value as Record<string, unknown>
  if (block['type'] !== 'tool-result'
    || typeof block['toolCallId'] !== 'string' || block['toolCallId'] === ''
    || (callId !== undefined && block['toolCallId'] !== callId)
    || !Array.isArray(block['content'])
    || (block['isError'] !== undefined && typeof block['isError'] !== 'boolean')) return undefined
  return block
}

/** Walk ordered image blocks, optionally descending through typed tool-result content. */
function imageRefs(content: unknown, nestedToolResults: boolean): ImageAttachmentRef[] {
  if (!Array.isArray(content)) return []
  const refs: ImageAttachmentRef[] = []
  const walk = (blocks: readonly unknown[]): void => {
    for (const value of blocks) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      const block = value as Record<string, unknown>
      if (block['type'] === 'image') {
        if (isDurableImageAttachmentRef(block['attachment'])) refs.push(block['attachment'])
        continue
      }
      const nested = nestedToolResults ? toolResultBlock(block) : undefined
      if (nested !== undefined) {
        walk(nested['content'] as unknown[])
      }
    }
  }
  walk(content)
  return refs
}

/** Read images only from one canonical tool-result message envelope. */
function toolResultImageRefs(value: unknown): ImageAttachmentRef[] {
  const message = messageRecord(value, 'user')
  if (message === undefined) return []
  const source = message['source'] as Record<string, unknown>
  if (source['kind'] !== 'tool' || typeof source['callId'] !== 'string' || source['callId'] === '') return []
  const content = message['content'] as unknown[]
  if (content.length !== 1) return []
  const outer = toolResultBlock(content[0], source['callId'])
  return outer === undefined ? [] : imageRefs(outer['content'], true)
}

/**
 * Collect authorized occurrences from parsed durable events. Callers supply
 * the durable fork-inherited prefix length; inherited parent events are never
 * authority in the child session. For stored artifacts, derive that length
 * from the last `session/end-seed` marker event (the rc.1 durable projection
 * of a Session's `inheritedEventCount`); the live Session face below passes
 * `inheritedEventCount` directly.
 * @param events - parsed event records, optionally mixed with non-event records.
 * @param inheritedSeedLength - durable child-session fork-inherited prefix length.
 * @returns occurrences in ascending input and within-event order.
 */
export function collectAuthorizedImageOccurrencesFromEvents(
  events: readonly unknown[],
  inheritedSeedLength = 0,
): ImageAttachmentOccurrence[] {
  const occurrences: ImageAttachmentOccurrence[] = []
  for (const value of events) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const event = value as Record<string, unknown>
    const seq = event['seq']
    if (!Number.isSafeInteger(seq) || (seq as number) < inheritedSeedLength) continue
    if (event['surfaceOp'] !== 'append') continue
    const data = event['data']
    if (typeof data !== 'object' || data === null || Array.isArray(data)) continue
    const record = data as Record<string, unknown>
    let refs: ImageAttachmentRef[]
    let source: ImageAttachmentOccurrence['source']
    if (event['type'] === 'user/message') {
      const message = messageRecord(record, 'user')
      if (message === undefined) continue
      refs = imageRefs(message['content'], false)
      source = 'user-message'
    } else if (event['type'] === 'tool/result') {
      refs = toolResultImageRefs(record['message'])
      source = 'tool-result'
    } else {
      continue
    }
    for (const [ordinal, ref] of refs.entries()) {
      occurrences.push({ ref, seq: seq as number, ordinal, source })
    }
  }
  return occurrences
}

/**
 * Collect every image occurrence the current session itself appended.
 * Inbox, assistant, spliced, replacement, and inherited fork-seed records do
 * not grant authority.
 * @param session - current agent's live session.
 * @returns current-session occurrences in durable order.
 */
export function collectAuthorizedImageOccurrences(session: Session): ImageAttachmentOccurrence[] {
  return collectAuthorizedImageOccurrencesFromEvents(session.ownEvents(), session.inheritedEventCount)
}

/** Collect attachment ids still present anywhere on the current model-visible surface. */
function visibleAttachmentIds(session: Session): Set<string> {
  const visible = new Set<string>()
  for (const message of session.deriveMessages()) {
    for (const ref of imageRefs(message.content, true)) visible.add(ref.attachmentId)
  }
  return visible
}

/**
 * Derive authorized attachments no longer referenced by the current surface.
 * @param session - current agent's live session.
 * @returns newest-first stable hidden attachment list.
 */
export function collectHiddenImageAttachments(session: Session): HiddenImageAttachment[] {
  const visible = visibleAttachmentIds(session)
  const grouped = new Map<string, HiddenImageAttachment>()
  for (const occurrence of collectAuthorizedImageOccurrences(session)) {
    if (visible.has(occurrence.ref.attachmentId)) continue
    const existing = grouped.get(occurrence.ref.attachmentId)
    grouped.set(occurrence.ref.attachmentId, {
      ref: occurrence.ref,
      occurrence: { seq: occurrence.seq, ordinal: occurrence.ordinal },
      occurrences: (existing?.occurrences ?? 0) + 1,
    })
  }
  return [...grouped.values()].sort((left, right) =>
    right.occurrence.seq - left.occurrence.seq
    || right.occurrence.ordinal - left.occurrence.ordinal)
}

/**
 * Resolve one current-session occurrence without accepting caller storage metadata.
 * @param session - current agent session that must own the occurrence.
 * @param attachmentId - opaque attachment identity to resolve.
 * @param occurrence - optional exact durable sequence and within-event ordinal.
 * @returns the authorized current-session occurrence.
 */
export function resolveAuthorizedImageOccurrence(
  session: Session,
  attachmentId: AttachmentId,
  occurrence?: { seq: number; ordinal: number },
): ImageAttachmentOccurrence {
  const matches = collectAuthorizedImageOccurrences(session).filter(item =>
    item.ref.attachmentId === attachmentId
    && (occurrence === undefined
      || (item.seq === occurrence.seq && item.ordinal === occurrence.ordinal)))
  const selected = matches.at(-1)
  if (selected === undefined) {
    throw new Error('image attachment is not an authorized occurrence in the current session')
  }
  return selected
}

