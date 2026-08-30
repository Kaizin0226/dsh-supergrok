import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, '..', 'fixtures');

export function fixture(name) {
  return JSON.parse(readFileSync(join(fixtureRoot, name), 'utf8'));
}

export async function* asAsync(events) {
  for (const event of events) yield structuredClone(event);
}

export function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function assistantEnvelope(model) {
  return {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: emptyUsage(),
    stopReason: 'stop',
    timestamp: 0,
  };
}

export async function processFixture(processResponsesStream, model, events) {
  const output = assistantEnvelope(model);
  const translated = [];
  const sink = {
    push(event) {
      translated.push(structuredClone(event));
    },
  };
  await processResponsesStream(asAsync(events), output, sink, model);
  translated.push({ type: 'done', reason: output.stopReason, message: structuredClone(output) });
  return { output, translated };
}
