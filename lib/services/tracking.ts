// ─── Customer Visibility & Shipment Tracking Service (Sprint 17) ─────────────
// Provides:
//   1. Cryptographically secure tracking-link token generation, SHA-256 hashing,
//      timing-safe verification, and AES-256-GCM at-rest encryption.
//   2. Company-scoped tracking link lifecycle management (create, rotate,
//      revoke, update expiration & ETA).
//   3. Customer-safe milestone creation (automatic lifecycle + manual dispatcher
//      updates) with strict HTML stripping and length bounds.
//   4. Public tracking resolution returning a strictly sanitized DTO that never
//      exposes internal UUIDs, company IDs, driver PII, or internal notes.

import crypto from 'node:crypto'
import { isValidUuid } from '@/lib/security/constants'
import { recordActivity, type ActivityActor, type ActivityInput } from './activity'
import { format } from 'date-fns'

export const TRACKING_LINK_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const
export type TrackingLinkStatusValue = (typeof TRACKING_LINK_STATUSES)[number]

export const TRACKING_EVENT_TYPES = [
  'DELIVERY_CREATED',
  'DELIVERY_ASSIGNED',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_CANCELLED',
  'DELAY_NOTICE',
  'MANUAL_UPDATE',
] as const
export type TrackingEventTypeValue = (typeof TRACKING_EVENT_TYPES)[number]

export const MANUAL_ALLOWED_EVENT_TYPES: readonly TrackingEventTypeValue[] = [
  'MANUAL_UPDATE',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'OUT_FOR_DELIVERY',
  'DELAY_NOTICE',
]

// ─── Token Cryptography & Validation ─────────────────────────────────────────

const TOKEN_FORMAT_REGEX = /^[A-Za-z0-9_-]{32,64}$/

/** Generate a 192-bit (24-byte) cryptographically random URL-safe token (32 chars). */
export function generateRawTrackingToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** Validate token length and URL-safe character set before any DB query. */
export function isValidTrackingTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_FORMAT_REGEX.test(token)
}

/** Compute SHA-256 hex digest of a raw tracking token. */
export function hashTrackingToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

