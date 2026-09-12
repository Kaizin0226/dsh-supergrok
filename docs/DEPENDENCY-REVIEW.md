# Dependency review / 依赖检查

Reviewed on 2026-09-13 for suite-v0.8.0-preview.1.

## English

The provider, suite build-kit and installed runtime npm lock graphs reported
zero known vulnerabilities, including their development dependencies. This
result does not cover the complete upstream pnpm workspace.

The exact DSH source lock reports **60 advisory records: 29 high, 28 moderate,
3 low, 0 critical**. These include build tools, the documentation website,
desktop packaging and upstream runtime packages. Counts are dependency audit
records, not confirmed exploitable paths in the distributed combination.
The table lists the affected upstream versions and the independently locked
runtime versions; an absent package is not shipped in that npm graph.

| Package / 包 | Affected upstream versions / 上游受影响版本 | Records / 记录 | Installed runtime / 安装运行环境 |
|---|---|---:|---|
| @hono/node-server | 1.19.14 | 1 | 2.1.1 |
| @vitest/mocker | 4.1.8 | 1 | Absent / 不包含 |
| baseline-browser-mapping | 2.10.43 | 1 | Absent / 不包含 |
| brace-expansion | 5.0.6, 2.1.2 | 5 | Absent / 不包含 |
| browserslist | 4.28.6 | 2 | Absent / 不包含 |
| dompurify | 3.4.11 | 2 | Absent / 不包含 |
| esbuild | 0.21.5 | 1 | Absent / 不包含 |
| extract-zip | 2.0.1 | 2 | Absent / 不包含 |
| fast-uri | 3.1.3 | 6 | 3.1.7 |
| hono | 4.12.29 | 7 | 4.13.7 |
| ip-address | 10.2.0 | 3 | 10.7.0 |
| js-yaml | 4.2.0, 4.3.1 | 3 | 4.3.2 |
| mermaid | 11.16.0 | 5 | Absent / 不包含 |
| nanoid | 3.3.12 | 2 | Absent / 不包含 |
| pnpm | 11.7.0 | 4 | Absent / 不包含 |
| postcss | 8.5.15 | 2 | Absent / 不包含 |
| protobufjs | 7.6.4 | 1 | 7.6.6 |
| qs | 6.15.3 | 2 | 6.16.0 |
| sharp | 0.35.3 | 1 | 0.35.4 |
| undici | 7.28.0 | 5 | 7.29.0, 8.10.2 |
| vite | 5.4.21 | 3 | Absent / 不包含 |
| vitest | 4.1.8 | 1 | Absent / 不包含 |

The reproducible source build retains pnpm 11.7.0 and the pinned upstream lock.
Its known issues include malicious lockfile/configuration path traversal,
tarball manifest paths and workspace proxy expansion:
[config dependencies](https://github.com/advisories/GHSA-qrv3-253h-g69c),
[virtual store](https://github.com/advisories/GHSA-c59q-g84q-2gj5),
[tarball manifests](https://github.com/advisories/GHSA-vq4v-j7r6-jq4m),
[proxy expansion](https://github.com/advisories/GHSA-vx52-2968-3vc6).
The supported builder exports only the fixed upstream commit, applies the
reviewed patch and uses the frozen lock in a separate directory. It is not a
general-purpose installer for untrusted pnpm workspaces. These constraints
reduce exposure; they do not patch pnpm or establish a vulnerability-free build
environment. Updating the pinned toolchain requires a separately validated
dependency revision.

No website development server, desktop package or external model service is
part of this preview's acceptance. Tests use synthetic data and block external
network requests. Development-server and parser findings must not be interpreted
as harmless outside those constraints. Audit results are time-specific and do
not prove the absence of vulnerabilities or validate generated assets by
themselves.

## 简体中文

2026-09-13 对 provider、配套构建工具和安装运行环境的 npm 锁定依赖检查均为零已知漏洞，
包含相应开发依赖；该结果不覆盖上游完整 pnpm 工作区。

固定 DSH 源码锁报告 **60 条告警记录：高危 29、中危 28、低危 3、严重 0**，涉及构建工具、
文档网站、桌面打包和上游运行包。数字代表依赖扫描记录，不是本发行组合中已确认可利用的路径数。
上表同时列出上游受影响版本和独立锁定的安装运行版本；“不包含”表示该包不进入运行 npm 依赖图。

可复现构建保留 pnpm 11.7.0 及上游冻结锁。已知问题包括恶意锁文件／配置的路径穿越、
压缩包清单路径及工作区代理变量展开，依据见上方安全公告。构建器仅导出固定上游提交、
应用已检查补丁，并在独立目录使用冻结依赖；它不用于安装不可信 pnpm 工作区。
这些约束降低暴露面，但不修复 pnpm，也不代表构建环境无漏洞。固定工具链升级需要另行完成
依赖修订与验证。

本预览验收不运行网站开发服务、不生成桌面发行包、不访问真实模型服务；测试使用合成数据并阻断外网。
不能将这些约束下的结果推广为开发服务器或解析器告警没有风险。扫描结果具有时效性，
不能证明不存在漏洞，也不能单独证明生成资源安全。
