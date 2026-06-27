// ─── Mapping Engine — Constants ───────────────────────────────────────────────

import type { MatchConfidence } from './types';

/** Diagnostic code prefix for the mapping engine. */
export const MAP_PREFIX = 'MAP_';

/** Mapping diagnostic codes. */
export const MAP_CODES = {
  FIELD_MAPPED: `${MAP_PREFIX}FIELD_MAPPED`,
  FIELD_UNMAPPED: `${MAP_PREFIX}FIELD_UNMAPPED`,
  REQUIRED_FIELD_MISSING: `${MAP_PREFIX}REQUIRED_FIELD_MISSING`,
  DUPLICATE_MAPPING: `${MAP_PREFIX}DUPLICATE_MAPPING`,
  ROW_SKIPPED_INVALID: `${MAP_PREFIX}ROW_SKIPPED_INVALID`,
  NO_RULE_FOUND: `${MAP_PREFIX}NO_RULE_FOUND`,
  OVERRIDE_APPLIED: `${MAP_PREFIX}OVERRIDE_APPLIED`,
} as const;

/** Confidence scores by match type. Higher = more confident. */
export const CONFIDENCE_SCORES: Record<MatchConfidence, number> = {
  exact: 1.0,
  normalized: 0.9,
  alias: 0.8,
} as const;

/** Match priority order (highest confidence first). */
export const MATCH_PRIORITY: readonly MatchConfidence[] = [
  'exact',
  'normalized',
  'alias',
] as const;
