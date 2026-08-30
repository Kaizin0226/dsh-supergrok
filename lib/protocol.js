/** Fixed Grok Build protocol snapshot helpers. */
import { randomUUID } from 'node:crypto';
import { attributionHeaders } from '@deepseek-ai/dsh-llm';
import {
  CLIENT_IDENTIFIER,
  CLIENT_MODE,
  CLIENT_VERSION,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
} from './constants.js';

const HEADER_VALUE = /^[\x20-\x7e]+$/;
const MODEL_ID = /^grok-[a-z0-9][a-z0-9._-]*$/;
const EFFORT_ID = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_CATALOG_MODELS = 256;
const MAX_REASONING_EFFORTS = 16;
const MAX_MODEL_ID_BYTES = 128;
const MAX_EFFORT_ID_BYTES = 32;
const MAX_NAME_BYTES = 256;
const MAX_DESCRIPTION_BYTES = 2048;

function safeHeader(value, label) {
  const text = String(value ?? '');
  if (text.length === 0 || text.length > 128 || !HEADER_VALUE.test(text)) {
    throw new TypeError(`${label} is not a safe non-empty HTTP header value`);
  }
  return text;
}

function safeAccessToken(value) {
  const text = String(value ?? '');
  if (text.length === 0 || text.length > 8192 || /[\r\n]/.test(text) || !HEADER_VALUE.test(text)) {
    throw new TypeError('access token is not a safe HTTP authorization value');
  }
  return text;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function safeDisplayText(value, label, maxBytes) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes
    || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`catalog ${label} is invalid`);
  }
  return value;
}

export function assertSafeModelId(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_MODEL_ID_BYTES
    || !MODEL_ID.test(value)) {
    throw new TypeError(`unsafe model id: ${String(value)}`);
  }
  return value;
}

export function assertSafeReasoningEffort(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_EFFORT_ID_BYTES
    || !EFFORT_ID.test(value)) {
    throw new TypeError(`unsafe reasoning effort: ${String(value)}`);
  }
  return value;
}

/**
 * Header set derived from
 * xai-org/grok-build@bc7f02eddd3d84085849dc19ed216f11c23b0571.
 * Caller identity is deliberately the DSH plugin, not `grok-shell`.
 */
export function buildProtocolHeaders(options = {}) {
  const allowed = new Set(['accessToken', 'model', 'sessionId', 'conversationId', 'requestId', 'operation']);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`unknown protocol option: ${key}`);
  }
  const {
    accessToken,
    model = DEFAULT_MODEL,
    sessionId,
    conversationId,
    requestId,
    operation = 'catalog',
  } = options;
  const safeModel = assertSafeModelId(model);
  if (operation !== 'catalog' && operation !== 'inference') {
    throw new TypeError(`unknown protocol operation: ${String(operation)}`);
  }
  const token = safeAccessToken(accessToken);
  const req = safeHeader(requestId ?? randomUUID(), 'request id');
  const session = safeHeader(sessionId ?? randomUUID(), 'session id');
  const conversation = safeHeader(conversationId ?? session, 'conversation id');
  return {
    ...attributionHeaders(),
    authorization: `Bearer ${token}`,
    'x-xai-token-auth': 'xai-grok-cli',
    'x-authenticateresponse': 'authenticate-response',
    'x-grok-client-mode': CLIENT_MODE,
    'x-grok-client-identifier': CLIENT_IDENTIFIER,
    'x-grok-client-version': CLIENT_VERSION,
    'x-grok-model-override': safeModel,
    'x-grok-req-id': req,
    'x-grok-session-id': session,
    'x-grok-conv-id': conversation,
    ...(operation === 'inference'
      ? { accept: 'text/event-stream', 'content-type': 'application/json' }
      : { accept: 'application/json' }),
  };
}

