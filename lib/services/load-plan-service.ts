// ─── Load Plan Service ───────────────────────────────────────────────────────
// Sprint 14: Server-authoritative orchestration for Load Plan create / edit /
// transition / delete. Route handlers are thin wrappers around these functions.
//
// Guarantees:
//   - Every read and write is scoped by the trusted `companyId` (ADR-003).
//   - Validation runs INSIDE the same interactive transaction as the writes,
//     and writes use conditional `updateMany` guards (expected current status)
//     so a concurrent request cannot silently double-allocate a delivery or
//     race a status transition. A failed guard throws and rolls back.
//   - Business rules come from the pure `load-plan-lifecycle` module.

import type { Prisma, PrismaClient as PrismaRoot, LoadPlanStatus } from '@prisma/client'
import { isValidUuid } from '@/lib/security/constants'
import {
  validateCapacity,
  validateTruckConflict,
  validateDriverConflict,
  getDeliveryDateWarnings,
  validateDeliveryEligibility,
  type DateWarning,
} from './load-plan-validation'
import {
  validateTransition,
  isPlanEditable,
  isPlanDeletable,
  isLoadPlanStatus,
  evaluateDispatchPreconditions,
  dispatchableDeliveries,
} from './load-plan-lifecycle'

type Tx = Prisma.TransactionClient
/** Only `$transaction` is used on the root client; tests supply a fake. */
export type LoadPlanDb = Pick<PrismaRoot, '$transaction'>

export type ServiceResult<T> =
  | { ok: true; data: T; warnings: DateWarning[] }
  | { ok: false; status: number; error: string; reasons?: string[] }

/** Thrown inside a transaction to abort it and produce a client error. */
export class LoadPlanError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly reasons?: string[],
  ) {
    super(message)
    this.name = 'LoadPlanError'
  }
}

const CONCURRENT_MODIFICATION =
  'The load plan or its deliveries were modified by another request. Reload and try again.'

const TX_OPTIONS = { timeout: 15000, maxWait: 10000 }

