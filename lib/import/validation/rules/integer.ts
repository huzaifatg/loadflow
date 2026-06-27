// ─── Validation Rule: Integer ─────────────────────────────────────────────────
// Checks that a value is a valid integer (optional: min/max bounds).

import type { ValidationRule } from '../types';

export const integerRule: ValidationRule = {
  name: 'integer',
  description: 'Value must be a valid integer.',
  validate(value: string, params?: Record<string, unknown>): string | null {
    if (value.trim().length === 0) return null; // Empty handled by 'required' rule

    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return `"${value}" is not a valid integer.`;
    }

    if (params?.min !== undefined && n < (params.min as number)) {
      return `Value ${n} is less than minimum ${params.min}.`;
    }
    if (params?.max !== undefined && n > (params.max as number)) {
      return `Value ${n} exceeds maximum ${params.max}.`;
    }

    return null;
  },
};
