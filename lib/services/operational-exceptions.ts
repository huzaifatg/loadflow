// ─── Operational Exceptions (Sprint 16) ──────────────────────────────────────
// Derived — never stored. Exceptions are recomputed from current company data
// on every request, so they disappear the moment the underlying condition is
// fixed and can never go stale or duplicate. `deriveExceptions` is pure;
// `getOperationalExceptions` loads a company-scoped snapshot.

import type { PrismaClient } from '@prisma/client'
import { addDays, format, startOfDay } from 'date-fns'

export type ExceptionSeverity = 'critical' | 'warning' | 'info'

export type ExceptionType =
  | 'PLAN_OVERDUE_DISPATCH'
  | 'PLAN_MISSING_DRIVER'
  | 'PLAN_TRUCK_UNAVAILABLE'
  | 'PLAN_DRIVER_UNAVAILABLE'
  | 'PLAN_OVER_CAPACITY'
  | 'PLAN_INVALID_ITEMS'
  | 'PLAN_CANCELLED_ITEMS'
  | 'PLAN_EMPTY'
  | 'PLAN_DISPATCH_OVERDUE_COMPLETION'
  | 'DELIVERY_OVERDUE'
  | 'DELIVERY_DUE_SOON'
  | 'PENDING_QUEUE'

export type ExceptionEntityKind = 'loadPlan' | 'delivery' | 'truck' | 'driver' | 'queue'

export interface ExceptionEntityRef {
  kind: ExceptionEntityKind
  id: string
  label: string
  href: string
}

export interface OperationalException {
  /** Stable identity: one exception per (type, entity). */
  key: string
  type: ExceptionType
  severity: ExceptionSeverity
  title: string
  description: string
  entity: ExceptionEntityRef
  related: ExceptionEntityRef[]
  action?: { label: string; href: string }
  /** Relevant operational date (plan date / scheduled date), ISO. */
  date?: string
}

export interface ExceptionSnapshot {
  plans: {
    id: string
    status: string
    date: Date
    truck: { id: string; name: string; status: string; isArchived: boolean; weightCapacity: number } | null
    driver: { id: string; name: string; status: string; isArchived: boolean } | null
    deliveries: { id: string; customerName: string; status: string; weight: number }[]
  }[]
  pendingDeliveries: { id: string; customerName: string; scheduledDate: Date | null }[]
}

export const SEVERITY_ORDER: Record<ExceptionSeverity, number> = { critical: 0, warning: 1, info: 2 }

const planLabel = (id: string) => `Plan #${id.slice(-6).toUpperCase()}`

