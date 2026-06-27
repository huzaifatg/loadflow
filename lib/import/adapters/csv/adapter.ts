// ─── CSV Adapter ──────────────────────────────────────────────────────────────
// Translates ImportParseResult (CSV parser output) → ImportDocument (canonical contract).
// Per ADR-005: the existing parseCsv() remains unchanged. This is a thin translation layer.
// No validation. No mapping. No database logic.

import type { ImportParseResult } from '../../csv/types';
import type {
  ImportDocument,
  ImportRow,
  ImportHeader,
  ImportDiagnostic,
  ImportSource,
  ImportAdapter,
  AdapterStatistics,
} from '../../contract/types';
import { CONTRACT_VERSION } from '../../contract/constants';
import { createTimestamp } from '../../contract/guards';

const ADAPTER_NAME = 'csv-adapter';
const ADAPTER_VERSION = '1.0.0';

/**
 * Convert a CSV ImportParseResult into the canonical ImportDocument.
 *
 * @param parseResult - The output of parseCsv().
 * @param filename - The source filename for identification.
 * @param tenantId - The tenant this import belongs to.
 * @returns ImportDocument ready for downstream engines.
 */
export function csvToImportDocument(
  parseResult: ImportParseResult,
  filename: string,
  tenantId: string,
): ImportDocument {
  const now = createTimestamp();
  const documentId = generateDocumentId();

  // ── Translate headers ─────────────────────────────────────────────────────

  const headers: ImportHeader[] = parseResult.headers.map(h => ({
    index: h.index,
    original: h.original,
    normalized: h.normalized,
    wasBlank: h.wasBlank,
    wasDuplicate: h.wasDuplicate,
  }));

  // ── Translate rows ────────────────────────────────────────────────────────

  const rows: ImportRow[] = parseResult.rows.map((row, i) => ({
    rowId: `row-${i + 1}`,
    sourceRowNumber: row.sourceRowNumber,
    originalValues: { ...row.originalValues },
    normalizedValues: { ...row.trimmedValues },
    isMalformed: row.isMalformed,
    rowDiagnostics: row.diagnostics.map(d => translateDiagnostic(d, now)),
  }));

  // ── Translate diagnostics ─────────────────────────────────────────────────

  const diagnostics: ImportDiagnostic[] = parseResult.diagnostics.map(
    d => translateDiagnostic(d, now),
  );

  // ── Build source metadata ─────────────────────────────────────────────────

  const source: ImportSource = {
    sourceType: 'csv',
    sourceIdentifier: filename,
    sourceMetadata: parseResult.metadata
      ? {
          detectedDelimiter: parseResult.metadata.detectedDelimiter,
          detectedEncoding: parseResult.metadata.detectedEncoding,
          hasBOM: parseResult.metadata.hasBOM,
          lineEnding: parseResult.metadata.lineEnding,
          originalHeaderCount: parseResult.metadata.originalHeaderCount,
          totalLineCount: parseResult.metadata.totalLineCount,
        }
      : {},
  };

  const adapter: ImportAdapter = {
    adapterName: ADAPTER_NAME,
    adapterVersion: ADAPTER_VERSION,
  };

  // ── Statistics ────────────────────────────────────────────────────────────

  const adapterStats: AdapterStatistics = {
    totalRows: parseResult.stats.totalRows,
    malformedRows: parseResult.stats.malformedRows,
    blankRowsSkipped: parseResult.stats.blankRowsSkipped,
    parseTimeMs: parseResult.stats.parseTimeMs,
  };

  return {
    documentId,
    version: CONTRACT_VERSION,
    source,
    adapter,
    headers,
    rows,
    diagnostics,
    statistics: { adapter: adapterStats },
    timestamps: { createdAt: now },
    processingState: 'parsed',
    tenant: tenantId,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function translateDiagnostic(
  d: { severity: string; code: string; message: string; row?: number; column?: string },
  timestamp: string,
): ImportDiagnostic {
  return {
    severity: d.severity as ImportDiagnostic['severity'],
    code: d.code,
    message: d.message,
    stage: 'adapter',
    row: d.row,
    column: d.column,
    timestamp,
  };
}

function generateDocumentId(): string {
  // Simple UUID v4-like generation without external deps
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
