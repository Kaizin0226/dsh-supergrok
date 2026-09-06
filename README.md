# SuperGrok for DeepSeek Harness (DSH)

[English](#english) | [简体中文](#简体中文)

## English

**Developer preview · unofficial experimental integration.** For developers
who can build and troubleshoot Windows + Node.js 24 setups. This is not a stable
release or an officially supported third-party OAuth client.

Use your SuperGrok subscription in DeepSeek Harness (DSH) via OAuth, with a
dedicated Grok-optimized agent mode. Sign in with your own account inside DSH;
no xAI API key is required. Available models and reasoning options come from
the authenticated live catalog and depend on account access and a compatible
installation.

This repository includes the OAuth provider, Grok preset, native work-state and
historical-image extensions, and reproducible DSH core patches. The first
supported installation target is Windows with **Node.js 24**. This preview
provides source and build/install tools, without precompiled release downloads
or npm publication.

### Components

| Component | Version / contract |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1`; required explicit loopback HTTP proxy |
| Grok-optimized preset | `0.8.0` |
| DSH core overlay | `0.1.2-rc.1.grok.2`, based on exact tag commit `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| Upstream CLI | `@deepseek-ai/dsh@0.1.2-rc.1`, with source-built core overrides |
| Attachment history, recall tool, work-state context | `1.1.0` each |
| Optional Bridge | Must separately accept this release's actual package hashes and proxy contract |

See [component lock](components.lock.json), [source provenance](UPSTREAM-PROVENANCE.md)
and [Windows build/install guide](deployment/windows/README.md).

### Behavior

- OAuth, model catalog, read-only usage and inference share one dispatcher
  configured by required `proxyUrl`. Only unauthenticated HTTP proxy endpoints
  on numeric `127.0.0.1` or `[::1]` are accepted. Missing/invalid settings fail
  before network access. No system-proxy lookup or direct fallback is used.
  Changing the proxy requires reloading the provider.
- The usage panel reports the account's quota response and cache freshness.
  Missing or expired data stays visibly unavailable/stale; quota is not an
  API-token price or a calculated bill.
- Image preparation validates owned DSH attachments, records preparation
  notices through the host, and accounts for the **complete serialized request**.
  The default budget is **40,000,000 bytes**; oversized inference requests are
  rejected before sending. Recall input remains `{attachmentId, occurrence?}`.
- Global default stays `standard`. Both local standard and `grok-optimized`
  mount image recall once. Only Grok mode mounts deterministic work-state
  context. The upstream standard has neither local extension; provenance
  distinguishes all three compositions.
- Child agents inherit the selected model unless the native explicit
  cross-model option is enabled. The preset does not pin a Grok model or add
  an external agent runtime.

### Build and verify

From a fresh checkout, run `npm ci --ignore-scripts`, then `npm run verify`.
Use `npm run build:dsh -- --work-dir <external-build-directory>` followed by
`npm run build:suite -- --work-dir <same-build-directory>` to create a portable
bundle. The [installation guide](deployment/windows/README.md) supplies complete
PowerShell commands, default-dry-run installation, fresh data initialization,
manual launch and recoverable rollback.

Tests use synthetic credentials and mocked services. Source builds and npm
installation download public dependencies; offline tests make no real OAuth,
model-catalog or inference requests. Installed web/headless composition tests
exercise actual DSH loading with a synthetic adapter and a fixture-owned local
HTTP listener. Passing them does not establish production UI or live model
acceptance. See [validation and public-release checklist](docs/VALIDATION.md).

### Boundaries

Read the [service-access review](docs/SERVICE-ACCESS.md) before signing in.
Source licensing and successful login do not establish third-party service
authorization. Protocols and account eligibility can change. Live OAuth, model
and image inference, and the production usage-panel UI have not been accepted
for this release. macOS/Linux and existing data migration are outside the
supported preview workflow. No availability or production-support promise is made.

DSH owns credentials, sessions, permission enforcement and native tools. Bridge
is optional: configure its local trust using the hashes of the installed
release; an older fixed trust hash does not authorize this package. This
project does not edit another Bridge repository or the user's trust settings.
The [old xAI API contracts](contracts/xai-dsh/README.md) are historical reference
and are excluded from the default build/install route.

Preserve the original [MIT license](LICENSE), [NOTICE](NOTICE), and applicable
[third-party licenses](THIRD-PARTY-NOTICES.md). Code licensing does not grant
subscription access or service authorization. This is an independent integration.

### Contributing and support

See [contributing](CONTRIBUTING.md), [security reporting](SECURITY.md),
[preview release notes](docs/RELEASE-NOTES.md) and the
[public-release procedure](docs/PUBLIC-RELEASE.md), available in English and
Simplified Chinese. Issues should contain minimal synthetic reproductions only;
report vulnerabilities privately. Maintenance is best-effort, without a response
time or compatibility guarantee beyond the documented tested combination.

## 简体中文

**开发者预览版 · 非官方实验性集成。** 面向能够自行构建和排查 Windows＋Node.js 24 环境的开发者。
尚非稳定正式版，也不代表第三方 OAuth 客户端已获官方支持。

将你的 SuperGrok 订阅通过 OAuth 登录接入 DeepSeek Harness（DSH），并提供专属 Grok 优化模式。
通过自己的 DSH 登录授权，无需 xAI API key；可用模型与 reasoning 选项以账户实时目录和兼容安装为准。

仓库包含 provider、Grok 预设、原生工作状态与历史图片扩展，以及可复现的 DSH 核心补丁。
首版安装支持 **Windows + Node.js 24**，提供源码与构建、安装工具；不发布 npm 包或预编译发行附件。

### 兼容组合

| 组件 | 版本与用途 |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1`，新增必填显式代理 |
| Grok 优化预设 | `0.8.0` |
| DSH 核心补丁组合 | `0.1.2-rc.1.grok.2`，上游精确提交 `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| 上游启动器 | `@deepseek-ai/dsh@0.1.2-rc.1`，搭配本仓库构建的五个核心包 |
| 图片历史、图片召回、工作状态扩展 | 均为 `1.1.0` |
| Bridge（可选） | 须另行验证新版包哈希与代理契约，不沿用旧版信任结论 |

完整来源与锁定关系见 [组件锁](components.lock.json)、[源码来源](UPSTREAM-PROVENANCE.md)。

### 主要行为

- 必须配置 `proxyUrl`：首版接受无认证的本地 loopback HTTP 代理，仅限数字地址 `127.0.0.1` 或 `[::1]`。
  OAuth、目录、额度和推理共用同一 dispatcher；未配置或配置非法时明确报错且不联网。
  不读取系统代理，不直连回退；修改代理后需要重新加载 provider。
- 额度看板只读展示服务返回值及缓存新鲜度。额度缺失、过期分别呈现，不将额度换算为 token 单价或账单。
- 图片准备提示由 host 记录并可回放；请求预算覆盖完整序列化请求，默认 **40,000,000 字节**，超限在发送推理前拒绝。
  历史图片召回输入保持 `{attachmentId, occurrence?}`，附件权限和身份由 DSH 校验。
- 全局默认仍为 `standard`。本地 standard 与 Grok 模式各挂载一次图片召回，工作状态扩展仅属于 `grok-optimized`。
  来源锁明确区分上游 standard、本地 standard 扩展和 Grok 专属能力。
- 子 Agent 默认继承模型，跨模型选择沿用原生显式开放机制。不写死 Grok 型号，不启动另一套 Agent 运行时。

### 构建、安装与验证

干净检出后先运行 `npm ci --ignore-scripts`、`npm run verify`。
[Windows 指南](deployment/windows/README.md#简体中文) 提供完整构建、安装、初始化、启动及回滚命令。
构建输出位于明确指定的仓库外目录，不依赖已安装的 DSH、私有压缩包或个人 staging 路径。
安装默认 dry-run，应用时验证输入哈希和精确目标；先安装候选目录，再可恢复替换。
数据初始化仅支持新目录，保留既有会话与设置，工具不管理 DSH 进程。

测试只使用合成凭据和模拟服务。源码及依赖下载需要网络，离线测试不请求真实 OAuth、模型目录或模型。
组合测试在独立安装中加载 web/headless，并使用合成 adapter 和自有本地 HTTP 服务。
离线通过、生产加载、线上模型验收是不同结论；详见 [验证及公开前清单](docs/VALIDATION.md)。

Bridge 是可选配套，需要按实际安装包哈希另行配置本地信任；此次不修改 Bridge 仓库和信任设置。
[旧 xAI API 合约](contracts/xai-dsh/README.md) 仅作历史参考，不进入默认安装流程。

原 [MIT 版权声明](LICENSE) 保留，自有新增内容沿用 MIT；适用的 Grok Build 衍生内容保留
[Apache-2.0 许可与署名](THIRD-PARTY-NOTICES.md)。源码许可不代表订阅授权或服务使用授权。
本项目是独立集成。

### 接入边界与已知限制

登录前请阅读[服务接入评估](docs/SERVICE-ACCESS.md)。源码许可及登录成功均不构成第三方服务接入授权。
上游协议与账户资格可能变化。本次发行尚未完成真实 OAuth、模型推理、图片推理及生产额度面板的线上验收。
macOS／Linux 和既有数据迁移不属于首版支持流程；不承诺持续可用或生产支持。

### 贡献与反馈

请参阅[贡献指南](CONTRIBUTING.md)、[私密安全反馈](SECURITY.md)、[预览版说明](docs/RELEASE-NOTES.md)
和[公开流程](docs/PUBLIC-RELEASE.md)，相关指南均提供中英文。
普通 Issue 只提交最小合成复现，漏洞通过私密渠道反馈。维护采取尽力而为原则，
不承诺响应时间，也不扩大到兼容表之外的组合。
