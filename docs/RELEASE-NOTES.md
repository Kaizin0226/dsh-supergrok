# Release notes / 发行说明

[English](#english) | [简体中文](#简体中文)

## English

### suite-v0.8.0-preview.1

This preview updates SuperGrok's native DSH integration and the Grok engineering
preset, with persistent image-preparation notices, current task context and
checks before inference is sent.

#### Functional changes

- **Conversation images:** adapt historical image recall to native V3 sessions,
  preserve preparation notices for replay, and distinguish repeated uses of an
  attachment while retaining DSH's permission checks.
- **Task continuity:** generate Grok mode's work-state context from native todos,
  active owned jobs and continuable child-agent work, scoped to the current composition.
- **Grok preset 0.9.1:** clarify intent matching, authorized execution, evidence-based
  verification and readable communication. These are behavior requirements, not
  measured improvements in model accuracy or task success.
- **Request control:** add an extension event that can reject or cancel inference
  before a POST and can disable automatic authentication replay.

The suite retains SuperGrok account sign-in inside DSH, live model/reasoning
selection, read-only quota display, the required local HTTP proxy and complete
request-size checks. Standard remains the global default. Both local modes mount
image recall once; only Grok mode includes work-state context. Native child-model
selection remains explicitly configured.

#### Compatibility and installation

| Component | Version |
| --- | --- |
| DSH upstream | `0.1.5-rc.2` |
| Four source-built core packages | `0.1.5-rc.2.grok.1` |
| SuperGrok provider | `0.8.0-hardened.1` |
| Grok preset | `0.9.1` |
| Image history, recall and work-state extensions | `1.2.0` each |

Use the complete suite on Windows with Node.js 24. Follow the
[Windows guide](../deployment/windows/README.md#english) and select new runtime
and data directories. Existing conversations are not automatically migrated;
runtime rollback does not downgrade the data format. Source and build/install
tools are provided without precompiled assets or npm publication. Exact upstream
commits and derivation references are in [source provenance](../UPSTREAM-PROVENANCE.md).

#### Validation and limitations

[Source release](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.8.0-preview.1)
· [Validated commit `03f4818`](https://github.com/Kaizin0226/dsh-supergrok/commit/03f481828b503ceab88879b29f29f1105e59a437)
· [Successful CI 34707597729](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34707597729)

Clean builds, 724 core tests (one upstream skip), 120 provider/scanner tests,
23 extension tests, 11 historical-contract tests, preset derivation and native
composition checks passed. Installed Web/headless loading, recoverable
installation/rollback and one TypeScript SDK image-notice replay scenario also
passed using synthetic services. See [validation scope](VALIDATION.md).

Real OAuth, live model/image requests, the production quota UI, full SDK coverage,
Python SDK execution and macOS/Linux are unverified. On 2026-09-13, the provider,
suite build-kit and installed runtime npm audits reported zero known vulnerabilities;
the frozen upstream build workspace separately reported 60 advisory records,
including 29 high-severity records. Review [dependency constraints](DEPENDENCY-REVIEW.md)
before building with the retained pnpm 11.7.0 toolchain. This remains an unofficial
experimental integration; source licensing does not establish service authorization.
See the [service-access review](SERVICE-ACCESS.md).

### suite-v0.7.0-preview.2

[Source release](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2)
· Released 2026-09-06 (UTC) · Commit `021738367ccb7967a765cbd67722db124e18b152`

This source-only developer preview covers SuperGrok OAuth integration with DSH
and a dedicated Grok-optimized mode within DSH. Required core patches,
extensions, build/install tools and tests support these two capabilities.
It requires Windows, Node.js 24 and DSH
`0.1.2-rc.1` with this repository's core patches, producing combination
`0.1.2-rc.1.grok.2`. Follow its [versioned build and installation guide](https://github.com/Kaizin0226/dsh-supergrok/blob/suite-v0.7.0-preview.2/deployment/windows/README.md#english);
other DSH versions and unpatched installations are not validated.

| Component | Version |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1` |
| Grok preset | `0.8.0` |
| DSH core combination | `0.1.2-rc.1.grok.2` |
| Attachment history, recall and work-state extensions | `1.1.0` each |
| Extension test tooling | Vitest `4.1.11` |

Changes from preview.1:

- Updates extension test tooling to Vitest `4.1.11`, addressing
  [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp).
- Clarifies the required DSH baseline and core patches at the start of both
  README languages. Runtime component versions and production dependencies are unchanged.

The suite provides an explicit loopback HTTP proxy, live model catalog,
read-only usage display, image preparation and complete request budgets,
plus DSH-native image recall and work-state context. Standard remains the
default mode; child agents inherit their selected model by default.

[CI 34062689111](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34062689111)
passed 796 tests, clean builds, installed web/headless compositions and
recoverable installation/rollback. Tests use synthetic services. Real OAuth,
model and image inference, and the production usage-panel UI are unverified.

This is an unofficial experimental integration. macOS/Linux and existing data
migration are outside the supported combination. Distribution includes source and build/install tools, without
precompiled assets or npm publication. Read the [service limitations](SERVICE-ACCESS.md)
and [security policy](../SECURITY.md); preserve applicable licenses and attribution.

### suite-v0.7.0-preview.1

[Historical release](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.1)
· Released 2026-09-06 (UTC) · Commit `2d615912d27868d674c1cd9f3a4b2c0026c4f705`

The initial source preview introduced the same runtime component versions,
build/install tools and bilingual READMEs.
[CI 34061644576](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34061644576)
passed its 796 tests and installed-composition/rollback checks.

Preview.1 is superseded by preview.2. Its extension development dependency
Vitest `4.0.18` is affected by the advisory above. Use preview.2 for development;
do not enable Vitest UI, Browser Mode or a network-exposed API on preview.1.
The documented run-mode tests and installed runtime do not use these features.

## 简体中文

### suite-v0.8.0-preview.1

本预览版更新 SuperGrok 与 DSH 原生会话的集成及 Grok 工程任务预设，
重点完善图片准备提示持久化、当前任务上下文和推理发送前检查。

#### 功能变化

- **会话图片：** 历史图片召回适配原生 V3 会话，准备提示可持久化回放，
  区分同一附件的重复引用，并继续遵守 DSH 权限校验。
- **任务连续性：** 从原生待办、所属活动任务及可继续的子 Agent 工作生成 Grok 模式的
  当前工作状态，上下文限定在当前组合范围内。
- **Grok 0.9.1 预设：** 明确意图匹配、授权范围内执行、依据证据验证和清晰沟通的要求。
  这些属于行为规则，不代表已经测得模型准确率或任务成功率提升。
- **请求控制：** 新增扩展事件，可在推理 POST 前拒绝或取消，并可禁止自动认证重试。

套件继续提供 DSH 内的 SuperGrok 账户授权、实时模型与推理档位选择、只读额度展示、
必填本地 HTTP 代理和完整请求大小检查。全局默认保持 standard，两种本地模式各挂载一次
图片召回，工作状态仅用于 Grok 模式；原生子 Agent 跨模型选择继续要求显式配置。

#### 兼容与安装

| 组件 | 版本 |
| --- | --- |
| DSH 上游 | `0.1.5-rc.2` |
| 四个源码构建的核心补丁包 | `0.1.5-rc.2.grok.1` |
| SuperGrok provider | `0.8.0-hardened.1` |
| Grok 预设 | `0.9.1` |
| 图片历史、图片召回、工作状态扩展 | 均为 `1.2.0` |

在 Windows＋Node.js 24 下安装完整套件，按照[Windows 指南](../deployment/windows/README.md#简体中文)
选择新的运行与数据目录。不自动迁移旧聊天，运行程序回滚不等于数据格式降级。
提供源码及构建安装工具，不附预编译包、不发布 npm。精确上游提交与派生关系见
[源码来源](../UPSTREAM-PROVENANCE.md)。

#### 验证与限制

[源码发行](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.8.0-preview.1)
· [已验收提交 `03f4818`](https://github.com/Kaizin0226/dsh-supergrok/commit/03f481828b503ceab88879b29f29f1105e59a437)
· [成功 CI 34707597729](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34707597729)

干净构建、核心 724 项测试（另有 1 项上游跳过）、provider／扫描 120 项、扩展 23 项、
历史合约 11 项，以及预设派生与原生组合检查均通过。安装后的 Web/headless 加载、
可恢复安装与回滚，以及一个 TypeScript SDK 图片准备提示回放场景也已通过，使用合成服务。
详见[验证范围](VALIDATION.md)。

真实 OAuth、模型与图片请求、生产额度界面、完整 SDK、Python SDK 执行及 macOS／Linux 尚未验证。
2026-09-13 的 provider、配套构建工具和安装运行环境 npm 检查均为零已知漏洞；
上游冻结构建工作区另有 60 条告警记录，其中 29 条高危。使用保留的 pnpm 11.7.0 工具链前，
请阅读[依赖约束](DEPENDENCY-REVIEW.md)。本项目仍为非官方实验性集成，源码许可不代表服务授权，
详见[服务接入评估](SERVICE-ACCESS.md)。

### suite-v0.7.0-preview.2

[源码发行](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2)
· 发布日期：2026-09-06（UTC） · 提交：`021738367ccb7967a765cbd67722db124e18b152`

本源码开发者预览版仅覆盖 SuperGrok OAuth 接入 DSH，以及 DSH 内的专属 Grok 优化模式。
必需的核心补丁、扩展、构建安装工具和测试均为这两项功能的配套实现。
要求 Windows、Node.js 24，以及 DSH `0.1.2-rc.1` 搭配本仓库核心补丁，
构建后的核心组合为 `0.1.2-rc.1.grok.2`。
请遵循[对应版本的构建与安装指南](https://github.com/Kaizin0226/dsh-supergrok/blob/suite-v0.7.0-preview.2/deployment/windows/README.md#简体中文)；
其他 DSH 版本和未打补丁的安装尚未验证。

| 组件 | 版本 |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1` |
| Grok 预设 | `0.8.0` |
| DSH 核心组合 | `0.1.2-rc.1.grok.2` |
| 图片历史、图片召回与工作状态扩展 | 均为 `1.1.0` |
| 扩展测试工具 | Vitest `4.1.11` |

相较 preview.1 的变化：

- 扩展测试工具升级至 Vitest `4.1.11`，修复
  [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp)。
- 同一 README 的中英文开头明确 DSH 适配基线及核心补丁要求；运行组件版本和生产依赖不变。

配套功能包括显式 loopback HTTP 代理、实时模型目录、只读额度、图片准备与完整请求预算，
以及 DSH 原生图片召回和工作状态。默认模式为 standard，子 Agent 默认继承所选模型。

[CI 34062689111](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34062689111)
的 796 项测试、干净构建、安装后的 web/headless 组合及可恢复安装和回滚通过。
测试使用合成服务；未验证真实 OAuth、模型和图片推理及生产额度面板。

本项目为非官方实验性集成。macOS／Linux 和既有数据迁移不属于支持组合。
提供源码与构建安装工具，不附预编译包、不发布 npm。
请阅读[服务限制](SERVICE-ACCESS.md)和[安全政策](../SECURITY.md)，保留适用许可与署名。

### suite-v0.7.0-preview.1

[历史发行](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.1)
· 发布日期：2026-09-06（UTC） · 提交：`2d615912d27868d674c1cd9f3a4b2c0026c4f705`

首个源码预览版提供相同版本的运行组件、构建安装工具及同一文件内的双语 README。
[CI 34061644576](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34061644576)
的 796 项测试及安装组合和回滚检查通过。

preview.1 已由 preview.2 取代。首版扩展开发依赖 Vitest `4.0.18` 受上述公告影响；
开发请使用 preview.2，不要在 preview.1 上启用 Vitest UI、Browser Mode 或对外开放 API。
文档中的 run 模式测试及安装运行环境不使用这些功能。
