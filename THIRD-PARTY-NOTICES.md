# Licenses and attribution

The original provider copyright and MIT terms remain in [LICENSE](LICENSE).
New original code and documentation by Kaizin0226 use MIT. The combined
provider/preset distribution also contains adapted Apache-2.0 material;
its package expression is `MIT AND Apache-2.0`.

| Material | Source and applicable terms |
| --- | --- |
| Original provider | wangyaominde/dsh-llm-grok-oauth at `108cc76224d1845b5c88602f7c7a24bb1ced0497`; MIT, copyright wangyaominde |
| DSH core patch and standard composition | deepseek-ai/deepseek-harness at `a66e4702047846cdaa10c66c9d3df3951f5ea70d`; [DeepSeek MIT](licenses/DSH-MIT.txt) |
| Grok protocol conventions, image preparation policy and adapted persona guidance | xai-org/grok-build snapshots recorded in [provenance](UPSTREAM-PROVENANCE.md); [Apache-2.0 with original attribution](licenses/Grok-Build-Apache-2.0.txt), copyright 2023–2026 SpaceXAI |
| Work-state and attachment-history extensions; build/install helpers | Original DSH integration work by Kaizin0226; MIT |

The Grok-derived material is identified in `lib/constants.js`,
`lib/protocol.js`, `lib/images.js` and `presets/grok-optimized/agent.cordis.yml`.
The protocol implementation is adapted for DSH; the image policy retains the
reference limits; the persona uses DSH-native equivalents of reference guidance.
These files include substantial original integration code as well. Preserve
NOTICE and both applicable licenses when redistributing the combined work.
No complete reference repository is vendored. npm dependencies retain their
own licenses and notices in installed packages.

Source-code licenses do not grant account access, subscription entitlements,
service authorization or an endorsement by xAI or DeepSeek. Service access
remains subject to the user's account, available OAuth flow and applicable terms.
