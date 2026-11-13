import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateTruckAvailability,
  evaluateDriverAvailability,
  getDispatchAvailability,
  parseOperatingDate,
  type RawTruckRecord,
  type RawDriverRecord,
  type RawActivePlanRecord,
} from '../dispatch-availability'
import {
  detectSchedulingConflicts,
  evaluatePlanDispatchReadiness,
  getDispatchConflicts,
  type ConflictPlanSnapshot,
} from '../dispatch-conflicts'
import {
  getDispatchBoardData,
  getDispatchCalendarData,
} from '../dispatch-board'

const COMPANY_A = '11111111-1111-4111-8111-111111111111'
const TRUCK_1 = '22222222-2222-4222-8222-222222222221'
const TRUCK_2 = '22222222-2222-4222-8222-222222222222'
const DRIVER_1 = '33333333-3333-4333-8333-333333333331'
const DRIVER_2 = '33333333-3333-4333-8333-333333333332'
const PLAN_1 = '44444444-4444-4444-8444-444444444441'
const PLAN_2 = '44444444-4444-4444-8444-444444444442'
const DEL_1 = '55555555-5555-4555-8555-555555555551'
const DEL_2 = '55555555-5555-4555-8555-555555555552'

const OP_DATE = parseOperatingDate('2026-11-13')
const NEXT_DATE = parseOperatingDate('2026-11-14')
const PAST_DATE = parseOperatingDate('2026-11-10')

describe('Sprint 18 — Resource Availability Intelligence', () => {
  const baseTruck: RawTruckRecord = {
    id: TRUCK_1,
    name: 'Freightliner #101',
    plateNumber: 'TX-101',
    type: 'Box Truck',
    weightCapacity: 5000,
    status: 'AVAILABLE',
    isArchived: false,
  }

  const baseDriver: RawDriverRecord = {
    id: DRIVER_1,
    name: 'Carlos Rivera',
    phone: '555-0101',
    licenseNumber: 'CDL-9910',
    status: 'AVAILABLE',
    isArchived: false,
  }

  it('marks an active truck with no conflicting plans as available and capacity compatible', () => {
    const res = evaluateTruckAvailability(baseTruck, [], OP_DATE, {
      requiredWeight: 3200,
    })
    assert.equal(res.active, true)
    assert.equal(res.available, true)
    assert.equal(res.capacityCompatible, true)
    assert.equal(res.eligibleForAssignment, true)
    assert.equal(res.remainingCapacityIfAssigned, 1800)
    assert.equal(res.conflictReason, null)
  })

  it('flags maintenance and archived trucks as unavailable', () => {
    const maint = evaluateTruckAvailability(
      { ...baseTruck, status: 'MAINTENANCE' },
      [],
      OP_DATE,
    )
    assert.equal(maint.active, false)
    assert.equal(maint.available, false)
    assert.equal(maint.eligibleForAssignment, false)
    assert.match(maint.conflictReason ?? '', /maintenance/i)

    const archived = evaluateTruckAvailability(
      { ...baseTruck, isArchived: true },
      [],
      OP_DATE,
    )
    assert.equal(archived.active, false)
    assert.equal(archived.available, false)
    assert.match(archived.conflictReason ?? '', /archived/i)
  })

  it('detects existing truck assignment on the same operating date and excludes self when editing', () => {
    const plans: RawActivePlanRecord[] = [
      {
        id: PLAN_1,
        truckId: TRUCK_1,
        driverId: DRIVER_1,
        status: 'READY',
        date: OP_DATE,
        truckName: baseTruck.name,
        driverName: baseDriver.name,
        deliveryCount: 3,
        totalWeight: 2400,
      },
    ]

    const blocked = evaluateTruckAvailability(baseTruck, plans, OP_DATE)
    assert.equal(blocked.available, false)
    assert.equal(blocked.eligibleForAssignment, false)
    assert.match(blocked.conflictReason ?? '', /already assigned/i)

    // When editing PLAN_1 itself, excludePlanId allows the truck to remain eligible
    const selfAllowed = evaluateTruckAvailability(baseTruck, plans, OP_DATE, {
      excludePlanId: PLAN_1,
    })
    assert.equal(selfAllowed.available, true)
    assert.equal(selfAllowed.eligibleForAssignment, true)
  })

  it('flags truck when requiredWeight exceeds weightCapacity', () => {
    const res = evaluateTruckAvailability(baseTruck, [], OP_DATE, {
      requiredWeight: 6500,
    })
    assert.equal(res.available, true)
    assert.equal(res.capacityCompatible, false)
    assert.equal(res.eligibleForAssignment, false)
    assert.equal(res.remainingCapacityIfAssigned, -1500)
    assert.match(res.conflictReason ?? '', /Capacity/i)
  })

  it('evaluates driver availability for active, off-duty, archived, and committed drivers', () => {
    const avail = evaluateDriverAvailability(baseDriver, [], OP_DATE)
    assert.equal(avail.active, true)
    assert.equal(avail.available, true)
    assert.equal(avail.eligibleForAssignment, true)

    const offDuty = evaluateDriverAvailability(
      { ...baseDriver, status: 'OFF_DUTY' },
      [],
      OP_DATE,
    )
    assert.equal(offDuty.active, false)
    assert.equal(offDuty.available, false)
    assert.match(offDuty.conflictReason ?? '', /off duty/i)

    const plans: RawActivePlanRecord[] = [
      {
        id: PLAN_1,
        truckId: TRUCK_1,
        driverId: DRIVER_1,
        status: 'DRAFT',
        date: OP_DATE,
        truckName: baseTruck.name,
        driverName: baseDriver.name,
        deliveryCount: 2,
        totalWeight: 1000,
      },
    ]
    const committed = evaluateDriverAvailability(baseDriver, plans, OP_DATE)
    assert.equal(committed.available, false)
    assert.match(committed.conflictReason ?? '', /already assigned/i)
  })

  it('enforces company isolation in getDispatchAvailability', async () => {
    let capturedTruckCompany: string | undefined
    let capturedDriverCompany: string | undefined
    let capturedPlanCompany: string | undefined

    const fakeDb = {
      truck: {
        findMany: async ({ where }: { where: { companyId: string } }) => {
          capturedTruckCompany = where.companyId
          return [baseTruck]
        },
      },
      driver: {
        findMany: async ({ where }: { where: { companyId: string } }) => {
          capturedDriverCompany = where.companyId
          return [baseDriver]
        },
      },
      loadPlan: {
        findMany: async ({ where }: { where: { companyId: string } }) => {
          capturedPlanCompany = where.companyId
          return []
        },
      },
    }

    const res = await getDispatchAvailability(
      fakeDb as unknown as Parameters<typeof getDispatchAvailability>[0],
      COMPANY_A,
      { date: '2026-11-13', requiredWeight: 1200 },
    )

    assert.equal(capturedTruckCompany, COMPANY_A)
    assert.equal(capturedDriverCompany, COMPANY_A)
    assert.equal(capturedPlanCompany, COMPANY_A)
    assert.equal(res.summary.availableTrucks, 1)
    assert.equal(res.summary.availableDrivers, 1)
  })
})

