import { inflateSync } from 'node:zlib';

export const forbiddenBasenames = new Set(['.env', 'auth.json', 'bridge.config.json', 'manifest.json', 'settings.yaml', 'settings.yml']);
export const forbiddenExtensions = new Set(['.7z', '.db', '.dmp', '.dpapi', '.dump', '.key', '.log', '.p12', '.pem', '.pfx', '.har', '.pcap', '.sqlite', '.sqlite3', '.tgz', '.zip']);
export const textRules = [
  { name: 'Windows absolute path', pattern: /\b[A-Za-z]:[\\/](?![\\/])/g },
  { name: 'user profile path', pattern: /(?:\\|\/)Users(?:\\|\/)[^<>\s"']+/gi },
  { name: 'private POSIX path', pattern: /(?:^|[\s"'`(])\/(?:home|Users|root|mnt|Volumes)\/[^<>\s"'`]+/gm },
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Bearer credential', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { name: 'provider-shaped API key', pattern: /\b(?:xai-|sk-)[A-Za-z0-9]{20,}/g },
  { name: 'GitHub token', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}/g },
  { name: 'OAuth token field with literal value', pattern: /["'](?:access_token|refresh_token)["']\s*:\s*["'](?!(?:access_token|refresh_token)["'])[^"']{16,}["']/gi },
];
export function scanText(content) {
  return textRules.filter(rule => { rule.pattern.lastIndex = 0; return rule.pattern.test(content); }).map(rule => rule.name);
}
function tiffHasGps(bytes) {
  const start = bytes.indexOf(Buffer.from('Exif\0\0'));
  const data = start < 0 ? bytes : bytes.subarray(start + 6);
  if (data.length < 8) return false;
  const little = data.toString('ascii', 0, 2) === 'II';
  if (!little && data.toString('ascii', 0, 2) !== 'MM') return false;
  const u16 = n => little ? data.readUInt16LE(n) : data.readUInt16BE(n);
  const u32 = n => little ? data.readUInt32LE(n) : data.readUInt32BE(n);
  if (u16(2) !== 42) return false;
  const offset = u32(4);
  if (offset + 2 > data.length) return false;
  for (let i = 0; i < u16(offset); i++) {
    const entry = offset + 2 + i * 12;
    if (entry + 12 > data.length) break;
    if (u16(entry) === 0x8825) return true;
  }
  return false;
}
export function imageMetadata(bytes, extension) {
  const chunks = [];
  if (extension === '.png') {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
      if (offset + size + 12 > bytes.length) throw Error('Malformed PNG chunk');
      const data = bytes.subarray(offset + 8, offset + 8 + size);
      if (['tEXt', 'iTXt', 'eXIf'].includes(type)) chunks.push(data);
      if (type === 'iTXt' && data[data.indexOf(0) + 1] === 1) throw Error('Compressed iTXt requires removal or explicit metadata review');
      if (type === 'zTXt') chunks.push(inflateSync(data.subarray(data.indexOf(0) + 2), { maxOutputLength: 2 * 1024 * 1024 }));
      offset += size + 12;
    }
  } else if (['.jpg', '.jpeg'].includes(extension)) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset] !== 255) break;
      const type = bytes[offset + 1];
      if ([0xda, 0xd9].includes(type)) break;
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + size + 2 > bytes.length) throw Error('Malformed JPEG segment');
      if ([0xe1, 0xed, 0xfe].includes(type)) chunks.push(bytes.subarray(offset + 4, offset + size + 2));
      offset += size + 2;
    }
  } else if (extension === '.webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
      if (offset + size + 8 > bytes.length) throw Error('Malformed WebP chunk');
      if (['EXIF', 'XMP '].includes(type)) chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
      offset += size + 8 + (size % 2);
    }
  }
  return chunks.flatMap(data => [...scanText(data.toString('utf8')), ...(tiffHasGps(data) || /GPSLatitude|GPSLongitude|SerialNumber/.test(data.toString('utf8')) ? ['identifying image metadata'] : [])]);
}
export function scanBytes(bytes, extension) {
  const image = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
  if (image) return imageMetadata(bytes, extension).map(finding => 'image metadata: ' + finding);
  if (bytes.includes(0)) return [];
  return scanText(bytes.toString('utf8'));
}
