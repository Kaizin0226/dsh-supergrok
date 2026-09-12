/** Hardened Grok subscription adapter for the DSH LLM seam. */
import { createHash, randomUUID } from 'node:crypto';
import { contentHasImage, LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import {
  CATALOG_REVISION_PREFIX,
  CHAT_PROXY_BASE_URL,
  LIVE_CANARY_MAX_INFERENCES_ENV,
  PROVIDER,
} from './constants.js';
import { fetchWithProxy, readResponseJson } from './net.js';
import { prepareRequestImages, requestImageNotices, imageRequestSignature } from './images.js';
import {
  assertFixedInvocation,
  buildProtocolHeaders,
  entitledCatalogFromDocument,
} from './protocol.js';
import {
  parseSse,
  serializeChatRequest,
  serializeResponsesRequest,
  translateChat,
  translateResponses,
} from './wire.js';

const NO_RETRY_POLICY = Object.freeze({
  mode: 'normal',
  maxRetries: 0,
  retryableCodes: Object.freeze(['TRANSPORT']),
  initialDelayMs: 1000,
  maxDelayMs: 1000,
  jitterRatio: 0,
});

// The real acceptance host is a dedicated short-lived DSH process. A
// process-wide latch makes its first inference network dispatch terminal: any
// later agent step, concurrent stream, or accidental duplicate delivery fails
// before a second /responses or /chat/completions request can be sent. Catalog,
// entitlement, and OAuth traffic do not consume this latch.
let acceptanceInferenceClaimed = false;

function parseLiveCanaryInferenceBudget() {
  const raw = process.env[LIVE_CANARY_MAX_INFERENCES_ENV];
  if (raw === undefined) return undefined;
  if (raw !== '1' && raw !== '2') {
    throw new Error(`${LIVE_CANARY_MAX_INFERENCES_ENV} must be exactly 1 or 2`);
  }
  if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1') {
    throw new Error(`${LIVE_CANARY_MAX_INFERENCES_ENV} cannot be combined with DSH_SUPERGROK_ACCEPTANCE`);
  }
  return Number(raw);
}

export const LIVE_CANARY_MAX_INFERENCES = parseLiveCanaryInferenceBudget();
export const LIVE_CANARY_ENABLED = LIVE_CANARY_MAX_INFERENCES !== undefined;
const liveCanaryClaims = {
  catalog: 0,
  inference: 0,
};

const EMPTY_MODELS = Object.freeze([]);
const CATALOG_ENDPOINTS = new Set(['/models', '/models-v2']);
const CATALOG_SHAPES = new Set(['data-array', 'models-array', 'models-map']);
const CATALOG_DIAGNOSTIC_CODES = new Set([
  'not_requested',
  'no_token',
  'token_error',
  'transport_error',
  'http_error',
  'parse_error',
  'empty_entitlement',
  'ok',
]);

function bytewiseId(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function catalogDiagnostic(code, details = {}) {
  if (!CATALOG_DIAGNOSTIC_CODES.has(code)) throw new TypeError('invalid catalog diagnostic code');
  const endpoint = CATALOG_ENDPOINTS.has(details.endpoint) ? details.endpoint : undefined;
  const collectionShape = CATALOG_SHAPES.has(details.collectionShape) ? details.collectionShape : undefined;
  const httpStatus = Number.isSafeInteger(details.httpStatus) && details.httpStatus >= 100 && details.httpStatus <= 599
    ? details.httpStatus
    : undefined;
  const sourceCount = Number.isSafeInteger(details.sourceCount) && details.sourceCount >= 0 && details.sourceCount <= 256
    ? details.sourceCount
    : undefined;
  const acceptedCount = Number.isSafeInteger(details.acceptedCount) && details.acceptedCount >= 0 && details.acceptedCount <= 256
    ? details.acceptedCount
    : undefined;
  return Object.freeze({
    code,
    observedAt: Date.now(),
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(collectionShape === undefined ? {} : { collectionShape }),
    ...(sourceCount === undefined ? {} : { sourceCount }),
    ...(acceptedCount === undefined ? {} : { acceptedCount }),
  });
}

function catalogFetchResult(snapshot, code, details) {
  return Object.freeze({ snapshot, diagnostic: catalogDiagnostic(code, details) });
}

function catalogFingerprint(live, models) {
  return JSON.stringify({
    live,
    models: [...models].sort((a, b) => bytewiseId(a.id, b.id)).map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      inputModalities: model.inputModalities,
      apiBackend: model.apiBackend,
      supportsReasoning: model.supportsReasoning,
      efforts: [...model.efforts].sort((a, b) => bytewiseId(a.id, b.id)),
      defaultEffort: model.defaultEffort,
      capabilityProvenance: model.capabilityProvenance,
    })),
  });
}

