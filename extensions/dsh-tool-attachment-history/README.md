# dsh-tool-attachment-history

English | [中文](README.zh.md)

The model-facing `recall_image_attachment` tool and compaction-aware historical-image context. The plugin composes only when `ctx.attachments`, `ctx.systemPrompt`, and `ctx.tools` are present. It derives session identity from the calling Agent, accepts only an opaque `attachmentId` plus an optional `{seq, ordinal}` occurrence, authorizes that occurrence through `dsh-attachment-history`, requires the logged exact current route to name a recognized `responses`, `chat`, or `chat_completions` backend and explicitly declare `image` input, then delegates byte and metadata verification to `AttachmentStore.readImage`. It creates no repository, copies no object, calls no provider adapter, and accepts no path, URL, MIME type, dimensions, bytes, or caller-supplied session id.

The dynamic `attachment-history:hidden-images` context is a synchronous read of the assembling Agent. It lists eligible durable occurrences that no longer exist in `session.surface.nodes`, newest first, grouped by attachment id. It includes at most 32 attachments and 4096 UTF-8 bytes, reports omissions, strips path prefixes and control characters from untrusted display names, and never claims the referenced object is intact before recall verifies it. The existing AgentLoop runtime-context snapshot path logs the rendered contribution as a sourced `user/message`; the plugin does not patch the loop or maintain parallel session state.

## Model Experience

### Hidden historical-image context

#### What the model sees

After compaction hides an earlier authorized image, the model sees a bounded newest-first list of attachment ids, latest `{seq, ordinal}` locators, occurrence counts, and sanitized display names when present. The context reports omitted older references and says that recall verifies integrity.

#### Token effect

Conditional and capped at 32 attachments and 4096 UTF-8 bytes. It is absent when the current surface contains every authorized image occurrence or no Agent is assembling the prompt.

#### KV Cache effect

The deterministic snapshot preserves an unchanged prefix. A changed hidden-image set, occurrence count, latest locator, or display name replaces the affected runtime-context suffix.

### Recall call and result

#### What the model sees

The model sees `recall_image_attachment` with an opaque `attachmentId` and optional `{seq, ordinal}` occurrence. A successful call adds an evidence text block beside the verified native image block. Forged ids, parent- or sibling-only ids, inherited fork-seed ids, damaged objects, unknown backends, route drift, and text-only routes return a failure and no image.

#### Token effect

The stable tool schema is present whenever the plugin is composed. A call appends its arguments and the evidence block; a successful call also adds the native image to the following provider request.

#### KV Cache effect

The stable schema preserves its request prefix. Tool-call history grows append-only, while a recalled native image changes the following provider request after the reusable prefix.

## Known Limitations and Deferred Work

- Recall addresses images removed from the current surface by compaction or pruning; it does not override a provider's single-request image limits.
- The tool does not switch models or providers and has no text-only fallback.
- Generic files and generated media require independent typed tools and route capabilities.

