import assert from 'node:assert/strict';
import test from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SystemPrompt, { renderContextSnapshot } from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import * as ToolTodo from '@deepseek-ai/dsh-tool-todo';
import * as History from 'dsh-tool-attachment-history';
import * as WorkState from 'dsh-grok-work-state-context';
import { image, user, compact, agent } from './fixtures.mjs';

test('native scoped composition registers once, renders fresh official snapshots and disposes cleanly', async () => {
  const ctx = new Context();
  await ctx.plugin(SessionStore);
  await ctx.plugin(SystemPrompt, { personaPrefix: '' });
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(ToolTodo, { allowParallelInProgress: true });
  ctx.provide('attachments', { readImage: async () => { throw new Error('unexpected attachment read during context assembly'); } });
  ctx.provide('jobs', { list: () => [] });
  ctx.provide('agents', { list: () => [], isOwnedBy: () => false });
  let scope;
  await ctx.plugin(Object.assign(inner => { scope = createScope(inner, { name: 'synthetic-preset' }); }, {
    inject: ['systemPrompt', 'tools', 'sessionProjections', 'attachments', 'jobs', 'agents'],
  }));
  const historyFiber = await scope.ctx.plugin(History);
  const workFiber = await scope.ctx.plugin(WorkState);
  const s = ctx.sessions.create();
  const a = agent(s);
  const context = { scope: scopeOf(scope.ctx), agent: a };
  user(s, [image('historical')]);
  s.append('turn/start', { turn: 1 });
  s.append('todo/write', { todos: [{ content: 'resume the current plan', status: 'in_progress' }] });
  compact(s);
  const first = await ctx.systemPrompt.assemble(context);
  const text = renderContextSnapshot(first);
  assert.match(text, /historical/);
  assert.match(text, /resume the current plan/);
  assert.equal(first.contexts.filter(x => x.name === 'grok-optimized:work-state').length, 1);
  assert.equal(first.tools.filter(x => x.name === 'recall_image_attachment').length, 1);
  const outside = await ctx.systemPrompt.assemble({ agent: a });
  assert.equal(outside.contexts.some(x => x.name === 'grok-optimized:work-state'), false);
  assert.equal(outside.tools.some(x => x.name === 'recall_image_attachment'), false);

  // Official todo transition determines the current value; no extension cache survives it.
  s.append('todo/write', { todos: [{ content: 'resume the current plan', status: 'completed' }] });
  const second = renderContextSnapshot(await ctx.systemPrompt.assemble(context));
  assert.equal(second.includes('resume the current plan'), false);
  assert.match(second, /historical/);
  await historyFiber.dispose();
  await workFiber.dispose();
  const disposed = await ctx.systemPrompt.assemble(context);
  assert.equal(disposed.contexts.some(x => x.name === 'attachment-history:hidden-images'), false);
  assert.equal(disposed.contexts.some(x => x.name === 'grok-optimized:work-state'), false);
  assert.equal(disposed.tools.some(x => x.name === 'recall_image_attachment'), false);

  await scope.ctx.plugin(History);
  await scope.ctx.plugin(WorkState);
  assert.equal((await ctx.systemPrompt.assemble(context)).tools.filter(x => x.name === 'recall_image_attachment').length, 1);
  await scope.dispose();
});
