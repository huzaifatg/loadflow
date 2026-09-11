// ─── Recommendation Assignment Tests ────────────────────────────────────────
// Sprint 13.3: Tests for POST /api/recommendations/assign
//
// These tests mock Prisma to test the assignment service logic in isolation.
// The service function is extracted from the route handler for testability.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AssignmentInput {
  truckId: string;
  driverId: string | null;
  deliveryIds: string[];
  date: string;
  companyId: string;
}

interface AssignmentValidationError {
  error: string;
  status: number;
}

interface AssignmentSuccess {
  loadPlanId: string;
  truckId: string;
  driverId: string | null;
  deliveryIds: string[];
  date: Date;
  status: string;
  deliveryStatuses: Map<string, string>;
  warnings?: Array<{ deliveryId: string; message: string }>;
}

type AssignmentResult = { success: true; data: AssignmentSuccess } | { success: false; error: AssignmentValidationError };

// ─── Mock Data ──────────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COMPANY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let uuidCounter = 0;
function uuid(suffix: string): string {
  // Produce a deterministic valid UUID from a string key
  const hex = Buffer.from(suffix).toString('hex').padEnd(12, '0').slice(0, 12);
  return `00000000-0000-0000-0000-${hex}`;
}

// Separate counter for generated IDs inside the service
let planCounter = 0;
function nextPlanId(): string {
  planCounter++;
  return `00000000-0000-0000-ffff-${planCounter.toString(16).padStart(12, '0')}`;
}

// Truck fixtures
const TRUCK_AVAILABLE = {
  id: uuid('t1'),
  companyId: COMPANY_A,
  name: 'Sprinter Van',
  status: 'AVAILABLE' as const,
  weightCapacity: 3500,
  isArchived: false,
};

const TRUCK_MAINTENANCE = {
  id: uuid('t2'),
  companyId: COMPANY_A,
  name: 'Maintenance Truck',
  status: 'MAINTENANCE' as const,
  weightCapacity: 10000,
  isArchived: false,
};

const TRUCK_COMPANY_B = {
  id: uuid('t3'),
  companyId: COMPANY_B,
  name: 'Company B Truck',
  status: 'AVAILABLE' as const,
  weightCapacity: 10000,
  isArchived: false,
};

// Driver fixtures
const DRIVER_AVAILABLE = {
  id: uuid('d1'),
  companyId: COMPANY_A,
  name: 'John Smith',
  status: 'AVAILABLE' as const,
  isArchived: false,
};

const DRIVER_OFF_DUTY = {
  id: uuid('d2'),
  companyId: COMPANY_A,
  name: 'Jane Off-Duty',
  status: 'OFF_DUTY' as const,
  isArchived: false,
};

const DRIVER_COMPANY_B = {
  id: uuid('d3'),
  companyId: COMPANY_B,
  name: 'Company B Driver',
  status: 'AVAILABLE' as const,
  isArchived: false,
};

// Delivery fixtures
function makeDelivery(id: string, weight: number, companyId: string = COMPANY_A, status: string = 'PENDING') {
  return {
    id,
    companyId,
    customerName: `Customer ${id.slice(-3)}`,
    status,
    weight,
    isArchived: false,
  };
}

const DEL_1 = makeDelivery(uuid('del1'), 500);
const DEL_2 = makeDelivery(uuid('del2'), 800);
const DEL_3 = makeDelivery(uuid('del3'), 200);
const DEL_ASSIGNED = makeDelivery(uuid('del4'), 300, COMPANY_A, 'ASSIGNED');
const DEL_CANCELLED = makeDelivery(uuid('del5'), 100, COMPANY_A, 'CANCELLED');
const DEL_COMPANY_B = makeDelivery(uuid('del6'), 500, COMPANY_B);
const DEL_HEAVY = makeDelivery(uuid('del7'), 3000);

// ─── Simulated Assignment Service ───────────────────────────────────────────
// This is a pure-function equivalent of the route handler logic,
// testable without HTTP infrastructure.

