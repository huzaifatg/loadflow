import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateRawTrackingToken,
  isValidTrackingTokenFormat,
  hashTrackingToken,
  verifyTrackingTokenHash,
  encryptTrackingToken,
  decryptTrackingToken,
  formatPublicShipmentReference,
  derivePublicProgress,
  buildPublicMilestones,
  createOrRotateTrackingLink,
  revokeTrackingLink,
  addDeliveryTrackingMilestone,
  resolvePublicTrackingByToken,
} from '../tracking'

const COMP_A = '00000000-0000-4000-8000-00000000000a'
const COMP_B = '00000000-0000-4000-8000-00000000000b'
const DELIV_1 = '00000000-0000-4000-8000-000000000101'
const USER_1 = '00000000-0000-4000-8000-000000000901'

describe('Sprint 17 — Customer Shipment Tracking Service', () => {
  describe('Token Cryptography & Format Validation', () => {
    it('generates high-entropy URL-safe tokens that pass format validation', () => {
      const seen = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const token = generateRawTrackingToken()
        assert.equal(isValidTrackingTokenFormat(token), true)
        assert.equal(token.length, 32)
        assert.equal(seen.has(token), false)
        seen.add(token)
      }
    })

    it('rejects short, malformed, or non-string tokens before DB queries', () => {
      assert.equal(isValidTrackingTokenFormat(''), false)
      assert.equal(isValidTrackingTokenFormat('short-token'), false)
      assert.equal(isValidTrackingTokenFormat('bad!characters!in!token!12345678901234'), false)
      assert.equal(isValidTrackingTokenFormat(null), false)
      assert.equal(isValidTrackingTokenFormat(12345), false)
    })

    it('hashes tokens with SHA-256 and verifies with timing-safe equality', () => {
      const tokenA = generateRawTrackingToken()
      const tokenB = generateRawTrackingToken()
      const hashA = hashTrackingToken(tokenA)

      assert.equal(hashA.length, 64)
      assert.notEqual(hashA, tokenA)
      assert.equal(verifyTrackingTokenHash(tokenA, hashA), true)
      assert.equal(verifyTrackingTokenHash(tokenB, hashA), false)
      assert.equal(verifyTrackingTokenHash(tokenA, 'not-a-valid-hex-hash'), false)
    })

    it('encrypts and decrypts tokens using AES-256-GCM without storing plaintext', () => {
      const token = generateRawTrackingToken()
      const ciphertext = encryptTrackingToken(token)
      assert.equal(ciphertext.includes(token), false)
      assert.equal(decryptTrackingToken(ciphertext), token)
      assert.equal(decryptTrackingToken('tampered.ciphertext.value'), null)
    })
  })

  describe('Tracking Link Lifecycle & Tenant Isolation', () => {
    it('creates a hashed tracking link, reuses active link when rotate=false, and rotates when rotate=true', async () => {
      const storedLinks: Record<string, unknown>[] = []
      const recordedActivities: Record<string, unknown>[] = []

      const mockDb = {
        delivery: {
          findFirst: async ({ where }: { where: { id: string; companyId: string } }) => {
            if (where.id === DELIV_1 && where.companyId === COMP_A) {
              return { id: DELIV_1, customerName: 'Acme Logistics', scheduledDate: null }
            }
            return null
          },
        },
        shipmentTrackingLink: {
          findFirst: async ({ where }: { where: { companyId: string; deliveryId: string } }) => {
            const matches = storedLinks.filter(
              (l) => l.companyId === where.companyId && l.deliveryId === where.deliveryId
            )
            return matches[matches.length - 1] ?? null
          },
          updateMany: async ({
            where,
            data,
          }: {
            where: { companyId: string; deliveryId: string; status: string }
            data: Record<string, unknown>
          }) => {
            let count = 0
            for (const l of storedLinks) {
              if (
                l.companyId === where.companyId &&
                l.deliveryId === where.deliveryId &&
                l.status === where.status
              ) {
                Object.assign(l, data)
                count++
              }
            }
            return { count }
          },
          create: async ({ data }: { data: Record<string, unknown> }) => {
            const record = {
              id: `link-${storedLinks.length + 1}`,
              ...data,
              lastAccessedAt: null,
              revokedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            storedLinks.push(record)
            return record
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string }
            data: Record<string, unknown>
          }) => {
            const found = storedLinks.find((l) => l.id === where.id)!
            Object.assign(found, data, { updatedAt: new Date() })
            return found
          },
        },
        activityEvent: {
          createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
            recordedActivities.push(...data)
          },
        },
      }

      // 1. Create initial link
      const first = await createOrRotateTrackingLink(mockDb, COMP_A, DELIV_1, {
        userId: USER_1,
        label: 'dispatcher@acme.com',
      })
      assert.equal(first.ok, true)
      if (!first.ok) return
      assert.equal(first.created, true)
      assert.ok(first.data?.rawToken)
      assert.equal(first.data?.publicPath, `/track/${first.data?.rawToken}`)
      assert.equal(storedLinks.length, 1)
      // Raw token is never stored as tokenHash
      assert.notEqual(storedLinks[0].tokenHash, first.data?.rawToken)
      assert.equal(recordedActivities[0].type, 'TRACKING_LINK_GENERATED')

      // 2. Calling again with rotate=false returns existing active link without duplicating
      const second = await createOrRotateTrackingLink(mockDb, COMP_A, DELIV_1, {
        userId: USER_1,
      })
      assert.equal(second.ok, true)
      if (!second.ok) return
      assert.equal(second.created, false)
      assert.equal(storedLinks.length, 1)
      assert.equal(second.data?.rawToken, first.data?.rawToken)

      // 3. Calling with rotate=true revokes first link and creates replacement
      const rotated = await createOrRotateTrackingLink(
        mockDb,
        COMP_A,
        DELIV_1,
        { userId: USER_1 },
        { rotate: true }
      )
      assert.equal(rotated.ok, true)
      if (!rotated.ok) return
      assert.equal(rotated.created, true)
      assert.equal(storedLinks.length, 2)
      assert.equal(storedLinks[0].status, 'REVOKED')
      assert.equal(storedLinks[1].status, 'ACTIVE')
      assert.notEqual(rotated.data?.rawToken, first.data?.rawToken)
      assert.equal(
        recordedActivities[recordedActivities.length - 1].type,
        'TRACKING_LINK_REGENERATED'
      )
    })

    it('strictly enforces company isolation on link creation and revocation', async () => {
      const mockDb = {
        delivery: {
          findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
            where.id === DELIV_1 && where.companyId === COMP_A
              ? { id: DELIV_1, customerName: 'Acme' }
              : null,
        },
        shipmentTrackingLink: {
          findFirst: async () => null,
          create: async () => ({}),
        },
      }

      const crossCreate = await createOrRotateTrackingLink(mockDb, COMP_B, DELIV_1, {
        userId: USER_1,
      })
      assert.equal(crossCreate.ok, false)
      if (!crossCreate.ok) assert.equal(crossCreate.status, 404)

      const crossRevoke = await revokeTrackingLink(mockDb, COMP_B, DELIV_1, {
        userId: USER_1,
      })
      assert.equal(crossRevoke.ok, false)
      if (!crossRevoke.ok) assert.equal(crossRevoke.status, 404)
    })
  })

  describe('Public Tracking API Resolution & Privacy Protection', () => {
    it('resolves valid token to customer-safe DTO and omits all sensitive internal fields', async () => {
      const rawToken = generateRawTrackingToken()
      const tokenHash = hashTrackingToken(rawToken)

      const mockDb = {
        shipmentTrackingLink: {
          findUnique: async ({ where }: { where: { tokenHash: string } }) =>
            where.tokenHash === tokenHash
              ? {
                  id: 'link-1',
                  companyId: COMP_A,
                  deliveryId: DELIV_1,
                  tokenHash,
                  tokenCiphertext: encryptTrackingToken(rawToken),
                  tokenPreview: 'abcde…1234',
                  status: 'ACTIVE',
                  estimatedDeliveryAt: new Date('2026-11-20T16:00:00Z'),
                  expiresAt: null,
                  revokedAt: null,
                  lastAccessedAt: null,
                  createdAt: new Date('2026-11-13T08:00:00Z'),
                  updatedAt: new Date('2026-11-13T08:00:00Z'),
                }
              : null,
          update: async () => ({}),
        },
        delivery: {
          findFirst: async () => ({
            id: DELIV_1,
            customerName: 'Global Retail Corp',
            pickupAddress: '100 Warehouse Way, Austin, TX',
            deliveryAddress: '500 Commerce St, Dallas, TX',
            weight: 1450,
            status: 'IN_TRANSIT',
            scheduledDate: new Date('2026-11-20T00:00:00Z'),
            externalId: null,
            sourceReference: null,
            notes: 'CONFIDENTIAL INTERNAL DISPATCHER NOTE: Gate code #9988',
            createdAt: new Date('2026-11-13T08:00:00Z'),
            updatedAt: new Date('2026-11-13T10:00:00Z'),
            company: { name: 'Lone Star Freight' },
            items: [{ productName: 'Industrial Pallet', quantity: 4, quantityUnit: 'pallets' }],
            loadPlanItems: [{ createdAt: new Date('2026-11-13T09:00:00Z') }],
          }),
        },
        deliveryTrackingEvent: {
          findMany: async () => [
            {
              id: 'evt-public',
              eventType: 'MANUAL_UPDATE',
              title: 'Departed Austin Hub',
              description: 'Cleared regional checkpoint on schedule.',
              locationLabel: 'Austin, TX',
              occurredAt: new Date('2026-11-13T10:30:00Z'),
              customerVisible: true,
            },
          ],
        },
      }

      const res = await resolvePublicTrackingByToken(mockDb, rawToken)
      assert.equal(res.ok, true)
      if (!res.ok) return

      const serialized = JSON.stringify(res.data)
      // Must NOT expose raw internal UUIDs, companyId, or internal notes
      assert.equal(serialized.includes(COMP_A), false)
      assert.equal(serialized.includes(DELIV_1), false)
      assert.equal(serialized.includes('Gate code #9988'), false)
      assert.equal(serialized.includes(rawToken), false)

      assert.equal(res.data.company.name, 'Lone Star Freight')
      assert.equal(res.data.tracking.status, 'IN_TRANSIT')
      assert.equal(res.data.tracking.reference, formatPublicShipmentReference({ id: DELIV_1 }))
      assert.equal(res.data.progress.currentStepIndex, 2)
      assert.ok(res.data.milestones.some((m) => m.title === 'Departed Austin Hub'))
    })

    it('rejects invalid, revoked, expired, and missing-delivery tokens safely', async () => {
      const revokedToken = generateRawTrackingToken()
      const expiredToken = generateRawTrackingToken()
      const missingDeliveryToken = generateRawTrackingToken()

      const mockDb = {
        shipmentTrackingLink: {
          findUnique: async ({ where }: { where: { tokenHash: string } }) => {
            if (where.tokenHash === hashTrackingToken(revokedToken)) {
              return {
                id: 'l-rev',
                companyId: COMP_A,
                deliveryId: DELIV_1,
                tokenHash: hashTrackingToken(revokedToken),
                status: 'REVOKED',
                expiresAt: null,
              }
            }
            if (where.tokenHash === hashTrackingToken(expiredToken)) {
              return {
                id: 'l-exp',
                companyId: COMP_A,
                deliveryId: DELIV_1,
                tokenHash: hashTrackingToken(expiredToken),
                status: 'ACTIVE',
                expiresAt: new Date('2020-01-01T00:00:00Z'),
              }
            }
            if (where.tokenHash === hashTrackingToken(missingDeliveryToken)) {
              return {
                id: 'l-miss',
                companyId: COMP_A,
                deliveryId: DELIV_1,
                tokenHash: hashTrackingToken(missingDeliveryToken),
                status: 'ACTIVE',
                expiresAt: null,
              }
            }
            return null
          },
          updateMany: async () => ({ count: 1 }),
        },
        delivery: {
          findFirst: async () => null,
        },
      }

      const badFormat = await resolvePublicTrackingByToken(mockDb, 'invalid-short')
      assert.equal(badFormat.ok, false)
      if (!badFormat.ok) assert.equal(badFormat.status, 404)

      const revokedRes = await resolvePublicTrackingByToken(mockDb, revokedToken)
      assert.equal(revokedRes.ok, false)
      if (!revokedRes.ok) {
        assert.equal(revokedRes.status, 404)
        assert.equal(revokedRes.reason, 'NOT_FOUND')
      }

      const expiredRes = await resolvePublicTrackingByToken(
        mockDb,
        expiredToken,
        new Date('2026-11-13T12:00:00Z')
      )
      assert.equal(expiredRes.ok, false)
      if (!expiredRes.ok) {
        assert.equal(expiredRes.status, 410)
        assert.equal(expiredRes.reason, 'EXPIRED')
      }

      const missingDelivRes = await resolvePublicTrackingByToken(mockDb, missingDeliveryToken)
      assert.equal(missingDelivRes.ok, false)
      if (!missingDelivRes.ok) assert.equal(missingDelivRes.status, 404)
    })
  })

  describe('Milestones, Progress Mapping & HTML Sanitization', () => {
    it('maps all DeliveryStatus values accurately including CANCELLED and DELIVERED', () => {
      const pending = derivePublicProgress('PENDING')
      assert.equal(pending.currentStepIndex, 0)
      assert.equal(pending.isCancelled, false)

      const delivered = derivePublicProgress('DELIVERED')
      assert.equal(delivered.isDelivered, true)
      assert.equal(
        delivered.steps.every((s) => s.state === 'COMPLETED'),
        true
      )

      const cancelled = derivePublicProgress('CANCELLED')
      assert.equal(cancelled.isCancelled, true)
      assert.equal(cancelled.currentStepIndex, -1)
    })

    it('excludes internal-only milestones from public timeline and deduplicates automatic events', () => {
      const milestones = buildPublicMilestones({
        deliveryStatus: 'IN_TRANSIT',
        deliveryCreatedAt: '2026-11-13T08:00:00Z',
        deliveryUpdatedAt: '2026-11-13T10:00:00Z',
        pickupAddress: 'Austin, TX',
        deliveryAddress: 'Dallas, TX',
        events: [
          {
            id: 'e1',
            eventType: 'DELIVERY_CREATED',
            title: 'Shipment Order Created',
            description: 'Custom created event',
            locationLabel: 'Austin, TX',
            occurredAt: '2026-11-13T08:00:00Z',
            customerVisible: true,
          },
          {
            id: 'e2',
            eventType: 'MANUAL_UPDATE',
            title: 'Secret Internal Note',
            description: 'Should never appear publicly',
            locationLabel: null,
            occurredAt: '2026-11-13T09:00:00Z',
            customerVisible: false,
          },
        ],
      })

      assert.equal(
        milestones.filter((m) => m.eventType === 'DELIVERY_CREATED').length,
        1
      )
      assert.equal(
        milestones.some((m) => m.title.includes('Secret Internal Note')),
        false
      )
    })

    it('validates and strips HTML from manual customer milestones', async () => {
      const mockDb = {
        delivery: {
          findFirst: async () => ({ id: DELIV_1, customerName: 'Acme' }),
        },
        deliveryTrackingEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'm-1',
            ...data,
            occurredAt: new Date('2026-11-13T12:00:00Z'),
          }),
        },
        activityEvent: {
          createMany: async () => ({ count: 1 }),
        },
      }

      const res = await addDeliveryTrackingMilestone(
        mockDb,
        COMP_A,
        DELIV_1,
        { userId: USER_1 },
        {
          eventType: 'ARRIVED_AT_DESTINATION',
          title: '<script>alert(1)</script>Arrived at Dallas Facility',
          description: '<b>Ready for final-mile handoff</b>',
          locationLabel: '<i>Dallas, TX</i>',
          customerVisible: true,
        }
      )

      assert.equal(res.ok, true)
      if (!res.ok) return
      assert.equal(res.data.title, 'alert(1)Arrived at Dallas Facility')
      assert.equal(res.data.description, 'Ready for final-mile handoff')
      assert.equal(res.data.locationLabel, 'Dallas, TX')
    })
  })
})
