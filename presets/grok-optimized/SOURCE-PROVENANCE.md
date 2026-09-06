# Grok optimized preset provenance

Version 0.8.0 is derived from the exact DSH standard composition in the root
source lock. The two runtime YAML files are accompanied by package metadata,
base-lock and PROVENANCE.md in new suite installations.

`base-lock.json` records upstream standard, local distribution standard,
Grok-only work-state context, the two YAML payload hashes and the fixed Grok
Build persona reference. Both local modes mount recall exactly once; only
Grok mode adds work-state context. Native child agents inherit their model,
with native explicit cross-model selection remaining available.

The adapted persona references xai-org/grok-build at
`72a61251fcffb464bcc687aeb5a998e5a98ec0c9`; preserve the root NOTICE and Apache-2.0
license alongside original MIT integration work. No external Grok executable
is loaded. Model choices, permissions and account authorization stay in DSH.
