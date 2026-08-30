import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifySnapshotStructure } from './catalog-snapshot.mjs';

const DSH_INSTALL_ROOT = process.env.DSH_INSTALL_ROOT
  ? resolve(process.env.DSH_INSTALL_ROOT)
  : null;
export const OFFICIAL_XAI_PROVIDER_BASE = Object.freeze({
  displayName: 'xAI Official API',
  apiKeyEnv: 'XAI_API_KEY',
  api: 'openai-responses',
  baseURL: 'https://api.x.ai/v1',
  cacheRetention: 'short',
  retryPolicy: { mode: 'normal', maxRetries: 0 },
});

function digest(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function assertExpectedHash(value) {
  if (typeof value !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(value)) {
    throw new Error('snapshot expected SHA-256 is required');
  }
  return value.toUpperCase();
}

export function readVerifiedSnapshot(path, expectedSha256) {
  const resolved = resolve(path);
  const info = lstatSync(resolved);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('snapshot must be an ordinary non-link file');
  }
  const bytes = readFileSync(resolved);
  const expected = assertExpectedHash(expectedSha256);
  const actual = digest(bytes);
  if (actual !== expected) throw new Error(`snapshot SHA-256 drift: expected ${expected}; actual ${actual}`);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  verifySnapshotStructure(snapshot, { requireVerified: true });
  return snapshot;
}

export function profileFromSnapshot(snapshot) {
  verifySnapshotStructure(snapshot, { requireVerified: true });
  return Object.freeze({
    ...structuredClone(OFFICIAL_XAI_PROVIDER_BASE),
    models: snapshot.modelProfiles.map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      input: [...model.input],
      reasoningEfforts: { ...model.reasoningEfforts },
      compat: { ...model.compat },
    })),
  });
}

function json(value) {
  return JSON.stringify(value);
}

export function buildCandidate(source, snapshot) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('settings root must be a mapping');
  }
  const profile = profileFromSnapshot(snapshot);
  const candidate = structuredClone(source);
  candidate['llm-pi-ai'] ??= {};
  candidate['llm-pi-ai'].providers ??= {};
  candidate['llm-pi-ai'].providers.xai = structuredClone(profile);
  verifyCandidate(source, candidate, snapshot);
  return candidate;
}

export function verifyCandidate(baseline, candidate, snapshot) {
  const profile = profileFromSnapshot(snapshot);
  const actual = candidate?.['llm-pi-ai']?.providers?.xai;
  if (json(actual) !== json(profile)) {
    throw new Error('candidate xai profile is not the verified snapshot-derived profile');
  }
  if (json(candidate['agent-default-model']) !== json(baseline['agent-default-model'])) {
    throw new Error('agent-default-model changed');
  }

  const baselineWithoutXai = structuredClone(baseline);
  const candidateWithoutXai = structuredClone(candidate);
  if (baselineWithoutXai?.['llm-pi-ai']?.providers) {
    delete baselineWithoutXai['llm-pi-ai'].providers.xai;
  }
  if (candidateWithoutXai?.['llm-pi-ai']?.providers) {
    delete candidateWithoutXai['llm-pi-ai'].providers.xai;
  }
  if (json(candidateWithoutXai) !== json(baselineWithoutXai)) {
    throw new Error('candidate changes settings outside llm-pi-ai.providers.xai');
  }
  return true;
}

async function yamlApi() {
  if (DSH_INSTALL_ROOT === null) {
    throw new Error('DSH_INSTALL_ROOT is required for YAML serialization commands');
  }
  const pnpmRoot = join(DSH_INSTALL_ROOT, 'node_modules', '.pnpm');
  const candidates = readdirSync(pnpmRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('yaml@'))
    .map((entry) => join(pnpmRoot, entry.name, 'node_modules', 'yaml', 'dist', 'index.js'))
    .filter((entry) => existsSync(entry));
  if (candidates.length !== 1) throw new Error(`expected one installed yaml package, found ${candidates.length}`);
  return import(pathToFileURL(candidates[0]).href);
}

export async function readSettings(path) {
  const { parse } = await yamlApi();
  return parse(readFileSync(path, 'utf8'));
}

export async function serializeCandidate(source, snapshot) {
  const { stringify } = await yamlApi();
  return stringify(buildCandidate(source, snapshot), { lineWidth: 0 });
}

export async function serializeProfileCandidate(snapshot) {
  const { stringify } = await yamlApi();
  return stringify(
    { 'llm-pi-ai': { providers: { xai: profileFromSnapshot(snapshot) } } },
    { lineWidth: 0 },
  );
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const command = process.argv[2];
  const snapshotPath = option('--snapshot');
  const snapshotSha256 = option('--snapshot-sha256');
  if (!snapshotPath || !snapshotSha256) {
    throw new Error('verified --snapshot and --snapshot-sha256 are required');
  }
  const snapshot = readVerifiedSnapshot(snapshotPath, snapshotSha256);
  if (command === 'profile') {
    const outputPath = option('--output');
    if (!outputPath) throw new Error('profile requires --output');
    const resolvedOutput = resolve(outputPath);
    if (DSH_INSTALL_ROOT !== null && resolvedOutput.toLowerCase().startsWith(DSH_INSTALL_ROOT.toLowerCase())) {
      throw new Error('profile generation must not write into production');
    }
    writeFileSync(resolvedOutput, await serializeProfileCandidate(snapshot), { encoding: 'utf8', flag: 'wx' });
    console.log(`prepared verified snapshot-derived profile: ${resolvedOutput}`);
    return;
  }
  const baselinePath = option('--source') || option('--baseline');
  if (!baselinePath) throw new Error('provide --source/--baseline');
  const baseline = await readSettings(baselinePath);

  if (command === 'prepare') {
    const outputPath = option('--output');
    if (!outputPath) throw new Error('prepare requires --output');
    if (resolve(outputPath) === resolve(baselinePath)) throw new Error('refusing in-place settings mutation');
    if (resolve(dirname(outputPath)) === resolve(dirname(baselinePath))) {
      throw new Error('candidate output must be outside the production settings directory');
    }
    writeFileSync(outputPath, await serializeCandidate(baseline, snapshot), { encoding: 'utf8', flag: 'wx' });
    console.log(`prepared candidate: ${resolve(outputPath)}`);
    return;
  }

  if (command === 'verify') {
    const candidatePath = option('--candidate');
    if (!candidatePath) throw new Error('verify requires --candidate');
    verifyCandidate(baseline, await readSettings(candidatePath), snapshot);
    console.log('PASS settings candidate changes only llm-pi-ai.providers.xai');
    return;
  }
  throw new Error('usage: settings-candidate.mjs prepare|verify|profile ...');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
