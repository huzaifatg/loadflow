// ─── CSV Parsing Engine Types ─────────────────────────────────────────────────
// These types are intentionally independent of Prisma models.
// They represent the raw output of the CSV parser before any
// database interaction, validation, or business logic.

/**
 * Supported CSV delimiters for auto-detection.
 */
export type Delimiter = ',' | ';' | '\t' | '|';

/**
 * Severity levels for parser diagnostics.
 */
export type DiagnosticSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * A single diagnostic message produced during parsing.
 */
export interface ParseDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly row?: number;
  readonly column?: string;
}

/**
 * Metadata about the detected file characteristics.
 */
export interface FileMetadata {
  readonly detectedDelimiter: Delimiter;
  readonly detectedEncoding: string;
  readonly hasBOM: boolean;
  readonly lineEnding: 'CRLF' | 'LF' | 'mixed';
  readonly originalHeaderCount: number;
  readonly totalLineCount: number;
}

/**
 * A normalized header entry after cleaning.
 */
export interface NormalizedHeader {
  /** Zero-based index in the source file. */
  readonly index: number;
  /** Original header text as it appeared in the file. */
  readonly original: string;
  /** Cleaned, lowercase, trimmed header key. */
  readonly normalized: string;
  /** True if this header was blank in the source. */
  readonly wasBlank: boolean;
  /** True if this header was a duplicate (suffix was appended). */
  readonly wasDuplicate: boolean;
}

/**
 * A single parsed row from the CSV file.
 */
export interface ParsedRow {
  /** 1-based row number in the original file (header = row 1, first data row = row 2). */
  readonly sourceRowNumber: number;
  /** Original string values keyed by normalized header names. Whitespace preserved. */
  readonly originalValues: Record<string, string>;
  /** Trimmed string values keyed by normalized header names. */
  readonly trimmedValues: Record<string, string>;
  /** True if this row had a different column count than the header. */
  readonly isMalformed: boolean;
  /** Per-row diagnostics (e.g., column count mismatch). */
  readonly diagnostics: ParseDiagnostic[];
}

/**
 * The complete result of parsing a CSV file.
 * This is the sole output contract of the CSV parser.
 */
export interface ImportParseResult {
  /** True if parsing completed (even with warnings/errors). False only on fatal errors. */
  readonly success: boolean;
  /** Detected file characteristics. Null on fatal errors. */
  readonly metadata: FileMetadata | null;
  /** Normalized headers. Empty on fatal errors. */
  readonly headers: NormalizedHeader[];
  /** Parsed data rows (excludes the header row). */
  readonly rows: ParsedRow[];
  /** All diagnostics accumulated during parsing. */
  readonly diagnostics: ParseDiagnostic[];
  /** Summary statistics. */
  readonly stats: ParseStats;
}

/**
 * Summary statistics for the parse operation.
 */
export interface ParseStats {
  readonly totalRows: number;
  readonly validRows: number;
  readonly malformedRows: number;
  readonly blankRowsSkipped: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly parseTimeMs: number;
}

/**
 * Options for customizing parser behavior.
 */
export interface CsvParseOptions {
  /** Force a specific delimiter instead of auto-detecting. */
  delimiter?: Delimiter;
  /** Maximum number of rows to parse. 0 = unlimited. Default: 0. */
  maxRows?: number;
  /** Maximum file size in bytes. Default: 50MB. */
  maxFileSize?: number;
  /** Whether to skip completely blank rows. Default: true. */
  skipBlankRows?: boolean;
  /** Whether to trim cell values in trimmedValues. Default: true. */
  trimValues?: boolean;
}
