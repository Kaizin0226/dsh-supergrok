# dsh-supergrok

[English](#english) | [简体中文](#简体中文)

## English

**SuperGrok subscription access and a Grok-focused engineering workflow for DeepSeek Harness (DSH).**

dsh-supergrok connects your SuperGrok account to DSH through OAuth and adds a
Grok-optimized mode for code investigation, implementation and multi-step work.
It combines account-based model selection, image recall and current task context
with DSH's native tools, permissions, sessions and child agents.

**Developer preview · Windows + Node.js 24 · Unofficial experimental integration**

### Core features

| Feature | What it provides |
| --- | --- |
| SuperGrok in DSH | Sign in with your own account inside DSH, without a separate xAI API key. Select models and reasoning options from the account's live catalog. |
| Grok-optimized mode | An engineering-oriented preset with explicit rules for understanding intent, executing authorized work, checking evidence and communicating results. |
| Images across a conversation | Prepare image attachments for supported models and explicitly recall authorized historical images in later turns. Preparation notices remain available in session history. |
| Current work-state context | Supply Grok mode with current todos, active background jobs and continuable child-agent work from DSH's native state. |
| Quota and request controls | View read-only account quota and cache freshness. Check cancellation, extension policy and complete request size before inference is sent. |

Model and image availability depend on the authenticated account catalog.
Implemented capabilities and completed validation are distinguished below.

### What Grok-optimized mode changes

The preset retains DSH standard's native tool composition and adds task-oriented
instructions plus current work-state context. Its rules call for the agent to:

- Match the user's intent: investigate or explain when asked, and carry explicitly
  authorized implementation work through appropriate verification.
- Use observable evidence for completion claims, distinguish findings from
  inference, and diagnose failures before repeating an operation.
- Track long-running work through native task handles and coordinate native
  child agents while retaining responsibility for the final result.
- Communicate conclusions clearly, preserve user constraints, and check
  changeable facts before relying on historical memory.

These are [preset behavior requirements](presets/grok-optimized/persona-prefix.md),
not measured improvements in accuracy or task success. DSH continues to enforce
permissions and operate the tools; the preset does not add another agent runtime.

The global default remains `standard`. This suite adds image recall to both
local `standard` and `grok-optimized`, with one mount per mode; work-state context
is exclusive to Grok mode. Upstream standard has neither local extension.
Child agents inherit the parent model unless native cross-model selection is
explicitly enabled and configured. No Grok model is hard-coded.

### Intended workflows

- **Investigate and implement a code change:** inspect the project with DSH's
  tools, clarify the cause, and carry out the requested change with evidence
  from relevant checks.
- **Continue work involving images:** discuss an attached screenshot or diagram,
  then recall an earlier image when it becomes relevant again.
- **Manage a multi-step task:** make current todos, active jobs and child-agent
  work available as context while continuing the task.

These examples describe supported mechanisms and intended use, rather than
live-service acceptance results.

### Get started

1. Use Windows with Node.js 24, Git and PowerShell. This preview distributes
   source and build/install tools; it has no precompiled downloads or npm release.
2. Follow the [Windows build and installation guide](deployment/windows/README.md#english)
   to build the required DSH patches and install the complete suite into a
   separate runtime directory. Installation defaults to dry-run.
3. Initialize a **new data directory** with your local HTTP proxy endpoint.
   Read the [service-access requirements](docs/SERVICE-ACCESS.md) before signing in.
4. Start DSH and complete your own SuperGrok OAuth authorization. Choose a model
   and reasoning option from the live catalog, then select `grok-optimized` when
   you want the dedicated workflow.

`proxyUrl` is required. OAuth, catalog, quota and inference use the same explicit
proxy connection, with no system-proxy lookup or direct fallback. Supported
endpoints are unauthenticated HTTP proxies on numeric `127.0.0.1` or `[::1]`;
missing or invalid configuration fails before networking. Reload the provider
after changing it. See the installation guide for complete configuration rules.

### Supported components

| Component | Version |
| --- | --- |
| DSH upstream | `0.1.5-rc.2` |
| Four source-built DSH core packages | `0.1.5-rc.2.grok.1` |
| SuperGrok provider | `0.8.0-hardened.1` |
| Grok preset | `0.9.1` |
| Image history, recall and work-state extensions | `1.2.0` each |

Use the complete combination: installing only the provider into unpatched DSH
does not supply the suite's core integration. Exact source commits, package
versions and derivation references are recorded in the [component lock](components.lock.json)
and [source provenance](UPSTREAM-PROVENANCE.md).

### Validation and limitations

- Clean builds, provider and extension regressions, preset derivation, actual
  Web/headless loading, a TypeScript SDK image-notice replay scenario, and
  recoverable installation/rollback passed using synthetic services. See
  [validation scope](docs/VALIDATION.md) and the [release notes](docs/RELEASE-NOTES.md).
- Real OAuth, live model/image inference and the production quota-panel UI have
  not been accepted for this preview. Full SDK coverage, Python SDK execution
  and macOS/Linux support are outside the validated scope.
- Use new runtime and data directories. Existing chats are not automatically
  migrated; reverting runtime files does not downgrade the session data format.
- The complete serialized inference request has a default **40,000,000-byte**
  budget. Oversized requests are rejected before sending. Image recall uses
  `{attachmentId, occurrence?}` and respects DSH's attachment authority.
  The optional [request-boundary event](docs/REQUEST-BOUNDARY.md) lets extensions
  reject a request or disable its automatic authentication replay.
- On 2026-09-13, the provider, suite build-kit and installed runtime npm audits
  reported zero known vulnerabilities. The frozen upstream build workspace
  separately reported **60 advisory records, including 29 high-severity records**.
  Review the [dependency findings and build constraints](docs/DEPENDENCY-REVIEW.md),
  including the retained pnpm 11.7.0 toolchain, before building.

This project is independent and experimental. Source licensing and successful
login do not establish authorization for a third-party OAuth client. Service
protocols and account eligibility may change; read the [service-access review](docs/SERVICE-ACCESS.md).
The preview carries no availability or production-support commitment.

### Development, licensing and support

See [contributing](CONTRIBUTING.md), [release policy](docs/PUBLIC-RELEASE.md) and
[private security reporting](SECURITY.md). Use minimal synthetic reproductions
for issues; do not share credentials, real conversations or account screenshots.
Maintenance is best-effort.

Preserve the original [MIT license](LICENSE), [NOTICE](NOTICE) and applicable
[Apache-2.0 attribution](THIRD-PARTY-NOTICES.md). Source licenses do not grant
subscription access. The [old xAI API contracts](contracts/xai-dsh/README.md)
are historical reference and are excluded from the default build/install route.

## 简体中文

**将 SuperGrok 订阅接入 DeepSeek Harness（DSH），并提供面向工程任务的 Grok 优化模式。**

dsh-supergrok 通过 OAuth 将你的 SuperGrok 账户接入 DSH，并为代码排查、功能实现和多步骤任务
提供专属 Grok 工作模式。项目将账户模型选择、历史图片召回和当前任务上下文，与 DSH 原生的工具、
权限、会话及子 Agent 协作机制结合。

**开发者预览版 · Windows + Node.js 24 · 非官方实验性集成**

### 核心功能

| 功能 | 提供的能力 |
| --- | --- |
| 在 DSH 中使用 SuperGrok | 在 DSH 内完成自己的账户授权，无需另配 xAI API key；从账户实时目录选择可用模型与推理档位。 |
| Grok 优化模式 | 提供面向工程任务的预设，明确理解意图、执行已授权工作、核实证据和说明结果的行为要求。 |
| 跨轮次图片使用 | 为支持图片的模型准备附件，并在后续对话中显式召回有权访问的历史图片；准备提示保留在会话历史中。 |
| 当前工作状态上下文 | 从 DSH 原生状态向 Grok 模式补充当前待办、活动后台任务和可继续的子 Agent 工作。 |
| 额度与请求控制 | 只读查看账户额度及缓存新鲜度；在发送推理前检查取消状态、扩展规则和完整请求大小。 |

模型与图片能力以账户认证后的实时目录为准。已实现功能与已完成验证的范围在下文分别说明。

### Grok 优化模式改变了什么

预设保留 DSH standard 的原生工具组合，加入面向任务的行为规则与当前工作状态上下文，要求 Agent：

- 匹配用户意图：解释或诊断时完成必要调查；明确要求实施时，在授权范围内持续推进并完成适当验证。
- 依据可观察证据声明完成，区分事实与推断；调用失败后先诊断原因，再决定是否重试。
- 通过原生任务句柄跟踪长时间工作，使用原生子 Agent 协作，并由父任务复核与整合最终结果。
- 结论先行、表达清楚，保留用户约束，并在依赖历史记忆前核实易变事实。

这些是[预设的行为要求](presets/grok-optimized/persona-prefix.md)，不代表已经测得准确率或任务成功率提升。
权限执行和工具运行继续由 DSH 负责；预设不引入另一套 Agent 运行时。

全局默认仍为 `standard`。本套件为本地 `standard` 和 `grok-optimized` 各挂载一次图片召回，
工作状态上下文仅用于 Grok 模式；上游 standard 不含这两项本地扩展。
子 Agent 默认继承父模型，只有显式开放并配置原生跨模型选择后才允许另选模型，不写死 Grok 型号。

### 典型用法

- **排查问题并实现改动：** 使用 DSH 工具检查项目、定位原因，并根据用户的实施要求完成改动与相关验证。
- **继续处理图片相关任务：** 讨论已上传的截图或示意图，在后续需要时再次召回先前图片。
- **推进多步骤任务：** 在持续工作时，将当前待办、活动任务和子 Agent 工作作为可用上下文。

这些示例描述支持的机制和预期用途，不作为真实服务验收结果。

### 快速开始

1. 准备 Windows、Node.js 24、Git 和 PowerShell。本预览版提供源码及构建安装工具，不提供预编译下载或 npm 发行包。
2. 按照 [Windows 构建与安装指南](deployment/windows/README.md#简体中文)构建必需的 DSH 补丁，
   将完整套件安装到独立运行目录。安装默认 dry-run。
3. 为**新的数据目录**配置实际使用的本地 HTTP 代理；登录前阅读[服务接入要求](docs/SERVICE-ACCESS.md)。
4. 启动 DSH，完成自己的 SuperGrok OAuth 授权，从实时目录选择模型和推理档位；
   需要专属工作模式时选择 `grok-optimized`。

`proxyUrl` 为必填配置。OAuth、目录、额度和推理共用同一显式代理连接，不读取系统代理、不直连回退。
支持无认证的 HTTP 代理，主机仅限数字地址 `127.0.0.1` 或 `[::1]`；未配置或配置非法时在联网前拒绝。
修改代理后需要重新加载 provider，完整配置规则见安装指南。

### 支持的组件组合

| 组件 | 版本 |
| --- | --- |
| DSH 上游 | `0.1.5-rc.2` |
| 四个源码构建的 DSH 核心补丁包 | `0.1.5-rc.2.grok.1` |
| SuperGrok provider | `0.8.0-hardened.1` |
| Grok 预设 | `0.9.1` |
| 图片历史、图片召回、工作状态扩展 | 均为 `1.2.0` |

请使用完整组合：仅在未打补丁的原版 DSH 中安装 provider，无法获得本套件的核心集成功能。
精确源码提交、包版本及派生来源见[组件锁](components.lock.json)和[源码来源](UPSTREAM-PROVENANCE.md)。

### 验证与已知限制

- 已使用合成服务完成干净构建、provider 与扩展回归、预设派生、实际 Web/headless 加载、
  TypeScript SDK 图片准备提示回放专项，以及可恢复安装和回滚。详见[验证范围](docs/VALIDATION.md)
  与[发行说明](docs/RELEASE-NOTES.md)。
- 本预览版尚未验收真实 OAuth、模型与图片推理，以及生产额度面板；完整 SDK、Python SDK 执行和
  macOS／Linux 不属于已验证范围。
- 使用新的运行和数据目录，不自动迁移旧聊天；恢复旧运行文件不等于降级会话数据格式。
- 完整序列化推理请求的默认预算为 **40,000,000 字节**，超限在发送前拒绝。
  图片召回输入为 `{attachmentId, occurrence?}`，遵守 DSH 的附件权限规则。
  可选的[请求检查事件](docs/REQUEST-BOUNDARY.md)允许扩展拒绝请求或禁止其自动认证重试。
- 2026-09-13 的 provider、配套构建工具和安装运行环境 npm 检查均为零已知漏洞；
  上游冻结构建工作区另有 **60 条告警记录，其中 29 条高危**。构建前请阅读
  [依赖检查与构建约束](docs/DEPENDENCY-REVIEW.md)，包括保留的 pnpm 11.7.0 工具链问题。

本项目为独立实验性集成。源码许可和登录成功均不构成第三方 OAuth 客户端已获授权的证明；
服务协议与账户资格可能变化，详见[服务接入说明](docs/SERVICE-ACCESS.md)。
预览版不承诺持续可用或生产支持。

### 开发、许可与反馈

请参阅[贡献指南](CONTRIBUTING.md)、[发行规范](docs/PUBLIC-RELEASE.md)和[私密安全反馈](SECURITY.md)。
Issue 只提供最小合成复现，不分享凭据、真实对话或账户截图；维护采取尽力而为原则。

保留原 [MIT 许可证](LICENSE)、[NOTICE](NOTICE)和适用的 [Apache-2.0 署名](THIRD-PARTY-NOTICES.md)。
源码许可不授予订阅访问权限。[旧 xAI API 合约](contracts/xai-dsh/README.md)仅作历史参考，
不进入默认构建与安装流程。
