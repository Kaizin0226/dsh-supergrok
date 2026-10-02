# Contributing / 贡献指南

## English

Contributions cover the SuperGrok provider, Grok-optimized preset and their native
packaging, installation and synthetic verification. Start from current main;
hardened/main mirrors the same release line. Do not merge old private histories.

Use Windows and Node.js 24. Follow [installation](docs/INSTALLATION.md), run
`npm ci --ignore-scripts` and `npm run verify`. Provider/preset/installation changes
also require clean packaging and relevant installed acceptance.
Tests must use synthetic data, remove real credentials and avoid live service calls.
`derive-grok-preset.mjs --check` is read-only; regenerate only during an intentional
source change and review the result. `build-suite.mjs --update-locks` requires
dependency review and new installation validation.

Keep changes focused; explain observable behavior and completed checks.
Documents are bilingual, with both README languages in one file. Public commits,
PRs and releases must be self-contained and formal, without drafting/progress
placeholders. Preserve authors and licenses; original work uses MIT, applicable
derivatives retain Apache-2.0. Use your own GitHub noreply address if desired.
Issues should contain versions, a concise error and synthetic reproduction;
vulnerabilities use [private reporting](SECURITY.md), not public issues.
Maintenance is best-effort; untested combinations are not supported.

## 中文

贡献范围为 SuperGrok provider、Grok 优化预设，以及原生打包、安装和合成验证。
从当前 main 开始，hardened/main 镜像同一发行线，不合并旧私有历史。

使用 Windows 和 Node.js 24，按安装指南执行 verify；provider、预设或安装改动
须重新干净打包并完成相关组合验收。只用合成数据，清除真实凭据，不调用线上服务。
派生脚本 `--check` 为只读；仅在有意修改源码时生成并审阅结果。
构建 `--update-locks` 须核查依赖并重做安装验证。

变更保持聚焦，说明可观察行为和已完成检查。文档中英双语，README 同页。
公开提交、PR 和 Release 须正式、自足，不含起草或进度占位。
保留作者与许可，自有新增 MIT，适用衍生材料保留 Apache-2.0。
可使用自己的 GitHub noreply 邮箱。Issue 只提供版本、简短错误和合成复现；
漏洞私密报告，不附凭据、真实日志、账户截图或聊天。
维护尽力而为，不承诺未经验证组合。
