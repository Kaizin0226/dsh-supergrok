# Licenses and attribution

The original provider copyright and MIT terms remain in [LICENSE](LICENSE).
New original code and documentation by Kaizin0226 use MIT. The combined
provider/preset distribution also contains adapted Apache-2.0 material;
its package expression is `MIT AND Apache-2.0`.

| Material | Source and applicable terms |
| --- | --- |
| Original provider | wangyaominde/dsh-llm-grok-oauth at `108cc76224d1845b5c88602f7c7a24bb1ced0497`; MIT, copyright wangyaominde |
| DSH core patch and standard composition | deepseek-ai/deepseek-harness at `a66e4702047846cdaa10c66c9d3df3951f5ea70d`; [DeepSeek MIT](licenses/DSH-MIT.txt) |
| Grok protocol conventions, image preparation policy and adapted persona guidance | xai-org/grok-build snapshots recorded in [provenance](UPSTREAM-PROVENANCE.md); [Apache-2.0 with original attribution](licenses/Grok-Build-Apache-2.0.txt), copyright 2023–2026 SpaceXAI |
| Work-state and attachment-history extensions; build/install helpers | Original DSH integration work by Kaizin0226; MIT |

The Grok-derived material is identified in `lib/constants.js`,
`lib/protocol.js`, `lib/images.js` and `presets/grok-optimized/agent.cordis.yml`.
The protocol implementation is adapted for DSH; the image policy retains the
reference limits; the persona uses DSH-native equivalents of reference guidance.
These files include substantial original integration code as well. Preserve
NOTICE and both applicable licenses when redistributing the combined work.
No complete reference repository is vendored. npm dependencies retain their
own licenses and notices in installed packages.

Source-code licenses do not grant account access, subscription entitlements,
service authorization or an endorsement by xAI or DeepSeek. Service access
remains subject to the user's account, available OAuth flow and applicable terms.

## 中文：许可与署名

原 provider 的 wangyaominde 版权及 MIT 条款保留在 [LICENSE](LICENSE)。
Kaizin0226 的原创新增源码和文档采用 MIT。组合 provider／preset 包包含适用 Apache-2.0 的衍生内容，
许可表达式为 `MIT AND Apache-2.0`，不改变各来源自身的许可。

| 内容 | 来源与适用条款 |
| --- | --- |
| 原 provider | wangyaominde/dsh-llm-grok-oauth，固定于 `108cc76224d1845b5c88602f7c7a24bb1ced0497`；MIT，版权 wangyaominde |
| DSH 核心补丁与 standard 组合 | deepseek-ai/deepseek-harness，固定于 `a66e4702047846cdaa10c66c9d3df3951f5ea70d`；[DeepSeek MIT](licenses/DSH-MIT.txt) |
| Grok 协议惯例、图片准备策略与改编 persona | [来源说明](UPSTREAM-PROVENANCE.md)锁定的 xai-org/grok-build 快照；[Apache-2.0 与原始署名](licenses/Grok-Build-Apache-2.0.txt)，版权 2023–2026 SpaceXAI |
| 工作状态、历史图片扩展与构建安装工具 | Kaizin0226 原创 DSH 集成，MIT |

Grok 衍生内容在 `lib/constants.js`、`lib/protocol.js`、`lib/images.js` 与
`presets/grok-optimized/agent.cordis.yml` 标明。协议为 DSH 适配，图片策略保留参考限制，
persona 使用 DSH 原生对应能力；这些文件同时包含原创集成代码。
分发组合作品时保留 NOTICE 和两类适用许可证。未内置完整参考仓库，npm 依赖保留各自许可与署名。
许可证文本保留原文，此中文说明不替代许可证。

源码许可不授予账户访问、订阅资格、服务授权，也不代表 xAI 或 DeepSeek 背书。
服务使用仍受用户账户、可用 OAuth 流程与适用条款约束。
