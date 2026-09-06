/**
 * Test-only prompt contribution used to distinguish preset generations.
 *
 * The fixture deliberately has no runtime dependencies beyond SystemPrompt.
 * A cold-resume test rewrites only its configured label while keeping the
 * preset id stable, then proves the resumed Agent sees the newly mounted
 * composition.
 */

export const name = 'generation-context-fixture';
export const inject = ['systemPrompt'];

export function apply(ctx, config = {}) {
  if (typeof config.label !== 'string' || config.label.length === 0) {
    throw new Error('generation-context fixture requires a non-empty label');
  }
  ctx.effect(() => ctx.systemPrompt.context({
    name: 'test:generation-context',
    order: -10_000,
    text: `generation=${config.label}`,
  }), 'generation-context-fixture.context()');
}

