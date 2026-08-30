import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

delete process.env.XAI_API_KEY;
const childEnvironment = { ...process.env };
delete childEnvironment.XAI_API_KEY;
console.log(`XAI_API_KEY absent=${process.env.XAI_API_KEY === undefined && childEnvironment.XAI_API_KEY === undefined}`);

const testDirectory = dirname(fileURLToPath(import.meta.url));
const files = process.argv[2] === 'smoke'
  ? [join(testDirectory, 'smoke.test.mjs')]
  : [
      join(testDirectory, 'adapter.test.mjs'),
      join(testDirectory, 'canonical.test.mjs'),
      join(testDirectory, 'client-ui.test.mjs'),
      join(testDirectory, 'local-security.test.mjs'),
      join(testDirectory, 'net.test.mjs'),
      join(testDirectory, 'oauth.test.mjs'),
      join(testDirectory, 'protocol.test.mjs'),
      join(testDirectory, 'smoke.test.mjs'),
      join(testDirectory, 'static-security.test.mjs'),
      join(testDirectory, 'wire.test.mjs'),
    ];
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  cwd: join(testDirectory, '..'),
  env: childEnvironment,
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