function catalogSnapshot(live, models = EMPTY_MODELS) {
  const fingerprint = catalogFingerprint(live, models);
  return Object.freeze({
    live,
    models,
    fingerprint,
    ...(live
      ? {
        catalogRevision: `${CATALOG_REVISION_PREFIX}${createHash('sha256')
          .update(fingerprint, 'utf8')
          .digest('hex')}`,
      }
      : {}),
  });
}

function claimAcceptanceInference() {
  if (process.env.DSH_SUPERGROK_ACCEPTANCE !== '1') return;
  if (acceptanceInferenceClaimed) {
    throw new LlmError(
      'SuperGrok acceptance mode permits exactly one inference request per DSH process',
      'INVALID_REQUEST',
    );
  }
  acceptanceInferenceClaimed = true;
}

function claimLiveCanaryCatalogRequest() {
  if (!LIVE_CANARY_ENABLED) return;
  if (liveCanaryClaims.catalog >= 1) {
    throw new LlmError(
      'SuperGrok live Canary permits at most one catalog network request per process',
      'LIVE_CANARY_BUDGET_EXCEEDED',
    );
  }
  liveCanaryClaims.catalog += 1;
}

function claimLiveCanaryInference() {
  if (!LIVE_CANARY_ENABLED) return;
  if (liveCanaryClaims.inference >= LIVE_CANARY_MAX_INFERENCES) {
    throw new LlmError(
      `SuperGrok live Canary inference budget ${LIVE_CANARY_MAX_INFERENCES} is exhausted`,
      'LIVE_CANARY_BUDGET_EXCEEDED',
    );
  }
  liveCanaryClaims.inference += 1;
}

function normalizeDispatchContext(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LlmError('SuperGrok prepare dispatch context is invalid', 'INVALID_REQUEST');
  }
  const keys = Object.keys(value);
  if (keys.some((key) => key !== 'sessionId' && key !== 'turn')) {
    throw new LlmError('SuperGrok prepare dispatch context has unknown fields', 'INVALID_REQUEST');
  }
  const sessionId = value.sessionId;
  const turn = value.turn;
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 256) {
    throw new LlmError('SuperGrok prepare dispatch context requires a bounded sessionId', 'INVALID_REQUEST');
  }
  if (!Number.isSafeInteger(turn) || turn <= 0) {
    throw new LlmError('SuperGrok prepare dispatch context requires a positive turn', 'INVALID_REQUEST');
  }
  return Object.freeze({ sessionId, turn });
}

function errorCode(status) {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 402) return 'QUOTA';
  if (status === 426) return 'CLIENT_VERSION';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'INVALID_REQUEST';
  if (status >= 500) return 'SERVER';
  return `HTTP_${status}`;
}

function retryAfterMs(value) {
  if (value === null || value === undefined) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : undefined;
}

function safeResponseMetadata(value, maxLength = 128) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9._:\/-]+$/.test(value)
    ? value
    : undefined;
}

export class GrokAdapter extends LlmAdapter {
  constructor(settings, oauth, logger, dependencies = {}) {
    super();
    this.settings = settings;
    this.oauth = oauth;
    this.logger = logger;
    this.fetch = dependencies.fetch ?? fetchWithProxy;
    this.resolveAttachments = dependencies.resolveAttachments;
    this.beforeModelRequest = dependencies.beforeModelRequest;
    this.catalogCache = undefined;
    this.catalogFetch = undefined;
    this.catalogAbort = undefined;
    this.catalogGeneration = 0;
    this.catalogChanged = dependencies.catalogChanged;
    this.catalogDisposed = false;
    this.catalogDiagnosticState = catalogDiagnostic('not_requested');
    this.turnCatalogScopes = new Map();
  }

