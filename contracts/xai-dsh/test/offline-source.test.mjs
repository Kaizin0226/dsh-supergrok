import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launcherClearsXaiApiKey } from '../scripts/verify-launcher.mjs';
import { profileFromSnapshot } from '../scripts/settings-candidate.mjs';
import { fixture } from './helpers/fixtures.mjs';
import { syntheticVerifiedSnapshot } from './helpers/catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractRoot = resolve(here, '..');

function visit(value, action) {
  if (Array.isArray(value)) return value.forEach((entry) => visit(entry, action));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      action(key, entry);
      visit(entry, action);
    }
  }
}

test('contract fixtures are synthetic protocol data with no credentials', () => {
  for (const name of [
    'responses-empty.json',
    'responses-first-turn-interleaved.json',
    'responses-refusal.json',
    'responses-second-turn-final.json',
  ]) {
    const events = fixture(name);
    assert.equal(Array.isArray(events), true);
    visit(events, (key) => {
      assert.doesNotMatch(key, /^(?:authorization|access_token|refresh_token|cookie)$/i, `${name}: credential field`);
    });
  }
});

test('interleaved fixture freezes provider tool identity, encrypted reasoning, usage and final text', () => {
  const first = fixture('responses-first-turn-interleaved.json');
  const completed = first.find((event) => event.type === 'response.completed');
  assert.deepEqual(
    completed.response.output.filter((item) => item.type === 'function_call').map((item) => `${item.call_id}|${item.id}`),
    ['call_weather|fc_weather', 'call_clock|fc_clock'],
  );
  assert.match(completed.response.output[0].encrypted_content, /^enc_reasoning_/);
  assert.equal(completed.response.usage.input_tokens_details.cached_tokens, 40);
  assert.equal(completed.response.usage.cost_in_usd_ticks, 123456789);

  const second = fixture('responses-second-turn-final.json');
  assert.equal(second.at(-1).response.status, 'completed');
  assert.equal(second.at(-1).response.output[1].content[0].type, 'output_text');
  assert.equal(fixture('responses-refusal.json').at(-1).response.output[0].content[0].type, 'refusal');
});

test('overlay source contains the reviewed fail-closed xAI Responses invariants', () => {
  const patch = readFileSync(
    join(contractRoot, 'overlay', 'patches', '@earendil-works__pi-ai@0.82.1-xai-contract.patch'),
    'utf8',
  );
  for (const required of [
    'missing provider-issued call_id',
    'duplicate provider call_id',
    'encrypted_content',
    'successful terminal response is missing usage',
    'cache token details exceed input_tokens',
    'cost_in_usd_ticks',
    'terminal xAI tool items do not match completed streamed items',
  ]) assert.match(patch, new RegExp(required.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('verified synthetic directory snapshot alone builds the official xAI profile', () => {
  const profile = profileFromSnapshot(syntheticVerifiedSnapshot());
  assert.equal(profile.apiKeyEnv, 'XAI_API_KEY');
  assert.equal(profile.api, 'openai-responses');
  assert.equal(profile.baseURL, 'https://api.x.ai/v1');
  assert.deepEqual(profile.models.map((model) => model.id), ['grok-fixture-a']);
  assert.equal(profile.retryPolicy.maxRetries, 0);
});

test('launcher guard is a pure offline check and never prints or reads a key', () => {
  assert.equal(launcherClearsXaiApiKey('set "XAI_API_KEY="\r\nstart app'), true);
  assert.equal(launcherClearsXaiApiKey('start app'), false);
});
