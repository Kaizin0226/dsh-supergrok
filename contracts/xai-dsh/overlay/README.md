# Versioned pi-ai overlay candidate

This overlay targets exactly `@earendil-works/pi-ai@0.82.1`, as installed by
`@deepseek-ai/dsh-llm-pi-ai@0.1.1-rc.2`. It is a pnpm patch, not a direct edit
of `node_modules`.

It makes four contract changes:

1. xAI is treated as a native Responses tool-call provider, so the provider's
   `call_id` and item id survive local-history replay.
2. missing or duplicate provider `call_id` (and missing item id) fails before a
   terminal assistant turn can authorize tool execution. A `call_id` absent on
   `output_item.added` cannot be repaired by a later event, and one
   `call_id|item_id` identity may bind to only one `output_index`.
3. `completed`/`incomplete` requires complete safe-integer usage, exact
   `total=input+output`, and bounded optional cache details.
4. `queued`/`in_progress` cannot masquerade as a terminal successful response.
5. store:false reasoning must have replayable `encrypted_content` before a
   tool-using turn can complete. This enforcement is scoped to xAI.
6. xAI terminal output must exactly match completed streamed tool/reasoning
   items; function arguments use strict object JSON, and type/name/payload drift
   fails before tool authorization.

The staging test copies the installed package to a temporary directory, applies
the patch there, and imports the patched public processor. No production file
is changed.

For a later authorized installation only:

1. Copy the patch to
   `<DSH_ROOT>/patches/@earendil-works__pi-ai@0.82.1-xai-contract.patch`.
2. Merge `pnpm-workspace.fragment.yml` into the production workspace file.
3. Back up `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and the web/headless profile
   locks.
4. Run pnpm offline from the DSH root so the lockfile records the patch hash.
5. Run this candidate's test and gate suites against the newly installed bytes.

Do not install this overlay if the package versions or source hashes differ;
regenerate and re-audit it instead.