describe('Sprint 18 — Scheduling Conflict Detection & Dispatch Readiness', () => {
  function makePlan(overrides: Partial<ConflictPlanSnapshot> = {}): ConflictPlanSnapshot {
    return {
      id: PLAN_1,
      status: 'READY',
      date: OP_DATE,
      truckId: TRUCK_1,
      driverId: DRIVER_1,
      truck: {
        id: TRUCK_1,
        name: 'Truck Alpha',
        plateNumber: 'TX-100',
        weightCapacity: 4000,
        status: 'AVAILABLE',
        isArchived: false,
      },
      driver: {
        id: DRIVER_1,
        name: 'Driver One',
        status: 'AVAILABLE',
        isArchived: false,
      },
      deliveries: [
        {
          id: DEL_1,
          customerName: 'Acme Corp',
          status: 'ASSIGNED',
          weight: 1500,
          scheduledDate: OP_DATE,
        },
      ],
      ...overrides,
    }
  }

  it('evaluates a valid READY plan as READY_TO_DISPATCH with zero blocking reasons', () => {
    const plan = makePlan({ status: 'READY' })
    const readiness = evaluatePlanDispatchReadiness(plan, [plan], OP_DATE)
    assert.equal(readiness.readinessState, 'READY_TO_DISPATCH')
    assert.equal(readiness.canDispatch, true)
    assert.equal(readiness.blockingReasons.length, 0)
  })

  it('evaluates a valid DRAFT plan as READY_TO_LOCK with canMarkReady=true', () => {
    const plan = makePlan({ status: 'DRAFT' })
    const readiness = evaluatePlanDispatchReadiness(plan, [plan], OP_DATE)
    assert.equal(readiness.readinessState, 'READY_TO_LOCK')
    assert.equal(readiness.canMarkReady, true)
    assert.equal(readiness.canDispatch, false)
  })

  it('detects overlapping truck and driver assignments on the same date as BLOCKING conflicts', () => {
    const planA = makePlan({ id: PLAN_1, status: 'READY' })
    const planB = makePlan({ id: PLAN_2, status: 'DRAFT' })

    const conflicts = detectSchedulingConflicts([planA, planB], OP_DATE)
    const truckConflicts = conflicts.filter((c) => c.code === 'TRUCK_CONFLICT')
    const driverConflicts = conflicts.filter((c) => c.code === 'DRIVER_CONFLICT')

    assert.equal(truckConflicts.length, 2)
    assert.equal(driverConflicts.length, 2)
    assert.ok(truckConflicts.every((c) => c.severity === 'BLOCKING'))
    assert.ok(driverConflicts.every((c) => c.severity === 'BLOCKING'))

    const readinessA = evaluatePlanDispatchReadiness(planA, [planA, planB], OP_DATE)
    assert.equal(readinessA.readinessState, 'BLOCKED')
    assert.equal(readinessA.canDispatch, false)
    assert.equal(readinessA.checks.noResourceConflicts, false)
  })

  it('does not flag conflicts when two plans are on different dates or one is COMPLETED, and flags DELIVERY_DATE_MISMATCH as WARNING', () => {
    const planA = makePlan({ id: PLAN_1, status: 'READY', date: OP_DATE })
    const planB = makePlan({
      id: PLAN_2,
      status: 'DRAFT',
      date: NEXT_DATE,
      deliveries: [
        {
          id: DEL_2,
          customerName: 'Next Day Corp',
          status: 'ASSIGNED',
          weight: 1200,
          scheduledDate: NEXT_DATE,
        },
      ],
    })
    const planCompleted = makePlan({
      id: '44444444-4444-4444-8444-444444444443',
      status: 'COMPLETED',
      date: OP_DATE,
    })

    const conflicts = detectSchedulingConflicts([planA, planB, planCompleted], OP_DATE)
    assert.equal(conflicts.length, 0)

    // When delivery scheduledDate differs from plan date, flags a non-blocking WARNING
    const mismatchedPlan = makePlan({
      id: PLAN_2,
      status: 'DRAFT',
      date: NEXT_DATE,
      deliveries: [
        {
          id: DEL_2,
          customerName: 'Mismatched Date Corp',
          status: 'ASSIGNED',
          weight: 1200,
          scheduledDate: OP_DATE,
        },
      ],
    })
    const mismatchConflicts = detectSchedulingConflicts([mismatchedPlan], OP_DATE)
    assert.equal(mismatchConflicts.length, 1)
    assert.equal(mismatchConflicts[0].code, 'DELIVERY_DATE_MISMATCH')
    assert.equal(mismatchConflicts[0].severity, 'WARNING')
  })

  it('flags capacity violation, missing driver, empty load plan, invalid delivery, and cancelled delivery accurately', () => {
    // 1. Capacity exceeded
    const overweightPlan = makePlan({
      deliveries: [
        {
          id: DEL_1,
          customerName: 'Heavy Steel Co',
          status: 'ASSIGNED',
          weight: 5500,
          scheduledDate: OP_DATE,
        },
      ],
    })
    const capReadiness = evaluatePlanDispatchReadiness(
      overweightPlan,
      [overweightPlan],
      OP_DATE,
    )
    assert.equal(capReadiness.readinessState, 'BLOCKED')
    assert.equal(capReadiness.canDispatch, false)
    assert.equal(capReadiness.checks.capacityValid, false)
    assert.ok(capReadiness.blockingReasons.some((r) => /exceeds/i.test(r)))

    // 2. Missing driver
    const noDriverPlan = makePlan({
      status: 'DRAFT',
      driverId: null,
      driver: null,
    })
    const noDriverReadiness = evaluatePlanDispatchReadiness(
      noDriverPlan,
      [noDriverPlan],
      OP_DATE,
    )
    assert.equal(noDriverReadiness.readinessState, 'AWAITING_ASSIGNMENT')
    assert.equal(noDriverReadiness.canDispatch, false)
    assert.ok(noDriverReadiness.blockingReasons.some((r) => /Missing driver/i.test(r)))

    // 3. Empty load plan
    const emptyPlan = makePlan({ status: 'DRAFT', deliveries: [] })
    const emptyReadiness = evaluatePlanDispatchReadiness(
      emptyPlan,
      [emptyPlan],
      OP_DATE,
    )
    assert.equal(emptyReadiness.readinessState, 'AWAITING_ASSIGNMENT')
    assert.equal(emptyReadiness.canMarkReady, false)
    assert.equal(emptyReadiness.canDispatch, false)

    // 4. Invalid delivery status + cancelled delivery
    const mixedPlan = makePlan({
      deliveries: [
        {
          id: DEL_1,
          customerName: 'Valid Order',
          status: 'ASSIGNED',
          weight: 500,
          scheduledDate: OP_DATE,
        },
        {
          id: DEL_2,
          customerName: 'Already Delivered Order',
          status: 'DELIVERED',
          weight: 400,
          scheduledDate: OP_DATE,
        },
        {
          id: '55555555-5555-4555-8555-555555555553',
          customerName: 'Cancelled Order',
          status: 'CANCELLED',
          weight: 300,
          scheduledDate: OP_DATE,
        },
      ],
    })
    const mixedReadiness = evaluatePlanDispatchReadiness(
      mixedPlan,
      [mixedPlan],
      OP_DATE,
    )
    assert.equal(mixedReadiness.readinessState, 'BLOCKED')
    assert.equal(mixedReadiness.canDispatch, false)
    assert.equal(mixedReadiness.checks.deliveriesEligible, false)
    assert.equal(mixedReadiness.infoNotes.length, 1)

    // 5. Cancelled delivery alongside valid ASSIGNED delivery does not block dispatch
    const withCancelledOnly = makePlan({
      status: 'READY',
      deliveries: [
        {
          id: DEL_1,
          customerName: 'Valid Order',
          status: 'ASSIGNED',
          weight: 500,
          scheduledDate: OP_DATE,
        },
        {
          id: '55555555-5555-4555-8555-555555555553',
          customerName: 'Cancelled Order',
          status: 'CANCELLED',
          weight: 5000, // Cancelled weight is ignored
          scheduledDate: OP_DATE,
        },
      ],
    })
    const cancelledOk = evaluatePlanDispatchReadiness(
      withCancelledOnly,
      [withCancelledOnly],
      OP_DATE,
    )
    assert.equal(cancelledOk.readinessState, 'READY_TO_DISPATCH')
    assert.equal(cancelledOk.canDispatch, true)
  })
})

