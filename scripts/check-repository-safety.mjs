import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excludedDirectories = new Set(['.git', '.npm-cache', 'node_modules', 'dist', 'coverage']);
const forbiddenBasenames = new Set([
  '.env',
  'auth.json',
  'bridge.config.json',
  'manifest.json',
  'settings.yaml',
  'settings.yml',
]);
const forbiddenExtensions = new Set([
  '.7z', '.db', '.dmp', '.dpapi', '.dump', '.key', '.log', '.p12', '.pem', '.pfx',
  '.har', '.pcap', '.sqlite', '.sqlite3', '.tgz', '.zip',
]);
const textRules = [
  { name: 'real Windows absolute path', pattern: /\b[A-Za-z]:\\/g },
  { name: 'user profile path', pattern: /(?:\\|\/)Users(?:\\|\/)[^<>\s"']+/gi },
  { name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Bearer credential', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { name: 'provider-shaped API key', pattern: /\b(?:xai-|sk-)[A-Za-z0-9]{20,}/g },
  { name: 'GitHub token', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}/g },
  { name: 'OAuth token field with literal value', pattern: /["'](?:access_token|refresh_token)["']\s*:\s*["'](?!(?:access_token|refresh_token)["'])[^"']{16,}["']/gi },
];

function recursivelyCollect(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) recursivelyCollect(full, output);
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

function candidateFiles() {
  if (existsSync(resolve(root, '.git'))) {
    const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    return output.split('\0').filter(Boolean).map((file) => resolve(root, file)).filter(existsSync);
  }
  return recursivelyCollect(root);
}

const files = candidateFiles();
const findings = [];
for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const name = basename(file).toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  if (forbiddenBasenames.has(name) || forbiddenExtensions.has(extension)) {
    findings.push(`${rel}: forbidden private/runtime artifact`);
    continue;
  }
  if (statSync(file).size > 2 * 1024 * 1024) {
    findings.push(`${rel}: file exceeds 2 MiB review limit`);
    continue;
  }
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const rule of textRules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) findings.push(`${rel}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  console.error('Repository safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Repository safety scan passed (${files.length} files checked).`);
