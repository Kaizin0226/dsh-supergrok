import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalRuntimeTreeHash } from '../scripts/canonical-tree-hash.mjs';
import { sourceTreeHash } from '../scripts/source-tree-hash.mjs';
import {
  ALLOWED_ORIGINS,
  CATALOG_SYNC_SECONDS,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  PERMISSION_MODE,
  PLUGIN_VERSION,
  PROTOCOL_PROVENANCE,
  PROVIDER,
  PROXY_URL,
} from '../lib/constants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('hardening manifest matches runtime constants and canonical file set', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'supergrok-hardening.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.provider, PROVIDER);
  assert.equal(manifest.defaultModel, DEFAULT_MODEL);
  assert.equal(manifest.defaultReasoningEffort, DEFAULT_REASONING_EFFORT);
  assert.equal(manifest.permission, PERMISSION_MODE);
  assert.equal(manifest.pluginVersion, PLUGIN_VERSION);
  assert.deepEqual(manifest.settingsUi, {
    providerGroup: PROVIDER,
    catalogRpc: 'llm.models',
    liveCatalogReadOnly: true,
    editableFields: ['modelsRefreshSeconds'],
    otherProviderFailuresExcluded: true,
    polling: false,
  });
  assert.deepEqual(manifest.allowedOrigins, ALLOWED_ORIGINS);
  assert.equal(manifest.proxyUrl, PROXY_URL);
  assert.equal(manifest.acceptanceEmptyToolCatalogGuard, true);
  assert.equal(manifest.acceptanceOAuthNetworkDisabled, true);
  assert.equal(manifest.acceptanceSingleInferenceLatch, true);
  assert.equal(manifest.protocolProvenance, PROTOCOL_PROVENANCE);
  assert.deepEqual(manifest.dynamicAccountCatalog.paths, ['/v1/models', '/v1/models-v2']);
  assert.deepEqual(manifest.dynamicAccountCatalog.compatibilityFallbackStatuses, [404, 405]);
  assert.equal(manifest.dynamicAccountCatalog.enabled, true);
  assert.equal(manifest.dynamicAccountCatalog.authoritative, true);
  assert.equal(manifest.dynamicAccountCatalog.onDemandTtlDefaultSeconds, 60);
  assert.equal(manifest.dynamicAccountCatalog.onDemandTtlMinSeconds, 10);
  assert.equal(manifest.dynamicAccountCatalog.onDemandTtlMaxSeconds, 86400);
  assert.equal(manifest.dynamicAccountCatalog.backgroundSyncSeconds, CATALOG_SYNC_SECONDS);
  assert.equal(manifest.dynamicAccountCatalog.overlapAllowed, false);
  assert.equal(manifest.dynamicAccountCatalog.serveStaleOnRefreshFailure, false);
  assert.equal(manifest.dynamicAccountCatalog.revalidateBeforeInference, true);
  assert.equal(manifest.dynamicAccountCatalog.forceFreshCatalogBeforeInference, true);
  assert.equal(manifest.dynamicAccountCatalog.requireHeaderBodyModelMatch, true);
  assert.equal(manifest.dynamicAccountCatalog.rejectConflictingAliases, true);
  assert.equal(manifest.dynamicAccountCatalog.reasoningEffortDefaultFlagPolicy, 'unique-and-consistent');
  assert.equal(manifest.dynamicAccountCatalog.selectorEffortMapsToCanonicalWireValue, true);
  assert.equal(manifest.dynamicAccountCatalog.catalogDiagnosticValuesExcluded, true);
  assert.equal(manifest.dynamicAccountCatalog.abortInFlightRefreshOnDispose, true);
  assert.equal(manifest.dynamicAccountCatalog.generationIsolatedOnDispose, true);
  assert.deepEqual(manifest.dynamicAccountCatalog.allowedBackends, ['chat', 'chat_completions', 'responses']);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.hostPeerVersions, pkg.peerDependencies);
  assert.deepEqual(manifest.hostPeerVersions, pkg.devDependencies);
  assert.equal(manifest.model, undefined);
  assert.equal(manifest.reasoningEffort, undefined);
  assert.equal(manifest.version, undefined);
  const first = await canonicalRuntimeTreeHash(root);
  const second = await canonicalRuntimeTreeHash(root);
  assert.equal(first.hash, second.hash);
  assert.match(first.hash, /^[A-F0-9]{64}$/);
  assert.deepEqual(first.files.slice(0), first.files.slice(0).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
  for (const required of ['package.json', 'npm-shrinkwrap.json', 'cordis.patch.yml', 'supergrok-hardening.json', 'lib/constants.js']) {
    assert.ok(first.files.includes(required));
  }
  assert.equal(first.files.includes('package-lock.json'), false);
  assert.ok(pkg.files.includes('npm-shrinkwrap.json'));
});

test('source tree hash is deterministic and excludes caches, git data, modules, and tarballs', async () => {
  const first = await sourceTreeHash(root);
  const second = await sourceTreeHash(root);
  assert.equal(first.hash, second.hash);
  assert.match(first.hash, /^[A-F0-9]{64}$/);
  assert.ok(first.files.includes('test/oauth.test.mjs'));
  assert.ok(first.files.includes('scripts/source-tree-hash.mjs'));
  assert.ok(first.files.every((file) => !file.startsWith('.git/')));
  assert.ok(first.files.every((file) => !file.startsWith('.npm-cache/')));
  assert.ok(first.files.every((file) => !file.startsWith('node_modules/')));
  assert.ok(first.files.every((file) => !file.endsWith('.tgz')));
});

test('canonical verifier rejects missing files and symbolic links', async (t) => {
  const fixture = await mkdtemp(join(root, 'test', '.canonical-'));
  t.after(async () => rm(fixture, { recursive: true, force: true }));
  await mkdir(join(fixture, 'lib'));
  for (const name of ['package.json', 'npm-shrinkwrap.json', 'cordis.patch.yml', 'supergrok-hardening.json']) {
    await cp(join(root, name), join(fixture, name));
  }
  await writeFile(join(fixture, 'lib', 'runtime.js'), 'export const ok = true;\n');
  await canonicalRuntimeTreeHash(fixture);
  await unlink(join(fixture, 'package.json'));
  await assert.rejects(canonicalRuntimeTreeHash(fixture));
  await cp(join(root, 'package.json'), join(fixture, 'package.json'));
  try {
    await symlink(join(fixture, 'lib', 'runtime.js'), join(fixture, 'lib', 'linked.js'));
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Windows symlink privilege unavailable');
      return;
    }
    throw error;
  }
  await assert.rejects(canonicalRuntimeTreeHash(fixture), /symbolic link rejected/);
});
