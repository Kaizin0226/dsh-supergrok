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

For the **same Grok model, provider and reasoning effort**, switching from this
suite's local `standard` to `grok-optimized` changes the persona instructions and
adds current work-state context. All other capability configuration remains equal.
The mode is intended for engineering work that benefits from explicit execution
discipline and a current summary of unfinished work.

| Area | Local `standard` | `grok-optimized` |
| --- | --- | --- |
| Behavior instructions | Standard coding-agent persona | Dedicated engineering rules described below |
| Current work-state summary | No suite work-state context extension | Adds `dsh-grok-work-state-context` |
| Native tools, Skills, Plan, Goals and child agents | Available through the DSH composition | Same capability configuration |
| Image input/preparation and historical recall | Shared suite support | Same support; not exclusive to Grok mode |
| SuperGrok catalog, quota and request budget | Shared provider support | Same provider support |

The [persona rules](presets/grok-optimized/persona-prefix.md) explicitly require:

- **Intent and authorization:** distinguish explanation, diagnosis and implementation;
  carry authorized changes through verification without expanding the user's scope.
- **Tools and evidence:** prefer available specialized tools, diagnose failures
  before retrying, and claim to inspect attachments only when DSH has delivered
  them to a route that supports their modality. Verify completion with evidence
  and recheck changeable facts instead of treating historical memory as current.
- **Long tasks and delegation:** retain real background handles, use bounded waits,
  and have the parent agent review and reconcile child-agent results.
- **Interaction and communication:** verify actual UI interactions when browser
  tools are available, check desktop/mobile layouts when affected, disclose
  missing checks, and provide a self-contained final answer in the requested style.

The work-state extension assembles a fresh summary of the current session's
unfinished todos, its running or stopping jobs, and directly owned, active
continuable child agents. The complete contribution is capped at **4096 UTF-8
bytes** and is empty when no active work exists. It provides current task context
for long-running work and continuation after context compaction; it is not a new
long-term memory system and does not recover unavailable historical state.

The preset does not increase the underlying model's intelligence or bind a Grok
version. There is no A/B-validated claim of higher accuracy or task success,
greater speed, or lower cost. DSH continues to enforce permissions and operate
the tools; behavior instructions do not guarantee model compliance.

The global default remains `standard`. This suite adds image recall to both
local `standard` and `grok-optimized`, with one mount per mode; work-state context
is exclusive to Grok mode. Upstream standard has neither local extension.
Child agents inherit the parent model unless native cross-model selection is
explicitly enabled and configured. No Grok model is hard-coded.

#### Grok Build design references

The design draws on Grok Build's task discipline, restoration of working context
after compaction, and image-pipeline ideas, adapted to DSH. DSH owns the control
plane, sessions, permissions and tool loop throughout. The suite does not run
Grok Build or an ACP worker, or adopt Grok Build's identity or tool schemas.

The [source provenance](presets/grok-optimized/SOURCE-PROVENANCE.md) and
[reference lock](presets/grok-optimized/reference-lock.json) separate the behavior
and image-design review at `37949780c144e37df692e3d669051a21fec24f20` from the
unchanged protocol reference at `bc7f02eddd3d84085849dc19ed216f11c23b0571`.
A design-reference update does not establish validation of a newer protocol or
live service. Applicable licenses and attribution are retained.

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

在使用**同一 Grok 模型、同一 provider 和推理档位**时，从本套件的本地 `standard` 切换到
`grok-optimized`，实际改变的是 persona 行为规则，并增加当前工作状态上下文；其余能力配置保持一致。
该模式面向需要明确执行纪律、持续掌握未完成工作的工程任务。

| 对比项 | 本地 `standard` | `grok-optimized` |
| --- | --- | --- |
| 行为指令 | standard 编程 Agent persona | 下述专属工程任务规则 |
| 当前工作状态摘要 | 不含套件的工作状态上下文扩展 | 增加 `dsh-grok-work-state-context` |
| 原生工具、Skills、Plan、Goals 和子 Agent | 由 DSH 组合提供 | 能力配置相同 |
| 图片输入／准备与历史召回 | 套件共享支持 | 同样支持，不属于 Grok 模式独享 |
| SuperGrok 目录、额度和请求预算 | provider 共享支持 | 使用相同 provider 能力 |

[Persona 规则](presets/grok-optimized/persona-prefix.md)显式要求：

- **意图与授权：** 区分解释、诊断和实施；将已授权改动推进到验证完成，不扩大用户要求的范围。
- **工具与证据：** 优先使用实际可用的专用工具，失败后先诊断再决定是否重试；仅在 DSH 已交付附件且
  当前路由支持其模态时声称查看。以证据确认完成，核实易变事实，不将历史记忆当作当前状态。
- **长任务与委派：** 保留真实后台任务句柄，采用有限等待，由父 Agent 复核子任务结果并整合分歧。
- **交互与沟通：** 浏览器工具可用时验证真实 UI 交互，布局受影响时检查桌面和移动视口；
  说明未完成的检查，按用户要求提供可独立理解的最终答复。

工作状态扩展每次重新汇总当前会话的未完成待办、运行或停止中的所属任务，以及直接拥有的、
仍活跃的可继续子 Agent。完整上下文最多 **4096 个 UTF-8 字节**，没有活跃工作时为空。
它为长任务和上下文压缩后的续接提供当前任务摘要，不是新增的长期记忆系统，也不恢复不可用的历史状态。

预设不提高底层模型本身的智力，也不绑定某个 Grok 版本；尚无 A/B 验证支持准确率、任务成功率、
速度或成本改善的承诺。权限执行和工具运行继续由 DSH 负责，行为指令不保证模型始终遵循。

全局默认仍为 `standard`。本套件为本地 `standard` 和 `grok-optimized` 各挂载一次图片召回，
工作状态上下文仅用于 Grok 模式；上游 standard 不含这两项本地扩展。
子 Agent 默认继承父模型，只有显式开放并配置原生跨模型选择后才允许另选模型，不写死 Grok 型号。

#### Grok Build 的设计参考范围

设计参考了 Grok Build 的任务纪律、压缩后工作上下文恢复及图片管线思路，并适配到 DSH。
控制面、会话、权限和工具循环始终由 DSH 所有；套件不运行 Grok Build 或 ACP worker，
也不采用 Grok Build 的身份或工具 schema。

[源码来源](presets/grok-optimized/SOURCE-PROVENANCE.md)和[参考锁](presets/grok-optimized/reference-lock.json)
分别记录行为与图片设计核对提交 `37949780c144e37df692e3d669051a21fec24f20`，以及保持不变的
协议参考提交 `bc7f02eddd3d84085849dc19ed216f11c23b0571`。更新设计来源不代表新协议或真实服务
已经通过验证；适用许可与署名继续保留。

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
