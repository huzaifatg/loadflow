// ─── Load Plan Lifecycle (pure) ──────────────────────────────────────────────
// Sprint 14: Deterministic, side-effect-free business rules for the Load Plan
// lifecycle. NO database access lives here (ADR-004). DB-aware orchestration
// is in `load-plan-service.ts`, which feeds plain snapshots into these rules.
//
//   DRAFT ──► READY ──► DISPATCHED ──► COMPLETED
//     ▲         │
//     └─────────┘  (intentional revert-to-draft for editing)

export const LOAD_PLAN_STATUSES = ['DRAFT', 'READY', 'DISPATCHED', 'COMPLETED'] as const
export type LoadPlanStatusValue = typeof LOAD_PLAN_STATUSES[number]

export const DELIVERY_STATUSES = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const
export type DeliveryStatusValue = typeof DELIVERY_STATUSES[number]

export const TRUCK_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'] as const
export const DRIVER_STATUSES = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY'] as const

/** Plans in these statuses hold an allocation on their deliveries. */
export const ACTIVE_PLAN_STATUSES: readonly LoadPlanStatusValue[] = ['DRAFT', 'READY', 'DISPATCHED']

/** The complete, authoritative transition table. */
export const ALLOWED_TRANSITIONS: Readonly<Record<LoadPlanStatusValue, readonly LoadPlanStatusValue[]>> = {
  DRAFT: ['READY'],
  READY: ['DRAFT', 'DISPATCHED'],
  DISPATCHED: ['COMPLETED'],
  COMPLETED: [],
}

export function isLoadPlanStatus(value: unknown): value is LoadPlanStatusValue {
  return typeof value === 'string' && (LOAD_PLAN_STATUSES as readonly string[]).includes(value)
}

export function isActivePlanStatus(status: string): boolean {
  return (ACTIVE_PLAN_STATUSES as readonly string[]).includes(status)
}

export type TransitionCheck = { ok: true } | { ok: false; error: string }

/**
 * Validate a requested status change. Unknown statuses and every transition
 * not in ALLOWED_TRANSITIONS are rejected. COMPLETED is terminal.
 */
export function validateTransition(from: string, to: unknown): TransitionCheck {
  if (!isLoadPlanStatus(from)) {
    return { ok: false, error: `Load plan has an unknown status: ${String(from)}.` }
  }
  if (!isLoadPlanStatus(to)) {
    return {
      ok: false,
      error: `Invalid status: ${String(to)}. Must be one of: ${LOAD_PLAN_STATUSES.join(', ')}.`,
    }
  }
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Cannot transition from ${from} to ${to}. Allowed transitions: ${allowed.join(', ') || 'none'}.`,
    }
  }
  return { ok: true }
}

export function canTransition(from: string, to: unknown): boolean {
  return validateTransition(from, to).ok
}

/** Only DRAFT plans accept edits to items, truck or driver. READY is locked. */
export function isPlanEditable(status: string): boolean {
  return status === 'DRAFT'
}

/** Plans that have started execution (DISPATCHED/COMPLETED) cannot be deleted. */
export function isPlanDeletable(status: string): boolean {
  return status === 'DRAFT' || status === 'READY'
}

// ─── Delivery eligibility ────────────────────────────────────────────────────

export interface DeliveryEligibilityInput {
  status: string
  isArchived: boolean
  /** IDs of ACTIVE load plans (DRAFT/READY/DISPATCHED) that contain this delivery. */
  activePlanIds: string[]
}

export type DeliveryEligibility = { eligible: true } | { eligible: false; reason: string }

/**
 * Decide whether a delivery may be part of `planId`'s item set.
 *
 * - A delivery that is already an item of this same plan may remain.
 * - A new delivery must be PENDING, not archived and not allocated to any
 *   other active plan. IN_TRANSIT / DELIVERED / CANCELLED / ASSIGNED are
 *   rejected so they are never silently reset to ASSIGNED.
 *
 * Pass `planId = null` when creating a new plan.
 */
export function evaluateDeliveryEligibility(
  delivery: DeliveryEligibilityInput,
  planId: string | null,
): DeliveryEligibility {
  if (planId && delivery.activePlanIds.includes(planId)) {
    return { eligible: true }
  }
  if (delivery.isArchived) {
    return { eligible: false, reason: 'is archived' }
  }
  if (delivery.activePlanIds.length > 0) {
    return { eligible: false, reason: 'is already allocated to another active load plan' }
  }
  if (delivery.status !== 'PENDING') {
    return { eligible: false, reason: `is ${delivery.status}; only PENDING deliveries can be added` }
  }
  return { eligible: true }
}

/**
 * Status a delivery should take when it is released from a plan (item removed
 * or plan deleted). Only an ASSIGNED delivery returns to PENDING; CANCELLED,
 * IN_TRANSIT and DELIVERED are never reset. Returns null for "leave as is".
 */
export function releasedDeliveryStatus(status: string): 'PENDING' | null {
  return status === 'ASSIGNED' ? 'PENDING' : null
}

// ─── Dispatch preconditions ──────────────────────────────────────────────────

export interface DispatchSnapshot {
  planStatus: string
  /** Company-scoped truck lookup result (null = missing / other company). */
  truck: { status: string; isArchived: boolean; name?: string } | null
  driverId: string | null
  /** Company-scoped driver lookup result (null = missing / other company). */
  driver: { status: string; isArchived: boolean; name?: string } | null
  deliveries: { id: string; customerName: string; status: string }[]
}

/** Delivery statuses a plan item may have at dispatch. CANCELLED items are skipped. */
export const DISPATCHABLE_DELIVERY_STATUS = 'ASSIGNED'

/** Deliveries that will actually ship (ASSIGNED items). */
export function dispatchableDeliveries<T extends { status: string }>(deliveries: T[]): T[] {
  return deliveries.filter(d => d.status === DISPATCHABLE_DELIVERY_STATUS)
}

/**
 * Evaluate every non-database dispatch precondition. Returns a list of
 * human-readable reasons; an empty list means the plan may be dispatched
 * (subject to the DB-backed capacity and conflict checks in the service).
 */
export function evaluateDispatchPreconditions(s: DispatchSnapshot): string[] {
  const reasons: string[] = []

  const transition = validateTransition(s.planStatus, 'DISPATCHED')
  if (!transition.ok) reasons.push(transition.error)

  if (!s.truck) {
    reasons.push('Truck not found.')
  } else {
    if (s.truck.isArchived) reasons.push(`${s.truck.name ?? 'The truck'} is archived.`)
    if (s.truck.status === 'MAINTENANCE') {
      reasons.push(`${s.truck.name ?? 'The truck'} is in maintenance and cannot be dispatched.`)
    }
  }

  if (!s.driverId) {
    reasons.push('A driver must be assigned before dispatch.')
  } else if (!s.driver) {
    reasons.push('Assigned driver not found.')
  } else {
    if (s.driver.isArchived) reasons.push(`${s.driver.name ?? 'The driver'} is archived.`)
    if (s.driver.status === 'OFF_DUTY') {
      reasons.push(`${s.driver.name ?? 'The driver'} is off duty and cannot be dispatched.`)
    }
  }

  const blocking = s.deliveries.filter(
    d => d.status !== DISPATCHABLE_DELIVERY_STATUS && d.status !== 'CANCELLED',
  )
  for (const d of blocking) {
    reasons.push(`"${d.customerName}" is ${d.status}; only ASSIGNED deliveries can be dispatched.`)
  }

  if (dispatchableDeliveries(s.deliveries).length === 0) {
    reasons.push('Load plan has no deliveries to dispatch.')
  }

  return reasons
}
