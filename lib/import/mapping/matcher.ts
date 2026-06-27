// ─── Mapping Engine — Matcher ─────────────────────────────────────────────────
// Resolves header-to-field mappings using deterministic matching.
// Priority: explicit overrides > exact match > normalized match > alias match.

import type {
  DomainFieldDefinition,
  EntityDefinition,
  FieldMapping,
  MappingResult,
  DuplicateMapping,
  MatchConfidence,
  MappingProfile,
} from './types';
import { CONFIDENCE_SCORES } from './constants';

/**
 * Normalize a string for matching: lowercase, trim, replace non-alnum with underscore, collapse.
 */
function normalize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase to snake_case
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Match document headers against an entity definition.
 * Returns a complete MappingResult with resolved mappings, unmapped headers,
 * missing required fields, and duplicate mapping conflicts.
 */
export function matchHeaders(
  normalizedHeaders: string[],
  profile: MappingProfile,
): MappingResult {
  const entity = profile.entity;
  const overrides = profile.overrides || {};

  // Track which headers have been mapped
  const mappedHeaders = new Set<string>();
  // Track which fields have been mapped (field name → mapping)
  const fieldMappings = new Map<string, FieldMapping[]>();

  // ── Phase 1: Apply explicit overrides ───────────────────────────────────

  for (const header of normalizedHeaders) {
    const overrideTarget = overrides[header];
    if (overrideTarget) {
      const field = entity.fields.find(f => f.name === overrideTarget);
      if (field) {
        addMapping(fieldMappings, {
          sourceColumn: header,
          targetField: field.name,
          confidence: 'exact',
          score: CONFIDENCE_SCORES.exact,
        });
        mappedHeaders.add(header);
      }
    }
  }

  // ── Phase 2: Exact match (header === field name, case insensitive) ──────

  for (const header of normalizedHeaders) {
    if (mappedHeaders.has(header)) continue;

    for (const field of entity.fields) {
      if (field.name.toLowerCase() === header.toLowerCase()) {
        addMapping(fieldMappings, {
          sourceColumn: header,
          targetField: field.name,
          confidence: 'exact',
          score: CONFIDENCE_SCORES.exact,
        });
        mappedHeaders.add(header);
        break;
      }
    }
  }

  // ── Phase 3: Normalized match (normalize both sides) ────────────────────

  for (const header of normalizedHeaders) {
    if (mappedHeaders.has(header)) continue;

    const normalizedHeader = normalize(header);
    for (const field of entity.fields) {
      if (normalize(field.name) === normalizedHeader) {
        addMapping(fieldMappings, {
          sourceColumn: header,
          targetField: field.name,
          confidence: 'normalized',
          score: CONFIDENCE_SCORES.normalized,
        });
        mappedHeaders.add(header);
        break;
      }
    }
  }

  // ── Phase 4: Alias match ────────────────────────────────────────────────

  for (const header of normalizedHeaders) {
    if (mappedHeaders.has(header)) continue;

    const normalizedHeader = normalize(header);
    for (const field of entity.fields) {
      const aliasMatch = field.aliases.some(
        alias => normalize(alias) === normalizedHeader,
      );
      if (aliasMatch) {
        addMapping(fieldMappings, {
          sourceColumn: header,
          targetField: field.name,
          confidence: 'alias',
          score: CONFIDENCE_SCORES.alias,
        });
        mappedHeaders.add(header);
        break;
      }
    }
  }

  // ── Resolve duplicates ──────────────────────────────────────────────────

  const resolvedMappings: FieldMapping[] = [];
  const duplicateMappings: DuplicateMapping[] = [];

  for (const [targetField, mappings] of fieldMappings.entries()) {
    if (mappings.length === 1) {
      resolvedMappings.push(mappings[0]);
    } else {
      // Sort by score descending, then by source column alphabetically for determinism
      const sorted = [...mappings].sort((a, b) =>
        b.score - a.score || a.sourceColumn.localeCompare(b.sourceColumn),
      );
      resolvedMappings.push(sorted[0]); // Pick highest confidence
      duplicateMappings.push({
        targetField,
        sourceColumns: sorted.map(m => m.sourceColumn),
        selectedColumn: sorted[0].sourceColumn,
      });
    }
  }

  // ── Unmapped headers ────────────────────────────────────────────────────

  const unmappedHeaders = normalizedHeaders.filter(h => !mappedHeaders.has(h));

  // ── Missing required fields ─────────────────────────────────────────────

  const mappedFieldNames = new Set(resolvedMappings.map(m => m.targetField));
  const missingRequiredFields = entity.fields
    .filter(f => f.required && !mappedFieldNames.has(f.name))
    .map(f => f.name);

  return {
    entityName: entity.entityName,
    mappings: resolvedMappings,
    unmappedHeaders,
    missingRequiredFields,
    duplicateMappings,
  };
}

function addMapping(
  map: Map<string, FieldMapping[]>,
  mapping: FieldMapping,
): void {
  const existing = map.get(mapping.targetField) || [];
  existing.push(mapping);
  map.set(mapping.targetField, existing);
}
