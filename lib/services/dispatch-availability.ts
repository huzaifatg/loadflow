// ─── Dispatch Resource Availability Intelligence (Sprint 18) ─────────────────
// Evaluates company-scoped truck and driver availability for a target operating
// date using actual database records and active load-plan commitments.
// Never fabricates availability; derives commitments conservatively from
// vehicle/driver operational statuses and overlapping load-plan assignments.

import type { PrismaClient } from '@prisma/client'
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns'
import { toNumber } from '@/lib/delivery-items'
import { isValidUuid } from '@/lib/security/constants'

export interface ResourcePlanCommitment {
  planId: string
  planRef: string
  date: string
  status: string
  deliveryCount: number
  totalWeight: number
  counterpartName: string | null
  isSameOperatingDay: boolean
}

export interface TruckAvailabilityDTO {
  resourceId: string
  resourceName: string
  resourceType: 'truck'
  plateNumber: string
  vehicleType: string
  status: string
  isArchived: boolean
  active: boolean
  available: boolean
  eligibleForAssignment: boolean
  weightCapacity: number
  requiredWeight: number | null
  capacityCompatible: boolean
  remainingCapacityIfAssigned: number
  currentAssignments: ResourcePlanCommitment[]
  conflictReason: string | null
  operatingDate: string
}

export interface DriverAvailabilityDTO {
  resourceId: string
  resourceName: string
  resourceType: 'driver'
  phone: string | null
  licenseNumber: string | null
  status: string
  isArchived: boolean
  active: boolean
  available: boolean
  eligibleForAssignment: boolean
  currentAssignments: ResourcePlanCommitment[]
  conflictReason: string | null
  operatingDate: string
}

export interface DispatchAvailabilityResult {
  operatingDate: string
  excludePlanId: string | null
  requiredWeight: number | null
  summary: {
    totalTrucks: number
    activeTrucks: number
    availableTrucks: number
    committedTrucks: number
    maintenanceTrucks: number
    totalDrivers: number
    activeDrivers: number
    availableDrivers: number
    committedDrivers: number
    offDutyDrivers: number
  }
  trucks: TruckAvailabilityDTO[]
  drivers: DriverAvailabilityDTO[]
}

export interface RawTruckRecord {
  id: string
  name: string
  plateNumber: string
  type: string
  weightCapacity: number
  status: string
  isArchived: boolean
}

export interface RawDriverRecord {
  id: string
  name: string
  phone: string | null
  licenseNumber: string | null
  status: string
  isArchived: boolean
}

export interface RawActivePlanRecord {
  id: string
  truckId: string
  driverId: string | null
  status: string
  date: Date
  truckName: string | null
  driverName: string | null
  deliveryCount: number
  totalWeight: number
}

const formatPlanRef = (id: string) => `Plan #${id.slice(-6).toUpperCase()}`

/**
 * Pure evaluation of a single truck's availability for `operatingDate`.
 */
