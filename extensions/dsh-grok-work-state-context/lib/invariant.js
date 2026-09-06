/**
 * Public constants for the versioned work-state projection contract.
 *
 * The package deliberately has no model, provider, OAuth, Grok Build, or
 * external-agent dependency. Its only model-facing output is one bounded DSH
 * runtime-context snapshot.
 *
 * @module dsh-grok-work-state-context/invariant
 */

/** Package identity used by release and compatibility checks. */
export const PACKAGE_NAME = 'dsh-grok-work-state-context';

/** Version of this independently releasable package. */
export const PACKAGE_VERSION = '1.1.0';

/** Exact DSH API generation audited for this release. */
export const SUPPORTED_DSH_VERSION = '0.1.2-rc.1';

/** Unique system-prompt context name. */
export const CONTEXT_NAME = 'grok-optimized:work-state';

/** Render after policy/delegation context while remaining an independent row. */
export const CONTEXT_ORDER = 130;

/** Hard UTF-8 byte ceiling for this plugin's complete context contribution. */
export const MAX_CONTEXT_BYTES = 4096;

/** Per-label bound before JSON escaping and complete-snapshot measurement. */
export const MAX_LABEL_BYTES = 512;

/** Stable payload discriminator. */
export const SNAPSHOT_KIND = 'dsh-work-state';

/** Stable payload format version. */
export const SNAPSHOT_VERSION = 1;

/** Capacity allocation order. Earlier categories may consume all remaining bytes. */
export const CATEGORY_ORDER = Object.freeze(['todos', 'jobs', 'children']);


