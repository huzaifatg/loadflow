// ─── Bulk Delivery Operations Service (Sprint 16) ────────────────────────────
// Server-authoritative batch operations for the Deliveries workspace:
//   - `archive`    : Archive eligible deliveries (not allocated to any load plan, not IN_TRANSIT)
//   - `cancel`     : Transition eligible deliveries (PENDING or ASSIGNED) → CANCELLED
//   - `reschedule` : Update or clear `scheduledDate` on eligible deliveries (PENDING or ASSIGNED)
//
// Guarantees:
//   - Every ID is validated as a UUID and resolved with `companyId` scoping.
//   - Unknown / cross-tenant IDs are rejected with 404 (never silently ignored).
//   - Ineligible records are reported in `skipped[]` with a human-readable reason
//     while eligible records are updated atomically with `recordActivity()` inside
//     the same transaction.

import type { Prisma } from '@prisma/client'
import { format } from 'date-fns'
import { isValidUuid } from '@/lib/security/constants'
import { recordActivity, type ActivityActor, type ActivityInput } from './activity'

export type BulkDeliveryAction = 'archive' | 'cancel' | 'reschedule'

export interface BulkDeliveryInput {
  action?: unknown
  deliveryIds?: unknown
  scheduledDate?: unknown
}

export interface BulkSkipItem {
  id: string
  customerName: string
  reason: string
}

export interface BulkDeliveryResultData {
  action: BulkDeliveryAction
  updatedIds: string[]
  updatedCount: number
  skipped: BulkSkipItem[]
}

export type BulkDeliveryResult =
  | { ok: true; data: BulkDeliveryResultData }
  | { ok: false; status: number; error: string }

interface DeliverySnapshot {
  id: string
  customerName: string
  status: string
  isArchived: boolean
  scheduledDate: Date | null
  _count: { loadPlanItems: number }
}

type BulkTx = {
  delivery: {
    findMany: (args: {
      where: { id: { in: string[] }; companyId: string }
      select: {
        id: true
        customerName: true
        status: true
        isArchived: true
        scheduledDate: true
        _count: { select: { loadPlanItems: true } }
      }
    }) => Promise<DeliverySnapshot[]>
    updateMany: (args: {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }) => Promise<{ count: number }>
  }
  activityEvent?: {
    createMany?: (args: { data: Prisma.ActivityEventCreateManyInput[] }) => Promise<unknown>
  }
}

export interface BulkDeliveryDb {
  $transaction: <T>(fn: (tx: BulkTx) => Promise<T>) => Promise<T>
}

const VALID_ACTIONS: readonly BulkDeliveryAction[] = ['archive', 'cancel', 'reschedule']

