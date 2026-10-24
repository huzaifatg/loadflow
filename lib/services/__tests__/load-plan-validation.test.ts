// ─── Load Plan Validation — Tenant Scoping Tests ────────────────────────────
// Sprint 14 P0: validateCapacity / getDeliveryDateWarnings must never read
// another company's trucks or deliveries.
//
// These tests exercise the PRODUCTION functions against a minimal in-memory
// Prisma stand-in that honours the `where` filters it receives. Every call's
// arguments are also recorded so we can assert companyId scoping directly.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCapacity,
  getDeliveryDateWarnings,
  validateDeliveryEligibility,
  type PrismaClient,
} from '../load-plan-validation';

const COMPANY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPANY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const TRUCK_A = '00000000-0000-4000-8000-0000000000a1';
const TRUCK_B = '00000000-0000-4000-8000-0000000000b1';
const DEL_A1 = '00000000-0000-4000-8000-00000000a001';
const DEL_A2 = '00000000-0000-4000-8000-00000000a002';
const DEL_A3 = '00000000-0000-4000-8000-00000000a003';
const DEL_A_DELIVERED = '00000000-0000-4000-8000-00000000a004';
const DEL_A_IN_PLAN = '00000000-0000-4000-8000-00000000a005';
const DEL_B1 = '00000000-0000-4000-8000-00000000b001';

const PLAN_DATE = new Date('2026-10-20T00:00:00.000Z');
const OTHER_DATE = new Date('2026-10-25T00:00:00.000Z');

const trucks = [
  { id: TRUCK_A, companyId: COMPANY_A, weightCapacity: 1000 },
  { id: TRUCK_B, companyId: COMPANY_B, weightCapacity: 50000 },
];
const deliveries = [
  { id: DEL_A1, companyId: COMPANY_A, weight: 300, customerName: 'A One', scheduledDate: PLAN_DATE, status: 'PENDING', isArchived: false, loadPlanItems: [] },
  { id: DEL_A2, companyId: COMPANY_A, weight: 400, customerName: 'A Two', scheduledDate: OTHER_DATE, status: 'PENDING', isArchived: false, loadPlanItems: [] },
  { id: DEL_A3, companyId: COMPANY_A, weight: 800, customerName: 'A Three', scheduledDate: PLAN_DATE, status: 'PENDING', isArchived: false, loadPlanItems: [] },
  { id: DEL_A_DELIVERED, companyId: COMPANY_A, weight: 100, customerName: 'A Delivered', scheduledDate: PLAN_DATE, status: 'DELIVERED', isArchived: false, loadPlanItems: [] },
  {
    id: DEL_A_IN_PLAN,
    companyId: COMPANY_A,
    weight: 200,
    customerName: 'A In Plan',
    scheduledDate: PLAN_DATE,
    status: 'ASSIGNED',
    isArchived: false,
    loadPlanItems: [
      { loadPlanId: 'plan-existing', loadPlan: { status: 'READY' } },
    ],
  },
  // Light enough that excluding it would NOT trip capacity; heavy enough to matter if counted.
  { id: DEL_B1, companyId: COMPANY_B, weight: 200, customerName: 'B One', scheduledDate: OTHER_DATE, status: 'PENDING', isArchived: false, loadPlanItems: [] },
];

type Where = { id?: string | { in: string[] }; companyId?: string };
const calls: { model: string; where: Where }[] = [];

function matches(row: { id: string; companyId: string }, where: Where): boolean {
  if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (where.id && typeof where.id === 'object' && !where.id.in.includes(row.id)) return false;
  return true;
}

const fakeTx = {
  truck: {
    findFirst: async ({ where }: { where: Where }) => {
      calls.push({ model: 'truck.findFirst', where });
      return trucks.find(t => matches(t, where)) ?? null;
    },
    findUnique: async ({ where }: { where: Where }) => {
      calls.push({ model: 'truck.findUnique', where });
      return trucks.find(t => matches(t, where)) ?? null;
    },
  },
  delivery: {
    findMany: async ({ where }: { where: Where }) => {
      calls.push({ model: 'delivery.findMany', where });
      return deliveries.filter(d => matches(d, where));
    },
  },
} as unknown as PrismaClient;

beforeEach(() => {
  calls.length = 0;
});

