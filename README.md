# SuperGrok for DeepSeek Harness (DSH)

[简体中文](README.zh.md)

**Developer preview · unofficial experimental integration.** For developers
who can build and troubleshoot Windows + Node.js 24 setups. This is not a stable
release or an officially supported third-party OAuth client.

Use your SuperGrok subscription in DeepSeek Harness (DSH) via OAuth, with a
dedicated Grok-optimized agent mode. Sign in with your own account inside DSH;
no xAI API key is required. Available models and reasoning options come from
the authenticated live catalog and depend on account access and a compatible
installation.

This repository includes the OAuth provider, Grok preset, native work-state and
historical-image extensions, and reproducible DSH core patches. The first
supported installation target is Windows with **Node.js 24**. This preview
provides source and build/install tools, without precompiled release downloads
or npm publication.

## Components

| Component | Version / contract |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1`; required explicit loopback HTTP proxy |
| Grok-optimized preset | `0.8.0` |
| DSH core overlay | `0.1.2-rc.1.grok.2`, based on exact tag commit `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| Upstream CLI | `@deepseek-ai/dsh@0.1.2-rc.1`, with source-built core overrides |
| Attachment history, recall tool, work-state context | `1.1.0` each |
| Optional Bridge | Must separately accept this release's actual package hashes and proxy contract |

See [component lock](components.lock.json), [source provenance](UPSTREAM-PROVENANCE.md)
and [Windows build/install guide](deployment/windows/README.md).

## Behavior

- OAuth, model catalog, read-only usage and inference share one dispatcher
  configured by required `proxyUrl`. Only unauthenticated HTTP proxy endpoints
  on numeric `127.0.0.1` or `[::1]` are accepted. Missing/invalid settings fail
  before network access. No system-proxy lookup or direct fallback is used.
  Changing the proxy requires reloading the provider.
- The usage panel reports the account's quota response and cache freshness.
  Missing or expired data stays visibly unavailable/stale; quota is not an
  API-token price or a calculated bill.
- Image preparation validates owned DSH attachments, records preparation
  notices through the host, and accounts for the **complete serialized request**.
  The default budget is **40,000,000 bytes**; oversized inference requests are
  rejected before sending. Recall input remains `{attachmentId, occurrence?}`.
- Global default stays `standard`. Both local standard and `grok-optimized`
  mount image recall once. Only Grok mode mounts deterministic work-state
  context. The upstream standard has neither local extension; provenance
  distinguishes all three compositions.
- Child agents inherit the selected model unless the native explicit
  cross-model option is enabled. The preset does not pin a Grok model or add
  an external agent runtime.

## Build and verify

From a fresh checkout, run `npm ci --ignore-scripts`, then `npm run verify`.
Use `npm run build:dsh -- --work-dir <external-build-directory>` followed by
`npm run build:suite -- --work-dir <same-build-directory>` to create a portable
bundle. The [installation guide](deployment/windows/README.md) supplies complete
PowerShell commands, default-dry-run installation, fresh data initialization,
manual launch and recoverable rollback.

Tests use synthetic credentials and mocked services. Source builds and npm
installation download public dependencies; offline tests make no real OAuth,
model-catalog or inference requests. Installed web/headless composition tests
exercise actual DSH loading with a synthetic adapter and a fixture-owned local
HTTP listener. Passing them does not establish production UI or live model
acceptance. See [validation and public-release checklist](docs/VALIDATION.md).

## Boundaries

Read the [service-access review](docs/SERVICE-ACCESS.md) before signing in.
Source licensing and successful login do not establish third-party service
authorization. Protocols and account eligibility can change. Live OAuth, model
and image inference, and the production usage-panel UI have not been accepted
for this release. macOS/Linux and existing data migration are outside the
supported preview workflow. No availability or production-support promise is made.

DSH owns credentials, sessions, permission enforcement and native tools. Bridge
is optional: configure its local trust using the hashes of the installed
release; an older fixed trust hash does not authorize this package. This
project does not edit another Bridge repository or the user's trust settings.
The [old xAI API contracts](contracts/xai-dsh/README.md) are historical reference
and are excluded from the default build/install route.

Preserve the original [MIT license](LICENSE), [NOTICE](NOTICE), and applicable
[third-party licenses](THIRD-PARTY-NOTICES.md). Code licensing does not grant
subscription access or service authorization. This is an independent integration.

## Contributing and support

See [contributing](CONTRIBUTING.md), [security reporting](SECURITY.md),
[preview release notes](docs/RELEASE-NOTES.md) and the
[public-release procedure](docs/PUBLIC-RELEASE.md), available in English and
Simplified Chinese. Issues should contain minimal synthetic reproductions only;
report vulnerabilities privately. Maintenance is best-effort, without a response
time or compatibility guarantee beyond the documented tested combination.