export async function executeBulkDeliveries(
  db: BulkDeliveryDb,
  companyId: string,
  input: BulkDeliveryInput,
  actor?: ActivityActor | null,
): Promise<BulkDeliveryResult> {
  if (typeof input.action !== 'string' || !VALID_ACTIONS.includes(input.action as BulkDeliveryAction)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid bulk action. Must be one of: ${VALID_ACTIONS.join(', ')}.`,
    }
  }
  const action = input.action as BulkDeliveryAction

  if (!Array.isArray(input.deliveryIds) || input.deliveryIds.length === 0) {
    return { ok: false, status: 400, error: 'Select at least one delivery.' }
  }
  if (input.deliveryIds.length > 200) {
    return { ok: false, status: 400, error: 'Bulk operations are limited to 200 deliveries at a time.' }
  }

  const uniqueIds: string[] = []
  const seen = new Set<string>()
  for (const raw of input.deliveryIds) {
    if (typeof raw !== 'string' || !isValidUuid(raw)) {
      return { ok: false, status: 400, error: `Invalid delivery ID format: ${String(raw)}` }
    }
    if (!seen.has(raw)) {
      seen.add(raw)
      uniqueIds.push(raw)
    }
  }

  let parsedDate: Date | null = null
  if (action === 'reschedule') {
    if (input.scheduledDate === undefined) {
      return { ok: false, status: 400, error: 'scheduledDate (or null to clear) is required for reschedule.' }
    }
    if (input.scheduledDate !== null && input.scheduledDate !== '') {
      if (typeof input.scheduledDate !== 'string' && !(input.scheduledDate instanceof Date)) {
        return { ok: false, status: 400, error: 'Invalid scheduledDate format.' }
      }
      const d = new Date(input.scheduledDate)
      if (isNaN(d.getTime())) {
        return { ok: false, status: 400, error: 'Invalid scheduledDate format.' }
      }
      parsedDate = d
    }
  }

  try {
    const data = await db.$transaction(async (tx) => {
      const records = await tx.delivery.findMany({
        where: { id: { in: uniqueIds }, companyId },
        select: {
          id: true,
          customerName: true,
          status: true,
          isArchived: true,
          scheduledDate: true,
          _count: { select: { loadPlanItems: true } },
        },
      })

      if (records.length !== uniqueIds.length) {
        throw new Error('NOT_FOUND')
      }

      const eligible: DeliverySnapshot[] = []
      const skipped: BulkSkipItem[] = []
      const events: ActivityInput[] = []

      for (const r of records) {
        if (action === 'archive') {
          if (r.isArchived) {
            skipped.push({ id: r.id, customerName: r.customerName, reason: 'Already archived' })
          } else if (r._count.loadPlanItems > 0) {
            skipped.push({
              id: r.id,
              customerName: r.customerName,
              reason: 'Assigned to a load plan — remove from plan before archiving',
            })
          } else if (r.status === 'IN_TRANSIT') {
            skipped.push({ id: r.id, customerName: r.customerName, reason: 'Currently in transit' })
          } else {
            eligible.push(r)
            events.push({
              entityType: 'DELIVERY',
              entityId: r.id,
              type: 'DELIVERY_ARCHIVED',
              message: `Delivery for ${r.customerName} was archived via bulk action.`,
            })
          }
        } else if (action === 'cancel') {
          if (r.isArchived) {
            skipped.push({ id: r.id, customerName: r.customerName, reason: 'Archived delivery cannot be modified' })
          } else if (r.status === 'CANCELLED') {
            skipped.push({ id: r.id, customerName: r.customerName, reason: 'Already cancelled' })
          } else if (r.status !== 'PENDING' && r.status !== 'ASSIGNED') {
            skipped.push({
              id: r.id,
              customerName: r.customerName,
              reason: `Cannot cancel a delivery that is ${r.status}`,
            })
          } else {
            eligible.push(r)
            events.push({
              entityType: 'DELIVERY',
              entityId: r.id,
              type: 'DELIVERY_CANCELLED',
              message: `Delivery for ${r.customerName} was cancelled via bulk action.`,
            })
          }
        } else if (action === 'reschedule') {
          if (r.isArchived) {
            skipped.push({ id: r.id, customerName: r.customerName, reason: 'Archived delivery cannot be modified' })
          } else if (r.status !== 'PENDING' && r.status !== 'ASSIGNED') {
            skipped.push({
              id: r.id,
              customerName: r.customerName,
              reason: `Cannot reschedule a delivery that is ${r.status}`,
            })
          } else {
            eligible.push(r)
            events.push({
              entityType: 'DELIVERY',
              entityId: r.id,
              type: 'DELIVERY_RESCHEDULED',
              message: parsedDate
                ? `Scheduled date set to ${format(parsedDate, 'MMM d, yyyy')} via bulk action.`
                : 'Scheduled date cleared via bulk action.',
            })
          }
        }
      }

      const updatedIds = eligible.map(e => e.id)

      if (updatedIds.length > 0) {
        if (action === 'archive') {
          await tx.delivery.updateMany({
            where: { id: { in: updatedIds }, companyId, isArchived: false },
            data: { isArchived: true, archivedAt: new Date() },
          })
        } else if (action === 'cancel') {
          await tx.delivery.updateMany({
            where: { id: { in: updatedIds }, companyId, status: { in: ['PENDING', 'ASSIGNED'] } },
            data: { status: 'CANCELLED' },
          })
        } else if (action === 'reschedule') {
          await tx.delivery.updateMany({
            where: { id: { in: updatedIds }, companyId, status: { in: ['PENDING', 'ASSIGNED'] } },
            data: { scheduledDate: parsedDate },
          })
        }

        await recordActivity(tx, companyId, actor, events)
      }

      return {
        action,
        updatedIds,
        updatedCount: updatedIds.length,
        skipped,
      }
    })

    if (data.updatedCount === 0 && data.skipped.length > 0) {
      return {
        ok: false,
        status: 409,
        error: `None of the selected deliveries could be updated: ${data.skipped
          .slice(0, 3)
          .map(s => `${s.customerName} (${s.reason})`)
          .join('; ')}.`,
      }
    }

    return { ok: true, data }
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return {
        ok: false,
        status: 404,
        error: 'One or more deliveries were not found or do not belong to your company.',
      }
    }
    throw err
  }
}

