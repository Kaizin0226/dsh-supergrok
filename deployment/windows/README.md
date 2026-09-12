# Windows build, installation and rollback

[English](#english) | [简体中文](#简体中文)

## English

Developer preview: read the [service-access limitations](../../docs/SERVICE-ACCESS.md)
before any real login and the [dependency review](../../docs/DEPENDENCY-REVIEW.md)
before building with the frozen upstream pnpm 11.7.0 toolchain. The release validates offline installation/composition;
the sign-in and launch commands below are manual user operations, not CI steps.

Requires Node.js 24, Git, PowerShell, and the Windows `tar` command. Run these
commands from the checkout. All example paths are derived from the current
checkout; choose separate destinations appropriate to your machine. No command
below selects an existing DSH installation.

```powershell
$work = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-build'))
$runtime = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-runtime'))
$data = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-data'))
$backups = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-backups'))
npm ci --ignore-scripts
npm run verify
npm run build:dsh -- --work-dir $work
npm run build:dsh -- --work-dir $work --phase test
npm run build:suite -- --work-dir $work
npm run test:sdk -- --work-dir $work
```

The DSH builder verifies tag `dsh-v0.1.5-rc.2` resolves to the source-lock commit,
exports a clean source archive, applies the checked-in patch, installs the
frozen upstream dependencies and builds host/client/web source. An optional
`--upstream-source <local-git-checkout>` exports the same fixed commit without
requiring the remote clone; it never reads that checkout's uncommitted files.
The suite builder compiles extensions and packs the provider and all changed
core packages, then creates a runtime bundle with a complete dependency lock.
A fresh directory is required for preparation; `--phase` can resume later
build/test/pack stages. Build and package downloads use public registries.

### Install a separate runtime

```powershell
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups
# Review the exact resolved paths above, then apply explicitly:
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups --apply
```

The default dry run performs validation only. Application verifies every bundle
input, installs a complete candidate with `npm ci --ignore-scripts`, and then
renames directories on the same drive. An existing target must carry this
installer's marker; unknown installations are refused. Failed candidates and
rollback receipts stay under the explicit backup directory, outside Git.
Do not manually remove an old runtime until its users have stopped using it.
The helper itself does not start, stop or inspect DSH processes.

### Initialize new data and sign in

Choose the proxy endpoint you actually run; the address below is only an
example. Credentials in proxy URLs, non-loopback hosts, HTTPS/SOCKS proxies,
paths, query strings and fragments are rejected. `localhost` is deliberately
excluded to avoid DNS-dependent routing.

```powershell
$proxy = 'http://127.0.0.1:8080'
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy --apply
$env:DSH_HOME = $data
node "$runtime/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile web
```

Initialization requires an absent data directory. It creates provider config
for web/headless, a profile node_modules junction to the same runtime dependency
tree, and the complete Grok preset payload. It does not copy old settings,
credentials or conversations. DSH's global default remains standard. Complete
the SuperGrok OAuth login in DSH, select from the live catalog, then choose
Grok optimized when desired. Launching and logging in are user operations;
the installer performs neither. For manual headless use, select the headless
profile and supply the arguments supported by the pinned DSH CLI.

### Offline installed-composition verification

```powershell
npm run test:installed -- --work-dir $work
```

This command creates its own fresh runtime and data below the build directory,
then checks real web/headless loading with a synthetic adapter. It never uses
the runtime/data variables above or a production installation. It also verifies
dry-run behavior, malformed proxies and recoverable replacement/rollback.

### Rollback

Use the exact receipt printed by the install command. Stop using the target
runtime before applying a rollback; the tool does not manage processes.

```powershell
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path>
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path> --apply
```

The runtime marker must match that receipt. The displaced installation is
preserved as `rolled-back` under its transaction; an earlier managed runtime
is restored when one existed. Rolling back a first installation leaves the
runtime target absent. User data is never reverted, deleted or rewritten. DSH 0.1.5 uses a different session format from the previous preview. Use a new runtime and data directory; runtime rollback is not a data-format downgrade.

The older `Install-GrokOptimizedPreset.ps1` / `Rollback-GrokOptimizedPreset.ps1`
helpers remain tested for their original two-YAML-file update contract. New
suite installations use the complete preset payload above. Historical xAI API
rollout tooling is not part of this procedure.

## 简体中文

开发者预览版：真实登录前请阅读[服务接入限制](../../docs/SERVICE-ACCESS.md)。
构建前请阅读[依赖检查](../../docs/DEPENDENCY-REVIEW.md)，了解冻结上游 pnpm 11.7.0 工具链的已知告警。
本次发行验证的是离线安装与组合；下方登录和启动属于用户手动操作，不是 CI 步骤。

需要 Node.js 24、Git、PowerShell 和 Windows 的 `tar`。从仓库检出目录执行，
示例路径都根据当前检出推导；选择适合自己机器的独立目标。下列命令不会自动选中既有 DSH 安装。

```powershell
$work = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-build'))
$runtime = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-runtime'))
$data = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-data'))
$backups = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../dsh-supergrok-backups'))
npm ci --ignore-scripts
npm run verify
npm run build:dsh -- --work-dir $work
npm run build:dsh -- --work-dir $work --phase test
npm run build:suite -- --work-dir $work
npm run test:sdk -- --work-dir $work
```

构建器验证 `dsh-v0.1.5-rc.2` 标签解析为源码锁的精确提交，导出干净源码、应用补丁、
安装冻结上游依赖并构建 host/client/web。可选 `--upstream-source <local-git-checkout>`
从本地克隆导出相同固定提交，不读取未提交文件，也无需重新远端克隆。
配套构建器编译扩展并打包 provider 和全部改动核心包，生成完整锁定依赖的运行组合。
准备阶段需全新目录，后续构建、测试或打包可通过 `--phase` 继续；源码与依赖下载使用公开来源。

### 安装独立运行环境

```powershell
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups
# Review the exact resolved paths above, then apply explicitly:
node scripts/install-suite.mjs install --bundle "$work/bundle" --runtime $runtime --backups $backups --apply
```

先核对输出中的精确路径，再显式应用。默认 dry-run 仅验证。应用时检查全部组合输入，
通过 `npm ci --ignore-scripts` 安装完整候选，再在同一磁盘卷内重命名目录。
既有目标须带本安装工具的管理标记，未知安装拒绝覆盖。失败候选及回滚回执保留在显式备份目录内、Git 外。
旧环境仍被使用时不要手动移除；工具不启动、停止或检查 DSH 进程。

### 初始化新数据与登录

选择实际运行的代理，以下只是示例。代理 URL 中的认证信息、非 loopback 主机、HTTPS／SOCKS、
路径、查询参数与片段均拒绝；`localhost` 有意排除，以免依赖 DNS 路由。

```powershell
$proxy = 'http://127.0.0.1:8080'
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy
node scripts/install-suite.mjs init --runtime $runtime --data $data --proxy-url $proxy --apply
$env:DSH_HOME = $data
node "$runtime/node_modules/@deepseek-ai/dsh/lib/bin.js" --profile web
```

数据目录必须尚不存在。初始化创建 web/headless provider 配置、指向相同运行依赖树的 profile
node_modules junction，以及完整 Grok preset；不复制旧设置、凭据或聊天。
全局默认保持 standard。在 DSH 内完成自己的 SuperGrok OAuth 登录，从实时目录选择模型，
需要时选用 Grok 优化模式。启动和登录均由用户执行，安装工具不代办。
手动 headless 使用时选择 headless profile，并提供固定 DSH CLI 支持的参数。

### 离线安装组合验证

```powershell
npm run test:installed -- --work-dir $work
```

测试在构建目录下创建自己的全新运行和数据目录，用合成 adapter 验证真实 web/headless 加载。
不使用上面的 runtime/data 变量或生产安装；同时检查 dry-run、非法代理及可恢复替换／回滚。

### 回滚

使用安装命令输出的精确回执；应用前停止使用目标运行环境，工具不管理进程。

```powershell
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path>
node scripts/install-suite.mjs rollback --runtime $runtime --receipt <absolute-receipt-path> --apply
```

运行环境标记须匹配回执。被替换环境保留在该事务的 `rolled-back` 中；存在更早的受管理环境时恢复它。
首装回滚后目标运行目录不存在。用户数据不回退、不删除、不重写。

旧 `Install-GrokOptimizedPreset.ps1`／`Rollback-GrokOptimizedPreset.ps1` 继续按原两份 YAML 更新契约测试。
新组合安装使用上述完整 preset。历史 xAI API 部署工具不属于本流程。

新版 DSH 使用不同的会话存储格式。请为本预览版选择新的运行与数据目录；本工具不迁移旧聊天，运行程序回滚不等于数据格式降级。
