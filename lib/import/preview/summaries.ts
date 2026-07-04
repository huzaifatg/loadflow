// ─── Preview Engine — Summary Builder ─────────────────────────────────────────
// Builds document-level and row-level preview summaries from enriched rows.

import type { ImportDocument, ImportRow, ImportDiagnostic } from '../contract/types';
import type {
  RowPreviewSummary,
  DocumentPreviewSummary,
  CommitImpactSummary,
  PreviewAction,
} from './types';

/**
 * Build a per-row preview summary from an enriched ImportRow.
 */
export function buildRowSummary(row: ImportRow, duplicateKeys: ReadonlySet<string>): RowPreviewSummary {
  const preview = row.previewState;
  const mapping = row.mappingState;

  const action: PreviewAction = preview?.action ?? 'skip';
  const matchedRecordId = preview?.matchedRecordId ?? null;
  const changedFields = (preview?.fieldDiffs ?? []).map(d => d.field);

  // Determine before/after values from diffs
  const beforeValues: Record<string, unknown> = {};
  const afterValues: Record<string, unknown> = {};
  for (const diff of preview?.fieldDiffs ?? []) {
    beforeValues[diff.field] = diff.oldValue;
    afterValues[diff.field] = diff.newValue;
  }

  // For creates, afterValues should contain all mapped values
  if (action === 'create' && mapping) {
    for (const [k, v] of Object.entries(mapping.mappedValues)) {
      afterValues[k] = v;
    }
  }

  // Determine match key value for duplicate check
  const matchKeyValue = mapping?.mappedValues
    ? String(Object.values(mapping.mappedValues)[0] ?? '')
    : '';
  const hasDuplicateKey = duplicateKeys.has(matchKeyValue) && action !== 'skip';

  let skipReason: string | null = null;
  if (action === 'skip') {
    if (mapping?.status === 'skipped' || mapping?.status === 'unmapped') {
      skipReason = `Row skipped: mapping status is "${mapping.status}".`;
    } else if (row.validationState?.status === 'invalid') {
      skipReason = 'Row skipped: validation failed.';
    } else {
      skipReason = 'Row skipped.';
    }
  }

  return {
    rowId: row.rowId,
    sourceRowNumber: row.sourceRowNumber,
    action,
    matchedRecordId,
    changedFieldCount: changedFields.length,
    changedFields,
    validationStatus: row.validationState?.status ?? 'unknown',
    mappingStatus: mapping?.status ?? 'unknown',
    mappedEntity: mapping?.mappedEntity ?? 'unknown',
    beforeValues,
    afterValues,
    hasDuplicateKey,
    skipReason,
  };
}

/**
 * Build a document-level preview summary from the enriched document.
 */
export function buildDocumentSummary(
  doc: ImportDocument,
  entity: string,
  rowSummaries: RowPreviewSummary[],
): DocumentPreviewSummary {
  let creates = 0;
  let updates = 0;
  let skipped = 0;
  let noChange = 0;
  let duplicateKeyCount = 0;
  let totalFieldChanges = 0;
  const allChangedFields = new Set<string>();

  for (const rs of rowSummaries) {
    switch (rs.action) {
      case 'create': creates++; break;
      case 'update': updates++; break;
      case 'skip': skipped++; break;
      case 'no_change': noChange++; break;
    }
    if (rs.hasDuplicateKey) duplicateKeyCount++;
    totalFieldChanges += rs.changedFieldCount;
    for (const f of rs.changedFields) allChangedFields.add(f);
  }

  // Count warnings and errors from document diagnostics
  let warningCount = 0;
  let errorCount = 0;
  for (const d of doc.diagnostics) {
    if (d.stage === 'preview') {
      if (d.severity === 'warning') warningCount++;
      if (d.severity === 'error') errorCount++;
    }
  }

  const commitImpact: CommitImpactSummary = {
    newRecords: creates,
    updatedRecords: updates,
    unchangedRecords: noChange,
    skippedRecords: skipped,
    totalFieldChanges,
    fieldsAffected: [...allChangedFields].sort(),
  };

  return {
    documentId: doc.documentId,
    entity,
    totalRows: rowSummaries.length,
    rowsToCreate: creates,
    rowsToUpdate: updates,
    rowsSkipped: skipped,
    rowsNoChange: noChange,
    duplicateKeyCount,
    warningCount,
    errorCount,
    affectedFields: [...allChangedFields].sort(),
    rows: rowSummaries,
    commitImpact,
  };
}
