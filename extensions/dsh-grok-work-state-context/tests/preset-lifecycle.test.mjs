import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CONTEXT_NAME } from '../lib/invariant.js';
import { importDsh, runtimeRoot } from './helpers/dsh-runtime.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testHome = process.env.DSH_TEST_HOME;
assert.ok(testHome && path.isAbsolute(testHome), 'DSH_TEST_HOME must identify the isolated candidate data layout');
assert.ok(!path.resolve(testHome).toLowerCase().includes(`${path.sep}apps${path.sep}deepseekharness`),
  'Tests must not read production data');
const presetCandidate = path.join(testHome, '.agent-presets', 'grok-optimized');
const markerPlugin = path.join(packageRoot, 'tests', 'fixtures', 'generation-context.mjs');
const workStatePlugin = path.join(packageRoot, 'lib', 'index.js');

function yamlPath(value) {
  return JSON.stringify(value);
}

function generationComposition(label) {
  return [
    '- id: generation-context',
    `  name: ${yamlPath(markerPlugin)}`,
    '  config:',
    `    label: ${JSON.stringify(label)}`,
    '- id: grok-work-state-context',
    `  name: ${yamlPath(workStatePlugin)}`,
    '',
  ].join('\n');
}

async function loadRuntimeModules() {
  const [
    cordisModule,
    loaderModule,
    includeModule,
    llmModule,
    sessionModule,
    promptModule,
    toolsModule,
    agentModule,
    loopModule,
    projectionModule,
    presetModule,
    persistenceModule,
  ] = await Promise.all([
    importDsh('@deepseek-ai/cordis'),
    importDsh('@deepseek-ai/cordis-plugin-loader'),
    importDsh('@deepseek-ai/cordis-plugin-include'),
    importDsh('@deepseek-ai/dsh-llm'),
    importDsh('@deepseek-ai/dsh-session'),
    importDsh('@deepseek-ai/dsh-system-prompt'),
    importDsh('@deepseek-ai/dsh-tools'),
    importDsh('@deepseek-ai/dsh-agent'),
    importDsh('@deepseek-ai/dsh-agent-loop'),
    importDsh('@deepseek-ai/dsh-session-projection'),
    importDsh('@deepseek-ai/dsh-agent-presets'),
    importDsh('@deepseek-ai/dsh-session-persistence-jsonl'),
  ]);
  return {
    cordisModule,
    Loader: loaderModule.default,
    Group: loaderModule.Group,
    Include: includeModule.default,
    LlmRuntime: llmModule.default,
    SessionStore: sessionModule.default,
    SessionId: sessionModule.SessionId,
    Session: sessionModule.Session,
    SystemPrompt: promptModule.default,
    ToolRuntime: toolsModule.default,
    AgentRegistry: agentModule.default,
    assembleContextFor: agentModule.assembleContextFor,
    AgentLoop: loopModule.default,
    SessionProjectionRegistry: projectionModule.default,
    AgentPresets: presetModule.default,
    JsonlSessionPersistence: persistenceModule.default,
  };
}

