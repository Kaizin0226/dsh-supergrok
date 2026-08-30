import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OFFICIAL_LANGUAGE_MODELS_ENDPOINT = '/v1/language-models';

function digest(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function canonicalDirectoryModels(capture) {
  if (
    capture?.schemaVersion !== 1 ||
    capture?.endpoint !== OFFICIAL_LANGUAGE_MODELS_ENDPOINT ||
    capture?.requestCount !== 1 ||
    typeof capture?.capturedAt !== 'string' ||
    !Array.isArray(capture?.response?.models)
  ) {
    throw new Error('capture is not a single official xAI language-model directory response');
  }
  const seen = new Set();
  const models = [];
  for (const entry of capture.response.models) {
    if (
      entry?.object !== 'model' ||
      entry?.owned_by !== 'xai' ||
      typeof entry?.id !== 'string' ||
      entry.id.trim().length === 0 ||
      typeof entry?.fingerprint !== 'string' ||
      entry.fingerprint.trim().length === 0 ||
      !Array.isArray(entry?.output_modalities) ||
      !entry.output_modalities.includes('text')
    ) {
      continue;
    }
    if (seen.has(entry.id)) throw new Error(`duplicate canonical directory model id ${entry.id}`);
    seen.add(entry.id);
    models.push({
      id: entry.id,
      object: 'model',
      ownedBy: 'xai',
      fingerprint: entry.fingerprint,
      inputModalities: Array.isArray(entry.input_modalities) ? [...entry.input_modalities] : [],
      outputModalities: [...entry.output_modalities],
    });
  }
  models.sort((left, right) => left.id.localeCompare(right.id));
  if (models.length === 0) throw new Error('capture has no canonical xAI text-output language models');
  return models;
}

export function buildVerifiedSnapshot({ captureBytes, policy, snapshotVersion, verifiedAt }) {
  const capture = JSON.parse(captureBytes.toString('utf8'));
  const directoryCanonicalModels = canonicalDirectoryModels(capture);
  if (policy?.schemaVersion !== 1 || policy?.provider !== 'xai' || !Array.isArray(policy?.models)) {
    throw new Error('invalid xAI capability policy');
  }
  if (typeof snapshotVersion !== 'string' || snapshotVersion.trim().length === 0) {
    throw new Error('snapshotVersion is required');
  }
  if (typeof verifiedAt !== 'string' || Number.isNaN(Date.parse(verifiedAt))) {
    throw new Error('verifiedAt must be an ISO timestamp');
  }
  const directoryIds = new Set(directoryCanonicalModels.map((model) => model.id));
  const policyIds = new Set();
  const modelProfiles = policy.models.map((model) => {
    if (typeof model?.id !== 'string' || model.id.trim().length === 0 || policyIds.has(model.id)) {
      throw new Error('policy model ids must be unique non-empty canonical ids');
    }
    policyIds.add(model.id);
    if (!directoryIds.has(model.id)) {
      throw new Error(`policy model ${model.id} is absent from the captured official directory`);
    }
    return structuredClone(model);
  });
  if (modelProfiles.length === 0) throw new Error('verified allowlist cannot be empty');
  const allowedModels = modelProfiles.map((model) => model.id);
  return {
    schemaVersion: 1,
    snapshotVersion,
    promotionStatus: 'verified',
    provider: 'xai',
    endpoint: OFFICIAL_LANGUAGE_MODELS_ENDPOINT,
    asOf: verifiedAt,
    source: {
      kind: 'official-xai-language-models-api',
      requestCount: 1,
      captureSha256: digest(captureBytes),
      capturedAt: capture.capturedAt,
      aliasesExcludedFromAllowlist: true,
    },
    directoryCanonicalModels,
    allowedModels,
    modelProfiles,
  };
}

export function verifySnapshotStructure(snapshot, { requireVerified = false } = {}) {
  if (
    snapshot?.schemaVersion !== 1 ||
    snapshot?.provider !== 'xai' ||
    snapshot?.endpoint !== OFFICIAL_LANGUAGE_MODELS_ENDPOINT ||
    !['pending-canary', 'verified'].includes(snapshot?.promotionStatus) ||
    !Array.isArray(snapshot?.directoryCanonicalModels) ||
    !Array.isArray(snapshot?.allowedModels) ||
    !Array.isArray(snapshot?.modelProfiles)
  ) {
    throw new Error('invalid official xAI language-model trust snapshot');
  }
  const ids = snapshot.allowedModels;
  if (ids.some((id) => typeof id !== 'string' || id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new Error('snapshot allowed model ids must be unique and non-empty');
  }
  if (requireVerified) {
    if (
      snapshot.promotionStatus !== 'verified' ||
      snapshot.source?.kind !== 'official-xai-language-models-api' ||
      snapshot.source?.requestCount !== 1 ||
      typeof snapshot.source?.captureSha256 !== 'string' ||
      !/^[A-F0-9]{64}$/.test(snapshot.source.captureSha256) ||
      snapshot.source?.aliasesExcludedFromAllowlist !== true
    ) {
      throw new Error('official xAI language-model snapshot has not passed Canary promotion');
    }
    const directoryIds = new Set();
    for (const model of snapshot.directoryCanonicalModels) {
      if (
        model?.object !== 'model' ||
        model?.ownedBy !== 'xai' ||
        typeof model?.id !== 'string' ||
        model.id.trim().length === 0 ||
        typeof model?.fingerprint !== 'string' ||
        model.fingerprint.trim().length === 0 ||
        !Array.isArray(model?.outputModalities) ||
        !model.outputModalities.includes('text') ||
        directoryIds.has(model.id)
      ) {
        throw new Error('verified snapshot directory evidence is invalid');
      }
      directoryIds.add(model.id);
    }
    const profileIds = snapshot.modelProfiles.map((model) => model.id);
    if (ids.length === 0 || ids.some((id) => !directoryIds.has(id)) ||
        JSON.stringify(ids) !== JSON.stringify(profileIds)) {
      throw new Error('snapshot allowlist is not a subset of captured canonical directory ids');
    }
    for (const profile of snapshot.modelProfiles) {
      if (
        typeof profile?.id !== 'string' ||
        typeof profile?.name !== 'string' ||
        !Number.isSafeInteger(profile?.contextWindow) || profile.contextWindow <= 0 ||
        !Number.isSafeInteger(profile?.maxTokens) || profile.maxTokens <= 0 ||
        profile.maxTokens > profile.contextWindow ||
        !Array.isArray(profile?.input) || !profile.input.includes('text') ||
        typeof profile?.reasoningEfforts !== 'object' || profile.reasoningEfforts === null ||
        Object.keys(profile.reasoningEfforts).length === 0 ||
        Object.keys(profile.reasoningEfforts).includes('off') ||
        typeof profile?.compat !== 'object' || profile.compat === null
      ) {
        throw new Error('verified snapshot model profile is invalid');
      }
    }
  } else if (snapshot.promotionStatus === 'pending-canary') {
    if (
      snapshot.source?.requestCount !== 0 ||
      snapshot.directoryCanonicalModels.length !== 0 ||
      snapshot.allowedModels.length !== 0 ||
      snapshot.modelProfiles.length !== 0
    ) {
      throw new Error('pending Canary snapshot must not carry trusted model data');
    }
  }
  return true;
}

async function main() {
  const command = process.argv[2];
  if (command === 'prepare') {
    const capturePath = option('--capture');
    const policyPath = option('--policy');
    const outputPath = option('--output');
    const snapshotVersion = option('--snapshot-version');
    const verifiedAt = option('--verified-at');
    if (!capturePath || !policyPath || !outputPath) throw new Error('prepare requires capture, policy and output');
    const snapshot = buildVerifiedSnapshot({
      captureBytes: readFileSync(resolve(capturePath)),
      policy: parseJson(resolve(policyPath)),
      snapshotVersion,
      verifiedAt,
    });
    verifySnapshotStructure(snapshot, { requireVerified: true });
    writeFileSync(resolve(outputPath), `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(`prepared verified snapshot: ${resolve(outputPath)}`);
    return;
  }
  if (command === 'verify') {
    const snapshotPath = option('--snapshot');
    if (!snapshotPath) throw new Error('verify requires --snapshot');
    verifySnapshotStructure(parseJson(resolve(snapshotPath)), {
      requireVerified: process.argv.includes('--require-verified'),
    });
    console.log('PASS official xAI language-model snapshot structure');
    return;
  }
  throw new Error('usage: catalog-snapshot.mjs prepare|verify ...');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
