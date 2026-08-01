// ─── Commit Engine — Core ─────────────────────────────────────────────────────
// Consumes a previewed ImportDocument and commits approved rows to the database.
// This is the ONLY engine in the pipeline permitted to perform Prisma writes.
// All writes occur inside a single Prisma transaction — atomic commit or full rollback.

import type {
  ImportDocument,
  ImportRow,
  ImportDiagnostic,
  RowCommitState,
  CommitStatistics,
} from '../contract/types';
import { assertState, createTimestamp } from '../contract/guards';
import type {
  PrismaTransactionClient,
  CommitProfile,
  CommitEngineResult,
  RowCommitResult,
} from './types';
import { COMMIT_CODES } from './constants';
import {
  createDelivery,
  updateDelivery,
  persistImportRow,
  updateImportJob,
} from './persistence';

/**
 * Commit a previewed ImportDocument to the database.
 *
 * This is the sole public entry point of the Commit Engine.
 *
 * @param doc     - An ImportDocument with processingState = "previewed".
 * @param profile - Commit configuration (companyId, importJobId, matchKey, etc.).
 * @param tx      - A Prisma transaction client. The caller is responsible for
 *                  wrapping this call inside `prisma.$transaction(async (tx) => ...)`.
 * @returns A CommitEngineResult containing the enriched document and per-row results.
 */
