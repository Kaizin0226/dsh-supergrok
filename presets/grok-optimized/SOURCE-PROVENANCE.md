# Grok optimized preset provenance

Version 0.8.0 is derived from the exact DSH standard composition in the root
source lock. The two runtime YAML files are accompanied by package metadata,
base-lock and PROVENANCE.md in new suite installations.

`base-lock.json` records upstream standard, local distribution standard,
Grok-only work-state context, the two YAML payload hashes and the fixed Grok
Build persona reference. Both local modes mount recall exactly once; only
Grok mode adds work-state context. Native child agents inherit their model,
with native explicit cross-model selection remaining available.

The adapted persona references xai-org/grok-build at
`72a61251fcffb464bcc687aeb5a998e5a98ec0c9`; preserve the root NOTICE and Apache-2.0
license alongside original MIT integration work. No external Grok executable
is loaded. Model choices, permissions and account authorization stay in DSH.

## 中文

`0.8.0` 派生自根目录源码锁指定的精确 DSH standard 组合。
新的组合安装除两份运行 YAML 外，还包含包元数据、base-lock 与 PROVENANCE.md。

`base-lock.json` 记录上游 standard、本地 standard、Grok 专属工作状态、两份 YAML 哈希和固定 persona 参考。
两种本地模式各挂载一次图片召回，只有 Grok 模式添加工作状态。
原生子 Agent 默认继承模型，保留原生显式跨模型选择。

persona 改编参考 xai-org/grok-build 的 `72a61251fcffb464bcc687aeb5a998e5a98ec0c9`；
原创 MIT 集成与衍生内容一同分发时保留根 NOTICE 和 Apache-2.0 许可。
不加载外部 Grok 可执行程序；模型选择、权限及账户授权都保留在 DSH。
