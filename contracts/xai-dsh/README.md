# Historical xAI API contract

This directory is retained for historical reference and offline regression tests. It is not part of the SuperGrok OAuth build, installation or authentication route.

# xAI / DSH offline contracts

This directory contains synthetic protocol fixtures, a pending empty model-directory snapshot, a reviewed exact-version overlay, and parameterized rollout tooling. It contains no API key, OAuth grant, live model response, production settings, host snapshot, local hash baseline, canary evidence, or rollback record.

The default test suite is zero-network. It verifies:

- only canonical text-output model IDs from a synthetic `/v1/language-models` response can enter a verified snapshot;
- aliases and models absent from the reviewed policy fail closed;
- interleaved tool identities, encrypted reasoning, refusal/final output, cache usage, and billed-cost fields remain represented in synthetic Responses fixtures;
- the reviewed overlay contains the required fail-closed invariants;
- the rollout script parses and retains transactional backup and rollback guards.

Run:

```text
npm test
```

The checked-in catalog snapshot is intentionally `pending-canary` with an empty allowlist. Real captures and production promotion evidence must remain outside Git.

For a local dry run, copy `manifest.example.json` to ignored `manifest.json`, fill it only on the target machine, and pass explicit `-DshRoot`, `-RollbackRoot`, and `-LocalManifest` paths to `scripts/rollout.ps1`. `Apply` additionally requires its explicit confirmation value. The script never starts, stops, or restarts DSH.

## 中文：历史 xAI API 合约

此目录只保留历史参考和离线回归测试，不属于 SuperGrok OAuth 的构建、安装或认证路由。
内容为合成协议样例、待验收的空模型目录快照、已审核精确版本补丁与参数化部署工具；不含 API key、
OAuth 授权、真实模型响应、生产设置、主机快照、本机哈希基线、线上验收或回滚记录。

默认测试零网络，验证：合成 `/v1/language-models` 响应中仅规范文字输出型号进入已验证快照；
别名及审核策略之外的型号拒绝；Responses 样例保留交错工具身份、加密推理、拒绝与最终输出、缓存用量
和费用字段；补丁保留失败关闭约束；部署脚本可解析并保留事务备份与回滚保护。运行命令为 `npm test`。

检入目录快照有意保持 `pending-canary` 且允许列表为空，真实捕获与生产提升证据留在 Git 外。
本地 dry-run 可将 `manifest.example.json` 复制到已忽略的 `manifest.json`，仅在目标机器填写；
给 `scripts/rollout.ps1` 显式传入 `-DshRoot`、`-RollbackRoot`、`-LocalManifest`。
`Apply` 另需精确确认值，脚本不启动、停止或重启 DSH。
