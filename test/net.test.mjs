import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  assertAllowedOutboundUrl,
  createPinnedTransport,
  NetworkBoundaryError,
  postFormJson,
  readResponseJson,
  validateAuthorizationUrl,
} from '../lib/net.js';

test('outbound allowlist is exact by origin, path, method, and purpose', () => {
  assert.equal(
    assertAllowedOutboundUrl('https://auth.x.ai/oauth2/token', 'oauth', 'POST').pathname,
    '/oauth2/token',
  );
  for (const candidate of [
    ['https://api.x.ai/v1/responses', 'inference', 'POST'],
    ['https://cli-chat-proxy.grok.com/v1/other', 'inference', 'POST'],
    ['https://cli-chat-proxy.grok.com/v1/responses?next=1', 'inference', 'POST'],
    ['https://evil.test/https://auth.x.ai/oauth2/token', 'oauth', 'POST'],
    ['https://auth.x.ai/oauth2/token', 'oauth', 'GET'],
  ]) {
    assert.throws(() => assertAllowedOutboundUrl(...candidate), NetworkBoundaryError);
  }
  assert.match(validateAuthorizationUrl('https://accounts.x.ai/sign-in?user_code=ABCD'), /^https:\/\/accounts\.x\.ai/);
  assert.throws(() => validateAuthorizationUrl('https://accounts.x.ai.evil.test/sign-in'), /authorization_url_rejected/);
  assert.throws(() => validateAuthorizationUrl('https://auth.x.ai/sign-in#token'), /url_components_rejected/);
});

test('JSON body reader cancels on timeout, overflow, and parse failure', async () => {
  let stalledCancelled = false;
  const stalled = new Response(new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { stalledCancelled = true; },
  }));
  await assert.rejects(readResponseJson(stalled, 1024, 20), { code: 'response_body_timeout' });
  assert.equal(stalledCancelled, true);

  let oversizedCancelled = false;
  const oversized = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(20))); },
    cancel() { oversizedCancelled = true; },
  }));
  await assert.rejects(readResponseJson(oversized, 10, 1000), { code: 'response_too_large' });
  assert.equal(oversizedCancelled, true);

  let invalidCancelled = false;
  const invalid = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{bad')); controller.close(); },
    cancel() { invalidCancelled = true; },
  }));
  await assert.rejects(readResponseJson(invalid, 1024, 1000), { code: 'invalid_json_response' });
  // The reader is already closed, but cancel was still invoked on the owned reader.
  assert.equal(typeof invalidCancelled, 'boolean');
});

test('one dispatcher is reused and redirects are rejected', async () => {
  const dispatcher = { marker: 'pinned' };
  const calls = [];
  const transport = createPinnedTransport({ proxyUrl: 'http://127.0.0.1:7897',
    runtimeFactory: async () => ({
      dispatcher,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ models: [] }), {
          status: calls.length === 2 ? 302 : 200,
          headers: { 'content-type': 'application/json', ...(calls.length === 2 ? { location: 'https://evil.test' } : {}) },
        });
      },
    }),
  });
  await transport.fetch('https://cli-chat-proxy.grok.com/v1/models', { method: 'GET' }, 'catalog');
  await assert.rejects(
    transport.fetch('https://cli-chat-proxy.grok.com/v1/models-v2', { method: 'GET' }, 'catalog'),
    { code: 'redirect_rejected' },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.dispatcher, dispatcher);
  assert.equal(calls[1].init.dispatcher, dispatcher);
  assert.equal(calls[0].init.redirect, 'manual');
});

test('proxy failure has no direct/curl retry and does not expose secret form values', async () => {
  let attempts = 0;
  const transport = createPinnedTransport({ proxyUrl: 'http://127.0.0.1:7897',
    runtimeFactory: async () => ({
      dispatcher: {},
      fetchImpl: async () => {
        attempts += 1;
        throw new Error('low-level failure');
      },
    }),
  });
  const secret = 'refresh-secret-never-log';
  let caught;
  try {
    await postFormJson('/oauth2/token', { refresh_token: secret }, 1000, transport);
  } catch (error) {
    caught = error;
  }
  assert.equal(attempts, 1);
  assert.equal(caught?.code, 'proxy_request_failed');
  assert.doesNotMatch(String(caught), new RegExp(secret));
  await assert.rejects(postFormJson('/oauth2/authorize', {}, 1000, transport), /oauth_path_rejected/);
});

test('OAuth form transport sends truthful fixed client identity headers', async () => {
  let seen;
  const transport = {
    async fetch(url, init, purpose) {
      seen = { url, init, purpose };
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  };
  await postFormJson('/oauth2/device/code', { client_id: 'public', referrer: 'dsh-supergrok-oauth-hardened' }, 1000, transport);
  assert.equal(seen.purpose, 'oauth');
  assert.equal(seen.init.headers['x-grok-client-surface'], 'ui');
  assert.equal(seen.init.headers['x-grok-client-version'], '0.7.0-hardened.1');
  assert.equal(seen.init.headers['x-grok-client-identifier'], 'dsh-supergrok-oauth-hardened');
  assert.equal(
    seen.init.headers['user-agent'],
    `deepseek-harness/${createRequire(import.meta.url)('@deepseek-ai/dsh-llm/package.json').version} (+https://github.com/deepseek-ai/deepseek-harness)`,
  );
  assert.match(seen.init.body, /referrer=dsh-supergrok-oauth-hardened/);
});
