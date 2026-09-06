import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excludedDirectories = new Set(['.git', '.npm-cache', 'node_modules', 'dist', 'coverage']);
import { forbiddenBasenames, forbiddenExtensions, scanBytes, scanText } from './safety-rules.mjs';

function recursivelyCollect(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) recursivelyCollect(full, output);
    else output.push(full);
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
  if (lstatSync(file).isSymbolicLink()) {
    findings.push(`${rel}: symbolic link; target scan: ${scanText(readlinkSync(file)).join(', ') || 'no text finding'}`);
    continue;
  }
  if (lstatSync(file).size > 2 * 1024 * 1024) {
    findings.push(`${rel}: file exceeds 2 MiB review limit`);
    continue;
  }
  const bytes = readFileSync(file);
  try { for (const finding of scanBytes(bytes, extension)) findings.push(`${rel}: ${finding}`); }
  catch (error) { findings.push(`${rel}: ${error.message}`); }
}

if (findings.length > 0) {
  console.error('Repository safety scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Repository safety scan passed (${files.length} files checked).`);
