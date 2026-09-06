import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const runtimeRoot = process.env.DSH_TEST_RUNTIME_ROOT;
if (!runtimeRoot || !path.isAbsolute(runtimeRoot)) {
  throw new Error('DSH_TEST_RUNTIME_ROOT must explicitly identify an isolated installed rc.1 runtime');
}
if (path.resolve(runtimeRoot).toLowerCase().includes(`${path.sep}apps${path.sep}deepseekharness`)) {
  throw new Error('Tests must not use the production runtime');
}

const rootPackage = path.join(runtimeRoot, 'package.json');
const rootRequire = createRequire(rootPackage);
const dshPackage = rootRequire.resolve('@deepseek-ai/dsh/package.json');
const dshRequire = createRequire(dshPackage);

export function resolveDshPackage(name) {
  return dshRequire.resolve(`${name}/package.json`);
}

export async function importDsh(name) {
  return import(pathToFileURL(dshRequire.resolve(name)).href);
}

export async function importDshPackageJson(name) {
  const requireFromPackage = createRequire(resolveDshPackage(name));
  return requireFromPackage('./package.json');
}
