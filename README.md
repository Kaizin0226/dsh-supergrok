# dsh-supergrok

[English](#english) | [简体中文](#简体中文)

## English

**SuperGrok account access and an engineering-focused Grok preset for DeepSeek Harness (DSH).**

Two native plugins provide account-based model access and task-oriented instructions,
while DSH owns sessions, permissions, tools and the agent loop.

**Developer preview · Windows · Node.js 24 · Unofficial experimental integration**

### Features

| Component | Function |
| --- | --- |
| SuperGrok provider | Authorize your own account through DSH, without a separate xAI API key. |
| Live model selection | Select models and reasoning efforts from the authenticated catalog. Unknown, stale or conflicting routes are rejected without substituting a model. |
| Account quota | Read-only quota, cache freshness and explicit refresh. |
| Native messages and images | Preserve tool-call IDs, errors, text and images in prepared calls. Use DSH attachment projections; offloaded images become text placeholders without reading their bytes. |
| Request controls | One explicit local proxy for OAuth, catalog, quota and inference; check the complete serialized request against a default 40,000,000-byte local budget before sending inference. |
| Grok-optimized preset | Rules for understanding intent, respecting authorization, continuing work, selecting appropriate tools, reviewing delegated results and verifying completion. |

Image availability depends on the live account catalog. The image envelope is a
compatibility policy, not a guarantee that every model supports images.

### What Grok mode changes

For the **same model, provider and reasoning effort**, the main difference from
official standard is persona and display identity. Remaining plugin configuration
is derived unchanged from the fixed official standard.

| Area | Official standard | Grok-optimized |
| --- | --- | --- |
| Persona | Official coding-agent instructions | [Engineering-task rules](presets/grok-optimized/persona-prefix.md) |
| Native tools, Skills, Plan, Goals and child agents | Official DSH composition | Same configuration |
| Model, provider, effort and permissions | Session and DSH settings | Unchanged |
| Provider catalog, quota, images and request budget | Available with this provider | Same capabilities |

The global default remains `standard`. Child agents use native inheritance and
explicitly enabled model selection. The preset does not guarantee greater accuracy,
speed or lower cost. Grok Build is a source reference, not another running agent.

### Compatibility and installation

| Component | This preview |
| --- | --- |
| Official DSH | `0.2.0-rc.2`, source `639ed015397290b3745d163aafe02ffee4aa3f84` |
| Provider | `dsh-llm-grok-oauth@0.9.0-hardened.1` |
| Preset | `grok-optimized-preset@1.1.0` |
| Grok Build protocol / behavior references | `1.0.45`, separately recorded at `2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8` |
| Installation | Windows, Node.js 24, pnpm 11.28.3 |
| Release | `suite-v0.9.0-preview.1` |

1. Follow the [installation guide](docs/INSTALLATION.md#english) to pack both plugins
   and install a locked official runtime in a separate directory.
2. Explicitly choose a **new `DSH_HOME`**, profile and local proxy. The helper defaults
   to dry-run and uses official `dsh plugin`.
3. Read the [service requirements](docs/SERVICE-ACCESS.md), start DSH yourself and
   complete your own account authorization.
4. Select an account model and effort; select `grok-optimized` for its task rules.

`proxyUrl` is required. Only unauthenticated HTTP proxies on numeric `127.0.0.1`
or `[::1]` are supported. All provider requests share one dispatcher, without
system-proxy lookup or direct fallback. Reload the provider after changing it.
Protocol headers are fixed separately from plugin version; HTTP 426 is terminal,
without automatic version negotiation or resend.

This preview provides source and local packaging tools, with no npm publication
or precompiled downloads. It requires a separate runtime and new home. There is
no automatic 0.1 data migration. Rollback restores managed files and configuration,
**not session-data formats**.

### Validation and compatibility boundary

[Validation](docs/VALIDATION.md) covers synthetic tests, deterministic derivation,
clean native installation and actual Web/headless loading. **Real OAuth, account
entitlements, live text/image inference and model-quality comparisons have not
been accepted** for this public combination. Historical local results do not count.
SDK claims are limited to the native prepared-call service tests listed there.

The old work-state summary, image history/recall extensions, `grokRequestBoundary`,
request-check event and patched-host preparation-notice persistence are retired.
Native features are not claimed to replace every retired behavior.
The fixed [0.8 preview tag](https://github.com/Kaizin0226/dsh-supergrok/tree/suite-v0.8.0-preview.1)
retains the old implementation, installers, patches and xAI contract.
See [release notes](docs/RELEASE-NOTES.md).

### Sources and maintenance

Original MIT notices are retained; adapted Grok Build material retains Apache-2.0
terms and attribution in both packages. See [provenance](UPSTREAM-PROVENANCE.md)
and [third-party notices](THIRD-PARTY-NOTICES.md). Source licenses, protocol
compatibility and successful login do not authorize third-party subscription access.
This project is not endorsed by DeepSeek or SpaceXAI.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) ·
[Dependencies](docs/DEPENDENCY-REVIEW.md) · [Release policy](docs/PUBLIC-RELEASE.md)

## 简体中文

**为 DeepSeek Harness（DSH）提供 SuperGrok 账户接入和面向工程任务的 Grok 优化预设。**

两个原生插件分别提供账户模型接入和任务执行规则；
DSH 负责会话、权限、工具及 Agent 循环。

**开发者预览版 · Windows · Node.js 24 · 非官方实验性集成**

### 功能

| 组件 | 功能 |
| --- | --- |
| SuperGrok provider | 在 DSH 中授权自己的账户，不使用独立 xAI API key。 |
| 实时模型选择 | 模型与推理档位来自已认证目录；未知、过期或冲突的路由被拒绝，不自行替换模型。 |
| 账户额度 | 展示只读额度与缓存新鲜度，支持缓存及显式刷新。 |
| 原生消息与图片 | prepared-call 保留工具调用 ID、错误、文字及图片；使用 DSH 附件投影；已卸载图片以文本占位，不读取其字节。 |
| 请求控制 | OAuth、目录、额度及推理共用显式本地代理；推理发送前检查完整请求，默认本地预算为 40,000,000 字节。 |
| Grok 优化预设 | 明确理解意图、遵守授权、持续执行、选择合适工具、审阅委派结果和验证完成的规则。 |

图片可用性以账户实时目录为准。图片范围属于兼容策略，不保证所有模型均支持图片。

### Grok 模式的差异

在**模型、provider 和推理档位相同**时，与官方 standard 的主要差异为 persona
和展示标识；其余插件配置从固定官方 standard 原样派生。

| 项目 | 官方 standard | Grok 优化模式 |
| --- | --- | --- |
| Persona | 官方编码 Agent 指令 | [工程任务规则](presets/grok-optimized/persona-prefix.md) |
| 原生工具、Skills、Plan、Goals 与子 Agent | 官方 DSH 组合 | 相同配置 |
| 模型、provider、effort 与权限 | 会话和 DSH 设置 | 不改变 |
| provider 目录、额度、图片及请求预算 | 选择本 provider 时可用 | 相同能力 |

全局默认仍为 `standard`。子 Agent 沿用原生继承和显式开放的模型选择。
预设不保证更高准确率、更快速度或更低费用。Grok Build 仅为来源参考，不作为另一套 Agent 运行。

### 兼容与安装

| 组件 | 本预览版 |
| --- | --- |
| 官方 DSH | `0.2.0-rc.2`，源码 `639ed015397290b3745d163aafe02ffee4aa3f84` |
| Provider | `dsh-llm-grok-oauth@0.9.0-hardened.1` |
| 预设 | `grok-optimized-preset@1.1.0` |
| Grok Build 协议／行为参考 | `1.0.45`，分别记录于 `2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8` |
| 安装 | Windows、Node.js 24、pnpm 11.28.3 |
| 发行标签 | `suite-v0.9.0-preview.1` |

1. 按[安装指南](docs/INSTALLATION.md#中文)打包插件，在独立目录安装锁定官方运行环境。
2. 显式指定**新 `DSH_HOME`**、profile 和代理；辅助入口默认 dry-run，使用官方 `dsh plugin`。
3. 阅读[服务要求](docs/SERVICE-ACCESS.md)，自行启动 DSH 并完成账户授权。
4. 选择账户模型及 effort；需要工程任务规则时选择 `grok-optimized`。

`proxyUrl` 必填，仅支持数值地址 `127.0.0.1` 或 `[::1]` 上的无认证 HTTP 代理。
provider 请求共用 dispatcher，不读取系统代理或直连回退；改变代理后须重新加载。
协议请求头与插件版本分别固定；HTTP 426 终止，不自动协商或重发。

交付源码和本地打包工具，不发布 npm 或预编译下载。使用独立运行目录及新 home，
不自动迁移 0.1 数据。回滚恢复受管理文件与配置，**不回滚会话数据格式**。

### 验证与兼容分界

[验证](docs/VALIDATION.md)涵盖合成测试、确定性派生、干净安装及实际 Web／headless 加载。
本次公开组合**未完成真实 OAuth、账户资格、线上文字／图片推理或模型质量对比验收**。
历史本机结果不计入；SDK 仅声明该文档列出的原生 prepared-call 服务专项。

旧工作状态摘要、图片历史／召回扩展、`grokRequestBoundary`、请求检查事件及补丁
host 的图片准备提示持久化已退出，不宣称原生功能完整替代所有退役行为。
固定[0.8 预览标签](https://github.com/Kaizin0226/dsh-supergrok/tree/suite-v0.8.0-preview.1)
保留旧实现、安装器、补丁和 xAI 合约，参见[发行说明](docs/RELEASE-NOTES.md)。

### 来源与维护

保留原 MIT 声明；Grok Build 衍生内容在两个包内保留 Apache-2.0 条款与署名。
参见[来源](UPSTREAM-PROVENANCE.md)和[第三方说明](THIRD-PARTY-NOTICES.md)。
源码许可、协议兼容或登录成功不能替代第三方订阅服务授权。
本项目未获 DeepSeek 或 SpaceXAI 官方背书。

[贡献指南](CONTRIBUTING.md) · [安全报告](SECURITY.md) ·
[依赖核查](docs/DEPENDENCY-REVIEW.md) · [发行规则](docs/PUBLIC-RELEASE.md)
