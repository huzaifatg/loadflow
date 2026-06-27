// ─── Mapping Engine — Types ───────────────────────────────────────────────────
// Internal types for the mapping engine. Consumers use contract types.
// Imports ONLY from contract — never from CSV, adapters, or validation internals.

/**
 * Data type for a domain field. Used for type coercion during mapping.
 */
export type FieldDataType = 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'enum';

/**
 * Defines a single field in a target domain entity.
 */
export interface DomainFieldDefinition {
  /** Canonical domain field name (e.g., 'customerName'). */
  readonly name: string;
  /** Human-readable label for UI display. */
  readonly label: string;
  /** Expected data type. */
  readonly dataType: FieldDataType;
  /** Whether this field is required for a valid mapping. */
  readonly required: boolean;
  /** Aliases: additional header names that should map to this field. */
  readonly aliases: string[];
  /** Description of the field for documentation/UI. */
  readonly description?: string;
}

/**
 * Defines a target domain entity (e.g., 'delivery', 'driver', 'truck').
 */
export interface EntityDefinition {
  /** Entity identifier (e.g., 'delivery'). */
  readonly entityName: string;
  /** Human-readable label. */
  readonly label: string;
  /** Field definitions for this entity. */
  readonly fields: DomainFieldDefinition[];
}

/**
 * Confidence level for a mapping match.
 */
export type MatchConfidence = 'exact' | 'normalized' | 'alias';

/**
 * A single header-to-field mapping match.
 */
export interface FieldMapping {
  /** Normalized header name from the ImportDocument. */
  readonly sourceColumn: string;
  /** Domain field name this header maps to. */
  readonly targetField: string;
  /** How the match was determined. */
  readonly confidence: MatchConfidence;
  /** Numeric confidence score (1.0 = exact, 0.9 = normalized, 0.8 = alias). */
  readonly score: number;
}

/**
 * The complete mapping result for a document.
 */
export interface MappingResult {
  /** The target entity this document is being mapped to. */
  readonly entityName: string;
  /** All resolved field mappings (header → domain field). */
  readonly mappings: FieldMapping[];
  /** Normalized header names that had no mapping. */
  readonly unmappedHeaders: string[];
  /** Required domain fields that had no matching header. */
  readonly missingRequiredFields: string[];
  /** Headers that mapped to the same domain field (conflict). */
  readonly duplicateMappings: DuplicateMapping[];
}

/**
 * Represents a duplicate mapping conflict.
 */
export interface DuplicateMapping {
  readonly targetField: string;
  readonly sourceColumns: string[];
  /** Which source column was selected (first by priority). */
  readonly selectedColumn: string;
}

/**
 * Configuration for the mapping engine.
 */
export interface MappingProfile {
  /** Human-readable name for this profile. */
  readonly name: string;
  /** The target entity definition. */
  readonly entity: EntityDefinition;
  /** Optional explicit overrides: header name → field name. */
  readonly overrides?: Record<string, string>;
}
