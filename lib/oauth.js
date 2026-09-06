/**
 * DSH-owned OAuth device flow. Tokens exist only in the DSH credential seam
 * under `GROK_OAUTH_TOKENS`; this module never reads or writes Grok CLI files.
 */
import { randomUUID } from 'node:crypto';
import { credentialKey } from '@deepseek-ai/dsh-credentials';
import { CLIENT_IDENTIFIER, OAUTH_CLIENT_ID, OAUTH_SCOPES } from './constants.js';
import { postFormJson, validateAuthorizationUrl } from './net.js';

export const TOKEN_CREDENTIAL_REF = 'GROK_OAUTH_TOKENS';
export const TOKEN_CREDENTIAL_KEY = credentialKey('llm-grok-oauth', 'tokens');
const REFRESH_EARLY_MS = 120_000;
const LOGIN_HARD_TIMEOUT_MS = 11 * 60_000;
const MAX_POLL_INTERVAL_MS = 15_000;
const MAX_SLOW_DOWNS = 12;
const MAX_CREDENTIAL_BYTES = 256 * 1024;

function credentialService(ctx) {
  const service = typeof ctx?.get === 'function' ? ctx.get('credentials') : ctx?.credentials;
  if (service === undefined
    || typeof service.readRecord !== 'function'
    || typeof service.modifyRecord !== 'function'
    || typeof service.deleteRecord !== 'function') {
    const error = new Error('DSH grant credential service is required');
    error.code = 'credential_service_unavailable';
    throw error;
  }
  return service;
}

function strictTokenBundle(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const string = (key, max = 8192) => (typeof value[key] === 'string'
    && value[key].length > 0
    && value[key].length <= max
    && !/[\r\n]/.test(value[key])
    ? value[key]
    : undefined);
  const number = (key) => (Number.isFinite(value[key]) && value[key] > 0 ? Number(value[key]) : undefined);
  const accessToken = string('access_token');
  const refreshToken = string('refresh_token');
  if ((value.access_token !== undefined && accessToken === undefined)
    || (value.refresh_token !== undefined && refreshToken === undefined)
    || (value.token_type !== undefined && string('token_type', 64) === undefined)
    || (value.scope !== undefined && string('scope', 4096) === undefined)) return undefined;
  if (accessToken === undefined && refreshToken === undefined) return undefined;
  return {
    ...(accessToken === undefined ? {} : { access_token: accessToken }),
    ...(refreshToken === undefined ? {} : { refresh_token: refreshToken }),
    ...(string('token_type', 64) === undefined ? {} : { token_type: string('token_type', 64) }),
    ...(string('scope', 4096) === undefined ? {} : { scope: string('scope', 4096) }),
    ...(number('expires_at') === undefined ? {} : { expires_at: number('expires_at') }),
    ...(number('obtained_at') === undefined ? {} : { obtained_at: number('obtained_at') }),
    client_id: OAUTH_CLIENT_ID,
  };
}

function expiryMs(bundle) {
  return Number.isFinite(bundle?.expires_at) ? bundle.expires_at : 0;
}

function isFresh(bundle, earlyMs = REFRESH_EARLY_MS) {
  if (typeof bundle?.access_token !== 'string' || bundle.access_token.length === 0) return false;
  const expires = expiryMs(bundle);
  return expires === 0 || Date.now() < expires - earlyMs;
}

