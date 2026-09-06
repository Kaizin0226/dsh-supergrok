# SuperGrok input maintenance

The provider uses the authenticated dynamic catalog. No model version is a default in this package. DSH owns tools, sessions, permissions and the model-visible history.

`maxRequestBodyBytes` is a validated positive integer. The deployment default is 40,000,000 bytes, a local budget rather than an official API limit. The adapter counts the final serialized UTF-8 body, including text, tools and every image occurrence. An oversized request fails with `REQUEST_BODY_TOO_LARGE` before inference authentication or POST; catalog resolution may already have occurred. No image eviction, automatic splitting or provider fallback occurs.

The optional prepared-input API resolves durable image versions once per call using DSH's attachment service. It returns notices separately from serialization, for the host to log before sending. Images unchanged in dimensions, byte count and format produce no transformation notice. Changed images report preparation, not successful delivery. Prepared bytes remain bound to the image occurrences and exact captured route.

Original durable attachments and provider call IDs are not changed. Tests use synthetic attachments and stubbed network responses. Online acceptance is a separate authorization step.

## 中文：输入维护

provider 使用认证后的动态目录，包内不设置默认型号。工具、会话、权限和模型可见历史由 DSH 管理。

`maxRequestBodyBytes` 必须是合法正整数，部署默认值为 40,000,000 字节。这是本地预算，不是官方 API 限制。
适配器统计最终序列化 UTF-8 请求体，包括文字、工具与每次图片出现。超限时在推理认证或 POST 前以
`REQUEST_BODY_TOO_LARGE` 拒绝；此前可能已解析目录。不驱逐图片、不自动拆分或回退 provider。

可选 prepared-input API 每次调用通过 DSH 附件服务解析一次持久图片版本，提示与序列化结果分离，
由 host 在发送前记录。尺寸、字节数、格式未变的图片不产生转换提示；变化提示仅表示准备完成，不代表发送成功。
准备字节绑定到对应图片出现项和精确捕获路由。

原持久附件与 provider call ID 不变。测试使用合成附件和模拟网络响应；线上验收单独授权。
