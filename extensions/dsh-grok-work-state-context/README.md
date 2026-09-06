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

Version `1.1.0` targets the locked DSH `0.1.2-rc.1.grok.2` combination (including the core packages that retain `.grok.1`). Runtime method-shape checks
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

## 中文

此独立版本扩展仅用于 `grok-optimized`，添加一个有界运行上下文快照：当前轮次的 `pending`／
`in_progress` 待办、精确当前会话拥有的 `running`／`stopping` 作业，以及精确父 Agent 拥有的
活跃、直接、可续聊 DSH 子 Agent。它不绑定模型，不含型号、provider 路由、OAuth、Grok Build 进程、
ACP、记忆或权限系统、外部 Agent、定时器、轮询或网络代码。

将包安装到 web/headless 依赖树仅使它可解析。不得放进 `dsh.profile.bundles` 或修改 host 挂载；
仅在 `grok-optimized` 添加上文 YAML 行，不加入 `standard`。作用域局部挂载由已有 AgentLoop 管理
快照历史、去重和压缩后重组。

扩展注册名为 `grok-optimized:work-state` 的同步、无副作用 `systemPrompt.context` provider。
没有 `context.agent` 的诊断或冷启动组装返回空字符串，不读取其他服务；有效组装只读取该 Agent 的当前投影和注册视图。
输出是在 `<dsh_work_state>` 标签内的确定性 JSON，标签文本仅为数据，不是指令。
完整输出最多 4096 UTF-8 字节，容量优先级为待办、作业、可续聊子 Agent，明确统计省略数。

`1.1.0` 面向锁定的 DSH `0.1.2-rc.1.grok.2` 组合，其中部分核心包保留 `.grok.1`。
运行方法形状检查在 host 移除所需 API 时拒绝组合；升级 DSH 前重跑并按需调整合约测试。

运行 `npm test` 时清空 `XAI_API_KEY`，`DSH_TEST_RUNTIME_ROOT` 指向隔离安装，
`DSH_TEST_HOME` 指向候选数据布局（仅 profiles 与 preset）；不回退生产。测试零网络、会话合成，
覆盖投影、隔离、排序、字节限额、省略计数、一次性去重、Unicode、真实 Cordis Loader/SystemPrompt
生命周期、精确包版本与 `turn/start` 待办重置。五组测试使用完整快照、继承前缀计数及真实 `agentPreset` 投影。
包本身不安装或重启生产；`lib` 是维护的源码，不是缺失 `src` 所生成的产物。
