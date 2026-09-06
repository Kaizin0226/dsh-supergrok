# Repository instructions

These rules apply to every task in this Git repository.

- Preparing a developer preview does not authorize visibility changes or release publication. Follow docs/PUBLIC-RELEASE.md; the owner separately approves that final step. Do not copy or publish credentials, OAuth grants, cookies, authentication state, sessions, chats, databases, logs, usage records, host fingerprints, production evidence, rollback records, backups, or real absolute paths.
- Preserve generic encryption, authentication protection, route gates, permission checks, fail-closed behavior, and synthetic security tests.
- Treat the provider's live authenticated catalog as the only entitlement source. Unknown, stale, conflicting, or unsupported models and efforts fail closed without fallback.
- Never read `XAI_API_KEY` in the SuperGrok OAuth provider. Tests and CI must remove provider keys and must not perform real model, OAuth, catalog, proxy-egress, or paid network calls.
- Tests use temporary directories, mocks, synthetic catalog data, and credential values that do not match real vendor formats.
- Deployment scripts must default to dry-run, require explicit paths, revalidate exact targets, use recoverable moves, verify hashes, and never control DSH processes or edit unrelated settings.
- Keep the Grok Build reference clone outside this repository. Record only its reviewed repository, commit, and package version in provenance and component locks.
- Do not bypass repository safety scans, Git hooks, or provider security tests.
- Keep public documentation in English and Simplified Chinese; preserve original license texts. Put both README languages in the same README.md with language anchors, not separate language files.

## 中文

- 准备开发者预览版不授权改变可见性或发布 Release；遵循 docs/PUBLIC-RELEASE.md，最终动作由所有者单独批准。不得提交或公开凭据、OAuth 授权、Cookie、认证状态、会话、聊天、数据库、日志、额度记录、主机指纹、生产证据、回滚记录、备份或真实绝对路径。
- 保留通用加密、认证防护、路由限制、权限校验、失败关闭行为及合成安全测试。
- provider 实时认证目录是唯一模型资格来源；型号或 effort 未知、过期、冲突或不支持时拒绝，不回退。
- SuperGrok OAuth provider 不读取 `XAI_API_KEY`。测试和 CI 清除 provider 密钥，不执行真实模型、OAuth、目录、代理出口或付费网络调用。
- 测试使用临时目录、模拟服务、合成目录及不符合真实厂商格式的凭据值。
- 安装默认 dry-run；显式提供路径、复核目标、使用可恢复移动并校验哈希，不管理 DSH 进程或改动无关设置。
- Grok Build 参考克隆留在仓库外；来源及组件锁只记录已审核的仓库、提交和版本。
- 不绕过安全扫描、Git hooks 或 provider 安全测试。公开文档保持中英双语，许可证保留原文。README 的两种语言放在同一 README.md 中，以锚点跳转，不拆分语言文件。
