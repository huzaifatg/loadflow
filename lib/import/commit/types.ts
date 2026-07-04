// ─── Commit Engine — Types ────────────────────────────────────────────────────
// Domain types for the Commit Engine.
// Contract types (RowCommitState, CommitStatistics) live in lib/import/contract/types.ts.

import type { ImportDocument, RowCommitState } from '../contract/types';

// ─── Commit Action ────────────────────────────────────────────────────────────

/** The action to perform for a single row during commit. */
export type CommitAction = 'create' | 'update' | 'skip';

// ─── Prisma Transaction Client ────────────────────────────────────────────────

/**
 * A Prisma transaction client. This is intentionally typed loosely to avoid
 * coupling to the generated Prisma client type at the module boundary.
 * In production, the caller passes `prisma.$transaction(async (tx) => ...)`.
 * In tests, the caller passes a mock.
 */
export interface PrismaTransactionClient {
  delivery: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ id: string }>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>;
  };
  importJob: {
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
  importRow: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

// ─── Commit Profile ───────────────────────────────────────────────────────────

/**
 * Configuration for the Commit Engine.
 *
 * @field companyId   - The tenant company ID.
 * @field importJobId - The ImportJob record to update.
 * @field uploadedBy  - The user ID who initiated the import.
 * @field matchKey    - The mapped field used to look up existing records for updates (e.g., "externalId").
 * @field source      - The DeliverySource enum value (e.g., "CSV").
 */
export interface CommitProfile {
  readonly companyId: string;
  readonly importJobId: string;
  readonly uploadedBy: string;
  readonly matchKey: string;
  readonly source: string;
}

// ─── Row Commit Result ────────────────────────────────────────────────────────

/**
 * The result of committing a single row.
 */
export interface RowCommitResult {
  readonly rowId: string;
  readonly sourceRowNumber: number;
  readonly action: CommitAction;
  readonly status: RowCommitState['status'];
  readonly recordId: string | null;
  readonly error: string | null;
}

// ─── Commit Engine Result ─────────────────────────────────────────────────────

/**
 * The full result of the Commit Engine.
 * Contains the enriched document and an array of per-row commit results.
 */
export interface CommitEngineResult {
  readonly document: ImportDocument;
  readonly results: RowCommitResult[];
  readonly success: boolean;
  readonly rollbackReason: string | null;
}
