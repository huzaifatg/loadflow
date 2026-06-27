// ─── Validation Rule: Enum ────────────────────────────────────────────────────
// Checks that a value is one of a predefined set of allowed values.

import type { ValidationRule } from '../types';

export const enumRule: ValidationRule = {
  name: 'enum',
  description: 'Value must be one of the allowed values.',
  validate(value: string, params?: Record<string, unknown>): string | null {
    if (value.trim().length === 0) return null; // Empty handled by 'required' rule

    const allowedValues = params?.values as string[] | undefined;
    if (!allowedValues || !Array.isArray(allowedValues)) {
      return 'Enum rule misconfigured: no allowed values specified.';
    }

    const caseSensitive = params?.caseSensitive === true;
    const normalized = caseSensitive ? value.trim() : value.trim().toLowerCase();
    const allowedSet = new Set(
      caseSensitive ? allowedValues : allowedValues.map(v => v.toLowerCase()),
    );

    if (!allowedSet.has(normalized)) {
      return `"${value.trim()}" is not an allowed value. Expected one of: ${allowedValues.join(', ')}.`;
    }

    return null;
  },
};
