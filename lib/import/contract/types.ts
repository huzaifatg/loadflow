// ─── Import Document Contract — Types ─────────────────────────────────────────
// Canonical types for the Data Ingestion Platform (DIPA).
// Every adapter produces these types. Every downstream engine consumes them.
// These types are intentionally independent of Prisma, CSV, Excel, or any source.
// See: docs/architecture/import_document_contract.md

// ─── Processing State ─────────────────────────────────────────────────────────

/**
 * The pipeline stage of an ImportDocument.
 * Transitions forward only: parsed → validated → mapped → previewed → committed.
 */
export type ProcessingState =
  | 'parsed'
  | 'validated'
  | 'mapped'
  | 'previewed'
  | 'committed';

// ─── Diagnostic Types ─────────────────────────────────────────────────────────

/**
 * Severity levels for diagnostics across all pipeline stages.
 */
export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal';

/**
 * The pipeline stage that produced a diagnostic.
 */
export type DiagnosticStage =
  | 'adapter'
  | 'validation'
  | 'mapping'
  | 'preview'
  | 'commit';

/**
 * A single diagnostic entry produced during any pipeline stage.
 */
export interface ImportDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly stage: DiagnosticStage;
  readonly row?: number;
  readonly column?: string;
  readonly field?: string;
  readonly timestamp: string;
}

// ─── Source & Adapter Metadata ────────────────────────────────────────────────

/**
 * Describes where the data originated.
 */
export interface ImportSource {
  readonly sourceType: string;
  readonly sourceIdentifier: string;
  readonly sourceMetadata: Record<string, unknown>;
}

/**
 * Identifies which adapter produced the document.
 */
export interface ImportAdapter {
  readonly adapterName: string;
  readonly adapterVersion: string;
}

// ─── Header ───────────────────────────────────────────────────────────────────

/**
 * A canonical column definition in the import document.
 */
export interface ImportHeader {
  readonly index: number;
  readonly original: string;
  readonly normalized: string;
  readonly wasBlank: boolean;
  readonly wasDuplicate: boolean;
}

// ─── Row State Types (Engine-Exclusive) ───────────────────────────────────────

/**
 * Per-field validation result.
 */
export interface FieldValidationResult {
  readonly rulesPassed: string[];
  readonly rulesFailed: string[];
  readonly messages: string[];
}

/**
 * Validation state for a single row. Written exclusively by the Validation Engine.
 */
export interface RowValidationState {
  readonly status: 'valid' | 'invalid' | 'skipped';
  readonly fieldResults: Record<string, FieldValidationResult>;
  readonly isCritical: boolean;
}

/**
 * Mapping state for a single row. Written exclusively by the Mapping Engine.
 */
export interface RowMappingState {
  readonly status: 'mapped' | 'partially_mapped' | 'unmapped' | 'skipped';
  readonly mappedEntity: string;
  readonly mappedValues: Record<string, unknown>;
  readonly unmappedFields: string[];
}

/**
 * A single field-level diff for preview.
 */
export interface FieldDiff {
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

/**
 * Preview state for a single row. Written exclusively by the Preview Engine.
 */
export interface RowPreviewState {
  readonly action: 'create' | 'update' | 'delete' | 'skip' | 'no_change';
  readonly matchedRecordId: string | null;
  readonly fieldDiffs: FieldDiff[];
  readonly userDecision: 'pending' | 'approved' | 'rejected' | null;
}

/**
 * Commit state for a single row. Written exclusively by the Commit Engine.
 */
export interface RowCommitState {
  readonly status: 'committed' | 'failed' | 'skipped';
  readonly recordId: string | null;
  readonly error: string | null;
}

// ─── Import Row ───────────────────────────────────────────────────────────────

/**
 * A single record within an ImportDocument.
 * Created by the adapter, enriched by downstream engines.
 */
export interface ImportRow {
  readonly rowId: string;
  readonly sourceRowNumber: number;
  readonly originalValues: Record<string, string>;
  readonly normalizedValues: Record<string, string>;
  readonly isMalformed: boolean;
  readonly rowDiagnostics: ImportDiagnostic[];
  // Engine-exclusive state — optional, created by each engine
  validationState?: RowValidationState;
  mappingState?: RowMappingState;
  previewState?: RowPreviewState;
  commitState?: RowCommitState;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface AdapterStatistics {
  readonly totalRows: number;
  readonly malformedRows: number;
  readonly blankRowsSkipped: number;
  readonly parseTimeMs: number;
}

export interface ValidationStatistics {
  readonly validRows: number;
  readonly invalidRows: number;
  readonly skippedRows: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly validationTimeMs: number;
}

export interface MappingStatistics {
  readonly mappedRows: number;
  readonly unmappedRows: number;
  readonly mappingTimeMs: number;
}

export interface PreviewStatistics {
  readonly creates: number;
  readonly updates: number;
  readonly deletes: number;
  readonly noChange: number;
}

export interface CommitStatistics {
  readonly inserted: number;
  readonly updated: number;
  readonly failed: number;
  readonly commitTimeMs: number;
}

export interface ImportStatistics {
  adapter?: AdapterStatistics;
  validation?: ValidationStatistics;
  mapping?: MappingStatistics;
  preview?: PreviewStatistics;
  commit?: CommitStatistics;
}

// ─── Timestamps ───────────────────────────────────────────────────────────────

export interface ImportTimestamps {
  readonly createdAt: string;
  validatedAt?: string;
  mappedAt?: string;
  previewedAt?: string;
  committedAt?: string;
}

// ─── Import Document ──────────────────────────────────────────────────────────

/**
 * The canonical in-memory document flowing through the entire ingestion pipeline.
 * Created by an adapter, enriched by each downstream engine.
 *
 * See: docs/architecture/import_document_contract.md
 */
export interface ImportDocument {
  readonly documentId: string;
  readonly version: string;
  readonly source: ImportSource;
  readonly adapter: ImportAdapter;
  readonly headers: ImportHeader[];
  readonly rows: ImportRow[];
  readonly diagnostics: ImportDiagnostic[];
  readonly statistics: ImportStatistics;
  readonly timestamps: ImportTimestamps;
  processingState: ProcessingState;
  readonly tenant: string;
}