export function assertFixedInvocation({ provider, model, reasoningEffort, permission } = {}) {
  if (provider !== undefined && provider !== 'grok-oauth') {
    throw new TypeError(`provider drift: ${String(provider)}`);
  }
  const safeModel = assertSafeModelId(model);
  const safeEffort = reasoningEffort === undefined ? undefined : assertSafeReasoningEffort(reasoningEffort);
  if (permission !== undefined && permission !== 'read-only') {
    throw new TypeError(`permission drift: ${String(permission)}`);
  }
  return Object.freeze({ model: safeModel, ...(safeEffort === undefined ? {} : { reasoningEffort: safeEffort }) });
}

function candidates(values) {
  return values.filter((value) => value !== undefined && value !== null);
}

function signature(value) {
  return typeof value === 'object' ? JSON.stringify(value) : `${typeof value}:${String(value)}`;
}

function consistentAlias(label, values, normalize = (value) => value) {
  const normalized = candidates(values).map(normalize);
  if (normalized.length === 0) return undefined;
  const expected = signature(normalized[0]);
  if (normalized.some((value) => signature(value) !== expected)) {
    throw new TypeError(`catalog ${label} aliases conflict`);
  }
  return normalized[0];
}

function booleanAlias(label, values) {
  return consistentAlias(label, values, (value) => {
    if (typeof value !== 'boolean') throw new TypeError(`catalog ${label} flag is invalid`);
    return value;
  });
}

function normalizeEffort(item) {
  const object = isRecord(item) ? item : undefined;
  if (typeof item !== 'string' && object === undefined) throw new TypeError('catalog reasoning effort is invalid');
  // Grok Build's fixed protocol snapshot treats `id` as the selector-facing
  // value and `value` as the canonical value sent on the wire. They may differ
  // (for example `deep` -> `xhigh`) and therefore must never be treated as
  // aliases. Older snapshots used id-only objects, which remain safe because
  // their wire value is identical to the selector id.
  const wireValue = typeof item === 'string'
    ? assertSafeReasoningEffort(item)
    : object.value === undefined
      ? (object.id === undefined ? undefined : assertSafeReasoningEffort(object.id))
      : assertSafeReasoningEffort(object.value);
  if (wireValue === undefined) throw new TypeError('catalog reasoning effort has no canonical value');
  const id = object?.id === undefined ? wireValue : assertSafeReasoningEffort(object.id);
  const defaultFlag = object?.default;
  if (defaultFlag !== undefined && typeof defaultFlag !== 'boolean') {
    throw new TypeError('catalog reasoning effort default flag is invalid');
  }
  const name = safeDisplayText(firstDefined(object?.name, object?.label), 'reasoning effort name', MAX_NAME_BYTES)
    ?? `${id.charAt(0).toUpperCase()}${id.slice(1)} Effort`;
  const description = safeDisplayText(object?.description, 'reasoning effort description', MAX_DESCRIPTION_BYTES);
  return Object.freeze({
    effort: Object.freeze({
      id,
      wireValue,
      name,
      ...(description === undefined ? {} : { description }),
    }),
    defaultFlag,
  });
}

function normalizeEffortList(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_REASONING_EFFORTS) {
    throw new TypeError('catalog reasoning efforts are invalid');
  }
  const efforts = [];
  const defaultFlags = [];
  const seen = new Set();
  let flaggedDefault;
  for (const item of raw) {
    const normalized = normalizeEffort(item);
    if (seen.has(normalized.effort.id)) throw new TypeError(`duplicate reasoning effort: ${normalized.effort.id}`);
    seen.add(normalized.effort.id);
    efforts.push(normalized.effort);
    defaultFlags.push(normalized.defaultFlag);
    if (normalized.defaultFlag === true) {
      if (flaggedDefault !== undefined) throw new TypeError('multiple reasoning efforts are marked default');
      flaggedDefault = normalized.effort.id;
    }
  }
  return Object.freeze({
    efforts: Object.freeze(efforts),
    defaultFlags: Object.freeze(defaultFlags),
    flaggedDefault,
  });
}

