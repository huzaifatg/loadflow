// ─── Dispatch Scheduling Conflict Detection & Readiness Service (Sprint 18) ──
// Pure + DB-backed conflict detection and dispatch readiness evaluation.
// Composes with `load-plan-lifecycle.ts` so UI readiness badges, Dispatch Board
// warnings, and server-side dispatch rules stay 100% aligned.

import type { PrismaClient } from '@prisma/client'
import { format, isSameDay, startOfDay, endOfDay } from 'date-fns'
import { toNumber } from '@/lib/delivery-items'
import {
  dispatchableDeliveries,
  isActivePlanStatus,
  validateTransition,
} from './load-plan-lifecycle'
import { parseOperatingDate } from './dispatch-availability'

export type ConflictSeverity = 'BLOCKING' | 'WARNING' | 'INFO'

export type ConflictCode =
  | 'TRUCK_CONFLICT'
  | 'DRIVER_CONFLICT'
  | 'CAPACITY_EXCEEDED'
  | 'TRUCK_UNAVAILABLE'
  | 'DRIVER_UNAVAILABLE'
  | 'MISSING_TRUCK'
  | 'MISSING_DRIVER'
  | 'EMPTY_LOAD_PLAN'
  | 'INVALID_DELIVERY_STATUS'
  | 'CANCELLED_DELIVERY_INCLUDED'
  | 'DELIVERY_DATE_MISMATCH'
  | 'OVERDUE_DISPATCH'
  | 'OVERDUE_COMPLETION'

export interface SchedulingConflictDTO {
  id: string
  code: ConflictCode
  severity: ConflictSeverity
  title: string
  message: string
  planId: string
  planRef: string
  planDate: string
  planStatus: string
  resourceType?: 'truck' | 'driver' | 'delivery'
  resourceId?: string
  resourceName?: string
  conflictingPlanId?: string
  conflictingPlanRef?: string
}

export type ReadinessState =
  | 'READY_TO_DISPATCH'
  | 'READY_TO_LOCK'
  | 'AWAITING_ASSIGNMENT'
  | 'BLOCKED'
  | 'DISPATCHED'
  | 'COMPLETED'

export interface PlanDispatchReadinessDTO {
  planId: string
  planRef: string
  status: string
  readinessState: ReadinessState
  readinessLabel: string
  readinessTone: 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'neutral'
  canMarkReady: boolean
  canDispatch: boolean
  canAssignResources: boolean
  requiresRevertToEdit: boolean
  blockingReasons: string[]
  warnings: string[]
  infoNotes: string[]
  conflicts: SchedulingConflictDTO[]
  checks: {
    truckAssigned: boolean
    truckAvailable: boolean
    driverAssigned: boolean
    driverAvailable: boolean
    hasDeliveries: boolean
    capacityValid: boolean
    noResourceConflicts: boolean
    deliveriesEligible: boolean
  }
}

export interface ConflictPlanSnapshot {
  id: string
  status: string
  date: Date
  truckId: string
  driverId: string | null
  truck: {
    id: string
    name: string
    plateNumber: string
    weightCapacity: number
    status: string
    isArchived: boolean
  } | null
  driver: {
    id: string
    name: string
    status: string
    isArchived: boolean
  } | null
  deliveries: {
    id: string
    customerName: string
    status: string
    weight: number
    scheduledDate: Date | null
  }[]
}

const formatPlanRef = (id: string) => `Plan #${id.slice(-6).toUpperCase()}`

const SEVERITY_RANK: Record<ConflictSeverity, number> = {
  BLOCKING: 0,
  WARNING: 1,
  INFO: 2,
}

/**
 * Detect all scheduling conflicts and readiness issues across a set of load plans.
 */
