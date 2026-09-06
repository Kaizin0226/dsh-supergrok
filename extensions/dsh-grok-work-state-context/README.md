# dsh-grok-work-state-context

Versioned, out-of-tree DSH plugin for the `grok-optimized` preset. It adds one
bounded runtime-context snapshot containing only current work that DSH already
owns:

- `pending` and `in_progress` todos from the current turn;
- `running` and `stopping` jobs owned by the exact current session;
- live, direct, continuable DSH child Agents owned by the exact parent Agent.

The package is model-independent. It contains no Grok model id, provider route,
OAuth, Grok Build process, ACP, memory, permission system, external Agent, timer,
poller, or network code.

## Activation

Installing this package into the web and headless profile module roots only
makes it resolvable. It MUST NOT be added to `dsh.profile.bundles` or patched
into the host. Activate it only by adding this row to the `grok-optimized`
agent preset:

```yaml
- id: grok-work-state-context
  name: dsh-grok-work-state-context
```

Do not add the row to `standard`. The row is scope-local, so the existing DSH
AgentLoop remains responsible for runtime-context snapshot history, deduplication
and post-compaction reassembly.

## Runtime contract

The plugin registers one synchronous, side-effect-free
`systemPrompt.context` provider named `grok-optimized:work-state`. A diagnostic
or cold assembly without `context.agent` returns an empty string and does not
read another service. Every eligible assembly reads only that exact Agent's
current projection and registry views.

Output is deterministic JSON inside `<dsh_work_state>` tags. Labels are JSON
data, never executable instructions. The complete contribution is capped at
4096 UTF-8 bytes. Capacity priority is todos, then jobs, then continuable
children; omission counts remain explicit.

Version `1.1.0` targets DSH `0.1.2-rc.1` (with the `.grok.1` fork packages). Runtime method-shape checks
fail composition if a future host removes an API the plugin uses. Upgrade DSH
only after rerunning and, if needed, revising the contract tests.

## Verification

Run `npm test` with `XAI_API_KEY` explicitly empty, `DSH_TEST_RUNTIME_ROOT`
pointing to an isolated installed rc.1 release and `DSH_TEST_HOME` to its
candidate data layout (profiles and preset only). There is no production
fallback. Tests are zero-network and use synthetic sessions.

The suite covers pure projection behavior, isolation, stable ordering, byte
limits, omission counts, one-shot deduplication, Unicode handling, the real
Cordis Loader/SystemPrompt composition lifecycle, exact package versions and
the real DSH todo reset at `turn/start`.

This staging package does not install or restart production by itself.

The five suites use full snapshots, inherited-prefix counts and the actual
`agentPreset` projection. `lib` is maintained source for this package, not
output generated from an absent `src` directory.
