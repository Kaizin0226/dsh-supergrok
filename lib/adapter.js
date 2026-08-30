/** Hardened Grok subscription adapter for the DSH LLM seam. */
import { randomUUID } from 'node:crypto';
import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm';
import {
  CHAT_PROXY_BASE_URL,
  DEFAULT_MODEL,
  PROVIDER,
} from './constants.js';
import { fetchWithProxy, readResponseJson } from './net.js';
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
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      apiBackend: model.apiBackend,
      supportsReasoning: model.supportsReasoning,
      efforts: model.efforts,
      defaultEffort: model.defaultEffort,
    })),
  });
}

function catalogSnapshot(live, models = EMPTY_MODELS) {
  return Object.freeze({
    live,
    models,
    fingerprint: catalogFingerprint(live, models),
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
    this.catalogCache = undefined;
    this.catalogFetch = undefined;
    this.catalogAbort = undefined;
    this.catalogGeneration = 0;
    this.catalogChanged = dependencies.catalogChanged;
    this.catalogDisposed = false;
    this.catalogDiagnosticState = catalogDiagnostic('not_requested');
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
    for (const pathname of ['/models', '/models-v2']) {
      const affinityId = randomUUID();
      let response;
      try {
        response = await this.#catalogRequest(pathname, accessToken, affinityId, signal);
      } catch {
        this.logger?.warn('grok-oauth: catalog transport failed');
        return catalogFetchResult(catalogSnapshot(false), 'transport_error', { endpoint: pathname });
      }
      if (response.status === 401
        && !replayConsumed
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
        } catch {
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
    return this.fetch(`${CHAT_PROXY_BASE_URL}${pathname}`, {
      method: 'GET',
      headers: buildProtocolHeaders({
        accessToken,
        model: DEFAULT_MODEL,
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

  async entitledModel(model, forceRefresh = false) {
    const snapshot = await this.catalog(forceRefresh);
    return snapshot.models.find((entry) => entry.id === model);
  }

  catalogIsLive() {
    return this.catalogCache?.live === true;
  }

  async listModels(provider) {
    if (provider !== PROVIDER) return [];
    const snapshot = await this.catalog();
    return snapshot.models.map((model) => ({
      provider: PROVIDER,
      id: model.id,
      name: model.name,
      ...(model.description === undefined ? {} : { description: model.description }),
      inputModalities: ['text'],
    }));
  }

  async resolveModel(provider, model, _signal) {
    assertFixedInvocation({ provider, model });
    const entitled = await this.entitledModel(model);
    if (entitled === undefined) {
      throw new LlmError(`SuperGrok 账号目录未授权精确模型 ${model}`, 'MODEL_NOT_ENTITLED');
    }
    const config = this.settings();
    return {
      provider: PROVIDER,
      id: entitled.id,
      name: entitled.name,
      ...(entitled.description === undefined ? {} : { description: entitled.description }),
      inputModalities: ['text'],
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

  async *stream(options) {
    assertFixedInvocation({ model: options.model, reasoningEffort: options.reasoningEffort });
    if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1'
      && options.tools !== undefined
      && (!Array.isArray(options.tools) || options.tools.length !== 0)) {
      throw new LlmError(
        'SuperGrok acceptance mode requires an empty tool catalog',
        'INVALID_REQUEST',
      );
    }
    const freshCatalog = await this.catalog(true);
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
    let accessToken;
    try {
      accessToken = await this.oauth.getAccessToken();
    } catch (error) {
      throw new LlmError('SuperGrok OAuth 访问令牌刷新失败', 'AUTH', { cause: error });
    }
    if (accessToken === undefined) {
      throw new LlmError('尚未登录 DSH 专用 SuperGrok OAuth', 'MISSING_CREDENTIAL');
    }

    const config = this.settings();
    const backend = entitled.apiBackend;
    const wireOptions = selectedEffort === undefined
      ? options
      : { ...options, reasoningEffort: selectedEffort.wireValue ?? selectedEffort.id };
    const body = backend === 'chat'
      ? serializeChatRequest(wireOptions, {})
      : serializeResponsesRequest(wireOptions, {});
    const pathname = backend === 'chat' ? '/chat/completions' : '/responses';
    const payload = JSON.stringify(body);
    const affinityId = options.sessionId === undefined ? randomUUID() : String(options.sessionId);
    const affinity = { sessionId: affinityId, conversationId: affinityId };

    claimAcceptanceInference();
    let response = await this.#request(pathname, payload, options, accessToken, affinity);
    const acceptanceNoReplay = process.env.DSH_SUPERGROK_ACCEPTANCE === '1';
    if (response.status === 401 && !acceptanceNoReplay) {
      await response.body?.cancel?.().catch?.(() => undefined);
      try {
        accessToken = await this.oauth.getAccessToken(accessToken);
      } catch (error) {
        throw new LlmError('SuperGrok OAuth 访问令牌已失效且刷新失败', 'AUTH', { cause: error, status: 401 });
      }
      if (accessToken === undefined) throw new LlmError('SuperGrok OAuth 访问令牌已失效', 'AUTH', { status: 401 });
      response = await this.#request(pathname, payload, options, accessToken, affinity);
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
    try {
      return await this.fetch(`${CHAT_PROXY_BASE_URL}${pathname}`, {
        method: 'POST',
        headers,
        body: payload,
        signal: options.signal,
        timeoutMs: this.settings().requestTimeoutMs,
      }, 'inference');
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
