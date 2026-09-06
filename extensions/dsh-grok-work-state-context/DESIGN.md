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

## 中文：设计与约束

本扩展是 preset 作用域内的只读投影，不是第二个状态所有者。DSH 事件日志、会话投影、作业和
Agent 注册表保持权威；扩展不发事件、不缓存。

DSH `0.1.2-rc.1` 接口：`systemPrompt.context({ name, order, text })` 每次有效组装求值并允许空贡献；
`AssembleContext.agent` 可缺省；`sessionProjections.stateOf(session, 'todos')` 返回完整当前待办，
standard 单元在 `turn/start` 清空它。`jobs.list(agent)` 包含非所属行，故仍校验
`ownerSession === agent.id` 和活跃状态。`agents.list()` 与 `agents.isOwnedBy(child.id, parent)`
同步提供运行时归属。仅当持久 `origin`、`parentSession` 和当前自身后缀中的 `subagent` 身份共同证明
直接且可续聊时展示子 Agent；`identity.seq >= session.inheritedEventCount` 排除继承描述符。

1. 没有 `context.agent` 就不输出，也不查询环境中的当前 Agent。
2. 同步执行，不订阅、轮询、缓存、修改、建定时器或异步枚举。
3. 不展示非所属、其他会话、兄弟、孙代、终态或仅冷态记录。
4. 一次性子 Agent 仅由活跃 `subagent` 作业表示，不在 `children` 重复。
5. 稳定排序：待办原顺序；作业按 `startedAt` 后 id；子 Agent 按 `createdAt` 后 id。
6. 完整 UTF-8 输出最多 4096 字节，严格按 `todos -> jobs -> children` 分配，统计每项省略。
7. 标签限长并 JSON 编码；不包含路径、工具输出、环境值、凭据或 provider 负载。
8. 两种 profile 均安装依赖，但仅 `grok-optimized` 行激活，`standard` 不加载。
9. 释放时移除上下文注册，不修改 AgentLoop、压缩、jobs、subagent 或提示注册表实现。

冷态 ready 子 Agent 仍由 DSH 显式异步 `listChildren` 发现，不进入同步快照。
已结束作业和子 Agent 由已有完成通知处理，不在此回放；快照仅表示当前工作，不是完成通知或持久积压列表。

