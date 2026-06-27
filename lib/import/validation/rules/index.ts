// ─── Validation Rules — Registry ──────────────────────────────────────────────
// Central registry of all built-in validation rules.

import type { ValidationRule } from '../types';
import { requiredRule } from './required';
import { integerRule } from './integer';
import { decimalRule } from './decimal';
import { booleanRule } from './boolean';
import { enumRule } from './enum';
import { dateRule } from './date';

/**
 * Built-in validation rules indexed by name.
 */
const BUILT_IN_RULES: Map<string, ValidationRule> = new Map([
  [requiredRule.name, requiredRule],
  [integerRule.name, integerRule],
  [decimalRule.name, decimalRule],
  [booleanRule.name, booleanRule],
  [enumRule.name, enumRule],
  [dateRule.name, dateRule],
]);

/**
 * Get a validation rule by name.
 * Returns undefined if the rule is not registered.
 */
export function getRule(name: string): ValidationRule | undefined {
  return BUILT_IN_RULES.get(name);
}

/**
 * Register a custom validation rule.
 * Overwrites any existing rule with the same name.
 */
export function registerRule(rule: ValidationRule): void {
  BUILT_IN_RULES.set(rule.name, rule);
}

/**
 * Get all registered rule names.
 */
export function getRegisteredRuleNames(): string[] {
  return Array.from(BUILT_IN_RULES.keys());
}

// Re-export individual rules for direct access
export { requiredRule } from './required';
export { integerRule } from './integer';
export { decimalRule } from './decimal';
export { booleanRule } from './boolean';
export { enumRule } from './enum';
export { dateRule } from './date';
