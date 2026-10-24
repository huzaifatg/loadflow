// ─── Load Plan Validation Service ────────────────────────────────────────────
// Centralized business-rule validation for load plans.
// All functions accept a Prisma TransactionClient so they compose with
// existing transactional workflows.  They return structured results instead
// of throwing, giving callers full control over the HTTP response.

import type { Prisma } from '@prisma/client'
import { toNumber } from '@/lib/delivery-items'
import { startOfDay, endOfDay } from 'date-fns'
import { evaluateDeliveryEligibility, isActivePlanStatus } from './load-plan-lifecycle'

// ─── Result Types ────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

export interface DateWarning {
  deliveryId: string
  customerName: string
  scheduledDate: string | null
  planDate: string
  message: string
}

export interface CapacityValidationResult {
  valid: boolean
  totalWeight: number
  truckCapacity: number
  error?: ValidationError
  /** Set when the truck or some deliveries do not exist within the company. */
  notFound?: boolean
}

export interface ConflictValidationResult {
  valid: boolean
  error?: ValidationError
  conflictingPlanId?: string
}

export type PrismaClient = Prisma.TransactionClient

// ─── 1. Capacity Enforcement ─────────────────────────────────────────────────

/**
 * Validate that the total weight of the given deliveries does not exceed
 * the truck's weight capacity.
 *
 * Both the truck and every delivery must belong to `companyId`. Deliveries
 * outside the company are rejected (never silently ignored), so the result
 * can be trusted by callers that subsequently write the same IDs.
 *
 * @param tx        Prisma client or transaction
 * @param truckId   The truck to validate against
 * @param deliveryIds  The set of delivery IDs being assigned
 * @param companyId Tenant boundary (from trusted server auth context)
 * @returns Structured result with `valid`, weights, and optional error
 */
export async function validateCapacity(
  tx: PrismaClient,
  truckId: string,
  deliveryIds: string[],
  companyId: string,
): Promise<CapacityValidationResult> {
  if (deliveryIds.length === 0) {
    return { valid: true, totalWeight: 0, truckCapacity: 0 }
  }

  const truck = await tx.truck.findFirst({
    where: { id: truckId, companyId },
    select: { weightCapacity: true },
  })

  if (!truck) {
    return {
      valid: false,
      totalWeight: 0,
      truckCapacity: 0,
      notFound: true,
      error: { field: 'truckId', message: 'Truck not found.' },
    }
  }

  const uniqueIds = Array.from(new Set(deliveryIds))
  const deliveries = await tx.delivery.findMany({
    where: { id: { in: uniqueIds }, companyId },
    select: { weight: true },
  })

  if (deliveries.length !== uniqueIds.length) {
    return {
      valid: false,
      totalWeight: 0,
      truckCapacity: truck.weightCapacity,
      notFound: true,
      error: { field: 'items', message: 'One or more deliveries were not found.' },
    }
  }

  const totalWeight = deliveries.reduce(
    (sum, d) => sum + toNumber(d.weight),
    0,
  )

  const truckCapacity = truck.weightCapacity

  if (totalWeight > truckCapacity) {
    return {
      valid: false,
      totalWeight,
      truckCapacity,
      error: {
        field: 'items',
        message: `Total delivery weight (${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg) exceeds truck capacity (${truckCapacity.toLocaleString()} kg). Remove some deliveries or choose a larger truck.`,
      },
    }
  }

  return { valid: true, totalWeight, truckCapacity }
}

// ─── 2. Truck Conflict Detection ─────────────────────────────────────────────

/**
 * Check whether the given truck is already assigned to another load plan
 * on the same date.
 *
 * @param tx          Prisma client or transaction
 * @param truckId     The truck to check
 * @param planDate    The date of the plan being created/updated
 * @param companyId   Tenant boundary
 * @param excludePlanId  The current plan's ID (for updates — skip self)
 */
export async function validateTruckConflict(
  tx: PrismaClient,
  truckId: string,
  planDate: Date,
  companyId: string,
  excludePlanId?: string,
): Promise<ConflictValidationResult> {
  const dayStart = startOfDay(planDate)
  const dayEnd = endOfDay(planDate)

  const conflict = await tx.loadPlan.findFirst({
    where: {
      companyId,
      truckId,
      date: { gte: dayStart, lte: dayEnd },
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
    },
    select: { id: true, truck: { select: { name: true } } },
  })

  if (conflict) {
    return {
      valid: false,
      conflictingPlanId: conflict.id,
      error: {
        field: 'truckId',
        message: `${conflict.truck?.name ?? 'This truck'} is already assigned to another load plan on this date.`,
      },
    }
  }

  return { valid: true }
}

// ─── 3. Driver Conflict Detection ────────────────────────────────────────────

/**
 * Check whether the given driver is already assigned to another load plan
 * on the same date.  Skips validation if driverId is null/undefined.
 */
