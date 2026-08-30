# xAI / DSH offline contracts

This directory contains synthetic protocol fixtures, a pending empty model-directory snapshot, a reviewed exact-version overlay, and parameterized rollout tooling. It contains no API key, OAuth grant, live model response, production settings, host snapshot, local hash baseline, canary evidence, or rollback record.

The default test suite is zero-network. It verifies:

- only canonical text-output model IDs from a synthetic `/v1/language-models` response can enter a verified snapshot;
- aliases and models absent from the reviewed policy fail closed;
- interleaved tool identities, encrypted reasoning, refusal/final output, cache usage, and billed-cost fields remain represented in synthetic Responses fixtures;
- the reviewed overlay contains the required fail-closed invariants;
- the rollout script parses and retains transactional backup and rollback guards.

Run:

```text
npm test
```

The checked-in catalog snapshot is intentionally `pending-canary` with an empty allowlist. Real captures and production promotion evidence must remain outside Git.

For a local dry run, copy `manifest.example.json` to ignored `manifest.json`, fill it only on the target machine, and pass explicit `-DshRoot`, `-RollbackRoot`, and `-LocalManifest` paths to `scripts/rollout.ps1`. `Apply` additionally requires its explicit confirmation value. The script never starts, stops, or restarts DSH.
