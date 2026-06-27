// ─── CSV Header Normalizer ────────────────────────────────────────────────────
// Responsible for cleaning, de-duplicating, and normalizing CSV header names.

import type { NormalizedHeader, ParseDiagnostic } from './types';
import { CSV_ERROR_CODES } from './errors';

export interface HeaderNormalizationResult {
  readonly headers: NormalizedHeader[];
  readonly diagnostics: ParseDiagnostic[];
}

/**
 * Normalize a single header string.
 *
 * Steps:
 * 1. Trim whitespace.
 * 2. Lowercase.
 * 3. Replace spaces, dashes, and multiple underscores with a single underscore.
 * 4. Remove non-alphanumeric characters (except underscore).
 * 5. Strip leading/trailing underscores.
 */
export function normalizeHeaderName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')      // Spaces and dashes → underscore
    .replace(/[^a-z0-9_]/g, '')    // Remove special chars
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .replace(/^_|_$/g, '');        // Strip leading/trailing underscores
}

/**
 * Process raw header strings into normalized, de-duplicated header entries.
 */
export function normalizeHeaders(rawHeaders: string[]): HeaderNormalizationResult {
  const diagnostics: ParseDiagnostic[] = [];
  const seen = new Map<string, number>(); // normalized name → occurrence count
  const headers: NormalizedHeader[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const original = rawHeaders[i];
    const trimmed = original.trim();
    const wasBlank = trimmed.length === 0;

    let normalized: string;

    if (wasBlank) {
      normalized = `column_${i + 1}`;
      diagnostics.push({
        severity: 'warning',
        code: CSV_ERROR_CODES.BLANK_HEADER,
        message: `Column ${i + 1} has a blank header. Assigned name: "${normalized}".`,
        column: normalized,
      });
    } else {
      normalized = normalizeHeaderName(trimmed);
      // If normalizing produced an empty string (e.g., header was just special chars)
      if (normalized.length === 0) {
        normalized = `column_${i + 1}`;
        diagnostics.push({
          severity: 'warning',
          code: CSV_ERROR_CODES.BLANK_HEADER,
          message: `Column ${i + 1} header "${original}" normalized to empty. Assigned name: "${normalized}".`,
          column: normalized,
        });
      }
    }

    // Handle duplicates
    const count = seen.get(normalized) || 0;
    let wasDuplicate = false;

    if (count > 0) {
      wasDuplicate = true;
      const deduped = `${normalized}_${count + 1}`;
      diagnostics.push({
        severity: 'warning',
        code: CSV_ERROR_CODES.DUPLICATE_HEADER,
        message: `Duplicate header "${normalized}" at column ${i + 1}. Renamed to "${deduped}".`,
        column: deduped,
      });
      seen.set(normalized, count + 1);
      normalized = deduped;
    } else {
      seen.set(normalized, 1);
    }

    headers.push({
      index: i,
      original,
      normalized,
      wasBlank,
      wasDuplicate,
    });
  }

  return { headers, diagnostics };
}
