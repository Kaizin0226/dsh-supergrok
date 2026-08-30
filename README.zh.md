# DSH SuperGrok OAuth 加固版

此本地构建以
`wangyaominde/dsh-llm-grok-oauth@108cc76224d1845b5c88602f7c7a24bb1ced0497`
为唯一上游基线，版本固定为 `0.3.0-hardened.5`。

它只暴露一个固定 provider，并以登录账号的实时订阅目录作为唯一模型授权来源：

- provider：`grok-oauth`
- 默认 model：`grok-4.6`
- 默认推理强度：`high`
- 预期 DSH 权限：`read-only`

模型选择器只发布已认证订阅目录返回的、未隐藏、文本可用且协议后端受支持的
`grok-*` 模型。目录中的 `supportedInApi` 会做类型与冲突校验，但不会过滤
session OAuth 模型，因为 Grok Build 用该字段控制 API key 可见性。每个模型的
推理等级直接来自该模型自己的实时目录项；选择器 ID 会在投递前映射为目录声明
的 canonical wire value（例如 `deep → xhigh`）。静态列表、登录成功或另一个
模型的授权都不能代替精确授权。
每次推理投递前都会强制刷新一次目录，并以同一个 fresh snapshot 核验模型、
推理等级和后端；未知、已下架或目录刷新失败
都会在推理网络 I/O 前拒绝，不会夹取、别名或回退。
同一安全字段出现在目录项、`info`、`_meta` 或不同命名别名时必须一致；
冲突会令整份目录失败关闭。推理等级条目允许唯一一个 `default: true`，且必须
与独立默认字段一致。完整选择器目录以 `/v1/models` 为准；只有它返回 404/405
时才兼容回退到 `/v1/models-v2`。loopback 同源诊断路由仅暴露受限状态枚举和
计数，不会返回目录值、响应正文、请求头、token 或错误消息。

按需目录缓存时间仍由 `modelsRefreshSeconds` 控制，默认 60 秒，允许范围为
10 到 86400 秒。除此之外，普通 DSH 进程每 3600 秒至多执行一次不重叠的后台
目录同步；只有模型、推理等级或能力指纹
变化时才通知 DSH 刷新选择器。刷新失败会清空旧授权而不是继续使用过期目录。
默认仍为 `grok-4.6/high`，但新目录项不会自动改写生产默认模型。

## 固定安全边界

OAuth、目录和推理全部通过同一个固定 dispatcher 使用
`http://127.0.0.1:7897`。插件没有直连降级、环境变量/系统代理发现、
重定向跟随、curl 回退或可配置端点。网络请求仅限运行时代码声明的：

- `https://auth.x.ai`
- `https://cli-chat-proxy.grok.com/v1`

浏览器授权页只允许 HTTPS 的 `auth.x.ai` 或 `accounts.x.ai`。服务端不会
调用 shell 或自动打开浏览器；用户必须在 DSH 界面手动点击经过校验的链接。

协议头来自固定快照
`xai-org/grok-build@bc7f02eddd3d84085849dc19ed216f11c23b0571`。
客户端名称、版本和 User-Agent 如实标识本插件；若代理返回 HTTP 426，
插件会直接失败，不伪装成官方 Grok 客户端。

## 凭据与登录

每次接入都必须使用全新的 DSH 专用 device login。插件绝不读取、导入、
复制、修改或删除官方 Grok CLI 凭据。令牌只能通过 DSH credential service
写入 `llm-grok-oauth/tokens` GrantRecord（界面标签 `GROK_OAUTH_TOKENS`）。
credential service 不可用或记录无效时立即拒绝，
没有明文文件备用方案。

本地登录管理路由要求：loopback 连接、loopback `Host`、同源浏览器
`Sec-Fetch`、变更请求的精确同源 `Origin`、JSON 类型、受限空请求体，以及
从状态路由取得的 CSRF nonce。

DSH 层自动重试固定为零。普通推理只有第一次返回 401 时，才允许在一次
single-flight token refresh 后重放一次。在独立验收 DSH 子进程中设置
`DSH_SUPERGROK_ACCEPTANCE=1`，可连这次重放也关闭。本包从不读取
`XAI_API_KEY`。

实时目录同步不是插件自动更新：只有继续兼容固定协议快照及现有
`responses`/`chat_completions` 后端的新模型和推理等级会自动出现。xAI 若新增
端点、后端或目录协议形态，插件会失败关闭，必须经过新的固定版本审查。

## 验证

运行 `npm test`。测试 runner 会在自身与所有测试子进程中显式移除
`XAI_API_KEY`，输出只包含布尔证据 `XAI_API_KEY absent=true`。

运行 `npm run canonical-hash` 生成 Bridge 信任哈希。确切文件集合与记录
格式写在 `supergrok-hardening.json`；缺文件或符号链接会被拒绝。可发布的
`npm-shrinkwrap.json` 属于该运行时集合，安装后也必须作为普通文件保留。

在完整源码目录运行 `npm run source-hash -- --list`，可以同时记录源码摘要
及其精确的有序文件列表。源码摘要只用作发布来源证据；生产安装包按设计
不包含复算该摘要所需的全部测试、脚本和源码文档。