export class TokenStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  assertAvailable() {
    credentialService(this.ctx);
  }

  async load() {
    const record = await credentialService(this.ctx).readRecord(TOKEN_CREDENTIAL_KEY);
    if (record === undefined) return undefined;
    if (record?.kind !== 'grant') {
      const error = new Error('stored OAuth credential is invalid');
      error.code = 'credential_invalid';
      throw error;
    }
    let serialized;
    try {
      serialized = JSON.stringify(record.payload);
    } catch {
      const error = new Error('stored OAuth credential is invalid');
      error.code = 'credential_invalid';
      throw error;
    }
    if (Buffer.byteLength(serialized) > MAX_CREDENTIAL_BYTES) {
      const error = new Error('stored OAuth credential is invalid');
      error.code = 'credential_invalid';
      throw error;
    }
    const bundle = strictTokenBundle(record.payload);
    if (bundle !== undefined) return bundle;
    const error = new Error('stored OAuth credential is invalid');
    error.code = 'credential_invalid';
    throw error;
  }

  async save(bundle) {
    const normalized = strictTokenBundle(bundle);
    if (normalized === undefined) {
      const error = new Error('refusing to store an invalid OAuth credential');
      error.code = 'credential_invalid';
      throw error;
    }
    const serialized = JSON.stringify(normalized);
    if (Buffer.byteLength(serialized) > MAX_CREDENTIAL_BYTES) {
      const error = new Error('refusing to store an oversized OAuth credential');
      error.code = 'credential_too_large';
      throw error;
    }
    await credentialService(this.ctx).modifyRecord(
      TOKEN_CREDENTIAL_KEY,
      async () => ({ kind: 'grant', payload: normalized }),
    );
  }

  async clear() {
    await credentialService(this.ctx).deleteRecord(TOKEN_CREDENTIAL_KEY);
  }

  /**
   * Run a grant read/decision/write under the credential provider's
   * cross-process file lock. Returning undefined keeps the current record.
   */
  async modify(run) {
    const service = credentialService(this.ctx);
    let selected;
    const committed = await service.modifyRecord(TOKEN_CREDENTIAL_KEY, async (record) => {
      if (record !== undefined && record.kind !== 'grant') {
        const error = new Error('stored OAuth credential is invalid');
        error.code = 'credential_invalid';
        throw error;
      }
      const current = record === undefined ? undefined : strictTokenBundle(record.payload);
      if (record !== undefined && current === undefined) {
        const error = new Error('stored OAuth credential is invalid');
        error.code = 'credential_invalid';
        throw error;
      }
      const next = await run(current);
      if (next === undefined) {
        selected = current;
        return undefined;
      }
      const normalized = strictTokenBundle(next);
      if (normalized === undefined) {
        const error = new Error('refusing to store an invalid OAuth credential');
        error.code = 'credential_invalid';
        throw error;
      }
      const serialized = JSON.stringify(normalized);
      if (Buffer.byteLength(serialized) > MAX_CREDENTIAL_BYTES) {
        const error = new Error('refusing to store an oversized OAuth credential');
        error.code = 'credential_too_large';
        throw error;
      }
      selected = normalized;
      return { kind: 'grant', payload: normalized };
    });
    if (selected !== undefined) return selected;
    if (committed?.kind === 'grant') return strictTokenBundle(committed.payload);
    return undefined;
  }
}

export class OAuthFlowError extends Error {
  constructor(message, oauthCode, status, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'OAuthFlowError';
    this.oauthCode = oauthCode;
    this.status = status;
  }
}

function providerFailure(body, status) {
  const admittedCodes = new Set([
    'authorization_pending',
    'slow_down',
    'expired_token',
    'access_denied',
    'invalid_grant',
    'invalid_client',
    'invalid_request',
    'unsupported_grant_type',
  ]);
  const rawCode = typeof body?.error === 'string' ? body.error : undefined;
  const code = admittedCodes.has(rawCode) ? rawCode : `http_${status}`;
  const safeMessages = {
    authorization_pending: '等待用户完成授权',
    slow_down: '授权服务要求降低轮询频率',
    expired_token: '设备码已过期，请重新发起登录',
    access_denied: '用户拒绝了授权',
    invalid_grant: 'OAuth 授权已失效，请重新登录',
    invalid_client: 'OAuth 客户端未获授权',
  };
  return new OAuthFlowError(safeMessages[code] ?? 'xAI OAuth 请求失败', code, status);
}

