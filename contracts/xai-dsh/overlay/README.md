# Versioned pi-ai overlay candidate

This overlay targets exactly `@earendil-works/pi-ai@0.82.1`, as installed by
`@deepseek-ai/dsh-llm-pi-ai@0.1.1-rc.2`. It is a pnpm patch, not a direct edit
of `node_modules`.

It makes six contract changes:

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

## 中文：历史版本补丁候选

此 pnpm 补丁精确针对 `@deepseek-ai/dsh-llm-pi-ai@0.1.1-rc.2` 安装的
`@earendil-works/pi-ai@0.82.1`，不直接编辑 `node_modules`，也不属于默认 SuperGrok 安装。

六项合约修改：

1. xAI 作为原生 Responses 工具调用 provider，保留历史回放中的 `call_id` 与 item id。
2. `call_id` 缺失或重复、item id 缺失时，在终态助手轮次授权工具前拒绝。
   `output_item.added` 缺失的 ID 不允许后续修复，一对 `call_id|item_id` 仅绑定一个 `output_index`。
3. `completed`／`incomplete` 需完整安全整数用量、精确 `total=input+output` 及有界可选缓存信息。
4. `queued`／`in_progress` 不可冒充终态成功响应。
5. `store:false` 推理必须有可回放 `encrypted_content` 才能结束使用工具的轮次；仅对 xAI 生效。
6. xAI 终态输出须精确匹配已完成流式工具／推理项；函数参数严格为 JSON 对象，类型、名称或负载漂移
   在工具授权前拒绝。

候选测试将已安装包复制到临时目录，应用补丁后导入公开处理器，不改生产文件。
仅在未来另行授权安装时：复制补丁到 `<DSH_ROOT>/patches/@earendil-works__pi-ai@0.82.1-xai-contract.patch`，
合并 `pnpm-workspace.fragment.yml`，备份 workspace、pnpm 锁及 web/headless 锁，
从 DSH 根目录离线运行 pnpm 写入补丁哈希，再对实际安装字节运行候选测试和门禁。
包版本或源码哈希不一致时不安装，应重新生成并审核。
