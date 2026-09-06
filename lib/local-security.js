import { randomBytes, timingSafeEqual } from 'node:crypto';

export const MAX_MANAGEMENT_BODY_BYTES = 1024;

export function createCsrfNonce() {
  return randomBytes(32).toString('base64url');
}

function header(req, name) {
  const value = req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value.join(',') : value;
}

export function parseLoopbackHost(value) {
  if (typeof value !== 'string' || value.length > 128 || /[\s,@\\/]/.test(value)) return undefined;
  const match = value.match(/^(127\.0\.0\.1|localhost|\[::1\]):([1-9][0-9]{0,4})$/i);
  if (match === null) return undefined;
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port > 65535) return undefined;
  return { authority: value.toLowerCase(), port };
}

export function isLoopbackSocket(req) {
  const address = req?.socket?.remoteAddress;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function validateBrowserRequest(req, { mutation = false, csrfNonce } = {}) {
  if (!isLoopbackSocket(req)) return { ok: false, status: 403, code: 'loopback_required' };
  const host = parseLoopbackHost(header(req, 'host'));
  if (host === undefined) return { ok: false, status: 403, code: 'invalid_host' };
  if (header(req, 'sec-fetch-site') !== 'same-origin'
    || header(req, 'sec-fetch-mode') !== 'cors'
    || header(req, 'sec-fetch-dest') !== 'empty') {
    return { ok: false, status: 403, code: 'browser_context_required' };
  }
  if (!mutation) return { ok: true, host };
  if (header(req, 'origin') !== `http://${host.authority}`) {
    return { ok: false, status: 403, code: 'origin_mismatch' };
  }
  const type = header(req, 'content-type')?.split(';', 1)[0]?.trim()?.toLowerCase();
  if (type !== 'application/json') return { ok: false, status: 415, code: 'json_required' };
  const supplied = header(req, 'x-dsh-grok-csrf');
  if (typeof supplied !== 'string' || typeof csrfNonce !== 'string') {
    return { ok: false, status: 403, code: 'csrf_required' };
  }
  const left = Buffer.from(supplied);
  const right = Buffer.from(csrfNonce);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, status: 403, code: 'csrf_mismatch' };
  }
  const declared = header(req, 'content-length');
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_MANAGEMENT_BODY_BYTES)) {
    return { ok: false, status: 413, code: 'body_too_large' };
  }
  return { ok: true, host };
}

export async function readEmptyJsonBody(req, maxBytes = MAX_MANAGEMENT_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      const error = new Error('management request body exceeds limit');
      error.code = 'body_too_large';
      throw error;
    }
    chunks.push(bytes);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('management request body must be JSON');
    error.code = 'invalid_json';
    throw error;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
    const error = new Error('management request body must be an empty object');
    error.code = 'unexpected_body';
    throw error;
  }
  return body;
}



