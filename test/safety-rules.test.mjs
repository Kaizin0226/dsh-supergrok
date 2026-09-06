import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { scanText, imageMetadata } from '../scripts/safety-rules.mjs';

const privatePath = ['Z:', 'Users', 'synthetic', 'credential.json'].join('/');
test('path scanning covers both Windows separators, POSIX profiles and commit text', () => {
  for (const value of [privatePath, privatePath.replaceAll('/', '\\'), '/' + ['home', 'synthetic', 'data'].join('/')]) assert.ok(scanText('message ' + value).length);
  assert.deepEqual(scanText('https://example.invalid/docs file:vendor/package.tgz <DATA_ROOT>'), []);
});
function pngChunk(type, data) {
  const chunk = Buffer.alloc(data.length + 12); chunk.writeUInt32BE(data.length); chunk.write(type, 4); data.copy(chunk, 8); return chunk;
}
test('PNG text and compressed text metadata are inspected', () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const chunk of [pngChunk('tEXt', Buffer.from(privatePath)), pngChunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), deflateSync(privatePath)]))]) {
    assert.ok(imageMetadata(Buffer.concat([signature, chunk]), '.png').length);
  }
});
test('JPEG metadata and EXIF GPS pointer are inspected', () => {
  const exif = Buffer.alloc(26); exif.write('II'); exif.writeUInt16LE(42, 2); exif.writeUInt32LE(8, 4); exif.writeUInt16LE(1, 8); exif.writeUInt16LE(0x8825, 10);
  const segment = Buffer.alloc(exif.length + 6); segment[0] = 255; segment[1] = 216; segment[2] = 255; segment[3] = 225; segment.writeUInt16BE(exif.length + 2, 4); exif.copy(segment, 6);
  assert.ok(imageMetadata(segment, '.jpg').includes('identifying image metadata'));
});
test('malformed image metadata fails closed', () => {
  const bytes = Buffer.alloc(20); bytes.writeUInt32BE(5000, 8);
  assert.throws(() => imageMetadata(bytes, '.png'), /Malformed PNG/);
});
