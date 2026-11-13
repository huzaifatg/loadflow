// ─── Dispatch Board & Calendar Aggregation Service (Sprint 18) ───────────────
// Central company-scoped query & intelligence service for the Dispatch Board
// and Dispatch Calendar. Zero N+1 queries; reuses `dispatch-availability`,
// `dispatch-conflicts`, and `operational-exceptions`.

import type { PrismaClient } from '@prisma/client'
import {
  addDays,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { toNumber, getItemSummary } from '@/lib/delivery-items'
import { isActivePlanStatus, isLoadPlanStatus } from './load-plan-lifecycle'
import {
  evaluateDriverAvailability,
  evaluateTruckAvailability,
  parseOperatingDate,
  type DriverAvailabilityDTO,
  type RawActivePlanRecord,
  type TruckAvailabilityDTO,
} from './dispatch-availability'
import {
  detectSchedulingConflicts,
  evaluatePlanDispatchReadiness,
  type ConflictPlanSnapshot,
  type PlanDispatchReadinessDTO,
  type SchedulingConflictDTO,
} from './dispatch-conflicts'
import {
  deriveExceptions,
  type OperationalException,
} from './operational-exceptions'

export interface DispatchDeliveryItemDTO {
  id: string
  reference: string
  customerName: string
  pickupAddress: string
  deliveryAddress: string
  weight: number
  status: string
  scheduledDate: string | null
  createdAt: string
  notes: string | null
  itemCount: number
  itemSummary: string
  urgency: 'OVERDUE' | 'DUE_TODAY' | 'SCHEDULED' | 'UNSCHEDULED'
  urgencyLabel: string
  assignmentState: 'UNASSIGNED' | 'ASSIGNED'
  assignedPlanId: string | null
  assignedPlanRef: string | null
}

export interface DispatchLoadPlanDTO {
  id: string
  planRef: string
  date: string
  dateLabel: string
  isOperatingDate: boolean
  status: 'DRAFT' | 'READY' | 'DISPATCHED' | 'COMPLETED'
  notes: string | null
  truck: {
    id: string
    name: string
    plateNumber: string
    type: string
    weightCapacity: number
    status: string
    isArchived: boolean
  }
  driver: {
    id: string
    name: string
    phone: string | null
    licenseNumber: string | null
    status: string
    isArchived: boolean
  } | null
  deliveryCount: number
  dispatchableDeliveryCount: number
  totalWeight: number
  truckCapacity: number
  capacityPct: number
  isOverCapacity: boolean
  deliveries: {
    id: string
    customerName: string
    pickupAddress: string
    deliveryAddress: string
    weight: number
    status: string
    scheduledDate: string | null
  }[]
  readiness: PlanDispatchReadinessDTO
  conflicts: SchedulingConflictDTO[]
}

export interface DispatchBoardFilters {
  date?: string | Date | null
  scope?: 'date' | 'all_active'
  status?: string | null
  assignment?: 'ALL' | 'UNASSIGNED_DRIVER' | 'READY_ONLY' | 'BLOCKED_ONLY' | null
  truckId?: string | null
  driverId?: string | null
  conflict?: 'ALL' | 'HAS_CONFLICTS' | 'BLOCKING_ONLY' | null
  overdue?: 'ALL' | 'OVERDUE_ONLY' | 'DUE_TODAY' | null
  q?: string | null
}

export interface DispatchBoardResult {
  operatingDate: string
  operatingDateLabel: string
  prevDate: string
  nextDate: string
  todayDate: string
  isToday: boolean
  scope: 'date' | 'all_active'
  summary: {
    pendingDeliveries: number
    unassignedDeliveries: number
    overdueDeliveries: number
    dueTodayDeliveries: number
    draftLoadPlans: number
    readyLoadPlans: number
    dispatchedLoadPlans: number
    completedLoadPlans: number
    plansOnOperatingDate: number
    resourceConflictsCount: number
    blockingPlansCount: number
    availableTrucks: number
    totalTrucks: number
    availableDrivers: number
    totalDrivers: number
  }
  unassignedQueue: DispatchDeliveryItemDTO[]
  draftPlansForAllocation: {
    id: string
    planRef: string
    date: string
    dateLabel: string
    truckName: string
    truckCapacity: number
    currentWeight: number
    remainingCapacity: number
    deliveryIds: string[]
  }[]
  loadPlans: DispatchLoadPlanDTO[]
  groupedPlans: {
    DRAFT: DispatchLoadPlanDTO[]
    READY: DispatchLoadPlanDTO[]
    DISPATCHED: DispatchLoadPlanDTO[]
    COMPLETED: DispatchLoadPlanDTO[]
  }
  availability: {
    trucks: TruckAvailabilityDTO[]
    drivers: DriverAvailabilityDTO[]
  }
  conflicts: SchedulingConflictDTO[]
  exceptions: OperationalException[]
}

export type DispatchBoardDb = Pick<
  PrismaClient,
  'truck' | 'driver' | 'delivery' | 'loadPlan'
>

const formatPlanRef = (id: string) => `Plan #${id.slice(-6).toUpperCase()}`

const formatDeliveryRef = (del: {
  id: string
  externalId?: string | null
  sourceReference?: string | null
}) => {
  if (del.externalId && del.externalId.trim()) return del.externalId.trim()
  if (del.sourceReference && del.sourceReference.trim()) return del.sourceReference.trim()
  return `DEL-${del.id.slice(-6).toUpperCase()}`
}

/**
 * Fetch and compute the full Dispatch Board state for `companyId`.
 */
export async function getDispatchBoardData(
  db: DispatchBoardDb,
  companyId: string,
  filters: DispatchBoardFilters = {},
  now: Date = new Date(),
): Promise<DispatchBoardResult> {
  const opDay = parseOperatingDate(filters.date)
  const today = startOfDay(now)
  const opDayStart = startOfDay(opDay)
  const opDayEnd = endOfDay(opDay)
  const scope: 'date' | 'all_active' =
    filters.scope === 'date' ? 'date' : 'all_active'

  const [trucks, drivers, pendingDeliveriesRaw, plansRaw, deliveryStatusCounts] =
    await Promise.all([
      db.truck.findMany({
        where: { companyId, isArchived: false },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      db.driver.findMany({
        where: { companyId, isArchived: false },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      db.delivery.findMany({
        where: {
          companyId,
          isArchived: false,
          status: 'PENDING',
        },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { items: true } },
          loadPlanItems: {
            select: {
              loadPlanId: true,
              loadPlan: { select: { id: true, status: true } },
            },
          },
        },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
      }),
      db.loadPlan.findMany({
        where: {
          companyId,
          OR: [
            { status: { in: ['DRAFT', 'READY', 'DISPATCHED'] } },
            { date: { gte: opDayStart, lte: opDayEnd } },
          ],
        },
        include: {
          truck: true,
          driver: true,
          items: {
            include: {
              delivery: {
                select: {
                  id: true,
                  companyId: true,
                  customerName: true,
                  pickupAddress: true,
                  deliveryAddress: true,
                  weight: true,
                  status: true,
                  scheduledDate: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
      }),
      db.delivery.groupBy({
        by: ['status'],
        where: { companyId, isArchived: false },
        _count: { _all: true },
      }),
    ])

  const pendingTotal =
    deliveryStatusCounts.find((g) => g.status === 'PENDING')?._count._all ?? 0

  // Build conflict snapshots for all fetched plans
  const conflictSnapshots: ConflictPlanSnapshot[] = plansRaw.map((p) => ({
    id: p.id,
    status: p.status,
    date: p.date,
    truckId: p.truckId,
    driverId: p.driverId,
    truck: p.truck
      ? {
          id: p.truck.id,
          name: p.truck.name,
          plateNumber: p.truck.plateNumber,
          weightCapacity: p.truck.weightCapacity,
          status: p.truck.status,
          isArchived: p.truck.isArchived,
        }
      : null,
    driver: p.driver
      ? {
          id: p.driver.id,
          name: p.driver.name,
          status: p.driver.status,
          isArchived: p.driver.isArchived,
        }
      : null,
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

  const allConflicts = detectSchedulingConflicts(conflictSnapshots, now)

  // Build availability records
  const activePlanRecords: RawActivePlanRecord[] = conflictSnapshots.map((s) => {
    const valid = s.deliveries.filter((d) => d.status !== 'CANCELLED')
    const totalWeight = valid.reduce((sum, d) => sum + d.weight, 0)
    return {
      id: s.id,
      truckId: s.truckId,
      driverId: s.driverId,
      status: s.status,
      date: s.date,
      truckName: s.truck?.name ?? null,
      driverName: s.driver?.name ?? null,
      deliveryCount: valid.length,
      totalWeight,
    }
  })

  const truckAvailability = trucks.map((t) =>
    evaluateTruckAvailability(t, activePlanRecords, opDay),
  )
  const driverAvailability = drivers.map((d) =>
    evaluateDriverAvailability(d, activePlanRecords, opDay),
  )

  // Enrich unassigned pending deliveries
  const allUnassignedQueue: DispatchDeliveryItemDTO[] = []
  for (const d of pendingDeliveriesRaw) {
    const activeAllocation = d.loadPlanItems.find((lpi) =>
      isActivePlanStatus(lpi.loadPlan.status),
    )
    if (activeAllocation) continue

    const schedDay = d.scheduledDate ? startOfDay(new Date(d.scheduledDate)) : null
    let urgency: DispatchDeliveryItemDTO['urgency'] = 'UNSCHEDULED'
    let urgencyLabel = 'No date set'

    if (schedDay) {
      if (schedDay < today) {
        urgency = 'OVERDUE'
        urgencyLabel = `Overdue (${format(schedDay, 'MMM d')})`
      } else if (isSameDay(schedDay, opDay) || isSameDay(schedDay, today)) {
        urgency = 'DUE_TODAY'
        urgencyLabel = isSameDay(schedDay, today) ? 'Due Today' : `Due ${format(schedDay, 'MMM d')}`
      } else {
        urgency = 'SCHEDULED'
        urgencyLabel = `Scheduled ${format(schedDay, 'MMM d')}`
      }
    }

    allUnassignedQueue.push({
      id: d.id,
      reference: formatDeliveryRef(d),
      customerName: d.customerName,
      pickupAddress: d.pickupAddress,
      deliveryAddress: d.deliveryAddress,
      weight: Math.round(toNumber(d.weight) * 100) / 100,
      status: d.status,
      scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toISOString() : null,
      createdAt: new Date(d.createdAt).toISOString(),
      notes: d.notes,
      itemCount: d._count?.items ?? 0,
      itemSummary: getItemSummary(d.items ?? []),
      urgency,
      urgencyLabel,
      assignmentState: 'UNASSIGNED',
      assignedPlanId: null,
      assignedPlanRef: null,
    })
  }

  // Sort unassigned queue: OVERDUE first, then DUE_TODAY, then SCHEDULED, then UNSCHEDULED
  const URGENCY_RANK: Record<DispatchDeliveryItemDTO['urgency'], number> = {
    OVERDUE: 0,
    DUE_TODAY: 1,
    SCHEDULED: 2,
    UNSCHEDULED: 3,
  }
  allUnassignedQueue.sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      (a.scheduledDate ?? '9999').localeCompare(b.scheduledDate ?? '9999'),
  )

  const overdueDeliveriesCount = allUnassignedQueue.filter(
    (d) => d.urgency === 'OVERDUE',
  ).length
  const dueTodayDeliveriesCount = allUnassignedQueue.filter(
    (d) => d.urgency === 'DUE_TODAY',
  ).length

  // Enrich all load plans
  const allEnrichedPlans: DispatchLoadPlanDTO[] = plansRaw.map((p) => {
    const snap = conflictSnapshots.find((s) => s.id === p.id)!
    const readiness = evaluatePlanDispatchReadiness(snap, conflictSnapshots, now)
    const planConflicts = allConflicts.filter((c) => c.planId === p.id)

    const validDeliveries = p.items
      .map((i) => i.delivery)
      .filter((d) => d.companyId === companyId)
    const nonCancelled = validDeliveries.filter((d) => d.status !== 'CANCELLED')
    const totalWeight = nonCancelled.reduce((sum, d) => sum + toNumber(d.weight), 0)
    const maxCap = p.truck?.weightCapacity ?? 0
    const capacityPct = maxCap > 0 ? Math.round((totalWeight / maxCap) * 100) : 0
    const isOverCapacity = maxCap > 0 && totalWeight > maxCap

    return {
      id: p.id,
      planRef: formatPlanRef(p.id),
      date: new Date(p.date).toISOString(),
      dateLabel: format(new Date(p.date), 'MMM d, yyyy'),
      isOperatingDate: isSameDay(new Date(p.date), opDay),
      status: p.status,
      notes: p.notes,
      truck: {
        id: p.truck.id,
        name: p.truck.name,
        plateNumber: p.truck.plateNumber,
        type: p.truck.type,
        weightCapacity: p.truck.weightCapacity,
        status: p.truck.status,
        isArchived: p.truck.isArchived,
      },
      driver: p.driver
        ? {
            id: p.driver.id,
            name: p.driver.name,
            phone: p.driver.phone,
            licenseNumber: p.driver.licenseNumber,
            status: p.driver.status,
            isArchived: p.driver.isArchived,
          }
        : null,
      deliveryCount: validDeliveries.length,
      dispatchableDeliveryCount: nonCancelled.filter((d) => d.status === 'ASSIGNED').length,
      totalWeight: Math.round(totalWeight * 100) / 100,
      truckCapacity: maxCap,
      capacityPct,
      isOverCapacity,
      deliveries: validDeliveries.map((d) => ({
        id: d.id,
        customerName: d.customerName,
        pickupAddress: d.pickupAddress,
        deliveryAddress: d.deliveryAddress,
        weight: Math.round(toNumber(d.weight) * 100) / 100,
        status: d.status,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toISOString() : null,
      })),
      readiness,
      conflicts: planConflicts,
    }
  })

  // Draft plans available for quick delivery allocation
  const draftPlansForAllocation = allEnrichedPlans
    .filter((p) => p.status === 'DRAFT' && !p.truck.isArchived && p.truck.status !== 'MAINTENANCE')
    .map((p) => ({
      id: p.id,
      planRef: p.planRef,
      date: p.date,
      dateLabel: p.dateLabel,
      truckName: p.truck.name,
      truckCapacity: p.truckCapacity,
      currentWeight: p.totalWeight,
      remainingCapacity: Math.round((p.truckCapacity - p.totalWeight) * 100) / 100,
      deliveryIds: p.deliveries.map((d) => d.id),
    }))

  // Summary metrics (from company-wide active & operating-date state before UI text filters)
  const draftLoadPlans = allEnrichedPlans.filter((p) => p.status === 'DRAFT').length
  const readyLoadPlans = allEnrichedPlans.filter((p) => p.status === 'READY').length
  const dispatchedLoadPlans = allEnrichedPlans.filter((p) => p.status === 'DISPATCHED').length
  const completedLoadPlans = allEnrichedPlans.filter((p) => p.status === 'COMPLETED').length
  const plansOnOperatingDate = allEnrichedPlans.filter((p) => p.isOperatingDate).length
  const blockingConflicts = allConflicts.filter((c) => c.severity === 'BLOCKING')
  const blockingPlansCount = new Set(blockingConflicts.map((c) => c.planId)).size

  // Apply user filters to unassignedQueue and loadPlans
  const q = (filters.q ?? '').trim().toLowerCase()
  const statusFilter =
    filters.status && isLoadPlanStatus(filters.status.toUpperCase())
      ? filters.status.toUpperCase()
      : 'ALL'
  const truckFilter = filters.truckId && filters.truckId !== 'ALL' ? filters.truckId : null
  const driverFilter = filters.driverId && filters.driverId !== 'ALL' ? filters.driverId : null
  const assignmentFilter = filters.assignment ?? 'ALL'
  const conflictFilter = filters.conflict ?? 'ALL'
  const overdueFilter = filters.overdue ?? 'ALL'

  let filteredUnassigned = allUnassignedQueue
  if (overdueFilter === 'OVERDUE_ONLY') {
    filteredUnassigned = filteredUnassigned.filter((d) => d.urgency === 'OVERDUE')
  } else if (overdueFilter === 'DUE_TODAY') {
    filteredUnassigned = filteredUnassigned.filter(
      (d) => d.urgency === 'DUE_TODAY' || d.urgency === 'OVERDUE',
    )
  }
  if (q) {
    filteredUnassigned = filteredUnassigned.filter(
      (d) =>
        d.customerName.toLowerCase().includes(q) ||
        d.deliveryAddress.toLowerCase().includes(q) ||
        d.pickupAddress.toLowerCase().includes(q) ||
        d.reference.toLowerCase().includes(q),
    )
  }

  let filteredPlans = allEnrichedPlans
  if (scope === 'date') {
    filteredPlans = filteredPlans.filter((p) => p.isOperatingDate)
  }
  if (statusFilter !== 'ALL') {
    filteredPlans = filteredPlans.filter((p) => p.status === statusFilter)
  }
  if (truckFilter) {
    filteredPlans = filteredPlans.filter((p) => p.truck.id === truckFilter)
  }
  if (driverFilter) {
    if (driverFilter === 'UNASSIGNED') {
      filteredPlans = filteredPlans.filter((p) => !p.driver)
    } else {
      filteredPlans = filteredPlans.filter((p) => p.driver?.id === driverFilter)
    }
  }
  if (assignmentFilter === 'UNASSIGNED_DRIVER') {
    filteredPlans = filteredPlans.filter((p) => !p.driver && p.status !== 'COMPLETED')
  } else if (assignmentFilter === 'READY_ONLY') {
    filteredPlans = filteredPlans.filter(
      (p) =>
        p.readiness.readinessState === 'READY_TO_DISPATCH' ||
        p.readiness.readinessState === 'READY_TO_LOCK',
    )
  } else if (assignmentFilter === 'BLOCKED_ONLY') {
    filteredPlans = filteredPlans.filter((p) => p.readiness.readinessState === 'BLOCKED')
  }

  if (conflictFilter === 'HAS_CONFLICTS') {
    filteredPlans = filteredPlans.filter((p) => p.conflicts.length > 0)
  } else if (conflictFilter === 'BLOCKING_ONLY') {
    filteredPlans = filteredPlans.filter((p) =>
      p.conflicts.some((c) => c.severity === 'BLOCKING'),
    )
  }

  if (overdueFilter === 'OVERDUE_ONLY') {
    filteredPlans = filteredPlans.filter(
      (p) =>
        startOfDay(new Date(p.date)) < today && p.status !== 'COMPLETED',
    )
  }

  if (q) {
    filteredPlans = filteredPlans.filter(
      (p) =>
        p.planRef.toLowerCase().includes(q) ||
        p.truck.name.toLowerCase().includes(q) ||
        p.truck.plateNumber.toLowerCase().includes(q) ||
        (p.driver?.name.toLowerCase().includes(q) ?? false) ||
        (p.notes?.toLowerCase().includes(q) ?? false) ||
        p.deliveries.some((d) => d.customerName.toLowerCase().includes(q)),
    )
  }

  const groupedPlans: DispatchBoardResult['groupedPlans'] = {
    DRAFT: filteredPlans.filter((p) => p.status === 'DRAFT'),
    READY: filteredPlans.filter((p) => p.status === 'READY'),
    DISPATCHED: filteredPlans.filter((p) => p.status === 'DISPATCHED'),
    COMPLETED: filteredPlans.filter((p) => p.status === 'COMPLETED'),
  }

  // Derive Sprint 16 operational exceptions from the same snapshot
  const exceptions = deriveExceptions(
    {
      plans: conflictSnapshots
        .filter((s) => s.status !== 'COMPLETED')
        .map((s) => ({
          id: s.id,
          status: s.status,
          date: s.date,
          truck: s.truck,
          driver: s.driver,
          deliveries: s.deliveries,
        })),
      pendingDeliveries: allUnassignedQueue.map((d) => ({
        id: d.id,
        customerName: d.customerName,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : null,
      })),
    },
    now,
  )

  return {
    operatingDate: format(opDay, 'yyyy-MM-dd'),
    operatingDateLabel: format(opDay, 'EEEE, MMM d, yyyy'),
    prevDate: format(addDays(opDay, -1), 'yyyy-MM-dd'),
    nextDate: format(addDays(opDay, 1), 'yyyy-MM-dd'),
    todayDate: format(today, 'yyyy-MM-dd'),
    isToday: isSameDay(opDay, today),
    scope,
    summary: {
      pendingDeliveries: pendingTotal,
      unassignedDeliveries: allUnassignedQueue.length,
      overdueDeliveries: overdueDeliveriesCount,
      dueTodayDeliveries: dueTodayDeliveriesCount,
      draftLoadPlans,
      readyLoadPlans,
      dispatchedLoadPlans,
      completedLoadPlans,
      plansOnOperatingDate,
      resourceConflictsCount: blockingConflicts.length,
      blockingPlansCount,
      availableTrucks: truckAvailability.filter((t) => t.available).length,
      totalTrucks: truckAvailability.length,
      availableDrivers: driverAvailability.filter((d) => d.available).length,
      totalDrivers: driverAvailability.length,
    },
    unassignedQueue: filteredUnassigned,
    draftPlansForAllocation,
    loadPlans: filteredPlans,
    groupedPlans,
    availability: {
      trucks: truckAvailability,
      drivers: driverAvailability,
    },
    conflicts: allConflicts,
    exceptions,
  }
}

// ─── Dispatch Calendar Service (Feature E) ───────────────────────────────────

export interface DispatchCalendarDayDTO {
  date: string
  dayName: string
  dayShort: string
  dayNumber: string
  isToday: boolean
  isSelected: boolean
  plans: DispatchLoadPlanDTO[]
  unassignedDeliveriesDue: {
    id: string
    customerName: string
    deliveryAddress: string
    weight: number
    isOverdue: boolean
  }[]
}

export interface DispatchCalendarResult {
  selectedDate: string
  selectedDateLabel: string
  weekStart: string
  weekEnd: string
  weekRangeLabel: string
  prevWeekDate: string
  nextWeekDate: string
  prevDayDate: string
  nextDayDate: string
  todayDate: string
  summary: {
    totalPlansInWeek: number
    draftCount: number
    readyCount: number
    dispatchedCount: number
    completedCount: number
    conflictsInWeek: number
    unassignedDueInWeek: number
  }
  days: DispatchCalendarDayDTO[]
  trucks: { id: string; name: string; plateNumber: string }[]
  drivers: { id: string; name: string }[]
}

export interface DispatchCalendarFilters {
  date?: string | Date | null
  status?: string | null
  truckId?: string | null
  driverId?: string | null
}

/**
 * Fetch and compute the 7-day + daily Dispatch Calendar schedule for `companyId`.
 */
export async function getDispatchCalendarData(
  db: DispatchBoardDb,
  companyId: string,
  filters: DispatchCalendarFilters = {},
  now: Date = new Date(),
): Promise<DispatchCalendarResult> {
  const selectedDay = parseOperatingDate(filters.date)
  const today = startOfDay(now)
  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekEnd = endOfDay(addDays(weekStart, 6))

  const statusFilter =
    filters.status && isLoadPlanStatus(filters.status.toUpperCase())
      ? filters.status.toUpperCase()
      : 'ALL'
  const truckFilter = filters.truckId && filters.truckId !== 'ALL' ? filters.truckId : null
  const driverFilter = filters.driverId && filters.driverId !== 'ALL' ? filters.driverId : null

  const [plansRaw, pendingInWeek, trucks, drivers] = await Promise.all([
    db.loadPlan.findMany({
      where: {
        companyId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        truck: true,
        driver: true,
        items: {
          include: {
            delivery: {
              select: {
                id: true,
                companyId: true,
                customerName: true,
                pickupAddress: true,
                deliveryAddress: true,
                weight: true,
                status: true,
                scheduledDate: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    db.delivery.findMany({
      where: {
        companyId,
        isArchived: false,
        status: 'PENDING',
        scheduledDate: { gte: weekStart, lte: weekEnd },
        loadPlanItems: { none: {} },
      },
      select: {
        id: true,
        customerName: true,
        deliveryAddress: true,
        weight: true,
        scheduledDate: true,
      },
      orderBy: { scheduledDate: 'asc' },
    }),
    db.truck.findMany({
      where: { companyId, isArchived: false },
      select: { id: true, name: true, plateNumber: true },
      orderBy: { name: 'asc' },
    }),
    db.driver.findMany({
      where: { companyId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const snapshots: ConflictPlanSnapshot[] = plansRaw.map((p) => ({
    id: p.id,
    status: p.status,
    date: p.date,
    truckId: p.truckId,
    driverId: p.driverId,
    truck: p.truck
      ? {
          id: p.truck.id,
          name: p.truck.name,
          plateNumber: p.truck.plateNumber,
          weightCapacity: p.truck.weightCapacity,
          status: p.truck.status,
          isArchived: p.truck.isArchived,
        }
      : null,
    driver: p.driver
      ? {
          id: p.driver.id,
          name: p.driver.name,
          status: p.driver.status,
          isArchived: p.driver.isArchived,
        }
      : null,
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

  const allConflicts = detectSchedulingConflicts(snapshots, now)

  let enrichedPlans: DispatchLoadPlanDTO[] = plansRaw.map((p) => {
    const snap = snapshots.find((s) => s.id === p.id)!
    const readiness = evaluatePlanDispatchReadiness(snap, snapshots, now)
    const planConflicts = allConflicts.filter((c) => c.planId === p.id)

    const validDeliveries = p.items
      .map((i) => i.delivery)
      .filter((d) => d.companyId === companyId)
    const nonCancelled = validDeliveries.filter((d) => d.status !== 'CANCELLED')
    const totalWeight = nonCancelled.reduce((sum, d) => sum + toNumber(d.weight), 0)
    const maxCap = p.truck?.weightCapacity ?? 0
    const capacityPct = maxCap > 0 ? Math.round((totalWeight / maxCap) * 100) : 0

    return {
      id: p.id,
      planRef: formatPlanRef(p.id),
      date: new Date(p.date).toISOString(),
      dateLabel: format(new Date(p.date), 'MMM d, yyyy'),
      isOperatingDate: isSameDay(new Date(p.date), selectedDay),
      status: p.status,
      notes: p.notes,
      truck: {
        id: p.truck.id,
        name: p.truck.name,
        plateNumber: p.truck.plateNumber,
        type: p.truck.type,
        weightCapacity: p.truck.weightCapacity,
        status: p.truck.status,
        isArchived: p.truck.isArchived,
      },
      driver: p.driver
        ? {
            id: p.driver.id,
            name: p.driver.name,
            phone: p.driver.phone,
            licenseNumber: p.driver.licenseNumber,
            status: p.driver.status,
            isArchived: p.driver.isArchived,
          }
        : null,
      deliveryCount: validDeliveries.length,
      dispatchableDeliveryCount: nonCancelled.filter((d) => d.status === 'ASSIGNED').length,
      totalWeight: Math.round(totalWeight * 100) / 100,
      truckCapacity: maxCap,
      capacityPct,
      isOverCapacity: maxCap > 0 && totalWeight > maxCap,
      deliveries: validDeliveries.map((d) => ({
        id: d.id,
        customerName: d.customerName,
        pickupAddress: d.pickupAddress,
        deliveryAddress: d.deliveryAddress,
        weight: Math.round(toNumber(d.weight) * 100) / 100,
        status: d.status,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toISOString() : null,
      })),
      readiness,
      conflicts: planConflicts,
    }
  })

  if (statusFilter !== 'ALL') {
    enrichedPlans = enrichedPlans.filter((p) => p.status === statusFilter)
  }
  if (truckFilter) {
    enrichedPlans = enrichedPlans.filter((p) => p.truck.id === truckFilter)
  }
  if (driverFilter) {
    if (driverFilter === 'UNASSIGNED') {
      enrichedPlans = enrichedPlans.filter((p) => !p.driver)
    } else {
      enrichedPlans = enrichedPlans.filter((p) => p.driver?.id === driverFilter)
    }
  }

  const days: DispatchCalendarDayDTO[] = Array.from({ length: 7 }).map((_, idx) => {
    const d = addDays(weekStart, idx)
    const dStr = format(d, 'yyyy-MM-dd')
    const dayPlans = enrichedPlans.filter((p) => isSameDay(new Date(p.date), d))
    const dueDeliveries = pendingInWeek
      .filter((del) => del.scheduledDate && isSameDay(new Date(del.scheduledDate), d))
      .map((del) => ({
        id: del.id,
        customerName: del.customerName,
        deliveryAddress: del.deliveryAddress,
        weight: Math.round(toNumber(del.weight) * 100) / 100,
        isOverdue: startOfDay(d) < today,
      }))

    return {
      date: dStr,
      dayName: format(d, 'EEEE'),
      dayShort: format(d, 'EEE'),
      dayNumber: format(d, 'MMM d'),
      isToday: isSameDay(d, today),
      isSelected: isSameDay(d, selectedDay),
      plans: dayPlans,
      unassignedDeliveriesDue: dueDeliveries,
    }
  })

  return {
    selectedDate: format(selectedDay, 'yyyy-MM-dd'),
    selectedDateLabel: format(selectedDay, 'EEEE, MMM d, yyyy'),
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
    weekRangeLabel: `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`,
    prevWeekDate: format(addDays(weekStart, -7), 'yyyy-MM-dd'),
    nextWeekDate: format(addDays(weekStart, 7), 'yyyy-MM-dd'),
    prevDayDate: format(addDays(selectedDay, -1), 'yyyy-MM-dd'),
    nextDayDate: format(addDays(selectedDay, 1), 'yyyy-MM-dd'),
    todayDate: format(today, 'yyyy-MM-dd'),
    summary: {
      totalPlansInWeek: enrichedPlans.length,
      draftCount: enrichedPlans.filter((p) => p.status === 'DRAFT').length,
      readyCount: enrichedPlans.filter((p) => p.status === 'READY').length,
      dispatchedCount: enrichedPlans.filter((p) => p.status === 'DISPATCHED').length,
      completedCount: enrichedPlans.filter((p) => p.status === 'COMPLETED').length,
      conflictsInWeek: enrichedPlans.filter((p) =>
        p.conflicts.some((c) => c.severity === 'BLOCKING'),
      ).length,
      unassignedDueInWeek: pendingInWeek.length,
    },
    days,
    trucks,
    drivers,
  }
}

