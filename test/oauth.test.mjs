import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GrokOAuth,
  OAuthFlowError,
  TOKEN_CREDENTIAL_KEY,
  TokenStore,
} from '../lib/oauth.js';

function grantService(initial) {
  let record = initial;
  let chain = Promise.resolve();
  const calls = { read: 0, modify: 0, delete: 0, resolve: 0 };
  return {
    calls,
    get record() { return record; },
    async readRecord(key) {
      assert.equal(key, TOKEN_CREDENTIAL_KEY);
      calls.read += 1;
      return record;
    },
    async modifyRecord(key, mutate) {
      assert.equal(key, TOKEN_CREDENTIAL_KEY);
      calls.modify += 1;
      let result;
      chain = chain.then(async () => {
        const next = await mutate(record);
        if (next !== undefined) record = next;
        result = record;
      });
      await chain;
      return result;
    },
    async deleteRecord(key) {
      assert.equal(key, TOKEN_CREDENTIAL_KEY);
      calls.delete += 1;
      record = undefined;
    },
    async resolve() {
      calls.resolve += 1;
      throw new Error('CredentialRef must never be used');
    },
  };
}

function context(service) {
  return { get: (name) => (name === 'credentials' ? service : undefined) };
}

function bundle(access = 'access-old', refresh = 'refresh-old', expiresAt = Date.now() + 600_000) {
  return { kind: 'grant', payload: { access_token: access, refresh_token: refresh, expires_at: expiresAt } };
}

test('TokenStore requires GrantRecord service and ignores ambient credential refs', async () => {
  process.env.GROK_OAUTH_TOKENS = 'ambient-must-not-win';
  try {
    assert.throws(() => new TokenStore(context({ resolve() {} })).assertAvailable(), { code: 'credential_service_unavailable' });
    const service = grantService(bundle());
    const store = new TokenStore(context(service));
    assert.equal((await store.load()).access_token, 'access-old');
    assert.equal(service.calls.resolve, 0);
    await store.save({ access_token: 'access-new', refresh_token: 'refresh-new', expires_at: Date.now() + 1000 });
    assert.equal(service.record.kind, 'grant');
    assert.equal(service.record.payload.access_token, 'access-new');
  } finally {
    delete process.env.GROK_OAUTH_TOKENS;
  }
});

test('device flow validates authorization origin and stores a grant record', async () => {
  const service = grantService();
  const store = new TokenStore(context(service));
  const replies = [
    { ok: true, status: 200, body: {
      device_code: 'device-secret', user_code: 'ABCD',
      verification_uri: 'https://accounts.x.ai/device', expires_in: 600, interval: 1,
    } },
    { ok: false, status: 400, body: { error: 'authorization_pending' } },
    { ok: true, status: 200, body: {
      access_token: 'access-device', refresh_token: 'refresh-device', expires_in: 600,
    } },
  ];
  const oauth = new GrokOAuth(store, undefined, undefined, { postForm: async () => replies.shift() });
  const device = await oauth.beginDeviceLogin();
  assert.equal((await oauth.pollDeviceLogin(device.handle)).status, 'pending');
  assert.equal((await oauth.pollDeviceLogin(device.handle)).status, 'ok');
  assert.equal(service.record.kind, 'grant');
  assert.equal(service.record.payload.access_token, 'access-device');
});

test('refresh requires a new access token and never falls back to rejected token', async () => {
  const service = grantService(bundle('rejected', 'refresh', Date.now() + 600_000));
  const oauth = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
    postForm: async () => ({ ok: true, status: 200, body: { refresh_token: 'rotated-refresh', expires_in: 600 } }),
  });
  await assert.rejects(oauth.getAccessToken('rejected'), { oauthCode: 'invalid_token_response' });
  assert.equal(service.record.payload.access_token, 'rejected');
});

test('modifyRecord provides one cross-instance refresh and reuses rotated access token', async () => {
  const service = grantService(bundle('rejected', 'refresh', Date.now() + 600_000));
  let refreshCalls = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const dependencies = {
    postForm: async () => {
      refreshCalls += 1;
      await barrier;
      return { ok: true, status: 200, body: { access_token: 'rotated', refresh_token: 'rotated-r', expires_in: 600 } };
    },
  };
  const one = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, dependencies);
  const two = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, dependencies);
  const first = one.getAccessToken('rejected');
  const second = two.getAccessToken('rejected');
  await new Promise((resolve) => setImmediate(resolve));
  release();
  assert.deepEqual(await Promise.all([first, second]), ['rotated', 'rotated']);
  assert.equal(refreshCalls, 1);
});

test('logout clears invalid local record even when revoke cannot be attempted', async () => {
  const service = grantService({ kind: 'grant', payload: { bad: 'record' } });
  const oauth = new GrokOAuth(new TokenStore(context(service)));
  await assert.rejects(oauth.logout(), { code: 'credential_invalid' });
  assert.equal(service.calls.delete, 1);
  assert.equal(service.record, undefined);
});

test('logout performs exactly one awaited revoke and then deletes the grant', async () => {
  const service = grantService(bundle());
  let revokes = 0;
  const oauth = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
    postForm: async (path) => {
      assert.equal(path, '/oauth2/revoke');
      revokes += 1;
      return { ok: true, status: 200, body: {} };
    },
  });
  await oauth.logout();
  assert.equal(revokes, 1);
  assert.equal(service.calls.delete, 1);
  assert.equal(service.record, undefined);
});