function adoptedBundle(tokens, previous) {
  const now = Date.now();
  const expiresIn = Number(tokens?.expires_in);
  if (typeof tokens?.access_token !== 'string' || tokens.access_token.length === 0) {
    throw new OAuthFlowError('xAI OAuth 响应缺少新的访问令牌', 'invalid_token_response');
  }
  const candidate = {
    access_token: tokens.access_token,
    refresh_token: typeof tokens?.refresh_token === 'string' ? tokens.refresh_token : previous?.refresh_token,
    token_type: typeof tokens?.token_type === 'string' ? tokens.token_type : previous?.token_type ?? 'Bearer',
    scope: typeof tokens?.scope === 'string' ? tokens.scope : previous?.scope,
    expires_at: Number.isFinite(expiresIn) && expiresIn > 0
      ? now + Math.floor(expiresIn * 1000)
      : previous?.expires_at,
    obtained_at: now,
    client_id: OAUTH_CLIENT_ID,
  };
  const normalized = strictTokenBundle(candidate);
  if (normalized?.access_token === undefined) {
    throw new OAuthFlowError('xAI OAuth 响应缺少访问令牌', 'invalid_token_response');
  }
  return normalized;
}

export class GrokOAuth {
  constructor(store, logger, publishStatus, dependencies = {}) {
    this.store = store;
    this.logger = logger;
    this.publishStatus = publishStatus ?? (async () => {});
    this.postForm = dependencies.postForm ?? postFormJson;
    this.sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = dependencies.now ?? (() => Date.now());
    this.pendingDevice = new Map();
    this.refreshing = undefined;
    this.loginTask = undefined;
    this.loginStarting = undefined;
    this.loginEpoch = 0;
  }