  setCatalogChangedListener(listener) {
    if (listener !== undefined && typeof listener !== 'function') throw new TypeError('catalog listener must be a function');
    this.catalogChanged = listener;
  }

  invalidateCatalog() {
    this.catalogGeneration += 1;
    const controller = this.catalogAbort;
    this.catalogAbort = undefined;
    this.catalogFetch = undefined;
    controller?.abort(new Error('catalog invalidated'));
    this.catalogCache = undefined;
    this.catalogDiagnosticState = catalogDiagnostic('not_requested');
  }

  catalogStatus() {
    return this.catalogDiagnosticState;
  }

  clearCatalog() {
    this.catalogGeneration += 1;
    const controller = this.catalogAbort;
    this.catalogAbort = undefined;
    this.catalogFetch = undefined;
    controller?.abort(new Error('catalog cleared'));
    const previous = this.catalogCache;
    const next = Object.freeze({ ...catalogSnapshot(false), at: Date.now() });
    this.catalogCache = next;
    this.catalogDiagnosticState = catalogDiagnostic('not_requested');
    if (previous !== undefined && previous.fingerprint !== next.fingerprint) {
      try {
        this.catalogChanged?.(next);
      } catch {
        this.logger?.warn('grok-oauth: catalog change listener failed');
      }
    }
    return next;
  }

  disposeCatalog() {
    this.catalogDisposed = true;
    this.catalogGeneration += 1;
    this.turnCatalogScopes.clear();
    this.catalogChanged = undefined;
    const controller = this.catalogAbort;
    this.catalogAbort = undefined;
    this.catalogFetch = undefined;
    controller?.abort(new Error('catalog adapter disposed'));
    this.catalogCache = undefined;
  }

  providerInfo(provider) {
    if (provider !== PROVIDER) throw new Error(`provider drift: ${String(provider)}`);
    return { id: PROVIDER, name: 'SuperGrok（DSH OAuth）' };
  }

  providerRetryPolicy(_provider) {
    return NO_RETRY_POLICY;
  }

