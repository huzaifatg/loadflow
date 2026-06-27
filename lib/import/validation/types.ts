// ─── Validation Engine — Types ────────────────────────────────────────────────
// Internal types for the validation engine. Consumers use contract types.

/**
 * A single validation rule definition.
 */
export interface ValidationRule {
  /** Unique rule identifier (e.g., 'required', 'integer', 'enum'). */
  readonly name: string;
  /** Human-readable description of what this rule checks. */
  readonly description: string;
  /**
   * Execute the rule against a single field value.
   * @param value - The normalized (trimmed) string value.
   * @param params - Rule-specific parameters (e.g., enum options, date formats).
   * @returns null if valid, or an error message string if invalid.
   */
  validate(value: string, params?: Record<string, unknown>): string | null;
}

/**
 * Configuration for validating a single field (column).
 */
export interface FieldValidationConfig {
  /** The normalized header name to validate. */
  readonly column: string;
  /** Whether this field is required (non-empty). */
  readonly required?: boolean;
  /** Rule names to apply, with optional parameters. */
  readonly rules: FieldRuleEntry[];
}

/**
 * A rule entry with optional parameters.
 */
export interface FieldRuleEntry {
  readonly ruleName: string;
  readonly params?: Record<string, unknown>;
}

/**
 * Complete validation profile for an import.
 */
export interface ValidationProfile {
  /** Human-readable name for this profile. */
  readonly name: string;
  /** Field validation configurations. */
  readonly fields: FieldValidationConfig[];
  /** Whether to perform duplicate detection. */
  readonly detectDuplicates?: boolean;
  /** Columns to use as the composite key for duplicate detection. */
  readonly duplicateKeyColumns?: string[];
}
