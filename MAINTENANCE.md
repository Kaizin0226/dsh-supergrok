# SuperGrok input maintenance

The provider uses the authenticated dynamic catalog. No model version is a default in this package. DSH owns tools, sessions, permissions and the model-visible history.

`maxRequestBodyBytes` is a validated positive integer. The deployment default is 40,000,000 bytes, a local budget rather than an official API limit. The adapter counts the final serialized UTF-8 body, including text, tools and every image occurrence. An oversized request fails with `REQUEST_BODY_TOO_LARGE` before inference authentication or POST; catalog resolution may already have occurred. No image eviction, automatic splitting or provider fallback occurs.

The optional prepared-input API resolves durable image versions once per call using DSH's attachment service. It returns notices separately from serialization, for the host to log before sending. Images unchanged in dimensions, byte count and format produce no transformation notice. Changed images report preparation, not successful delivery. Prepared bytes remain bound to the image occurrences and exact captured route.

Original durable attachments and provider call IDs are not changed. Tests use synthetic attachments and stubbed network responses. Online acceptance is a separate authorization step.
