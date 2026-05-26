// ─── Shared Constants ────────────────────────────────────────────────────────

/**
 * Default quantity unit suggestions for the delivery items UI.
 * These are NOT an enum — any string is valid as a quantityUnit.
 * This list simply provides common suggestions in a dropdown.
 */
export const DEFAULT_QUANTITY_UNITS = [
  'cartons',
  'pcs',
  'pallets',
  'boxes',
  'crates',
  'bags',
  'rolls',
  'drums',
  'bundles',
  'units',
] as const

/**
 * Human-readable labels for UnitType enum values.
 */
export const UNIT_TYPE_LABELS: Record<string, string> = {
  STANDARD_WEIGHT: 'Standard Weight',
  VARIABLE_WEIGHT: 'Variable Weight',
  PIECE_BASED: 'Piece-Based',
}

/**
 * Short descriptions for UnitType enum values (used in tooltips/help).
 */
export const UNIT_TYPE_DESCRIPTIONS: Record<string, string> = {
  STANDARD_WEIGHT: 'Fixed weight per unit (e.g., 10 cartons × 20kg)',
  VARIABLE_WEIGHT: 'Units exist but actual weight varies (enter total weight)',
  PIECE_BASED: 'Counted by pieces with optional average weight',
}
