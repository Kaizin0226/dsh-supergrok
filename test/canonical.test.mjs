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
  IMAGE_MAX_ENCODED_BYTES,
  IMAGE_MAX_PIXELS,
  IMAGE_MAX_SIDE,
  IMAGE_MIN_PIXELS,
  IMAGE_MIN_SIDE,
  LIVE_CANARY_MAX_INFERENCES_ENV,
  PERMISSION_MODE,
  PLUGIN_VERSION,
  PROTOCOL_PROVENANCE,
  PROVIDER,
} from '../lib/constants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('hardening manifest matches runtime constants and canonical file set', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'supergrok-hardening.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.provider, PROVIDER);
  assert.equal(manifest.defaultModel, undefined);
  assert.equal(manifest.defaultReasoningEffort, undefined);
  assert.equal(manifest.permission, PERMISSION_MODE);
  assert.equal(manifest.pluginVersion, PLUGIN_VERSION);
  assert.deepEqual(manifest.settingsUi, {
    providerGroup: PROVIDER,
    catalogRpc: 'session.modelCatalog',
    liveCatalogReadOnly: true,
    editableFields: ['modelsRefreshSeconds'],
    otherProviderFailuresExcluded: true,
    polling: false,
  });
  assert.deepEqual(manifest.allowedOrigins, ALLOWED_ORIGINS);
  assert.equal(manifest.proxyUrl, undefined);
  assert.deepEqual(manifest.proxyPolicy, { setting: 'proxyUrl', required: true, protocol: 'http:', hosts: ['127.0.0.1', '[::1]'], credentials: false, directFallback: false, environmentDiscovery: false, changeRequiresRestart: true });
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
  assert.equal(manifest.dynamicAccountCatalog.revalidateBeforeTurn, true);
  assert.equal(manifest.dynamicAccountCatalog.turnScopedPreparePreflight, 'force-fresh-on-new-turn');
  assert.equal(manifest.dynamicAccountCatalog.forceFreshCatalogPerInference, false);
  assert.deepEqual(manifest.dynamicAccountCatalog.preparedDispatchContext, {
    fields: ['sessionId', 'turn'],
    turnType: 'positive-safe-integer',
    sameTurnReuse: true,
    crossTurnRefresh: true,
    preparedModelInfoAndStreamSameRevision: true,
    backgroundRefreshCannotReplaceFrozenTurnSnapshot: true,
    generationDriftInsideTurn: 'fail-closed',
    missingContextForTurnScopedDispatch: 'fail-closed',
  });
  assert.equal(manifest.dynamicAccountCatalog.requireHeaderBodyModelMatch, true);
  assert.equal(manifest.dynamicAccountCatalog.catalogRequestCarriesModelOverride, false);
  assert.equal(manifest.dynamicAccountCatalog.rejectConflictingAliases, true);
  assert.equal(manifest.dynamicAccountCatalog.reasoningEffortDefaultFlagPolicy, 'unique-and-consistent');
  assert.equal(manifest.dynamicAccountCatalog.selectorEffortMapsToCanonicalWireValue, true);
  assert.equal(manifest.dynamicAccountCatalog.catalogDiagnosticValuesExcluded, true);
  assert.equal(manifest.dynamicAccountCatalog.abortInFlightRefreshOnDispose, true);
  assert.equal(manifest.dynamicAccountCatalog.generationIsolatedOnDispose, true);
  assert.deepEqual(manifest.dynamicAccountCatalog.allowedBackends, ['chat', 'chat_completions', 'responses']);
  assert.equal(manifest.dynamicAccountCatalog.missingOrUnknownBackendPolicy, 'exclude-entry');
  assert.deepEqual(manifest.dynamicAccountCatalog.catalogRevision, {
    format: 'sha256:<lowercase-hex>',
    canonicalization: 'normalized-public-model-facts-bytewise-id-order-v1',
    credentialsExcluded: true,
    tokensExcluded: true,
    diagnosticsExcluded: true,
    timestampsExcluded: true,
  });
  assert.deepEqual(manifest.selection, {
    source: 'authenticated-live-account-catalog',
    fixedModel: false,
    fixedReasoningEffort: false,
    reasoningEffortDefaultSource: 'same-live-model-entry-only',
    authoritativeModelDefaultAvailable: false,
    catalogOrderSemantics: 'display-only-not-recency',
    modelNameVersionOrdering: false,
    releaseDateOrdering: false,
    ambiguousAutomaticModelSelection: 'fail-closed',
    legacyModelAndReasoningSettingsIgnored: true,
  });
  assert.deepEqual(manifest.multimodalInput, {
    liveCatalogAuthoritative: true,
    explicitCatalogModalitiesTakePriority: true,
    missingModalitiesPolicy: 'grok-build-provider-backend-compatibility-overlay',
    modelNameInference: false,
    compatibilityOverlay: {
      version: 1,
      scope: 'authenticated-grok-oauth-live-entry-with-recognized-backend-and-omitted-modalities',
      inputModalities: ['text', 'image'],
      explicitTextOnlyWins: true,
      modelVersionIndependent: true,
      protocolReference: 'xai-org/grok-build@bc7f02eddd3d84085849dc19ed216f11c23b0571',
    },
    allowedModalities: ['text', 'image'],
    attachmentService: '@deepseek-ai/dsh-attachment',
    requestProjection: 'readImageRequest',
    admissionOwner: 'DSH attachment service',
    limitsKind: 'Grok Build provider-request compatibility',
    allowedRequestMediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxEncodedBytes: IMAGE_MAX_ENCODED_BYTES,
    maxPixels: IMAGE_MAX_PIXELS,
    maxSide: IMAGE_MAX_SIDE,
    minPixels: IMAGE_MIN_PIXELS,
    minSide: IMAGE_MIN_SIDE,
    allowedImageRoles: ['user', 'nested-tool-result'],
    responsesImageType: 'input_image',
    chatImageType: 'image_url',
    responsesToolResultImageEncoding: 'function_call_output.output',
    chatToolResultImageEncoding: 'role-tool-content',
    silentOmission: false,
    inputPreparationOwner: 'DSH host logged plugin notice',
    maxRequestBodyBytes: 40000000,
    requestBudgetKind: 'local conservative serialized UTF-8 budget, not official limit',
  });
  assert.equal(manifest.validatedImageModels, undefined);
  assert.deepEqual(manifest.liveCanary, {
    environment: LIVE_CANARY_MAX_INFERENCES_ENV,
    allowedInferenceBudgets: [1, 2],
    claimsBeforeNetwork: true,
    processWideInferenceBudget: true,
    catalogNetworkRequestBudget: 1,
    catalogV2FallbackDisabled: true,
    catalog401ReplayDisabled: true,
    inference401ReplayDisabled: true,
    backgroundCatalogSyncDisabled: true,
    failedOrExpiredCatalogReuse: false,
    legacyAcceptanceMutuallyExclusive: true,
  });
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.hostPeerVersions, pkg.peerDependencies);
  assert.deepEqual(manifest.hostPeerVersions, {
    ...pkg.devDependencies,
    '@deepseek-ai/dsh-llm': pkg.peerDependencies['@deepseek-ai/dsh-llm'],
  });
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
