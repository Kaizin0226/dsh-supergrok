# Validation and public-release checklist

English follows; [中文](#中文验证与公开前清单) is included below.

The supported development and test runtime is Node.js 24 on Windows.

| Check | Scope and result |
| --- | --- |
| Clean pinned DSH source build | Exact upstream tag commit exported, checked-in patch applied; host/client/web build passed |
| Core regression tests | 613 tests passed across 33 files, including newly imported input preparation coverage |
| Provider and scanner unit tests | 117 passed; mocked transport only |
| Historical-image extensions | 39 passed, including real Cordis Loader composition |
| Work-state extension | 16 passed against independently installed packages |
| Installed web/headless | Actual profiles load the new provider; synthetic inference only |
| Preset isolation | Default standard; recall once in each local mode; work-state once in Grok mode only |
| Installer | Clean locked installation, no-op dry run, new-data guard, replacement and exact-receipt rollback passed |
| Historical contract/deployment checks | 11 legacy contract tests and the PowerShell deployment regressions passed |

The complete tests cover missing/stale usage, missing or invalid proxies, shared
dispatcher ownership, failed dynamic catalog refresh, input-preparation notice
replay, cancellation, repeated images, full request budgets and zero inference
requests on rejection. Test runners remove inherited API credentials and use
synthetic data. Provider tests block socket/fetch access; installed profile
tests allow only their own local HTTP listener. They never log in or send a
real model request. Build and npm dependency downloads are separate from tests.

Registry dependency resolutions are checked into `build-locks/`. Locally built
tarball integrity values are regenerated from the resulting bytes without
changing registry versions. The portable bundle checks all package, lock and
preset inputs before candidate installation and before replacement. Package
checks are local; this project does not publish to npm.

CI pins Actions to full commit SHAs, checks full reachable Git history, builds
from the fixed public upstream source and verifies the installed combination.
Use the workflow run for the exact submitted commit as the hosted-CI result;
local success alone does not establish that result.

## Separate acceptance levels

1. **Offline acceptance:** builds, contracts, simulated provider behavior and
   isolated installed-profile loading described above.
2. **Production loading:** must be checked separately against the user's
   explicitly chosen local installation. This update does not modify it.
3. **Online model/UI acceptance:** requires separate account authorization and
   real service checks. No such requests or production screenshots are part of
   this release. In particular, real image inference and production usage-panel
   visual acceptance are not claimed by the offline tests.

## Before changing repository visibility

- Confirm source, docs, commit messages, author/committer identities and link
  targets contain no private data. Repository and history scans cover both
  Windows separators, common private POSIX paths and image metadata. Current
  documentation contains no account screenshots.
- Preserve upstream authors and copyrights. Maintainer commits use
  `38362307+Kaizin0226@users.noreply.github.com`.
- Inspect GitHub-side old commit links, pull-request refs, Actions logs and
  artifacts, releases, attachments and other cached content. Rewriting branch
  history does **not** erase all GitHub copies or old Actions logs. Resolve
  relevant remnants before making the repository public.
- Recheck the exact branch heads before any leased history update. If the
  remote has changed, stop instead of overwriting another update.
- Review current service access/terms and third-party notices. Source licensing
  does not confer subscription entitlement or service authorization.
- Make the visibility decision separately. This update keeps the repository
  private and leaves optional Bridge trust configuration to a separate action.

The preview procedure is in [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md), with
[bilingual release notes](RELEASE-NOTES.md) and a dated [service-access review](SERVICE-ACCESS.md).
Any GitHub-side cleanup outcome belongs in the private owner-facing checklist,
not in reusable source documentation. A draft release is not public acceptance.

## 中文：验证与公开前清单

支持的开发和测试环境是 Windows＋Node.js 24。

| 检查 | 范围与结果 |
| --- | --- |
| 固定 DSH 源码干净构建 | 导出精确标签提交、应用检入补丁，host/client/web 构建通过 |
| 核心回归 | 33 个文件共 613 项通过，包含新导入的输入准备测试 |
| Provider 与扫描单元测试 | 117 项通过，仅使用模拟传输 |
| 历史图片扩展 | 39 项通过，含真实 Cordis Loader 组合 |
| 工作状态扩展 | 独立安装包上 16 项通过 |
| 安装后的 web/headless | 真实 profile 加载新 provider，仅合成推理 |
| 预设隔离 | 默认 standard，两种本地模式各一次召回，仅 Grok 模式一次工作状态 |
| 安装工具 | 干净锁定安装、无修改 dry-run、新数据保护、替换及精确回执回滚通过 |
| 历史合约与部署 | 11 项历史合约及 PowerShell 部署回归通过 |

测试覆盖额度缺失／过期、代理缺失／非法、共享 dispatcher 归属、动态目录刷新失败、输入准备提示回放、
取消、重复图片、完整请求预算及拒绝时零推理请求。测试清除继承的 API 凭据并使用合成数据。
Provider 测试阻止 socket/fetch 网络；安装 profile 测试仅允许自己的本地 HTTP 服务，
不真实登录、不调用模型。构建和 npm 下载与这些测试分开。

注册表依赖解析锁在 `build-locks/`，本地构建包的完整性值按实际字节重新生成，但不改变注册表版本。
组合安装在候选安装前和替换前检查所有包、锁和 preset 输入。打包检查只在本地，不发布 npm。
CI 的 Actions 固定完整 SHA，检查全部可达 Git 历史，从固定公开上游源码构建并验证真实安装组合。
托管 CI 结论必须来自精确提交的运行，不能用本地成功代替。

### 三种验收层级

1. **离线验收**：上述构建、合约、模拟 provider 行为和隔离安装加载。
2. **生产加载**：须针对用户显式选择的本机安装单独检查，本更新不修改它。
3. **线上模型／UI 验收**：须单独账户授权和真实服务检查，本发行不包含这些请求或生产截图。
   尤其不能用离线测试宣称真实图片推理或生产额度面板视觉验收通过。

### 改变可见性前

- 检查源码、文档、提交信息、作者／提交者、链接目标无私有数据。扫描覆盖 Windows 两种分隔符、
  常见私密 POSIX 路径与图片元数据；当前文档不含账户截图。
- 保留上游作者与版权，维护者提交使用 `38362307+Kaizin0226@users.noreply.github.com`。
- 检查旧提交地址、PR 引用、Actions 日志与产物、Release、附件及缓存；历史改写不清除全部平台副本，
  解决相关残留后才公开。
- 涉及带 lease 的历史更新前重查精确远端头，发生变化就停止，不覆盖其他更新。
- 复核当前服务条款和第三方说明；源码许可不授予订阅或服务权限。
- 可见性单独决定，准备阶段保持私有；可选 Bridge 信任配置也单独处理。

完整步骤见[公开流程](PUBLIC-RELEASE.md)、[双语首发说明](RELEASE-NOTES.md)和带日期的
[接入评估](SERVICE-ACCESS.md)。GitHub 清理实况记录在 Git 外的私有审核清单，不进入通用源码文档。
Release 草稿不代表公开验收。
