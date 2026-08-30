/** Hardened SuperGrok OAuth provider for DeepSeek Harness. */
import z from '@deepseek-ai/schemastery';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { GrokAdapter } from './adapter.js';
import {
  CATALOG_SYNC_SECONDS,
  CHAT_PROXY_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  MODEL,
  MODELS_REFRESH_SECONDS_DEFAULT,
  MODELS_REFRESH_SECONDS_MAX,
  MODELS_REFRESH_SECONDS_MIN,
  PROVIDER,
  REASONING_EFFORT,
} from './constants.js';
import {
  createCsrfNonce,
  readEmptyJsonBody,
  validateBrowserRequest,
} from './local-security.js';
import { GrokOAuth, TokenStore } from './oauth.js';

export const name = 'llm-grok-oauth';
export const inject = ['llm', 'credentials'];
export {
  CATALOG_SYNC_SECONDS,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  MODEL,
  MODELS_REFRESH_SECONDS_DEFAULT,
  MODELS_REFRESH_SECONDS_MAX,
  MODELS_REFRESH_SECONDS_MIN,
  PROVIDER,
  REASONING_EFFORT,
};

const NS = settingsNamespace('llm-grok-oauth');

export const Config = z.object({
  model: z.const(DEFAULT_MODEL).description('生产默认订阅模型（不作为目录白名单）').default(DEFAULT_MODEL),
  reasoningEffort: z.const(DEFAULT_REASONING_EFFORT).description('生产默认推理强度（不作为目录白名单）').default(DEFAULT_REASONING_EFFORT),
  modelsRefreshSeconds: z.number()
    .step(1)
    .min(MODELS_REFRESH_SECONDS_MIN)
    .max(MODELS_REFRESH_SECONDS_MAX)
    .description('账号授权目录缓存秒数')
    .default(MODELS_REFRESH_SECONDS_DEFAULT),
  defaultContextWindow: z.number().step(1).min(1).description('实时目录未声明时的展示值').default(131072),
  streamIdleTimeoutMs: z.number().step(1).min(1000).description('流式响应空闲超时').default(300000),
  requestTimeoutMs: z.number().step(1).min(1000).description('建立推理请求的超时').default(300000),
});

const REJECTED_CONFIG_KEYS = Object.freeze([
  'baseURL',
  'authBaseURL',
  'clientId',
  'scopes',
  'provider',
  'permission',
  'models',
  'retryPolicy',
  'proxyUrl',
  'allowedOrigins',
  'protocolProvenance',
  'pluginPath',
  'pluginVersion',
]);

export function resolveOptions(config = {}) {
  for (const key of REJECTED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      throw new Error(`llm-grok-oauth: security-critical setting ${key} is not configurable`);
    }
  }
  if (config.model !== undefined && config.model !== MODEL) throw new Error('llm-grok-oauth: model drift');
  if (config.reasoningEffort !== undefined && config.reasoningEffort !== REASONING_EFFORT) {
    throw new Error('llm-grok-oauth: reasoning drift');
  }
  const positive = (value, fallback, label, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) => {
    const resolved = value ?? fallback;
    if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
      throw new Error(`llm-grok-oauth: invalid ${label}`);
    }
    return resolved;
  };
  return Object.freeze({
    baseURL: CHAT_PROXY_BASE_URL,
    model: DEFAULT_MODEL,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    modelsRefreshSeconds: positive(
      config.modelsRefreshSeconds,
      MODELS_REFRESH_SECONDS_DEFAULT,
      'modelsRefreshSeconds',
      MODELS_REFRESH_SECONDS_MIN,
      MODELS_REFRESH_SECONDS_MAX,
    ),
    defaultContextWindow: positive(config.defaultContextWindow, 131072, 'defaultContextWindow'),
    streamIdleTimeoutMs: positive(config.streamIdleTimeoutMs, 300000, 'streamIdleTimeoutMs', 1000),
    requestTimeoutMs: positive(config.requestTimeoutMs, 300000, 'requestTimeoutMs', 1000),
  });
}
function writeJson(res, status, body) {
  const encoded = JSON.stringify(body);
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(encoded),
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  res.end(encoded);
}

function errorStatus(error) {
  if (error?.code === 'body_too_large') return 413;
  if (error?.code === 'invalid_json' || error?.code === 'unexpected_body') return 400;
  if (error?.code === 'credential_service_unavailable') return 503;
  return 500;
}

const PUBLIC_OPERATION_ERROR_CODES = new Set([
  'acceptance_oauth_disabled',
  'acceptance_token_not_fresh',
  'access_denied',
  'authorization_pending',
  'body_too_large',
  'credential_service_unavailable',
  'expired_token',
  'invalid_client',
  'invalid_device_response',
  'invalid_grant',
  'invalid_handle',
  'invalid_json',
  'invalid_request',
  'invalid_token_response',
  'network',
  'signed_out',
  'slow_down',
  'unexpected_body',
  'unsupported_grant_type',
]);

