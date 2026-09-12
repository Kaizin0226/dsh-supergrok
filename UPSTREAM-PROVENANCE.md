# Fixed-source provenance

| Component | Exact source |
| --- | --- |
| Provider baseline `0.2.10` | [wangyaominde/dsh-llm-grok-oauth](https://github.com/wangyaominde/dsh-llm-grok-oauth/tree/108cc76224d1845b5c88602f7c7a24bb1ced0497), commit `108cc76224d1845b5c88602f7c7a24bb1ced0497` |
| DSH baseline `dsh-v0.1.5-rc.2` | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness/tree/fb2c4b9e698e30edb738bca4cf0618587db7d203), commit `fb2c4b9e698e30edb738bca4cf0618587db7d203` |
| Initial OAuth/protocol snapshot `1.0.12` | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/bc7f02eddd3d84085849dc19ed216f11c23b0571), commit `bc7f02eddd3d84085849dc19ed216f11c23b0571` |
| Earlier persona reference | [xai-org/grok-build](https://github.com/xai-org/grok-build/tree/72a61251fcffb464bcc687aeb5a998e5a98ec0c9), commit `72a61251fcffb464bcc687aeb5a998e5a98ec0c9` |

Provider `0.8.0-hardened.1` targets DSH 0.1.5-rc.2 and adds the request-boundary hook while preserving the explicit proxy contract. Preset `0.9.1` and extension `1.2.0` versions use the new native session APIs. The local functional reference is `0.1.5-rc.2.grok.3`; the four patched package versions remain `0.1.5-rc.2.grok.1`.
[The source lock](patches/dsh/source.lock.json) pins the exact DSH revision,
patch and changed package versions. The installer uses the unmodified upstream
CLI package `0.1.5-rc.2` with four source-built core packages; the distribution
label is not a newly published CLI package.

`OAUTH_CLIENT_ID` is a public client identifier from the pinned device-flow
reference, not a secret or authorization grant. Origins, paths, methods,
redirect handling and client identity are fixed in `lib/constants.js` and
`lib/net.js`. The provider identifies itself as
`dsh-supergrok-oauth-hardened/0.8.0-hardened.1`. User tokens come only from the
user's own DSH login, never the official client's credential storage.

`npm run source-hash` measures the checked-out source tree. `npm run
canonical-hash` measures the provider runtime payload, including its shrinkwrap
and hardening declaration. These tools verify source and package integrity.
`npm-shrinkwrap.json` is included in the
provider package. The portable bundle additionally freezes the complete runtime
graph in its own package-lock and checksums all installation inputs.

See [third-party notices](THIRD-PARTY-NOTICES.md). This repository contains only
selected source, tests and general documentation. Task transcripts, production
reports, authentication state and reference-clone contents are not build inputs.

## 中文：固定源码来源

上表按精确提交锁定四类来源：原 provider `0.2.10`、DSH `dsh-v0.1.5-rc.2`、
初始 OAuth／协议参考 `1.0.12`，以及 persona 的 Grok Build 参考快照。链接与提交在两种语言中共用。

Provider `0.8.0-hardened.1` 适配 DSH 0.1.5-rc.2，新增请求检查接口并保留显式代理契约；
preset 为 `0.9.1`，扩展为 `1.2.0`，本地功能参考为 `0.1.5-rc.2.grok.3`，四个补丁包版本均为 `0.1.5-rc.2.grok.1`。
[源码锁](patches/dsh/source.lock.json)记录精确 DSH 提交、补丁及包版本。
安装使用未改动的上游 CLI `0.1.5-rc.2` 配合四个从源码构建的核心包；组合标签不是新发布的 CLI 包。

`OAUTH_CLIENT_ID` 是固定 device-flow 参考中的公开客户端标识，不是密钥或授权。
origin、路径、方法、重定向处理和客户端身份固定在 `lib/constants.js` 与 `lib/net.js`。
provider 标识为 `dsh-supergrok-oauth-hardened/0.8.0-hardened.1`；token 仅来自用户自己在 DSH 中的登录，
不读取官方客户端凭据存储。

`npm run source-hash` 计算检出源码树，`npm run canonical-hash` 计算包含 shrinkwrap 和加固声明的
provider 运行负载。两者用于源码与包的完整性校验。
provider 包含 `npm-shrinkwrap.json`；安装组合另用完整依赖锁固定运行图，并校验所有安装输入。

参见[第三方说明](THIRD-PARTY-NOTICES.md)。仓库仅包含选定源码、测试与通用文档；
任务全文、生产报告、认证状态和参考克隆内容不作为构建输入。

Behavior and image-design references are separately recorded at `37949780c144e37df692e3d669051a21fec24f20` in the [preset reference lock](presets/grok-optimized/reference-lock.json); the protocol reference is unchanged.

行为和图片设计参考在[预设参考锁](presets/grok-optimized/reference-lock.json)中单独记录，提交为 `37949780c144e37df692e3d669051a21fec24f20`；协议参考保持不变。
