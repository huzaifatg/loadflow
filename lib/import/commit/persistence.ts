// ─── Commit Engine — Persistence ──────────────────────────────────────────────
// Handles the actual database write operations for delivery records.
// This module is the ONLY place in the entire codebase that performs Prisma writes
// for the import pipeline.

import type { ImportDiagnostic } from '../contract/types';
import { createTimestamp } from '../contract/guards';
import type { PrismaTransactionClient, CommitProfile, RowCommitResult } from './types';
import { COMMIT_CODES, DELIVERY_FIELD_MAP } from './constants';

/**
 * Build a Prisma-ready data object from mapped import values.
 * Only includes fields that exist in DELIVERY_FIELD_MAP.
 */
export function buildDeliveryData(
  mappedValues: Record<string, unknown>,
  profile: CommitProfile,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    companyId: profile.companyId,
    source: profile.source,
    importJobId: profile.importJobId,
  };

  for (const [importField, prismaField] of Object.entries(DELIVERY_FIELD_MAP)) {
    if (importField in mappedValues && mappedValues[importField] != null) {
      let value = mappedValues[importField];

      // Convert weight to number for Prisma Decimal field
      if (prismaField === 'weight' && typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) value = parsed;
      }

      // Convert scheduledDate string to Date
      if (prismaField === 'scheduledDate' && typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) value = parsed;
      }

      data[prismaField] = value;
    }
  }

  return data;
}

/**
 * Create a new Delivery record inside a transaction.
 */
export async function createDelivery(
  tx: PrismaTransactionClient,
  mappedValues: Record<string, unknown>,
  profile: CommitProfile,
  sourceRowNumber: number,
): Promise<{ recordId: string; diagnostics: ImportDiagnostic[] }> {
  const data = buildDeliveryData(mappedValues, profile);
  const diagnostics: ImportDiagnostic[] = [];

  const created = await tx.delivery.create({ data });

  diagnostics.push({
    severity: 'info',
    code: COMMIT_CODES.ROW_CREATED,
    message: `Row ${sourceRowNumber}: created delivery "${created.id}".`,
    stage: 'commit',
    row: sourceRowNumber,
    timestamp: createTimestamp(),
  });

  return { recordId: created.id, diagnostics };
}

/**
 * Update an existing Delivery record inside a transaction.
 */
export async function updateDelivery(
  tx: PrismaTransactionClient,
  recordId: string,
  mappedValues: Record<string, unknown>,
  profile: CommitProfile,
  sourceRowNumber: number,
): Promise<{ recordId: string; diagnostics: ImportDiagnostic[] }> {
  const data = buildDeliveryData(mappedValues, profile);
  // Remove fields that shouldn't be overwritten on update
  delete data.companyId;
  const diagnostics: ImportDiagnostic[] = [];

  const updated = await tx.delivery.update({
    where: { id: recordId },
    data,
  });

  diagnostics.push({
    severity: 'info',
    code: COMMIT_CODES.ROW_UPDATED,
    message: `Row ${sourceRowNumber}: updated delivery "${updated.id}".`,
    stage: 'commit',
    row: sourceRowNumber,
    timestamp: createTimestamp(),
  });

  return { recordId: updated.id, diagnostics };
}

/**
 * Persist an ImportRow record inside a transaction.
 */
export async function persistImportRow(
  tx: PrismaTransactionClient,
  importJobId: string,
  sourceRowNumber: number,
  originalValues: Record<string, string>,
  mappedValues: Record<string, unknown>,
  status: string,
  errors: string[] | null,
): Promise<void> {
  await tx.importRow.create({
    data: {
      importJobId,
      rowNumber: sourceRowNumber,
      rawData: originalValues,
      mappedData: mappedValues,
      status,
      errors: errors && errors.length > 0 ? errors : null,
    },
  });
}

/**
 * Update the ImportJob status and summary.
 */
export async function updateImportJob(
  tx: PrismaTransactionClient,
  importJobId: string,
  status: string,
  summary: Record<string, unknown>,
): Promise<void> {
  await tx.importJob.update({
    where: { id: importJobId },
    data: {
      status,
      completedAt: new Date(),
      summary,
    },
  });
}
