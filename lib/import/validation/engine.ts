// ─── Validation Engine ────────────────────────────────────────────────────────
// Consumes an ImportDocument and enriches it with validation results.
// Does NOT modify originalValues or normalizedValues.
// Does NOT perform mapping, preview, or database operations.
// Diagnostics are append-only.
// Imports ONLY from contract types — never from adapter-specific modules.

import type {
  ImportDocument,
  ImportRow,
  ImportDiagnostic,
  RowValidationState,
  FieldValidationResult,
  ValidationStatistics,
} from '../contract/types';
import { assertState, createTimestamp } from '../contract/guards';
import type { ValidationProfile, FieldValidationConfig } from './types';
import { getRule } from './rules';

/** Validation diagnostic code prefix. */
const VAL_PREFIX = 'VAL_';

/** Validation diagnostic codes. */
export const VAL_CODES = {
  REQUIRED_FIELD_MISSING: `${VAL_PREFIX}REQUIRED_FIELD_MISSING`,
  RULE_FAILED: `${VAL_PREFIX}RULE_FAILED`,
  UNKNOWN_RULE: `${VAL_PREFIX}UNKNOWN_RULE`,
  DUPLICATE_ROW: `${VAL_PREFIX}DUPLICATE_ROW`,
  MALFORMED_ROW_SKIPPED: `${VAL_PREFIX}MALFORMED_ROW_SKIPPED`,
  FIELD_NOT_FOUND: `${VAL_PREFIX}FIELD_NOT_FOUND`,
} as const;

/**
 * Validate an ImportDocument using the provided validation profile.
 *
 * This is the sole public entry point of the Validation Engine.
 *
 * @param doc - An ImportDocument with processingState = "parsed".
 * @param profile - The validation rules to apply.
 * @returns The same ImportDocument enriched with validation state.
 */
