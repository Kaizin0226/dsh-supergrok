import { createHash } from 'node:crypto';
import { buildVerifiedSnapshot, OFFICIAL_LANGUAGE_MODELS_ENDPOINT } from '../../scripts/catalog-snapshot.mjs';

export const SYNTHETIC_MODEL_ID = 'grok-fixture-a';

export const SYNTHETIC_POLICY = Object.freeze({
  schemaVersion: 1,
  provider: 'xai',
  models: [{
    id: SYNTHETIC_MODEL_ID,
    name: 'Synthetic Grok fixture A',
    contextWindow: 262144,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
    compat: { supportsLongCacheRetention: false },
    capabilityEvidence: { kind: 'synthetic-zero-network-test' },
  }],
});

export function syntheticCaptureBytes({ models } = {}) {
  return Buffer.from(JSON.stringify({
    schemaVersion: 1,
    endpoint: OFFICIAL_LANGUAGE_MODELS_ENDPOINT,
    capturedAt: '2026-08-30T00:00:00.000Z',
    requestCount: 1,
    response: {
      object: 'list',
      models: models ?? [{
        id: SYNTHETIC_MODEL_ID,
        object: 'model',
        owned_by: 'xai',
        fingerprint: 'fp_synthetic_fixture_a',
        input_modalities: ['text', 'image'],
        output_modalities: ['text'],
        aliases: ['synthetic-alias-must-not-be-trusted'],
      }],
    },
  }));
}

export function syntheticVerifiedSnapshot() {
  return buildVerifiedSnapshot({
    captureBytes: syntheticCaptureBytes(),
    policy: structuredClone(SYNTHETIC_POLICY),
    snapshotVersion: 'synthetic-fixture-v1',
    verifiedAt: '2026-08-30T00:01:00.000Z',
  });
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}
