# suite-v0.7.0-preview.1 / 开发者预览版

## English

First source-only developer preview of SuperGrok integration and the native
Grok-optimized mode for DSH. This document is release-note source; it does not
mean a tag or public release has already been published.

| Component | Version |
| --- | --- |
| Provider | `0.7.0-hardened.1` |
| Grok preset | `0.8.0` |
| DSH core overlay | `0.1.2-rc.1.grok.2` |
| Attachment history, recall and work-state extensions | `1.1.0` each |

Build on Windows with Node.js 24 using the [installation guide](../deployment/windows/README.md).
This preview supplies source, locked builds and default-dry-run installation
tools, without precompiled assets or npm publication. Features include explicit
loopback HTTP proxy configuration, live model catalog, read-only usage display,
image preparation and full request budgets, and DSH-native work-state and recall.
Global default remains standard; child agents inherit their model by default.

The baseline has 796 passing tests plus installed web/headless, deployment and
rollback checks. Use CI for the exact release target as the final build result.
Tests use synthetic inputs without real OAuth or inference. Production loading,
real images and quota-panel visual acceptance remain separate.

This is an unofficial experimental integration. Read [service limitations](SERVICE-ACCESS.md)
and the [security policy](../SECURITY.md). Only the documented Windows combination
is supported. Existing data migration, macOS/Linux and current Bridge trust
compatibility are not claimed. No availability or maintenance-response guarantee
is made. Preserve all applicable license notices when redistributing.

## 中文

这是 SuperGrok 接入与 DSH 原生 Grok 优化模式的首个源码开发者预览版。
本文件是 Release 说明源稿，不表示标签或公开发行已经发布。

组件版本：provider `0.7.0-hardened.1`、Grok preset `0.8.0`、DSH 核心补丁组合
`0.1.2-rc.1.grok.2`；历史图片、图片召回和工作状态扩展均为 `1.1.0`。

在 Windows＋Node.js 24 上按[安装指南](../deployment/windows/README.md)构建。
预览版提供源码、锁定构建和默认 dry-run 安装工具，不附预编译包、不发布 npm。
功能包括显式 loopback HTTP 代理、实时模型目录、只读额度、图片准备、完整请求预算，
以及 DSH 原生工作状态和图片召回。全局默认保持 standard，子 Agent 默认继承模型。

基线已有 796 项测试通过，另有安装后的 web/headless、部署及回滚检查。
最终构建结论以 Release 精确目标提交的 CI 为准。测试使用合成输入，不执行真实 OAuth 或推理。
生产加载、真实图片与额度面板视觉验收仍是独立事项。

本项目为非官方实验性集成，请阅读[服务限制](SERVICE-ACCESS.md)及[安全政策](../SECURITY.md)。
仅支持文档中的 Windows 组合；不宣称支持既有数据迁移、macOS／Linux 或现有 Bridge 信任配置。
不承诺持续可用或维护响应时间。再分发时保留全部适用许可与署名。
