# Validation scope / 验证范围

## English

This preview is validated on Windows and Node.js 24 against official DSH
`0.2.0-rc.2`. Packaging and installation use clean directories and locked registry
inputs, independent of production installations.

| Check | Scope |
| --- | --- |
| Provider and scanners | 119 passing offline tests; all real sockets, TLS and fetch blocked in the unit runner. |
| Preset | Read-only deterministic derivation, official standard parity and source checks; generated tracked files are not rewritten by tests. |
| Native installation | Two attributed tarballs, locked official runtime and pnpm toolchain, native plugin manager, official standard snapshot equality. |
| Web | Actual browser application, synthetic account/catalog/quota, native Config save and cold replay; standard/Grok tool parity, no old recall/work-state mounts. |
| Headless | Actual native one-shot runner and a synthetic completed turn; official preset registry and model-selection settings composed in the isolated profile. |
| Lifecycle | Native provider volatile updates, disposal and remount; repeated installs activate each bundle once. |
| Installation transactions | Dry-run without target changes, unknown/legacy target rejection, invalid proxy rejection, failed candidate preservation, replacement and receipt rollback; synthetic session bytes unchanged. |
| Dependencies and distribution | Current provider production/development, runtime/toolchain and native profile graphs reviewed; both packages retain required licenses; source/history and document/link checks. |

Network cases include required/invalid/changed proxy, shared dispatcher, cancellation,
terminal 426, catalog expiry/failure/concurrency, prepared-call snapshot/model/effort
drift, tool IDs and errors, image projections/offloading, duplicate image accounting,
UTF-8 budget boundaries and zero inference POST after rejection. Quota tests include
missing values, expiry, throttling and account isolation.

Web fixtures replace only external account responses and use a new isolated home.
The browser allows fixture loopback traffic only; fixture processes block real
network and subprocess access. Headless inference uses a local synthetic adapter.
Native Windows app-discovery registry probes are blocked without executing reg.exe.
No production credential, account, conversation or installed file is read.

SDK validation is limited to native LlmRuntime prepared-call dispatch, tool-history
and offloaded-image cases in provider tests. There is no full SDK, Desktop, ACP,
macOS or Linux acceptance. There is no real OAuth, live catalog/quota, model text
or image inference, or comparative model-quality acceptance for this combination.
Historical production reports are excluded from these results.

## 中文

本预览版在 Windows、Node.js 24 上针对官方 DSH 0.2.0-rc.2 验证。
打包与安装使用干净目录和锁定注册表输入，不依赖生产安装。

离线 provider／扫描器测试共 119 项通过，单元测试阻断真实 socket、TLS 和 fetch。
预设通过只读确定性派生、官方 standard 一致性和来源检查，不重写受版本控制的生成文件。
两个 tarball 通过官方管理器安装，并核对官方 standard 快照。

实际 Web 浏览器验证合成账户、目录、额度、Config 保存和冷加载；
两种模式的工具一致，不挂载旧召回／工作状态功能。
headless 使用原生单次任务运行器及合成 adapter 完成一轮任务；
其隔离 profile 补充官方预设注册器和模型选择设置。
生命周期测试涵盖更新、释放与重新挂载；重复安装时每个 bundle 只启用一次。

安装验证包括 dry-run 无目标修改、未知／旧目标拒绝、非法代理、失败保留、
替换和 receipt 回滚，并核对合成会话字节不变。
覆盖代理、取消、426、目录失效／并发、prepared-call 快照与路由漂移、
工具 ID／错误、图片准备／卸载／重复计数、UTF-8 预算边界以及拒绝后零推理 POST；
额度覆盖缺失、过期、限流和账户隔离。

测试使用新隔离 home；Web 仅以合成响应替代外部账户接口，浏览器仅允许本地 fixture 流量，
fixture 进程阻断真实网络和子进程。headless 推理由本地合成 adapter 完成。
原生 Windows 应用发现触发的注册表探测被阻断，不执行 reg.exe。
不读取生产凭据、账户、会话或安装文件。许可、源码／历史、文档和依赖均另行核查。

SDK 仅验证 provider 测试中的原生 LlmRuntime prepared-call、工具历史和卸载图片专项。
未验收完整 SDK、Desktop、ACP、macOS 或 Linux。
未完成本组合真实 OAuth、线上目录／额度、文字／图片推理或模型质量对比；
历史生产报告不计入本次结果。
