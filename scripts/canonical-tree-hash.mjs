import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_ROOT_FILES = Object.freeze([
  'package.json',
  'npm-shrinkwrap.json',
  'cordis.patch.yml',
  'supergrok-hardening.json',
]);

function slash(value) {
  return value.split(sep).join('/');
}

function bytewise(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

async function assertNoSymlink(root, relPath) {
  let cursor = root;
  for (const part of relPath.split('/')) {
    cursor = join(cursor, part);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`symbolic link rejected: ${relPath}`);
  }
}

async function collectLibJs(root, directory = join(root, 'lib')) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    const rel = slash(relative(root, full));
    if (entry.isSymbolicLink()) throw new Error(`symbolic link rejected: ${rel}`);
    if (entry.isDirectory()) out.push(...await collectLibJs(root, full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

export async function canonicalRuntimeTreeHash(rootDirectory) {
  const root = resolve(rootDirectory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('plugin root must be a real directory');
  const files = [...REQUIRED_ROOT_FILES, ...await collectLibJs(root)].sort(bytewise);
  if (files.length === REQUIRED_ROOT_FILES.length) throw new Error('no lib/**/*.js runtime files found');
  const hash = createHash('sha256');
  for (const rel of files) {
    await assertNoSymlink(root, rel);
    const info = await lstat(join(root, ...rel.split('/')));
    if (!info.isFile()) throw new Error(`required runtime file missing: ${rel}`);
    const bytes = await readFile(join(root, ...rel.split('/')));
    hash.update(Buffer.from(rel, 'utf8'));
    hash.update(Buffer.from([0]));
    hash.update(bytes);
    hash.update(Buffer.from([0]));
  }
  return Object.freeze({ algorithm: 'sha256', hash: hash.digest('hex').toUpperCase(), files });
}

const invoked = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = await canonicalRuntimeTreeHash(root);
  console.log(`canonicalRuntimeTreeSha256=${result.hash}`);
  console.log(`canonicalRuntimeTreeFiles=${result.files.length}`);
}
