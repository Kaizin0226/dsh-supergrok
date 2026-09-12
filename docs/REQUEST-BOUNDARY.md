# Request boundary / 请求发送边界

## English

Provider 0.8.0-hardened.1 exposes the optional Cordis serial event
`grok-oauth/before-model-request` and service `grokRequestBoundary` with
`{ protocolVersion: 1, everyModelPost: true }`.

Immediately before each inference POST, the provider awaits the event with a
frozen object containing `sessionId`, `purpose`, `provider`, `model`,
`reasoningEffort` and `signal`. The purpose defaults to `agent`; an absent
reasoning effort is `null`. The object excludes credentials, prompts and images.
No subscriber is required. A thrown error or cancellation prevents that POST.
A returned `{ disableAutomaticRetries: true }` prevents the provider's automatic
401 token-refresh replay for that call. Otherwise the existing refresh behavior
is preserved, and any subsequent POST passes through the event again.

This hook is an extension point, not an installed budget manager or a replacement
for DSH permissions. The full serialized request budget and required explicit
proxy apply independently. OAuth, catalog and read-only usage requests are not
inference POSTs and are outside this event.

## 简体中文

Provider 0.8.0-hardened.1 提供可选 Cordis 串行事件
`grok-oauth/before-model-request`，并通过 `grokRequestBoundary` 服务声明
`{ protocolVersion: 1, everyModelPost: true }`。

每次推理 POST 前，provider 等待事件检查完成。冻结的参数对象仅包含 `sessionId`、
`purpose`、`provider`、`model`、`reasoningEffort` 和 `signal`；用途默认 `agent`，
缺失的 reasoning effort 为 `null`，不包含凭据、提示词或图片。无需安装订阅者。
检查抛出错误或请求取消时不发送该 POST。返回 `{ disableAutomaticRetries: true }`
会禁止本次调用在收到 401 后自动刷新 token 并重发；否则保留既有刷新行为，后续每个 POST
仍须再次经过检查。

该接口是扩展点，不代表已经安装额度管理器，也不替代 DSH 权限。完整序列化请求预算和
必填显式代理独立生效。OAuth、目录和只读额度请求不是推理 POST，不经过本事件。
