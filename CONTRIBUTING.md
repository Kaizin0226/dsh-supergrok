# Contributing / 贡献指南

## English

This is a developer preview for Windows and Node.js 24. Start from a fresh clone
of `main`; do not merge commits from an older, rewritten-history checkout.
`hardened/main` is a compatibility mirror, not a separate feature line. Keep
patches focused and describe observable behavior and relevant verification in
the PR. No CLA is required; preserve attribution, use MIT for original work and
retain Apache-2.0 terms for applicable derivatives.

Follow the [build/install guide](deployment/windows/README.md). Run
`npm ci --ignore-scripts` and `npm run verify`. For core, preset, extension or
installer changes, also build the pinned DSH source and suite and run installed
composition tests. Remove real credentials from tests, use synthetic fixtures
and never add live-service calls to CI. Use your own GitHub noreply address if
you do not want a personal email in public commit history.

Maintain English and Simplified Chinese documentation with matching commands,
versions and limitations. Keep both README languages in one README.md with
language anchors. Preserve original license texts. Update provenance
and locks when their inputs change; do not suppress mismatches. Use issues for
minimal synthetic reproductions and focused feature proposals, without real
logs, settings, conversations or account screenshots. Follow [SECURITY.md](SECURITY.md)
for vulnerabilities. Discuss large features before investing in a large patch.
Maintenance is best-effort; untested combinations are not supported.

## 中文

这是面向 Windows 与 Node.js 24 的开发者预览版。从 `main` 全新克隆，不合并历史改写前的旧提交。
`hardened/main` 是兼容镜像，不是另一条功能开发线。保持补丁聚焦，在 PR 中说明可观察行为及相关验证。
不要求 CLA；保留署名，原创采用 MIT，适用衍生内容继续遵守 Apache-2.0。

遵循[构建安装指南](deployment/windows/README.md)，运行 `npm ci --ignore-scripts` 和 `npm run verify`。
改动核心、预设、扩展或安装工具时，还需构建固定 DSH 源码及配套组合，并运行安装组合测试。
测试清除真实凭据并使用合成数据，不在 CI 调用真实服务。若不想公开个人邮箱，
请为自己的提交使用自己的 GitHub noreply 邮箱。

文档保持中英双语，命令、版本和限制相互对应；README 两种语言放在同一 README.md 中，以锚点跳转，许可证保留原文。
来源与锁定输入变化时同步更新声明，不屏蔽不一致。Issue 仅提供最小合成复现或聚焦功能建议，
不附真实日志、设置、聊天或账户截图。漏洞按 [SECURITY.md](SECURITY.md) 私密反馈。
大功能先讨论再投入；维护尽力而为，不承诺未经验证组合的支持。