async function mountHarness({ baseUrl, presetRoot, persistenceRoot, inertSpecifiers = [] }) {
  const modules = await loadRuntimeModules();
  const { Context, Service } = modules.cordisModule;

  class JobsStub extends Service {
    constructor(ctx) {
      super(ctx, 'jobs');
      this.rows = [];
    }
    list() {
      return [...this.rows];
    }
  }

  const root = new Context();
  root.baseUrl = pathToFileURL(baseUrl).href + '/';
  await root.plugin(modules.Loader);
  root.loader.builtins.include = modules.Include;
  root.loader.builtins.group = modules.Group;
  if (inertSpecifiers.length > 0) {
    assert.ok(root.loader.internal, 'profile smoke requires the installed Node module loader');
    const inert = new Set(inertSpecifiers);
    const cached = new Map();
    const originalImport = root.loader.internal.import.bind(root.loader.internal);
    // Test-only interception: package resolution is audited from each profile root first,
    // then unrelated production plugins are made inert so this smoke has no side effects.
    root.loader.internal.import = async (specifier, parentURL, options) => {
      if (!inert.has(specifier)) return originalImport(specifier, parentURL, options);
      if (!cached.has(specifier)) {
        cached.set(specifier, {
          default: {
            name: `profile-smoke:${specifier}`,
            apply() {},
          },
        });
      }
      return cached.get(specifier);
    };
  }
  await root.plugin(modules.LlmRuntime);
  await root.plugin(modules.SessionStore);
  await root.plugin(modules.SystemPrompt, {
    includeHarnessIdentity: false,
    includeRuntimeContext: true,
    persona: 'preset lifecycle test',
  });
  await root.plugin(modules.ToolRuntime);
  await root.plugin(modules.AgentRegistry);
  await root.plugin(modules.AgentLoop, { agents: [] });
  await root.plugin(modules.SessionProjectionRegistry);
  await root.plugin(JobsStub);
  if (persistenceRoot !== undefined) {
    await root.plugin(modules.JsonlSessionPersistence, { root: persistenceRoot });
  }
  await root.plugin(modules.AgentPresets, {
    default: 'grok-optimized',
    roots: [{ path: presetRoot, trust: 'user' }],
    includeUserRoot: false,
  });
  return { root, modules };
}

