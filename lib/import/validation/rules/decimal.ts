// ─── Validation Rule: Decimal ─────────────────────────────────────────────────
// Checks that a value is a valid decimal number (optional: min/max, precision).

import type { ValidationRule } from '../types';

export const decimalRule: ValidationRule = {
  name: 'decimal',
  description: 'Value must be a valid decimal number.',
  validate(value: string, params?: Record<string, unknown>): string | null {
    if (value.trim().length === 0) return null; // Empty handled by 'required' rule

    const n = Number(value);
    if (!Number.isFinite(n)) {
      return `"${value}" is not a valid number.`;
    }

    if (params?.min !== undefined && n < (params.min as number)) {
      return `Value ${n} is less than minimum ${params.min}.`;
    }
    if (params?.max !== undefined && n > (params.max as number)) {
      return `Value ${n} exceeds maximum ${params.max}.`;
    }

    if (params?.maxDecimalPlaces !== undefined) {
      const parts = value.trim().split('.');
      if (parts.length === 2 && parts[1].length > (params.maxDecimalPlaces as number)) {
        return `Value has ${parts[1].length} decimal places (maximum ${params.maxDecimalPlaces}).`;
      }
    }

    return null;
  },
};
