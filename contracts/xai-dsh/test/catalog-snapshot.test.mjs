import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildVerifiedSnapshot,
  OFFICIAL_LANGUAGE_MODELS_ENDPOINT,
  verifySnapshotStructure,
} from '../scripts/catalog-snapshot.mjs';
import {
  profileFromSnapshot,
} from '../scripts/settings-candidate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pendingSnapshot = JSON.parse(
  readFileSync(resolve(here, '..', 'catalog', 'official-xai-language-models.snapshot.json'), 'utf8'),
);
const policy = {
  schemaVersion: 1,
  provider: 'xai',
  models: [{
    id: 'grok-fixture-a',
    name: 'Synthetic Grok fixture A',
    contextWindow: 262144,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
    compat: { supportsLongCacheRetention: false },
    capabilityEvidence: { kind: 'synthetic-zero-network-test' },
  }],
};

function captureBytes() {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      endpoint: OFFICIAL_LANGUAGE_MODELS_ENDPOINT,
      capturedAt: '2026-08-30T00:00:00.000Z',
      requestCount: 1,
      response: {
        object: 'list',
        models: [
          {
            id: 'grok-fixture-a',
            object: 'model',
            owned_by: 'xai',
            fingerprint: 'fp_fixture',
            input_modalities: ['text', 'image'],
            output_modalities: ['text'],
            aliases: ['latest-alias-must-not-be-trusted'],
          },
          {
            id: 'image-only-fixture',
            object: 'model',
            owned_by: 'xai',
            output_modalities: ['image'],
          },
          {
            id: 'foreign-text-fixture',
            object: 'model',
            owned_by: 'other',
            output_modalities: ['text'],
          },
        ],
      },
    }),
  );
}

test('snapshot promotion trusts only canonical official xAI text language model IDs', () => {
  const snapshot = buildVerifiedSnapshot({
    captureBytes: captureBytes(),
    policy,
    snapshotVersion: 'fixture-v1',
    verifiedAt: '2026-08-30T00:01:00.000Z',
  });
  assert.equal(verifySnapshotStructure(snapshot, { requireVerified: true }), true);
  assert.deepEqual(snapshot.allowedModels, ['grok-fixture-a']);
  assert.equal(snapshot.allowedModels.includes('latest-alias-must-not-be-trusted'), false);
  assert.deepEqual(snapshot.directoryCanonicalModels.map((model) => model.id), ['grok-fixture-a']);
  assert.equal(snapshot.source.requestCount, 1);
});

test('pending snapshot drives only the profile fixture and cannot pass production promotion', () => {
  assert.equal(verifySnapshotStructure(pendingSnapshot), true);
  assert.throws(
    () => verifySnapshotStructure(pendingSnapshot, { requireVerified: true }),
    /has not passed Canary promotion/,
  );
  assert.equal(pendingSnapshot.allowedModels.length, 0);
  assert.equal(pendingSnapshot.modelProfiles.length, 0);
  assert.throws(() => profileFromSnapshot(pendingSnapshot), /has not passed Canary promotion/);
});

test('snapshot promotion fails closed when policy IDs are absent from the official directory capture', () => {
  const missing = structuredClone(policy);
  missing.models[0].id = 'not-in-directory';
  assert.throws(
    () => buildVerifiedSnapshot({
      captureBytes: captureBytes(),
      policy: missing,
      snapshotVersion: 'fixture-v1',
      verifiedAt: '2026-08-30T00:01:00.000Z',
    }),
    /absent from the captured official directory/,
  );
});

test('snapshot promotion rejects the /v1/models data shape and accepts only language-models.models', () => {
  const wrongShape = JSON.parse(captureBytes().toString('utf8'));
  wrongShape.response.data = wrongShape.response.models;
  delete wrongShape.response.models;
  assert.throws(
    () => buildVerifiedSnapshot({
      captureBytes: Buffer.from(JSON.stringify(wrongShape)),
      policy,
      snapshotVersion: 'fixture-v1',
      verifiedAt: '2026-08-30T00:01:00.000Z',
    }),
    /single official xAI language-model directory response/,
  );
});

test('directory candidates without a non-empty fingerprint never enter the trust snapshot', () => {
  const capture = JSON.parse(captureBytes().toString('utf8'));
  delete capture.response.models[0].fingerprint;
  assert.throws(
    () => buildVerifiedSnapshot({
      captureBytes: Buffer.from(JSON.stringify(capture)),
      policy,
      snapshotVersion: 'fixture-v1',
      verifiedAt: '2026-08-30T00:01:00.000Z',
    }),
    /no canonical xAI text-output language models/,
  );
});