test('same-id cold resume mounts the current composition recorded by the session', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'dsh-grok-cold-resume-'));
  const presetRoot = path.join(temp, 'presets');
  const presetDir = path.join(presetRoot, 'grok-optimized');
  const persistenceRoot = path.join(temp, 'sessions');
  const compositionPath = path.join(presetDir, 'agent.cordis.yml');
  const sessionIdText = 'grok-optimized-cold-resume';
  await mkdir(presetDir, { recursive: true });
  await writeFile(path.join(presetDir, 'preset.yml'), 'name: cold resume fixture\n', 'utf8');
  await writeFile(compositionPath, generationComposition('before'), 'utf8');

  try {
    const first = await mountHarness({
      baseUrl: runtimeRoot,
      presetRoot,
      persistenceRoot,
    });
    const sessionId = first.modules.SessionId(sessionIdText);
    const firstHandle = await first.root.agents.create({
      sessionId,
      meta: { cwd: process.cwd(), agentPreset: 'grok-optimized' },
      setup: async (agentCtx) => { await first.root.agentPresets.mount(agentCtx, 'grok-optimized'); },
    });
    first.root.jobs.rows = [{
      id: 'cold-job',
      kind: 'test',
      label: 'cold-resume-work-state',
      ownerSession: firstHandle.agent.id,
      status: 'running',
      startedAt: 1,
    }];
    const before = await first.root.systemPrompt.assemble(
      first.modules.assembleContextFor(firstHandle.agent),
    );
    assert.equal(before.contexts.find((entry) => entry.name === 'test:generation-context')?.text,
      'generation=before');
    assert.match(before.contexts.find((entry) => entry.name === CONTEXT_NAME)?.text ?? '',
      /cold-resume-work-state/);
    firstHandle.agent.session.append('turn/start', { turn: 1 });
    firstHandle.agent.session.append('turn/end', {
      turn: 1,
      reason: { kind: 'completed' },
    });
    await first.root.sessions.flush(firstHandle.agent.session);
    await first.root.fiber.dispose();

    await writeFile(compositionPath, generationComposition('current'), 'utf8');

    const second = await mountHarness({
      baseUrl: runtimeRoot,
      presetRoot,
      persistenceRoot,
    });
    try {
      const inspected = await second.root.sessionPersistence.inspect(second.modules.SessionId(sessionIdText));
      const detached = second.modules.Session.create(second.modules.SessionId(sessionIdText),
        inspected.events, inspected.meta, inspected.inheritedEventCount);
      const storedPreset = second.root.sessionProjections.stateOf(detached, 'agentPreset');
      assert.equal(storedPreset, 'grok-optimized');
      const sources = [];
      second.root.on('agent/session-start', ({ source }) => { sources.push(source); });
      const resumed = await second.root.agents.resume({
        resumeSessionId: second.modules.SessionId(sessionIdText),
        setup: async (agentCtx) => { await second.root.agentPresets.mount(agentCtx, storedPreset); },
      });
      second.root.jobs.rows = [{
        id: 'current-job',
        kind: 'test',
        label: 'current-work-state',
        ownerSession: resumed.agent.id,
        status: 'running',
        startedAt: 2,
      }];
      const current = await second.root.systemPrompt.assemble(
        second.modules.assembleContextFor(resumed.agent),
      );
      assert.deepEqual(sources, ['resume']);
      assert.equal(current.contexts.find((entry) => entry.name === 'test:generation-context')?.text,
        'generation=current');
      assert.equal(current.contexts.some((entry) => entry.text.includes('generation=before')), false);
      assert.match(current.contexts.find((entry) => entry.name === CONTEXT_NAME)?.text ?? '',
        /current-work-state/);
    } finally {
      await second.root.fiber.dispose();
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

function compositionSpecifiers(text) {
  return [...text.matchAll(/^\s*name:\s*(.+?)\s*$/gmu)]
    .map((match) => match[1])
    .map((value) => value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value);
}

for (const profile of ['web', 'headless']) {
  test(`${profile} profile package root composes the production-equivalent preset`, async () => {
    const profileRoot = path.join(testHome, 'profiles', profile);
    const profileManifest = path.join(profileRoot, 'package.json');
    const requireFromProfile = createRequire(profileManifest);
    const agentText = await readFile(path.join(presetCandidate, 'agent.cordis.yml'), 'utf8');
    const presetText = await readFile(path.join(presetCandidate, 'preset.yml'), 'utf8');
    const specifiers = [...new Set(compositionSpecifiers(agentText))];
    const packageSpecifiers = specifiers.filter((specifier) => !specifier.startsWith('cordis:'));
    for (const specifier of packageSpecifiers) {
      assert.doesNotThrow(() => requireFromProfile.resolve(specifier),
        `${profile} profile cannot resolve ${specifier}`);
    }
    const workStateManifest = requireFromProfile.resolve('dsh-grok-work-state-context/package.json');
    assert.equal(await realpath(workStateManifest),
      await realpath(path.join(profileRoot, 'node_modules', 'dsh-grok-work-state-context', 'package.json')),
      'profile resolution must select its installed work-state artifact');

    const temp = await mkdtemp(path.join(tmpdir(), `dsh-grok-${profile}-profile-`));
    const presetRoot = path.join(temp, 'presets');
    const presetDir = path.join(presetRoot, 'grok-optimized');
    await mkdir(presetDir, { recursive: true });
    await copyFile(path.join(presetCandidate, 'agent.cordis.yml'), path.join(presetDir, 'agent.cordis.yml'));
    await copyFile(path.join(presetCandidate, 'preset.yml'), path.join(presetDir, 'preset.yml'));
    assert.equal(await readFile(path.join(presetDir, 'agent.cordis.yml'), 'utf8'), agentText);
    assert.equal(await readFile(path.join(presetDir, 'preset.yml'), 'utf8'), presetText);

    const inert = packageSpecifiers.filter((specifier) => specifier !== 'dsh-grok-work-state-context');
    const { root, modules } = await mountHarness({
      baseUrl: profileRoot,
      presetRoot,
      inertSpecifiers: inert,
    });
    try {
      const handle = await root.agents.create({
        sessionId: modules.SessionId(`grok-${profile}-profile-smoke`),
        setup: async (agentCtx) => { await root.agentPresets.mount(agentCtx, 'grok-optimized'); },
      });
      root.jobs.rows = [{
        id: `${profile}-job`,
        kind: 'test',
        label: `${profile}-profile-work-state`,
        ownerSession: handle.agent.id,
        status: 'running',
        startedAt: 1,
      }];
      const assembly = await root.systemPrompt.assemble(modules.assembleContextFor(handle.agent));
      assert.match(assembly.contexts.find((entry) => entry.name === CONTEXT_NAME)?.text ?? '',
        new RegExp(`${profile}-profile-work-state`));
    } finally {
      await root.fiber.dispose();
      await rm(temp, { recursive: true, force: true });
    }
  });
}
