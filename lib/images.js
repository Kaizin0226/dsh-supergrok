// Adapted Grok Build material: Apache-2.0; see NOTICE and THIRD-PARTY-NOTICES.md.
/** Durable DSH attachment projection for Grok multimodal requests. */
import { LlmError } from '@deepseek-ai/dsh-llm';
import {
  IMAGE_MAX_ENCODED_BYTES,
  IMAGE_MAX_PIXELS,
  IMAGE_MAX_SIDE,
  IMAGE_MIN_PIXELS,
  IMAGE_MIN_SIDE,
} from './constants.js';

const REQUEST_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function attachmentKey(attachment) {
  const id = attachment?.attachmentId;
  if (typeof id !== 'string' || id.length === 0) {
    throw new LlmError('SuperGrok 图片引用无效', 'INVALID_REQUEST');
  }
  return id;
}

function collectImageRefs(content, refs) {
  for (const block of content ?? []) {
    if (block?.type === 'image') {
      const key = attachmentKey(block.attachment);
      if (!refs.has(key)) refs.set(key, block.attachment);
    } else if (block?.type === 'tool-result') {
      collectImageRefs(block.content, refs);
    }
  }
}

function contentHasImage(content) {
  return (content ?? []).some((block) => (
    block?.type === 'image'
    || (block?.type === 'tool-result' && contentHasImage(block.content))
  ));
}

/** Bind prepared bytes to all image occurrences, not only unique attachment ids. */
export function imageRequestSignature(messages) {
  const refs = [];
  const visit = (content) => {
    for (const block of content ?? []) {
      if (block?.type === 'image') refs.push(block.attachment);
      else if (block?.type === 'tool-result') visit(block.content);
    }
  };
  for (const message of messages) visit(message.content);
  return JSON.stringify(refs);
}

function requestPolicy(ref) {
  const { width, height } = ref ?? {};
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new LlmError('SuperGrok 图片尺寸元数据无效', 'INVALID_REQUEST');
  }
  const sourcePixels = width * height;
  if (!Number.isSafeInteger(sourcePixels) || sourcePixels <= 0) {
    throw new LlmError('SuperGrok 图片像素元数据无效', 'INVALID_REQUEST');
  }
  const scale = Math.min(
    1,
    IMAGE_MAX_SIDE / width,
    IMAGE_MAX_SIDE / height,
    Math.sqrt(IMAGE_MAX_PIXELS / sourcePixels),
  );
  return Object.freeze({
    maxPixels: Math.max(1, Math.floor(sourcePixels * scale * scale)),
    maxBytes: IMAGE_MAX_ENCODED_BYTES,
  });
}

function validateRequestImage(version, ref) {
  if (version === null || typeof version !== 'object') {
    throw new LlmError('DSH attachment service 返回了无效图片', 'INVALID_REQUEST');
  }
  if (!(version.data instanceof Uint8Array)
    || !Number.isSafeInteger(version.bytes)
    || version.bytes <= 0
    || version.bytes !== version.data.byteLength
    || version.bytes > IMAGE_MAX_ENCODED_BYTES) {
    throw new LlmError('SuperGrok 请求图片字节数不符合协议限制', 'INVALID_REQUEST');
  }
  if (!REQUEST_MEDIA_TYPES.has(version.mediaType)) {
    throw new LlmError('SuperGrok 请求图片格式不受支持', 'UNSUPPORTED_CONTENT');
  }
  if (version.depth !== 'uchar' || version.space !== 'srgb') {
    throw new LlmError('SuperGrok 请求图片色彩格式不受支持', 'UNSUPPORTED_CONTENT');
  }
  if (!Number.isSafeInteger(version.width) || !Number.isSafeInteger(version.height)
    || version.width < IMAGE_MIN_SIDE || version.height < IMAGE_MIN_SIDE
    || version.width > IMAGE_MAX_SIDE || version.height > IMAGE_MAX_SIDE
    || version.width * version.height < IMAGE_MIN_PIXELS
    || version.width * version.height > IMAGE_MAX_PIXELS) {
    throw new LlmError('SuperGrok 请求图片尺寸不符合协议限制', 'UNSUPPORTED_CONTENT');
  }
  if (attachmentKey(version.attachment) !== attachmentKey(ref)) {
    throw new LlmError('DSH attachment service 返回了不匹配的图片引用', 'INVALID_REQUEST');
  }
  return Object.freeze({
    attachmentId: attachmentKey(ref),
    variantId: version.variantId,
    original: Object.freeze({ width: ref.width, height: ref.height, bytes: ref.bytes, mediaType: ref.mediaType }),
    dataUrl: `data:${version.mediaType};base64,${Buffer.from(version.data).toString('base64')}`,
    mediaType: version.mediaType,
    bytes: version.bytes,
    width: version.width,
    height: version.height,
  });
}

