# dsh-attachment-history

English | [中文](README.zh.md)

The authoritative pure fold for durable image occurrences in one session. It recognizes only append-origin `user/message` image blocks and image blocks inside typed `tool/result` content, recursively through nested tool results. It rejects authority from inherited fork seed (events below the Session's `inheritedEventCount`, projected durably as the last `session/end-seed` marker), surface replacements, assistant messages or chunks, inbox and spliced records, and arbitrary objects that happen to contain an attachment id.

`collectAuthorizedImageOccurrencesFromEvents` applies the same event rule to parsed stored artifacts, allowing session export to include only media the owning session actually appended. `collectAuthorizedImageOccurrences` applies it to a live `Session`. `collectHiddenImageAttachments` subtracts image ids still referenced by `session.surface.nodes`, so a tool-result-pruner replacement that retains an image does not advertise it as hidden. Repeated occurrences share one hidden entry with the latest occurrence and a count; `resolveAuthorizedImageOccurrence` selects only from the current session and accepts no path, URL, MIME type, dimensions, or bytes from the caller.

## Model Experience

### Authorized occurrence fold, indirectly

#### What the model sees

Nothing directly. `dsh-tool-attachment-history` uses this fold to publish a bounded historical-image index and authorize `recall_image_attachment`; session export uses the same fold without adding prompt content.

#### Token effect

Zero directly. Consumers decide whether an authorized occurrence contributes model context.

#### KV Cache effect

Independent by itself. A consumer that publishes a changed hidden-image snapshot can invalidate its own affected runtime-context suffix.

## Known Limitations and Deferred Work

- The collector covers durable raster `ImageBlock` references only; generic files, audio, and video need separate typed occurrence contracts.
- It restores images hidden by surface replacement; it does not solve temporary per-request image offload.
- Attachment integrity is advisory at collection time and is verified only by `AttachmentStore.readImage` at an authorized read boundary.

