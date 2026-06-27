// ─── CSV Parsing Engine — Public API ──────────────────────────────────────────
// This barrel export is the single entry point for all CSV parsing.

export { parseCsv } from './parser';

// Types
export type {
  ImportParseResult,
  ParsedRow,
  ParseDiagnostic,
  FileMetadata,
  ParseStats,
  CsvParseOptions,
  NormalizedHeader,
  Delimiter,
  DiagnosticSeverity,
} from './types';

// Error classes
export { CsvParseError, CsvFatalError, CsvRowError, CSV_ERROR_CODES } from './errors';

// Utilities (for advanced consumers)
export { detectDelimiter, detectFileCharacteristics, stripBOM } from './detector';
export { normalizeHeaders, normalizeHeaderName } from './normalizer';
export { sanitizeForExport, isBinaryContent } from './security';