function consistentEffortLists(values) {
  const normalized = candidates(values).map(normalizeEffortList);
  if (normalized.length === 0) return undefined;
  const identities = (value) => JSON.stringify(value.efforts.map((effort) => [effort.id, effort.wireValue]));
  const expected = identities(normalized[0]);
  if (normalized.some((value) => identities(value) !== expected)) {
    throw new TypeError('catalog reasoning effort aliases conflict');
  }
  const explicitFlags = new Map();
  for (const value of normalized) {
    for (let index = 0; index < value.efforts.length; index += 1) {
      const flag = value.defaultFlags[index];
      if (flag === undefined) continue;
      const id = value.efforts[index].id;
      if (explicitFlags.has(id) && explicitFlags.get(id) !== flag) {
        throw new TypeError('catalog reasoning effort default flags conflict');
      }
      explicitFlags.set(id, flag);
    }
  }
  const flagged = new Set(
    [...explicitFlags.entries()].filter(([, flag]) => flag === true).map(([id]) => id),
  );
  if (flagged.size > 1) throw new TypeError('catalog reasoning effort default flags conflict');
  const explicitFlagRecord = Object.create(null);
  for (const [id, flag] of explicitFlags) explicitFlagRecord[id] = flag;
  return Object.freeze({
    efforts: normalized[0].efforts,
    explicitFlags: Object.freeze(explicitFlagRecord),
    flaggedDefault: flagged.values().next().value,
  });
}

function normalizeDefaultEffort(value) {
  if (typeof value === 'string') return assertSafeReasoningEffort(value);
  if (!isRecord(value)) throw new TypeError('catalog default reasoning effort is invalid');
  const canonical = value.value === undefined ? undefined : assertSafeReasoningEffort(value.value);
  const id = value.id === undefined ? undefined : assertSafeReasoningEffort(value.id);
  if (canonical === undefined && id === undefined) throw new TypeError('catalog default reasoning effort has no id');
  return canonical ?? id;
}

function resolveDefaultEffort(value, efforts) {
  if (value === undefined) return undefined;
  const byId = efforts.find((effort) => effort.id === value);
  const byWire = efforts.filter((effort) => effort.wireValue === value);
  if (byWire.length > 1) throw new TypeError('catalog default reasoning effort is ambiguous');
  if (byId !== undefined && byWire.length === 1 && byId.id !== byWire[0].id) {
    throw new TypeError('catalog default reasoning effort conflicts between id and value');
  }
  return byId?.id ?? byWire[0]?.id;
}

function normalizeBackend(value) {
  if (typeof value !== 'string') throw new TypeError('catalog API backend is invalid');
  if (value === 'chat' || value === 'chat_completions') return 'chat';
  if (value === 'responses') return 'responses';
  return `unsupported:${value}`;
}

function catalogCollection(document) {
  if (!isRecord(document)) throw new TypeError('catalog document must be an object');
  let entries;
  let shape;
  if (Array.isArray(document.data)) {
    entries = document.data;
    shape = 'data-array';
  } else if (Array.isArray(document.models)) {
    entries = document.models;
    shape = 'models-array';
  }
  else if (isRecord(document.models)) {
    entries = Object.entries(document.models).map(([id, value]) => {
      if (!isRecord(value)) throw new TypeError('catalog model map values must be objects');
      return { ...value, __catalogMapId: id };
    });
    shape = 'models-map';
  } else {
    throw new TypeError('catalog document has no supported model collection');
  }
  if (entries.length > MAX_CATALOG_MODELS) throw new TypeError('catalog model count exceeded');
  return Object.freeze({ entries, shape });
}

