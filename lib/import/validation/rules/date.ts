// ─── Validation Rule: Date ────────────────────────────────────────────────────
// Checks that a value is a recognizable date string.
// Supports: ISO 8601, common US/EU formats.

import type { ValidationRule } from '../types';

/**
 * Common date format patterns.
 * Each regex is tested in order; the first match wins.
 */
const DATE_PATTERNS: RegExp[] = [
  // ISO 8601: 2024-01-15, 2024-01-15T10:30:00, 2024-01-15T10:30:00Z
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  // US: 01/15/2024, 1/15/2024
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  // EU: 15.01.2024, 15-01-2024
  /^\d{1,2}[.\-]\d{1,2}[.\-]\d{4}$/,
  // Compact: 20240115
  /^\d{8}$/,
];

export const dateRule: ValidationRule = {
  name: 'date',
  description: 'Value must be a recognizable date format.',
  validate(value: string, params?: Record<string, unknown>): string | null {
    if (value.trim().length === 0) return null; // Empty handled by 'required' rule

    const trimmed = value.trim();

    // If a specific format regex is provided, use only that
    if (params?.pattern) {
      const regex = new RegExp(params.pattern as string);
      if (!regex.test(trimmed)) {
        return `"${trimmed}" does not match the expected date format.`;
      }
      return null;
    }

    // Try common patterns
    const matchesPattern = DATE_PATTERNS.some(p => p.test(trimmed));
    if (!matchesPattern) {
      return `"${trimmed}" is not a recognized date format. Expected ISO 8601, MM/DD/YYYY, or DD.MM.YYYY.`;
    }

    // Verify it actually parses to a valid date
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      // Special handling for compact format (20240115)
      if (/^\d{8}$/.test(trimmed)) {
        const y = parseInt(trimmed.slice(0, 4), 10);
        const m = parseInt(trimmed.slice(4, 6), 10);
        const d = parseInt(trimmed.slice(6, 8), 10);
        const dateObj = new Date(y, m - 1, d);
        if (dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d) {
          return null;
        }
      }
      return `"${trimmed}" is not a valid date.`;
    }

    return null;
  },
};
