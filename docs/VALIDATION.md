# Validation results and scope / 验证结果与范围

## English

The suite-v0.8.0-preview.1 validation uses Windows and Node.js 24, the pinned
DSH 0.1.5-rc.2 source, and packages built independently of any production installation.

| Check | Result and scope |
|---|---|
| Clean source build | Exact upstream export plus reviewed patch; host, client and Web assets |
| Core regressions | 724 passed; one upstream test skipped |
| Provider and scanner tests | 120 passed with network blocked |
| Three extensions | 23 passed; repeated against installed packages |
| Historical xAI contracts | 11 passed; excluded from default installation |
| TypeScript SDK | One prepared-input replay scenario passed, including two turns and persisted notices; the other SDK scenarios are not part of this check |
| Preset checks | Derived-source parity and six contract groups; three native generation/replay/rollback checks |
| Installed compositions | Web and headless load the actual provider; authenticated local Web document includes its client; only synthetic inference |
| Installation | Default dry-run, fresh-data protection, recoverable replacement and exact-receipt rollback |

These checks cover proxy validation and shared dispatcher ownership, catalog
failure, usage freshness, image occurrences, authorization, preparation notice
replay, cancellation, full request budgets, and zero inference POSTs on refusal.
Native composition checks ensure one image recall per mode, Grok-only work state,
standard as default, correct disposal, and retained historical messages.

Credentials are removed from test environments. Tests block external network
requests; Web tests allow only their own listener. Source/dependency downloads
are separate network operations. The root provider, build-kit and runtime npm
audits reported zero known vulnerabilities on 2026-09-13. The complete frozen
upstream pnpm workspace reports 60 advisory records, including 29 high-severity
records; see the separate [dependency review](DEPENDENCY-REVIEW.md).

CI repeats the checks from the final source commit. The release description
links that commit and its successful run. Historical local production acceptance
does not establish acceptance of this public combination. Real OAuth, live model
and image requests, production usage UI, complete SDK coverage, Python SDK
execution and existing-data migration are outside this release's validation.

## 简体中文

suite-v0.8.0-preview.1 在 Windows、Node.js 24 下，从固定 DSH 0.1.5-rc.2 源码构建；
不依赖任何生产安装。上表两种语言共用数值：核心 724 项通过、1 项上游跳过；provider／
扫描 120 项、三个扩展 23 项、历史合约 11 项通过。TypeScript SDK 仅验收一个图片准备
提示回放场景，包括两轮交互和持久化提示；不将其他未选择场景计入通过数。

预设完成派生一致性、六组契约及三组原生代际／回放／回滚检查。独立安装验证 Web 和
headless 实际加载 provider、本地认证后页面包含 provider 客户端，并仅执行合成推理。
安装检查覆盖默认 dry-run、新数据保护、可恢复替换和精确回执回滚。

测试覆盖代理配置与 dispatcher 归属、目录失败、额度新鲜度、图片出现次数和权限、准备提示回放、
取消、完整请求预算及拒绝后零推理 POST。两种模式各挂载一次图片召回，仅 Grok 模式包含工作状态，
默认保持 standard；同时检查释放、代际继承和历史消息保留。

测试清除继承凭据并阻断外网；Web 测试仅允许自己的监听服务。源码和依赖下载单独进行。
2026-09-13 的 provider、构建工具及运行环境 npm 检查均未报告已知漏洞；上游完整冻结
pnpm 工作区另有 60 条告警记录，其中 29 条高危，见[依赖检查](DEPENDENCY-REVIEW.md)。

CI 对最终提交重复验收，Release 正文提供对应提交和成功运行链接。历史本机生产验收不能替代
本公开组合的验收。本版未验证真实 OAuth、模型和图片请求、生产额度界面、完整 SDK、Python SDK
执行或既有数据迁移。[发行规范](PUBLIC-RELEASE.md)与[服务说明](SERVICE-ACCESS.md)记录相应边界。
