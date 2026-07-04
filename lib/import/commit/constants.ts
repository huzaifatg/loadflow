// ─── Commit Engine — Constants ────────────────────────────────────────────────

/** Diagnostic code prefix for the commit engine. */
export const COMMIT_PREFIX = 'CMT_';

/** Commit diagnostic codes. */
export const COMMIT_CODES = {
  /** Row successfully created in the database. */
  ROW_CREATED: `${COMMIT_PREFIX}ROW_CREATED`,
  /** Row successfully updated in the database. */
  ROW_UPDATED: `${COMMIT_PREFIX}ROW_UPDATED`,
  /** Row skipped during commit (not approved or skip action). */
  ROW_SKIPPED: `${COMMIT_PREFIX}ROW_SKIPPED`,
  /** Row commit failed. */
  ROW_FAILED: `${COMMIT_PREFIX}ROW_FAILED`,
  /** Duplicate record detected during commit. */
  DUPLICATE_FOUND: `${COMMIT_PREFIX}DUPLICATE_FOUND`,
  /** Transaction rolled back. */
  TRANSACTION_ROLLBACK: `${COMMIT_PREFIX}TRANSACTION_ROLLBACK`,
  /** Import job status updated. */
  JOB_UPDATED: `${COMMIT_PREFIX}JOB_UPDATED`,
  /** Commit completed successfully. */
  COMMIT_COMPLETE: `${COMMIT_PREFIX}COMMIT_COMPLETE`,
  /** Commit failed — all changes rolled back. */
  COMMIT_FAILED: `${COMMIT_PREFIX}COMMIT_FAILED`,
} as const;

/** Delivery field map: maps canonical ImportDocument field names to Prisma Delivery column names. */
export const DELIVERY_FIELD_MAP: Record<string, string> = {
  customerName: 'customerName',
  pickupAddress: 'pickupAddress',
  deliveryAddress: 'deliveryAddress',
  weight: 'weight',
  scheduledDate: 'scheduledDate',
  notes: 'notes',
  externalId: 'externalId',
} as const;
