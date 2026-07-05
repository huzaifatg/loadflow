// ─── Import Pipeline — Types ──────────────────────────────────────────────────
// Configuration and result types for the full CSV import pipeline.

import type { ImportDocument, ImportDiagnostic } from '../contract/types';
import type { CsvParseOptions } from '../csv';
import type { ValidationProfile } from '../validation';
import type { MappingProfile } from '../mapping';
import type { PreviewProfile } from '../preview';
import type { CommitProfile, PrismaTransactionClient, RowCommitResult } from '../commit';
import type { DocumentPreviewSummary } from '../preview';

// ─── Pipeline Stage ───────────────────────────────────────────────────────────

/** The stages of the import pipeline in execution order. */
export type PipelineStage =
  | 'parse'
  | 'adapt'
  | 'validate'
  | 'map'
  | 'preview'
  | 'commit';

// ─── Pipeline Configuration ───────────────────────────────────────────────────

/**
 * Complete configuration for an import pipeline run.
 * Bundles all profiles needed by each engine stage.
 */
export interface PipelineConfig {
  /** Raw CSV string content. */
  readonly csvContent: string;
  /** Original filename for provenance. */
  readonly filename: string;
  /** CSV parser options (delimiter, maxRows, etc.). */
  readonly parseOptions?: CsvParseOptions;
  /** Validation profile defining field rules. */
  readonly validationProfile: ValidationProfile;
  /** Mapping profile defining field-to-entity mapping. */
  readonly mappingProfile: MappingProfile;
  /** Preview profile defining match key and lookup function. */
  readonly previewProfile: PreviewProfile;
  /** Commit profile defining companyId, importJobId, etc. */
  readonly commitProfile: CommitProfile;
  /** Prisma transaction client for database writes. */
  readonly tx: PrismaTransactionClient;
}

// ─── Stage Timing ─────────────────────────────────────────────────────────────

/** Timing for each pipeline stage. */
export interface PipelineStageTiming {
  readonly stage: PipelineStage;
  readonly durationMs: number;
}

// ─── Pipeline Result ──────────────────────────────────────────────────────────

/**
 * The outcome of a single pipeline run.
 * Indicates which stage was reached, whether the pipeline succeeded,
 * and provides the final document state.
 */
export interface ImportPipelineResult {
  /** Whether the entire pipeline completed successfully. */
  readonly success: boolean;
  /** The stage at which the pipeline stopped (last completed or failed). */
  readonly completedStage: PipelineStage;
  /** The stage where a failure occurred, if any. */
  readonly failedStage: PipelineStage | null;
  /** Human-readable failure reason, if any. */
  readonly failureReason: string | null;
  /** The ImportDocument at its final state (may be at any stage). */
  readonly document: ImportDocument;
  /** All diagnostics accumulated across all stages. */
  readonly diagnostics: ImportDiagnostic[];
  /** Per-stage timing breakdown. */
  readonly timings: PipelineStageTiming[];
  /** Total pipeline execution time in ms. */
  readonly totalDurationMs: number;
  /** Preview summary (available if preview stage was reached). */
  readonly previewSummary: DocumentPreviewSummary | null;
  /** Per-row commit results (available if commit stage was reached). */
  readonly commitResults: RowCommitResult[] | null;
  /** Whether the commit was rolled back. */
  readonly wasRolledBack: boolean;
}
