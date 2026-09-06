# Work-state context design record

## Decision

`dsh-grok-work-state-context` is a preset-scoped read projection, not a second
runtime state owner. The DSH event log, session projections, job registry and
Agent registry remain authoritative. The plugin contributes no events and owns
no cache.

## DSH 0.1.2-rc.1 seams

- `systemPrompt.context({ name, order, text })` evaluates `text` for every
  eligible assembly and accepts an empty contribution.
- `AssembleContext.agent` is optional; bare diagnostic assemblies carry none.
- `sessionProjections.stateOf(session, 'todos')` returns the current whole todo
  list and the standard todo unit clears it on `turn/start`.
- `jobs.list(agent)` includes owned and unowned rows, so the projection still
  enforces `ownerSession === agent.id` and live statuses.
- `agents.list()` plus `agents.isOwnedBy(child.id, parent)` supplies the live
  runtime ownership edge synchronously.
- A child is shown only when durable `origin`, `parentSession`, and a current
  own-suffix `subagent` identity all agree that it is direct and continuable.
  `identity.seq >= session.inheritedEventCount` rejects an inherited descriptor.

## Invariants

1. No `context.agent` means no output and no ambient/current-Agent lookup.
2. The provider is synchronous and performs no subscription, polling, caching,
   mutation, timer creation or async enumeration.
3. Unowned, foreign, sibling, grandchild, terminal and cold-only rows are not
   shown.
4. One-shot children are represented by their live `subagent` job only, never
   duplicated in `children`.
5. Ordering is stable: todo list position; job `startedAt` then id; child
   `createdAt` then id.
6. The complete UTF-8 output is at most 4096 bytes. Capacity allocation is
   strict `todos -> jobs -> children`; every omitted row is counted.
7. Labels are bounded and JSON-encoded. No path, tool output, environment value,
   credential or provider payload is included.
8. The package is installed as a dependency of both profiles but activated only
   by the `grok-optimized` preset row. `standard` never loads it.
9. Disposal removes the context registration; the package does not alter
   AgentLoop, compaction, jobs, subagent or prompt-registry implementations.

## Deliberate exclusions

Cold ready children remain discoverable through DSH's explicit async
`listChildren` flow and are outside this synchronous snapshot. Settled jobs and
children are already handled by existing completion/settlement notices and are
not replayed here. This snapshot is current work state, not a completion feed or
durable backlog.


