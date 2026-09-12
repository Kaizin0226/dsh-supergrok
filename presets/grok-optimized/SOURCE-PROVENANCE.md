# Preset source provenance / 预设源码来源

## English

Preset 0.9.1 derives from the complete official standard composition at DSH
`dsh-v0.1.5-rc.2`, commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
`upstream-standard.cordis.yml` retains that input. The derivation script adds
one historical-image recall row to local standard, then replaces its persona
and adds one work-state row for Grok mode. Other capability rows remain equal,
including native subagents and disabled external-agent entries.

The base lock's distribution version `0.1.5-rc.2.grok.1` identifies the local
standard package baseline. It differs from the local functional reference
release `0.1.5-rc.2.grok.3` and public suite version `0.8.0`.

The [reference lock](reference-lock.json) separates protocol reference
`bc7f02eddd3d84085849dc19ed216f11c23b0571` (1.0.12) from behavior and image-design
review at `37949780c144e37df692e3d669051a21fec24f20`. Earlier persona principles
also reference `72a61251fcffb464bcc687aeb5a998e5a98ec0c9`. The newer design review
does not advance the transport protocol or establish live-service compatibility.
Preserve the supplied MIT and Apache-2.0 licenses and attribution.

The persona specifies clear complete sentences, factual code comments and
verification of changeable facts from historical memory. It introduces no
automatic memory access, model choice, authentication route or external runtime.
Loaded generations retain their composition; cold loads use the installed
preset. Restoring a preset does not rewrite historical messages.

## 简体中文

预设 0.9.1 从 DSH `dsh-v0.1.5-rc.2` 的完整 standard 组合派生，上游提交为
`fb2c4b9e698e30edb738bca4cf0618587db7d203`。`upstream-standard.cordis.yml`
保留原始输入。派生脚本为本地 standard 增加一次历史图片召回，然后替换 persona 并为
Grok 模式增加一次工作状态扩展；其余能力行保持一致，包括原生子 Agent 及禁用的外部 Agent 项。

基础锁中的 `0.1.5-rc.2.grok.1` 指本地 standard 包基线，与本地功能参考发行
`0.1.5-rc.2.grok.3`、公开 suite 版本 `0.8.0` 分别记录。

[参考锁](reference-lock.json)区分协议参考 `bc7f02eddd3d84085849dc19ed216f11c23b0571`
（1.0.12）和行为、图片设计核对参考 `37949780c144e37df692e3d669051a21fec24f20`；
早期 persona 原则另参考 `72a61251fcffb464bcc687aeb5a998e5a98ec0c9`。
新版设计核对不代表协议升级或真实服务兼容验收。保留随附 MIT、Apache-2.0 许可及署名。

Persona 强调完整易懂的句子、准确的代码注释及核实历史记忆中的易变事实，不新增自动记忆访问、
模型选择、认证路由或外部运行时。已加载代际保持原组合，冷加载使用安装后的预设；恢复预设不改写历史消息。
