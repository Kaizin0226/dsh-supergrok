/**
 * Compatibility surface for the collector that is owned by the independent
 * dsh-attachment-history package. Keeping this source entry makes the split
 * package maintainable without duplicating the authorization algorithm.
 * @module dsh-tool-attachment-history/collector
 */
export {
  collectAuthorizedImageOccurrences,
  collectAuthorizedImageOccurrencesFromEvents,
  collectHiddenImageAttachments,
  isDurableImageAttachmentRef,
  resolveAuthorizedImageOccurrence,
} from 'dsh-attachment-history'
export type {
  HiddenImageAttachment,
  ImageAttachmentOccurrence,
} from 'dsh-attachment-history'
