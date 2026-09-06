/**
 * Fail-closed outbound transport for xAI OAuth and the Grok subscription
 * proxy. Every request uses one pinned undici ProxyAgent; there is no direct
 * fallback, environment proxy discovery, curl fallback, or redirect follow.
 */
import {
  ACCOUNTS_ORIGIN,
  AUTH_ORIGIN,
  CHAT_PROXY_ORIGIN,
  CLIENT_IDENTIFIER,
  CLIENT_VERSION,
} from './constants.js';
import { attributionHeaders } from '@deepseek-ai/dsh-llm';

const MAX_JSON_BYTES = 1024 * 1024;
const ALLOWED = Object.freeze({
  oauth: new Map([
    [`${AUTH_ORIGIN}/oauth2/device/code`, new Set(['POST'])],
    [`${AUTH_ORIGIN}/oauth2/token`, new Set(['POST'])],
    [`${AUTH_ORIGIN}/oauth2/revoke`, new Set(['POST'])],
  ]),
  catalog: new Map([
    [`${CHAT_PROXY_ORIGIN}/v1/models-v2`, new Set(['GET'])],
    [`${CHAT_PROXY_ORIGIN}/v1/models`, new Set(['GET'])],
  ]),
  usage: new Map([[`${CHAT_PROXY_ORIGIN}/v1/billing`, new Set(['GET'])]]),
  inference: new Map([
    [`${CHAT_PROXY_ORIGIN}/v1/responses`, new Set(['POST'])],
    [`${CHAT_PROXY_ORIGIN}/v1/chat/completions`, new Set(['POST'])],
  ]),
});

export class NetworkBoundaryError extends Error {
  constructor(code, cause) {
    super(`pinned outbound transport failed (${code})`, cause === undefined ? undefined : { cause });
    this.name = 'NetworkBoundaryError';
    this.code = code;
  }
}

function parseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new NetworkBoundaryError('invalid_url', error);
  }
  if (url.username || url.password || url.hash || url.port) {
    throw new NetworkBoundaryError('url_components_rejected');
  }
  return url;
}

export function assertAllowedOutboundUrl(raw, purpose, method = 'GET') {
  const url = parseUrl(raw);
  const table = ALLOWED[purpose];
  if (table === undefined) throw new NetworkBoundaryError('unknown_purpose');
  const key = `${url.origin}${url.pathname}`;
  const methods = table.get(key);
  const queryAllowed = purpose === 'usage' ? url.search === '?format=credits' : url.search.length === 0;
  if (methods === undefined || !methods.has(String(method).toUpperCase()) || !queryAllowed) {
    throw new NetworkBoundaryError('destination_rejected');
  }
  return url;
}

/** Browser navigation is validated separately and is never performed server-side. */
export function validateAuthorizationUrl(raw) {
  const url = parseUrl(raw);
  if (url.protocol !== 'https:' || (url.origin !== AUTH_ORIGIN && url.origin !== ACCOUNTS_ORIGIN)) {
    throw new NetworkBoundaryError('authorization_url_rejected');
  }
  return url.toString();
}

function composeSignal(upstream, timeoutMs) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) controller.abort(upstream.reason);
  else upstream?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new NetworkBoundaryError('timeout')), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', onAbort);
    },
  };
}

export function resolveProxyUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) throw new NetworkBoundaryError('proxy_not_configured');
  let url;
  try { url = new URL(raw); } catch { throw new NetworkBoundaryError('proxy_url_rejected'); }
  // Numeric loopback only: no DNS, embedded credentials, remote proxies or path routing.
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new NetworkBoundaryError('proxy_url_rejected');
  }
  return url.origin;
}

async function defaultRuntime(proxyUrl) {
  const undici = await import('undici');
  return {
    fetchImpl: undici.fetch,
    dispatcher: new undici.ProxyAgent(proxyUrl),
  };
}

