# Grok optimized 0.9.1

Upstream standard: DSH 0.1.5-rc.2. Public standard composition: 0.1.5-rc.2.grok.1, derived from the 0.1.5-rc.2.grok.3 local functionality reference. The machine-readable base-lock.json distinguishes upstream capabilities from local additions.

Preset-only extensions: dsh-grok-work-state-context@1.2.0. All remaining capability rows match the named distribution standard. Both profiles use identical extension versions, outside global bundles.

DSH owns models, permissions, sessions and tools. Native child-model selection remains explicit opt-in. The same preset ID rolls forward only on a new composition mount; live mounted generations are not replaced. Rollback never rewrites conversation history.

## 中文

上游 standard 为 DSH `0.1.5-rc.2`，公开 standard 组合为 `0.1.5-rc.2.grok.1`，功能参考本地 `0.1.5-rc.2.grok.3`。
机器可读的 `base-lock.json` 区分上游能力与本地扩展。

仅 preset 使用的扩展为 `dsh-grok-work-state-context@1.2.0`；其余能力行与指定本地 standard 组合一致。
web/headless 使用相同扩展版本，且不加入全局 bundles。

模型、权限、会话与工具由 DSH 管理。原生子模型选择须显式开放。
相同 preset ID 仅在新组合挂载时更新，不替换已挂载的活跃代际；回滚不重写聊天历史。
