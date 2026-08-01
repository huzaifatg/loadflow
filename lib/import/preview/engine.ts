// ─── Preview Engine — Core ────────────────────────────────────────────────────
// Consumes a mapped ImportDocument and enriches it with preview state.
// Does NOT perform validation, mapping, commit, or database writes.
// Imports ONLY from contract types and preview-local modules.

import type {
  ImportDocument,
  ImportRow,
  ImportDiagnostic,
  RowPreviewState,
  FieldDiff,
  PreviewStatistics,
} from '../contract/types';
import { assertState, createTimestamp } from '../contract/guards';
import type { PreviewProfile, PreviewEngineResult } from './types';
import { PREVIEW_CODES } from './constants';
import { computeFieldDiffs } from './diff';
import { buildRowSummary, buildDocumentSummary } from './summaries';

/**
 * Generate a preview for a mapped ImportDocument.
 *
 * This is the sole public entry point of the Preview Engine.
 *
 * @param doc     - An ImportDocument with processingState = "mapped".
 * @param profile - Preview configuration (match key, lookup function, ignored fields).
 * @returns A PreviewEngineResult containing the enriched document and the preview summary.
 */
export function previewDocument(
  doc: ImportDocument,
  profile: PreviewProfile,
): PreviewEngineResult {
  const startTime = performance.now();

  // ── State guard ─────────────────────────────────────────────────────────
  assertState(doc, 'mapped');

  const ignoredFields = new Set(profile.ignoredFields ?? []);

  // ── Detect duplicate match keys ─────────────────────────────────────────
  const matchKeyCounts = new Map<string, number>();
  for (const row of doc.rows) {
    if (row.mappingState?.status === 'skipped' || row.mappingState?.status === 'unmapped') continue;
    const keyValue = row.mappingState?.mappedValues?.[profile.matchKey];
    if (keyValue != null && String(keyValue).trim() !== '') {
      const key = String(keyValue);
      matchKeyCounts.set(key, (matchKeyCounts.get(key) ?? 0) + 1);
    }
  }
  const duplicateKeys = new Set<string>();
  for (const [key, count] of matchKeyCounts) {
    if (count > 1) duplicateKeys.add(key);
  }

  // ── Document-level diagnostics ──────────────────────────────────────────
  const docDiagnostics: ImportDiagnostic[] = [];

  // Report duplicate keys
  for (const key of duplicateKeys) {
    docDiagnostics.push(makeDiagnostic(
      'warning',
      PREVIEW_CODES.DUPLICATE_KEY,
      `Duplicate match key "${profile.matchKey}" value "${key}" appears in ${matchKeyCounts.get(key)} rows.`,
    ));
  }

  // ── Preview each row ───────────────────────────────────────────────────
  let creates = 0;
  let updates = 0;
  const deletes = 0;
  let noChange = 0;
  let skipped = 0;

  const enrichedRows: ImportRow[] = doc.rows.map((row) => {
    const rowDiagnostics: ImportDiagnostic[] = [];

    // Skip rows that weren't successfully mapped
    if (
      row.mappingState?.status === 'skipped' ||
      row.mappingState?.status === 'unmapped' ||
      !row.mappingState
    ) {
      skipped++;
      rowDiagnostics.push(makeDiagnostic(
        'info',
        PREVIEW_CODES.ROW_SKIPPED,
        `Row ${row.sourceRowNumber} skipped: mapping status is "${row.mappingState?.status ?? 'missing'}".`,
        row.sourceRowNumber,
      ));

      const previewState: RowPreviewState = {
        action: 'skip',
        matchedRecordId: null,
        fieldDiffs: [],
        userDecision: 'pending',
      };

      return enrichRow(row, previewState, rowDiagnostics);
    }

    const mappedValues = row.mappingState.mappedValues;
    const entity = row.mappingState.mappedEntity;
    const matchKeyValue = mappedValues[profile.matchKey];

    // Check if match key is present
    if (matchKeyValue == null || String(matchKeyValue).trim() === '') {
      // No match key → treat as create
      creates++;
      rowDiagnostics.push(makeDiagnostic(
        'warning',
        PREVIEW_CODES.MATCH_KEY_MISSING,
        `Row ${row.sourceRowNumber}: match key "${profile.matchKey}" is missing or empty. Classified as create.`,
        row.sourceRowNumber,
      ));

      const previewState: RowPreviewState = {
        action: 'create',
        matchedRecordId: null,
        fieldDiffs: [],
        userDecision: 'pending',
      };

      return enrichRow(row, previewState, rowDiagnostics);
    }

    // Attempt to find an existing record
    const existing = profile.lookupFn(entity, profile.matchKey, matchKeyValue);

    if (existing === null) {
      // No match → create
      creates++;
      rowDiagnostics.push(makeDiagnostic(
        'info',
        PREVIEW_CODES.ROW_CREATE,
        `Row ${row.sourceRowNumber}: no existing record found for ${profile.matchKey}="${matchKeyValue}". Will create.`,
        row.sourceRowNumber,
      ));

      const previewState: RowPreviewState = {
        action: 'create',
        matchedRecordId: null,
        fieldDiffs: [],
        userDecision: 'pending',
      };

      return enrichRow(row, previewState, rowDiagnostics);
    }

    // Match found → compute diff
    const diffs = computeFieldDiffs(
      mappedValues as Record<string, unknown>,
      existing.values,
      ignoredFields,
    );

    if (diffs.length === 0) {
      // No changes
      noChange++;
      rowDiagnostics.push(makeDiagnostic(
        'info',
        PREVIEW_CODES.ROW_NO_CHANGE,
        `Row ${row.sourceRowNumber}: matched record "${existing.id}" but no field changes detected.`,
        row.sourceRowNumber,
      ));

      const previewState: RowPreviewState = {
        action: 'no_change',
        matchedRecordId: existing.id,
        fieldDiffs: [],
        userDecision: null,
      };

      return enrichRow(row, previewState, rowDiagnostics);
    }

    // Has changes → update
    updates++;
    for (const diff of diffs) {
      rowDiagnostics.push(makeDiagnostic(
        'info',
        PREVIEW_CODES.FIELD_CHANGED,
        `Row ${row.sourceRowNumber}: field "${diff.field}" changed from "${String(diff.oldValue)}" to "${String(diff.newValue)}".`,
        row.sourceRowNumber,
        diff.field,
      ));
    }

    rowDiagnostics.push(makeDiagnostic(
      'info',
      PREVIEW_CODES.ROW_UPDATE,
      `Row ${row.sourceRowNumber}: matched record "${existing.id}" with ${diffs.length} field change(s). Will update.`,
      row.sourceRowNumber,
    ));

    const previewState: RowPreviewState = {
      action: 'update',
      matchedRecordId: existing.id,
      fieldDiffs: diffs,
      userDecision: 'pending',
    };

    return enrichRow(row, previewState, rowDiagnostics);
  });

  // ── Completion diagnostic ───────────────────────────────────────────────
  const previewTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  docDiagnostics.push(makeDiagnostic(
    'info',
    PREVIEW_CODES.PREVIEW_COMPLETE,
    `Preview complete: ${creates} create(s), ${updates} update(s), ${noChange} unchanged, ${skipped} skipped. (${previewTimeMs}ms)`,
  ));

  // ── Build statistics ────────────────────────────────────────────────────
  const previewStats: PreviewStatistics = {
    creates,
    updates,
    deletes,
    noChange,
  };

  // ── Build enriched document ─────────────────────────────────────────────
  const enrichedDoc: ImportDocument = {
    ...doc,
    rows: enrichedRows,
    diagnostics: [...doc.diagnostics, ...docDiagnostics],
    statistics: {
      ...doc.statistics,
      preview: previewStats,
    },
    timestamps: {
      ...doc.timestamps,
      previewedAt: createTimestamp(),
    },
    processingState: 'previewed',
  };

  // ── Build summaries ─────────────────────────────────────────────────────
  const entity = doc.rows.find(r => r.mappingState)?.mappingState?.mappedEntity ?? 'unknown';
  const rowSummaries = enrichedDoc.rows.map(r => buildRowSummary(r, duplicateKeys));
  const summary = buildDocumentSummary(enrichedDoc, entity, rowSummaries);

  return { document: enrichedDoc, summary };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function enrichRow(
  row: ImportRow,
  previewState: RowPreviewState,
  newDiagnostics: ImportDiagnostic[],
): ImportRow {
  return {
    ...row,
    previewState,
    rowDiagnostics: [...row.rowDiagnostics, ...newDiagnostics],
  };
}

function makeDiagnostic(
  severity: ImportDiagnostic['severity'],
  code: string,
  message: string,
  row?: number,
  column?: string,
): ImportDiagnostic {
  return {
    severity,
    code,
    message,
    stage: 'preview',
    row,
    column,
    timestamp: createTimestamp(),
  };
}
