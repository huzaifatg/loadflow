// ─── Delivery Items: Centralized Weight Computation & Decimal Utilities ──────
// This is the SINGLE SOURCE OF TRUTH for how item weights are calculated and
// how delivery weight is aggregated. All API routes, background jobs, and
// admin scripts MUST use these functions to maintain aggregate integrity.

import type { Decimal } from '@prisma/client/runtime/library'

// ─── Decimal Utilities ───────────────────────────────────────────────────────

/** Round to 4 decimal places to match DB Decimal(12,4) precision */
export function round4(val: number): number {
  return Math.round(val * 10000) / 10000
}

/** Parse Prisma Decimal (string | Decimal | number | null) to JS number safely */
export function toNumber(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  return Number(val) // Handles Decimal objects (.toString()) and strings
}

// ─── Unit Type Constants ─────────────────────────────────────────────────────

export const UNIT_TYPES = {
  STANDARD_WEIGHT: 'STANDARD_WEIGHT',
  VARIABLE_WEIGHT: 'VARIABLE_WEIGHT',
  PIECE_BASED: 'PIECE_BASED',
} as const

export type UnitTypeValue = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES]

// ─── Item Weight Computation ─────────────────────────────────────────────────

export interface ComputeItemWeightInput {
  unitType: string
  quantity: number
  unitWeight?: number | null
  totalWeight?: number | null
}

/**
 * Compute the totalWeight for a single delivery item based on its unitType.
 *
 * Priority:
 * 1. If totalWeight is explicitly provided and > 0, it's used as-is (override).
 * 2. Otherwise auto-calculated from quantity × unitWeight where applicable.
 *
 * @returns Rounded total weight for the item
 */
export function computeItemWeight(item: ComputeItemWeightInput): number {
  // If totalWeight is explicitly provided and positive, always use it (override)
  if (item.totalWeight != null && item.totalWeight > 0) {
    return round4(item.totalWeight)
  }

  // Auto-calculate based on unitType
  switch (item.unitType) {
    case UNIT_TYPES.STANDARD_WEIGHT:
      if (item.unitWeight != null && item.quantity > 0) {
        return round4(item.quantity * item.unitWeight)
      }
      return 0

    case UNIT_TYPES.VARIABLE_WEIGHT:
      // Variable weight REQUIRES explicit totalWeight — validation catches this upstream
      return 0

    case UNIT_TYPES.PIECE_BASED:
      if (item.unitWeight != null && item.quantity > 0) {
        return round4(item.quantity * item.unitWeight)
      }
      return 0

    default:
      return 0
  }
}

// ─── Delivery Weight Aggregation ─────────────────────────────────────────────

/**
 * Recompute the aggregate delivery weight from its items.
 * Accepts Prisma Decimal values (string | Decimal | number).
 *
 * @returns Rounded sum of all item totalWeights
 */
export function recomputeDeliveryWeight(
  items: { totalWeight: number | string | Decimal }[]
): number {
  const sum = items.reduce((acc, item) => acc + toNumber(item.totalWeight), 0)
  return round4(sum)
}

/**
 * Resolve the effective weight for a delivery, handling both
 * legacy (no items, manual weight) and new (items-based) modes.
 *
 * @param deliveryWeight The delivery's stored weight field
 * @param items The delivery's items (may be empty for legacy deliveries)
 * @returns The effective weight to display/use
 */
export function resolveDeliveryWeight(
  deliveryWeight: number | string | Decimal,
  items?: { totalWeight: number | string | Decimal }[]
): number {
  if (items && items.length > 0) {
    return recomputeDeliveryWeight(items)
  }
  return toNumber(deliveryWeight)
}

// ─── Item Summary Helpers ────────────────────────────────────────────────────

/**
 * Generate a short human-readable summary of delivery items for cards/lists.
 * e.g., "NZ Topside, Lamb Rack +1"
 */
export function getItemSummary(items: { productName: string }[], maxShow = 2): string {
  if (!items || items.length === 0) return ''
  const shown = items.slice(0, maxShow).map(i => i.productName)
  const remaining = items.length - maxShow
  if (remaining > 0) {
    return `${shown.join(', ')} +${remaining}`
  }
  return shown.join(', ')
}

/**
 * Aggregate item quantities grouped by quantityUnit.
 * e.g., [{ unit: "cartons", count: 87 }, { unit: "pcs", count: 12 }]
 */
export function aggregateByUnit(
  items: { quantity: number | string | Decimal; quantityUnit: string }[]
): { unit: string; count: number }[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const qty = toNumber(item.quantity)
    const unit = item.quantityUnit || 'units'
    map.set(unit, (map.get(unit) || 0) + qty)
  }
  return Array.from(map.entries()).map(([unit, count]) => ({
    unit,
    count: round4(count),
  }))
}

// ─── Serialization Helpers ───────────────────────────────────────────────────

/**
 * Serialize a Delivery object (and its items) from Prisma to pass to Client Components.
 * Converts Decimal fields to numbers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeDelivery(delivery: any): any {
  return {
    ...delivery,
    weight: toNumber(delivery.weight),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: delivery.items?.map((item: any) => serializeDeliveryItem(item)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeDeliveryItem(item: any): any {
  return {
    ...item,
    quantity: toNumber(item.quantity),
    unitWeight: item.unitWeight ? toNumber(item.unitWeight) : null,
    totalWeight: toNumber(item.totalWeight),
  };
}