export function evaluateTruckAvailability(
  truck: RawTruckRecord,
  plans: RawActivePlanRecord[],
  operatingDate: Date,
  options?: { excludePlanId?: string | null; requiredWeight?: number | null },
): TruckAvailabilityDTO {
  const opDay = startOfDay(operatingDate)
  const opDateStr = format(opDay, 'yyyy-MM-dd')
  const excludePlanId = options?.excludePlanId ?? null
  const requiredWeight =
    options?.requiredWeight !== undefined && options.requiredWeight !== null
      ? Math.max(0, Number(options.requiredWeight))
      : null

  const relevantPlans = plans.filter(
    (p) =>
      p.truckId === truck.id &&
      p.id !== excludePlanId &&
      (p.status !== 'COMPLETED' || isSameDay(new Date(p.date), opDay)),
  )

  const commitments: ResourcePlanCommitment[] = relevantPlans.map((p) => ({
    planId: p.id,
    planRef: formatPlanRef(p.id),
    date: new Date(p.date).toISOString(),
    status: p.status,
    deliveryCount: p.deliveryCount,
    totalWeight: Math.round(p.totalWeight * 100) / 100,
    counterpartName: p.driverName,
    isSameOperatingDay: isSameDay(new Date(p.date), opDay),
  }))

  const active = !truck.isArchived && truck.status !== 'MAINTENANCE'
  const sameDayCommitments = commitments.filter((c) => c.isSameOperatingDay)
  const activeDispatchedCommitments = commitments.filter((c) => c.status === 'DISPATCHED')

  const capacityCompatible =
    requiredWeight === null ? true : truck.weightCapacity >= requiredWeight
  const remainingCapacityIfAssigned =
    requiredWeight === null
      ? truck.weightCapacity
      : Math.round((truck.weightCapacity - requiredWeight) * 100) / 100

  let conflictReason: string | null = null
  let available = true

  if (truck.isArchived) {
    available = false
    conflictReason = `${truck.name} is archived and cannot be assigned.`
  } else if (truck.status === 'MAINTENANCE') {
    available = false
    conflictReason = `${truck.name} is in maintenance and out of service.`
  } else if (sameDayCommitments.length > 0) {
    available = false
    const first = sameDayCommitments[0]
    conflictReason = `${truck.name} is already assigned to ${first.planRef} (${first.status}) on ${format(opDay, 'MMM d, yyyy')}.`
  } else if (activeDispatchedCommitments.length > 0 && isSameDay(opDay, startOfDay(new Date()))) {
    available = false
    const first = activeDispatchedCommitments[0]
    conflictReason = `${truck.name} is currently in transit on ${first.planRef}.`
  } else if (truck.status === 'IN_USE' && activeDispatchedCommitments.length > 0) {
    // Committed to an uncompleted dispatched trip
    const first = activeDispatchedCommitments[0]
    if (isSameDay(new Date(first.date), opDay)) {
      available = false
      conflictReason = `${truck.name} is in transit on ${first.planRef}.`
    }
  }

  if (available && !capacityCompatible && requiredWeight !== null) {
    conflictReason = `Capacity (${truck.weightCapacity.toLocaleString()} kg) is below required load weight (${Math.round(requiredWeight).toLocaleString()} kg).`
  }

  return {
    resourceId: truck.id,
    resourceName: truck.name,
    resourceType: 'truck',
    plateNumber: truck.plateNumber,
    vehicleType: truck.type,
    status: truck.status,
    isArchived: truck.isArchived,
    active,
    available,
    eligibleForAssignment: available && capacityCompatible,
    weightCapacity: truck.weightCapacity,
    requiredWeight,
    capacityCompatible,
    remainingCapacityIfAssigned,
    currentAssignments: commitments,
    conflictReason,
    operatingDate: opDateStr,
  }
}

/**
 * Pure evaluation of a single driver's availability for `operatingDate`.
 */
export function evaluateDriverAvailability(
  driver: RawDriverRecord,
  plans: RawActivePlanRecord[],
  operatingDate: Date,
  options?: { excludePlanId?: string | null },
): DriverAvailabilityDTO {
  const opDay = startOfDay(operatingDate)
  const opDateStr = format(opDay, 'yyyy-MM-dd')
  const excludePlanId = options?.excludePlanId ?? null

  const relevantPlans = plans.filter(
    (p) =>
      p.driverId === driver.id &&
      p.id !== excludePlanId &&
      (p.status !== 'COMPLETED' || isSameDay(new Date(p.date), opDay)),
  )

  const commitments: ResourcePlanCommitment[] = relevantPlans.map((p) => ({
    planId: p.id,
    planRef: formatPlanRef(p.id),
    date: new Date(p.date).toISOString(),
    status: p.status,
    deliveryCount: p.deliveryCount,
    totalWeight: Math.round(p.totalWeight * 100) / 100,
    counterpartName: p.truckName,
    isSameOperatingDay: isSameDay(new Date(p.date), opDay),
  }))

  const active = !driver.isArchived && driver.status !== 'OFF_DUTY'
  const sameDayCommitments = commitments.filter((c) => c.isSameOperatingDay)
  const activeDispatchedCommitments = commitments.filter((c) => c.status === 'DISPATCHED')

  let conflictReason: string | null = null
  let available = true

  if (driver.isArchived) {
    available = false
    conflictReason = `${driver.name} is archived and cannot be assigned.`
  } else if (driver.status === 'OFF_DUTY') {
    available = false
    conflictReason = `${driver.name} is currently off duty.`
  } else if (sameDayCommitments.length > 0) {
    available = false
    const first = sameDayCommitments[0]
    conflictReason = `${driver.name} is already assigned to ${first.planRef} (${first.status}) on ${format(opDay, 'MMM d, yyyy')}.`
  } else if (activeDispatchedCommitments.length > 0 && isSameDay(opDay, startOfDay(new Date()))) {
    available = false
    const first = activeDispatchedCommitments[0]
    conflictReason = `${driver.name} is currently on trip for ${first.planRef}.`
  }

  return {
    resourceId: driver.id,
    resourceName: driver.name,
    resourceType: 'driver',
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    status: driver.status,
    isArchived: driver.isArchived,
    active,
    available,
    eligibleForAssignment: available,
    currentAssignments: commitments,
    conflictReason,
    operatingDate: opDateStr,
  }
}