export function createPinnedTransport({ proxyUrl, currentProxyUrl, runtimeFactory = defaultRuntime } = {}) {
  const pinnedProxyUrl = resolveProxyUrl(proxyUrl);
  let runtimePromise;
  let closed = false;
  const runtime = () => (runtimePromise ??= Promise.resolve().then(() => runtimeFactory(pinnedProxyUrl)));

  return Object.freeze({
    proxyUrl: pinnedProxyUrl,
    async fetch(raw, init = {}, purpose) {
      if (closed) throw new NetworkBoundaryError('transport_closed');
      if (currentProxyUrl && resolveProxyUrl(currentProxyUrl()) !== pinnedProxyUrl) {
        throw new NetworkBoundaryError('proxy_changed_requires_restart');
      }
      const method = String(init.method ?? 'GET').toUpperCase();
      const url = assertAllowedOutboundUrl(raw, purpose, method);
      const active = await runtime();
      if (typeof active?.fetchImpl !== 'function' || active.dispatcher === undefined) {
        throw new NetworkBoundaryError('dispatcher_unavailable');
      }
      const timeoutMs = Number.isFinite(init.timeoutMs) ? init.timeoutMs : 30_000;
      const combined = composeSignal(init.signal, timeoutMs);
      try {
        const response = await active.fetchImpl(url, {
          ...init,
          timeoutMs: undefined,
          method,
          dispatcher: active.dispatcher,
          redirect: 'manual',
          signal: combined.signal,
        });
        if (response.status >= 300 && response.status < 400) {
          response.body?.cancel?.().catch?.(() => undefined);
          throw new NetworkBoundaryError('redirect_rejected');
        }
        return response;
      } catch (error) {
        if (error instanceof NetworkBoundaryError) throw error;
        if (combined.signal.aborted) throw new NetworkBoundaryError('timeout_or_abort', error);
        throw new NetworkBoundaryError('proxy_request_failed', error);
      } finally {
        combined.dispose();
      }
    },
    async close() {
      closed = true;
      const active = await runtimePromise;
      await active?.dispatcher?.close?.();
    },
  });
}

export async function fetchWithProxy(url, init = {}, purpose) {
  // Directly constructed adapters must explicitly receive the owning plugin transport.
  throw new NetworkBoundaryError('proxy_not_configured');
}

export async function readResponseJson(response, maxBytes = MAX_JSON_BYTES, timeoutMs = 30_000) {
  if (response.body === null || response.body === undefined) return {};
  const reader = response.body.getReader?.();
  if (reader === undefined) {
    try {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new NetworkBoundaryError('response_body_timeout');
          reject(error);
          void response.body?.cancel?.(error).catch?.(() => undefined);
        }, timeoutMs);
      });
      const text = await Promise.race([response.text(), timeout]).finally(() => clearTimeout(timer));
      if (Buffer.byteLength(text) > maxBytes) throw new NetworkBoundaryError('response_too_large');
      return text.length === 0 ? {} : JSON.parse(text);
    } catch (error) {
      await response.body?.cancel?.(error).catch?.(() => undefined);
      if (error instanceof NetworkBoundaryError) throw error;
      throw new NetworkBoundaryError('invalid_json_response', error);
    }
  }
  const chunks = [];
  let size = 0;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new NetworkBoundaryError('response_body_timeout');
      reject(error);
      void reader.cancel(error).catch(() => undefined);
    }, timeoutMs);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new NetworkBoundaryError('response_too_large');
      chunks.push(Buffer.from(value));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text.length === 0 ? {} : JSON.parse(text);
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    if (error instanceof NetworkBoundaryError) throw error;
    throw new NetworkBoundaryError('invalid_json_response', error);
  } finally {
    clearTimeout(timer);
    reader.releaseLock?.();
  }
}

/** One form POST, no retries and no alternate dispatcher. */
export async function postFormJson(pathname, form, timeoutMs = 30_000, transport) {
  if (!['/oauth2/device/code', '/oauth2/token', '/oauth2/revoke'].includes(pathname)) {
    throw new NetworkBoundaryError('oauth_path_rejected');
  }
  if (!transport) throw new NetworkBoundaryError('proxy_not_configured');
  const response = await transport.fetch(`${AUTH_ORIGIN}${pathname}`, {
    method: 'POST',
    headers: {
      ...attributionHeaders(),
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-grok-client-identifier': CLIENT_IDENTIFIER,
      'x-grok-client-surface': 'ui',
      'x-grok-client-version': CLIENT_VERSION,
    },
    body: new URLSearchParams(form).toString(),
    timeoutMs,
  }, 'oauth');
  return { ok: response.ok, status: response.status, body: await readResponseJson(response) };
}
