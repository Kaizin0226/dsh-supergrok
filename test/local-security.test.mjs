import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  MAX_MANAGEMENT_BODY_BYTES,
  readEmptyJsonBody,
  validateBrowserRequest,
} from '../lib/local-security.js';

function request(overrides = {}) {
  return {
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      host: '127.0.0.1:24680',
      origin: 'http://127.0.0.1:24680',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'content-type': 'application/json',
      'content-length': '2',
      'x-dsh-grok-csrf': 'nonce',
    },
    ...overrides,
  };
}

test('management request requires loopback host, same-origin fetch metadata and CSRF', () => {
  assert.equal(validateBrowserRequest(request(), { mutation: true, csrfNonce: 'nonce' }).ok, true);
  assert.equal(validateBrowserRequest(request({ socket: { remoteAddress: '10.0.0.2' } }), { mutation: true, csrfNonce: 'nonce' }).code, 'loopback_required');
  assert.equal(validateBrowserRequest(request({ headers: { ...request().headers, host: 'evil.test' } }), { mutation: true, csrfNonce: 'nonce' }).code, 'invalid_host');
  assert.equal(validateBrowserRequest(request({ headers: { ...request().headers, origin: 'http://evil.test' } }), { mutation: true, csrfNonce: 'nonce' }).code, 'origin_mismatch');
  assert.equal(validateBrowserRequest(request({ headers: { ...request().headers, 'sec-fetch-site': 'cross-site' } }), { mutation: true, csrfNonce: 'nonce' }).code, 'browser_context_required');
  assert.equal(validateBrowserRequest(request({ headers: { ...request().headers, 'x-dsh-grok-csrf': 'wrong' } }), { mutation: true, csrfNonce: 'nonce' }).code, 'csrf_mismatch');
  assert.equal(validateBrowserRequest(request({ headers: { ...request().headers, 'content-type': 'text/plain' } }), { mutation: true, csrfNonce: 'nonce' }).status, 415);
});

test('management body accepts only a bounded empty JSON object', async () => {
  await readEmptyJsonBody(Readable.from(['{}']));
  await assert.rejects(readEmptyJsonBody(Readable.from(['{"action":"login"}'])), { code: 'unexpected_body' });
  await assert.rejects(readEmptyJsonBody(Readable.from(['x'.repeat(MAX_MANAGEMENT_BODY_BYTES + 1)])), { code: 'body_too_large' });
  await assert.rejects(readEmptyJsonBody(Readable.from(['not-json'])), { code: 'invalid_json' });
});