  async #post(pathname, form) {
    if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1') {
      throw new OAuthFlowError(
        'SuperGrok acceptance mode forbids OAuth network requests; refresh the token before launching acceptance',
        'acceptance_oauth_disabled',
      );
    }
    let result;
    try {
      result = await this.postForm(pathname, form, 30_000);
    } catch (error) {
      throw new OAuthFlowError('无法通过固定代理访问 xAI 认证服务', 'network', undefined, error);
    }
    if (!result?.ok) throw providerFailure(result?.body, result?.status ?? 0);
    return result.body ?? {};
  }

  async #adopt(tokens, previous, guard) {
    const bundle = adoptedBundle(tokens, previous);
    await this.store.modify((current) => {
      if (guard !== undefined && !guard()) {
        throw new OAuthFlowError('登录已取消', 'signed_out');
      }
      return adoptedBundle(tokens, current ?? previous);
    });
    this.notifyCatalogChanged?.();
    return bundle;
  }

  async beginDeviceLogin(expectedEpoch = this.loginEpoch) {
    const body = await this.#post('/oauth2/device/code', {
      client_id: OAUTH_CLIENT_ID,
      scope: OAUTH_SCOPES,
      referrer: CLIENT_IDENTIFIER,
    });
    if (expectedEpoch !== this.loginEpoch) throw new OAuthFlowError('登录已取消', 'signed_out');
    if (typeof body.device_code !== 'string'
      || body.device_code.length === 0
      || body.device_code.length > 4096
      || /[\r\n]/.test(body.device_code)) {
      throw new OAuthFlowError('xAI 未返回设备码', 'invalid_device_response');
    }
    if (body.user_code !== undefined
      && (typeof body.user_code !== 'string'
        || body.user_code.length === 0
        || body.user_code.length > 64
        || !/^[A-Za-z0-9-]+$/.test(body.user_code))) {
      throw new OAuthFlowError('xAI 返回了无效的用户代码', 'invalid_device_response');
    }
    const verificationUri = typeof body.verification_uri === 'string'
      ? validateAuthorizationUrl(body.verification_uri)
      : undefined;
    const verificationUriComplete = typeof body.verification_uri_complete === 'string'
      ? validateAuthorizationUrl(body.verification_uri_complete)
      : undefined;
    if (verificationUri === undefined && verificationUriComplete === undefined) {
      throw new OAuthFlowError('xAI 未返回受信任的授权地址', 'invalid_device_response');
    }
    const expiresIn = Number(body.expires_in);
    const interval = Number(body.interval);
    const handle = randomUUID();
    const intervalMs = Number.isFinite(interval) && interval > 0 ? Math.max(1000, interval * 1000) : 5000;
    const expiresAt = this.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 600_000);
    this.pendingDevice.set(handle, {
      deviceCode: body.device_code,
      intervalMs,
      expiresAt,
      epoch: expectedEpoch,
    });
    return {
      handle,
      userCode: typeof body.user_code === 'string' ? body.user_code : undefined,
      verificationUri,
      verificationUriComplete,
      intervalMs,
      expiresAt,
    };
  }

  async pollDeviceLogin(handle) {
    const pending = this.pendingDevice.get(handle);
    if (pending === undefined) throw new OAuthFlowError('设备登录句柄无效或已过期', 'invalid_handle');
    if (this.now() >= pending.expiresAt) {
      this.pendingDevice.delete(handle);
      throw new OAuthFlowError('设备码已过期，请重新发起登录', 'expired_token');
    }
    let body;
    try {
      body = await this.#post('/oauth2/token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: pending.deviceCode,
        client_id: OAUTH_CLIENT_ID,
      });
    } catch (error) {
      if (error instanceof OAuthFlowError && error.oauthCode === 'authorization_pending') {
        return { status: 'pending', intervalMs: pending.intervalMs };
      }
      if (error instanceof OAuthFlowError && error.oauthCode === 'slow_down') {
        pending.intervalMs = Math.min(pending.intervalMs + 5000, MAX_POLL_INTERVAL_MS);
        return { status: 'pending', slowDown: true, intervalMs: pending.intervalMs };
      }
      this.pendingDevice.delete(handle);
      throw error;
    }
    const guard = () => this.loginEpoch === pending.epoch && this.pendingDevice.get(handle) === pending;
    const bundle = await this.#adopt(body, undefined, guard);
    this.pendingDevice.delete(handle);
    return { status: 'ok', expiresAt: bundle.expires_at };
  }

  async getAccessToken(rejectedAccessToken) {
    const initial = await this.store.load();
    if (process.env.DSH_SUPERGROK_ACCEPTANCE === '1') {
      const expiresAt = expiryMs(initial);
      const provablyFresh = typeof initial?.access_token === 'string'
        && initial.access_token.length > 0
        && Number.isFinite(expiresAt)
        && expiresAt > this.now() + REFRESH_EARLY_MS;
      if (!provablyFresh || rejectedAccessToken !== undefined) {
        throw new OAuthFlowError(
          'SuperGrok acceptance requires an access token with a proven expiry more than two minutes away',
          'acceptance_token_not_fresh',
        );
      }
      return initial.access_token;
    }
    if (rejectedAccessToken === undefined && isFresh(initial)) return initial.access_token;
    if (rejectedAccessToken !== undefined
      && initial?.access_token !== rejectedAccessToken
      && isFresh(initial)) return initial.access_token;
    if (initial?.refresh_token === undefined) return undefined;
    this.refreshing ??= this.store.modify(async (current) => {
      if (rejectedAccessToken === undefined && isFresh(current)) return undefined;
      if (rejectedAccessToken !== undefined
        && current?.access_token !== rejectedAccessToken
        && isFresh(current)) return undefined;
      if (current?.refresh_token === undefined) return undefined;
      const tokens = await this.#post('/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: current.refresh_token,
        client_id: OAUTH_CLIENT_ID,
      });
      const bundle = adoptedBundle(tokens, current);
      this.logger?.info('grok-oauth: OAuth access token refreshed');
      return bundle;
    }).finally(() => {
      this.refreshing = undefined;
    });
    return (await this.refreshing)?.access_token;
  }

  /** Exactly one synchronous revoke attempt, followed by local credential removal. */
  async logout() {
    this.loginEpoch += 1;
    this.pendingDevice.clear();
    let bundle;
    let operationError;
    try {
      bundle = await this.store.load();
      const token = bundle?.refresh_token ?? bundle?.access_token;
      if (token !== undefined) {
        await this.#post('/oauth2/revoke', {
          token,
          token_type_hint: bundle?.refresh_token !== undefined ? 'refresh_token' : 'access_token',
          client_id: OAUTH_CLIENT_ID,
        });
      }
    } catch (error) {
      operationError = error;
    } finally {
      await this.store.clear();
      await this.publishStatus({
        oauthStatus: 'signed-out',
        oauthMessage: operationError === undefined ? '已退出登录' : '本地凭据已清除；远端撤销未完成',
        verificationUrl: '',
        userCode: '',
      });
    }
    if (operationError !== undefined) throw operationError;
    return { revoked: bundle !== undefined };
  }

  async status() {
    const bundle = await this.store.load();
    return {
      loggedIn: bundle?.access_token !== undefined || bundle?.refresh_token !== undefined,
      expiresAt: bundle?.expires_at,
      obtainedAt: bundle?.obtained_at,
      scope: bundle?.scope,
    };
  }

  async uiStatus() {
    const status = await this.status();
    return {
      oauthStatus: status.loggedIn ? 'signed-in' : 'signed-out',
      oauthMessage: status.loggedIn ? 'Grok 账号已登录' : '',
      verificationUrl: '',
      userCode: '',
    };
  }

  async hydrate() {
    this.store.assertAvailable();
    const status = await this.uiStatus();
    await this.publishStatus(status);
    return status;
  }

  async startLogin() {
    if (this.loginStarting !== undefined || this.loginTask !== undefined) {
      return { started: false, status: 'pending' };
    }
    const starting = (async () => {
      const epoch = ++this.loginEpoch;
      let device;
      try {
        device = await this.beginDeviceLogin(epoch);
      } catch (error) {
        await this.publishStatus({
          oauthStatus: 'error',
          oauthMessage: error instanceof OAuthFlowError ? error.message : '登录失败',
          verificationUrl: '',
          userCode: '',
        });
        throw error;
      }
      const verificationUrl = device.verificationUriComplete ?? device.verificationUri;
      await this.publishStatus({
        oauthStatus: 'pending',
        oauthMessage: device.userCode ? `在浏览器中确认代码 ${device.userCode}` : '请在浏览器中完成登录',
        verificationUrl,
        userCode: device.userCode ?? '',
      });
      this.loginTask = this.#runLogin(epoch, device).finally(() => {
        this.loginTask = undefined;
      });
      void this.loginTask.catch(() => undefined);
      return { started: true, status: 'pending' };
    })();
    this.loginStarting = starting;
    try {
      return await starting;
    } finally {
      if (this.loginStarting === starting) this.loginStarting = undefined;
    }
  }

  async cancelLogin() {
    this.loginEpoch += 1;
    this.pendingDevice.clear();
    await this.publishStatus({
      oauthStatus: 'signed-out',
      oauthMessage: '已取消登录',
      verificationUrl: '',
      userCode: '',
    });
  }

  async #runLogin(epoch, device) {
    const hardDeadline = Math.min(device.expiresAt, this.now() + LOGIN_HARD_TIMEOUT_MS);
    let intervalMs = Math.min(device.intervalMs, MAX_POLL_INTERVAL_MS);
    let slowDowns = 0;
    try {
      while (epoch === this.loginEpoch && this.now() < hardDeadline) {
        await this.sleep(Math.min(intervalMs, Math.max(1, hardDeadline - this.now())));
        if (epoch !== this.loginEpoch) return;
        const result = await this.pollDeviceLogin(device.handle);
        if (result.status === 'ok') {
          await this.publishStatus({
            oauthStatus: 'signed-in',
            oauthMessage: 'Grok 账号已登录',
            verificationUrl: '',
            userCode: '',
          });
          return;
        }
        if (result.slowDown === true && ++slowDowns >= MAX_SLOW_DOWNS) {
          throw new OAuthFlowError('登录轮询被限速过久，请重新发起', 'slow_down');
        }
        intervalMs = Math.min(result.intervalMs ?? intervalMs, MAX_POLL_INTERVAL_MS);
      }
      if (epoch === this.loginEpoch) throw new OAuthFlowError('设备码已过期，请重新发起登录', 'expired_token');
    } catch (error) {
      if (epoch !== this.loginEpoch) return;
      this.pendingDevice.delete(device.handle);
      this.logger?.warn('grok-oauth: login failed');
      await this.publishStatus({
        oauthStatus: 'error',
        oauthMessage: error instanceof OAuthFlowError ? error.message : '登录失败',
        verificationUrl: '',
        userCode: '',
      });
      throw error;
    }
  }
}