describe('Load Plan Validation — tenant scoping (Sprint 14 P0)', () => {
  describe('validateCapacity', () => {
    it('accepts own-company truck and deliveries within capacity', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [DEL_A1, DEL_A2], COMPANY_A);
      assert.equal(r.valid, true);
      assert.equal(r.totalWeight, 700);
      assert.equal(r.truckCapacity, 1000);
      assert.equal(r.notFound, undefined);
    });

    it('rejects a delivery belonging to another company (not silently ignored)', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [DEL_A1, DEL_B1], COMPANY_A);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
      assert.equal(r.error?.field, 'items');
    });

    it('rejects when ALL deliveries belong to another company', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [DEL_B1], COMPANY_A);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
    });

    it('rejects a truck belonging to another company', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_B, [DEL_A1], COMPANY_A);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
      assert.equal(r.error?.field, 'truckId');
    });

    it('rejects an unknown delivery ID', async () => {
      const r = await validateCapacity(
        fakeTx, TRUCK_A, [DEL_A1, '00000000-0000-4000-8000-00000000ffff'], COMPANY_A,
      );
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
    });

    it('tolerates duplicate own-company IDs (weight counted once, as before)', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [DEL_A1, DEL_A1], COMPANY_A);
      assert.equal(r.valid, true);
      assert.equal(r.totalWeight, 300);
    });

    it('still enforces capacity overflow for own-company deliveries', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [DEL_A2, DEL_A3], COMPANY_A);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, undefined);
      assert.equal(r.totalWeight, 1200);
      assert.equal(r.error?.field, 'items');
      // Company B's large truck cannot be borrowed by company A
      const borrowed = await validateCapacity(fakeTx, TRUCK_B, [DEL_A2, DEL_A3], COMPANY_A);
      assert.equal(borrowed.valid, false);
      assert.equal(borrowed.notFound, true);
    });

    it('scopes every truck and delivery query by companyId', async () => {
      await validateCapacity(fakeTx, TRUCK_A, [DEL_A1], COMPANY_A);
      assert.ok(calls.length >= 2);
      for (const c of calls) {
        assert.equal(c.where.companyId, COMPANY_A, `${c.model} must be company-scoped`);
      }
    });

    it('returns valid with no queries for an empty delivery list', async () => {
      const r = await validateCapacity(fakeTx, TRUCK_A, [], COMPANY_A);
      assert.equal(r.valid, true);
      assert.equal(calls.length, 0);
    });
  });

  describe('getDeliveryDateWarnings', () => {
    it('warns for own-company date mismatches', async () => {
      const w = await getDeliveryDateWarnings(fakeTx, [DEL_A1, DEL_A2], PLAN_DATE, COMPANY_A);
      assert.equal(w.length, 1);
      assert.equal(w[0].deliveryId, DEL_A2);
    });

    it('never reads or leaks another company\'s delivery data', async () => {
      const w = await getDeliveryDateWarnings(fakeTx, [DEL_A1, DEL_B1], PLAN_DATE, COMPANY_A);
      assert.equal(w.some(x => x.deliveryId === DEL_B1), false);
      assert.equal(w.some(x => x.customerName === 'B One'), false);
      assert.equal(calls[0].where.companyId, COMPANY_A);
    });
  });

  describe('validateDeliveryEligibility', () => {
    it('accepts pending, unallocated, non-archived own-company deliveries', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A1, DEL_A2], null);
      assert.equal(r.valid, true);
      assert.deepEqual(r.ineligible, []);
    });

    it('returns notFound when delivery belongs to another company', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A1, DEL_B1], null);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
    });

    it('returns notFound when delivery ID does not exist', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, ['00000000-0000-4000-8000-00000000ffff'], null);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, true);
    });

    it('rejects delivery in non-PENDING status', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A_DELIVERED], null);
      assert.equal(r.valid, false);
      assert.equal(r.notFound, undefined);
      assert.equal(r.ineligible.length, 1);
      assert.match(r.ineligible[0].reason, /DELIVERED/);
    });

    it('rejects delivery already allocated to another active plan', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A_IN_PLAN], 'plan-other');
      assert.equal(r.valid, false);
      assert.equal(r.ineligible.length, 1);
      assert.match(r.ineligible[0].reason, /already allocated/);
    });

    it('allows delivery already allocated to the SAME plan to remain', async () => {
      const r = await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A_IN_PLAN], 'plan-existing');
      assert.equal(r.valid, true);
    });

    it('scopes queries by companyId', async () => {
      await validateDeliveryEligibility(fakeTx, COMPANY_A, [DEL_A1], null);
      assert.equal(calls[0].where.companyId, COMPANY_A);
    });
  });
});

