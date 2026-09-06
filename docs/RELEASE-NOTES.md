# Release notes / 发行说明

[English](#english) | [简体中文](#简体中文)

## English

### suite-v0.7.0-preview.2

[Source release](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2)
· Released 2026-09-06 (UTC) · Commit `021738367ccb7967a765cbd67722db124e18b152`

This source-only developer preview integrates SuperGrok OAuth and a native
Grok-optimized mode with DSH. It requires Windows, Node.js 24 and DSH
`0.1.2-rc.1` with this repository's core patches, producing combination
`0.1.2-rc.1.grok.2`. Follow the [build and installation guide](../deployment/windows/README.md#english);
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

This is an unofficial experimental integration. macOS/Linux, existing data
migration and existing Bridge trust configurations are outside the supported
combination. Distribution includes source and build/install tools, without
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

### suite-v0.7.0-preview.2

[源码发行](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2)
· 发布日期：2026-09-06（UTC） · 提交：`021738367ccb7967a765cbd67722db124e18b152`

本源码开发者预览版为 DSH 提供 SuperGrok OAuth 接入及原生 Grok 优化模式。
要求 Windows、Node.js 24，以及 DSH `0.1.2-rc.1` 搭配本仓库核心补丁，
构建后的核心组合为 `0.1.2-rc.1.grok.2`。
请遵循[构建与安装指南](../deployment/windows/README.md#简体中文)；
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

本项目为非官方实验性集成。macOS／Linux、既有数据迁移及现有 Bridge 信任配置不属于支持组合。
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
