# Security policy / 安全政策

## English

Security maintenance covers the README combination: provider `0.9.0-hardened.1`,
preset `1.1.0` and official DSH `0.2.0-rc.2`. Older previews and other combinations
are not maintained by this preview. Responses are best-effort, without a fixed deadline.

Report vulnerabilities privately through [Report a vulnerability](https://github.com/Kaizin0226/dsh-supergrok/security/advisories/new).
GitHub login is required. If unavailable, request private contact without
disclosing vulnerability details. Supply versions, impact and a minimal synthetic
reproduction; do not post credentials, account data, real logs or chats.

Credentials, grant/cookie/encryption material, production settings, sessions,
databases, logs, usage records, host information, absolute machine paths, backups
and operational records are excluded from Git, packages and public documentation.
Run `npm run safety` and `npm run history-safety` before every commit.
Resolve findings before committing; never suppress scans or bypass hooks.
Current [dependency review](docs/DEPENDENCY-REVIEW.md) is separate from service authorization.

## 中文

维护 README 中 provider `0.9.0-hardened.1`、预设 `1.1.0` 与官方 DSH `0.2.0-rc.2` 组合，
不维护旧预览或其他组合；尽力响应，不承诺固定期限。

通过上述 GitHub 私密入口报告漏洞，需要登录。入口不可用时可请求私密联系方式，
不披露漏洞细节。提供版本、影响和最小合成复现，不发送凭据、账户资料、真实日志或聊天。

凭据、授权／Cookie／加密材料、生产配置、会话、数据库、日志、额度记录、
主机资料、本机绝对路径、备份和操作记录均不得进入 Git、包或公开文档。
每次提交前运行源码与历史扫描；先解决发现，再提交，不屏蔽扫描或绕过 hooks。
依赖核查与服务授权独立。
