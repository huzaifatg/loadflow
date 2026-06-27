// ─── CSV Parser Core ──────────────────────────────────────────────────────────
// The main parser. Converts a raw CSV string into an ImportParseResult.
// This module orchestrates: detection → splitting → header normalization → row parsing.
// It performs ZERO database operations, ZERO business validation, ZERO mapping.

import type {
  ImportParseResult,
  ParsedRow,
  ParseDiagnostic,
  FileMetadata,
  ParseStats,
  CsvParseOptions,
  Delimiter,
  NormalizedHeader,
} from './types';
import { DEFAULT_MAX_FILE_SIZE } from './constants';
import { CsvFatalError, CSV_ERROR_CODES } from './errors';
import { detectFileCharacteristics, stripBOM, hasBOM, splitLines } from './detector';
import { normalizeHeaders } from './normalizer';
import { isBinaryContent, isFormulaInjection } from './security';

/**
 * Parse a CSV string into a structured ImportParseResult.
 *
 * This is the sole public entry point of the CSV parsing engine.
 * It accepts raw file content (as a string) and returns a fully
 * parsed, normalized result with diagnostics.
 *
 * @param content - The raw CSV file content as a string.
 * @param options - Optional configuration overrides.
 * @returns ImportParseResult - The complete parse result.
 */