export function detectSchedulingConflicts(
  plans: ConflictPlanSnapshot[],
  now: Date = new Date(),
): SchedulingConflictDTO[] {
  const today = startOfDay(now)
  const conflicts: SchedulingConflictDTO[] = []
  const seen = new Set<string>()

  const pushConflict = (c: SchedulingConflictDTO) => {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      conflicts.push(c)
    }
  }

  // Active plans that hold resource commitments
  const activePlans = plans.filter((p) => isActivePlanStatus(p.status))

  for (const plan of plans) {
    if (plan.status === 'COMPLETED') continue

    const planRef = formatPlanRef(plan.id)
    const planDay = startOfDay(new Date(plan.date))
    const planDateIso = new Date(plan.date).toISOString()
    const planDateLabel = format(planDay, 'MMM d, yyyy')
    const isPreDispatch = plan.status === 'DRAFT' || plan.status === 'READY'

    // 1. Overlapping truck assignments on the same operating day
    if (plan.truckId) {
      const overlappingTruckPlans = plans.filter(
        (other) =>
          other.id !== plan.id &&
          other.truckId === plan.truckId &&
          isSameDay(new Date(other.date), planDay) &&
          other.status !== 'COMPLETED',
      )

      for (const other of overlappingTruckPlans) {
        const otherRef = formatPlanRef(other.id)
        const truckName = plan.truck?.name ?? 'Assigned truck'
        pushConflict({
          id: `TRUCK_CONFLICT:${plan.id}:${other.id}`,
          code: 'TRUCK_CONFLICT',
          severity: 'BLOCKING',
          title: 'Truck double-booked on same date',
          message: `${truckName} is assigned to both ${planRef} (${plan.status}) and ${otherRef} (${other.status}) on ${planDateLabel}.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'truck',
          resourceId: plan.truckId,
          resourceName: truckName,
          conflictingPlanId: other.id,
          conflictingPlanRef: otherRef,
        })
      }

      // Also check if truck is currently DISPATCHED on an uncompleted plan from another date
      if (isPreDispatch) {
        const activeDispatchedTruckPlan = activePlans.find(
          (other) =>
            other.id !== plan.id &&
            other.truckId === plan.truckId &&
            other.status === 'DISPATCHED' &&
            !isSameDay(new Date(other.date), planDay) &&
            planDay <= today,
        )
        if (activeDispatchedTruckPlan) {
          const otherRef = formatPlanRef(activeDispatchedTruckPlan.id)
          const truckName = plan.truck?.name ?? 'Assigned truck'
          pushConflict({
            id: `TRUCK_CONFLICT_IN_TRANSIT:${plan.id}:${activeDispatchedTruckPlan.id}`,
            code: 'TRUCK_CONFLICT',
            severity: 'BLOCKING',
            title: 'Truck still in transit on another dispatched plan',
            message: `${truckName} is currently in transit on ${otherRef} (${format(new Date(activeDispatchedTruckPlan.date), 'MMM d')}) and has not been completed.`,
            planId: plan.id,
            planRef,
            planDate: planDateIso,
            planStatus: plan.status,
            resourceType: 'truck',
            resourceId: plan.truckId,
            resourceName: truckName,
            conflictingPlanId: activeDispatchedTruckPlan.id,
            conflictingPlanRef: otherRef,
          })
        }
      }
    }

    // 2. Overlapping driver assignments on the same operating day
    if (plan.driverId) {
      const overlappingDriverPlans = plans.filter(
        (other) =>
          other.id !== plan.id &&
          other.driverId === plan.driverId &&
          isSameDay(new Date(other.date), planDay) &&
          other.status !== 'COMPLETED',
      )

      for (const other of overlappingDriverPlans) {
        const otherRef = formatPlanRef(other.id)
        const driverName = plan.driver?.name ?? 'Assigned driver'
        pushConflict({
          id: `DRIVER_CONFLICT:${plan.id}:${other.id}`,
          code: 'DRIVER_CONFLICT',
          severity: 'BLOCKING',
          title: 'Driver double-booked on same date',
          message: `${driverName} is assigned to both ${planRef} (${plan.status}) and ${otherRef} (${other.status}) on ${planDateLabel}.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'driver',
          resourceId: plan.driverId,
          resourceName: driverName,
          conflictingPlanId: other.id,
          conflictingPlanRef: otherRef,
        })
      }

      if (isPreDispatch) {
        const activeDispatchedDriverPlan = activePlans.find(
          (other) =>
            other.id !== plan.id &&
            other.driverId === plan.driverId &&
            other.status === 'DISPATCHED' &&
            !isSameDay(new Date(other.date), planDay) &&
            planDay <= today,
        )
        if (activeDispatchedDriverPlan) {
          const otherRef = formatPlanRef(activeDispatchedDriverPlan.id)
          const driverName = plan.driver?.name ?? 'Assigned driver'
          pushConflict({
            id: `DRIVER_CONFLICT_ON_TRIP:${plan.id}:${activeDispatchedDriverPlan.id}`,
            code: 'DRIVER_CONFLICT',
            severity: 'BLOCKING',
            title: 'Driver still on trip for another dispatched plan',
            message: `${driverName} is currently on trip for ${otherRef} (${format(new Date(activeDispatchedDriverPlan.date), 'MMM d')}) and has not been released.`,
            planId: plan.id,
            planRef,
            planDate: planDateIso,
            planStatus: plan.status,
            resourceType: 'driver',
            resourceId: plan.driverId,
            resourceName: driverName,
            conflictingPlanId: activeDispatchedDriverPlan.id,
            conflictingPlanRef: otherRef,
          })
        }
      }
    }

    // 3. Truck status & existence validation
    if (!plan.truck) {
      pushConflict({
        id: `MISSING_TRUCK:${plan.id}`,
        code: 'MISSING_TRUCK',
        severity: 'BLOCKING',
        title: 'Assigned truck not found',
        message: `${planRef} does not have a valid company truck assigned.`,
        planId: plan.id,
        planRef,
        planDate: planDateIso,
        planStatus: plan.status,
        resourceType: 'truck',
      })
    } else if (plan.truck.isArchived || plan.truck.status === 'MAINTENANCE') {
      const reason = plan.truck.isArchived ? 'archived' : 'in maintenance'
      pushConflict({
        id: `TRUCK_UNAVAILABLE:${plan.id}`,
        code: 'TRUCK_UNAVAILABLE',
        severity: 'BLOCKING',
        title: `Assigned truck is ${reason}`,
        message: `${plan.truck.name} is ${reason} and cannot be dispatched on ${planRef}.`,
        planId: plan.id,
        planRef,
        planDate: planDateIso,
        planStatus: plan.status,
        resourceType: 'truck',
        resourceId: plan.truck.id,
        resourceName: plan.truck.name,
      })
    }

    // 4. Driver assignment & status validation
    if (!plan.driverId || !plan.driver) {
      if (isPreDispatch) {
        const isBlocking = plan.status === 'READY' || planDay <= today
        pushConflict({
          id: `MISSING_DRIVER:${plan.id}`,
          code: 'MISSING_DRIVER',
          severity: isBlocking ? 'BLOCKING' : 'WARNING',
          title: 'Driver not assigned',
          message: `${planRef} (${planDateLabel}) requires an active driver before it can be dispatched.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'driver',
        })
      }
    } else if (plan.driver.isArchived || plan.driver.status === 'OFF_DUTY') {
      const reason = plan.driver.isArchived ? 'archived' : 'off duty'
      pushConflict({
        id: `DRIVER_UNAVAILABLE:${plan.id}`,
        code: 'DRIVER_UNAVAILABLE',
        severity: 'BLOCKING',
        title: `Assigned driver is ${reason}`,
        message: `${plan.driver.name} is ${reason} and cannot be dispatched on ${planRef}.`,
        planId: plan.id,
        planRef,
        planDate: planDateIso,
        planStatus: plan.status,
        resourceType: 'driver',
        resourceId: plan.driver.id,
        resourceName: plan.driver.name,
      })
    }

    // 5. Capacity validation
    const nonCancelledDeliveries = plan.deliveries.filter((d) => d.status !== 'CANCELLED')
    const totalWeight = nonCancelledDeliveries.reduce((sum, d) => sum + d.weight, 0)
    const maxCap = plan.truck?.weightCapacity ?? 0
    if (plan.truck && maxCap > 0 && totalWeight > maxCap) {
      pushConflict({
        id: `CAPACITY_EXCEEDED:${plan.id}`,
        code: 'CAPACITY_EXCEEDED',
        severity: 'BLOCKING',
        title: 'Truck weight capacity exceeded',
        message: `${planRef} carries ${Math.round(totalWeight).toLocaleString()} kg, exceeding ${plan.truck.name} capacity of ${Math.round(maxCap).toLocaleString()} kg by ${Math.round(totalWeight - maxCap).toLocaleString()} kg.`,
        planId: plan.id,
        planRef,
        planDate: planDateIso,
        planStatus: plan.status,
        resourceType: 'truck',
        resourceId: plan.truck.id,
        resourceName: plan.truck.name,
      })
    }

    // 6. Pre-dispatch delivery eligibility, emptiness & date consistency
    if (isPreDispatch) {
      const dispatchable = dispatchableDeliveries(plan.deliveries)
      if (dispatchable.length === 0) {
        pushConflict({
          id: `EMPTY_LOAD_PLAN:${plan.id}`,
          code: 'EMPTY_LOAD_PLAN',
          severity: plan.status === 'READY' ? 'BLOCKING' : 'WARNING',
          title: 'Load plan has no dispatchable deliveries',
          message: `${planRef} has 0 assigned deliveries and cannot be dispatched until at least 1 delivery is allocated.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
        })
      }

      const invalidDeliveries = plan.deliveries.filter(
        (d) => d.status !== 'ASSIGNED' && d.status !== 'CANCELLED',
      )
      if (invalidDeliveries.length > 0) {
        const summary = invalidDeliveries
          .slice(0, 3)
          .map((d) => `"${d.customerName}" (${d.status})`)
          .join(', ')
        pushConflict({
          id: `INVALID_DELIVERY_STATUS:${plan.id}`,
          code: 'INVALID_DELIVERY_STATUS',
          severity: 'BLOCKING',
          title: 'Non-dispatchable delivery status on plan',
          message: `${planRef} includes deliveries that are not in ASSIGNED state: ${summary}.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'delivery',
          resourceId: invalidDeliveries[0].id,
          resourceName: invalidDeliveries[0].customerName,
        })
      }

      const cancelledDeliveries = plan.deliveries.filter((d) => d.status === 'CANCELLED')
      if (cancelledDeliveries.length > 0) {
        pushConflict({
          id: `CANCELLED_DELIVERY_INCLUDED:${plan.id}`,
          code: 'CANCELLED_DELIVERY_INCLUDED',
          severity: 'INFO',
          title: 'Cancelled delivery listed on plan',
          message: `${cancelledDeliveries.length} cancelled ${cancelledDeliveries.length === 1 ? 'delivery is' : 'deliveries are'} still on ${planRef} and will be skipped at dispatch.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'delivery',
          resourceId: cancelledDeliveries[0].id,
          resourceName: cancelledDeliveries[0].customerName,
        })
      }

      // Delivery date mismatch warning
      const mismatchedDeliveries = nonCancelledDeliveries.filter(
        (d) => d.scheduledDate && !isSameDay(new Date(d.scheduledDate), planDay),
      )
      if (mismatchedDeliveries.length > 0) {
        const first = mismatchedDeliveries[0]
        pushConflict({
          id: `DELIVERY_DATE_MISMATCH:${plan.id}`,
          code: 'DELIVERY_DATE_MISMATCH',
          severity: 'WARNING',
          title: 'Delivery date differs from plan date',
          message:
            mismatchedDeliveries.length === 1
              ? `"${first.customerName}" is requested for ${format(new Date(first.scheduledDate!), 'MMM d, yyyy')}, while ${planRef} is planned for ${planDateLabel}.`
              : `${mismatchedDeliveries.length} deliveries on ${planRef} have requested dates different from ${planDateLabel}.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
          resourceType: 'delivery',
          resourceId: first.id,
          resourceName: first.customerName,
        })
      }

      // Overdue dispatch warning
      if (planDay < today) {
        pushConflict({
          id: `OVERDUE_DISPATCH:${plan.id}`,
          code: 'OVERDUE_DISPATCH',
          severity: 'WARNING',
          title: 'Planned dispatch date has passed',
          message: `${planRef} was scheduled for ${planDateLabel} and is still ${plan.status}.`,
          planId: plan.id,
          planRef,
          planDate: planDateIso,
          planStatus: plan.status,
        })
      }
    }

    if (plan.status === 'DISPATCHED' && planDay < today) {
      pushConflict({
        id: `OVERDUE_COMPLETION:${plan.id}`,
        code: 'OVERDUE_COMPLETION',
        severity: 'WARNING',
        title: 'Dispatched plan past planned date',
        message: `${planRef} was dispatched for ${planDateLabel} and has not yet been marked COMPLETED.`,
        planId: plan.id,
        planRef,
        planDate: planDateIso,
        planStatus: plan.status,
      })
    }
  }

  return conflicts.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.planDate.localeCompare(b.planDate) ||
      a.id.localeCompare(b.id),
  )
}

/**
 * Evaluate complete dispatch readiness for a single load plan against the
 * current company snapshot.
 */
export function evaluatePlanDispatchReadiness(
  plan: ConflictPlanSnapshot,
  allPlans: ConflictPlanSnapshot[],
  now: Date = new Date(),
): PlanDispatchReadinessDTO {
  const planRef = formatPlanRef(plan.id)
  const allConflicts = detectSchedulingConflicts(allPlans, now).filter(
    (c) => c.planId === plan.id,
  )

  const truckAssigned = Boolean(plan.truckId && plan.truck)
  const truckAvailable = Boolean(
    plan.truck && !plan.truck.isArchived && plan.truck.status !== 'MAINTENANCE',
  )
  const driverAssigned = Boolean(plan.driverId && plan.driver)
  const driverAvailable = Boolean(
    plan.driver && !plan.driver.isArchived && plan.driver.status !== 'OFF_DUTY',
  )

  const dispatchable = dispatchableDeliveries(plan.deliveries)
  const hasDeliveries = dispatchable.length > 0

  const nonCancelled = plan.deliveries.filter((d) => d.status !== 'CANCELLED')
  const totalWeight = nonCancelled.reduce((sum, d) => sum + d.weight, 0)
  const maxCap = plan.truck?.weightCapacity ?? 0
  const capacityValid = !plan.truck || maxCap <= 0 || totalWeight <= maxCap

  const invalidDeliveries = plan.deliveries.filter(
    (d) => d.status !== 'ASSIGNED' && d.status !== 'CANCELLED',
  )
  const deliveriesEligible = invalidDeliveries.length === 0

  const resourceConflictItems = allConflicts.filter(
    (c) => c.code === 'TRUCK_CONFLICT' || c.code === 'DRIVER_CONFLICT',
  )
  const noResourceConflicts = resourceConflictItems.length === 0

  if (plan.status === 'COMPLETED') {
    return {
      planId: plan.id,
      planRef,
      status: plan.status,
      readinessState: 'COMPLETED',
      readinessLabel: 'Completed',
      readinessTone: 'success',
      canMarkReady: false,
      canDispatch: false,
      canAssignResources: false,
      requiresRevertToEdit: false,
      blockingReasons: [],
      warnings: [],
      infoNotes: [],
      conflicts: [],
      checks: {
        truckAssigned,
        truckAvailable,
        driverAssigned,
        driverAvailable,
        hasDeliveries: plan.deliveries.length > 0,
        capacityValid,
        noResourceConflicts: true,
        deliveriesEligible: true,
      },
    }
  }

  if (plan.status === 'DISPATCHED') {
    const warnings = allConflicts
      .filter((c) => c.severity === 'WARNING')
      .map((c) => c.message)
    const blockingReasons = allConflicts
      .filter((c) => c.severity === 'BLOCKING')
      .map((c) => c.message)
    return {
      planId: plan.id,
      planRef,
      status: plan.status,
      readinessState: 'DISPATCHED',
      readinessLabel: 'In Transit',
      readinessTone: 'primary',
      canMarkReady: false,
      canDispatch: false,
      canAssignResources: false,
      requiresRevertToEdit: false,
      blockingReasons,
      warnings,
      infoNotes: [],
      conflicts: allConflicts,
      checks: {
        truckAssigned,
        truckAvailable,
        driverAssigned,
        driverAvailable,
        hasDeliveries: plan.deliveries.length > 0,
        capacityValid,
        noResourceConflicts,
        deliveriesEligible: true,
      },
    }
  }

  // For DRAFT or READY plans, build exact reasons why the plan can or cannot dispatch
  const blockingReasons: string[] = []
  const warnings: string[] = []
  const infoNotes: string[] = []

  // Hard blockers (prevent dispatch even if status is READY)
  if (!truckAssigned) {
    blockingReasons.push('Missing truck assignment.')
  } else if (!truckAvailable) {
    blockingReasons.push(
      `${plan.truck!.name} is ${plan.truck!.isArchived ? 'archived' : 'in maintenance'} and unavailable.`,
    )
  }

  if (!driverAssigned) {
    blockingReasons.push('Missing driver assignment.')
  } else if (!driverAvailable) {
    blockingReasons.push(
      `${plan.driver!.name} is ${plan.driver!.isArchived ? 'archived' : 'off duty'} and unavailable.`,
    )
  }

  if (!hasDeliveries) {
    blockingReasons.push('Empty load plan — allocate at least 1 delivery.')
  }

  if (!capacityValid && plan.truck) {
    blockingReasons.push(
      `Load weight (${Math.round(totalWeight).toLocaleString()} kg) exceeds ${plan.truck.name} capacity (${Math.round(maxCap).toLocaleString()} kg).`,
    )
  }

  if (!deliveriesEligible) {
    for (const d of invalidDeliveries) {
      blockingReasons.push(`"${d.customerName}" has invalid status ${d.status} (must be ASSIGNED).`)
    }
  }

  for (const rc of resourceConflictItems) {
    blockingReasons.push(rc.message)
  }

  for (const c of allConflicts) {
    if (c.severity === 'WARNING' && c.code !== 'MISSING_DRIVER' && c.code !== 'EMPTY_LOAD_PLAN') {
      warnings.push(c.message)
    } else if (c.severity === 'INFO') {
      infoNotes.push(c.message)
    }
  }

  const allPhysicalPreconditionsMet =
    truckAssigned &&
    truckAvailable &&
    driverAssigned &&
    driverAvailable &&
    hasDeliveries &&
    capacityValid &&
    deliveriesEligible &&
    noResourceConflicts

  // Hard structural blockers (capacity exceeded, inactive resource, resource conflict, invalid delivery)
  const hasHardConflict =
    !truckAssigned ||
    !truckAvailable ||
    (driverAssigned && !driverAvailable) ||
    !capacityValid ||
    !deliveriesEligible ||
    !noResourceConflicts

  const canMarkReady =
    validateTransition(plan.status, 'READY').ok && !hasHardConflict && hasDeliveries
  const canDispatch =
    validateTransition(plan.status, 'DISPATCHED').ok && allPhysicalPreconditionsMet

  let readinessState: ReadinessState
  let readinessLabel: string
  let readinessTone: PlanDispatchReadinessDTO['readinessTone']

  if (hasHardConflict) {
    readinessState = 'BLOCKED'
    readinessLabel = 'Blocked'
    readinessTone = 'danger'
  } else if (!driverAssigned || !hasDeliveries) {
    readinessState = 'AWAITING_ASSIGNMENT'
    readinessLabel = !driverAssigned && !hasDeliveries
      ? 'Needs Driver & Stops'
      : !driverAssigned
        ? 'Awaiting Driver'
        : 'Needs Deliveries'
    readinessTone = 'warning'
  } else if (plan.status === 'READY' && allPhysicalPreconditionsMet) {
    readinessState = 'READY_TO_DISPATCH'
    readinessLabel = 'Ready to Dispatch'
    readinessTone = 'success'
  } else {
    readinessState = 'READY_TO_LOCK'
    readinessLabel = 'Ready to Lock'
    readinessTone = 'info'
  }

  return {
    planId: plan.id,
    planRef,
    status: plan.status,
    readinessState,
    readinessLabel,
    readinessTone,
    canMarkReady,
    canDispatch,
    canAssignResources: plan.status === 'DRAFT' || plan.status === 'READY',
    requiresRevertToEdit: plan.status === 'READY',
    blockingReasons,
    warnings,
    infoNotes,
    conflicts: allConflicts,
    checks: {
      truckAssigned,
      truckAvailable,
      driverAssigned,
      driverAvailable,
      hasDeliveries,
      capacityValid,
      noResourceConflicts,
      deliveriesEligible,
    },
  }
}

export type ConflictsDb = Pick<PrismaClient, 'loadPlan'>

export interface GetDispatchConflictsOptions {
  date?: Date | string | null
  severity?: ConflictSeverity
  planId?: string
}

/**
 * Load company-scoped active/relevant plans and compute scheduling conflicts + per-plan readiness.
 */
export async function getDispatchConflicts(
  db: ConflictsDb,
  companyId: string,
  options: GetDispatchConflictsOptions = {},
) {
  const hasDateFilter = Boolean(options.date)
  const opDay = hasDateFilter ? parseOperatingDate(options.date) : null

  const plans = await db.loadPlan.findMany({
    where: {
      companyId,
      ...(opDay
        ? {
            OR: [
              { date: { gte: startOfDay(opDay), lte: endOfDay(opDay) } },
              { status: { in: ['DRAFT', 'READY', 'DISPATCHED'] } },
            ],
          }
        : { status: { in: ['DRAFT', 'READY', 'DISPATCHED'] } }),
    },
    include: {
      truck: {
        select: {
          id: true,
          name: true,
          plateNumber: true,
          weightCapacity: true,
          status: true,
          isArchived: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
          status: true,
          isArchived: true,
        },
      },
      items: {
        include: {
          delivery: {
            select: {
              id: true,
              companyId: true,
              customerName: true,
              status: true,
              weight: true,
              scheduledDate: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
  })

  const snapshots: ConflictPlanSnapshot[] = plans.map((p) => ({
    id: p.id,
    status: p.status,
    date: p.date,
    truckId: p.truckId,
    driverId: p.driverId,
    truck: p.truck,
    driver: p.driver,
    deliveries: p.items
      .map((i) => i.delivery)
      .filter((d) => d.companyId === companyId)
      .map((d) => ({
        id: d.id,
        customerName: d.customerName,
        status: d.status,
        weight: toNumber(d.weight),
        scheduledDate: d.scheduledDate,
      })),
  }))

  let conflicts = detectSchedulingConflicts(snapshots)

  if (opDay) {
    conflicts = conflicts.filter(
      (c) =>
        isSameDay(new Date(c.planDate), opDay) ||
        c.severity === 'BLOCKING',
    )
  }

  if (options.planId) {
    conflicts = conflicts.filter((c) => c.planId === options.planId)
  }

  if (options.severity) {
    conflicts = conflicts.filter((c) => c.severity === options.severity)
  }

  const readinessByPlan: Record<string, PlanDispatchReadinessDTO> = {}
  for (const snap of snapshots) {
    if (opDay && !isSameDay(new Date(snap.date), opDay) && snap.status === 'COMPLETED') {
      continue
    }
    readinessByPlan[snap.id] = evaluatePlanDispatchReadiness(snap, snapshots)
  }

  return {
    operatingDate: opDay ? format(opDay, 'yyyy-MM-dd') : null,
    summary: {
      total: conflicts.length,
      blocking: conflicts.filter((c) => c.severity === 'BLOCKING').length,
      warning: conflicts.filter((c) => c.severity === 'WARNING').length,
      info: conflicts.filter((c) => c.severity === 'INFO').length,
    },
    conflicts,
    readinessByPlan,
  }
}