export type AvailabilityDb = Pick<PrismaClient, 'truck' | 'driver' | 'loadPlan'>

export interface GetDispatchAvailabilityOptions {
  date?: Date | string
  excludePlanId?: string | null
  requiredWeight?: number | null
  includeArchived?: boolean
}

export function parseOperatingDate(raw?: Date | string | null): Date {
  if (!raw) return startOfDay(new Date())
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? startOfDay(new Date()) : startOfDay(raw)
  }
  if (typeof raw === 'string') {
    // Handle YYYY-MM-DD in local time without UTC shift
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      const d = new Date(year, month, day)
      if (!isNaN(d.getTime())) return startOfDay(d)
    }
    const parsed = new Date(raw)
    if (!isNaN(parsed.getTime())) return startOfDay(parsed)
  }
  return startOfDay(new Date())
}

/**
 * Evaluate company-scoped truck and driver availability for a target date.
 */
export async function getDispatchAvailability(
  db: AvailabilityDb,
  companyId: string,
  options: GetDispatchAvailabilityOptions = {},
): Promise<DispatchAvailabilityResult> {
  const opDay = parseOperatingDate(options.date)
  const dayStart = startOfDay(opDay)
  const dayEnd = endOfDay(opDay)
  const excludePlanId =
    options.excludePlanId && isValidUuid(options.excludePlanId) ? options.excludePlanId : null
  const requiredWeight =
    options.requiredWeight !== undefined &&
    options.requiredWeight !== null &&
    Number.isFinite(Number(options.requiredWeight))
      ? Math.max(0, Number(options.requiredWeight))
      : null

  const [trucks, drivers, plans] = await Promise.all([
    db.truck.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
    db.driver.findMany({
      where: {
        companyId,
        ...(options.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
    db.loadPlan.findMany({
      where: {
        companyId,
        OR: [
          { date: { gte: dayStart, lte: dayEnd } },
          { status: { in: ['DRAFT', 'READY', 'DISPATCHED'] } },
        ],
      },
      select: {
        id: true,
        truckId: true,
        driverId: true,
        status: true,
        date: true,
        truck: { select: { name: true } },
        driver: { select: { name: true } },
        items: {
          select: {
            delivery: { select: { weight: true, status: true, companyId: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const normalizedPlans: RawActivePlanRecord[] = plans.map((p) => {
    const validDeliveries = p.items
      .map((i) => i.delivery)
      .filter((d) => d.companyId === companyId && d.status !== 'CANCELLED')
    const totalWeight = validDeliveries.reduce((sum, d) => sum + toNumber(d.weight), 0)
    return {
      id: p.id,
      truckId: p.truckId,
      driverId: p.driverId,
      status: p.status,
      date: p.date,
      truckName: p.truck?.name ?? null,
      driverName: p.driver?.name ?? null,
      deliveryCount: validDeliveries.length,
      totalWeight,
    }
  })

  const truckResults = trucks.map((t) =>
    evaluateTruckAvailability(t, normalizedPlans, opDay, {
      excludePlanId,
      requiredWeight,
    }),
  )

  const driverResults = drivers.map((d) =>
    evaluateDriverAvailability(d, normalizedPlans, opDay, {
      excludePlanId,
    }),
  )

  const activeTrucks = truckResults.filter((t) => t.active).length
  const availableTrucks = truckResults.filter((t) => t.available).length
  const maintenanceTrucks = truckResults.filter((t) => t.status === 'MAINTENANCE').length
  const committedTrucks = truckResults.filter((t) => t.active && !t.available).length

  const activeDrivers = driverResults.filter((d) => d.active).length
  const availableDrivers = driverResults.filter((d) => d.available).length
  const offDutyDrivers = driverResults.filter((d) => d.status === 'OFF_DUTY').length
  const committedDrivers = driverResults.filter((d) => d.active && !d.available).length

  return {
    operatingDate: format(opDay, 'yyyy-MM-dd'),
    excludePlanId,
    requiredWeight,
    summary: {
      totalTrucks: truckResults.length,
      activeTrucks,
      availableTrucks,
      committedTrucks,
      maintenanceTrucks,
      totalDrivers: driverResults.length,
      activeDrivers,
      availableDrivers,
      committedDrivers,
      offDutyDrivers,
    },
    trucks: truckResults,
    drivers: driverResults,
  }
}

