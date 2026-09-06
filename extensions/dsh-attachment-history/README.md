# dsh-attachment-history

[English](#english) | [简体中文](#简体中文)

## English

The authoritative pure fold for durable image occurrences in one session. It recognizes only append-origin `user/message` image blocks and image blocks inside typed `tool/result` content, recursively through nested tool results. It rejects authority from inherited fork seed (events below the Session's `inheritedEventCount`, projected durably as the last `session/end-seed` marker), surface replacements, assistant messages or chunks, inbox and spliced records, and arbitrary objects that happen to contain an attachment id.

`collectAuthorizedImageOccurrencesFromEvents` applies the same event rule to parsed stored artifacts, allowing session export to include only media the owning session actually appended. `collectAuthorizedImageOccurrences` applies it to a live `Session`. `collectHiddenImageAttachments` subtracts image ids still referenced by `session.surface.nodes`, so a tool-result-pruner replacement that retains an image does not advertise it as hidden. Repeated occurrences share one hidden entry with the latest occurrence and a count; `resolveAuthorizedImageOccurrence` selects only from the current session and accepts no path, URL, MIME type, dimensions, or bytes from the caller.

### Model Experience

#### Authorized occurrence fold, indirectly

##### What the model sees

Nothing directly. `dsh-tool-attachment-history` uses this fold to publish a bounded historical-image index and authorize `recall_image_attachment`; session export uses the same fold without adding prompt content.

##### Token effect

Zero directly. Consumers decide whether an authorized occurrence contributes model context.

##### KV Cache effect

Independent by itself. A consumer that publishes a changed hidden-image snapshot can invalidate its own affected runtime-context suffix.

### Known limitations

- The collector covers durable raster `ImageBlock` references only; generic files, audio, and video need separate typed occurrence contracts.
- It restores images hidden by surface replacement; it does not solve temporary per-request image offload.
- Attachment integrity is advisory at collection time and is verified only by `AttachmentStore.readImage` at an authorized read boundary.

## 简体中文

当前会话内持久图片 occurrence 的权威纯 fold。它只认可 append-origin 的 `user/message` 图片块，以及 typed `tool/result` 内容中的图片块，并递归遍历 nested tool result。继承的 fork seed（事件低于 Session 的 `inheritedEventCount`，持久投影为最后一个 `session/end-seed` 标记）、surface replacement、assistant message 或 chunk、inbox 与 spliced 记录，以及仅仅碰巧包含附件 ID 的任意对象都不能授予权限。

`collectAuthorizedImageOccurrencesFromEvents` 把同一事件规则应用于已解析的存储 artifact，使会话导出只包含所属会话真正 append 的媒体。`collectAuthorizedImageOccurrences` 将其应用于 live `Session`。`collectHiddenImageAttachments` 再减去 `session.surface.nodes` 仍引用的图片 ID，因此保留图片的 tool-result-pruner replacement 不会把该图片误报为隐藏。重复 occurrence 共用一个隐藏条目，保留最新 occurrence 和出现次数；`resolveAuthorizedImageOccurrence` 只从当前会话选择，且不接受调用方提供路径、URL、MIME、尺寸或字节。

### 模型体验

#### 间接的已授权 occurrence fold

##### 模型看到的内容

没有直接内容。`dsh-tool-attachment-history` 使用该 fold 发布有界的历史图片索引并授权 `recall_image_attachment`；会话导出使用同一 fold，但不添加提示词内容。

##### Token 影响

直接影响为零。消费方决定已授权 occurrence 是否进入模型上下文。

##### KV 缓存影响

该包自身与 KV Cache 独立。消费方发布变化的隐藏图片快照时，可能使自身受影响的运行时上下文后缀失效。

### 已知限制

- 收集器仅覆盖持久 raster `ImageBlock` 引用；通用文件、音频和视频需要各自独立的 typed occurrence 契约。
- 它恢复由 surface replacement 隐藏的图片，不解决单次请求图片 offload。
- 收集时附件完整性只是建议性事实；只有授权读取边界调用 `AttachmentStore.readImage` 时才进行验证。
