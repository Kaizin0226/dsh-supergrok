# Security policy

The repository stores generic hardened provider and deployment code, not production security material.

Never commit API keys, OAuth access or refresh tokens, cookies, grant records, DPAPI material, Bearer headers, real settings, sessions, chat content, databases, logs, crash dumps, usage details, local hashes or security baselines, acceptance evidence, proxy/IP evidence, rollback records, production backups, usernames, device information, or real absolute paths.

Run `npm run safety` and `npm run history-safety` before every commit. A finding blocks the commit; do not suppress it, bypass the hook, or commit first and remove it later.

Security reports must be handled privately by the repository owner and must not include credentials or production evidence in an issue.
