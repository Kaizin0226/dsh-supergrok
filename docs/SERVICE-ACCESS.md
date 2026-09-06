# Service access and licensing / 服务接入与许可

Reviewed: **2026-09-07**. This is a technical source/documentation review, not
a legal opinion or a grant of service access.

## English

The original provider and DSH source carry MIT terms. Selected Grok Build
derivatives retain Apache-2.0 attribution; see [notices](../THIRD-PARTY-NOTICES.md)
and [fixed provenance](../UPSTREAM-PROVENANCE.md). Original license texts are
preserved. This review does not relicense upstream work or claim trademark rights.

The [official Grok Build guide](https://docs.x.ai/build/overview) describes
authentication and integration of Grok Build itself. The reviewed guide does
not establish support for this DSH provider reusing its subscription OAuth
client identity. A public client ID, readable source or successful login is not
proof of such authorization. This integration is unofficial and experimental.

The [consumer terms](https://x.ai/legal/terms-of-service), effective 2026-09-01,
make service use subject to applicable terms and policies. The
[acceptable-use policy](https://x.ai/legal/acceptable-use-policy), effective
2026-08-14, restricts unauthorized automated access and circumvention of service
restrictions. These general provisions do not by themselves settle whether this
particular third-party OAuth client is authorized. This review has established
neither explicit authorization nor a client-specific prohibition; that uncertainty
remains. A disclaimer does not override applicable restrictions.

Use only your own DSH account authorization. Do not extract official-client
credentials, share grants, bypass eligibility or rate limits, or treat the
required local proxy as permission to bypass service restrictions. The provider
has no alternative-provider fallback. Its live catalog reflects account
availability, not a legal assessment. Eligibility and protocols may change
independently of the pinned source.

Reassess service compatibility when the implementation or applicable terms
change. A confirmed conflict requires resolution before further distribution
of the affected integration. API-key access is not an automatic fallback, and
the project does not claim official endorsement. This review involved no real
login or model request; the preview has no live-service validation result.

## 中文

核对日期：**2026-09-07**。这是源码与文档层面的技术核对，不是法律意见或服务授权。

原 provider 与 DSH 源码适用 MIT；所选 Grok Build 衍生内容保留 Apache-2.0 许可与署名，
见[第三方说明](../THIRD-PARTY-NOTICES.md)与[固定来源](../UPSTREAM-PROVENANCE.md)。
许可证保留原文，不重新授权上游作品，也不主张商标权利。

[Grok Build 官方指南](https://docs.x.ai/build/overview)描述 Grok Build 自身的认证和集成。
所核对指南不足以证明本 DSH provider 复用订阅 OAuth 客户端标识已获支持。
公开客户端 ID、可读源码或登录成功均不是该授权的证明。本项目为非官方实验性集成。

[消费者条款](https://x.ai/legal/terms-of-service)于 2026-09-01 生效，要求服务使用遵守适用条款与政策。
[使用政策](https://x.ai/legal/acceptable-use-policy)于 2026-08-14 生效，限制未经授权的自动访问及绕过服务限制。
这些一般条款本身不足以确定本第三方 OAuth 客户端是否获授权。本次核对既未建立明确授权，
也未找到针对本客户端的明确禁止结论；不确定性仍然存在。免责声明不能覆盖适用限制。

仅使用用户自己在 DSH 中完成的账户授权，不提取官方客户端凭据、共享授权、绕过账户资格或限流，
也不把必填本地代理视为绕过服务限制的许可。provider 不回退到其他服务商。
实时目录反映账户可用性，不是法律判断；资格和协议可能独立于固定源码变化。

实现或适用条款变化时重新评估服务兼容性。确认存在冲突时，须在继续分发受影响集成前解决。
API key 接入不是自动回退路径，本项目不宣称官方背书。核对未执行真实登录或模型请求，
预览版没有真实服务验证结论。
