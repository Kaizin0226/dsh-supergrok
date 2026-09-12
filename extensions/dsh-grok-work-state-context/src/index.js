/**
 * DSH preset-scoped work-state context.
 *
 * This package registers one synchronous `systemPrompt.context` provider. It
 * must be mounted as a row of the `grok-optimized` agent preset; installing the
 * package in a profile only makes the row resolvable and does not activate it.
 *
 * @module dsh-grok-work-state-context
 */

import { CONTEXT_NAME, CONTEXT_ORDER } from './constants.js';
import { renderWorkStateContext } from './projector.js';

/** Cordis plugin identity. */
export const name = 'grok-work-state-context';

/** Exact host services read synchronously by the projection. */
export const inject = ['systemPrompt', 'sessionProjections', 'jobs', 'agents'];

/** Fail during composition when a future host no longer satisfies the audited API. */
function assertMethod(owner, key, label) {
  if (owner === null || owner === undefined || typeof owner[key] !== 'function') {
    throw new Error(`dsh-grok-work-state-context: incompatible DSH host; missing ${label}`);
  }
}

/**
 * Register one effect-owned prompt context in the mounting preset scope.
 *
 * The provider intentionally closes over service capabilities, not an Agent.
 * The exact Agent is read only from the `AssembleContext` passed for the
 * current assembly; diagnostic/cold assemblies without one return empty.
 */
export function apply(ctx) {
  assertMethod(ctx.systemPrompt, 'context', 'systemPrompt.context');
  assertMethod(ctx.sessionProjections, 'snapshot', 'sessionProjections.snapshot');
  assertMethod(ctx.jobs, 'list', 'jobs.list');
  assertMethod(ctx.agents, 'list', 'agents.list');
  assertMethod(ctx.agents, 'isOwnedBy', 'agents.isOwnedBy');

  ctx.effect(() => ctx.systemPrompt.context({
    name: CONTEXT_NAME,
    order: CONTEXT_ORDER,
    text: (context) => renderWorkStateContext(context, {
      sessionProjections: ctx.sessionProjections,
      jobs: ctx.jobs,
      agents: ctx.agents,
    }),
  }), 'grok-work-state-context.context()');
}