export async function commitDocument(
  doc: ImportDocument,
  profile: CommitProfile,
  tx: PrismaTransactionClient,
): Promise<CommitEngineResult> {
  const startTime = performance.now();

  // ── State guard ─────────────────────────────────────────────────────────
  assertState(doc, 'previewed');

  const docDiagnostics: ImportDiagnostic[] = [];
  const rowResults: RowCommitResult[] = [];
  const enrichedRows: ImportRow[] = [];

  let inserted = 0;
  let updated = 0;
  const failed = 0;
  let skipped = 0;

  try {
    // ── Process each row ────────────────────────────────────────────────
    for (const row of doc.rows) {
      const previewAction = row.previewState?.action;
      const rowDiagnostics: ImportDiagnostic[] = [];

      // Skip rows that aren't approved for commit
      if (
        previewAction === 'skip' ||
        previewAction === 'no_change' ||
        !row.mappingState ||
        !row.previewState
      ) {
        skipped++;
        rowDiagnostics.push(makeDiagnostic(
          'info',
          COMMIT_CODES.ROW_SKIPPED,
          `Row ${row.sourceRowNumber}: skipped (action="${previewAction ?? 'none'}").`,
          row.sourceRowNumber,
        ));

        const commitState: RowCommitState = {
          status: 'skipped',
          recordId: row.previewState?.matchedRecordId ?? null,
          error: null,
        };

        rowResults.push({
          rowId: row.rowId,
          sourceRowNumber: row.sourceRowNumber,
          action: 'skip',
          status: 'skipped',
          recordId: commitState.recordId,
          error: null,
        });

        // Persist import row record
        await persistImportRow(
          tx,
          profile.importJobId,
          row.sourceRowNumber,
          row.originalValues,
          row.mappingState?.mappedValues ?? {},
          'SKIPPED',
          null,
        );

        enrichedRows.push(enrichRow(row, commitState, rowDiagnostics));
        continue;
      }

      const mappedValues = row.mappingState.mappedValues as Record<string, unknown>;

      try {
        if (previewAction === 'create') {
          // ── Create ──────────────────────────────────────────────────
          const result = await createDelivery(
            tx,
            mappedValues,
            profile,
            row.sourceRowNumber,
          );

          inserted++;
          rowDiagnostics.push(...result.diagnostics);

          const commitState: RowCommitState = {
            status: 'committed',
            recordId: result.recordId,
            error: null,
          };

          rowResults.push({
            rowId: row.rowId,
            sourceRowNumber: row.sourceRowNumber,
            action: 'create',
            status: 'committed',
            recordId: result.recordId,
            error: null,
          });

          await persistImportRow(
            tx,
            profile.importJobId,
            row.sourceRowNumber,
            row.originalValues,
            mappedValues,
            'IMPORTED',
            null,
          );

          enrichedRows.push(enrichRow(row, commitState, rowDiagnostics));

        } else if (previewAction === 'update') {
          // ── Update ──────────────────────────────────────────────────
          const matchedId = row.previewState.matchedRecordId;
          if (!matchedId) {
            throw new Error(`Row ${row.sourceRowNumber}: update action but no matchedRecordId.`);
          }

          const result = await updateDelivery(
            tx,
            matchedId,
            mappedValues,
            profile,
            row.sourceRowNumber,
          );

          updated++;
          rowDiagnostics.push(...result.diagnostics);

          const commitState: RowCommitState = {
            status: 'committed',
            recordId: result.recordId,
            error: null,
          };

          rowResults.push({
            rowId: row.rowId,
            sourceRowNumber: row.sourceRowNumber,
            action: 'update',
            status: 'committed',
            recordId: result.recordId,
            error: null,
          });

          await persistImportRow(
            tx,
            profile.importJobId,
            row.sourceRowNumber,
            row.originalValues,
            mappedValues,
            'IMPORTED',
            null,
          );

          enrichedRows.push(enrichRow(row, commitState, rowDiagnostics));

        } else {
          // Unknown action — skip
          skipped++;
          const commitState: RowCommitState = {
            status: 'skipped',
            recordId: null,
            error: null,
          };
          rowResults.push({
            rowId: row.rowId,
            sourceRowNumber: row.sourceRowNumber,
            action: 'skip',
            status: 'skipped',
            recordId: null,
            error: null,
          });
          enrichedRows.push(enrichRow(row, commitState, rowDiagnostics));
        }
      } catch (rowError) {
        // ── Row-level failure → propagate to trigger transaction rollback ──
        const errMsg = rowError instanceof Error ? rowError.message : String(rowError);

        rowDiagnostics.push(makeDiagnostic(
          'error',
          COMMIT_CODES.ROW_FAILED,
          `Row ${row.sourceRowNumber}: commit failed — ${errMsg}`,
          row.sourceRowNumber,
        ));

        // Rethrow to trigger full transaction rollback
        throw rowError;
      }
    }

    // ── Update ImportJob ────────────────────────────────────────────────────
    const commitTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    const commitStats: CommitStatistics = {
      inserted,
      updated,
      failed,
      commitTimeMs,
    };

    const jobSummary = {
      totalRows: doc.rows.length,
      inserted,
      updated,
      skipped,
      failed,
      commitTimeMs,
    };

    await updateImportJob(tx, profile.importJobId, 'COMPLETED', jobSummary);

    docDiagnostics.push(makeDiagnostic(
      'info',
      COMMIT_CODES.JOB_UPDATED,
      `ImportJob "${profile.importJobId}" status updated to COMPLETED.`,
    ));

    docDiagnostics.push(makeDiagnostic(
      'info',
      COMMIT_CODES.COMMIT_COMPLETE,
      `Commit complete: ${inserted} created, ${updated} updated, ${skipped} skipped. (${commitTimeMs}ms)`,
    ));

    // ── Build enriched document ───────────────────────────────────────────
    const enrichedDoc: ImportDocument = {
      ...doc,
      rows: enrichedRows,
      diagnostics: [...doc.diagnostics, ...docDiagnostics],
      statistics: {
        ...doc.statistics,
        commit: commitStats,
      },
      timestamps: {
        ...doc.timestamps,
        committedAt: createTimestamp(),
      },
      processingState: 'committed',
    };

    return {
      document: enrichedDoc,
      results: rowResults,
      success: true,
      rollbackReason: null,
    };

  } catch (error) {
    // ── Transaction failure → full rollback ────────────────────────────────
    const errMsg = error instanceof Error ? error.message : String(error);
    const commitTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    docDiagnostics.push(makeDiagnostic(
      'fatal',
      COMMIT_CODES.TRANSACTION_ROLLBACK,
      `Transaction rolled back: ${errMsg}`,
    ));

    docDiagnostics.push(makeDiagnostic(
      'fatal',
      COMMIT_CODES.COMMIT_FAILED,
      `Commit failed after ${commitTimeMs}ms. All changes have been rolled back.`,
    ));

    // Return the original document (unchanged) with rollback diagnostics
    const failedDoc: ImportDocument = {
      ...doc,
      diagnostics: [...doc.diagnostics, ...docDiagnostics],
      // processingState remains 'previewed' — commit did not succeed
    };

    return {
      document: failedDoc,
      results: rowResults,
      success: false,
      rollbackReason: errMsg,
    };
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function enrichRow(
  row: ImportRow,
  commitState: RowCommitState,
  newDiagnostics: ImportDiagnostic[],
): ImportRow {
  return {
    ...row,
    commitState,
    rowDiagnostics: [...row.rowDiagnostics, ...newDiagnostics],
  };
}

function makeDiagnostic(
  severity: ImportDiagnostic['severity'],
  code: string,
  message: string,
  row?: number,
): ImportDiagnostic {
  return {
    severity,
    code,
    message,
    stage: 'commit',
    row,
    timestamp: createTimestamp(),
  };
}
