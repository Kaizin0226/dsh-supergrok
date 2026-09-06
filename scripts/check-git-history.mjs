import { execFileSync } from 'node:child_process';
import { basename, extname } from 'node:path';

import { forbiddenBasenames, forbiddenExtensions, scanBytes, scanText } from './safety-rules.mjs';

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
const commits = git(['log', '--all', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x00%x00']).split('\0\0').filter(record => record.trim());
for (const record of commits) {
  const [sha, author, authorEmail, committer, committerEmail, message] = record.trimStart().split('\0');
  for (const finding of scanText(message ?? '')) findings.push(`${sha}: commit message: ${finding}`);
  for (const [name, email] of [[author, authorEmail], [committer, committerEmail]]) {
    if (['Chas', 'Kaizin0226'].includes(name) && email !== '38362307+Kaizin0226@users.noreply.github.com') findings.push(`${sha}: maintainer email is not noreply`);
  }
}
// Git stores link targets as blobs: scan them as text and reject absolute targets.
for (const sha of git(['rev-list', '--all']).trim().split(/\r?\n/)) {
  for (const line of git(['ls-tree', '-r', sha]).split(/\r?\n/)) {
    if (!line.startsWith('120000 ')) continue;
    const object = line.split(/\s+/)[2];
    const target = git(['cat-file', 'blob', object]);
    if (/^(?:[A-Za-z]:|[\\/])/.test(target) || scanText(target).length) findings.push(`${sha}: unsafe historical link target`);
  }
}
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
  try { for (const finding of scanBytes(bytes, extname(name))) findings.push(`${item.object} ${item.path}: ${finding}`); }
  catch (error) { findings.push(`${item.object} ${item.path}: ${error.message}`); }
}

if (findings.length > 0) {
  console.error('Git history safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Git history safety scan passed (${scanned.size} unique blobs checked).`);
