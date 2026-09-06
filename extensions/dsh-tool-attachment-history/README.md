# dsh-tool-attachment-history

[English](#english) | [简体中文](#简体中文)

## English

The model-facing `recall_image_attachment` tool and compaction-aware historical-image context. The plugin composes only when `ctx.attachments`, `ctx.systemPrompt`, and `ctx.tools` are present. It derives session identity from the calling Agent, accepts only an opaque `attachmentId` plus an optional `{seq, ordinal}` occurrence, authorizes that occurrence through `dsh-attachment-history`, requires the logged exact current route to name a recognized `responses`, `chat`, or `chat_completions` backend and explicitly declare `image` input, then delegates byte and metadata verification to `AttachmentStore.readImage`. It creates no repository, copies no object, calls no provider adapter, and accepts no path, URL, MIME type, dimensions, bytes, or caller-supplied session id.

The dynamic `attachment-history:hidden-images` context is a synchronous read of the assembling Agent. It lists eligible durable occurrences that no longer exist in `session.surface.nodes`, newest first, grouped by attachment id. It includes at most 32 attachments and 4096 UTF-8 bytes, reports omissions, strips path prefixes and control characters from untrusted display names, and never claims the referenced object is intact before recall verifies it. The existing AgentLoop runtime-context snapshot path logs the rendered contribution as a sourced `user/message`; the plugin does not patch the loop or maintain parallel session state.

### Model Experience

#### Hidden historical-image context

##### What the model sees

After compaction hides an earlier authorized image, the model sees a bounded newest-first list of attachment ids, latest `{seq, ordinal}` locators, occurrence counts, and sanitized display names when present. The context reports omitted older references and says that recall verifies integrity.

##### Token effect

Conditional and capped at 32 attachments and 4096 UTF-8 bytes. It is absent when the current surface contains every authorized image occurrence or no Agent is assembling the prompt.

##### KV Cache effect

The deterministic snapshot preserves an unchanged prefix. A changed hidden-image set, occurrence count, latest locator, or display name replaces the affected runtime-context suffix.

#### Recall call and result

##### What the model sees

The model sees `recall_image_attachment` with an opaque `attachmentId` and optional `{seq, ordinal}` occurrence. A successful call adds an evidence text block beside the verified native image block. Forged ids, parent- or sibling-only ids, inherited fork-seed ids, damaged objects, unknown backends, route drift, and text-only routes return a failure and no image.

##### Token effect

The stable tool schema is present whenever the plugin is composed. A call appends its arguments and the evidence block; a successful call also adds the native image to the following provider request.

##### KV Cache effect

The stable schema preserves its request prefix. Tool-call history grows append-only, while a recalled native image changes the following provider request after the reusable prefix.

### Known limitations

- Recall addresses images removed from the current surface by compaction or pruning; it does not override a provider's single-request image limits.
- The tool does not switch models or providers and has no text-only fallback.
- Generic files and generated media require independent typed tools and route capabilities.

## 简体中文

面向模型的 `recall_image_attachment` 工具与感知 compaction 的历史图片上下文。该插件只在 `ctx.attachments`、`ctx.systemPrompt` 和 `ctx.tools` 均存在时组合。它从调用方 Agent 派生 session 身份，只接受 opaque `attachmentId` 和可选 `{seq, ordinal}` occurrence，通过 `dsh-attachment-history` 授权该 occurrence，要求已记录的当前精确路由标明已识别的 `responses`、`chat` 或 `chat_completions` backend 且显式声明 `image` 输入，然后把字节与元数据验证委托给 `AttachmentStore.readImage`。它不新建仓库、不复制对象、不调用 provider adapter，也不接受路径、URL、MIME、尺寸、字节或调用方提供的 session id。

动态 `attachment-history:hidden-images` 上下文同步读取本次 assemble 的 Agent。它按 newest-first 列出已不在 `session.surface.nodes` 中的合格持久 occurrence，并按 attachment id 分组。输出最多包含 32 个附件和 4096 UTF-8 bytes，会报告省略数量，从不可信展示名称中去除路径前缀和控制字符，并且在 recall 验证前不声称引用对象完整。现有 AgentLoop runtime-context snapshot 路径会把渲染结果记录为带来源的 `user/message`；该插件不修改 loop，也不维护并行会话状态。

### 模型体验

#### 隐藏的历史图片上下文

##### 模型看到的内容

compaction 隐藏较早的已授权图片后，模型会看到有界的 newest-first 列表，包含 attachment id、最新 `{seq, ordinal}` 定位符、occurrence 计数和存在时的已清理展示名称。该上下文会报告被省略的较早引用，并说明 recall 会验证完整性。

##### Token 影响

仅在条件满足时出现，上限为 32 个附件和 4096 UTF-8 bytes。当前 surface 仍包含全部已授权图片 occurrence，或组装提示词时没有 Agent，它不出现。

##### KV 缓存影响

确定性快照会保持未变前缀。隐藏图片集合、occurrence 计数、最新定位符或展示名称变化时，会替换受影响的运行时上下文后缀。

#### Recall 调用与结果

##### 模型看到的内容

模型会看到 `recall_image_attachment`，其参数为 opaque `attachmentId` 和可选 `{seq, ordinal}` occurrence。成功调用会添加证据文本块和已验证的原生图片块。伪造 ID、仅属于父或兄弟会话的 ID、继承的 fork-seed ID、损坏对象、未知 backend、路由漂移和 text-only 路由会返回失败，不返回图片。

##### Token 影响

只要该插件已组合，稳定的工具 schema 就会出现。调用会仅追加其参数和证据块；成功调用还会把原生图片添加到下一次 provider 请求。

##### KV 缓存影响

稳定 schema 会保持请求前缀。工具调用历史仅追加增长，召回的原生图片会在可复用前缀之后改变下一次 provider 请求。

### 已知限制

- 召回解决由 compaction 或 pruning 从当前 surface 移除的图片；它不会绕过 provider 的单次请求图片限制。
- 工具不会切换模型或 provider，也没有 text-only fallback。
- 通用文件和生成媒体需要各自独立的 typed 工具和路由能力。
