// ─── Validation Engine — Public API ───────────────────────────────────────────

export { validateDocument, VAL_CODES } from './engine';

export type {
  ValidationRule,
  FieldValidationConfig,
  FieldRuleEntry,
  ValidationProfile,
} from './types';

export {
  getRule,
  registerRule,
  getRegisteredRuleNames,
  requiredRule,
  integerRule,
  decimalRule,
  booleanRule,
  enumRule,
  dateRule,
} from './rules';
