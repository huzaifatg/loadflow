// ─── Mapping Engine ───────────────────────────────────────────────────────────
// Consumes a validated ImportDocument and enriches it with mapping state.
// Does NOT perform validation, preview, commit, or database operations.
// Imports ONLY from contract types — never from adapter-specific modules.

import type {
  ImportDocument,
  ImportRow,
  ImportDiagnostic,
  RowMappingState,
  MappingStatistics,
} from '../contract/types';
import { assertState, createTimestamp } from '../contract/guards';
import type { MappingProfile, MappingResult, FieldMapping } from './types';
import { matchHeaders } from './matcher';
import { MAP_CODES } from './constants';

/**
 * Map a validated ImportDocument using the provided mapping profile.
 *
 * This is the sole public entry point of the Mapping Engine.
 *
 * @param doc - An ImportDocument with processingState = "validated".
 * @param profile - The mapping profile defining the target entity and rules.
 * @returns The same ImportDocument enriched with mapping state.
 */
export function mapDocument(
  doc: ImportDocument,
  profile: MappingProfile,
): ImportDocument {
  const startTime = performance.now();

  // ── State guard ─────────────────────────────────────────────────────────
  assertState(doc, 'validated');

  // ── Resolve header mappings ─────────────────────────────────────────────
  const headerNames = doc.headers.map(h => h.normalized);
  const mappingResult = matchHeaders(headerNames, profile);
  const mappingLookup = new Map<string, FieldMapping>(
    mappingResult.mappings.map(m => [m.sourceColumn, m]),
  );

  // ── Document-level diagnostics ──────────────────────────────────────────
  const docDiagnostics: ImportDiagnostic[] = [];

  // Report mapped fields
  for (const mapping of mappingResult.mappings) {
    docDiagnostics.push(makeDiagnostic(
      'info',
      MAP_CODES.FIELD_MAPPED,
      `Column "${mapping.sourceColumn}" mapped to "${mapping.targetField}" (${mapping.confidence}, score: ${mapping.score}).`,
    ));
  }

  // Report unmapped headers
  for (const header of mappingResult.unmappedHeaders) {
    docDiagnostics.push(makeDiagnostic(
      'info',
      MAP_CODES.FIELD_UNMAPPED,
      `Column "${header}" has no mapping to any ${profile.entity.entityName} field.`,
      undefined,
      header,
    ));
  }

  // Report missing required fields
  for (const field of mappingResult.missingRequiredFields) {
    docDiagnostics.push(makeDiagnostic(
      'error',
      MAP_CODES.REQUIRED_FIELD_MISSING,
      `Required field "${field}" has no matching column in the import.`,
    ));
  }

  // Report duplicate mappings
  for (const dup of mappingResult.duplicateMappings) {
    docDiagnostics.push(makeDiagnostic(
      'warning',
      MAP_CODES.DUPLICATE_MAPPING,
      `Multiple columns mapped to "${dup.targetField}": [${dup.sourceColumns.join(', ')}]. Selected "${dup.selectedColumn}".`,
    ));
  }

  // ── Map each row ────────────────────────────────────────────────────────
  let mappedCount = 0;
  let unmappedCount = 0;
  let skippedCount = 0;

  const enrichedRows: ImportRow[] = doc.rows.map((row) => {
    const rowDiagnostics: ImportDiagnostic[] = [];

    // Skip rows that failed validation
    if (row.validationState?.status === 'invalid' || row.validationState?.status === 'skipped') {
      skippedCount++;
      rowDiagnostics.push(makeDiagnostic(
        'info',
        MAP_CODES.ROW_SKIPPED_INVALID,
        `Row ${row.sourceRowNumber} skipped: validation status is "${row.validationState.status}".`,
        row.sourceRowNumber,
      ));

      const mappingState: RowMappingState = {
        status: 'skipped',
        mappedEntity: mappingResult.entityName,
        mappedValues: {},
        unmappedFields: [],
      };

      return enrichRow(row, mappingState, rowDiagnostics);
    }

    // ── Build mapped values ───────────────────────────────────────────────
    const mappedValues: Record<string, unknown> = {};
    const rowUnmappedFields: string[] = [];

    for (const [sourceCol, mapping] of mappingLookup.entries()) {
      const value = row.normalizedValues[sourceCol];
      if (value !== undefined) {
        mappedValues[mapping.targetField] = value;
      }
    }

    // Identify required fields missing from this row's mapped values
    for (const field of profile.entity.fields) {
      if (field.required && !(field.name in mappedValues)) {
        rowUnmappedFields.push(field.name);
      }
    }

    // Determine row mapping status
    const totalMappableFields = mappingResult.mappings.length;
    const mappedFieldCount = Object.keys(mappedValues).length;

    let status: RowMappingState['status'];
    if (mappedFieldCount === 0) {
      status = 'unmapped';
      unmappedCount++;
    } else if (mappedFieldCount < totalMappableFields) {
      status = 'partially_mapped';
      mappedCount++;
    } else {
      status = 'mapped';
      mappedCount++;
    }

    const mappingState: RowMappingState = {
      status,
      mappedEntity: mappingResult.entityName,
      mappedValues,
      unmappedFields: rowUnmappedFields,
    };

    return enrichRow(row, mappingState, rowDiagnostics);
  });

  // ── Build enriched document ─────────────────────────────────────────────

  const mappingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  const mappingStats: MappingStatistics = {
    mappedRows: mappedCount,
    unmappedRows: unmappedCount + skippedCount,
    mappingTimeMs,
  };

  return {
    ...doc,
    rows: enrichedRows,
    diagnostics: [...doc.diagnostics, ...docDiagnostics],
    statistics: {
      ...doc.statistics,
      mapping: mappingStats,
    },
    timestamps: {
      ...doc.timestamps,
      mappedAt: createTimestamp(),
    },
    processingState: 'mapped',
  };
}

// Re-export matchHeaders for direct use in tests
export { matchHeaders } from './matcher';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function enrichRow(
  row: ImportRow,
  mappingState: RowMappingState,
  newDiagnostics: ImportDiagnostic[],
): ImportRow {
  return {
    ...row,
    mappingState,
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
    stage: 'mapping',
    row,
    column,
    timestamp: createTimestamp(),
  };
}