export async function validateDriverConflict(
  tx: PrismaClient,
  driverId: string | null | undefined,
  planDate: Date,
  companyId: string,
  excludePlanId?: string,
): Promise<ConflictValidationResult> {
  if (!driverId) {
    return { valid: true }
  }

  const dayStart = startOfDay(planDate)
  const dayEnd = endOfDay(planDate)

  const conflict = await tx.loadPlan.findFirst({
    where: {
      companyId,
      driverId,
      date: { gte: dayStart, lte: dayEnd },
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
    },
    select: { id: true, driver: { select: { name: true } } },
  })

  if (conflict) {
    return {
      valid: false,
      conflictingPlanId: conflict.id,
      error: {
        field: 'driverId',
        message: `${conflict.driver?.name ?? 'This driver'} is already assigned to another load plan on this date.`,
      },
    }
  }

  return { valid: true }
}

// ─── 4. Delivery Date Consistency Warnings ───────────────────────────────────

/**
 * Compare each delivery's scheduledDate against the load plan date.
 * Returns warnings for mismatches — does NOT block the operation.
 * Only deliveries belonging to `companyId` are read.
 */
export async function getDeliveryDateWarnings(
  tx: PrismaClient,
  deliveryIds: string[],
  planDate: Date,
  companyId: string,
): Promise<DateWarning[]> {
  if (deliveryIds.length === 0) return []

  const deliveries = await tx.delivery.findMany({
    where: { id: { in: deliveryIds }, companyId },
    select: { id: true, customerName: true, scheduledDate: true },
  })

  const planDay = startOfDay(planDate).getTime()
  const warnings: DateWarning[] = []

  for (const d of deliveries) {
    if (d.scheduledDate) {
      const deliveryDay = startOfDay(new Date(d.scheduledDate)).getTime()
      if (deliveryDay !== planDay) {
        warnings.push({
          deliveryId: d.id,
          customerName: d.customerName,
          scheduledDate: new Date(d.scheduledDate).toISOString(),
          planDate: planDate.toISOString(),
          message: `"${d.customerName}" is scheduled for ${new Date(d.scheduledDate).toLocaleDateString()} but this plan is for ${planDate.toLocaleDateString()}.`,
        })
      }
    }
  }

  return warnings
}

// ─── 5. Delivery Eligibility ─────────────────────────────────────────────────

export interface IneligibleDelivery {
  deliveryId: string
  customerName: string
  status: string
  reason: string
}

export interface EligibilityValidationResult {
  valid: boolean
  /** Some IDs do not exist within the company (treat as not found). */
  notFound?: boolean
  ineligible: IneligibleDelivery[]
  error?: ValidationError
}

/**
 * Verify that every delivery belongs to `companyId` and is eligible to be in
 * the item set of `planId` (null when creating a new plan). The rule itself
 * lives in the pure `evaluateDeliveryEligibility()`:
 *   - already an item of this plan → may remain
 *   - otherwise must be PENDING, not archived, and in no other ACTIVE plan
 */
export async function validateDeliveryEligibility(
  tx: PrismaClient,
  companyId: string,
  deliveryIds: string[],
  planId: string | null,
): Promise<EligibilityValidationResult> {
  if (deliveryIds.length === 0) return { valid: true, ineligible: [] }

  const uniqueIds = Array.from(new Set(deliveryIds))
  const deliveries = await tx.delivery.findMany({
    where: { id: { in: uniqueIds }, companyId },
    select: {
      id: true,
      customerName: true,
      status: true,
      isArchived: true,
      loadPlanItems: {
        select: { loadPlanId: true, loadPlan: { select: { status: true } } },
      },
    },
  })

  if (deliveries.length !== uniqueIds.length) {
    return {
      valid: false,
      notFound: true,
      ineligible: [],
      error: { field: 'items', message: 'One or more deliveries were not found.' },
    }
  }

  const ineligible: IneligibleDelivery[] = []
  for (const d of deliveries) {
    // Fail closed: any active plan holding the delivery counts as an allocation.
    const activePlanIds = d.loadPlanItems
      .filter(i => isActivePlanStatus(i.loadPlan.status))
      .map(i => i.loadPlanId)
    const verdict = evaluateDeliveryEligibility(
      { status: d.status, isArchived: d.isArchived, activePlanIds },
      planId,
    )
    if (!verdict.eligible) {
      ineligible.push({ deliveryId: d.id, customerName: d.customerName, status: d.status, reason: verdict.reason })
    }
  }

  if (ineligible.length > 0) {
    const details = ineligible.map(i => `"${i.customerName}" ${i.reason}`).join('; ')
    return {
      valid: false,
      ineligible,
      error: { field: 'items', message: `The following deliveries are not eligible: ${details}.` },
    }
  }

  return { valid: true, ineligible: [] }
}

