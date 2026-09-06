/** Package-owned invariant companion for historical image recall. @module dsh-tool-attachment-history/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-tool-attachment-history'

/** Cordis companion plugin name. */
export const name = 'tool-attachment-history-invariant'
/** Service required before package ownership can be reserved. */
export const inject = ['invariants']
/** No package-owned events: session and attachment packages validate their durable records. */
// No runtime invariant: this plugin registers views and a tool over records owned by other packages.
const install: InvariantInstaller = () => {}

/** Register the package ownership companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

