# Validation results and scope / 验证结果与范围

## English

The results below cover [suite-v0.7.0-preview.2](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2),
source commit `021738367ccb7967a765cbd67722db124e18b152`, on Windows with Node.js 24.
[CI run 34062689111](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34062689111)
passed all 796 tests and the build, installation and rollback checks.

| Check | Scope and result |
| --- | --- |
| Clean pinned DSH build | Exact upstream commit exported and repository patch applied; host/client/web build passed |
| Core regression tests | 613 passed, including input preparation and session lifecycle |
| Provider and scanner tests | 117 passed with mocked transport |
| Historical-image extensions | 39 passed, including Cordis Loader composition |
| Work-state extension | 16 passed against independently installed packages |
| Historical contracts | 11 legacy contract tests passed |
| Installed web/headless | Actual profiles loaded the provider; synthetic inference only |
| Preset isolation | Standard default; one recall extension per local mode; work-state context only in Grok mode |
| Installation and rollback | Clean locked installation, default dry run, new-data guard, replacement and exact-receipt rollback passed |

Tests cover missing or stale usage data, invalid or missing proxies, shared
dispatcher ownership, failed catalog refresh, preparation-notice replay,
cancellation, repeated images, request-budget boundaries and zero inference
requests after rejection. Test runners remove inherited API credentials and
use synthetic data. Provider tests block socket/fetch access; installed-profile
tests allow only their own local HTTP listener. Source and dependency downloads
are distinct from these offline tests.

Registry dependencies are fixed in `build-locks/`. Build scripts regenerate
integrity values for locally built tarballs without changing registry versions.
The portable bundle verifies package, dependency-lock and preset inputs before
installation or replacement. CI pins Actions to full commit SHAs, scans reachable
Git history, builds the fixed public upstream source and tests the installed
combination. A later commit requires its own applicable verification.

### Validation limits

- **Offline validation:** the build, simulated service behavior and isolated
  installed-profile loading described above.
- **Production installation:** existing installations and data migration are
  outside this validation. Compatibility must be checked for the actual
  installation and component versions.
- **Live services and UI:** real OAuth, live model and image inference, and the
  production usage-panel UI have not been validated. No account screenshots or
  live-service requests are included in these results.

The [release policy](PUBLIC-RELEASE.md), [release notes](RELEASE-NOTES.md) and
[service-access review](SERVICE-ACCESS.md) describe distribution requirements,
version changes and service limitations.

## 简体中文

以下结果对应 Windows＋Node.js 24 环境中的
[suite-v0.7.0-preview.2](https://github.com/Kaizin0226/dsh-supergrok/releases/tag/suite-v0.7.0-preview.2)，
源码提交为 `021738367ccb7967a765cbd67722db124e18b152`。
[CI 34062689111](https://github.com/Kaizin0226/dsh-supergrok/actions/runs/34062689111)
的 796 项测试及构建、安装和回滚检查全部通过。

| 检查 | 范围与结果 |
| --- | --- |
| 固定 DSH 干净构建 | 导出精确上游提交并应用仓库补丁；host/client/web 构建通过 |
| 核心回归测试 | 613 项通过，覆盖输入准备和会话生命周期 |
| Provider 与扫描测试 | 117 项通过，使用模拟传输 |
| 历史图片扩展 | 39 项通过，包含 Cordis Loader 组合 |
| 工作状态扩展 | 独立安装包上 16 项通过 |
| 历史合约 | 11 项历史合约测试通过 |
| 安装后的 web/headless | 真实 profile 加载 provider，仅执行合成推理 |
| 预设隔离 | 默认 standard；两种本地模式各一次召回，仅 Grok 模式挂载工作状态 |
| 安装与回滚 | 干净锁定安装、默认 dry-run、新数据保护、替换及精确回执回滚通过 |

测试覆盖额度缺失或过期、代理缺失或非法、共享 dispatcher 归属、目录刷新失败、
准备提示回放、取消、重复图片、请求预算边界及拒绝后的零推理请求。
测试清除继承的 API 凭据并使用合成数据；provider 测试阻止 socket/fetch 网络，
安装 profile 测试仅允许自己的本地 HTTP 服务。源码及依赖下载与这些离线测试相互独立。

注册表依赖固定在 `build-locks/`。构建脚本按实际字节重新生成本地包完整性值，不改变注册表版本。
安装组合在安装或替换前验证包、依赖锁及 preset 输入。CI 的 Actions 固定完整 SHA，
扫描可达 Git 历史，从固定公开上游源码构建并测试实际安装组合。后续提交须进行各自适用的验证。

### 验证限制

- **离线验证**：上述构建、模拟服务行为及隔离安装加载。
- **生产安装**：既有安装和数据迁移不在本验证范围内，兼容性须按实际安装及组件版本确认。
- **真实服务与界面**：未验证真实 OAuth、模型和图片推理及生产额度面板；这些结果不包含
  账户截图或真实服务请求。

[发行规范](PUBLIC-RELEASE.md)、[发行说明](RELEASE-NOTES.md)和
[服务接入评估](SERVICE-ACCESS.md)分别说明分发要求、版本变化及服务限制。
