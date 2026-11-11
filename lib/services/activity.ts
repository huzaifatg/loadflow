// ─── Activity (Sprint 16) ────────────────────────────────────────────────────
// Append-only operational history. Events are recorded by server-side services
// INSIDE the same transaction as the state change they describe, so a rolled
// back operation never leaves a phantom event and a committed operation never
// lacks one. Never fabricate events for pre-existing records.

import type { Prisma } from '@prisma/client'

export type ActivityEntityType = 'LOAD_PLAN' | 'DELIVERY'

export const ACTIVITY_TYPES = [
  'LOAD_PLAN_CREATED',
  'LOAD_PLAN_TRUCK_CHANGED',
  'LOAD_PLAN_DRIVER_ASSIGNED',
  'LOAD_PLAN_DRIVER_REMOVED',
  'LOAD_PLAN_DELIVERIES_ADDED',
  'LOAD_PLAN_DELIVERIES_REMOVED',
  'LOAD_PLAN_MARKED_READY',
  'LOAD_PLAN_REVERTED_TO_DRAFT',
  'LOAD_PLAN_DISPATCHED',
  'LOAD_PLAN_COMPLETED',
  'LOAD_PLAN_DELETED',
  'LOAD_PLAN_NOTES_UPDATED',
  'DELIVERY_CREATED',
  'DELIVERY_UPDATED',
  'DELIVERY_RESCHEDULED',
  'DELIVERY_CANCELLED',
  'DELIVERY_ARCHIVED',
  'DELIVERY_RESTORED',
  'DELIVERY_ALLOCATED',
  'DELIVERY_RELEASED',
  'DELIVERY_IN_TRANSIT',
  'DELIVERY_DELIVERED',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** Who performed an operation. `label` is shown to teammates (email). */
export interface ActivityActor {
  userId: string
  label?: string | null
}

export interface ActivityInput {
  entityType: ActivityEntityType
  entityId: string
  type: ActivityType
  message: string
  metadata?: Record<string, unknown>
}

/** Event types surfaced in the notification center (lifecycle-significant). */
export const NOTIFIABLE_ACTIVITY_TYPES: readonly ActivityType[] = [
  'LOAD_PLAN_CREATED',
  'LOAD_PLAN_MARKED_READY',
  'LOAD_PLAN_REVERTED_TO_DRAFT',
  'LOAD_PLAN_DISPATCHED',
  'LOAD_PLAN_COMPLETED',
  'LOAD_PLAN_DELETED',
  'DELIVERY_CANCELLED',
  'DELIVERY_ARCHIVED',
]

type ActivityWriter = {
  activityEvent?: {
    createMany?: (args: { data: Prisma.ActivityEventCreateManyInput[] }) => Promise<unknown>
  }
}

/**
 * Persist events using the caller's transaction client. Must be called inside
 * the business transaction; any failure aborts the whole operation.
 */
export async function recordActivity(
  tx: ActivityWriter,
  companyId: string,
  actor: ActivityActor | null | undefined,
  events: ActivityInput[],
): Promise<void> {
  if (events.length === 0 || !tx.activityEvent?.createMany) return
  await tx.activityEvent.createMany({
    data: events.map(e => ({
      companyId,
      entityType: e.entityType,
      entityId: e.entityId,
      type: e.type,
      message: e.message.slice(0, 500),
      actorId: actor?.userId ?? null,
      actorLabel: actor?.label ?? null,
      metadata: (e.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  })
}

/** Join up to `max` names for a message, e.g. "A, B and 3 more". */
export function summarizeNames(names: string[], max = 3): string {
  if (names.length === 0) return ''
  if (names.length <= max) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

export function planRef(planId: string): string {
  return `#${planId.slice(-6).toUpperCase()}`
}

/** Build an actor from the authenticated request context. */
export function actorFromAuth(auth: { userId: string; email?: string | null }): ActivityActor {
  return { userId: auth.userId, label: auth.email || null }
}

export interface ActivityRecord {
  id: string
  entityType: string
  entityId: string
  type: string
  message: string
  actorId: string | null
  actorLabel: string | null
  metadata: unknown
  createdAt: Date
}

type ActivityReader = {
  activityEvent?: {
    findMany: (args: Prisma.ActivityEventFindManyArgs) => Promise<ActivityRecord[]>
  }
}

/**
 * Fetch chronological activity events for a single entity (newest first),
 * strictly scoped to `companyId`.
 */
export async function listActivityForEntity(
  db: ActivityReader,
  companyId: string,
  entityType: ActivityEntityType,
  entityId: string,
  take = 30,
): Promise<ActivityRecord[]> {
  if (!db.activityEvent?.findMany) return []
  try {
    return await db.activityEvent.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take,
    })
  } catch {
    return []
  }
}

/**
 * Fetch recent company-wide activity events (newest first), optionally filtered
 * by event types.
 */
export async function listRecentCompanyActivity(
  db: ActivityReader,
  companyId: string,
  options?: { types?: readonly string[]; take?: number },
): Promise<ActivityRecord[]> {
  if (!db.activityEvent?.findMany) return []
  try {
    return await db.activityEvent.findMany({
      where: {
        companyId,
        ...(options?.types ? { type: { in: [...options.types] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take ?? 25,
    })
  } catch {
    return []
  }
}

