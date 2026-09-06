# Fixed-source provenance

| Component | Exact source |
| --- | --- |
| Provider baseline `0.2.10` | [wangyaominde/dsh-llm-grok-oauth](https://github.com/wangyaominde/dsh-llm-grok-oauth/tree/108cc76224d1845b5c88602f7c7a24bb1ced0497), commit `108cc76224d1845b5c88602f7c7a24bb1ced0497` |
| DSH baseline `dsh-v0.1.2-rc.1` | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness/tree/a66e4702047846cdaa10c66c9d3df3951f5ea70d), commit `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| Initial OAuth/protocol snapshot `1.0.12` | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/bc7f02eddd3d84085849dc19ed216f11c23b0571), commit `bc7f02eddd3d84085849dc19ed216f11c23b0571` |
| Persona and current reference snapshot | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/72a61251fcffb464bcc687aeb5a998e5a98ec0c9), commit `72a61251fcffb464bcc687aeb5a998e5a98ec0c9` |

The public adaptation advances provider `0.6.0-hardened.1` to
`0.7.0-hardened.1` to distinguish its explicit proxy contract. It retains the
`0.8.0` preset and the `0.1.2-rc.1.grok.2` core overlay generation.
[The source lock](patches/dsh/source.lock.json) pins the exact DSH revision,
patch and changed package versions. The installer uses the unmodified upstream
CLI package `0.1.2-rc.1` with five source-built core packages; the distribution
label is not a newly published CLI package.

`OAUTH_CLIENT_ID` is a public client identifier from the pinned device-flow
reference, not a secret or authorization grant. Origins, paths, methods,
redirect handling and client identity are fixed in `lib/constants.js` and
`lib/net.js`. The provider identifies itself as
`dsh-supergrok-oauth-hardened/0.7.0-hardened.1`. User tokens come only from the
user's own DSH login, never the official client's credential storage.

`npm run source-hash` measures the checked-out source tree. `npm run
canonical-hash` measures the provider runtime payload, including its shrinkwrap
and hardening declaration. These are integrity tools, not an assertion that an
existing Bridge trusts this release. `npm-shrinkwrap.json` is included in the
provider package. The portable bundle additionally freezes the complete runtime
graph in its own package-lock and checksums all installation inputs.

See [third-party notices](THIRD-PARTY-NOTICES.md). This repository contains only
selected source, tests and general documentation. Task transcripts, production
reports, authentication state and reference-clone contents are not build inputs.
