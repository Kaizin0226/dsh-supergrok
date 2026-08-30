/**
 * Security-critical constants for the hardened SuperGrok transport.
 *
 * These values intentionally cannot be overridden from DSH settings or the
 * process environment. Bridge and the staging verifier consume the matching
 * root-level `supergrok-hardening.json` declaration.
 */
export const PLUGIN_NAME = 'dsh-llm-grok-oauth';
export const PLUGIN_VERSION = '0.3.0-hardened.5';
export const PROVIDER = 'grok-oauth';
export const DEFAULT_MODEL = 'grok-4.6';
export const DEFAULT_REASONING_EFFORT = 'high';
// Backward-compatible names for the pinned production default. These values
// are no longer an allowlist: exact entitlement always comes from the live
// account catalog.
export const MODEL = DEFAULT_MODEL;
export const REASONING_EFFORT = DEFAULT_REASONING_EFFORT;
export const PERMISSION_MODE = 'read-only';
export const MODELS_REFRESH_SECONDS_DEFAULT = 60;
export const MODELS_REFRESH_SECONDS_MIN = 10;
export const MODELS_REFRESH_SECONDS_MAX = 86400;
export const CATALOG_SYNC_SECONDS = 3600;

export const PROXY_URL = 'http://127.0.0.1:7897';
export const AUTH_ORIGIN = 'https://auth.x.ai';
export const ACCOUNTS_ORIGIN = 'https://accounts.x.ai';
export const CHAT_PROXY_ORIGIN = 'https://cli-chat-proxy.grok.com';
export const CHAT_PROXY_BASE_URL = `${CHAT_PROXY_ORIGIN}/v1`;

/** Public OAuth client identifier used by the first-party Grok device flow. */
export const OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
export const OAUTH_SCOPES = 'openid profile email offline_access grok-cli:access api:access';

export const PROTOCOL_PROVENANCE =
  'xai-org/grok-build@bc7f02eddd3d84085849dc19ed216f11c23b0571';
export const PROTOCOL_SNAPSHOT_VERSION = '1.0.12';
export const CLIENT_IDENTIFIER = 'dsh-supergrok-oauth-hardened';
export const CLIENT_MODE = 'headless';

/**
 * `x-grok-client-version` describes this client, not the upstream client whose
 * protocol was studied. The provenance and compatibility version are carried
 * separately in the local trust manifest so the adapter never impersonates
 * the official Grok CLI.
 */
export const CLIENT_VERSION = PLUGIN_VERSION;

export const ALLOWED_ORIGINS = Object.freeze([
  AUTH_ORIGIN,
  ACCOUNTS_ORIGIN,
  CHAT_PROXY_ORIGIN,
]);
