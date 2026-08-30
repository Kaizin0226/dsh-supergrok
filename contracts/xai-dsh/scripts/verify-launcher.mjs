import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function launcherClearsXaiApiKey(text) {
  return /^\s*set\s+["']?XAI_API_KEY\s*=\s*["']?\s*$/im.test(text);
}

export function verifyLauncher(path) {
  const text = readFileSync(path, 'utf8');
  if (launcherClearsXaiApiKey(text)) {
    throw new Error(`${resolve(path)} clears XAI_API_KEY; official xAI dispatch would be disabled`);
  }
  return true;
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: verify-launcher.mjs <Start-DeepSeek-Harness.cmd>');
    process.exitCode = 2;
  } else {
    try {
      verifyLauncher(path);
      console.log('PASS launcher inherits XAI_API_KEY without printing it');
    } catch (error) {
      console.error(`FAIL ${error.message}`);
      process.exitCode = 1;
    }
  }
}