export function parseCsv(content: string, options: CsvParseOptions = {}): ImportParseResult {
  const startTime = performance.now();
  const allDiagnostics: ParseDiagnostic[] = [];

  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const skipBlankRows = options.skipBlankRows ?? true;
  const trimValues = options.trimValues ?? true;
  const maxRows = options.maxRows ?? 0;

  // ── Pre-flight checks ───────────────────────────────────────────────────────

  // Check file size (approximate: string length × 2 for UTF-16 internal encoding)
  const approxSize = content.length * 2;
  if (approxSize > maxFileSize) {
    return fatalResult(
      CSV_ERROR_CODES.FILE_TOO_LARGE,
      `File size (~${Math.round(approxSize / 1024 / 1024)}MB) exceeds the maximum of ${Math.round(maxFileSize / 1024 / 1024)}MB.`,
      startTime,
    );
  }

  // Check for empty file
  if (content.trim().length === 0) {
    return fatalResult(CSV_ERROR_CODES.EMPTY_FILE, 'The file is empty.', startTime);
  }

  // Check for binary content
  if (isBinaryContent(content)) {
    return fatalResult(
      CSV_ERROR_CODES.BINARY_FILE,
      'The file appears to be binary. Only text-based CSV files are supported.',
      startTime,
    );
  }

  // ── Detection ───────────────────────────────────────────────────────────────

  const detection = detectFileCharacteristics(content);
  allDiagnostics.push(...detection.diagnostics);

  const delimiter = options.delimiter ?? detection.delimiter;
  const cleanContent = hasBOM(content) ? stripBOM(content) : content;

  // ── Split into lines ────────────────────────────────────────────────────────

  const allLines = splitLines(cleanContent);

  // Remove trailing empty line (common artifact of trailing newline)
  if (allLines.length > 0 && allLines[allLines.length - 1].trim() === '') {
    allLines.pop();
  }

  if (allLines.length === 0) {
    return fatalResult(CSV_ERROR_CODES.EMPTY_FILE, 'The file contains no lines.', startTime);
  }

  // ── Parse header row ────────────────────────────────────────────────────────

  const rawHeaderFields = parseLineToFields(allLines[0], delimiter);

  if (rawHeaderFields.length === 0) {
    return fatalResult(
      CSV_ERROR_CODES.NO_HEADERS,
      'The first row contains no recognizable headers.',
      startTime,
    );
  }

  const headerResult = normalizeHeaders(rawHeaderFields);
  allDiagnostics.push(...headerResult.diagnostics);
  const headers = headerResult.headers;
  const expectedColumnCount = headers.length;

  // ── Parse data rows ─────────────────────────────────────────────────────────

  const dataLines = allLines.slice(1); // Skip header row

  if (dataLines.length === 0) {
    return fatalResult(CSV_ERROR_CODES.NO_DATA_ROWS, 'The file contains only a header row and no data.', startTime);
  }

  const parsedRows: ParsedRow[] = [];
  let blankRowsSkipped = 0;
  let malformedRows = 0;

  for (let i = 0; i < dataLines.length; i++) {
    // Enforce max rows
    if (maxRows > 0 && parsedRows.length >= maxRows) break;

    const line = dataLines[i];
    const sourceRowNumber = i + 2; // +2 because: line 1 = header, array is 0-indexed

    // Skip blank rows
    if (skipBlankRows && line.trim() === '') {
      blankRowsSkipped++;
      allDiagnostics.push({
        severity: 'info',
        code: CSV_ERROR_CODES.BLANK_ROW_SKIPPED,
        message: `Row ${sourceRowNumber} is blank and was skipped.`,
        row: sourceRowNumber,
      });
      continue;
    }

    const fields = parseLineToFields(line, delimiter);
    const rowDiagnostics: ParseDiagnostic[] = [];
    let isMalformed = false;

    // Check column count mismatch
    if (fields.length !== expectedColumnCount) {
      isMalformed = true;
      malformedRows++;
      rowDiagnostics.push({
        severity: 'warning',
        code: CSV_ERROR_CODES.COLUMN_COUNT_MISMATCH,
        message: `Row ${sourceRowNumber} has ${fields.length} columns (expected ${expectedColumnCount}).`,
        row: sourceRowNumber,
      });
    }

    // Build the value maps
    const originalValues: Record<string, string> = {};
    const trimmedValues: Record<string, string> = {};

    for (let col = 0; col < headers.length; col++) {
      const header = headers[col];
      const rawValue = col < fields.length ? fields[col] : '';

      originalValues[header.normalized] = rawValue;
      trimmedValues[header.normalized] = trimValues ? rawValue.trim() : rawValue;

      // Check for formula injection (warning only — we don't modify the data)
      if (isFormulaInjection(rawValue.trim())) {
        rowDiagnostics.push({
          severity: 'warning',
          code: CSV_ERROR_CODES.FORMULA_INJECTION,
          message: `Row ${sourceRowNumber}, column "${header.normalized}": value starts with a formula character.`,
          row: sourceRowNumber,
          column: header.normalized,
        });
      }
    }

    allDiagnostics.push(...rowDiagnostics);

    parsedRows.push({
      sourceRowNumber,
      originalValues,
      trimmedValues,
      isMalformed,
      diagnostics: rowDiagnostics,
    });
  }

  // ── Build result ────────────────────────────────────────────────────────────

  const parseTimeMs = performance.now() - startTime;

  const metadata: FileMetadata = {
    detectedDelimiter: delimiter,
    detectedEncoding: 'UTF-8',
    hasBOM: detection.hasBOM,
    lineEnding: detection.lineEnding,
    originalHeaderCount: rawHeaderFields.length,
    totalLineCount: allLines.length,
  };

  const stats: ParseStats = {
    totalRows: parsedRows.length,
    validRows: parsedRows.filter(r => !r.isMalformed).length,
    malformedRows,
    blankRowsSkipped,
    warningCount: allDiagnostics.filter(d => d.severity === 'warning').length,
    errorCount: allDiagnostics.filter(d => d.severity === 'error').length,
    parseTimeMs: Math.round(parseTimeMs * 100) / 100,
  };

  return {
    success: true,
    metadata,
    headers,
    rows: parsedRows,
    diagnostics: allDiagnostics,
    stats,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Parse a single CSV line into an array of field values.
 * Handles quoted fields, escaped quotes (RFC 4180), and embedded delimiters.
 */
function parseLineToFields(line: string, delimiter: Delimiter): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Look ahead for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === delimiter) {
        fields.push(current);
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push the last field
  fields.push(current);

  return fields;
}

/**
 * Create a fatal-error result with no parsed data.
 */
function fatalResult(
  code: string,
  message: string,
  startTime: number,
): ImportParseResult {
  return {
    success: false,
    metadata: null,
    headers: [],
    rows: [],
    diagnostics: [{ severity: 'fatal', code, message }],
    stats: {
      totalRows: 0,
      validRows: 0,
      malformedRows: 0,
      blankRowsSkipped: 0,
      warningCount: 0,
      errorCount: 0,
      parseTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
    },
  };
}
