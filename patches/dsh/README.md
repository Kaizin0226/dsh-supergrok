# Reviewed DSH source overlay

`source.lock.json` identifies the public upstream tag and immutable commit.
The patch includes the original rc.1 port plus input-preparation changes and
their tests, including the newly added preparation test. It contains no build
output or local installation state. DSH's MIT copyright is retained here.

Run the repository build script with an explicit disposable `--work-dir`.
It exports only the locked Git tree (ignoring the supplied checkout's working
files), applies the patch, installs the frozen upstream dependencies and runs
the upstream host/client/web build. Package output remains outside Git.
An optional `--upstream-source` can identify a local Git checkout containing
the exact tag; it is a source input, never a production runtime.

Core package versions intentionally differ: session and session-controller
retain the rc.1 port version, while LLM, AgentLoop and the locally extended
standard preset use the input-preparation release. Global default remains
standard; the work-state extension is not part of the standard composition.

## 中文：已审核的 DSH 源码补丁

`source.lock.json` 指定公开上游标签及不可变提交。补丁包含原 rc.1 移植、输入准备修改及测试，
包括新增准备测试；不含构建产物或本机安装状态，保留 DSH 的 MIT 版权。

运行仓库构建脚本时显式指定可丢弃的 `--work-dir`。构建只导出锁定 Git 树，不读取提供的检出目录中
未提交文件；应用补丁，安装冻结的上游依赖，构建 host/client/web，包产物留在 Git 外。
可选 `--upstream-source` 指向包含精确标签的本地 Git 克隆，仅作为源码输入，不是生产运行目录。

核心包版本有意不同：session 与 session-controller 保留 rc.1 移植版本，LLM、AgentLoop 和本地扩展
standard 使用输入准备版本。全局默认 standard；工作状态扩展不属于 standard 组合。
