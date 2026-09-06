import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CONTEXT_NAME } from '../lib/invariant.js';
import { importDsh } from './helpers/dsh-runtime.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('real Cordis Loader mounts, evaluates, and disposes the DSH prompt context', async () => {
  const [{ Context, Service }, { default: Loader }, promptModule] = await Promise.all([
    importDsh('@deepseek-ai/cordis'),
    importDsh('@deepseek-ai/cordis-plugin-loader'),
    importDsh('@deepseek-ai/dsh-system-prompt'),
  ]);
  const { default: SystemPrompt, renderContextSnapshot } = promptModule;

  class ProjectionStub extends Service {
    constructor(ctx) {
      super(ctx, 'sessionProjections');
      this.states = new Map();
    }
    stateOf(session, key) {
      return this.states.get(session)?.[key];
    }
  }

  class JobsStub extends Service {
    constructor(ctx) {
      super(ctx, 'jobs');
      this.rows = [];
    }
    list() {
      return [...this.rows];
    }
  }

  class AgentsStub extends Service {
    constructor(ctx) {
      super(ctx, 'agents');
      this.rows = [];
      this.ownership = new Map();
    }
    list() {
      return [...this.rows];
    }
    isOwnedBy(id, owner) {
      return this.ownership.get(id) === owner;
    }
  }

  const root = new Context();
  try {
    await root.plugin(SystemPrompt, {
      includeHarnessIdentity: false,
      includeRuntimeContext: true,
      persona: 'loader-test',
    });
    await root.plugin(ProjectionStub);
    await root.plugin(JobsStub);
    await root.plugin(AgentsStub);
    await root.plugin(Loader, {
      baseUrl: pathToFileURL(path.join(packageRoot, 'tests', 'loader-base.mjs')).href,
    });

    const parent = {
      id: 'loader-parent',
      status: 'running',
      session: { header: { id: 'loader-parent', createdAt: 1 } },
    };
    root.sessionProjections.states.set(parent.session, {
      todos: [{ content: 'prove loader composition', status: 'in_progress' }],
    });

    const before = await root.systemPrompt.assemble({ agent: parent });
    assert.equal(before.contexts.some((entry) => entry.name === CONTEXT_NAME), false);

    const entryId = await root.loader.create({
      id: 'work-state',
      name: '../lib/index.js',
    });
    await root.loader.await();

    const bare = await root.systemPrompt.assemble();
    assert.equal(renderContextSnapshot(bare), '');

    const mounted = await root.systemPrompt.assemble({ agent: parent });
    const contribution = mounted.contexts.find((entry) => entry.name === CONTEXT_NAME);
    assert.ok(contribution);
    assert.match(contribution.text, /prove loader composition/);
    assert.match(renderContextSnapshot(mounted), /dsh-work-state/);

    root.loader.remove(entryId);
    await root.loader.await();
    const removed = await root.systemPrompt.assemble({ agent: parent });
    assert.equal(removed.contexts.some((entry) => entry.name === CONTEXT_NAME), false);
  } finally {
    await root.fiber.dispose();
  }
});

