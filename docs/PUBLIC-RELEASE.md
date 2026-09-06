# Public-release procedure / 公开流程

## English

Target: `suite-v0.7.0-preview.1`, source-only developer preview. Keep the name
`dsh-supergrok` and prefer the existing repository. Unresolved historical privacy
remnants mean staying private, without automatic recreation, migration or renaming.
Preparation and a draft release do not authorize visibility changes or publication;
the owner separately approves the final concrete candidate.

Before requesting that decision:

1. Review reachable refs, author/committer identities, messages, files, links
   and image metadata. Maintainer commits use
   `38362307+Kaizin0226@users.noreply.github.com`; upstream identities stay intact.
2. Review Actions metadata/logs, artifacts, old commit URLs, PR refs, releases
   and other platform content. Resolve private remnants, including old commits
   reachable by exact SHA. Keep sensitive evidence and cleanup requests outside
   Git. [Rewriting does not clear all GitHub copies](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
   Prepare a Support request if needed; submit only after owner confirmation.
3. Recheck [service access](SERVICE-ACCESS.md), licenses and notices. Record
   unresolved support boundaries accurately. Stop publication on a definite
   implementation/terms conflict; a disclaimer is not a remedy.
4. Require repository/history scans, package-content review and successful CI
   for the exact candidate. Review advisories for its locked production graph.
   Rebuild/retest changed code or installation inputs; offline success is not
   live-service acceptance.
5. Prepare a draft prerelease targeting the exact candidate and tag name
   `suite-v0.7.0-preview.1`, with bilingual notes, no precompiled assets and no
   npm publication. The owner-facing checklist identifies commit, CI and remaining
   limits; retain it outside Git if it contains private evidence.

After explicit authorization, change visibility only for the approved repository
and candidate. Verify without authentication: README, source download, logs,
links and old-SHA privacy checks. Enable private vulnerability reporting, verify
its entry point and review available secret-scanning/push-protection settings.
Publish the draft only after these checks pass. If exposure is found, stop release
publication and report immediately; changing back to private cannot recall copies
or forks. See [GitHub visibility effects](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).

## 中文

目标为 `suite-v0.7.0-preview.1` 源码开发者预览版。保留 `dsh-supergrok` 名称，优先原仓库。
历史隐私残留未解决时继续私有，不自动重建、迁移或改名。准备工作与 Release 草稿不授权改变
可见性或正式发布；最终可审核候选由所有者单独确认。

请求最终决定前：

1. 检查可达引用、作者与提交者身份、提交信息、文件、链接及图片元数据。
   维护者使用 `38362307+Kaizin0226@users.noreply.github.com`，保留上游身份。
2. 检查 Actions 元数据与日志、产物、旧提交地址、PR 引用、Release 及其他平台内容。
   解决私密残留，包括可按精确 SHA 读取的旧提交。证据与清理请求留在 Git 外。
   [历史改写不能清除所有 GitHub 副本](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。
   必要时准备 Support 请求，所有者确认后再提交。
3. 复核[服务接入](SERVICE-ACCESS.md)、许可及署名，准确记录未确定的支持边界。
   发现实现与明确条款冲突时暂停发布，不能用免责声明解决。
4. 候选须通过源码与历史扫描、打包内容检查和精确提交的 CI，并检查锁定生产依赖的安全公告。
   改动代码或安装输入后重建、运行相关测试；离线成功不等于线上验收。
5. 为精确候选准备标签名为 `suite-v0.7.0-preview.1` 的预发行草稿，中英双语说明，
   不附预编译包、不发布 npm。审核清单列出提交、CI 和剩余限制；含私密证据时留在 Git 外。

所有者明确授权后，只改变获批仓库和候选的可见性。用未登录视角核对 README、源码下载、日志、
链接及旧 SHA 隐私检查；启用私密漏洞报告并验证入口，复核可用的密钥扫描与推送保护。
全部通过才发布草稿。发现暴露时停止 Release 发布并立即报告；改回私有无法收回副本或 fork。
参见 [GitHub 可见性影响](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)。
