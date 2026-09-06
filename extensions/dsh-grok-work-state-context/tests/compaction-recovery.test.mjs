import assert from 'node:assert/strict';
import test from 'node:test';

import * as workStatePlugin from '../lib/index.js';
import { CONTEXT_NAME } from '../lib/invariant.js';
import { importDsh } from './helpers/dsh-runtime.mjs';

const MODEL = 'work-state-compaction-mock';
const LONG_HISTORY = 'older conversation history '.repeat(80);

test('real compaction reassembles and re-emits the live work-state context', async () => {
  const [
    cordisModule,
    llmModule,
    sessionModule,
    promptModule,
    toolsModule,
    agentModule,
    loopModule,
    tokenMeterModule,
    projectionModule,
    jobsModule,
    compactionModule,
  ] = await Promise.all([
    importDsh('@deepseek-ai/cordis'),
    importDsh('@deepseek-ai/dsh-llm'),
    importDsh('@deepseek-ai/dsh-session'),
    importDsh('@deepseek-ai/dsh-system-prompt'),
    importDsh('@deepseek-ai/dsh-tools'),
    importDsh('@deepseek-ai/dsh-agent'),
    importDsh('@deepseek-ai/dsh-agent-loop'),
    importDsh('@deepseek-ai/dsh-token-meter'),
    importDsh('@deepseek-ai/dsh-session-projection'),
    importDsh('@deepseek-ai/dsh-jobs-local'),
    importDsh('@deepseek-ai/dsh-compaction-basic'),
  ]);
  const { Context } = cordisModule;
  const { default: LlmRuntime, LlmAdapter, createUserMessage } = llmModule;
  const { default: SessionStore, SessionId } = sessionModule;
  const { default: SystemPrompt } = promptModule;
  const { default: ToolRuntime } = toolsModule;
  const { default: AgentRegistry, assembleContextFor } = agentModule;
  const { default: AgentLoop } = loopModule;
  const { default: TokenMeter } = tokenMeterModule;
  const { default: SessionProjectionRegistry } = projectionModule;
  const { default: LocalJobRegistry } = jobsModule;
  const { BasicCompactionEngine } = compactionModule;

  class TextAdapter extends LlmAdapter {
    requests = [];

    resolveModel(provider, model) {
      return Promise.resolve({
        provider,
        id: model,
        name: model,
        context: { contextWindow: 100_000 },
      });
    }

    async * stream(options) {
      this.requests.push(structuredClone(options));
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'answer' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }

  class DeterministicCompaction extends BasicCompactionEngine {
    async summarize() {
      return {
        summary: [{ type: 'text', text: 'checkpoint' }],
        provider: MODEL,
        model: 'summary',
      };
    }
  }

  const root = new Context();
  let settleJob;
  try {
    await root.plugin(LlmRuntime);
    await root.plugin(SessionStore);
    await root.plugin(SystemPrompt, {
      includeHarnessIdentity: false,
      includeRuntimeContext: true,
      persona: 'work-state compaction test',
    });
    await root.plugin(ToolRuntime);
    await root.plugin(AgentRegistry);
    await root.plugin(SessionProjectionRegistry);
    await root.plugin(LocalJobRegistry);
    await root.plugin({
      inject: ['jobs'],
      apply(ctx) {
        ctx.jobs.attachController('work-state-compaction-test');
      },
    });
    await root.plugin(workStatePlugin);
    await root.plugin(AgentLoop, { agents: [] });
    await root.plugin(TokenMeter);

    const adapter = new TextAdapter();
    root.llm.registerAdapter([MODEL], adapter);
    const compact = new DeterministicCompaction(root, {
      auto: false,
      retainTokens: 0,
    });
    const agent = root.agentLoop.create(SessionId('work-state-real-compaction'), {
      provider: MODEL,
      model: MODEL,
    });

    const done = new Promise((resolve) => { settleJob = resolve; });
    root.jobs.start({
      kind: 'test',
      label: 'compaction-survivor',
      owner: agent,
      run: () => ({ cancel() {}, done }),
    });

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: LONG_HISTORY }],
      source: { kind: 'user' },
    }));
    await agent.whenIdle();

    const firstContext = agent.session.snapshotEvents().find((event) =>
      event.type === 'user/message'
      && event.data.source.kind === 'plugin'
      && event.data.source.plugin === '@deepseek-ai/dsh-system-prompt');
    assert.equal(firstContext?.type, 'user/message');
    assert.match(firstContext.data.content[0].text, /<dsh_work_state>/);
    assert.match(firstContext.data.content[0].text, /compaction-survivor/);

    const result = await compact.compactNow(agent, new AbortController().signal);
    assert.ok(result, 'the real compactor must produce a replacement');
    assert.equal(result.shadowedSeqs.includes(firstContext.seq), true,
      'the compactor must actually remove the retained work-state snapshot');
    assert.deepEqual(
      agent.session.snapshotEvents()
        .filter((event) => event.type.startsWith('compaction/'))
        .map((event) => event.type),
      ['compaction/start', 'compaction/summary', 'compaction/end'],
    );

    const reassembled = await root.systemPrompt.assemble(assembleContextFor(agent));
    const contribution = reassembled.contexts.find((entry) => entry.name === CONTEXT_NAME);
    assert.ok(contribution, 'work-state context must be rebuilt after compaction');
    assert.match(contribution.text, /compaction-survivor/);

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'after compaction' }],
      source: { kind: 'user' },
    }));
    await agent.whenIdle();

    const runtimeContexts = agent.session.snapshotEvents().filter((event) =>
      event.type === 'user/message'
      && event.data.source.kind === 'plugin'
      && event.data.source.plugin === '@deepseek-ai/dsh-system-prompt');
    assert.equal(runtimeContexts.length, 2,
      'AgentLoop must re-materialize the snapshot removed by compaction');
    assert.ok(runtimeContexts[1].seq > result.summarySeq);
    assert.match(runtimeContexts[1].data.content[0].text, /compaction-survivor/);
    assert.equal(adapter.requests.length, 2);
    assert.equal(adapter.requests[1].messages.some((message) =>
      message.source.kind === 'plugin'
      && message.source.plugin === '@deepseek-ai/dsh-system-prompt'
      && message.content.some((block) => block.type === 'text' && block.text.includes('compaction-survivor'))), true);
  } finally {
    settleJob?.({ status: 'completed' });
    await root.fiber.dispose();
  }
});
