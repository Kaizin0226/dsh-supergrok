# Repository instructions

These rules apply to every task in this Git repository.

- Keep this repository private. Do not copy or publish credentials, OAuth grants, cookies, authentication state, sessions, chats, databases, logs, usage records, host fingerprints, production evidence, rollback records, backups, or real absolute paths.
- Preserve generic encryption, authentication protection, route gates, permission checks, fail-closed behavior, and synthetic security tests.
- Treat the provider's live authenticated catalog as the only entitlement source. Unknown, stale, conflicting, or unsupported models and efforts fail closed without fallback.
- Never read `XAI_API_KEY` in the SuperGrok OAuth provider. Tests and CI must remove provider keys and must not perform real model, OAuth, catalog, proxy-egress, or paid network calls.
- Tests use temporary directories, mocks, synthetic catalog data, and credential values that do not match real vendor formats.
- Deployment scripts must default to dry-run, require explicit paths, revalidate exact targets, use recoverable moves, verify hashes, and never control DSH processes or edit unrelated settings.
- Keep the Grok Build reference clone outside this repository. Record only its reviewed repository, commit, and package version in provenance and component locks.
- Do not bypass repository safety scans, Git hooks, or provider security tests.
