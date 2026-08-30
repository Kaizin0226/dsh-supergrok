import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDED_DIRECTORIES = new Set(['.git', '.npm-cache', 'node_modules']);

function slash(value) {
  return value.split(sep).join('/');
}

function bytewise(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

async function collect(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    const rel = slash(relative(root, full));
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error(`symbolic link rejected: ${rel}`);
    if (entry.isDirectory()) {
      files.push(...await collect(root, full));
    } else if (entry.isFile() && !entry.name.endsWith('.tgz')) {
      files.push(rel);
    }
  }
  return files;
}

export async function sourceTreeHash(rootDirectory) {
  const root = resolve(rootDirectory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('source root must be a real directory');
  const files = (await collect(root)).sort(bytewise);
  if (files.length === 0) throw new Error('source tree is empty');
  const hash = createHash('sha256');
  for (const rel of files) {
    const full = join(root, ...rel.split('/'));
    const info = await lstat(full);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`non-file source entry rejected: ${rel}`);
    hash.update(Buffer.from(rel, 'utf8'));
    hash.update(Buffer.from([0]));
    hash.update(await readFile(full));
    hash.update(Buffer.from([0]));
  }
  return Object.freeze({ algorithm: 'sha256', hash: hash.digest('hex').toUpperCase(), files });
}

const invoked = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = await sourceTreeHash(root);
  console.log(`sourceTreeSha256=${result.hash}`);
  console.log(`sourceTreeFiles=${result.files.length}`);
  if (process.argv.includes('--list')) {
    result.files.forEach((file, index) => console.log(`sourceTreeFile[${index}]=${file}`));
  }
}
