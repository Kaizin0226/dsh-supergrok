import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinnedTransport, resolveProxyUrl, postFormJson } from '../lib/net.js';
import { apply, resolveOptions } from '../lib/index.js';

test('explicit loopback proxy is required before credentials or transport are accessed', () => {
  assert.throws(() => resolveOptions({}), { code: 'proxy_not_configured' });
  assert.throws(() => apply(new Proxy({}, { get() { throw Error('context must not be touched'); } }), {}), { code: 'proxy_not_configured' });
  for (const value of ['', undefined, 'https://127.0.0.1:7897', 'http://localhost:7897',
    'http://192.0.2.1:7897', 'http://proxy.invalid:7897', 'http://user:pass@127.0.0.1:7897',
    'http://127.0.0.1:7897/proxy', 'http://127.0.0.1:7897/?next=1', 'http://127.0.0.1:7897/#fragment',
    'http://127.0.0.1:99999']) {
    let calls = 0;
    assert.throws(() => createPinnedTransport({ proxyUrl: value, runtimeFactory() { calls++; } }));
    assert.equal(calls, 0);
  }
  assert.equal(resolveProxyUrl('http://127.0.0.1:8080/'), 'http://127.0.0.1:8080');
  assert.equal(resolveProxyUrl('http://[::1]:8080'), 'http://[::1]:8080');
});

test('OAuth, catalog, billing and inference share one explicit dispatcher and disposal', async () => {
  const calls = [];
  let factories = 0;
  let closes = 0;
  let configured = 'http://127.0.0.1:8080';
  const dispatcher = { async close() { closes++; } };
  const transport = createPinnedTransport({ proxyUrl: configured, currentProxyUrl: () => configured,
    async runtimeFactory(proxy) {
      factories++;
      assert.equal(proxy, 'http://127.0.0.1:8080');
      return { dispatcher, async fetchImpl(url, init) { calls.push({ url: String(url), init }); return new Response('{}'); } };
    },
  });
  await postFormJson('/oauth2/device/code', { client_id: 'synthetic' }, 1000, transport);
  await transport.fetch('https://cli-chat-proxy.grok.com/v1/models', {}, 'catalog');
  await transport.fetch('https://cli-chat-proxy.grok.com/v1/billing?format=credits', {}, 'usage');
  await transport.fetch('https://cli-chat-proxy.grok.com/v1/responses', { method: 'POST' }, 'inference');
  assert.equal(factories, 1);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(call => call.init.dispatcher === dispatcher && call.init.redirect === 'manual'));
  configured = 'http://127.0.0.1:8081';
  await assert.rejects(transport.fetch('https://cli-chat-proxy.grok.com/v1/models', {}, 'catalog'), { code: 'proxy_changed_requires_restart' });
  assert.equal(calls.length, 4);
  await transport.close();
  assert.equal(closes, 1);
  await assert.rejects(transport.fetch('https://cli-chat-proxy.grok.com/v1/models', {}, 'catalog'), { code: 'transport_closed' });
});