  async #fetchCatalog(signal) {
    let accessToken;
    try {
      accessToken = await this.oauth.getAccessToken();
    } catch {
      this.logger?.warn('grok-oauth: catalog token acquisition failed');
      return catalogFetchResult(catalogSnapshot(false), 'token_error');
    }
    if (accessToken === undefined) return catalogFetchResult(catalogSnapshot(false), 'no_token');
    let replayConsumed = false;
    let compatibilityFailure;
    // The pinned Grok Build snapshot uses /models for the complete selector
    // catalog. /models-v2 is retained only as a 404/405 compatibility fallback.
    const catalogPaths = LIVE_CANARY_ENABLED ? ['/models'] : ['/models', '/models-v2'];
    for (const pathname of catalogPaths) {
      const affinityId = randomUUID();
      let response;
      try {
        response = await this.#catalogRequest(pathname, accessToken, affinityId, signal);
      } catch (error) {
        if (error instanceof LlmError) throw error;
        this.logger?.warn('grok-oauth: catalog transport failed');
        return catalogFetchResult(catalogSnapshot(false), 'transport_error', { endpoint: pathname });
      }
      if (response.status === 401
        && !replayConsumed
        && !LIVE_CANARY_ENABLED
        && process.env.DSH_SUPERGROK_ACCEPTANCE !== '1') {
        replayConsumed = true;
        await response.body?.cancel?.().catch?.(() => undefined);
        try {
          accessToken = await this.oauth.getAccessToken(accessToken);
        } catch {
          this.logger?.warn('grok-oauth: catalog token refresh failed');
          return catalogFetchResult(catalogSnapshot(false), 'token_error', {
            endpoint: pathname,
            httpStatus: 401,
          });
        }
        if (accessToken === undefined) {
          return catalogFetchResult(catalogSnapshot(false), 'no_token', {
            endpoint: pathname,
            httpStatus: 401,
          });
        }
        try {
          response = await this.#catalogRequest(pathname, accessToken, affinityId, signal);
        } catch (error) {
          if (error instanceof LlmError) throw error;
          this.logger?.warn('grok-oauth: catalog replay transport failed');
          return catalogFetchResult(catalogSnapshot(false), 'transport_error', { endpoint: pathname });
        }
      }
      if (!response.ok) {
        response.body?.cancel?.().catch?.(() => undefined);
        if (response.status === 404 || response.status === 405) {
          compatibilityFailure = { endpoint: pathname, httpStatus: response.status };
          continue;
        }
        this.logger?.warn(`grok-oauth: catalog rejected (HTTP ${response.status})`);
        return catalogFetchResult(catalogSnapshot(false), 'http_error', {
          endpoint: pathname,
          httpStatus: response.status,
        });
      }
      try {
        const catalog = entitledCatalogFromDocument(await readResponseJson(response));
        const snapshot = catalogSnapshot(true, catalog.models);
        const details = {
          endpoint: pathname,
          httpStatus: response.status,
          collectionShape: catalog.collectionShape,
          sourceCount: catalog.sourceCount,
          acceptedCount: catalog.models.length,
        };
        return catalogFetchResult(
          snapshot,
          catalog.models.length === 0 ? 'empty_entitlement' : 'ok',
          details,
        );
      } catch {
        this.logger?.warn('grok-oauth: catalog parse failed');
        return catalogFetchResult(catalogSnapshot(false), 'parse_error', {
          endpoint: pathname,
          httpStatus: response.status,
        });
      }
    }
    return catalogFetchResult(catalogSnapshot(false), 'http_error', compatibilityFailure);
  }

  async #catalogRequest(pathname, accessToken, affinityId, signal) {
    claimLiveCanaryCatalogRequest();
    return this.fetch(`${CHAT_PROXY_BASE_URL}${pathname}`, {
      method: 'GET',
      headers: buildProtocolHeaders({
        accessToken,
        sessionId: affinityId,
        conversationId: affinityId,
        requestId: randomUUID(),
        operation: 'catalog',
      }),
      signal,
    }, 'catalog');
  }

  async catalog(forceRefresh = false) {
    if (this.catalogDisposed) return Object.freeze({ ...catalogSnapshot(false), at: Date.now() });
    const ttl = this.settings().modelsRefreshSeconds * 1000;
    const fresh = this.catalogCache !== undefined && Date.now() - this.catalogCache.at < ttl;
    if (!forceRefresh && fresh) return this.catalogCache;
    if (this.catalogFetch === undefined) {
      const generation = this.catalogGeneration;
      const controller = new AbortController();
      this.catalogAbort = controller;
      let fetchPromise;
      fetchPromise = this.#fetchCatalog(controller.signal).then((fetched) => {
        if (this.catalogDisposed || generation !== this.catalogGeneration) {
          return this.catalogCache ?? Object.freeze({ ...catalogSnapshot(false), at: Date.now() });
        }
        const previous = this.catalogCache;
        const next = Object.freeze({ ...fetched.snapshot, at: Date.now() });
        this.catalogCache = next;
        this.catalogDiagnosticState = fetched.diagnostic;
        if (previous !== undefined && previous.fingerprint !== next.fingerprint) {
          try {
            this.catalogChanged?.(next);
          } catch {
            this.logger?.warn('grok-oauth: catalog change listener failed');
          }
        }
        return next;
      }).finally(() => {
        if (this.catalogAbort === controller) this.catalogAbort = undefined;
        if (this.catalogFetch === fetchPromise) this.catalogFetch = undefined;
      });
      this.catalogFetch = fetchPromise;
    }
    return this.catalogFetch;
  }

  async refreshCatalog() {
    return this.catalog(true);
  }

  async #preflightCatalog() {
    if (!LIVE_CANARY_ENABLED) return this.catalog(true);

    // A dedicated Canary process may have used its sole GET to resolve the
    // exact model immediately before the turn. Reuse only that successful,
    // still-fresh live snapshot; a failed or expired request never becomes a
    // stale entitlement fallback.
    if (this.catalogFetch !== undefined) return this.catalogFetch;
    if (liveCanaryClaims.catalog === 0) return this.catalog(true);
    const snapshot = this.catalogCache;
    const ttl = this.settings().modelsRefreshSeconds * 1000;
    if (snapshot?.live === true && Date.now() - snapshot.at < ttl) return snapshot;
    throw new LlmError(
      'SuperGrok live Canary catalog preflight is unavailable after its single catalog request',
      'LIVE_CANARY_BUDGET_EXCEEDED',
    );
  }

  async #catalogForPreparedTurn(dispatchContext, model) {
    if (dispatchContext === undefined) {
      return Object.freeze({
        context: undefined,
        generation: this.catalogGeneration,
        model,
        snapshot: await this.#preflightCatalog(),
      });
    }

    const previous = this.turnCatalogScopes.get(dispatchContext.sessionId);
    if (previous !== undefined
      && previous.turn === dispatchContext.turn
      && previous.generation !== this.catalogGeneration) {
      throw new LlmError('SuperGrok catalog generation changed inside one DSH turn', 'MODEL_NOT_ENTITLED');
    }
    if (previous !== undefined
      && previous.turn === dispatchContext.turn
      && previous.generation === this.catalogGeneration) {
      if (previous.model !== model) {
        throw new LlmError('SuperGrok model changed inside one DSH turn', 'INVALID_REQUEST');
      }
      await previous.promise;
      return previous;
    }
    if (previous !== undefined && previous.turn > dispatchContext.turn) {
      throw new LlmError('SuperGrok received a stale DSH turn ordinal', 'INVALID_REQUEST');
    }

    const generation = this.catalogGeneration;
    const entry = {
      context: dispatchContext,
      generation,
      model,
      promise: undefined,
      reasoningEffortSet: false,
      reasoningEffort: undefined,
      snapshot: undefined,
      turn: dispatchContext.turn,
    };
    entry.promise = this.#preflightCatalog().then((snapshot) => {
      if (this.catalogGeneration !== generation
        || this.turnCatalogScopes.get(dispatchContext.sessionId) !== entry) {
        throw new LlmError('SuperGrok catalog generation changed during turn preflight', 'MODEL_NOT_ENTITLED');
      }
      entry.snapshot = snapshot;
      return snapshot;
    }).catch((error) => {
      if (this.turnCatalogScopes.get(dispatchContext.sessionId) === entry) {
        this.turnCatalogScopes.delete(dispatchContext.sessionId);
      }
      throw error;
    });
    this.turnCatalogScopes.set(dispatchContext.sessionId, entry);
    await entry.promise;
    return entry;
  }

  async entitledModel(model, forceRefresh = false) {
    const snapshot = await this.catalog(forceRefresh);
    return snapshot.models.find((entry) => entry.id === model);
  }

  catalogIsLive() {
    return this.catalogCache?.live === true;
  }

  #resolvedModelInfo(entitled, snapshot) {
    const config = this.settings();
    return {
      provider: PROVIDER,
      id: entitled.id,
      name: entitled.name,
      ...(entitled.description === undefined ? {} : { description: entitled.description }),
      inputModalities: entitled.inputModalities,
      backend: entitled.apiBackend,
      capabilityProvenance: entitled.capabilityProvenance,
      catalogRevision: snapshot.catalogRevision,
      context: { contextWindow: entitled.contextWindow ?? config.defaultContextWindow },
      ...(entitled.maxTokens === undefined ? {} : { defaultMaxTokens: entitled.maxTokens }),
      ...(entitled.supportsReasoning
        ? {
          reasoning: {
            efforts: entitled.efforts.map((effort) => ({
              id: effort.id,
              name: effort.name,
              ...(effort.description === undefined ? {} : { description: effort.description }),
            })),
            ...(entitled.defaultEffort === undefined ? {} : { defaultEffort: entitled.defaultEffort }),
          },
        }
        : {}),
    };
  }

  async listModels(provider) {
    if (provider !== PROVIDER) return [];
    const snapshot = await this.catalog();
    return snapshot.models.map((model) => ({
      provider: PROVIDER,
      id: model.id,
      name: model.name,
      ...(model.description === undefined ? {} : { description: model.description }),
      inputModalities: model.inputModalities,
      backend: model.apiBackend,
      capabilityProvenance: model.capabilityProvenance,
      catalogRevision: snapshot.catalogRevision,
    }));
  }

  async resolveModel(provider, model, _signal) {
    assertFixedInvocation({ provider, model });
    const snapshot = await this.catalog();
    const entitled = snapshot.models.find((entry) => entry.id === model);
    if (entitled === undefined) {
      throw new LlmError(`SuperGrok 账号目录未授权精确模型 ${model}`, 'MODEL_NOT_ENTITLED');
    }
    return this.#resolvedModelInfo(entitled, snapshot);
  }

  async prepareCall(provider, model, signal, dispatchContext) {
    assertFixedInvocation({ provider, model });
    const context = normalizeDispatchContext(dispatchContext);
    signal?.throwIfAborted?.();
    const turnScope = await this.#catalogForPreparedTurn(context, model);
    signal?.throwIfAborted?.();
    const snapshot = turnScope.snapshot;
    const entitled = snapshot?.models.find((entry) => entry.id === model);
    if (entitled === undefined) {
      throw new LlmError(`SuperGrok 账号目录未授权精确模型 ${model}`, 'MODEL_NOT_ENTITLED');
    }
    let dispatched = false;
    let inputPreparation;
    return Object.freeze({
      model: this.#resolvedModelInfo(entitled, snapshot),
      prepareInput: async (options) => {
        if (dispatched || inputPreparation !== undefined || options.model !== model
          || (context !== undefined && (String(options.sessionId ?? '') !== context.sessionId || options.turn !== context.turn))) {
          throw new LlmError('SuperGrok prepared input target changed or was already used', 'INVALID_PREPARED_CALL');
        }
        inputPreparation = this.#prepareImages(options, entitled);
        const input = await inputPreparation;
        options.signal?.throwIfAborted?.();
        return input.images === undefined ? [] : requestImageNotices(input.images);
      },
      stream: (options) => {
        if (dispatched) {
          throw new LlmError('SuperGrok prepared call can only be dispatched once', 'INVALID_PREPARED_CALL');
        }
        if (options.model !== model) {
          throw new LlmError('SuperGrok prepared model changed before dispatch', 'INVALID_PREPARED_CALL');
        }
        if (context !== undefined) {
          if (String(options.sessionId ?? '') !== context.sessionId || options.turn !== context.turn) {
            throw new LlmError('SuperGrok prepared DSH turn context changed before dispatch', 'INVALID_PREPARED_CALL');
          }
          if (turnScope.generation !== this.catalogGeneration
            || this.turnCatalogScopes.get(context.sessionId) !== turnScope) {
            throw new LlmError('SuperGrok prepared catalog generation is no longer current', 'MODEL_NOT_ENTITLED');
          }
          const effort = options.reasoningEffort;
          if (turnScope.reasoningEffortSet && turnScope.reasoningEffort !== effort) {
            throw new LlmError('SuperGrok reasoning effort changed inside one DSH turn', 'INVALID_PREPARED_CALL');
          }
          turnScope.reasoningEffort = effort;
          turnScope.reasoningEffortSet = true;
        } else if (options.turn !== undefined) {
          throw new LlmError(
            'SuperGrok turn-scoped dispatch requires prepareCall context',
            'INVALID_PREPARED_CALL',
          );
        }
        dispatched = true;
        return this.#streamWithSnapshot(options, snapshot, inputPreparation);
      },
    });
  }

  async *stream(options) {
    if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1'
      && options.tools !== undefined
      && (!Array.isArray(options.tools) || options.tools.length !== 0)) {
      throw new LlmError(
        'SuperGrok acceptance mode requires an empty tool catalog',
        'INVALID_REQUEST',
      );
    }
    if (options.turn !== undefined) {
      throw new LlmError(
        'SuperGrok turn-scoped dispatch requires the DSH prepared-call seam',
        'INVALID_PREPARED_CALL',
      );
    }
    const snapshot = await this.#preflightCatalog();
    yield* this.#streamWithSnapshot(options, snapshot);
  }

  async #prepareImages(options, entitled) {
    options.signal?.throwIfAborted?.();
    if (entitled.apiBackend !== 'chat' && entitled.apiBackend !== 'responses') {
      throw new LlmError('SuperGrok 目录声明了未知 backend', 'UNSUPPORTED_CONTENT');
    }
    const signature = imageRequestSignature(options.messages);
    if (!options.messages.some((message) => contentHasImage(message.content))) return { signature };
    if (!entitled.inputModalities.includes('image')) {
      throw new LlmError(`SuperGrok 模型 ${options.model} 未声明图片输入能力`, 'UNSUPPORTED_CONTENT');
    }
    const images = await prepareRequestImages(options.messages, this.resolveAttachments?.(), options.signal);
    options.signal?.throwIfAborted?.();
    return { signature, images };
  }

  async *#streamWithSnapshot(options, freshCatalog, inputPreparation) {
    assertFixedInvocation({ model: options.model, reasoningEffort: options.reasoningEffort });
    if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1'
      && options.tools !== undefined
      && (!Array.isArray(options.tools) || options.tools.length !== 0)) {
      throw new LlmError(
        'SuperGrok acceptance mode requires an empty tool catalog',
        'INVALID_REQUEST',
      );
    }
    const entitled = freshCatalog.models.find((entry) => entry.id === options.model);
    if (entitled === undefined) {
      throw new LlmError(`SuperGrok 账号目录未授权精确模型 ${options.model}`, 'MODEL_NOT_ENTITLED');
    }
    if (options.reasoningEffort !== undefined
      && (!entitled.supportsReasoning
        || !entitled.efforts.some((effort) => effort.id === options.reasoningEffort))) {
      throw new LlmError(
        `SuperGrok 账号目录未授权 ${options.model}/${options.reasoningEffort}`,
        'UNSUPPORTED_REASONING_EFFORT',
      );
    }
    const selectedEffort = options.reasoningEffort === undefined
      ? undefined
      : entitled.efforts.find((effort) => effort.id === options.reasoningEffort);
    const input = await (inputPreparation ?? this.#prepareImages(options, entitled));
    if (input.signature !== imageRequestSignature(options.messages)) {
      throw new LlmError('SuperGrok image occurrences changed after preparation', 'INVALID_PREPARED_CALL');
    }
    const requestImages = input.images;

    const config = this.settings();
    const backend = entitled.apiBackend;
    const wireOptions = selectedEffort === undefined
      ? options
      : { ...options, reasoningEffort: selectedEffort.wireValue ?? selectedEffort.id };
    const body = backend === 'chat'
      ? serializeChatRequest(wireOptions, {}, requestImages)
      : serializeResponsesRequest(wireOptions, {}, requestImages);
    const pathname = backend === 'chat' ? '/chat/completions' : '/responses';
    const payload = JSON.stringify(body);
    const payloadBytes = Buffer.byteLength(payload, 'utf8');
    if (!Number.isSafeInteger(config.maxRequestBodyBytes) || config.maxRequestBodyBytes <= 0) {
      throw new LlmError('SuperGrok maxRequestBodyBytes 配置无效', 'INVALID_REQUEST');
    }
    if (payloadBytes > config.maxRequestBodyBytes) {
      throw new LlmError(
        `SuperGrok 请求为 ${payloadBytes} bytes，超过本地预算 ${config.maxRequestBodyBytes} bytes；请减少本轮图片或上下文后重新明确发起。没有发送推理请求，也没有自动丢图。`,
        'REQUEST_BODY_TOO_LARGE',
      );
    }
    options.signal?.throwIfAborted?.();
    let accessToken;
    try {
      accessToken = await this.oauth.getAccessToken();
    } catch (error) {
      throw new LlmError('SuperGrok OAuth 访问令牌刷新失败', 'AUTH', { cause: error });
    }
    if (accessToken === undefined) {
      throw new LlmError('尚未登录 DSH 专用 SuperGrok OAuth', 'MISSING_CREDENTIAL');
    }
    options.signal?.throwIfAborted?.();
    const affinityId = options.sessionId === undefined ? randomUUID() : String(options.sessionId);
    const affinity = { sessionId: affinityId, conversationId: affinityId };

    claimAcceptanceInference();
    const firstRequest = await this.#request(pathname, payload, options, accessToken, affinity);
    let response = firstRequest.response;
    const acceptanceNoReplay = process.env.DSH_SUPERGROK_ACCEPTANCE === '1' || LIVE_CANARY_ENABLED
      || firstRequest.disableAutomaticRetries;
    if (response.status === 401 && !acceptanceNoReplay) {
      await response.body?.cancel?.().catch?.(() => undefined);
      try {
        accessToken = await this.oauth.getAccessToken(accessToken);
      } catch (error) {
        throw new LlmError('SuperGrok OAuth 访问令牌已失效且刷新失败', 'AUTH', { cause: error, status: 401 });
      }
      if (accessToken === undefined) throw new LlmError('SuperGrok OAuth 访问令牌已失效', 'AUTH', { status: 401 });
      response = (await this.#request(pathname, payload, options, accessToken, affinity)).response;
    }
    if (!response.ok) await this.#throwHttpError(response);
    if (response.body === null) throw new LlmError('Grok API returned no response body', 'EMPTY_RESPONSE');

    const streamAbort = new AbortController();
    let timer;
    const rearm = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => streamAbort.abort(new LlmError('SuperGrok stream idle timeout', 'TIMEOUT')),
        config.streamIdleTimeoutMs,
      );
    };
    const onAbort = () => streamAbort.abort(options.signal?.reason ?? new LlmError('SuperGrok request aborted by caller', 'ABORTED'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    rearm();
    try {
      const events = parseSse(response.body, backend === 'chat' ? 'data' : 'json', rearm, streamAbort.signal);
      const chunks = backend === 'chat' ? translateChat(events) : translateResponses(events);
      for await (const chunk of chunks) {
        if (streamAbort.signal.aborted) throw streamAbort.signal.reason;
        yield chunk;
      }
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError('SuperGrok request aborted by caller', 'ABORTED', { cause: error });
      if (streamAbort.signal.aborted && streamAbort.signal.reason instanceof LlmError) throw streamAbort.signal.reason;
      if (typeof error?.code === 'string') throw new LlmError(error.message, error.code, { cause: error });
      if (error instanceof LlmError) throw error;
      throw new LlmError('SuperGrok stream transport failed', 'TRANSPORT', { cause: error });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      await response.body.cancel().catch(() => undefined);
    }
  }

  async #request(pathname, payload, options, accessToken, requestIds) {
    const headers = buildProtocolHeaders({
      accessToken,
      model: options.model,
      ...requestIds,
      requestId: randomUUID(),
      operation: 'inference',
    });
    options.signal?.throwIfAborted?.();
    const policy = await this.beforeModelRequest?.(Object.freeze({
      sessionId: options.sessionId,
      purpose: options.purpose ?? 'agent',
      provider: PROVIDER,
      model: options.model,
      reasoningEffort: options.reasoningEffort ?? null,
      signal: options.signal,
    }));
    options.signal?.throwIfAborted?.();
    claimLiveCanaryInference();
    try {
      const response = await this.fetch(`${CHAT_PROXY_BASE_URL}${pathname}`, {
        method: 'POST',
        headers,
        body: payload,
        signal: options.signal,
        timeoutMs: this.settings().requestTimeoutMs,
      }, 'inference');
      return { response, disableAutomaticRetries: policy?.disableAutomaticRetries === true };
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError('SuperGrok request aborted by caller', 'ABORTED', { cause: error });
      throw new LlmError('SuperGrok request failed through the pinned proxy', 'TRANSPORT', { cause: error });
    }
  }

  async #throwHttpError(response) {
    let providerCode;
    try {
      const body = await readResponseJson(response);
      providerCode = safeResponseMetadata(
        typeof body?.error?.code === 'string' ? body.error.code : body?.error,
        80,
      );
    } catch {
      // Status is authoritative; provider bodies are never echoed.
    }
    const delay = retryAfterMs(response.headers.get('retry-after'));
    const requestId = safeResponseMetadata(
      response.headers.get('x-request-id') ?? response.headers.get('x-grok-req-id'),
    );
    throw new LlmError(`SuperGrok request rejected (HTTP ${response.status})`, errorCode(response.status), {
      status: response.status,
      ...(providerCode === undefined ? {} : { providerCode }),
      ...(delay === undefined ? {} : { providerRetryAfterMs: delay }),
      ...(requestId === undefined || requestId === null ? {} : { requestId }),
    });
  }
}
