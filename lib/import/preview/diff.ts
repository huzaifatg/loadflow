// ─── Preview Engine — Diff Computation ────────────────────────────────────────
// Computes field-level diffs between incoming mapped values and existing records.

import type { FieldDiff } from '../contract/types';

/**
 * Compare incoming mapped values against an existing record's values.
 * Returns an array of FieldDiff entries for fields that have changed.
 *
 * @param incoming      - The mapped values from the import row.
 * @param existing      - The current values from the matched database record.
 * @param ignoredFields - Fields to exclude from comparison (e.g., "id", "createdAt").
 * @returns Array of FieldDiff entries for changed fields.
 */
export function computeFieldDiffs(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
  ignoredFields: ReadonlySet<string> = new Set(),
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const [field, newValue] of Object.entries(incoming)) {
    if (ignoredFields.has(field)) continue;

    const oldValue = existing[field] ?? null;

    if (!valuesEqual(oldValue, newValue)) {
      diffs.push({ field, oldValue, newValue });
    }
  }

  return diffs;
}

/**
 * Compare two values for equality, handling type coercion edge cases
 * typical in CSV imports (e.g., "10" vs 10, null vs undefined).
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  // Both null/undefined → equal
  if (a == null && b == null) return true;
  // One null/undefined → not equal
  if (a == null || b == null) return false;
  // String comparison (normalize numeric strings vs numbers)
  if (typeof a === 'number' && typeof b === 'string') {
    return String(a) === b;
  }
  if (typeof a === 'string' && typeof b === 'number') {
    return a === String(b);
  }
  // Default strict equality
  return a === b;
}
