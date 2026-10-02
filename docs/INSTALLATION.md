# Native Windows installation / Windows 原生安装

## English

Use Windows, Node.js 24 and npm. Run from a source checkout. Choose separate
absolute paths for build output, runtime, backups and a new DSH home.
Runtime, home and backups must share a drive for recoverable renames.

~~~powershell
npm ci --ignore-scripts
npm run verify
$SuiteRoot = (Resolve-Path '..').Path
$Build = Join-Path $SuiteRoot 'native-build'
$Runtime = Join-Path $SuiteRoot 'native-runtime'
$Data = Join-Path $SuiteRoot 'native-home'
$Backups = Join-Path $SuiteRoot 'native-backups'
node scripts/build-suite.mjs --work-dir $Build
node scripts/install-suite.mjs install --bundle (Join-Path $Build 'bundle') --runtime $Runtime --data $Data --backups $Backups --profile web --proxy-url http://127.0.0.1:8080
~~~

Review the dry-run, then repeat the install command with `--apply`. Use your own
listening proxy port. The helper does not start or configure a proxy.
It packs two native plugins, downloads the locked official runtime, and invokes
official `dsh plugin --profile web add <local-tarball>` with lifecycle scripts disabled.
Proxy configuration is written before validating the composed profile.
Use `--profile headless` with another independent managed runtime/home for headless.
The helper composes headless with the official preset registry, standard agent
configuration and sub-agent model-selection settings from the pinned runtime.
This supplies the native services required by both presets without core patches.
Headless does not provide the provider's interactive Web login interface; the
synthetic headless check does not verify a live account authorization workflow.

Start DSH yourself and complete your own account authorization:

~~~powershell
$env:DSH_HOME = $Data
$env:DSH_TELEMETRY_DISABLED = '1'
node (Join-Path $Runtime 'node_modules/@deepseek-ai/dsh/lib/bin.js') web --host 127.0.0.1 --no-open
~~~

Replacement requires this tool's matching 0.2 runtime, home and profile. Stop the
application yourself first. Unknown targets, unowned homes, links/junctions and
0.1 installations are rejected. Profiles with additional dependencies must be
maintained through the official manager. Existing profile settings are retained;
the explicitly supplied proxy overrides the managed provider proxy.

Use the exact receipt path printed by installation:

~~~powershell
node scripts/install-suite.mjs rollback --runtime $Runtime --receipt $Receipt
# After reviewing the dry-run:
node scripts/install-suite.mjs rollback --runtime $Runtime --receipt $Receipt --apply
~~~

Rollback restores runtime and managed profile, preserving displaced files.
It does not downgrade data formats, migrate chats or change session data.
No process is started, stopped or restarted.

Synthetic installed validation uses an isolated browser directory:

~~~powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $Build 'browsers'
node node_modules/playwright/cli.js install chromium
node scripts/test-installed.mjs --work-dir $Build
~~~

Source-only releases do not supply precompiled downloads. Local tarballs are not
npm releases. Repository locks and generated manifests record dependency integrity.
`--update-locks` is a maintainer review operation, not a normal installation step.

## 中文

使用 Windows、Node.js 24 和 npm，从源码目录执行以上命令。
构建输出、运行目录、备份和新 home 必须是不同绝对路径；
运行目录、home、备份须同盘，以便可恢复移动。示例不是生产路径。

先检查默认 dry-run，再为相同安装命令添加 `--apply`。使用自己监听的代理端口，
工具不启动或配置代理。构建打包两个插件及锁定官方运行环境，通过官方
`dsh plugin --profile web add <本地 tarball>` 安装，禁用依赖生命周期脚本，
写入代理后再验证组合。headless 使用另一组独立目录和 `--profile headless`。
工具为 headless 组合固定官方运行环境中的预设注册器、standard Agent 配置及
子 Agent 模型选择设置，提供两个预设需要的原生服务，不修改核心。
headless 不提供 provider 的 Web 交互登录界面；合成 headless 验收不代表
真实账户授权流程已经验证。

自行启动 DSH 并完成自己的账户授权。替换前自行停止应用。
替换只适用于本工具管理且运行目录、home、profile 一致的 0.2 环境；
拒绝未知目标、未受管理 home、链接／junction 及 0.1 环境。
增加其他依赖后须通过官方管理器维护。保留已有 profile 设置，同时应用显式传入的代理。

回滚须指定安装输出的精确 receipt，默认 dry-run；添加 `--apply` 后恢复运行文件和
受管理 profile，保留被替换文件。不降级数据格式、不迁移聊天、不修改会话数据，
也不启动、停止或重启进程。

合成安装验收使用隔离浏览器目录及上述命令。发行只含源码，
本地 tarball 不是 npm 发行。仓库锁及 manifest 记录完整性；
`--update-locks` 仅供维护者核查依赖变更，普通安装无需使用。
