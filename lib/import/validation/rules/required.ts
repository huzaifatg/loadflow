// ─── Validation Rule: Required ────────────────────────────────────────────────
// Checks that a value is non-empty and not whitespace-only.

import type { ValidationRule } from '../types';

export const requiredRule: ValidationRule = {
  name: 'required',
  description: 'Value must not be empty or whitespace-only.',
  validate(value: string): string | null {
    if (value.trim().length === 0) {
      return 'This field is required.';
    }
    return null;
  },
};
