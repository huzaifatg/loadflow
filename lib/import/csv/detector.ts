// ─── CSV File Detection ───────────────────────────────────────────────────────
// Responsible for detecting file characteristics: delimiter, encoding, BOM, line endings.

import type { Delimiter, ParseDiagnostic } from './types';
import { UTF8_BOM, CANDIDATE_DELIMITERS, DETECTION_SAMPLE_LINES } from './constants';
import { CSV_ERROR_CODES } from './errors';

export interface DetectionResult {
  readonly delimiter: Delimiter;
  readonly hasBOM: boolean;
  readonly lineEnding: 'CRLF' | 'LF' | 'mixed';
  readonly diagnostics: ParseDiagnostic[];
}

/**
 * Strip the UTF-8 BOM from the start of a string if present.
 */
export function stripBOM(content: string): string {
  return content.startsWith(UTF8_BOM) ? content.slice(1) : content;
}

/**
 * Detect whether the content contains a UTF-8 BOM.
 */
export function hasBOM(content: string): boolean {
  return content.startsWith(UTF8_BOM);
}

/**
 * Detect the dominant line ending style.
 */
export function detectLineEnding(content: string): 'CRLF' | 'LF' | 'mixed' {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfOnly = (content.replace(/\r\n/g, '').match(/\n/g) || []).length;

  if (crlfCount > 0 && lfOnly > 0) return 'mixed';
  if (crlfCount > 0) return 'CRLF';
  return 'LF';
}

/**
 * Split content into lines, handling both CRLF and LF.
 */
export function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/**
 * Detect the most likely delimiter by analyzing the first N lines.
 *
 * Strategy: For each candidate delimiter, count occurrences per line.
 * The delimiter that produces the most consistent (lowest variance)
 * non-zero column count across all sample lines wins.
 */
export function detectDelimiter(content: string): Delimiter {
  const lines = splitLines(content)
    .filter(line => line.trim().length > 0)
    .slice(0, DETECTION_SAMPLE_LINES);

  if (lines.length === 0) return ',';

  let bestDelimiter: Delimiter = ',';
  let bestScore = -1;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = lines.map(line => countDelimiterInLine(line, delimiter));
    const nonZeroCounts = counts.filter(c => c > 0);

    // If delimiter never appears, skip it
    if (nonZeroCounts.length === 0) continue;

    // Calculate consistency: mean count and variance
    const mean = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;
    const variance =
      nonZeroCounts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / nonZeroCounts.length;

    // Score: higher mean (more columns) with lower variance (consistent) is better
    // We want consistent columns across lines, so penalize high variance
    const score = mean / (1 + variance);

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Count delimiter occurrences in a line, respecting quoted fields.
 */
function countDelimiterInLine(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

/**
 * Detect all file characteristics in a single pass.
 */
export function detectFileCharacteristics(content: string): DetectionResult {
  const diagnostics: ParseDiagnostic[] = [];
  const bomPresent = hasBOM(content);

  if (bomPresent) {
    diagnostics.push({
      severity: 'info',
      code: CSV_ERROR_CODES.BOM_DETECTED,
      message: 'UTF-8 BOM detected and stripped.',
    });
  }

  const cleanContent = bomPresent ? stripBOM(content) : content;
  const lineEnding = detectLineEnding(cleanContent);
  const delimiter = detectDelimiter(cleanContent);

  return { delimiter, hasBOM: bomPresent, lineEnding, diagnostics };
}