/** Timing-safe verification of a raw token against a stored SHA-256 hex digest. */
export function verifyTrackingTokenHash(rawToken: string, expectedHashHex: string): boolean {
  if (!isValidTrackingTokenFormat(rawToken) || !/^[a-f0-9]{64}$/i.test(expectedHashHex)) {
    return false
  }
  const actualBuf = crypto.createHash('sha256').update(rawToken, 'utf8').digest()
  const expectedBuf = Buffer.from(expectedHashHex, 'hex')
  if (actualBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(actualBuf, expectedBuf)
}

/** Short non-sensitive preview of a token for internal UI display. */
export function maskTrackingToken(rawToken: string): string {
  if (rawToken.length < 12) return '••••••'
  return `${rawToken.slice(0, 5)}…${rawToken.slice(-4)}`
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.TRACKING_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DATABASE_URL ||
    'loadflow-default-tracking-token-secret-key'
  return crypto.createHash('sha256').update(`loadflow:tracking:v1:${secret}`, 'utf8').digest()
}

/** Encrypt raw token with AES-256-GCM so plaintext is never stored in DB. */
export function encryptTrackingToken(rawToken: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`
}

/** Decrypt AES-256-GCM token ciphertext for authenticated company members. */
export function decryptTrackingToken(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || typeof ciphertext !== 'string') return null
  const parts = ciphertext.split('.')
  if (parts.length !== 3) return null
  try {
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], 'base64url')
    const authTag = Buffer.from(parts[1], 'base64url')
    const encrypted = Buffer.from(parts[2], 'base64url')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return isValidTrackingTokenFormat(decrypted) ? decrypted : null
  } catch {
    return null
  }
}

// ─── Sanitization & Formatting Helpers ───────────────────────────────────────

/** Strip HTML tags and control characters from user-supplied text. */
export function sanitizeCustomerText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Derive a customer-safe shipment reference that never exposes raw internal UUIDs.
 */
export function formatPublicShipmentReference(delivery: {
  id: string
  externalId?: string | null
  sourceReference?: string | null
}): string {
  const ext = delivery.externalId?.trim()
  if (ext && !isValidUuid(ext) && ext.length <= 32) {
    return ext
  }
  const cleanSuffix = delivery.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()
  return `SHP-${cleanSuffix}`
}

export interface PublicProgressStep {
  key: 'ORDER_RECEIVED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED'
  label: string
  description: string
  state: 'COMPLETED' | 'CURRENT' | 'UPCOMING'
}

export interface PublicProgressSummary {
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'
  statusLabel: string
  headline: string
  isCancelled: boolean
  isDelivered: boolean
  currentStepIndex: number
  steps: PublicProgressStep[]
}

/** Map internal DeliveryStatus to customer-safe progress stages. */
export function derivePublicProgress(status: string): PublicProgressSummary {
  const baseSteps: Omit<PublicProgressStep, 'state'>[] = [
    {
      key: 'ORDER_RECEIVED',
      label: 'Order Received',
      description: 'Shipment registered and queued for dispatch planning',
    },
    {
      key: 'ASSIGNED',
      label: 'Scheduled & Assigned',
      description: 'Allocated to a dispatch load plan and fleet vehicle',
    },
    {
      key: 'IN_TRANSIT',
      label: 'In Transit',
      description: 'Dispatched and en route to destination',
    },
    {
      key: 'DELIVERED',
      label: 'Delivered',
      description: 'Shipment delivered to destination',
    },
  ]

  if (status === 'CANCELLED') {
    return {
      status: 'CANCELLED',
      statusLabel: 'Cancelled',
      headline: 'This shipment has been cancelled by the carrier.',
      isCancelled: true,
      isDelivered: false,
      currentStepIndex: -1,
      steps: baseSteps.map((s) => ({ ...s, state: 'UPCOMING' as const })),
    }
  }

  let currentIdx = 0
  let statusLabel = 'Awaiting Dispatch'
  let headline = 'Your shipment has been received and is awaiting dispatch scheduling.'
  let normalizedStatus: PublicProgressSummary['status'] = 'PENDING'

  if (status === 'ASSIGNED') {
    currentIdx = 1
    normalizedStatus = 'ASSIGNED'
    statusLabel = 'Scheduled for Dispatch'
    headline = 'Your shipment is assigned to a load plan and preparing for dispatch.'
  } else if (status === 'IN_TRANSIT') {
    currentIdx = 2
    normalizedStatus = 'IN_TRANSIT'
    statusLabel = 'In Transit'
    headline = 'Your shipment has been dispatched and is on the way to the destination.'
  } else if (status === 'DELIVERED') {
    currentIdx = 3
    normalizedStatus = 'DELIVERED'
    statusLabel = 'Delivered'
    headline = 'Your shipment has been delivered.'
  }

  const steps: PublicProgressStep[] = baseSteps.map((step, idx) => {
    if (normalizedStatus === 'DELIVERED') {
      return { ...step, state: 'COMPLETED' }
    }
    if (idx < currentIdx) return { ...step, state: 'COMPLETED' }
    if (idx === currentIdx) return { ...step, state: 'CURRENT' }
    return { ...step, state: 'UPCOMING' }
  })

  return {
    status: normalizedStatus,
    statusLabel,
    headline,
    isCancelled: false,
    isDelivered: normalizedStatus === 'DELIVERED',
    currentStepIndex: currentIdx,
    steps,
  }
}

// ─── Public DTOs ─────────────────────────────────────────────────────────────

export interface PublicTrackingMilestoneDTO {
  id: string
  eventType: string
  title: string
  description: string | null
  locationLabel: string | null
  timestamp: string | null
  status: 'COMPLETED' | 'CURRENT' | 'UPCOMING'
}

export interface PublicTrackingDTO {
  tracking: {
    reference: string
    recipientName: string
    status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED'
    statusLabel: string
    headline: string
    origin: string | null
    destination: string | null
    scheduledDate: string | null
    estimatedDeliveryAt: string | null
    deliveredAt: string | null
    updatedAt: string
    itemSummary: {
      totalItems: number
      totalWeightKg: number
      items: { productName: string; quantity: number; quantityUnit: string }[]
    }
  }
  progress: PublicProgressSummary
  milestones: PublicTrackingMilestoneDTO[]
  company: {
    name: string
  }
}

// ─── Milestone Synthesis ─────────────────────────────────────────────────────

export interface StoredTrackingEventRecord {
  id: string
  eventType: string
  title: string
  description: string | null
  locationLabel: string | null
  occurredAt: Date | string
  customerVisible: boolean
}

/**
 * Combine real delivery lifecycle timestamps with customer-visible
 * `DeliveryTrackingEvent` rows without duplicating automatic lifecycle events.
 */
export function buildPublicMilestones(params: {
  deliveryStatus: string
  deliveryCreatedAt: Date | string
  deliveryUpdatedAt: Date | string
  pickupAddress?: string | null
  deliveryAddress?: string | null
  assignedAt?: Date | string | null
  events: StoredTrackingEventRecord[]
}): PublicTrackingMilestoneDTO[] {
  const visibleEvents = params.events
    .filter((e) => e.customerVisible)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

  const hasEventType = (type: string) => visibleEvents.some((e) => e.eventType === type)
  const synthesized: StoredTrackingEventRecord[] = []

  if (!hasEventType('DELIVERY_CREATED')) {
    synthesized.push({
      id: 'auto-created',
      eventType: 'DELIVERY_CREATED',
      title: 'Shipment Order Created',
      description: 'Shipment details registered with carrier.',
      locationLabel: params.pickupAddress || null,
      occurredAt: params.deliveryCreatedAt,
      customerVisible: true,
    })
  }

  if (
    (params.deliveryStatus === 'ASSIGNED' ||
      params.deliveryStatus === 'IN_TRANSIT' ||
      params.deliveryStatus === 'DELIVERED') &&
    !hasEventType('DELIVERY_ASSIGNED') &&
    params.assignedAt
  ) {
    synthesized.push({
      id: 'auto-assigned',
      eventType: 'DELIVERY_ASSIGNED',
      title: 'Assigned to Dispatch Plan',
      description: 'Allocated to fleet load plan for scheduled departure.',
      locationLabel: params.pickupAddress || null,
      occurredAt: params.assignedAt,
      customerVisible: true,
    })
  }

  if (
    (params.deliveryStatus === 'IN_TRANSIT' || params.deliveryStatus === 'DELIVERED') &&
    !hasEventType('DISPATCHED') &&
    !hasEventType('IN_TRANSIT')
  ) {
    synthesized.push({
      id: 'auto-transit',
      eventType: 'IN_TRANSIT',
      title: 'Shipment Dispatched — In Transit',
      description: 'Vehicle departed origin and shipment is en route.',
      locationLabel: params.pickupAddress || null,
      occurredAt:
        params.deliveryStatus === 'IN_TRANSIT'
          ? params.deliveryUpdatedAt
          : params.assignedAt || params.deliveryCreatedAt,
      customerVisible: true,
    })
  }

  if (params.deliveryStatus === 'DELIVERED' && !hasEventType('DELIVERED')) {
    synthesized.push({
      id: 'auto-delivered',
      eventType: 'DELIVERED',
      title: 'Delivered',
      description: 'Shipment successfully delivered to destination.',
      locationLabel: params.deliveryAddress || null,
      occurredAt: params.deliveryUpdatedAt,
      customerVisible: true,
    })
  }

  if (params.deliveryStatus === 'CANCELLED' && !hasEventType('DELIVERY_CANCELLED')) {
    synthesized.push({
      id: 'auto-cancelled',
      eventType: 'DELIVERY_CANCELLED',
      title: 'Shipment Cancelled',
      description: 'This delivery order was cancelled.',
      locationLabel: null,
      occurredAt: params.deliveryUpdatedAt,
      customerVisible: true,
    })
  }

  const combined = [...synthesized, ...visibleEvents].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )

  return combined.map((m, index) => {
    const isLast = index === combined.length - 1
    const status: PublicTrackingMilestoneDTO['status'] =
      params.deliveryStatus === 'DELIVERED'
        ? 'COMPLETED'
        : isLast
          ? 'CURRENT'
          : 'COMPLETED'

    return {
      id: m.id,
      eventType: m.eventType,
      title: m.title,
      description: m.description,
      locationLabel: m.locationLabel,
      timestamp: new Date(m.occurredAt).toISOString(),
      status,
    }
  })
}

// ─── Database Interfaces ─────────────────────────────────────────────────────

export interface TrackingLinkRecord {
  id: string
  companyId: string
  deliveryId: string
  tokenHash: string
  tokenCiphertext: string | null
  tokenPreview: string
  status: TrackingLinkStatusValue | string
  estimatedDeliveryAt: Date | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  lastAccessedAt: Date | null
}

export interface DeliveryTrackingEventRecord {
  id: string
  companyId: string
  deliveryId: string
  eventType: TrackingEventTypeValue | string
  title: string
  description: string | null
  locationLabel: string | null
  occurredAt: Date
  createdAt: Date
  createdByUserId: string | null
  customerVisible: boolean
}

export interface AuthenticatedTrackingView {
  link: {
    id: string
    status: TrackingLinkStatusValue
    tokenPreview: string
    rawToken: string | null
    publicPath: string | null
    estimatedDeliveryAt: string | null
    expiresAt: string | null
    revokedAt: string | null
    lastAccessedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
  events: {
    id: string
    eventType: string
    title: string
    description: string | null
    locationLabel: string | null
    occurredAt: string
    customerVisible: boolean
  }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = Record<string, any>

export function resolveEffectiveLinkStatus(
  link: Pick<TrackingLinkRecord, 'status' | 'expiresAt'>,
  now: Date = new Date()
): TrackingLinkStatusValue {
  if (link.status === 'REVOKED') return 'REVOKED'
  if (link.status === 'EXPIRED') return 'EXPIRED'
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) {
    return 'EXPIRED'
  }
  return 'ACTIVE'
}

export function serializeAuthenticatedTrackingLink(
  link: TrackingLinkRecord | null,
  rawTokenOverride?: string | null,
  now: Date = new Date()
): AuthenticatedTrackingView['link'] {
  if (!link) return null
  const effectiveStatus = resolveEffectiveLinkStatus(link, now)
  const rawToken =
    effectiveStatus === 'ACTIVE'
      ? (rawTokenOverride ?? decryptTrackingToken(link.tokenCiphertext))
      : null

  return {
    id: link.id,
    status: effectiveStatus,
    tokenPreview: link.tokenPreview,
    rawToken,
    publicPath: rawToken ? `/track/${rawToken}` : null,
    estimatedDeliveryAt: link.estimatedDeliveryAt
      ? new Date(link.estimatedDeliveryAt).toISOString()
      : null,
    expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : null,
    revokedAt: link.revokedAt ? new Date(link.revokedAt).toISOString() : null,
    lastAccessedAt: link.lastAccessedAt ? new Date(link.lastAccessedAt).toISOString() : null,
    createdAt: new Date(link.createdAt).toISOString(),
    updatedAt: new Date(link.updatedAt).toISOString(),
  }
}

/**
 * Record an automatic customer-visible lifecycle milestone inside an existing
 * transaction. Gracefully no-ops if the table/mock is unavailable.
 */
export async function recordLifecycleTrackingEvent(
  tx: AnyDb,
  params: {
    companyId: string
    deliveryId: string
    eventType: TrackingEventTypeValue
    title: string
    description?: string | null
    locationLabel?: string | null
    createdByUserId?: string | null
  }
): Promise<void> {
  if (!tx?.deliveryTrackingEvent?.create) return
  try {
    await tx.deliveryTrackingEvent.create({
      data: {
        companyId: params.companyId,
        deliveryId: params.deliveryId,
        eventType: params.eventType,
        title: sanitizeCustomerText(params.title, 120) || 'Shipment Update',
        description: params.description ? sanitizeCustomerText(params.description, 500) : null,
        locationLabel: params.locationLabel ? sanitizeCustomerText(params.locationLabel, 120) : null,
        createdByUserId: params.createdByUserId ?? null,
        customerVisible: true,
      },
    })
  } catch {
    // Graceful degradation if migration has not yet been applied
  }
}

/**
 * Fetch tracking link + milestone state for an authenticated company delivery page.
 */
export async function getDeliveryTrackingState(
  db: AnyDb,
  companyId: string,
  deliveryId: string,
  now: Date = new Date()
): Promise<AuthenticatedTrackingView> {
  if (!isValidUuid(deliveryId) || !db?.shipmentTrackingLink?.findFirst) {
    return { link: null, events: [] }
  }
  try {
    const [latestLink, events] = await Promise.all([
      db.shipmentTrackingLink.findFirst({
        where: { companyId, deliveryId },
        orderBy: { createdAt: 'desc' },
      }) as Promise<TrackingLinkRecord | null>,
      db.deliveryTrackingEvent?.findMany
        ? (db.deliveryTrackingEvent.findMany({
            where: { companyId, deliveryId },
            orderBy: { occurredAt: 'desc' },
            take: 50,
          }) as Promise<DeliveryTrackingEventRecord[]>)
        : Promise.resolve([]),
    ])

    if (
      latestLink &&
      latestLink.status === 'ACTIVE' &&
      resolveEffectiveLinkStatus(latestLink, now) === 'EXPIRED' &&
      db.shipmentTrackingLink?.updateMany
    ) {
      await db.shipmentTrackingLink
        .updateMany({
          where: { id: latestLink.id, companyId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        })
        .catch(() => null)
      latestLink.status = 'EXPIRED'
    }

    return {
      link: serializeAuthenticatedTrackingLink(latestLink, null, now),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        locationLabel: e.locationLabel,
        occurredAt: new Date(e.occurredAt).toISOString(),
        customerVisible: e.customerVisible,
      })),
    }
  } catch {
    return { link: null, events: [] }
  }
}

function parseOptionalFutureDate(
  raw: unknown,
  fieldLabel: string,
  requireFuture: boolean,
  now: Date
): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined }
  if (raw === null || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string' && !(raw instanceof Date)) {
    return { ok: false, error: `Invalid ${fieldLabel} date format.` }
  }
  const d = new Date(raw)
  if (isNaN(d.getTime())) {
    return { ok: false, error: `Invalid ${fieldLabel} date format.` }
  }
  if (requireFuture && d.getTime() <= now.getTime()) {
    return { ok: false, error: `${fieldLabel} must be in the future.` }
  }
  return { ok: true, value: d }
}

/**
 * Create a tracking link for a delivery, or return/update the existing active
 * link unless `rotate: true` is passed.
 */
export async function createOrRotateTrackingLink(
  db: AnyDb,
  companyId: string,
  deliveryId: string,
  actor: ActivityActor | null | undefined,
  options?: {
    rotate?: boolean
    expiresAt?: unknown
    estimatedDeliveryAt?: unknown
    now?: Date
  }
): Promise<
  | { ok: true; data: AuthenticatedTrackingView['link']; created: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!isValidUuid(deliveryId)) {
    return { ok: false, status: 400, error: 'Invalid delivery ID.' }
  }
  const now = options?.now ?? new Date()
  const expParsed = parseOptionalFutureDate(options?.expiresAt, 'Expiration', true, now)
  if (!expParsed.ok) return { ok: false, status: 400, error: expParsed.error }

  const etaParsed = parseOptionalFutureDate(
    options?.estimatedDeliveryAt,
    'Estimated delivery',
    false,
    now
  )
  if (!etaParsed.ok) return { ok: false, status: 400, error: etaParsed.error }

  const delivery = await db.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: { id: true, customerName: true, scheduledDate: true },
  })
  if (!delivery) {
    return { ok: false, status: 404, error: 'Delivery not found.' }
  }

  if (!db.shipmentTrackingLink?.findFirst || !db.shipmentTrackingLink?.create) {
    return { ok: false, status: 503, error: 'Tracking link storage is not available.' }
  }

  const existing = (await db.shipmentTrackingLink.findFirst({
    where: { companyId, deliveryId },
    orderBy: { createdAt: 'desc' },
  })) as TrackingLinkRecord | null

  const existingIsActive =
    existing !== null && resolveEffectiveLinkStatus(existing, now) === 'ACTIVE'

  // Avoid duplicate active links unless explicit rotation was requested
  if (existingIsActive && existing && !options?.rotate) {
    const updatePatch: Record<string, unknown> = {}
    const activityEvents: ActivityInput[] = []

    if (expParsed.value !== undefined) {
      updatePatch.expiresAt = expParsed.value
      activityEvents.push({
        entityType: 'DELIVERY',
        entityId: deliveryId,
        type: 'TRACKING_EXPIRATION_UPDATED',
        message: expParsed.value
          ? `Customer tracking link expiration set to ${format(expParsed.value, 'MMM d, yyyy h:mm a')}.`
          : 'Customer tracking link expiration removed.',
      })
    }
    if (etaParsed.value !== undefined) {
      updatePatch.estimatedDeliveryAt = etaParsed.value
      activityEvents.push({
        entityType: 'DELIVERY',
        entityId: deliveryId,
        type: 'DELIVERY_ETA_UPDATED',
        message: etaParsed.value
          ? `Customer-facing ETA updated to ${format(etaParsed.value, 'MMM d, yyyy h:mm a')}.`
          : 'Customer-facing ETA cleared.',
      })
    }

    let updatedRecord = existing
    if (Object.keys(updatePatch).length > 0 && db.shipmentTrackingLink.update) {
      updatedRecord = await db.shipmentTrackingLink.update({
        where: { id: existing.id },
        data: updatePatch,
      })
      await recordActivity(db, companyId, actor, activityEvents)
    }

    return {
      ok: true,
      data: serializeAuthenticatedTrackingLink(updatedRecord, null, now),
      created: false,
    }
  }

  // Generate fresh cryptographic token
  const rawToken = generateRawTrackingToken()
  const tokenHash = hashTrackingToken(rawToken)
  const tokenCiphertext = encryptTrackingToken(rawToken)
  const tokenPreview = maskTrackingToken(rawToken)

  const hadPriorLink = existing !== null
  const preservedEta =
    etaParsed.value !== undefined
      ? etaParsed.value
      : (existing?.estimatedDeliveryAt ?? null)

  const runInTx = async (tx: AnyDb) => {
    if (tx.shipmentTrackingLink?.updateMany) {
      await tx.shipmentTrackingLink.updateMany({
        where: { companyId, deliveryId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: now },
      })
    }

    const created = (await tx.shipmentTrackingLink.create({
      data: {
        companyId,
        deliveryId,
        tokenHash,
        tokenCiphertext,
        tokenPreview,
        status: 'ACTIVE',
        expiresAt: expParsed.value ?? null,
        estimatedDeliveryAt: preservedEta,
        createdByUserId: actor?.userId ?? null,
      },
    })) as TrackingLinkRecord

    await recordActivity(tx, companyId, actor, [
      {
        entityType: 'DELIVERY',
        entityId: deliveryId,
        type: hadPriorLink ? 'TRACKING_LINK_REGENERATED' : 'TRACKING_LINK_GENERATED',
        message: hadPriorLink
          ? `Customer tracking link regenerated (${tokenPreview}) for ${delivery.customerName}.`
          : `Customer tracking link generated (${tokenPreview}) for ${delivery.customerName}.`,
        metadata: { tokenPreview, linkId: created.id },
      },
    ])

    return created
  }

  const created = db.$transaction ? await db.$transaction(runInTx) : await runInTx(db)

  return {
    ok: true,
    data: serializeAuthenticatedTrackingLink(created, rawToken, now),
    created: true,
  }
}

/**
 * Revoke the active tracking link for a delivery.
 */
export async function revokeTrackingLink(
  db: AnyDb,
  companyId: string,
  deliveryId: string,
  actor: ActivityActor | null | undefined,
  now: Date = new Date()
): Promise<{ ok: true; data: AuthenticatedTrackingView['link'] } | { ok: false; status: number; error: string }> {
  if (!isValidUuid(deliveryId)) {
    return { ok: false, status: 400, error: 'Invalid delivery ID.' }
  }
  const delivery = await db.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: { id: true, customerName: true },
  })
  if (!delivery) {
    return { ok: false, status: 404, error: 'Delivery not found.' }
  }

  const latest = (await db.shipmentTrackingLink?.findFirst?.({
    where: { companyId, deliveryId },
    orderBy: { createdAt: 'desc' },
  })) as TrackingLinkRecord | null

  if (!latest) {
    return { ok: false, status: 404, error: 'No tracking link exists for this delivery.' }
  }

  const runInTx = async (tx: AnyDb) => {
    await tx.shipmentTrackingLink.updateMany({
      where: { companyId, deliveryId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: now },
    })

    await recordActivity(tx, companyId, actor, [
      {
        entityType: 'DELIVERY',
        entityId: deliveryId,
        type: 'TRACKING_LINK_REVOKED',
        message: `Customer tracking link (${latest.tokenPreview}) revoked for ${delivery.customerName}.`,
        metadata: { tokenPreview: latest.tokenPreview, linkId: latest.id },
      },
    ])

    return {
      ...latest,
      status: 'REVOKED' as const,
      revokedAt: now,
      updatedAt: now,
    }
  }

  const revokedRecord = db.$transaction ? await db.$transaction(runInTx) : await runInTx(db)

  return {
    ok: true,
    data: serializeAuthenticatedTrackingLink(revokedRecord, null, now),
  }
}

/**
 * Add a manual customer-visible (or internal) milestone event to a delivery.
 */
export async function addDeliveryTrackingMilestone(
  db: AnyDb,
  companyId: string,
  deliveryId: string,
  actor: ActivityActor | null | undefined,
  input: {
    eventType?: unknown
    title?: unknown
    description?: unknown
    locationLabel?: unknown
    customerVisible?: unknown
  }
): Promise<
  | {
      ok: true
      data: {
        id: string
        eventType: string
        title: string
        description: string | null
        locationLabel: string | null
        occurredAt: string
        customerVisible: boolean
      }
    }
  | { ok: false; status: number; error: string }
> {
  if (!isValidUuid(deliveryId)) {
    return { ok: false, status: 400, error: 'Invalid delivery ID.' }
  }

  const rawType = typeof input.eventType === 'string' ? input.eventType : 'MANUAL_UPDATE'
  if (!(MANUAL_ALLOWED_EVENT_TYPES as readonly string[]).includes(rawType)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid milestone type. Allowed: ${MANUAL_ALLOWED_EVENT_TYPES.join(', ')}`,
    }
  }

  const title = sanitizeCustomerText(input.title, 120)
  if (title.length < 3) {
    return {
      ok: false,
      status: 400,
      error: 'Milestone title is required (3 to 120 characters).',
    }
  }

  const description = sanitizeCustomerText(input.description, 500) || null
  const locationLabel = sanitizeCustomerText(input.locationLabel, 120) || null
  const customerVisible = input.customerVisible === undefined ? true : Boolean(input.customerVisible)

  const delivery = await db.delivery.findFirst({
    where: { id: deliveryId, companyId },
    select: { id: true, customerName: true },
  })
  if (!delivery) {
    return { ok: false, status: 404, error: 'Delivery not found.' }
  }

  if (!db.deliveryTrackingEvent?.create) {
    return { ok: false, status: 503, error: 'Tracking milestone storage is not available.' }
  }

  const runInTx = async (tx: AnyDb) => {
    const created = (await tx.deliveryTrackingEvent.create({
      data: {
        companyId,
        deliveryId,
        eventType: rawType as TrackingEventTypeValue,
        title,
        description,
        locationLabel,
        createdByUserId: actor?.userId ?? null,
        customerVisible,
      },
    })) as DeliveryTrackingEventRecord

    await recordActivity(tx, companyId, actor, [
      {
        entityType: 'DELIVERY',
        entityId: deliveryId,
        type: 'TRACKING_MILESTONE_ADDED',
        message: `${customerVisible ? 'Customer-visible' : 'Internal'} tracking milestone added: "${title}"${locationLabel ? ` (${locationLabel})` : ''}.`,
        metadata: {
          milestoneId: created.id,
          eventType: rawType,
          customerVisible,
        },
      },
    ])

    return created
  }

  const created = db.$transaction ? await db.$transaction(runInTx) : await runInTx(db)

  return {
    ok: true,
    data: {
      id: created.id,
      eventType: created.eventType,
      title: created.title,
      description: created.description,
      locationLabel: created.locationLabel,
      occurredAt: new Date(created.occurredAt).toISOString(),
      customerVisible: created.customerVisible,
    },
  }
}

