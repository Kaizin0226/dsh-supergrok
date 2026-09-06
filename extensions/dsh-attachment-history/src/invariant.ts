/** Package ownership companion for the pure attachment-history collector. @module dsh-attachment-history/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-attachment-history'
/** Cordis companion plugin name. */
export const name = 'attachment-history-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']
/** Pure folds own no events or mutable runtime relation. */
// No runtime invariant: this package only folds records owned by session and attachment packages.
const install: InvariantInstaller = () => {}
/** Register package ownership with the invariant registry. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