function publicOperationErrorCode(error) {
  const raw = error?.oauthCode ?? error?.code;
  if (PUBLIC_OPERATION_ERROR_CODES.has(raw)) return raw;
  if (typeof raw === 'string' && /^http_[0-9]{1,3}$/.test(raw)) return raw;
  return 'operation_failed';
}

export function apply(ctx, config) {
  let current = () => config;
  const options = () => resolveOptions(current() ?? {});
  options();

  const store = new TokenStore(ctx);
  store.assertAvailable();
  let lastStatus = {
    oauthStatus: 'signed-out',
    oauthMessage: '',
    verificationUrl: '',
    userCode: '',
  };
  const publishStatus = async (patch) => {
    lastStatus = { ...lastStatus, ...patch };
  };
  const oauth = new GrokOAuth(store, ctx.logger, publishStatus);
  const adapter = new GrokAdapter(options, oauth, ctx.logger);

  ctx.llm.registerConfigurableProviders([{
    provider: PROVIDER,
    displayName: 'SuperGrok（DSH OAuth）',
    settingsNs: NS,
    settingsPath: [],
  }]);
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter);
  const publishAdapterUpdate = () => {
    try {
      registration.replace([PROVIDER]);
    } catch {
      // Context disposal can race catalog or OAuth completion.
    }
  };
  adapter.setCatalogChangedListener(publishAdapterUpdate);
  oauth.notifyCatalogChanged = () => {
    adapter.invalidateCatalog();
    publishAdapterUpdate();
  };

  if (process.env.DSH_SUPERGROK_ACCEPTANCE !== '1') {
    ctx.effect?.(() => {
      let running = false;
      let disposed = false;
      const tick = async () => {
        if (disposed || running) return;
        running = true;
        try {
          await adapter.refreshCatalog();
        } catch {
          // The adapter normally converts every catalog failure into an empty
          // live snapshot. This containment also prevents a scheduler failure
          // from becoming an unhandled rejection.
          ctx.logger?.warn('llm-grok-oauth: scheduled catalog refresh failed');
          adapter.clearCatalog();
        } finally {
          running = false;
        }
      };
      const timer = setInterval(() => void tick(), CATALOG_SYNC_SECONDS * 1000);
      timer.unref?.();
      return () => {
        disposed = true;
        clearInterval(timer);
        adapter.disposeCatalog();
      };
    }, 'llm-grok-oauth: fixed live catalog synchronization');
  }

  const csrfNonce = createCsrfNonce();
  ctx.inject(['webServer'], (webCtx) => {
    const handler = (method, mutation, run) => async (req, res) => {
      if (req.method !== method) {
        writeJson(res, 405, { ok: false, error: 'method_not_allowed' });
        return;
      }
      const check = validateBrowserRequest(req, { mutation, csrfNonce });
      if (!check.ok) {
        writeJson(res, check.status, { ok: false, error: check.code });
        return;
      }
      try {
        if (mutation) await readEmptyJsonBody(req);
        const extra = await run();
        writeJson(res, 200, {
          ok: true,
          ...lastStatus,
          ...(mutation ? {} : { csrfToken: csrfNonce }),
          ...(extra === undefined ? {} : extra),
        });
      } catch (error) {
        const code = publicOperationErrorCode(error);
        ctx.logger?.warn(`llm-grok-oauth: management action failed (${code})`);
        writeJson(res, errorStatus(error), { ok: false, error: code, ...lastStatus });
      }
    };
    const register = (path, routeHandler, description) => webCtx.effect(
      () => webCtx.webServer.register({ kind: 'exact', path, handler: routeHandler }),
      description,
    );
    register('/api/llm-grok-oauth/status', handler('GET', false, async () => {
      if (lastStatus.oauthStatus !== 'pending') lastStatus = { ...lastStatus, ...await oauth.uiStatus() };
    }), 'llm-grok-oauth: status route');
    register('/api/llm-grok-oauth/catalog-status', handler('GET', false, async () => ({
      catalog: adapter.catalogStatus(),
    })), 'llm-grok-oauth: catalog status route');
    register('/api/llm-grok-oauth/login', handler('POST', true, async () => {
      await publishStatus({
        oauthStatus: 'pending',
        oauthMessage: '正在发起设备登录…',
        verificationUrl: '',
        userCode: '',
      });
      await oauth.startLogin();
    }), 'llm-grok-oauth: login route');
    register('/api/llm-grok-oauth/logout', handler('POST', true, async () => {
      await oauth.logout();
      oauth.notifyCatalogChanged?.();
    }), 'llm-grok-oauth: logout route');
    register('/api/llm-grok-oauth/cancel', handler('POST', true, async () => {
      await oauth.cancelLogin();
    }), 'llm-grok-oauth: cancel route');
  });

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source;
      options();
    },
    onChange: () => {
      options();
    },
  });

  void oauth.hydrate().catch(() => {
    ctx.logger?.warn('llm-grok-oauth: credential hydration failed');
  });
  ctx.effect?.(() => () => {
    void oauth.cancelLogin();
  }, 'llm-grok-oauth: cancel login on dispose');
}