/** A live catalog entry is authoritative only when it proves exact entitlement. */
export function normalizeEntitledModel(entry) {
  if (!isRecord(entry)) return undefined;
  if (entry._meta !== undefined && entry._meta !== null && !isRecord(entry._meta)) {
    throw new TypeError('catalog model metadata is invalid');
  }
  if (entry.info !== undefined && entry.info !== null && !isRecord(entry.info)) {
    throw new TypeError('catalog model info is invalid');
  }
  const metadata = isRecord(entry._meta) ? entry._meta : {};
  const info = isRecord(entry.info) ? entry.info : {};
  const canonicalModel = consistentAlias(
    'model id',
    [
      entry.model, entry.modelId, entry.model_id,
      info.model, info.modelId, info.model_id,
      metadata.model, metadata.modelId, metadata.model_id,
    ],
    (value) => {
      if (typeof value !== 'string') throw new TypeError('catalog model id is invalid');
      return value;
    },
  );
  // `id` is a selector/config identity in the official schema and can differ
  // from the canonical `model`. DSH exposes and sends only the canonical model;
  // id/map-key are safe fallbacks when no canonical model field is present.
  const id = consistentAlias(
    'model id',
    canonicalModel === undefined
      ? [entry.__catalogMapId, entry.id, info.id, metadata.id]
      : [canonicalModel],
    (value) => {
      if (typeof value !== 'string') throw new TypeError('catalog model id is invalid');
      return value;
    },
  );
  if (id === undefined || !id.startsWith('grok-')) return undefined;
  assertSafeModelId(id);
  const hidden = booleanAlias('hidden', [entry.hidden, info.hidden, metadata.hidden]);
  const userSelectable = booleanAlias(
    'user-selectable',
    [
      entry.userSelectable, entry.user_selectable,
      info.userSelectable, info.user_selectable,
      metadata.userSelectable, metadata.user_selectable,
    ],
  );
  const supportedInApi = booleanAlias(
    'API-support',
    [
      entry.supportedInApi, entry.supported_in_api,
      info.supportedInApi, info.supported_in_api,
      metadata.supportedInApi, metadata.supported_in_api,
    ],
  );
  const supportsReasoning = booleanAlias(
    'reasoning-support',
    [
      entry.supportsReasoningEffort, entry.supports_reasoning_effort,
      info.supportsReasoningEffort, info.supports_reasoning_effort,
      metadata.supportsReasoningEffort, metadata.supports_reasoning_effort,
    ],
  );
  const normalizedEfforts = consistentEffortLists(
    [
      entry.reasoningEfforts, entry.reasoning_efforts,
      info.reasoningEfforts, info.reasoning_efforts,
      metadata.reasoningEfforts, metadata.reasoning_efforts,
    ],
  );
  const efforts = normalizedEfforts?.efforts ?? Object.freeze([]);
  const independentDefaultValue = consistentAlias(
    'default reasoning effort',
    [
      entry.defaultReasoningEffort, entry.default_reasoning_effort,
      entry.reasoningEffort, entry.reasoning_effort,
      info.defaultReasoningEffort, info.default_reasoning_effort,
      info.reasoningEffort, info.reasoning_effort,
      metadata.defaultReasoningEffort, metadata.default_reasoning_effort,
      metadata.reasoningEffort, metadata.reasoning_effort,
    ],
    normalizeDefaultEffort,
  );
  const independentDefault = resolveDefaultEffort(independentDefaultValue, efforts);
  if (independentDefaultValue !== undefined && independentDefault === undefined) {
    throw new TypeError('catalog default reasoning effort is not supported');
  }
  const flaggedDefault = normalizedEfforts?.flaggedDefault;
  if (independentDefault !== undefined && normalizedEfforts?.explicitFlags[independentDefault] === false) {
    throw new TypeError('catalog default reasoning effort conflicts with explicit false flag');
  }
  if (independentDefault !== undefined && flaggedDefault !== undefined && independentDefault !== flaggedDefault) {
    throw new TypeError('catalog default reasoning effort conflicts with effort default flag');
  }
  const name = safeDisplayText(firstDefined(entry.name, info.name, metadata.name), 'model name', MAX_NAME_BYTES) ?? id;
  const description = safeDisplayText(
    firstDefined(entry.description, info.description, metadata.description),
    'model description',
    MAX_DESCRIPTION_BYTES,
  );
  const contextWindow = consistentAlias(
    'context window',
    [
      entry.contextWindow, entry.context_window,
      info.contextWindow, info.context_window,
      metadata.contextWindow, metadata.context_window, metadata.totalContextTokens,
    ],
    (value) => {
      if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('catalog context window is invalid');
      return value;
    },
  );
  const maxTokens = consistentAlias(
    'max completion tokens',
    [
      entry.maxCompletionTokens, entry.max_completion_tokens,
      info.maxCompletionTokens, info.max_completion_tokens,
      metadata.maxCompletionTokens, metadata.max_completion_tokens,
    ],
    (value) => {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError('catalog max completion tokens is invalid');
      }
      return value;
    },
  );
  const rawModalities = consistentAlias(
    'input modalities',
    [
      entry.inputModalities, entry.input_modalities,
      info.inputModalities, info.input_modalities,
      metadata.inputModalities, metadata.input_modalities,
    ],
    (value) => {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new TypeError('catalog input modalities are invalid');
      }
      const unique = [...new Set(value)].sort();
      if (unique.length !== value.length) throw new TypeError('catalog input modalities contain duplicates');
      return unique;
    },
  );
  const normalizedBackend = consistentAlias(
    'API backend',
    [
      entry.apiBackend, entry.api_backend,
      info.apiBackend, info.api_backend,
      metadata.apiBackend, metadata.api_backend,
    ],
    normalizeBackend,
  );
  const apiBackend = normalizedBackend ?? 'chat';
  // `supportedInApi` governs API-key visibility in Grok Build. This provider
  // uses session OAuth, so a model present in the authenticated subscription
  // catalog remains eligible even when that flag is explicitly false. We still
  // validate all aliases/types above so malformed or conflicting data fails.
  const effectiveSupportsReasoning = supportsReasoning ?? efforts.length > 0;
  if (hidden === true || userSelectable === false) {
    return undefined;
  }
  if (rawModalities !== undefined && !rawModalities.includes('text')) return undefined;
  if (apiBackend.startsWith('unsupported:')) return undefined;
  if (effectiveSupportsReasoning) {
    if (normalizedEfforts === undefined || efforts.length === 0) {
      throw new TypeError('catalog reasoning efforts are invalid');
    }
  } else if (efforts.length !== 0) {
    throw new TypeError('non-reasoning model declares reasoning efforts');
  }
  let defaultEffort;
  if (independentDefault !== undefined || flaggedDefault !== undefined) {
    defaultEffort = independentDefault ?? flaggedDefault;
    if (!efforts.some((effort) => effort.id === defaultEffort)) {
      throw new TypeError('catalog default reasoning effort is not supported');
    }
  } else if (id === DEFAULT_MODEL
    && efforts.some((effort) => effort.id === DEFAULT_REASONING_EFFORT)
    && normalizedEfforts?.explicitFlags[DEFAULT_REASONING_EFFORT] !== false) {
    defaultEffort = DEFAULT_REASONING_EFFORT;
  }
  return Object.freeze({
    id,
    name,
    ...(description === undefined ? {} : { description }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    apiBackend,
    supportsReasoning: effectiveSupportsReasoning,
    efforts,
    ...(defaultEffort === undefined ? {} : { defaultEffort }),
  });
}

export function entitledCatalogFromDocument(document) {
  const collection = catalogCollection(document);
  const models = [];
  const seen = new Set();
  for (const entry of collection.entries) {
    const normalized = normalizeEntitledModel(entry);
    if (normalized === undefined) continue;
    if (seen.has(normalized.id)) throw new TypeError(`duplicate catalog model: ${normalized.id}`);
    seen.add(normalized.id);
    models.push(normalized);
  }
  return Object.freeze({
    collectionShape: collection.shape,
    sourceCount: collection.entries.length,
    models: Object.freeze(models),
  });
}

export function entitledModelsFromCatalog(document) {
  return entitledCatalogFromDocument(document).models;
}

/** Compatibility helper for callers that only need the pinned production default. */
export function entitledModelFromCatalog(document) {
  return entitledModelsFromCatalog(document).find((model) => model.id === DEFAULT_MODEL);
}
