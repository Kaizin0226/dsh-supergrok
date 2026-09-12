# Grok optimized preset 0.9.1 / Grok 优化预设 0.9.1

## English

Derived from DSH 0.1.5-rc.2 standard, preserving its full tool composition and
native subagent selection. Historical image recall and work-state extensions
use 1.2.0. Version 0.9.1 adds complete sentences, familiar terminology, factual
code comments, and checking changeable facts before relying on historical memory.
It introduces no automatic memory reads/writes, new tools or model defaults.

Running generations retain their composition. Cold loads use the installed
preset; rollback applies to future loads without rewriting history. Offline
text and composition checks do not establish real model behavior.
See [source provenance](SOURCE-PROVENANCE.md) and [suite validation](../../docs/VALIDATION.md).

## 简体中文

从 DSH 0.1.5-rc.2 standard 派生，保留完整工具组合及原生子 Agent 模型选择机制；
历史图片召回和工作状态扩展均使用 1.2.0。0.9.1 强调完整句子、熟悉术语、准确代码注释，
以及依赖历史记忆前核实易变事实；不新增自动记忆读写、工具或默认模型。

运行中的代际保留原组合，冷加载使用安装后的预设；回滚影响后续加载，不改写历史。
离线文本与组合检查不证明真实模型行为。参见[源码来源](SOURCE-PROVENANCE.md)
和[suite 验证范围](../../docs/VALIDATION.md)。