// ─── Public Tracking Lookup ──────────────────────────────────────────────────

export type PublicTrackingLookupResult =
  | { ok: true; data: PublicTrackingDTO }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED'; status: 404 | 410; message: string }

/**
 * Resolve a raw public token to a strictly sanitized `PublicTrackingDTO`.
 * Enforces format validation, SHA-256 lookup, timing-safe comparison,
 * revocation, expiration, and tenant consistency.
 */
export async function resolvePublicTrackingByToken(
  db: AnyDb,
  rawToken: unknown,
  now: Date = new Date()
): Promise<PublicTrackingLookupResult> {
  if (!isValidTrackingTokenFormat(rawToken)) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      status: 404,
      message: 'Tracking link not found or no longer active.',
    }
  }

  if (!db?.shipmentTrackingLink?.findUnique) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      status: 404,
      message: 'Tracking link not found or no longer active.',
    }
  }

  const tokenHash = hashTrackingToken(rawToken)
  const link = (await db.shipmentTrackingLink.findUnique({
    where: { tokenHash },
  })) as TrackingLinkRecord | null

  if (!link || !verifyTrackingTokenHash(rawToken, link.tokenHash)) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      status: 404,
      message: 'Tracking link not found or no longer active.',
    }
  }

  if (link.status === 'REVOKED') {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      status: 404,
      message: 'Tracking link not found or no longer active.',
    }
  }

  const effectiveStatus = resolveEffectiveLinkStatus(link, now)
  if (effectiveStatus === 'EXPIRED') {
    if (link.status !== 'EXPIRED' && db.shipmentTrackingLink?.updateMany) {
      await db.shipmentTrackingLink
        .updateMany({
          where: { id: link.id, companyId: link.companyId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        })
        .catch(() => null)
    }
    return {
      ok: false,
      reason: 'EXPIRED',
      status: 410,
      message: 'This shipment tracking link has expired.',
    }
  }

  // Load delivery strictly scoped to the link's companyId
  const delivery = await db.delivery.findFirst({
    where: {
      id: link.deliveryId,
      companyId: link.companyId,
    },
    select: {
      id: true,
      customerName: true,
      pickupAddress: true,
      deliveryAddress: true,
      weight: true,
      status: true,
      scheduledDate: true,
      externalId: true,
      sourceReference: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          productName: true,
          quantity: true,
          quantityUnit: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      loadPlanItems: {
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!delivery) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      status: 404,
      message: 'Tracking link not found or no longer active.',
    }
  }

  const events: StoredTrackingEventRecord[] = db.deliveryTrackingEvent?.findMany
    ? await db.deliveryTrackingEvent
        .findMany({
          where: {
            companyId: link.companyId,
            deliveryId: link.deliveryId,
            customerVisible: true,
          },
          orderBy: { occurredAt: 'asc' },
          take: 50,
        })
        .catch(() => [])
    : []

  // Best-effort update of lastAccessedAt
  if (db.shipmentTrackingLink?.update) {
    await db.shipmentTrackingLink
      .update({
        where: { id: link.id },
        data: { lastAccessedAt: now },
      })
      .catch(() => null)
  }

  const progress = derivePublicProgress(delivery.status)
  const milestones = buildPublicMilestones({
    deliveryStatus: delivery.status,
    deliveryCreatedAt: delivery.createdAt,
    deliveryUpdatedAt: delivery.updatedAt,
    pickupAddress: delivery.pickupAddress,
    deliveryAddress: delivery.deliveryAddress,
    assignedAt: delivery.loadPlanItems?.[0]?.createdAt ?? null,
    events,
  })

  // Determine actual delivered timestamp if delivered
  const deliveredEvent = milestones.find((m) => m.eventType === 'DELIVERED')
  const deliveredAt =
    delivery.status === 'DELIVERED'
      ? (deliveredEvent?.timestamp ?? new Date(delivery.updatedAt).toISOString())
      : null

  // Determine ETA: use explicit link.estimatedDeliveryAt when set, or scheduledDate if available
  const estimatedDeliveryAt = link.estimatedDeliveryAt
    ? new Date(link.estimatedDeliveryAt).toISOString()
    : delivery.scheduledDate
      ? new Date(delivery.scheduledDate).toISOString()
      : null

  return {
    ok: true,
    data: {
      tracking: {
        reference: formatPublicShipmentReference(delivery),
        recipientName: delivery.customerName,
        status: progress.status,
        statusLabel: progress.statusLabel,
        headline: progress.headline,
        origin: delivery.pickupAddress || null,
        destination: delivery.deliveryAddress || null,
        scheduledDate: delivery.scheduledDate
          ? new Date(delivery.scheduledDate).toISOString()
          : null,
        estimatedDeliveryAt,
        deliveredAt,
        updatedAt: new Date(delivery.updatedAt).toISOString(),
        itemSummary: {
          totalItems: (delivery.items || []).length,
          totalWeightKg: Math.round(Number(delivery.weight || 0) * 100) / 100,
          items: (delivery.items || []).slice(0, 10).map((it: { productName: string; quantity: unknown; quantityUnit: string }) => ({
            productName: it.productName,
            quantity: Number(it.quantity || 0),
            quantityUnit: it.quantityUnit,
          })),
        },
      },
      progress,
      milestones,
      company: {
        name: delivery.company?.name || 'LoadFlow Carrier',
      },
    },
  }
}
