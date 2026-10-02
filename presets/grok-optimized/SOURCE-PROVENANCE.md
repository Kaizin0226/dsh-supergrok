# Grok preset source / Grok 预设来源

## English

Version 1.1.0 derives from official DSH 0.2.0-rc.2 standard at
`639ed015397290b3745d163aafe02ffee4aa3f84`, retained in upstream-standard.patch.yml.
The derivation changes only identity, display metadata and persona.
All non-persona plugin/configuration content remains equal.
The read-only `--check` mode never rewrites the generated tracked patch.

Behavior principles are adapted from Grok Build 1.0.45 at
[2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8](https://github.com/xai-org/grok-build/tree/2bdd1d6a6369de0e8c68132ea4539e9abd9e14a8),
reviewed 2026-10-03. reference-lock.json identifies files and inclusion/exclusion
boundaries. The condensed persona covers scoped execution, preservation of user
work, proportional evidence and clear reporting. Native DSH owns background jobs,
child agents, tools and compaction; no Grok-specific storage, runtime, UI syntax
or automatic memory behavior is introduced.

Provider protocol provenance is separate. The preset selects no model, provider,
effort or permission and leaves the global default standard. Offline parity does
not establish improved model performance. Both MIT and applicable Apache-2.0
license texts/notices ship in the package.

## 中文

1.1.0 从上述官方 DSH 固定 standard 派生，保留原文；只改变标识、展示与 persona，
其余插件和配置保持一致。`--check` 只读，不重写受版本控制的生成文件。

行为原则参考上述 Grok Build 1.0.45 固定提交，于 2026-10-03 核对；
reference-lock.json 记录文件与纳入／排除边界。
精简 persona 强调范围明确的执行、保留用户工作、相称验证及清晰报告。
后台任务、子 Agent、工具和压缩由 DSH 原生机制负责，不引入 Grok 专属存储、
运行时、界面语法或自动记忆流程。

provider 协议来源独立。预设不选择模型、provider、effort 或权限，
全局默认仍为 standard；离线一致性不证明模型效果提升。
包内保留 MIT 及适用 Apache-2.0 许可和署名。
