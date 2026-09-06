import assert from 'node:assert/strict';
import test from 'node:test';

import { SUPPORTED_DSH_VERSION } from '../lib/invariant.js';
import { importDsh, importDshPackageJson } from './helpers/dsh-runtime.mjs';

const AUDITED_PACKAGES = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-jobs',
  '@deepseek-ai/dsh-session-projection',
  '@deepseek-ai/dsh-subagent',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-tool-todo',
];

test('installed DSH packages match the exact audited API generation', async () => {
  for (const name of AUDITED_PACKAGES) {
    const manifest = await importDshPackageJson(name);
    const expected = name === '@deepseek-ai/dsh' ? `${SUPPORTED_DSH_VERSION}.grok.1` : SUPPORTED_DSH_VERSION;
    assert.equal(manifest.version, expected, `${name} version drift`);
  }
});

test('real DSH todo projection clears at turn/start', async () => {
  const [cordisModule, projectionModule, todoModule, sessionModule] = await Promise.all([
    importDsh('@deepseek-ai/cordis'),
    importDsh('@deepseek-ai/dsh-session-projection'),
    importDsh('@deepseek-ai/dsh-tool-todo'),
    importDsh('@deepseek-ai/dsh-session'),
  ]);
  const { Context, Service } = cordisModule;
  const { default: SessionProjectionRegistry } = projectionModule;
  const { Session, SessionId } = sessionModule;

  class ToolsStub extends Service {
    constructor(ctx) {
      super(ctx, 'tools');
    }
    register() {
      return () => {};
    }
  }

  const root = new Context();
  try {
    await root.plugin(SessionProjectionRegistry);
    await root.plugin(ToolsStub);
    await root.plugin(todoModule, { allowParallelInProgress: true });

    const active = Session.create(SessionId('todo-active'));
    active.append('todo/write', { todos: [{ content: 'active', status: 'in_progress' }] });
    assert.deepEqual(root.sessionProjections.stateOf(active, 'todos'), [
      { content: 'active', status: 'in_progress' },
    ]);

    const nextTurn = Session.create(SessionId('todo-next-turn'));
    nextTurn.append('todo/write', { todos: [{ content: 'old', status: 'pending' }] });
    nextTurn.append('turn/start', { turn: 1 });
    assert.equal(root.sessionProjections.stateOf(nextTurn, 'todos'), null);
  } finally {
    await root.fiber.dispose();
  }
});
