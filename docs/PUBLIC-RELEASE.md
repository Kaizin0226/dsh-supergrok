# Release policy / 发行规范

## English

Releases cover SuperGrok OAuth integration with DSH and its dedicated
Grok-optimized mode, together with their required supporting implementation.

Developer previews distribute source and reproducible Windows build and
installation tools. They are marked as prereleases and do not include
precompiled assets or npm publication. Published versions and compatibility
details are listed in the [release notes](RELEASE-NOTES.md).

### Release requirements

- A release identifies an immutable source commit, a unique version tag and
  the successful CI run for that commit. Published tags remain fixed;
  source corrections use a new version. Release descriptions may be corrected
  without moving their tags.
- English and Simplified Chinese notes describe the supported component
  combination, installation method, changes, completed validation and known
  limitations. README translations share one file. Public text must be
  self-contained and free of internal progress updates or drafting placeholders.
- Source and history scans, package-content checks and relevant tests must
  pass. Review security advisories for both production and development
  dependencies. Changes to build or installation inputs require corresponding
  build and installed-composition verification.
- Preserve upstream authors, licenses and notices. Maintainer commits use
  `38362307+Kaizin0226@users.noreply.github.com`. Reassess
  [service access](SERVICE-ACCESS.md) when implementation or upstream terms
  change; source licensing does not grant service authorization.
- Releases and repository visibility changes require owner authorization for
  their scope. Documentation changes do not themselves authorize unrelated
  account, installation or visibility changes.

### Privacy and distribution

Credentials, account data, private runtime material and personal operational
records are excluded from source, packages, documentation and public logs.
Review files, commit metadata, links and image metadata, together with relevant
GitHub references, Actions logs, artifacts and attachments. Keep sensitive
review evidence and support requests outside Git.

Git history rewriting does not remove all cached objects, logs or downloaded
copies. Address newly discovered private-data exposure before further release
distribution. See [GitHub's removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
and [visibility effects](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).

Verify public access to documentation, source downloads and release links.
Maintain private vulnerability reporting, secret scanning and push protection;
the reporting channel is documented in [SECURITY.md](../SECURITY.md). Offline
test results and live-service validation must be reported separately.

## 简体中文

发行范围仅限 SuperGrok OAuth 接入 DSH 和专属 Grok 优化模式，以及必需的配套实现。

开发者预览版提供源码及可复现的 Windows 构建、安装工具，标记为预发行，不附预编译包，
不发布 npm。已发布版本与兼容信息见[发行说明](RELEASE-NOTES.md)。

### 发行要求

- 每个版本对应不可变源码提交、唯一版本标签及该提交成功的 CI。已发布标签保持固定，
  源码修正使用新版本；发行说明可以修订，无需移动标签。
- 中英文说明包括支持的组件组合、安装方法、变更、已完成验证和已知限制；README 两种语言
  放在同一文件。对外内容须能独立理解，不夹带内部进度或起草占位内容。
- 源码与历史扫描、包内容检查及相关测试须通过，同时检查生产和开发依赖的安全公告。
  构建或安装输入变化时，执行相应构建及安装组合验证。
- 保留上游作者、许可证及署名。维护者提交使用 `38362307+Kaizin0226@users.noreply.github.com`。
  实现或上游条款变化时重新评估[服务接入](SERVICE-ACCESS.md)；源码许可不授予服务权限。
- Release 发布和仓库可见性变更须在所有者授权范围内执行。文档修改本身不授权无关账户、
  本机安装或可见性变更。

### 隐私与分发

源码、包、文档及公开日志不得包含凭据、账户数据、私有运行资料或个人操作记录。
检查文件、提交元数据、链接及图片元数据，同时检查相关 GitHub 引用、Actions 日志、产物和附件。
含敏感内容的核查证据及支持请求保存在 Git 外。

Git 历史改写不能移除全部缓存对象、日志或已下载副本。发现新的私有数据暴露时，
须在继续分发前处理。参见 [GitHub 清理说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
和[可见性变更影响](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)。

核验文档、源码下载及发行链接的公开访问，维护私密漏洞报告、密钥扫描和推送保护。
安全反馈入口见 [SECURITY.md](../SECURITY.md)。离线测试与真实服务验证须分别表述。
