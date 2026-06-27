// ─── CSV Parser Error Classes ─────────────────────────────────────────────────

/**
 * Base error for all CSV parsing failures.
 */
export class CsvParseError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CsvParseError';
    this.code = code;
  }
}

/**
 * Fatal error that prevents any parsing from proceeding.
 * Examples: file is binary, file is empty, file exceeds size limit.
 */
export class CsvFatalError extends CsvParseError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'CsvFatalError';
  }
}

/**
 * Recoverable error on a specific row. Parsing continues.
 */
export class CsvRowError extends CsvParseError {
  public readonly row: number;

  constructor(code: string, message: string, row: number) {
    super(code, message);
    this.name = 'CsvRowError';
    this.row = row;
  }
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const CSV_ERROR_CODES = {
  // Fatal
  EMPTY_FILE: 'CSV_EMPTY_FILE',
  FILE_TOO_LARGE: 'CSV_FILE_TOO_LARGE',
  BINARY_FILE: 'CSV_BINARY_FILE',
  NO_HEADERS: 'CSV_NO_HEADERS',
  NO_DATA_ROWS: 'CSV_NO_DATA_ROWS',

  // Row-level
  COLUMN_COUNT_MISMATCH: 'CSV_COLUMN_MISMATCH',
  MALFORMED_QUOTE: 'CSV_MALFORMED_QUOTE',

  // Warnings
  BLANK_HEADER: 'CSV_BLANK_HEADER',
  DUPLICATE_HEADER: 'CSV_DUPLICATE_HEADER',
  BLANK_ROW_SKIPPED: 'CSV_BLANK_ROW_SKIPPED',
  BOM_DETECTED: 'CSV_BOM_DETECTED',
  FORMULA_INJECTION: 'CSV_FORMULA_INJECTION',
  TRAILING_DELIMITER: 'CSV_TRAILING_DELIMITER',
} as const;
