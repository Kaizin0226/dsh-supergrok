# Work-state design / 工作状态设计

## English

Version 1.2.0 uses DSH's native session projections for current todos, the jobs
service for active owned jobs, and native agent/session identities for owned
continuable children. It does not maintain a second session store or fall back
to legacy state APIs. Context is assembled afresh, bounded by a UTF-8 budget,
and registered only in the Grok preset scope. Completed work is excluded.
Labels are data, not instructions; unavailable services contribute no guessed state.

## 简体中文

1.2.0 使用 DSH 原生会话投影读取当前待办、jobs 服务读取所属活动任务，并以原生 Agent／
会话身份确认可继续的所属子任务。不维护第二套会话存储，不回退旧状态接口。
上下文每次重新生成并受 UTF-8 字节预算约束，只在 Grok 预设作用域内注册，不包括已完成工作。
标签作为数据处理；服务不可用时不猜测状态。
