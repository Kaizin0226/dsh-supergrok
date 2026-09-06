import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as HistoryInvariant from 'dsh-attachment-history/invariant'
import * as ToolHistoryInvariant from 'dsh-tool-attachment-history/invariant'

describe('attachment history invariant companions', () => {
  it('reserve their package names and release them on disposal', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    const history = await ctx.plugin(HistoryInvariant)
    const tool = await ctx.plugin(ToolHistoryInvariant)

    await expect(ctx.plugin(HistoryInvariant)).rejects.toThrow('already registered')
    await expect(ctx.plugin(ToolHistoryInvariant)).rejects.toThrow('already registered')

    await tool.dispose()
    await history.dispose()
    await expect(ctx.plugin(HistoryInvariant)).resolves.toBeDefined()
    await expect(ctx.plugin(ToolHistoryInvariant)).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
