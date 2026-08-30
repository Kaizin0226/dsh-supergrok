import { execFileSync } from 'node:child_process';
import { basename, extname } from 'node:path';

const forbiddenBasenames = new Set([
  '.env',
  'auth.json',
  'bridge.config.json',
  'manifest.json',
  'settings.yaml',
  'settings.yml',
]);
const forbiddenExtensions = new Set([
  '.db', '.dmp', '.dpapi', '.dump', '.key', '.log', '.p12', '.pem', '.pfx',
  '.har', '.pcap', '.sqlite', '.sqlite3', '.tgz', '.zip',
]);
const secretRules = [
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Bearer credential', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { name: 'provider-shaped API key', pattern: /\b(?:xai-|sk-)[A-Za-z0-9]{20,}/g },
  { name: 'GitHub token', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}/g },
  { name: 'OAuth token field with literal value', pattern: /["'](?:access_token|refresh_token)["']\s*:\s*["'](?!(?:access_token|refresh_token)["'])[^"']{16,}["']/gi },
];

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, windowsHide: true });
}

try {
  git(['rev-parse', '--git-dir']);
} catch {
  console.log('Git history safety scan skipped: repository has not been initialized.');
  process.exit(0);
}

const objects = git(['rev-list', '--objects', '--all'])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const separator = line.indexOf(' ');
    return separator < 0
      ? { object: line, path: '' }
      : { object: line.slice(0, separator), path: line.slice(separator + 1) };
  });

const findings = [];
const scanned = new Set();
for (const item of objects) {
  if (!item.path) continue;
  const name = basename(item.path).toLowerCase();
  if (forbiddenBasenames.has(name) || forbiddenExtensions.has(extname(name))) {
    findings.push(`${item.object} ${item.path}: forbidden private/runtime artifact`);
  }
  if (scanned.has(item.object)) continue;
  scanned.add(item.object);
  const type = git(['cat-file', '-t', item.object]).trim();
  if (type !== 'blob') continue;
  const size = Number(git(['cat-file', '-s', item.object]).trim());
  if (!Number.isSafeInteger(size) || size > 2 * 1024 * 1024) continue;
  const bytes = git(['cat-file', 'blob', item.object], null);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const rule of secretRules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) findings.push(`${item.object} ${item.path}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  console.error('Git history safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Git history safety scan passed (${scanned.size} unique blobs checked).`);
