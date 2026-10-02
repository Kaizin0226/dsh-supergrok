# Service access and licensing / 服务接入与许可

Reviewed / 核对日期: **2026-10-03**.

## English

This is an unofficial experimental integration. The [official Grok Build guide](https://docs.x.ai/build/overview)
does not establish authorization for this third-party provider to reuse its
subscription OAuth client identifier. This is a source/documentation review,
not live acceptance or a legal opinion.

[Consumer terms](https://x.ai/legal/terms-of-service) were last updated September 11, 2026.
The [acceptable-use policy](https://x.ai/legal/acceptable-use-policy), effective
August 14, 2026, restricts unauthorized automated access, circumventing rate limits
or protective measures, and misleading service identity. Authorization is a
service-side decision independent of source licensing. This review establishes
no specific authorization for this provider.

Use only your own account authorization completed in DSH. Do not extract official
client credentials, share grants, bypass entitlements or rate limits, or treat a
local proxy as permission to evade restrictions. The provider preserves DSH
identity and records a fixed protocol compatibility header separately from its
package version. HTTP 426 is terminal.

MIT/Apache-2.0, a public client ID, readable source, successful login or protocol
compatibility do not grant third-party service access or endorsement.
The catalog describes account availability, not legal authorization.
A concrete conflict with applicable terms requires pausing affected distribution
until resolved. This release performed no real login or model request.

## 中文

本项目为非官方实验性集成。官方 Grok Build 指南不足以证明本第三方 provider
复用订阅 OAuth 客户端标识已获授权；本次是源码／文档核对，不是线上验收或法律意见。

消费者条款于 2026-09-11 更新；使用政策于 2026-08-14 生效，
限制未经授权的自动访问、绕过限流／保护措施及误导服务身份。
授权由服务方决定，与源码许可独立；本次未建立针对本 provider 的明确授权。

只使用自己在 DSH 中完成的账户授权，不提取官方客户端凭据、共享授权、
绕过资格或限流，不将代理视为绕过限制的许可。
保留 DSH 身份，固定协议兼容请求头与包版本独立；HTTP 426 终止。

源码许可、公开客户端 ID、可读源码、登录成功或协议兼容均不能替代第三方服务授权，
也不构成官方背书。目录反映可用性，不是法律判断。
确认存在适用条款的具体冲突时，暂停受影响分发直至解决。
本发行未执行真实登录或模型请求。
