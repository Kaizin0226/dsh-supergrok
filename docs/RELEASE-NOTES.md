# suite-v0.9.0-preview.1

## English

This preview delivers two native plugins on official DSH `0.2.0-rc.2`
(`639ed015397290b3745d163aafe02ffee4aa3f84`):
SuperGrok provider `0.9.0-hardened.1` and Grok preset `1.1.0`.
Protocol and behavior references are separately recorded against Grok Build
`1.0.45` (`2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8`).

Native prepared calls, tool/error messages, attachment projections, Config forms
and browser interfaces replace the old integration paths. Required loopback proxy,
live catalog, quota caching, cancellation and complete request budgeting remain.
HTTP 426 terminates without negotiation or resend. Grok mode changes identity,
presentation and persona only; standard remains default.

The patched 0.1 core, work-state summary, image history/recall extensions,
`grokRequestBoundary`, `grok-oauth/before-model-request` and their dedicated tooling
have been removed. Patched-host image preparation notice persistence is no longer
promised. Native features are not asserted to replace every retired behavior.
The [fixed 0.8 tag](https://github.com/Kaizin0226/dsh-supergrok/tree/suite-v0.8.0-preview.1)
retains old source, patches, installers and the xAI contract; old tags are unchanged.

Windows and Node.js 24 are required. Install in a separate runtime and new home;
no automatic 0.1 data migration or data-format rollback. Source and local packaging
only, with no npm publication or precompiled downloads.
See [installation](INSTALLATION.md), [validation](VALIDATION.md),
[dependencies](DEPENDENCY-REVIEW.md) and [service access](SERVICE-ACCESS.md).
Real OAuth and live inference remain unverified. This is an unofficial integration.

## 中文

本预览版使用官方 DSH `0.2.0-rc.2`（`639ed015397290b3745d163aafe02ffee4aa3f84`），
交付 provider `0.9.0-hardened.1` 和 Grok 预设 `1.1.0` 两个原生插件。
协议及行为来源分别记录于 Grok Build `1.0.45`
（`2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8`）。

适配原生 prepared-call、工具／错误消息、附件投影、Config 表单和浏览器接口，
保留必填 loopback 代理、实时目录、额度缓存、取消及完整请求预算。
HTTP 426 终止，不自动协商或重发。Grok 模式只改变标识、展示及 persona，默认仍为 standard。

移除旧 0.1 核心补丁、工作状态摘要、图片历史／召回扩展、
`grokRequestBoundary`、`grok-oauth/before-model-request` 和专用工具；
不再承诺补丁 host 图片准备提示持久化，不宣称原生功能完整替代所有退役行为。
固定旧标签保留源码、补丁、安装器和 xAI 合约，不移动旧标签。

支持 Windows 和 Node.js 24，须使用独立运行目录及新 home；
不自动迁移 0.1 数据或回滚数据格式。提供源码和本地打包，不发布 npm 或预编译下载。
安装、验证、依赖和服务说明见以上链接；未完成真实 OAuth 或线上推理验收，
定位为非官方实验性集成。