export function validateDocument(
  doc: ImportDocument,
  profile: ValidationProfile,
): ImportDocument {
  const startTime = performance.now();

  // ── State guard ─────────────────────────────────────────────────────────────
  assertState(doc, 'parsed');

  const allDiagnostics: ImportDiagnostic[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let skippedCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  // ── Build duplicate detection index ─────────────────────────────────────────
  const duplicateKeys = new Map<string, number[]>(); // key → row indices
  const detectDuplicates = profile.detectDuplicates === true;
  const dupKeyColumns = profile.duplicateKeyColumns || [];

  if (detectDuplicates && dupKeyColumns.length > 0) {
    for (let i = 0; i < doc.rows.length; i++) {
      const row = doc.rows[i];
      const key = dupKeyColumns
        .map(col => (row.normalizedValues[col] ?? '').toLowerCase().trim())
        .join('|');
      if (!duplicateKeys.has(key)) {
        duplicateKeys.set(key, []);
      }
      duplicateKeys.get(key)!.push(i);
    }
  }

  // ── Validate each row ──────────────────────────────────────────────────────

  const enrichedRows: ImportRow[] = doc.rows.map((row, rowIndex) => {
    const rowDiagnostics: ImportDiagnostic[] = [];

    // Skip malformed rows
    if (row.isMalformed) {
      skippedCount++;
      const diag = makeDiagnostic(
        'warning',
        VAL_CODES.MALFORMED_ROW_SKIPPED,
        `Row ${row.sourceRowNumber} was malformed by the adapter and skipped during validation.`,
        row.sourceRowNumber,
      );
      rowDiagnostics.push(diag);
      warningCount++;

      const validationState: RowValidationState = {
        status: 'skipped',
        fieldResults: {},
        isCritical: false,
      };

      allDiagnostics.push(...rowDiagnostics);
      return enrichRow(row, validationState, rowDiagnostics);
    }

    // ── Field validation ────────────────────────────────────────────────────

    const fieldResults: Record<string, FieldValidationResult> = {};
    let rowHasErrors = false;
    let rowIsCritical = false;

    for (const fieldConfig of profile.fields) {
      const result = validateField(row, fieldConfig, rowDiagnostics);
      fieldResults[fieldConfig.column] = result;

      if (result.rulesFailed.length > 0) {
        rowHasErrors = true;
        rowIsCritical = true; // Any field failure is critical
      }
    }

    // ── Duplicate detection ─────────────────────────────────────────────────

    if (detectDuplicates && dupKeyColumns.length > 0) {
      const key = dupKeyColumns
        .map(col => (row.normalizedValues[col] ?? '').toLowerCase().trim())
        .join('|');
      const indices = duplicateKeys.get(key);
      if (indices && indices.length > 1 && indices[0] !== rowIndex) {
        // This row is a duplicate (not the first occurrence)
        rowHasErrors = true;
        rowIsCritical = true;
        const diag = makeDiagnostic(
          'error',
          VAL_CODES.DUPLICATE_ROW,
          `Row ${row.sourceRowNumber} is a duplicate (key columns: ${dupKeyColumns.join(', ')}).`,
          row.sourceRowNumber,
        );
        rowDiagnostics.push(diag);
        errorCount++;
      }
    }

    // ── Accumulate counts ───────────────────────────────────────────────────

    if (rowHasErrors) {
      invalidCount++;
    } else {
      validCount++;
    }

    const validationState: RowValidationState = {
      status: rowHasErrors ? 'invalid' : 'valid',
      fieldResults,
      isCritical: rowIsCritical,
    };

    allDiagnostics.push(...rowDiagnostics);

    return enrichRow(row, validationState, rowDiagnostics);
  });

  // ── Build enriched document ────────────────────────────────────────────────

  const validationTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  // Count warnings and errors from diagnostics
  warningCount += allDiagnostics.filter(d => d.severity === 'warning').length - warningCount;
  errorCount += allDiagnostics.filter(d => d.severity === 'error').length - errorCount;

  const validationStats: ValidationStatistics = {
    validRows: validCount,
    invalidRows: invalidCount,
    skippedRows: skippedCount,
    warningCount: allDiagnostics.filter(d => d.severity === 'warning').length,
    errorCount: allDiagnostics.filter(d => d.severity === 'error').length,
    validationTimeMs,
  };

  return {
    ...doc,
    rows: enrichedRows,
    diagnostics: [...doc.diagnostics, ...allDiagnostics],
    statistics: {
      ...doc.statistics,
      validation: validationStats,
    },
    timestamps: {
      ...doc.timestamps,
      validatedAt: createTimestamp(),
    },
    processingState: 'validated',
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Validate a single field against its configuration.
 */
function validateField(
  row: ImportRow,
  config: FieldValidationConfig,
  diagnostics: ImportDiagnostic[],
): FieldValidationResult {
  const rulesPassed: string[] = [];
  const rulesFailed: string[] = [];
  const messages: string[] = [];

  const value = row.normalizedValues[config.column];

  // Check if the column exists in the row
  if (value === undefined) {
    diagnostics.push(
      makeDiagnostic(
        'warning',
        VAL_CODES.FIELD_NOT_FOUND,
        `Row ${row.sourceRowNumber}: column "${config.column}" not found in row data.`,
        row.sourceRowNumber,
        config.column,
      ),
    );
    // If required and missing, that's an error
    if (config.required) {
      rulesFailed.push('required');
      messages.push(`Column "${config.column}" is required but not present.`);
      diagnostics.push(
        makeDiagnostic(
          'error',
          VAL_CODES.REQUIRED_FIELD_MISSING,
          `Row ${row.sourceRowNumber}, column "${config.column}": required field is missing.`,
          row.sourceRowNumber,
          config.column,
        ),
      );
    }
    return { rulesPassed, rulesFailed, messages };
  }

  // ── Required check ──────────────────────────────────────────────────────

  if (config.required) {
    const reqRule = getRule('required');
    if (reqRule) {
      const result = reqRule.validate(value);
      if (result) {
        rulesFailed.push('required');
        messages.push(result);
        diagnostics.push(
          makeDiagnostic(
            'error',
            VAL_CODES.REQUIRED_FIELD_MISSING,
            `Row ${row.sourceRowNumber}, column "${config.column}": ${result}`,
            row.sourceRowNumber,
            config.column,
          ),
        );
        // If required fails, skip other rules for this field
        return { rulesPassed, rulesFailed, messages };
      }
      rulesPassed.push('required');
    }
  }

  // ── Apply configured rules ──────────────────────────────────────────────

  // Skip further validation if value is empty and field is not required
  if (value.trim().length === 0) {
    return { rulesPassed, rulesFailed, messages };
  }

  for (const ruleEntry of config.rules) {
    const rule = getRule(ruleEntry.ruleName);
    if (!rule) {
      messages.push(`Unknown validation rule: "${ruleEntry.ruleName}".`);
      diagnostics.push(
        makeDiagnostic(
          'warning',
          VAL_CODES.UNKNOWN_RULE,
          `Row ${row.sourceRowNumber}, column "${config.column}": unknown rule "${ruleEntry.ruleName}".`,
          row.sourceRowNumber,
          config.column,
        ),
      );
      continue;
    }

    const result = rule.validate(value, ruleEntry.params);
    if (result) {
      rulesFailed.push(ruleEntry.ruleName);
      messages.push(result);
      diagnostics.push(
        makeDiagnostic(
          'error',
          VAL_CODES.RULE_FAILED,
          `Row ${row.sourceRowNumber}, column "${config.column}": ${result}`,
          row.sourceRowNumber,
          config.column,
        ),
      );
    } else {
      rulesPassed.push(ruleEntry.ruleName);
    }
  }

  return { rulesPassed, rulesFailed, messages };
}

/**
 * Create a new ImportRow with validationState and appended diagnostics.
 */
function enrichRow(
  row: ImportRow,
  validationState: RowValidationState,
  newDiagnostics: ImportDiagnostic[],
): ImportRow {
  return {
    ...row,
    validationState,
    rowDiagnostics: [...row.rowDiagnostics, ...newDiagnostics],
  };
}

/**
 * Create a validation diagnostic.
 */
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
    stage: 'validation',
    row,
    column,
    timestamp: createTimestamp(),
  };
}
