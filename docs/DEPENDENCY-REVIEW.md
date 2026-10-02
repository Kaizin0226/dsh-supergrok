# Dependency review / 依赖核查

Reviewed / 核对日期: **2026-10-03**.

## English

The reviewed inputs are provider `npm-shrinkwrap.json` (production and development),
`build-locks/runtime.lock.json` (official DSH and installation toolchain), and
`build-locks/profile.lock.yaml` (native plugin dependencies).
Current registry audit results report **zero known advisories** for these final
graphs. This is a point-in-time registry result, not proof of absence of vulnerabilities.

The provider updates Undici from 7.29.0 to **7.30.0** after new upstream advisories,
including [GHSA-w293-vg96-wgc3](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3).
The official runtime remains DSH 0.2.0-rc.2; its dependency graph overrides
**fflate 0.8.3** to address [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98).
The override changes dependency resolution, not DSH source packages.
pnpm is fixed at **11.28.3** and Playwright at **1.63.0**. Browser tooling is a
development dependency and is not installed in the suite runtime.

Installation disables lifecycle scripts. Native profile installation consumes
the reviewed registry graph, refreshing only integrity of source-built local
tarballs and rejecting unexpected lock changes. Audits require registry access;
functional tests use synthetic services and block real model/OAuth requests.
The old upstream source workspace, retired extensions and their development
tools are not build inputs in this preview.

## 中文

本次核查 provider shrinkwrap（生产与开发）、官方 DSH／安装工具链 runtime lock
以及原生插件 profile lock。最终依赖图的当前注册表检查均报告**零已知公告**；
这只是核对时结果，不证明不存在漏洞。

provider 根据新公告将 Undici 从 7.29.0 更新为 **7.30.0**。
host 保持官方 DSH 0.2.0-rc.2，运行依赖图固定覆盖 **fflate 0.8.3** 以修复上述公告；
仅改变依赖解析，不改 DSH 源码包。
pnpm 固定 **11.28.3**，Playwright 固定 **1.63.0**；浏览器工具仅为开发依赖，不安装到运行环境。

安装禁用生命周期脚本，原生 profile 使用已核查依赖图，只刷新本地源码 tarball 完整性，
拒绝意外锁变更。漏洞检查访问注册表，功能测试只用合成服务，阻断真实模型／OAuth。
旧上游工作区、退役扩展及其开发工具不再是本版本构建输入。
