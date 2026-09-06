# Security policy / 安全政策

The repository stores generic hardened provider and deployment code, not production security material.

Never commit API keys, OAuth access or refresh tokens, cookies, grant records, DPAPI material, Bearer headers, real settings, sessions, chat content, databases, logs, crash dumps, usage details, local hashes or security baselines, acceptance evidence, proxy/IP evidence, rollback records, production backups, usernames, device information, or real absolute paths.

Run `npm run safety` and `npm run history-safety` before every commit. A finding blocks the commit; do not suppress it, bypass the hook, or commit first and remove it later.

Security reports must be handled privately by the repository owner and must not include credentials or production evidence in an issue.

## Reporting and supported versions

Security maintenance covers provider `0.7.0-hardened.1`, preset `0.8.0` and the
DSH `0.1.2-rc.1.grok.2` combination in the README. Older releases and other
combinations are not maintained by this preview. Responses are best-effort,
without a response-time commitment.

After public release, use [Report a vulnerability](https://github.com/Kaizin0226/dsh-supergrok/security/advisories/new).
Administrators must enable private vulnerability reporting when making the
repository public and verify this link before announcing the release. The
channel is not yet claimed to be active while the repository is private.
Until available, use an existing private conversation with the owner. If you
have none, open an issue requesting private contact **without vulnerability
details**. Never disclose vulnerabilities in public issues.

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

安全维护范围为 README 中的 provider `0.7.0-hardened.1`、preset `0.8.0` 和 DSH
`0.1.2-rc.1.grok.2` 组合；本预览版不维护旧版或其他组合。反馈采取尽力而为原则，不承诺响应时间。

公开后使用 [Report a vulnerability／私密漏洞报告](https://github.com/Kaizin0226/dsh-supergrok/security/advisories/new)。
管理员须在公开时启用功能，并在宣布发布前验证入口；仓库仍私有时不宣称该入口已启用。
启用前使用与所有者已有的私密沟通渠道；若没有，可在 Issue 仅请求私密联系方式，
**不要披露漏洞细节**。漏洞不得发到公开 Issue。

请提供受影响版本、预期与实际行为、影响和最小合成复现，不发送生产日志或账户数据。
保留上游身份；维护者使用文档指定的 GitHub noreply 邮箱。依赖扫描无已知漏洞不代表服务已授权。
