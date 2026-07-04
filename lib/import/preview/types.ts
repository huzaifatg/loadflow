// ─── Preview Engine — Types ───────────────────────────────────────────────────
// Domain types for the Preview Engine.
// These are local to the preview module. Contract types (RowPreviewState,
// FieldDiff, PreviewStatistics) live in lib/import/contract/types.ts.

import type { RowPreviewState } from '../contract/types';

// ─── Preview Action ───────────────────────────────────────────────────────────

/** The subset of preview actions the engine can assign to a row. */
export type PreviewAction = RowPreviewState['action'];

// ─── Existing Record Lookup ───────────────────────────────────────────────────

/**
 * An existing domain record returned by the lookup function.
 * The Preview Engine uses this to compute diffs against incoming mapped values.
 */
export interface ExistingRecord {
  readonly id: string;
  readonly values: Record<string, unknown>;
}

/**
 * A function that looks up existing records by a match key.
 * Returns null if no match is found (→ create), or the matching record (→ update).
 *
 * This is intentionally a plain function signature, NOT a Prisma dependency.
 * In production, the caller passes a closure over the database.
 * In tests, the caller passes a simple Map-based lookup.
 */
export type RecordLookupFn = (
  entity: string,
  matchKey: string,
  matchValue: unknown,
) => ExistingRecord | null;

// ─── Preview Profile ──────────────────────────────────────────────────────────

/**
 * Configuration for the Preview Engine.
 *
 * @field matchKey      - The mapped field used to look up existing records (e.g., "customerName").
 * @field lookupFn      - A function that resolves existing records.
 * @field ignoredFields - Fields to exclude from diff computation (e.g., "id", "createdAt").
 */
export interface PreviewProfile {
  readonly matchKey: string;
  readonly lookupFn: RecordLookupFn;
  readonly ignoredFields?: readonly string[];
}

// ─── Row Preview Summary ──────────────────────────────────────────────────────

/**
 * Extended preview information for a single row, beyond what RowPreviewState
 * captures. This is returned alongside the enriched document for UI consumption.
 */
export interface RowPreviewSummary {
  readonly rowId: string;
  readonly sourceRowNumber: number;
  readonly action: PreviewAction;
  readonly matchedRecordId: string | null;
  readonly changedFieldCount: number;
  readonly changedFields: string[];
  readonly validationStatus: string;
  readonly mappingStatus: string;
  readonly mappedEntity: string;
  readonly beforeValues: Record<string, unknown>;
  readonly afterValues: Record<string, unknown>;
  readonly hasDuplicateKey: boolean;
  readonly skipReason: string | null;
}

// ─── Document Preview Summary ─────────────────────────────────────────────────

/**
 * Full preview summary for the entire document.
 * Contains everything a future UI needs to render the import preview screen.
 */
export interface DocumentPreviewSummary {
  readonly documentId: string;
  readonly entity: string;
  readonly totalRows: number;
  readonly rowsToCreate: number;
  readonly rowsToUpdate: number;
  readonly rowsSkipped: number;
  readonly rowsNoChange: number;
  readonly duplicateKeyCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly affectedFields: string[];
  readonly rows: RowPreviewSummary[];
  readonly commitImpact: CommitImpactSummary;
}

/**
 * Summary of the projected impact if this import is committed.
 */
export interface CommitImpactSummary {
  readonly newRecords: number;
  readonly updatedRecords: number;
  readonly unchangedRecords: number;
  readonly skippedRecords: number;
  readonly totalFieldChanges: number;
  readonly fieldsAffected: string[];
}

// ─── Preview Engine Result ────────────────────────────────────────────────────

/**
 * The full result of the Preview Engine.
 * Contains both the enriched document and the computed summary.
 */
export interface PreviewEngineResult {
  readonly document: import('../contract/types').ImportDocument;
  readonly summary: DocumentPreviewSummary;
}