/** Pure derivation of every exception for a snapshot at time `now`. */
export function deriveExceptions(snapshot: ExceptionSnapshot, now: Date): OperationalException[] {
  const today = startOfDay(now)
  const dueSoonCutoff = addDays(today, 2) // today + tomorrow
  const out = new Map<string, OperationalException>()
  const add = (e: Omit<OperationalException, 'key' | 'related'> & { related?: ExceptionEntityRef[] }) => {
    const key = `${e.type}:${e.entity.id}`
    if (!out.has(key)) out.set(key, { ...e, key, related: e.related ?? [] })
  }

  for (const plan of snapshot.plans) {
    const href = `/loads/${plan.id}`
    const entity: ExceptionEntityRef = { kind: 'loadPlan', id: plan.id, label: planLabel(plan.id), href }
    const planDay = startOfDay(plan.date)
    const isPreDispatch = plan.status === 'DRAFT' || plan.status === 'READY'
    const dateLabel = format(plan.date, 'MMM d')
    const truckRef: ExceptionEntityRef[] = plan.truck
      ? [{ kind: 'truck', id: plan.truck.id, label: plan.truck.name, href: `/trucks/${plan.truck.id}` }]
      : []
    const driverRef: ExceptionEntityRef[] = plan.driver
      ? [{ kind: 'driver', id: plan.driver.id, label: plan.driver.name, href: `/drivers/${plan.driver.id}` }]
      : []
    const editHint = plan.status === 'READY' ? ' Revert the plan to Draft to change it.' : ''

    if (isPreDispatch && planDay < today) {
      add({
        type: 'PLAN_OVERDUE_DISPATCH',
        severity: 'critical',
        title: 'Plan date passed without dispatch',
        description: `${entity.label} was scheduled for ${dateLabel} but is still ${plan.status}.`,
        entity,
        related: [...truckRef, ...driverRef],
        action: { label: 'Review plan', href },
        date: plan.date.toISOString(),
      })
    }

    if (plan.status === 'DISPATCHED' && planDay < today) {
      add({
        type: 'PLAN_DISPATCH_OVERDUE_COMPLETION',
        severity: 'warning',
        title: 'Dispatched plan not completed',
        description: `${entity.label} was dispatched for ${dateLabel} and has not been marked completed. Truck and driver stay locked until it is.`,
        entity,
        related: [...truckRef, ...driverRef],
        action: { label: 'Complete plan', href },
        date: plan.date.toISOString(),
      })
    }

    if (isPreDispatch && !plan.driver) {
      const dueNow = planDay <= today
      add({
        type: 'PLAN_MISSING_DRIVER',
        severity: dueNow ? 'critical' : 'warning',
        title: 'No driver assigned',
        description: `${entity.label} (${dateLabel}) cannot be dispatched until a driver is assigned.${editHint}`,
        entity,
        related: truckRef,
        action: { label: 'Assign driver', href },
        date: plan.date.toISOString(),
      })
    }

    if (plan.truck && plan.status !== 'COMPLETED') {
      const unavailable = plan.truck.isArchived ? 'archived' : plan.truck.status === 'MAINTENANCE' ? 'in maintenance' : null
      if (unavailable) {
        add({
          type: 'PLAN_TRUCK_UNAVAILABLE',
          severity: 'critical',
          title: `Assigned truck is ${unavailable}`,
          description:
            plan.status === 'DISPATCHED'
              ? `${plan.truck.name} is ${unavailable} while ${entity.label} is in transit.`
              : `${plan.truck.name} is ${unavailable} and blocks dispatch of ${entity.label}.${editHint}`,
          entity,
          related: truckRef,
          action: { label: plan.status === 'DISPATCHED' ? 'Review truck' : 'Change truck', href: plan.status === 'DISPATCHED' ? truckRef[0].href : href },
          date: plan.date.toISOString(),
        })
      }
    }

    if (plan.driver && plan.status !== 'COMPLETED') {
      const unavailable = plan.driver.isArchived ? 'archived' : plan.driver.status === 'OFF_DUTY' ? 'off duty' : null
      if (unavailable) {
        add({
          type: 'PLAN_DRIVER_UNAVAILABLE',
          severity: 'critical',
          title: `Assigned driver is ${unavailable}`,
          description:
            plan.status === 'DISPATCHED'
              ? `${plan.driver.name} is ${unavailable} while ${entity.label} is in transit.`
              : `${plan.driver.name} is ${unavailable} and blocks dispatch of ${entity.label}.${editHint}`,
          entity,
          related: driverRef,
          action: { label: plan.status === 'DISPATCHED' ? 'Review driver' : 'Change driver', href: plan.status === 'DISPATCHED' ? driverRef[0].href : href },
          date: plan.date.toISOString(),
        })
      }
    }

    const shipping = plan.deliveries.filter(d => d.status !== 'CANCELLED')
    const load = shipping.reduce((sum, d) => sum + d.weight, 0)
    if (plan.truck && plan.truck.weightCapacity > 0 && load > plan.truck.weightCapacity && plan.status !== 'COMPLETED') {
      add({
        type: 'PLAN_OVER_CAPACITY',
        severity: 'critical',
        title: 'Load exceeds truck capacity',
        description: `${entity.label} carries ${Math.round(load).toLocaleString()} kg on ${plan.truck.name} (capacity ${Math.round(plan.truck.weightCapacity).toLocaleString()} kg).${editHint}`,
        entity,
        related: truckRef,
        action: { label: 'Rebalance load', href },
        date: plan.date.toISOString(),
      })
    }

    if (isPreDispatch) {
      const invalid = plan.deliveries.filter(d => d.status !== 'ASSIGNED' && d.status !== 'CANCELLED')
      if (invalid.length > 0) {
        add({
          type: 'PLAN_INVALID_ITEMS',
          severity: 'critical',
          title: 'Plan contains non-dispatchable deliveries',
          description: `${invalid.map(d => `"${d.customerName}" is ${d.status}`).slice(0, 3).join('; ')}. Only ASSIGNED deliveries can be dispatched.${editHint}`,
          entity,
          related: invalid.slice(0, 3).map(d => ({ kind: 'delivery' as const, id: d.id, label: d.customerName, href: `/deliveries/${d.id}` })),
          action: { label: 'Fix allocation', href },
          date: plan.date.toISOString(),
        })
      }

      const cancelled = plan.deliveries.filter(d => d.status === 'CANCELLED')
      if (cancelled.length > 0) {
        add({
          type: 'PLAN_CANCELLED_ITEMS',
          severity: 'info',
          title: 'Cancelled deliveries still on plan',
          description: `${cancelled.length} cancelled ${cancelled.length === 1 ? 'delivery is' : 'deliveries are'} still listed on ${entity.label}. They will be skipped at dispatch; remove them to keep the manifest clean.${editHint}`,
          entity,
          related: cancelled.slice(0, 3).map(d => ({ kind: 'delivery' as const, id: d.id, label: d.customerName, href: `/deliveries/${d.id}` })),
          action: { label: 'Clean up plan', href },
          date: plan.date.toISOString(),
        })
      }

      if (!plan.deliveries.some(d => d.status === 'ASSIGNED')) {
        add({
          type: 'PLAN_EMPTY',
          severity: plan.status === 'READY' ? 'warning' : 'info',
          title: 'Plan has no deliveries to ship',
          description: `${entity.label} (${dateLabel}) has no assigned deliveries and cannot be dispatched.${editHint}`,
          entity,
          related: truckRef,
          action: { label: 'Allocate deliveries', href },
          date: plan.date.toISOString(),
        })
      }
    }
  }

  let queued = 0
  for (const d of snapshot.pendingDeliveries) {
    const entity: ExceptionEntityRef = { kind: 'delivery', id: d.id, label: d.customerName, href: `/deliveries/${d.id}` }
    const day = d.scheduledDate ? startOfDay(d.scheduledDate) : null
    if (day && day < today) {
      add({
        type: 'DELIVERY_OVERDUE',
        severity: 'critical',
        title: 'Delivery overdue and unplanned',
        description: `${d.customerName} was scheduled for ${format(d.scheduledDate!, 'MMM d')} and is still not on a load plan.`,
        entity,
        action: { label: 'Plan delivery', href: '/loads/optimize' },
        date: d.scheduledDate!.toISOString(),
      })
    } else if (day && day < dueSoonCutoff) {
      add({
        type: 'DELIVERY_DUE_SOON',
        severity: 'warning',
        title: day.getTime() === today.getTime() ? 'Due today, not planned' : 'Due tomorrow, not planned',
        description: `${d.customerName} is scheduled for ${format(d.scheduledDate!, 'MMM d')} and is not allocated to a load plan.`,
        entity,
        action: { label: 'Plan delivery', href: '/loads/optimize' },
        date: d.scheduledDate!.toISOString(),
      })
    } else {
      queued++
    }
  }

  if (queued > 0) {
    add({
      type: 'PENDING_QUEUE',
      severity: 'info',
      title: 'Deliveries awaiting allocation',
      description: `${queued} pending ${queued === 1 ? 'delivery is' : 'deliveries are'} not yet on a load plan (not due within 2 days).`,
      entity: { kind: 'queue', id: 'pending-queue', label: 'Pending queue', href: '/deliveries?status=PENDING' },
      action: { label: 'Open optimizer', href: '/loads/optimize' },
    })
  }

  return [...out.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      a.key.localeCompare(b.key),
  )
}

