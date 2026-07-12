// ─── Preview Engine — Constants ───────────────────────────────────────────────

/** Diagnostic code prefix for the preview engine. */
export const PREVIEW_PREFIX = 'PRV_';

/** Preview diagnostic codes. */
export const PREVIEW_CODES = {
  /** Row classified as a new record (create). */
  ROW_CREATE: `${PREVIEW_PREFIX}ROW_CREATE`,
  /** Row classified as an update to an existing record. */
  ROW_UPDATE: `${PREVIEW_PREFIX}ROW_UPDATE`,
  /** Row skipped due to invalid/unmapped state. */
  ROW_SKIPPED: `${PREVIEW_PREFIX}ROW_SKIPPED`,
  /** Row has no changes compared to the existing record. */
  ROW_NO_CHANGE: `${PREVIEW_PREFIX}ROW_NO_CHANGE`,
  /** A specific field value changed. */
  FIELD_CHANGED: `${PREVIEW_PREFIX}FIELD_CHANGED`,
  /** Duplicate match key detected across multiple rows. */
  DUPLICATE_KEY: `${PREVIEW_PREFIX}DUPLICATE_KEY`,
  /** The match key field is missing or empty in a mapped row. */
  MATCH_KEY_MISSING: `${PREVIEW_PREFIX}MATCH_KEY_MISSING`,
  /** Preview completed successfully. */
  PREVIEW_COMPLETE: `${PREVIEW_PREFIX}PREVIEW_COMPLETE`,
} as const;