export const PLAN_DETAIL_INCLUDE = {
  truck: true,
  driver: true,
  items: {
    include: {
      delivery: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { items: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.LoadPlanInclude

async function run<T>(fn: () => Promise<{ data: T; warnings?: DateWarning[] }>): Promise<ServiceResult<T>> {
  try {
    const { data, warnings } = await fn()
    return { ok: true, data, warnings: warnings ?? [] }
  } catch (err) {
    if (err instanceof LoadPlanError) {
      return {
        ok: false,
        status: err.status,
        error: err.message,
        ...(err.reasons ? { reasons: err.reasons } : {}),
      }
    }
    throw err
  }
}

// ─── Input parsing ───────────────────────────────────────────────────────────

function parseDate(value: unknown): Date {
  if (value === undefined || value === null || value === '') {
    throw new LoadPlanError(400, 'A plan date is required.')
  }
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new LoadPlanError(400, 'Invalid date format.')
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) throw new LoadPlanError(400, 'Invalid date format.')
  return d
}

/** undefined → not provided; null / '' → explicitly none; string → id. */
function parseOptionalId(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new LoadPlanError(400, `Invalid ${label} ID format.`)
  return value
}

function parseItems(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new LoadPlanError(400, 'items must be an array of delivery ID strings.')
  }
  for (const id of value as string[]) {
    if (!isValidUuid(id)) throw new LoadPlanError(400, `Invalid delivery ID format: ${id}`)
  }
  if (new Set(value).size !== value.length) {
    throw new LoadPlanError(400, 'items contains duplicate delivery IDs.')
  }
  return value as string[]
}

function parseNotes(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw new LoadPlanError(400, 'notes must be a string.')
  return value
}

// ─── Resource resolution (company-scoped) ────────────────────────────────────

async function resolveTruck(tx: Tx, companyId: string, truckId: string) {
  if (!isValidUuid(truckId)) throw new LoadPlanError(400, 'Invalid truck ID format.')
  const truck = await tx.truck.findFirst({
    where: { id: truckId, companyId, isArchived: false },
    select: { id: true, name: true, status: true },
  })
  if (!truck) throw new LoadPlanError(404, 'Truck not found.')
  if (truck.status === 'MAINTENANCE') {
    throw new LoadPlanError(409, `${truck.name} is currently in maintenance and cannot be assigned.`)
  }
  return truck
}

async function resolveDriver(tx: Tx, companyId: string, driverId: string) {
  if (!isValidUuid(driverId)) throw new LoadPlanError(400, 'Invalid driver ID format.')
  const driver = await tx.driver.findFirst({
    where: { id: driverId, companyId, isArchived: false },
    select: { id: true, name: true, status: true },
  })
  if (!driver) throw new LoadPlanError(404, 'Driver not found.')
  if (driver.status === 'OFF_DUTY') {
    throw new LoadPlanError(409, `${driver.name} is currently off duty and cannot be assigned.`)
  }
  return driver
}

async function assertNoTruckConflict(tx: Tx, truckId: string, date: Date, companyId: string, planId?: string) {
  const r = await validateTruckConflict(tx, truckId, date, companyId, planId)
  if (!r.valid) throw new LoadPlanError(409, r.error!.message)
}

async function assertNoDriverConflict(tx: Tx, driverId: string | null, date: Date, companyId: string, planId?: string) {
  const r = await validateDriverConflict(tx, driverId, date, companyId, planId)
  if (!r.valid) throw new LoadPlanError(409, r.error!.message)
}

/** Conditionally advance a plan; throws if its status changed concurrently. */
async function guardedPlanUpdate(
  tx: Tx,
  companyId: string,
  planId: string,
  expectedStatus: string,
  data: Prisma.LoadPlanUncheckedUpdateManyInput,
) {
  const res = await tx.loadPlan.updateMany({
    where: { id: planId, companyId, status: expectedStatus as LoadPlanStatus },
    data,
  })
  if (res.count !== 1) throw new LoadPlanError(409, CONCURRENT_MODIFICATION)
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export interface CreateLoadPlanInput {
  truckId?: unknown
  driverId?: unknown
  date?: unknown
  notes?: unknown
}

/**
 * Create a DRAFT load plan. A driver is optional at this stage (optimizer and
 * manual flows create plans before a driver is chosen); it is required at
 * dispatch. Items are not accepted here — use `updateLoadPlan`.
 */
export async function createLoadPlan(db: LoadPlanDb, companyId: string, input: CreateLoadPlanInput) {
  return run(async () => {
    if (typeof input.truckId !== 'string' || input.truckId === '') {
      throw new LoadPlanError(400, 'A truck ID is required.')
    }
    const truckId = input.truckId
    const driverId = parseOptionalId(input.driverId, 'driver') ?? null
    const date = parseDate(input.date)
    const notes = parseNotes(input.notes)

    const data = await db.$transaction(async (tx: Tx) => {
      await resolveTruck(tx, companyId, truckId)
      if (driverId) await resolveDriver(tx, companyId, driverId)
      await assertNoTruckConflict(tx, truckId, date, companyId)
      await assertNoDriverConflict(tx, driverId, date, companyId)

      return tx.loadPlan.create({
        data: { companyId, truckId, driverId, date, notes, status: 'DRAFT' },
        include: { truck: true, driver: true },
      })
    }, TX_OPTIONS)

    return { data }
  })
}

// ─── UPDATE (edit or transition) ─────────────────────────────────────────────

export interface UpdateLoadPlanInput {
  truckId?: unknown
  driverId?: unknown
  status?: unknown
  notes?: unknown
  items?: unknown
}

type PlanWithItems = Prisma.LoadPlanGetPayload<{ include: { items: true } }>

export async function updateLoadPlan(
  db: LoadPlanDb,
  companyId: string,
  planId: string,
  input: UpdateLoadPlanInput,
) {
  return run(async () => {
    if (!isValidUuid(planId)) throw new LoadPlanError(400, 'Invalid load plan ID format.')

    const items = parseItems(input.items)
    if (input.truckId !== undefined && (typeof input.truckId !== 'string' || input.truckId === '')) {
      throw new LoadPlanError(400, 'truckId must be a truck ID; a load plan always requires a truck.')
    }
    const truckId = input.truckId as string | undefined
    const driverId = parseOptionalId(input.driverId, 'driver')
    const notes = parseNotes(input.notes)
    const status = input.status
    if (status !== undefined && !isLoadPlanStatus(status)) {
      throw new LoadPlanError(400, `Invalid status: ${String(status)}.`)
    }

    let warnings: DateWarning[] = []

    const data = await db.$transaction(async (tx: Tx) => {
      const plan = await tx.loadPlan.findFirst({
        where: { id: planId, companyId },
        include: { items: true },
      })
      if (!plan) throw new LoadPlanError(404, 'Load plan not found')

      const isCoreEdit = items !== undefined || truckId !== undefined || driverId !== undefined
      const isStatusChange = status !== undefined && status !== plan.status

      if (isCoreEdit && isStatusChange) {
        throw new LoadPlanError(
          400,
          'Status changes cannot be combined with edits to items, truck or driver. Submit them separately.',
        )
      }

      if (isCoreEdit) {
        if (!isPlanEditable(plan.status)) {
          throw new LoadPlanError(
            400,
            `Cannot modify a load plan that is ${plan.status}.` +
              (plan.status === 'READY' ? ' Revert it to DRAFT first to make changes.' : ''),
          )
        }
        warnings = await applyEdit(tx, companyId, plan, { items, truckId, driverId, notes })
      } else if (isStatusChange) {
        const t = validateTransition(plan.status, status)
        if (!t.ok) throw new LoadPlanError(400, t.error)
        await applyTransition(tx, companyId, plan, status as string, notes)
      } else if (notes !== undefined) {
        await guardedPlanUpdate(tx, companyId, plan.id, plan.status, { notes })
      }

      return tx.loadPlan.findFirst({ where: { id: planId, companyId }, include: PLAN_DETAIL_INCLUDE })
    }, TX_OPTIONS)

    return { data, warnings }
  })
}

async function applyEdit(
  tx: Tx,
  companyId: string,
  plan: PlanWithItems,
  edit: { items?: string[]; truckId?: string; driverId?: string | null; notes?: string | null },
): Promise<DateWarning[]> {
  const currentIds = plan.items.map(i => i.deliveryId)
  const finalIds = edit.items ?? currentIds

  const truckChanged = edit.truckId !== undefined && edit.truckId !== plan.truckId
  const finalTruckId = edit.truckId ?? plan.truckId
  if (truckChanged) {
    await resolveTruck(tx, companyId, finalTruckId)
    await assertNoTruckConflict(tx, finalTruckId, plan.date, companyId, plan.id)
  }

  const driverChanged = edit.driverId !== undefined && edit.driverId !== plan.driverId
  if (driverChanged && edit.driverId) {
    await resolveDriver(tx, companyId, edit.driverId)
    await assertNoDriverConflict(tx, edit.driverId, plan.date, companyId, plan.id)
  }

  if (edit.items !== undefined) {
    const eligibility = await validateDeliveryEligibility(tx, companyId, edit.items, plan.id)
    if (!eligibility.valid) {
      throw new LoadPlanError(eligibility.notFound ? 404 : 409, eligibility.error!.message)
    }
  }

  if ((edit.items !== undefined || truckChanged) && finalIds.length > 0) {
    const capacity = await validateCapacity(tx, finalTruckId, finalIds, companyId)
    if (!capacity.valid) {
      // 400 preserves the existing PATCH contract for capacity failures
      throw new LoadPlanError(capacity.notFound ? 404 : 400, capacity.error!.message)
    }
  }

  let warnings: DateWarning[] = []
  if (edit.items !== undefined && edit.items.length > 0) {
    warnings = await getDeliveryDateWarnings(tx, edit.items, plan.date, companyId)
  }

  if (edit.items !== undefined) {
    const next = new Set(edit.items)
    const current = new Set(currentIds)
    const toRelease = currentIds.filter(id => !next.has(id))
    const toAssign = edit.items.filter(id => !current.has(id))

    await tx.loadPlanItem.deleteMany({ where: { loadPlanId: plan.id } })
    if (edit.items.length > 0) {
      await tx.loadPlanItem.createMany({
        data: edit.items.map((deliveryId, sortOrder) => ({ loadPlanId: plan.id, deliveryId, sortOrder })),
      })
    }

    // Release: only ASSIGNED → PENDING. CANCELLED / IN_TRANSIT / DELIVERED untouched.
    if (toRelease.length > 0) {
      await tx.delivery.updateMany({
        where: { id: { in: toRelease }, companyId, status: 'ASSIGNED' },
        data: { status: 'PENDING' },
      })
    }

    // Allocate: conditional PENDING → ASSIGNED. If another request allocated
    // one of these deliveries first, the count falls short and we roll back.
    if (toAssign.length > 0) {
      const res = await tx.delivery.updateMany({
        where: { id: { in: toAssign }, companyId, status: 'PENDING' },
        data: { status: 'ASSIGNED' },
      })
      if (res.count !== toAssign.length) throw new LoadPlanError(409, CONCURRENT_MODIFICATION)
    }
  }

  await guardedPlanUpdate(tx, companyId, plan.id, 'DRAFT', {
    ...(edit.truckId !== undefined ? { truckId: edit.truckId } : {}),
    ...(edit.driverId !== undefined ? { driverId: edit.driverId } : {}),
    ...(edit.notes !== undefined ? { notes: edit.notes } : {}),
  })

  return warnings
}

async function applyTransition(
  tx: Tx,
  companyId: string,
  plan: PlanWithItems,
  to: string,
  notes: string | null | undefined,
) {
  const itemIds = plan.items.map(i => i.deliveryId)
  const notesData = notes !== undefined ? { notes } : {}

  if (to === 'DISPATCHED') {
    const truck = await tx.truck.findFirst({
      where: { id: plan.truckId, companyId },
      select: { name: true, status: true, isArchived: true },
    })
    const driver = plan.driverId
      ? await tx.driver.findFirst({
          where: { id: plan.driverId, companyId },
          select: { name: true, status: true, isArchived: true },
        })
      : null
    const deliveries = itemIds.length
      ? await tx.delivery.findMany({
          where: { id: { in: itemIds }, companyId },
          select: { id: true, customerName: true, status: true },
        })
      : []

    const reasons = evaluateDispatchPreconditions({
      planStatus: plan.status,
      truck,
      driverId: plan.driverId,
      driver,
      deliveries,
    })
    if (deliveries.length !== itemIds.length) {
      reasons.push('The plan references deliveries that could not be found.')
    }

    const active = dispatchableDeliveries(deliveries)
    if (reasons.length === 0) {
      const capacity = await validateCapacity(tx, plan.truckId, active.map(d => d.id), companyId)
      if (!capacity.valid) reasons.push(capacity.error!.message)
      const truckConflict = await validateTruckConflict(tx, plan.truckId, plan.date, companyId, plan.id)
      if (!truckConflict.valid) reasons.push(truckConflict.error!.message)
      const driverConflict = await validateDriverConflict(tx, plan.driverId, plan.date, companyId, plan.id)
      if (!driverConflict.valid) reasons.push(driverConflict.error!.message)
    }

    if (reasons.length > 0) {
      throw new LoadPlanError(409, `Cannot dispatch: ${reasons.join(' ')}`, reasons)
    }

    await guardedPlanUpdate(tx, companyId, plan.id, 'READY', { status: 'DISPATCHED', ...notesData })
    const res = await tx.delivery.updateMany({
      where: { id: { in: active.map(d => d.id) }, companyId, status: 'ASSIGNED' },
      data: { status: 'IN_TRANSIT' },
    })
    if (res.count !== active.length) throw new LoadPlanError(409, CONCURRENT_MODIFICATION)
    await tx.truck.updateMany({ where: { id: plan.truckId, companyId }, data: { status: 'IN_USE' } })
    await tx.driver.updateMany({ where: { id: plan.driverId!, companyId }, data: { status: 'ON_TRIP' } })
    return
  }

  if (to === 'COMPLETED') {
    await guardedPlanUpdate(tx, companyId, plan.id, 'DISPATCHED', { status: 'COMPLETED', ...notesData })
    if (itemIds.length > 0) {
      await tx.delivery.updateMany({
        where: { id: { in: itemIds }, companyId, status: 'IN_TRANSIT' },
        data: { status: 'DELIVERED' },
      })
    }
    // Only release statuses this lifecycle set; never clobber MAINTENANCE / OFF_DUTY.
    await tx.truck.updateMany({
      where: { id: plan.truckId, companyId, status: 'IN_USE' },
      data: { status: 'AVAILABLE' },
    })
    if (plan.driverId) {
      await tx.driver.updateMany({
        where: { id: plan.driverId, companyId, status: 'ON_TRIP' },
        data: { status: 'AVAILABLE' },
      })
    }
    return
  }

  // DRAFT → READY and READY → DRAFT: status only.
  await guardedPlanUpdate(tx, companyId, plan.id, plan.status, {
    status: to as LoadPlanStatus,
    ...notesData,
  })
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteLoadPlan(db: LoadPlanDb, companyId: string, planId: string) {
  return run(async () => {
    if (!isValidUuid(planId)) throw new LoadPlanError(400, 'Invalid load plan ID format.')

    const data = await db.$transaction(async (tx: Tx) => {
      const plan = await tx.loadPlan.findFirst({
        where: { id: planId, companyId },
        include: { items: true },
      })
      if (!plan) throw new LoadPlanError(404, 'Load plan not found')
      if (!isPlanDeletable(plan.status)) {
        throw new LoadPlanError(400, `Cannot delete a load plan that is ${plan.status}.`)
      }

      const ids = plan.items.map(i => i.deliveryId)
      if (ids.length > 0) {
        // Only ASSIGNED deliveries are released; CANCELLED etc. are preserved.
        await tx.delivery.updateMany({
          where: { id: { in: ids }, companyId, status: 'ASSIGNED' },
          data: { status: 'PENDING' },
        })
      }

      // Items cascade via FK (onDelete: Cascade). Guard against a concurrent
      // transition (e.g. dispatch) between the read and the delete.
      const res = await tx.loadPlan.deleteMany({
        where: { id: planId, companyId, status: plan.status },
      })
      if (res.count !== 1) throw new LoadPlanError(409, CONCURRENT_MODIFICATION)

      return { id: planId }
    }, TX_OPTIONS)

    return { data }
  })
}