export function summarizeExceptions(list: OperationalException[]) {
  const counts = { critical: 0, warning: 0, info: 0, total: list.length }
  for (const e of list) counts[e.severity]++
  return counts
}

/** Exceptions that concern a given record (as primary entity or related). */
export function exceptionsForEntity(list: OperationalException[], id: string): OperationalException[] {
  return list.filter(e => e.entity.id === id || e.related.some(r => r.id === id))
}

type ExceptionDb = Pick<PrismaClient, 'loadPlan' | 'delivery'>

/** Load a company-scoped snapshot and derive exceptions. */
export async function getOperationalExceptions(
  db: ExceptionDb,
  companyId: string,
  now: Date = new Date(),
): Promise<OperationalException[]> {
  const [plans, pending] = await Promise.all([
    db.loadPlan.findMany({
      where: { companyId, status: { in: ['DRAFT', 'READY', 'DISPATCHED'] } },
      select: {
        id: true,
        status: true,
        date: true,
        truck: { select: { id: true, name: true, status: true, isArchived: true, weightCapacity: true } },
        driver: { select: { id: true, name: true, status: true, isArchived: true } },
        items: {
          select: { delivery: { select: { id: true, customerName: true, status: true, weight: true, companyId: true } } },
        },
      },
    }),
    db.delivery.findMany({
      where: { companyId, status: 'PENDING', isArchived: false },
      select: { id: true, customerName: true, scheduledDate: true },
    }),
  ])

  return deriveExceptions(
    {
      plans: plans.map(p => ({
        id: p.id,
        status: p.status,
        date: p.date,
        truck: p.truck,
        driver: p.driver,
        deliveries: p.items
          .map(i => i.delivery)
          .filter(d => d.companyId === companyId)
          .map(d => ({ id: d.id, customerName: d.customerName, status: d.status, weight: Number(d.weight) })),
      })),
      pendingDeliveries: pending,
    },
    now,
  )
}