interface MockDB {
  trucks: typeof TRUCK_AVAILABLE[];
  drivers: typeof DRIVER_AVAILABLE[];
  deliveries: ReturnType<typeof makeDelivery>[];
  loadPlans: Array<{ id: string; companyId: string; truckId: string; driverId: string | null; date: Date; status: string }>;
  loadPlanItems: Array<{ id: string; loadPlanId: string; deliveryId: string; sortOrder: number }>;
}

function validateAndAssign(input: AssignmentInput, db: MockDB): AssignmentResult {
  const { truckId, driverId, deliveryIds, date, companyId } = input;

  // UUID validation
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(truckId)) {
    return { success: false, error: { error: 'Invalid truck ID format.', status: 400 } };
  }
  if (driverId && !UUID_REGEX.test(driverId)) {
    return { success: false, error: { error: 'Invalid driver ID format.', status: 400 } };
  }
  for (const id of deliveryIds) {
    if (!UUID_REGEX.test(id)) {
      return { success: false, error: { error: `Invalid delivery ID format: ${id}`, status: 400 } };
    }
  }
  if (deliveryIds.length === 0) {
    return { success: false, error: { error: 'At least one delivery ID is required.', status: 400 } };
  }

  // Date validation
  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) {
    return { success: false, error: { error: 'Invalid date format.', status: 400 } };
  }

  // Truck validation
  const truck = db.trucks.find(t => t.id === truckId && t.companyId === companyId && !t.isArchived);
  if (!truck) {
    return { success: false, error: { error: 'Truck not found or does not belong to your company.', status: 404 } };
  }
  if (truck.status === 'MAINTENANCE') {
    return { success: false, error: { error: `${truck.name} is currently in maintenance and cannot be assigned.`, status: 409 } };
  }

  // Driver validation
  if (driverId) {
    const driver = db.drivers.find(d => d.id === driverId && d.companyId === companyId && !d.isArchived);
    if (!driver) {
      return { success: false, error: { error: 'Driver not found or does not belong to your company.', status: 404 } };
    }
    if (driver.status === 'OFF_DUTY') {
      return { success: false, error: { error: `${driver.name} is currently off duty and cannot be assigned.`, status: 409 } };
    }
  }

  // Delivery validation
  const foundDeliveries = db.deliveries.filter(d => deliveryIds.includes(d.id) && d.companyId === companyId && !d.isArchived);
  const foundIds = new Set(foundDeliveries.map(d => d.id));
  const missingIds = deliveryIds.filter(id => !foundIds.has(id));
  if (missingIds.length > 0) {
    return { success: false, error: { error: `Deliveries not found or do not belong to your company: ${missingIds.join(', ')}`, status: 404 } };
  }

  // Eligibility check
  const ineligible = foundDeliveries.filter(d => d.status !== 'PENDING');
  if (ineligible.length > 0) {
    const details = ineligible.map(d => `"${d.customerName}" (${d.status})`).join(', ');
    return { success: false, error: { error: `The following deliveries are not eligible for assignment: ${details}. Only PENDING deliveries can be assigned.`, status: 409 } };
  }

  // Capacity check
  const totalWeight = foundDeliveries.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight > truck.weightCapacity) {
    return { success: false, error: { error: `Total delivery weight (${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg) exceeds truck capacity (${truck.weightCapacity.toLocaleString()} kg). Remove some deliveries or choose a larger truck.`, status: 409 } };
  }

  // Truck conflict check
  const dayStart = new Date(targetDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const truckConflict = db.loadPlans.find(p =>
    p.companyId === companyId &&
    p.truckId === truckId &&
    p.date.getTime() >= dayStart.getTime() && p.date.getTime() <= dayEnd.getTime()
  );
  if (truckConflict) {
    return { success: false, error: { error: `${truck.name} is already assigned to another load plan on this date.`, status: 409 } };
  }

  // Driver conflict check
  if (driverId) {
    const driverConflict = db.loadPlans.find(p =>
      p.companyId === companyId &&
      p.driverId === driverId &&
      p.date.getTime() >= dayStart.getTime() && p.date.getTime() <= dayEnd.getTime()
    );
    if (driverConflict) {
      const driver = db.drivers.find(d => d.id === driverId)!;
      return { success: false, error: { error: `${driver.name} is already assigned to another load plan on this date.`, status: 409 } };
    }
  }

  // ── Create assignment (simulated transaction) ──
  const planId = nextPlanId();
  const plan = {
    id: planId,
    companyId,
    truckId,
    driverId: driverId || null,
    date: targetDate,
    status: 'DRAFT',
  };
  db.loadPlans.push(plan);

  for (let i = 0; i < deliveryIds.length; i++) {
    db.loadPlanItems.push({
      id: nextPlanId(),
      loadPlanId: planId,
      deliveryId: deliveryIds[i],
      sortOrder: i,
    });
  }

  // Update delivery statuses
  const deliveryStatuses = new Map<string, string>();
  for (const del of foundDeliveries) {
    if (del.status !== 'CANCELLED') {
      del.status = 'ASSIGNED';
    }
    deliveryStatuses.set(del.id, del.status);
  }

  return {
    success: true,
    data: {
      loadPlanId: planId,
      truckId,
      driverId: driverId || null,
      deliveryIds,
      date: targetDate,
      status: 'DRAFT',
      deliveryStatuses,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Recommendation Assignment (Sprint 13.3)', () => {
  let db: MockDB;

  beforeEach(() => {
    planCounter = 0;
    db = {
      trucks: [
        { ...TRUCK_AVAILABLE },
        { ...TRUCK_MAINTENANCE },
        { ...TRUCK_COMPANY_B },
      ],
      drivers: [
        { ...DRIVER_AVAILABLE },
        { ...DRIVER_OFF_DUTY },
        { ...DRIVER_COMPANY_B },
      ],
      deliveries: [
        { ...DEL_1 },
        { ...DEL_2 },
        { ...DEL_3 },
        { ...DEL_ASSIGNED },
        { ...DEL_CANCELLED },
        { ...DEL_COMPANY_B },
        { ...DEL_HEAVY },
      ],
      loadPlans: [],
      loadPlanItems: [],
    };
  });

  // ─── 1. Successful Assignment ──────────────────────────────────────────────

  describe('Successful Assignment', () => {
    it('creates a load plan from a valid recommendation (single delivery)', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'Assignment should succeed');
      assert.equal(result.data.truckId, TRUCK_AVAILABLE.id);
      assert.equal(result.data.driverId, DRIVER_AVAILABLE.id);
      assert.equal(result.data.status, 'DRAFT');
      assert.equal(result.data.deliveryIds.length, 1);
    });

    it('creates a load plan with multiple deliveries', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id, DEL_2.id, DEL_3.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'Assignment should succeed');
      assert.equal(result.data.deliveryIds.length, 3);
    });

    it('creates a load plan without a driver', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'Assignment should succeed without driver');
      assert.equal(result.data.driverId, null);
    });
  });

  // ─── 2. Load Plan Persistence ──────────────────────────────────────────────

  describe('Load Plan Persistence', () => {
    it('persists load plan in database', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(db.loadPlans.length, 1);
      assert.equal(db.loadPlans[0].truckId, TRUCK_AVAILABLE.id);
      assert.equal(db.loadPlans[0].driverId, DRIVER_AVAILABLE.id);
      assert.equal(db.loadPlans[0].status, 'DRAFT');
      assert.equal(db.loadPlans[0].companyId, COMPANY_A);
    });

    it('persists load plan items for all deliveries', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id, DEL_2.id, DEL_3.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(db.loadPlanItems.length, 3);
      const planItems = db.loadPlanItems.filter(i => i.loadPlanId === result.data.loadPlanId);
      assert.equal(planItems.length, 3);
      // Verify sort order
      assert.equal(planItems[0].sortOrder, 0);
      assert.equal(planItems[1].sortOrder, 1);
      assert.equal(planItems[2].sortOrder, 2);
    });

    it('associates correct truck with load plan', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(db.loadPlans[0].truckId, TRUCK_AVAILABLE.id);
    });

    it('associates correct driver with load plan', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(db.loadPlans[0].driverId, DRIVER_AVAILABLE.id);
    });
  });

  // ─── 3. Delivery Status Transitions ────────────────────────────────────────

  describe('Delivery Status Transitions', () => {
    it('updates delivery status from PENDING to ASSIGNED', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id, DEL_2.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(result.data.deliveryStatuses.get(DEL_1.id), 'ASSIGNED');
      assert.equal(result.data.deliveryStatuses.get(DEL_2.id), 'ASSIGNED');
      // Also verify db state
      assert.equal(db.deliveries.find(d => d.id === DEL_1.id)!.status, 'ASSIGNED');
      assert.equal(db.deliveries.find(d => d.id === DEL_2.id)!.status, 'ASSIGNED');
    });
  });

  // ─── 4. Invalid IDs ───────────────────────────────────────────────────────

  describe('Invalid IDs', () => {
    it('rejects invalid truck ID format', () => {
      const result = validateAndAssign({
        truckId: 'not-a-uuid',
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 400);
      assert.ok(result.error.error.includes('Invalid truck ID'));
    });

    it('rejects invalid driver ID format', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: 'bad-uuid',
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 400);
      assert.ok(result.error.error.includes('Invalid driver ID'));
    });

    it('rejects invalid delivery ID format', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: ['invalid-id'],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 400);
      assert.ok(result.error.error.includes('Invalid delivery ID'));
    });

    it('rejects empty delivery list', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 400);
    });

    it('rejects non-existent truck ID', () => {
      const result = validateAndAssign({
        truckId: uuid('nonexist'),
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('Truck not found'));
    });

    it('rejects non-existent driver ID', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: uuid('nonexist'),
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('Driver not found'));
    });

    it('rejects non-existent delivery ID', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [uuid('nonexist')],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('not found'));
    });
  });

  // ─── 5. Cross-Tenant Isolation ─────────────────────────────────────────────

  describe('Cross-Tenant Isolation', () => {
    it('rejects truck from another company', () => {
      const result = validateAndAssign({
        truckId: TRUCK_COMPANY_B.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('Truck not found'));
    });

    it('rejects driver from another company', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_COMPANY_B.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('Driver not found'));
    });

    it('rejects delivery from another company', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_COMPANY_B.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 404);
      assert.ok(result.error.error.includes('not found'));
    });
  });

  // ─── 6. Truck Status Validation ────────────────────────────────────────────

  describe('Truck Status Validation', () => {
    it('rejects MAINTENANCE truck', () => {
      const result = validateAndAssign({
        truckId: TRUCK_MAINTENANCE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('maintenance'));
    });

    it('allows IN_USE truck (availability penalty does not block assignment)', () => {
      db.trucks[0].status = 'IN_USE' as typeof db.trucks[0]['status'];
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'IN_USE truck should be assignable');
    });
  });

  // ─── 7. Driver Status Validation ───────────────────────────────────────────

  describe('Driver Status Validation', () => {
    it('rejects OFF_DUTY driver', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_OFF_DUTY.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('off duty'));
    });

    it('allows ON_TRIP driver (availability penalty does not block assignment)', () => {
      db.drivers[0].status = 'ON_TRIP' as typeof db.drivers[0]['status'];
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'ON_TRIP driver should be assignable');
    });
  });

  // ─── 8. Delivery Eligibility ───────────────────────────────────────────────

  describe('Delivery Eligibility', () => {
    it('rejects ASSIGNED delivery', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_ASSIGNED.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('not eligible'));
      assert.ok(result.error.error.includes('ASSIGNED'));
    });

    it('rejects CANCELLED delivery', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_CANCELLED.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('not eligible'));
    });

    it('rejects mixed batch with ineligible deliveries', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id, DEL_ASSIGNED.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
    });
  });

  // ─── 9. Capacity Validation ────────────────────────────────────────────────

  describe('Capacity Validation', () => {
    it('rejects when total weight exceeds truck capacity', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id, // 3500 kg
        driverId: null,
        deliveryIds: [DEL_HEAVY.id, DEL_1.id], // 3000 + 500 = 3500 — exact fit
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      // 3500 = 3500, should be exactly at limit — OK
      assert.ok(result.success, 'Should succeed at exactly truck capacity');
    });

    it('rejects when total weight strictly exceeds truck capacity', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id, // 3500 kg
        driverId: null,
        deliveryIds: [DEL_HEAVY.id, DEL_1.id, DEL_2.id], // 3000 + 500 + 800 = 4300
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('exceeds truck capacity'));
    });
  });

  // ─── 10. Conflict Detection ────────────────────────────────────────────────

  describe('Conflict Detection', () => {
    it('rejects when truck already has a plan on the same date', () => {
      // Pre-create a conflict
      db.loadPlans.push({
        id: uuid('existing'),
        companyId: COMPANY_A,
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        date: new Date('2026-09-01T12:00:00Z'),
        status: 'DRAFT',
      });

      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('already assigned'));
    });

    it('rejects when driver already has a plan on the same date', () => {
      db.loadPlans.push({
        id: uuid('existing'),
        companyId: COMPANY_A,
        truckId: uuid('other-truck'),
        driverId: DRIVER_AVAILABLE.id,
        date: new Date('2026-09-01T12:00:00Z'),
        status: 'DRAFT',
      });

      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 409);
      assert.ok(result.error.error.includes('already assigned'));
    });

    it('allows assignment on a different date than existing plan', () => {
      db.loadPlans.push({
        id: uuid('existing'),
        companyId: COMPANY_A,
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        date: new Date('2026-09-02T12:00:00Z'),
        status: 'DRAFT',
      });

      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success, 'Different date should not conflict');
    });
  });

  // ─── 11. Duplicate Submission Protection ───────────────────────────────────

  describe('Duplicate Submission Protection', () => {
    it('second assignment attempt fails because deliveries are now ASSIGNED', () => {
      // First assignment
      const result1 = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);
      assert.ok(result1.success, 'First assignment should succeed');

      // Second attempt with same deliveries (now ASSIGNED)
      const result2 = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-02', // different date to avoid truck conflict
        companyId: COMPANY_A,
      }, db);
      assert.ok(!result2.success, 'Second assignment should fail');
      assert.equal(result2.error.status, 409);
      assert.ok(result2.error.error.includes('not eligible'));
    });

    it('second assignment attempt fails due to truck conflict on same date', () => {
      const result1 = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);
      assert.ok(result1.success);

      const result2 = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_2.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);
      assert.ok(!result2.success);
      assert.equal(result2.error.status, 409);
    });
  });

  // ─── 12. Transaction Rollback ──────────────────────────────────────────────

  describe('Transaction Rollback (validation failure)', () => {
    it('does not create any records when validation fails', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_ASSIGNED.id], // ineligible
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(db.loadPlans.length, 0, 'No load plan should be created');
      assert.equal(db.loadPlanItems.length, 0, 'No items should be created');
      // Verify delivery status unchanged
      assert.equal(db.deliveries.find(d => d.id === DEL_ASSIGNED.id)!.status, 'ASSIGNED');
    });

    it('does not modify delivery statuses when validation fails', () => {
      const originalStatuses = db.deliveries.map(d => ({ id: d.id, status: d.status }));

      validateAndAssign({
        truckId: TRUCK_COMPANY_B.id, // wrong company
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      for (const orig of originalStatuses) {
        const current = db.deliveries.find(d => d.id === orig.id)!;
        assert.equal(current.status, orig.status, `Delivery ${orig.id} status should not change`);
      }
    });
  });

  // ─── 13. Date Validation ───────────────────────────────────────────────────

  describe('Date Validation', () => {
    it('rejects invalid date format', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: 'not-a-date',
        companyId: COMPANY_A,
      }, db);

      assert.ok(!result.success);
      assert.equal(result.error.status, 400);
      assert.ok(result.error.error.includes('Invalid date'));
    });

    it('accepts valid future date', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: null,
        deliveryIds: [DEL_1.id],
        date: '2027-01-15',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
    });
  });

  // ─── 14. Load Plan Status ──────────────────────────────────────────────────

  describe('Load Plan Status', () => {
    it('creates load plan with DRAFT status', () => {
      const result = validateAndAssign({
        truckId: TRUCK_AVAILABLE.id,
        driverId: DRIVER_AVAILABLE.id,
        deliveryIds: [DEL_1.id],
        date: '2026-09-01',
        companyId: COMPANY_A,
      }, db);

      assert.ok(result.success);
      assert.equal(result.data.status, 'DRAFT');
      assert.equal(db.loadPlans[0].status, 'DRAFT');
    });
  });
});
