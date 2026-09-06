# dsh-tool-attachment-history

[English](README.md) | 中文

面向模型的 `recall_image_attachment` 工具与感知 compaction 的历史图片上下文。该插件只在 `ctx.attachments`、`ctx.systemPrompt` 和 `ctx.tools` 均存在时组合。它从调用方 Agent 派生 session 身份，只接受 opaque `attachmentId` 和可选 `{seq, ordinal}` occurrence，通过 `dsh-attachment-history` 授权该 occurrence，要求已记录的当前精确路由标明已识别的 `responses`、`chat` 或 `chat_completions` backend 且显式声明 `image` 输入，然后把字节与元数据验证委托给 `AttachmentStore.readImage`。它不新建仓库、不复制对象、不调用 provider adapter，也不接受路径、URL、MIME、尺寸、字节或调用方提供的 session id。

动态 `attachment-history:hidden-images` 上下文同步读取本次 assemble 的 Agent。它按 newest-first 列出已不在 `session.surface.nodes` 中的合格持久 occurrence，并按 attachment id 分组。输出最多包含 32 个附件和 4096 UTF-8 bytes，会报告省略数量，从不可信展示名称中去除路径前缀和控制字符，并且在 recall 验证前不声称引用对象完整。现有 AgentLoop runtime-context snapshot 路径会把渲染结果记录为带来源的 `user/message`；该插件不修改 loop，也不维护并行会话状态。

## 模型体验

### 隐藏的历史图片上下文

#### 模型看到的内容

compaction 隐藏较早的已授权图片后，模型会看到有界的 newest-first 列表，包含 attachment id、最新 `{seq, ordinal}` 定位符、occurrence 计数和存在时的已清理展示名称。该上下文会报告被省略的较早引用，并说明 recall 会验证完整性。

#### Token 影响

仅在条件满足时出现，上限为 32 个附件和 4096 UTF-8 bytes。当前 surface 仍包含全部已授权图片 occurrence，或组装提示词时没有 Agent，它不出现。

#### KV 缓存影响

确定性快照会保持未变前缀。隐藏图片集合、occurrence 计数、最新定位符或展示名称变化时，会替换受影响的运行时上下文后缀。

### Recall 调用与结果

#### 模型看到的内容

模型会看到 `recall_image_attachment`，其参数为 opaque `attachmentId` 和可选 `{seq, ordinal}` occurrence。成功调用会添加证据文本块和已验证的原生图片块。伪造 ID、仅属于父或兄弟会话的 ID、继承的 fork-seed ID、损坏对象、未知 backend、路由漂移和 text-only 路由会返回失败，不返回图片。

#### Token 影响

只要该插件已组合，稳定的工具 schema 就会出现。调用会仅追加其参数和证据块；成功调用还会把原生图片添加到下一次 provider 请求。

#### KV 缓存影响

稳定 schema 会保持请求前缀。工具调用历史仅追加增长，召回的原生图片会在可复用前缀之后改变下一次 provider 请求。

## 已知限制与待完成工作

- 召回解决由 compaction 或 pruning 从当前 surface 移除的图片；它不会绕过 provider 的单次请求图片限制。
- 工具不会切换模型或 provider，也没有 text-only fallback。
- 通用文件和生成媒体需要各自独立的 typed 工具和路由能力。
