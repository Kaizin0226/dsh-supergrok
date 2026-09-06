import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IMAGE_MAX_ENCODED_BYTES,
  IMAGE_MAX_PIXELS,
  IMAGE_MAX_SIDE,
} from '../lib/constants.js';
import { prepareRequestImages, requestImageDataUrl, requestImageNotices } from '../lib/images.js';

function imageRef(attachmentId, width = 64, height = 64) {
  return { attachmentId, mediaType: 'image/png', bytes: 3, width, height };
}

function requestVersion(ref, overrides = {}) {
  return {
    attachment: ref,
    data: Uint8Array.from([1, 2, 3]),
    mediaType: 'image/png',
    bytes: 3,
    width: ref.width,
    height: ref.height,
    depth: 'uchar',
    space: 'srgb',
    hasAlpha: false,
    ...overrides,
  };
}

test('unchanged images produce no compression claim; same-size re-encoding records preparation only', async () => {
  const ref = imageRef('sha256-test');
  const messages = [{ role: 'user', content: [{ type: 'image', attachment: ref }] }];
  const unchanged = await prepareRequestImages(messages, { readImageRequest: async () => requestVersion(ref) });
  assert.deepEqual(requestImageNotices(unchanged), []);
  const encoded = await prepareRequestImages(messages, { readImageRequest: async () => requestVersion(ref, { mediaType: 'image/jpeg' }) });
  assert.match(requestImageNotices(encoded)[0].text, /缩放=false，重新编码=true/);
});

test('durable images are projected once in first-appearance order with fixed Grok limits', async () => {
  const wide = imageRef('sha256-wide', 4000, 1000);
  const square = imageRef('sha256-square', 1000, 1000);
  const calls = [];
  const signal = new AbortController().signal;
  const attachments = {
    async readImageRequest(ref, policy, seenSignal) {
      calls.push({ ref, policy, signal: seenSignal });
      return ref === wide
        ? requestVersion(ref, { width: 2000, height: 500 })
        : requestVersion(ref);
    },
  };
  const prepared = await prepareRequestImages([
    { role: 'user', content: [{ type: 'image', attachment: wide }] },
    { role: 'user', content: [{
      type: 'tool-result', toolCallId: 'call-1', content: [
        { type: 'image', attachment: square },
        { type: 'image', attachment: wide },
      ],
    }] },
  ], attachments, signal);

  assert.deepEqual(calls.map((call) => call.ref.attachmentId), ['sha256-wide', 'sha256-square']);
  assert.deepEqual(calls[0].policy, { maxPixels: 1_000_000, maxBytes: IMAGE_MAX_ENCODED_BYTES });
  assert.deepEqual(calls[1].policy, { maxPixels: 1_000_000, maxBytes: IMAGE_MAX_ENCODED_BYTES });
  assert.ok(calls.every((call) => call.signal === signal));
  assert.equal(requestImageDataUrl(prepared, wide), 'data:image/png;base64,AQID');
  assert.equal(requestImageDataUrl(prepared, square), 'data:image/png;base64,AQID');
});

test('projection postconditions reject unsupported media, oversized output and identity drift', async () => {
  const ref = imageRef('sha256-one');
  const invalid = [
    requestVersion(ref, { mediaType: 'image/bmp' }),
    requestVersion(ref, { depth: 'ushort' }),
    requestVersion(ref, { space: 'cmyk' }),
    requestVersion(ref, { width: 7, height: 100 }),
    requestVersion(ref, { width: 8, height: 8 }),
    requestVersion(ref, { width: IMAGE_MAX_SIDE + 1 }),
    requestVersion(ref, { width: IMAGE_MAX_PIXELS, height: 2 }),
    requestVersion(ref, { bytes: IMAGE_MAX_ENCODED_BYTES + 1 }),
    requestVersion(ref, { attachment: imageRef('sha256-other') }),
  ];
  for (const version of invalid) {
    await assert.rejects(
      prepareRequestImages(
        [{ role: 'user', content: [{ type: 'image', attachment: ref }] }],
        { async readImageRequest() { return version; } },
      ),
      { code: /^(?:INVALID_REQUEST|UNSUPPORTED_CONTENT)$/ },
    );
  }
});

test('PNG, JPEG, WebP and GIF request projections remain valid data URLs', async () => {
  for (const [mediaType, prefix] of [
    ['image/png', 'data:image/png;base64,'],
    ['image/jpeg', 'data:image/jpeg;base64,'],
    ['image/webp', 'data:image/webp;base64,'],
    ['image/gif', 'data:image/gif;base64,'],
  ]) {
    const ref = imageRef(`sha256-${mediaType}`);
    const prepared = await prepareRequestImages(
      [{ role: 'user', content: [{ type: 'image', attachment: ref }] }],
      { async readImageRequest() { return requestVersion(ref, { mediaType }); } },
    );
    assert.equal(requestImageDataUrl(prepared, ref).startsWith(prefix), true);
  }
});

test('illegal image roles and cancellation fail before attachment reads', async () => {
  const ref = imageRef('sha256-one');
  let reads = 0;
  const attachments = { async readImageRequest() { reads += 1; return requestVersion(ref); } };
  await assert.rejects(
    prepareRequestImages([{ role: 'assistant', content: [{ type: 'image', attachment: ref }] }], attachments),
    { code: 'UNSUPPORTED_CONTENT' },
  );
  const controller = new AbortController();
  controller.abort(new Error('stop'));
  await assert.rejects(
    prepareRequestImages([{ role: 'user', content: [{ type: 'image', attachment: ref }] }], attachments, controller.signal),
    { code: 'ABORTED' },
  );
  assert.equal(reads, 0);
});

test('attachment failures expose neither local paths nor image data', async () => {
  const ref = imageRef('sha256-one');
  let caught;
  try {
    await prepareRequestImages(
      [{ role: 'user', content: [{ type: 'image', attachment: ref }] }],
      { async readImageRequest() { throw new Error('fixture\\private\\image.png data:image/png;base64,SECRET'); } },
    );
  } catch (error) {
    caught = error;
  }
  assert.equal(caught?.code, 'INVALID_REQUEST');
  assert.equal(caught?.cause, undefined);
  assert.doesNotMatch(String(caught), /private|data:image|SECRET/);
});
