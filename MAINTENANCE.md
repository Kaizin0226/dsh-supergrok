# Native provider maintenance / 原生 provider 维护

## English

DSH 0.2 owns tools, permissions, sessions and attachment storage. The provider implements the native prepared-call interface and uses the authenticated catalog as its only model and reasoning-effort source. Each prepared call binds the captured catalog snapshot, model, effort and image request target. Expiration or route drift fails closed; no model substitution or automatic retry occurs.

`maxRequestBodyBytes` is a positive integer with a default of 40,000,000 bytes. This is a local limit, not an official service limit. It counts the complete serialized UTF-8 request, including tools and every image occurrence. Oversized requests fail with `REQUEST_BODY_TOO_LARGE` before an inference POST. Catalog resolution may already have occurred. Offloaded native images become text placeholders without reading image bytes; the provider does not evict attachments or split requests to fit the budget.

Prepared image data is bound to its captured occurrences and route. DSH owns the native attachment lifecycle. This release does not promise the retired host's image-preparation notice persistence, recall tools or work-state summaries. Provider package and protocol snapshot versions are managed separately. HTTP 426 is terminal and does not trigger protocol negotiation or resending.

Maintain the two native plugins and pinned official runtime together. Use synthetic fixtures with real service access blocked. Run [validation](docs/VALIDATION.md) after relevant changes and review dependency lock updates before distributing packages. Live OAuth and model acceptance remain outside the preview's verified scope. See [installation](docs/INSTALLATION.md) for recoverable replacement.

## 中文

DSH 0.2 管理工具、权限、会话和附件存储。provider 实现原生 prepared-call 接口，认证目录是唯一模型及推理档位来源。每次准备调用绑定捕获的目录快照、模型、effort 和图片请求目标；过期或路由漂移时拒绝，不替换模型、不自动重试。

`maxRequestBodyBytes` 为正整数，默认 40,000,000 字节。这是本地限制，不是官方服务限制；统计完整序列化 UTF-8 请求，包括工具和每次图片出现。超限以 `REQUEST_BODY_TOO_LARGE` 拒绝，不发送推理 POST；此前可能已解析目录。原生卸载图片转为文字占位，不读取图片字节；不驱逐附件、不拆分请求以适配预算。

准备后的图片数据绑定对应出现项和捕获路由，原生附件生命周期由 DSH 管理。本版不承诺退役 host 的图片准备提示持久化、召回工具或工作状态摘要。provider 包版本和协议快照版本分别维护；HTTP 426 为终止错误，不触发协议协商或重发。

维护两个原生插件及固定官方运行环境，测试使用合成数据并阻断真实服务。相关变更后执行[验证](docs/VALIDATION.md)，分发前审核依赖锁变更。真实 OAuth 和模型验收不属于本预览版已验证范围。可恢复替换方法见[安装指南](docs/INSTALLATION.md)。
