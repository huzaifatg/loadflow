// ─── Validation Rule: Boolean ─────────────────────────────────────────────────
// Checks that a value is a recognizable boolean string.

import type { ValidationRule } from '../types';

const TRUE_VALUES = new Set(['true', 'yes', '1', 'y', 'on']);
const FALSE_VALUES = new Set(['false', 'no', '0', 'n', 'off']);
const ALL_BOOLEAN = new Set([...TRUE_VALUES, ...FALSE_VALUES]);

export const booleanRule: ValidationRule = {
  name: 'boolean',
  description: 'Value must be a recognizable boolean (true/false/yes/no/1/0).',
  validate(value: string): string | null {
    if (value.trim().length === 0) return null; // Empty handled by 'required' rule

    if (!ALL_BOOLEAN.has(value.trim().toLowerCase())) {
      return `"${value}" is not a valid boolean. Expected: true, false, yes, no, 1, 0.`;
    }

    return null;
  },
};