test('concurrent startLogin calls issue only one device-code request', async () => {
  const service = grantService();
  let deviceRequests = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const oauth = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
    postForm: async (path) => {
      if (path !== '/oauth2/device/code') return { ok: false, status: 400, body: { error: 'authorization_pending' } };
      deviceRequests += 1;
      await barrier;
      return { ok: true, status: 200, body: {
        device_code: 'device', user_code: 'ABCD', verification_uri: 'https://accounts.x.ai/device', expires_in: 600,
      } };
    },
    sleep: async () => new Promise(() => {}),
  });
  const first = oauth.startLogin();
  const second = oauth.startLogin();
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(deviceRequests, 1);
  assert.deepEqual([a.started, b.started].sort(), [false, true]);
  await oauth.cancelLogin();
});

test('cancel during an in-flight token poll cannot write a returned token', async () => {
  const service = grantService();
  let release;
  let tokenRequestStarted;
  const started = new Promise((resolve) => { tokenRequestStarted = resolve; });
  const barrier = new Promise((resolve) => { release = resolve; });
  const oauth = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
    postForm: async (path) => {
      if (path === '/oauth2/device/code') return { ok: true, status: 200, body: {
        device_code: 'device', user_code: 'ABCD', verification_uri: 'https://accounts.x.ai/device', expires_in: 600,
      } };
      tokenRequestStarted();
      await barrier;
      return { ok: true, status: 200, body: { access_token: 'must-not-persist', refresh_token: 'must-not-persist', expires_in: 600 } };
    },
  });
  const device = await oauth.beginDeviceLogin();
  const polling = oauth.pollDeviceLogin(device.handle);
  await started;
  await oauth.cancelLogin();
  release();
  await assert.rejects(polling, { oauthCode: 'signed_out' });
  assert.equal(service.record, undefined);
});

test('device flow rejects malformed or oversized codes', async () => {
  const service = grantService();
  for (const body of [
    { device_code: 'device', user_code: 'bad code!', verification_uri: 'https://accounts.x.ai/device' },
    { device_code: 'x'.repeat(4097), user_code: 'ABCD', verification_uri: 'https://accounts.x.ai/device' },
  ]) {
    const oauth = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
      postForm: async () => ({ ok: true, status: 200, body }),
    });
    await assert.rejects(oauth.beginDeviceLogin(), { oauthCode: 'invalid_device_response' });
  }
});

test('OAuth errors and logger entries do not contain token material', async () => {
  const secret = 'never-echo-this-secret';
  const service = grantService(bundle('rejected', secret));
  const logs = [];
  const oauth = new GrokOAuth(new TokenStore(context(service)), { info: (line) => logs.push(line), warn: (line) => logs.push(line) }, undefined, {
    postForm: async () => { throw new Error(secret); },
  });
  let caught;
  try { await oauth.getAccessToken('rejected'); } catch (error) { caught = error; }
  assert.equal(caught instanceof OAuthFlowError, true);
  assert.doesNotMatch(String(caught), new RegExp(secret));
  assert.doesNotMatch(logs.join('\n'), new RegExp(secret));
});

test('arbitrary provider error strings are reduced to a status code', async () => {
  const secret = 'provider-secret-in-error';
  const oauth = new GrokOAuth(new TokenStore(context(grantService())), undefined, undefined, {
    postForm: async () => ({ ok: false, status: 400, body: { error: secret } }),
  });
  let caught;
  try { await oauth.beginDeviceLogin(); } catch (error) { caught = error; }
  assert.equal(caught?.oauthCode, 'http_400');
  assert.doesNotMatch(String(caught), new RegExp(secret));
});

test('acceptance mode forbids OAuth network before device login or refresh dispatch', async () => {
  process.env.DSH_SUPERGROK_ACCEPTANCE = '1';
  try {
    let networkCalls = 0;
    const ctx = context(grantService(bundle(
      'expired-access',
      'refresh-token',
      Date.now() - 1000,
    )));
    const oauth = new GrokOAuth(new TokenStore(ctx), undefined, undefined, {
      postForm: async () => { networkCalls += 1; throw new Error('must not dispatch'); },
    });
    await assert.rejects(oauth.beginDeviceLogin(), { oauthCode: 'acceptance_oauth_disabled' });
    await assert.rejects(oauth.getAccessToken(), { oauthCode: 'acceptance_token_not_fresh' });
    assert.equal(networkCalls, 0);

    for (const unproven of [
      bundle('access-no-expiry', 'refresh-token', 0),
      bundle('access-too-close', 'refresh-token', Date.now() + 119_000),
    ]) {
      const service = grantService(unproven);
      const guarded = new GrokOAuth(new TokenStore(context(service)), undefined, undefined, {
        postForm: async () => { networkCalls += 1; throw new Error('must not dispatch'); },
      });
      await assert.rejects(guarded.getAccessToken(), { oauthCode: 'acceptance_token_not_fresh' });
    }

    const freshService = grantService(bundle('fresh-access', 'refresh-token', Date.now() + 121_000));
    const fresh = new GrokOAuth(new TokenStore(context(freshService)), undefined, undefined, {
      postForm: async () => { networkCalls += 1; throw new Error('must not dispatch'); },
    });
    assert.equal(await fresh.getAccessToken(), 'fresh-access');
    assert.equal(networkCalls, 0);
  } finally {
    delete process.env.DSH_SUPERGROK_ACCEPTANCE;
  }
});
