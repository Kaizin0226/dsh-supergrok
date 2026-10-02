# Source provenance / 源码来源

## English

| Source | Fixed snapshot and scope |
| --- | --- |
| [Original provider](https://github.com/wangyaominde/dsh-llm-grok-oauth) | `108cc76224d1845b5c88602f7c7a24bb1ced0497`, MIT; maintained JavaScript adds native integration, catalog, quota, image projection and request/network boundaries. |
| [Official DSH release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2) | `639ed015397290b3745d163aafe02ffee4aa3f84`, MIT; official npm runtime is locked, with no core patch. Standard patch is retained for derivation. |
| Grok Build protocol | `2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8`, `1.0.45`; protocol compatibility, OAuth public identifier and endpoints. |
| Grok Build behavior | Same fixed commit/version, independently recorded in the [behavior lock](presets/grok-optimized/reference-lock.json); task persona only. |
| Earlier image envelope | `bc7f02eddd3d84085849dc19ed216f11c23b0571`; retained compatibility policy provenance. |

See [component pins](components.lock.json), [preset notes](presets/grok-optimized/SOURCE-PROVENANCE.md)
and [licenses](THIRD-PARTY-NOTICES.md). The reference runtime is not bundled.
No private history, production reports, account state or conversations are imported.
The [fixed old tag](https://github.com/Kaizin0226/dsh-supergrok/tree/suite-v0.8.0-preview.1)
retains the historical 0.1 implementation.

## 中文

上表记录精确源码与改编范围。provider 保留原 MIT 声明；host 使用锁定官方 npm 发行，
不构建核心补丁。预设从固定 standard 派生，仅修改标识、展示和 persona。
Grok Build 协议与行为来源分别记录；图片范围另保留早期提交来源。
相关衍生材料保留 Apache-2.0，不分发参考运行时。
不导入私有历史、生产报告、账户状态或会话。旧 0.1 实现由固定旧标签保留。
