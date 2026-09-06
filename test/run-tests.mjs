import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.XAI_API_KEY = '';
for (const key of Object.keys(process.env)) {
  if (/API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|AUTHORIZATION/i.test(key)) delete process.env[key];
}
process.env.XAI_API_KEY = '';
const childEnvironment = { ...process.env };
childEnvironment.XAI_API_KEY = '';
console.log(`XAI_API_KEY explicit-empty=${process.env.XAI_API_KEY === '' && childEnvironment.XAI_API_KEY === ''}`);

const testDirectory = dirname(fileURLToPath(import.meta.url));
const files = process.argv[2] === 'smoke'
  ? [join(testDirectory, 'smoke.test.mjs')]
  : [
      join(testDirectory, 'adapter.test.mjs'),
      join(testDirectory, 'canonical.test.mjs'),
      join(testDirectory, 'client-ui.test.mjs'),
      join(testDirectory, 'rc1-lifecycle.test.mjs'),
      join(testDirectory, 'rc1-client-apply.test.mjs'),
      join(testDirectory, 'images.test.mjs'),
      join(testDirectory, 'local-security.test.mjs'),
      join(testDirectory, 'live-canary.test.mjs'),
      join(testDirectory, 'net.test.mjs'),
      join(testDirectory, 'proxy-config.test.mjs'),
      join(testDirectory, 'oauth.test.mjs'),
      join(testDirectory, 'protocol.test.mjs'),
      join(testDirectory, 'smoke.test.mjs'),
      join(testDirectory, 'static-security.test.mjs'),
      join(testDirectory, 'wire.test.mjs'),
      join(testDirectory, 'usage.test.mjs'),
    ];
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  cwd: join(testDirectory, '..'),
  env: childEnvironment,
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
