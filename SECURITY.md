# Security policy / 安全政策

The repository stores generic hardened provider and deployment code, not production security material.

Never commit API keys, OAuth access or refresh tokens, cookies, grant records, DPAPI material, Bearer headers, real settings, sessions, chat content, databases, logs, crash dumps, usage details, local hashes or security baselines, acceptance evidence, proxy/IP evidence, rollback records, production backups, usernames, device information, or real absolute paths.

Run `npm run safety` and `npm run history-safety` before every commit. A finding blocks the commit; do not suppress it, bypass the hook, or commit first and remove it later.

Security reports must be handled privately by the repository owner and must not include credentials or production evidence in an issue.

## Reporting and supported versions

Security maintenance covers provider `0.8.0-hardened.1`, preset `0.9.1` and the
DSH `0.1.5-rc.2.grok.3` combination in the README. Older releases and other
combinations are not maintained by this preview. Responses are best-effort,
without a response-time commitment.

The suite's test tooling now pins Vitest `4.1.11`, fixing
[GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp).
The initial `suite-v0.7.0-preview.1` source used affected Vitest `4.0.18` for
extension development. Use the corrected preview for development; do not enable
Vitest UI, Browser Mode or a network-exposed API on the initial preview.
The documented test commands use run mode and the installed runtime excludes Vitest.
The frozen upstream source workspace has additional known dependency advisories,
including pnpm 11.7.0. See the [dependency review](docs/DEPENDENCY-REVIEW.md) for
versions, affected scope and build constraints.

Submit vulnerabilities through [Report a vulnerability](https://github.com/Kaizin0226/dsh-supergrok/security/advisories/new).
Private reporting is enabled and requires a GitHub login. Do not disclose
vulnerability details in public issues. If the reporting channel is unavailable,
request private contact without including vulnerability details.

Provide affected versions, expected/actual behavior, impact and a minimal
synthetic reproduction. Do not send production logs or account data. Preserve
upstream identities; maintainer commits use the documented GitHub noreply
address. A clean dependency audit does not establish service authorization.

## 中文

仓库仅保存通用加固 provider 和部署源码，不保存生产安全资料。
不得提交 API key、OAuth access/refresh token、Cookie、授权记录、DPAPI 材料、Bearer 头、
真实设置、会话、聊天、数据库、日志、崩溃转储、实际额度、本机哈希与安全基线、验收证据、
代理或 IP 证据、回滚记录、生产备份、用户名、设备信息或真实绝对路径。

每次提交前运行 `npm run safety` 和 `npm run history-safety`。扫描发现问题即阻止提交，
须先修复原因，不屏蔽或绕过检查，也不先提交后删除。安全报告由所有者私密处理，
Issue 不得包含凭据或生产证据。

安全维护范围为 README 中的 provider `0.8.0-hardened.1`、preset `0.9.1` 和 DSH
`0.1.5-rc.2.grok.3` 组合；本预览版不维护旧版或其他组合。反馈采取尽力而为原则，不承诺响应时间。

配套测试工具现固定为 Vitest `4.1.11`，已修复
[GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)。
首个 `suite-v0.7.0-preview.1` 源码的扩展开发依赖使用了受影响的 Vitest `4.0.18`。
开发时请使用修正后的预览版；不要在首版上启用 Vitest UI、Browser Mode 或向网络开放 API。
文档中的测试命令使用 run 模式，安装后的运行环境不包含 Vitest。
上游冻结源码工作区另有已知依赖告警，包括 pnpm 11.7.0；版本、影响范围和构建约束见
[依赖检查](docs/DEPENDENCY-REVIEW.md)。

通过 [Report a vulnerability／私密漏洞报告](https://github.com/Kaizin0226/dsh-supergrok/security/advisories/new)提交漏洞。
私密报告功能已启用，需要登录 GitHub。不得在公开 Issue 中披露漏洞细节。
若报告入口不可用，可请求私密联系方式，但不要附带漏洞详情。

请提供受影响版本、预期与实际行为、影响和最小合成复现，不发送生产日志或账户数据。
保留上游身份；维护者使用文档指定的 GitHub noreply 邮箱。依赖扫描无已知漏洞不代表服务已授权。
