# SuperGrok for DeepSeek Harness（DSH）

[English](README.md)

将你的 SuperGrok 订阅通过 OAuth 登录接入 DeepSeek Harness（DSH），并提供专属 Grok 优化模式。
通过自己的 DSH 登录授权，无需 xAI API key；可用模型与 reasoning 选项以账户实时目录和兼容安装为准。

仓库包含 provider、Grok 预设、原生工作状态与历史图片扩展，以及可复现的 DSH 核心补丁。
首版安装支持 **Windows + Node.js 24**。本次保持仓库私有，改变可见性另行决定。

## 兼容组合

| 组件 | 版本与用途 |
| --- | --- |
| SuperGrok provider | `0.7.0-hardened.1`，新增必填显式代理 |
| Grok 优化预设 | `0.8.0` |
| DSH 核心补丁组合 | `0.1.2-rc.1.grok.2`，上游精确提交 `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| 上游启动器 | `@deepseek-ai/dsh@0.1.2-rc.1`，搭配本仓库构建的五个核心包 |
| 图片历史、图片召回、工作状态扩展 | 均为 `1.1.0` |
| Bridge（可选） | 须另行验证新版包哈希与代理契约，不沿用旧版信任结论 |

完整来源与锁定关系见 [组件锁](components.lock.json)、[源码来源](UPSTREAM-PROVENANCE.md)。

## 主要行为

- 必须配置 `proxyUrl`：首版接受无认证的本地 loopback HTTP 代理，仅限数字地址 `127.0.0.1` 或 `[::1]`。
  OAuth、目录、额度和推理共用同一 dispatcher；未配置或配置非法时明确报错且不联网。
  不读取系统代理，不直连回退；修改代理后需要重新加载 provider。
- 额度看板只读展示服务返回值及缓存新鲜度。额度缺失、过期分别呈现，不将额度换算为 token 单价或账单。
- 图片准备提示由 host 记录并可回放；请求预算覆盖完整序列化请求，默认 **40,000,000 字节**，超限在发送推理前拒绝。
  历史图片召回输入保持 `{attachmentId, occurrence?}`，附件权限和身份由 DSH 校验。
- 全局默认仍为 `standard`。本地 standard 与 Grok 模式各挂载一次图片召回，工作状态扩展仅属于 `grok-optimized`。
  来源锁明确区分上游 standard、本地 standard 扩展和 Grok 专属能力。
- 子 Agent 默认继承模型，跨模型选择沿用原生显式开放机制。不写死 Grok 型号，不启动另一套 Agent 运行时。

## 构建、安装与验证

干净检出后先运行 `npm ci --ignore-scripts`、`npm run verify`。
[Windows 指南](deployment/windows/README.md) 提供完整构建、安装、初始化、启动及回滚命令。
构建输出位于明确指定的仓库外目录，不依赖已安装的 DSH、私有压缩包或个人 staging 路径。
安装默认 dry-run，应用时验证输入哈希和精确目标；先安装候选目录，再可恢复替换。
数据初始化仅支持新目录，保留既有会话与设置，工具不管理 DSH 进程。

测试只使用合成凭据和模拟服务。源码及依赖下载需要网络，离线测试不请求真实 OAuth、模型目录或模型。
组合测试在独立安装中加载 web/headless，并使用合成 adapter 和自有本地 HTTP 服务。
离线通过、生产加载、线上模型验收是不同结论；详见 [验证及公开前清单](docs/VALIDATION.md)。

Bridge 是可选配套，需要按实际安装包哈希另行配置本地信任；此次不修改 Bridge 仓库和信任设置。
[旧 xAI API 合约](contracts/xai-dsh/README.md) 仅作历史参考，不进入默认安装流程。

原 [MIT 版权声明](LICENSE) 保留，自有新增内容沿用 MIT；适用的 Grok Build 衍生内容保留
[Apache-2.0 许可与署名](THIRD-PARTY-NOTICES.md)。源码许可不代表订阅授权或服务使用授权。
本项目是独立集成。