/**
 * Resolve every durable image in first-appearance order before inference I/O.
 * Repeated references share one deterministic request projection.
 */
export async function prepareRequestImages(messages, attachments, signal) {
  if (attachments === undefined || typeof attachments.readImageRequest !== 'function') {
    throw new LlmError('SuperGrok 图片输入需要 DSH durable attachment service', 'UNSUPPORTED_CONTENT');
  }
  if (signal?.aborted) {
    throw new LlmError('SuperGrok 图片准备已由调用方取消', 'ABORTED');
  }
  const refs = new Map();
  for (const message of messages ?? []) {
    if (message?.role !== 'user' && contentHasImage(message?.content)) {
      throw new LlmError(
        `SuperGrok 无法在 ${String(message?.role ?? 'unknown')} 消息中表示图片`,
        'UNSUPPORTED_CONTENT',
      );
    }
    collectImageRefs(message?.content, refs);
  }
  try {
    const ordered = [...refs.entries()];
    const projected = await Promise.all(ordered.map(([, ref]) => (
      attachments.readImageRequest(ref, requestPolicy(ref), signal)
    )));
    return new Map(ordered.map(([key, ref], index) => [key, validateRequestImage(projected[index], ref)]));
  } catch (error) {
    if (signal?.aborted) {
      throw new LlmError('SuperGrok 图片准备已由调用方取消', 'ABORTED');
    }
    if (error instanceof LlmError) throw error;
    // Attachment backends may include local storage paths in their errors.
    // Keep the adapter-visible failure stable and deliberately omit the cause.
    throw new LlmError('DSH attachment service 无法准备 SuperGrok 请求图片', 'INVALID_REQUEST');
  }
}

/** Resolve one already-prepared data URL without exposing durable storage paths. */
export function requestImageDataUrl(prepared, attachment) {
  const image = prepared?.get?.(attachmentKey(attachment));
  if (image === undefined || typeof image.dataUrl !== 'string' || !image.dataUrl.startsWith('data:image/')) {
    throw new LlmError('SuperGrok 请求图片尚未准备', 'INVALID_REQUEST');
  }
  return image.dataUrl;
}

/** Describe prepared image versions without claiming the model has received them. */
export function requestImageNotices(prepared) {
  return [...prepared.values()].filter(image => image.width !== image.original.width
    || image.height !== image.original.height || image.bytes !== image.original.bytes
    || image.mediaType !== image.original.mediaType).map((image) => {
    const before = image.original;
    const resized = before.width !== image.width || before.height !== image.height;
    const action = resized ? '已为发送缩放图片' : '已为发送重新编码图片';
    return Object.freeze({
      key: `image:${image.attachmentId}:${image.variantId ?? `${image.width}x${image.height}:${image.bytes}:${image.mediaType}`}`,
      summary: `${action}：${before.width}×${before.height} → ${image.width}×${image.height}；尚未确认模型接收`,
      text: `${action}。历史图片引用 ${image.attachmentId}：${before.width}×${before.height}、${before.bytes} bytes → ${image.width}×${image.height}、${image.bytes} bytes。缩放=${resized}，重新编码=true。细节可能因发送版本的处理而丢失；这些事实只表示输入准备完成，不证明请求成功或模型已查看图片。`,
    });
  });
}
