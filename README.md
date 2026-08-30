# Hardened SuperGrok OAuth provider for DSH

This private derived repository manages the complete DSH × SuperGrok source boundary:

- the hardened OAuth provider and live subscription catalog at the repository root;
- the model-independent Grok optimization preset under `presets/grok-optimized`;
- synthetic xAI/DSH protocol fixtures and reviewed overlay source under `contracts/xai-dsh`;
- parameterized Windows install, verification, and rollback tooling under `deployment/windows`.

Real credentials, OAuth grants, settings, sessions, databases, logs, production evidence, local hashes, backups, absolute paths, npm packages, and reference clones are excluded. The public provider repository is configured only as Git remote `upstream`; this is not a GitHub fork.

This local build is pinned to upstream
`wangyaominde/dsh-llm-grok-oauth@108cc76224d1845b5c88602f7c7a24bb1ced0497`
and hardened as version `0.3.0-hardened.5`.

It exposes one fixed provider and treats the signed-in account's live
subscription catalog as the only source of model entitlement:

- provider: `grok-oauth`
- default model: `grok-4.6`
- default reasoning effort: `high`
- intended DSH permission: `read-only`

The selector advertises only visible, text-capable `grok-*` models returned by
the authenticated subscription catalog and backed by a supported wire protocol.
The catalog's `supportedInApi` flag is validated but does not filter session
OAuth models because Grok Build uses it for API-key visibility. Reasoning efforts
come from each exact model entry. Selector ids are mapped to their catalog-owned
canonical wire values (for example `deep` to `xhigh`) before dispatch. A static
list, successful login, or another model's entitlement is never accepted as
proof. Before every inference, the adapter forces one catalog refresh and uses
that same fresh snapshot to validate the exact model, effort, and backend;
unknown, removed, or stale entries fail before
inference network I/O, without clamping, aliases, or fallback.
Security-critical aliases across an entry, `info`, and `_meta` must agree or the
entire catalog fails closed. One reasoning-effort entry may declare
`default: true`; it must be unique and agree with any independent default field.
The complete selector catalog is read from `/v1/models`; `/v1/models-v2` is a
404/405-only compatibility fallback. A loopback same-origin diagnostic route
exposes only bounded status enums and counts, never catalog values, response
bodies, headers, tokens, or error messages.

On-demand catalog caching remains controlled by `modelsRefreshSeconds`; its
default is 60 seconds and the accepted range is 10 through 86400 seconds.
Ordinary DSH processes additionally perform at most one non-overlapping live
catalog synchronization every 3600 seconds, notifying DSH only when the model or
capability fingerprint changes. Refresh failures clear stale entitlement. The
production default remains `grok-4.6/high`; discovering a model never changes
that default automatically.

## Fixed security boundary

All OAuth, catalog, and inference traffic uses one pinned dispatcher through
`http://127.0.0.1:7897`. There is no direct fallback, environment/system proxy
discovery, redirect following, curl fallback, or configurable endpoint.
Outbound requests are limited to the paths declared by the runtime code under:

- `https://auth.x.ai`
- `https://cli-chat-proxy.grok.com/v1`

The only browser navigation targets accepted are HTTPS pages on
`auth.x.ai` or `accounts.x.ai`. The server never launches a browser or shell;
the user must click the validated link in the DSH UI.

Protocol headers are derived from the fixed snapshot
`xai-org/grok-build@bc7f02eddd3d84085849dc19ed216f11c23b0571`.
The client identifier, version, and User-Agent identify this plugin truthfully;
HTTP 426 fails closed rather than impersonating an official Grok binary.

## Credentials and login

Login is always a fresh DSH-only OAuth device flow. The plugin never reads,
imports, copies, modifies, or deletes any official Grok CLI credential. Tokens
are stored only as a DSH grant record at `llm-grok-oauth/tokens`
(UI label `GROK_OAUTH_TOKENS`). If that service is unavailable or the stored record is
invalid, the plugin refuses to operate; it has no plaintext file fallback.

Management routes require loopback transport, a loopback `Host`, same-origin
browser fetch metadata, an exact same-origin `Origin` for mutations, JSON,
bounded empty request bodies, and a CSRF nonce obtained from the status route.

DSH-level automatic retries are disabled. Normal inference can perform at most
one replay after a single-flight token refresh when the first response is 401.
Set `DSH_SUPERGROK_ACCEPTANCE=1` in the dedicated acceptance DSH child process
to disable even that replay. `XAI_API_KEY` is never read by this package.

Live catalog synchronization is not automatic plugin updating. Only new models
and efforts compatible with the pinned protocol snapshot and the existing
`responses` or `chat/completions` backends can appear automatically. A new
endpoint, backend, or catalog protocol shape fails closed and requires a newly
reviewed pinned plugin release.

## Verification

Run `npm test`. The test runner explicitly removes `XAI_API_KEY` from itself
and all test subprocesses and reports only the boolean evidence
`XAI_API_KEY absent=true`.

Run `npm run canonical-hash` to compute the Bridge trust hash. The exact file
set and record format are declared in `supergrok-hardening.json`; missing files
and symbolic links are rejected. The publishable `npm-shrinkwrap.json` is part
of that runtime set and must remain present after installation.

Run `npm run source-hash -- --list` in the complete source checkout to record
the source digest and its exact ordered file set. The source digest is release
provenance; an installed runtime package intentionally does not contain all
tests, scripts, and source documentation needed to reproduce it.