describe('Sprint 18 — Dispatch Board & Calendar Services', () => {
  const fakeDb = {
    truck: {
      findMany: async () => [
        {
          id: TRUCK_1,
          companyId: COMPANY_A,
          name: 'Volvo VNL #1',
          plateNumber: 'TX-500',
          type: 'Semi-Trailer',
          weightCapacity: 10000,
          status: 'AVAILABLE',
          isArchived: false,
        },
        {
          id: TRUCK_2,
          companyId: COMPANY_A,
          name: 'Isuzu NPR #2',
          plateNumber: 'TX-200',
          type: 'Box Truck',
          weightCapacity: 3000,
          status: 'MAINTENANCE',
          isArchived: false,
        },
      ],
    },
    driver: {
      findMany: async () => [
        {
          id: DRIVER_1,
          companyId: COMPANY_A,
          name: 'Elena Rostova',
          phone: '555-2020',
          licenseNumber: 'TX-CDL-1',
          status: 'AVAILABLE',
          isArchived: false,
        },
        {
          id: DRIVER_2,
          companyId: COMPANY_A,
          name: 'Marcus Vance',
          phone: '555-3030',
          licenseNumber: 'TX-CDL-2',
          status: 'OFF_DUTY',
          isArchived: false,
        },
      ],
    },
    delivery: {
      findMany: async () => [
        {
          id: DEL_1,
          companyId: COMPANY_A,
          customerName: 'Overdue Customer',
          pickupAddress: 'Dallas Hub',
          deliveryAddress: 'Austin Depot',
          weight: 850,
          status: 'PENDING',
          scheduledDate: PAST_DATE,
          createdAt: PAST_DATE,
          notes: null,
          externalId: 'ORD-901',
          sourceReference: null,
          items: [],
          _count: { items: 2 },
          loadPlanItems: [],
        },
        {
          id: DEL_2,
          companyId: COMPANY_A,
          customerName: 'Today Customer',
          pickupAddress: 'Houston Port',
          deliveryAddress: 'San Antonio Retail',
          weight: 1200,
          status: 'PENDING',
          scheduledDate: OP_DATE,
          createdAt: OP_DATE,
          notes: null,
          externalId: null,
          sourceReference: null,
          items: [],
          _count: { items: 1 },
          loadPlanItems: [],
        },
      ],
      groupBy: async () => [{ status: 'PENDING', _count: { _all: 2 } }],
    },
    loadPlan: {
      findMany: async () => [
        {
          id: PLAN_1,
          companyId: COMPANY_A,
          truckId: TRUCK_1,
          driverId: DRIVER_1,
          status: 'READY',
          date: OP_DATE,
          notes: 'Morning express route',
          truck: {
            id: TRUCK_1,
            name: 'Volvo VNL #1',
            plateNumber: 'TX-500',
            type: 'Semi-Trailer',
            weightCapacity: 10000,
            status: 'AVAILABLE',
            isArchived: false,
          },
          driver: {
            id: DRIVER_1,
            name: 'Elena Rostova',
            phone: '555-2020',
            licenseNumber: 'TX-CDL-1',
            status: 'AVAILABLE',
            isArchived: false,
          },
          items: [
            {
              delivery: {
                id: '55555555-5555-4555-8555-555555555599',
                companyId: COMPANY_A,
                customerName: 'Allocated Client',
                pickupAddress: 'Warehouse A',
                deliveryAddress: 'Store B',
                weight: 2500,
                status: 'ASSIGNED',
                scheduledDate: OP_DATE,
              },
            },
          ],
        },
      ],
    },
  }

  it('aggregates Dispatch Board metrics, unassigned queue urgency, and grouped load plans', async () => {
    const board = await getDispatchBoardData(
      fakeDb as unknown as Parameters<typeof getDispatchBoardData>[0],
      COMPANY_A,
      { date: '2026-11-13' },
      OP_DATE,
    )

    assert.equal(board.operatingDate, '2026-11-13')
    assert.equal(board.summary.pendingDeliveries, 2)
    assert.equal(board.summary.unassignedDeliveries, 2)
    assert.equal(board.summary.overdueDeliveries, 1)
    assert.equal(board.summary.dueTodayDeliveries, 1)
    assert.equal(board.summary.readyLoadPlans, 1)
    assert.equal(board.summary.availableTrucks, 0) // TRUCK_1 is committed on OP_DATE, TRUCK_2 is in MAINTENANCE
    assert.equal(board.summary.availableDrivers, 0) // DRIVER_1 is committed on OP_DATE, DRIVER_2 is OFF_DUTY

    // Overdue delivery is sorted first in the unassigned queue
    assert.equal(board.unassignedQueue[0].id, DEL_1)
    assert.equal(board.unassignedQueue[0].urgency, 'OVERDUE')
    assert.equal(board.unassignedQueue[0].reference, 'ORD-901')
    assert.equal(board.unassignedQueue[1].id, DEL_2)
    assert.equal(board.unassignedQueue[1].urgency, 'DUE_TODAY')

    // Grouped READY plan has READY_TO_DISPATCH readiness
    assert.equal(board.groupedPlans.READY.length, 1)
    assert.equal(
      board.groupedPlans.READY[0].readiness.readinessState,
      'READY_TO_DISPATCH',
    )
  })

  it('filters Dispatch Board by overdue state and search query', async () => {
    const filtered = await getDispatchBoardData(
      fakeDb as unknown as Parameters<typeof getDispatchBoardData>[0],
      COMPANY_A,
      { date: '2026-11-13', overdue: 'OVERDUE_ONLY', q: 'Overdue' },
      OP_DATE,
    )

    assert.equal(filtered.unassignedQueue.length, 1)
    assert.equal(filtered.unassignedQueue[0].customerName, 'Overdue Customer')
  })

  it('computes 7-day Dispatch Calendar with selected day and readiness state', async () => {
    const cal = await getDispatchCalendarData(
      fakeDb as unknown as Parameters<typeof getDispatchCalendarData>[0],
      COMPANY_A,
      { date: '2026-11-13' },
      OP_DATE,
    )

    assert.equal(cal.days.length, 7)
    const selected = cal.days.find((d) => d.date === '2026-11-13')
    assert.ok(selected)
    assert.equal(selected.isSelected, true)
    assert.equal(selected.plans.length, 1)
    assert.equal(selected.plans[0].readiness.readinessState, 'READY_TO_DISPATCH')
  })

  it('returns company-scoped conflicts and readiness map from getDispatchConflicts', async () => {
    const res = await getDispatchConflicts(
      fakeDb as unknown as Parameters<typeof getDispatchConflicts>[0],
      COMPANY_A,
      { date: '2026-11-13' },
    )
    assert.equal(res.summary.blocking, 0)
    assert.ok(res.readinessByPlan[PLAN_1])
    assert.equal(res.readinessByPlan[PLAN_1].canDispatch, true)
  })
})
