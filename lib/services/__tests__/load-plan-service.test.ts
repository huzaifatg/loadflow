// ─── Load Plan Service Integration Tests ────────────────────────────────────
// Sprint 14: Comprehensive tests for the database-backed load-plan-service.
// Exercises createLoadPlan, updateLoadPlan, and deleteLoadPlan with a high-fidelity
// in-memory Prisma store that simulates tables, transactions, rollbacks, and company scoping.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLoadPlan,
  updateLoadPlan,
  deleteLoadPlan,
  type LoadPlanDb,
} from '../load-plan-service';

const COMPANY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPANY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const TRUCK_A1 = '00000000-0000-4000-8000-0000000000a1';
const TRUCK_A_MAINT = '00000000-0000-4000-8000-0000000000a2';
const TRUCK_B1 = '00000000-0000-4000-8000-0000000000b1';

const DRIVER_A1 = '00000000-0000-4000-8000-000000000da1';
const DRIVER_A_OFF = '00000000-0000-4000-8000-000000000da2';
const DRIVER_B1 = '00000000-0000-4000-8000-000000000db1';

const DEL_A1 = '00000000-0000-4000-8000-00000000a001';
const DEL_A2 = '00000000-0000-4000-8000-00000000a002';
const DEL_A_CANCELLED = '00000000-0000-4000-8000-00000000a003';
const DEL_A_DELIVERED = '00000000-0000-4000-8000-00000000a004';
const DEL_B1 = '00000000-0000-4000-8000-00000000b001';

const PLAN_A1 = '00000000-0000-4000-8000-000000000001';
const PLAN_B1 = '00000000-0000-4000-8000-000000000002';

const DATE_STR = '2026-11-01T00:00:00.000Z';

function createMockDb() {
  let trucks = [
    { id: TRUCK_A1, companyId: COMPANY_A, name: 'Truck A1', status: 'AVAILABLE', weightCapacity: 2000, isArchived: false },
    { id: TRUCK_A_MAINT, companyId: COMPANY_A, name: 'Truck A Maint', status: 'MAINTENANCE', weightCapacity: 2000, isArchived: false },
    { id: TRUCK_B1, companyId: COMPANY_B, name: 'Truck B1', status: 'AVAILABLE', weightCapacity: 5000, isArchived: false },
  ];

  let drivers = [
    { id: DRIVER_A1, companyId: COMPANY_A, name: 'Driver A1', status: 'AVAILABLE', isArchived: false },
    { id: DRIVER_A_OFF, companyId: COMPANY_A, name: 'Driver A Off', status: 'OFF_DUTY', isArchived: false },
    { id: DRIVER_B1, companyId: COMPANY_B, name: 'Driver B1', status: 'AVAILABLE', isArchived: false },
  ];

  let deliveries = [
    { id: DEL_A1, companyId: COMPANY_A, customerName: 'Cust A1', weight: 500, status: 'PENDING', isArchived: false, scheduledDate: new Date(DATE_STR) },
    { id: DEL_A2, companyId: COMPANY_A, customerName: 'Cust A2', weight: 600, status: 'PENDING', isArchived: false, scheduledDate: new Date(DATE_STR) },
    { id: DEL_A_CANCELLED, companyId: COMPANY_A, customerName: 'Cust Cancelled', weight: 100, status: 'CANCELLED', isArchived: false, scheduledDate: new Date(DATE_STR) },
    { id: DEL_A_DELIVERED, companyId: COMPANY_A, customerName: 'Cust Delivered', weight: 100, status: 'DELIVERED', isArchived: false, scheduledDate: new Date(DATE_STR) },
    { id: DEL_B1, companyId: COMPANY_B, customerName: 'Cust B1', weight: 500, status: 'PENDING', isArchived: false, scheduledDate: new Date(DATE_STR) },
  ];

  let plans: any[] = [
    { id: PLAN_A1, companyId: COMPANY_A, truckId: TRUCK_A1, driverId: null, date: new Date('2026-10-15T00:00:00.000Z'), status: 'DRAFT', notes: 'Initial plan' },
    { id: PLAN_B1, companyId: COMPANY_B, truckId: TRUCK_B1, driverId: null, date: new Date('2026-10-15T00:00:00.000Z'), status: 'DRAFT', notes: 'Company B plan' },
  ];

  let planItems: any[] = [];

  function cloneState() {
    return {
      trucks: JSON.parse(JSON.stringify(trucks)),
      drivers: JSON.parse(JSON.stringify(drivers)),
      deliveries: deliveries.map(d => ({ ...d, scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : null })),
      plans: plans.map(p => ({ ...p, date: new Date(p.date) })),
      planItems: JSON.parse(JSON.stringify(planItems)),
    };
  }

  function restoreState(s: any) {
    trucks = s.trucks;
    drivers = s.drivers;
    deliveries = s.deliveries;
    plans = s.plans;
    planItems = s.planItems;
  }

  const db: LoadPlanDb = {
    $transaction: async (fn: any) => {
      const snapshot = cloneState();
      const tx = {
        truck: {
          findFirst: async ({ where }: any) => {
            return trucks.find(t =>
              (where.id === undefined || t.id === where.id) &&
              (where.companyId === undefined || t.companyId === where.companyId) &&
              (where.isArchived === undefined || t.isArchived === where.isArchived)
            ) ?? null;
          },
          findUnique: async ({ where }: any) => {
            return trucks.find(t => t.id === where.id) ?? null;
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const t of trucks) {
              if ((where.id === undefined || t.id === where.id) &&
                  (where.companyId === undefined || t.companyId === where.companyId) &&
                  (where.status === undefined || t.status === where.status)) {
                Object.assign(t, data);
                count++;
              }
            }
            return { count };
          },
        },
        driver: {
          findFirst: async ({ where }: any) => {
            return drivers.find(d =>
              (where.id === undefined || d.id === where.id) &&
              (where.companyId === undefined || d.companyId === where.companyId) &&
              (where.isArchived === undefined || d.isArchived === where.isArchived)
            ) ?? null;
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const d of drivers) {
              if ((where.id === undefined || d.id === where.id) &&
                  (where.companyId === undefined || d.companyId === where.companyId) &&
                  (where.status === undefined || d.status === where.status)) {
                Object.assign(d, data);
                count++;
              }
            }
            return { count };
          },
        },
        delivery: {
          findMany: async ({ where, select }: any) => {
            const matches = deliveries.filter(d => {
              if (where.companyId !== undefined && d.companyId !== where.companyId) return false;
              if (where.id?.in && !where.id.in.includes(d.id)) return false;
              if (where.id && typeof where.id === 'string' && d.id !== where.id) return false;
              if (where.isArchived !== undefined && d.isArchived !== where.isArchived) return false;
              return true;
            });
            return matches.map(d => {
              const res: any = { ...d };
              if (select?.loadPlanItems) {
                res.loadPlanItems = planItems
                  .filter(pi => pi.deliveryId === d.id)
                  .map(pi => {
                    const pl = plans.find(p => p.id === pi.loadPlanId);
                    return {
                      loadPlanId: pi.loadPlanId,
                      loadPlan: { status: pl?.status ?? 'DRAFT' },
                    };
                  });
              }
              return res;
            });
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const d of deliveries) {
              const idMatches = where.id?.in ? where.id.in.includes(d.id) : (where.id ? d.id === where.id : true);
              const companyMatches = where.companyId === undefined || d.companyId === where.companyId;
              const statusMatches = where.status === undefined || (where.status?.not ? d.status !== where.status.not : d.status === where.status);
              if (idMatches && companyMatches && statusMatches) {
                Object.assign(d, data);
                count++;
              }
            }
            return { count };
          },
        },
        loadPlan: {
          findFirst: async ({ where, include, select }: any) => {
            const p = plans.find(pl => {
              if (where.id !== undefined) {
                if (typeof where.id === 'object' && where.id.not !== undefined) {
                  if (pl.id === where.id.not) return false;
                } else if (pl.id !== where.id) {
                  return false;
                }
              }
              if (where.companyId !== undefined && pl.companyId !== where.companyId) return false;
              if (where.truckId !== undefined && pl.truckId !== where.truckId) return false;
              if (where.driverId !== undefined && pl.driverId !== where.driverId) return false;
              if (where.date !== undefined) {
                const planTime = new Date(pl.date).getTime();
                if (where.date.gte && planTime < new Date(where.date.gte).getTime()) return false;
                if (where.date.lte && planTime > new Date(where.date.lte).getTime()) return false;
              }
              return true;
            });
            if (!p) return null;
            const res: any = { ...p };
            if (include?.items) {
              res.items = planItems.filter(pi => pi.loadPlanId === p.id);
            }
            if (include?.truck || select?.truck) {
              res.truck = trucks.find(t => t.id === p.truckId) ?? null;
            }
            if (include?.driver || select?.driver) {
              res.driver = drivers.find(d => d.id === p.driverId) ?? null;
            }
            return res;
          },
          create: async ({ data, include }: any) => {
            const newPlan = { id: `plan-${Date.now()}-${Math.random()}`, ...data };
            plans.push(newPlan);
            const res: any = { ...newPlan };
            if (include?.truck) res.truck = trucks.find(t => t.id === newPlan.truckId);
            if (include?.driver) res.driver = drivers.find(d => d.id === newPlan.driverId) ?? null;
            return res;
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const p of plans) {
              if ((where.id === undefined || p.id === where.id) &&
                  (where.companyId === undefined || p.companyId === where.companyId) &&
                  (where.status === undefined || p.status === where.status)) {
                Object.assign(p, data);
                count++;
              }
            }
            return { count };
          },
          deleteMany: async ({ where }: any) => {
            const before = plans.length;
            plans = plans.filter(p =>
              !(where.id === p.id && where.companyId === p.companyId && (where.status === undefined || p.status === where.status))
            );
            return { count: before - plans.length };
          },
        },
        loadPlanItem: {
          deleteMany: async ({ where }: any) => {
            const before = planItems.length;
            planItems = planItems.filter(pi => pi.loadPlanId !== where.loadPlanId);
            return { count: before - planItems.length };
          },
          createMany: async ({ data }: any) => {
            planItems.push(...data);
            return { count: data.length };
          },
        },
      };

      try {
        return await fn(tx);
      } catch (err) {
        restoreState(snapshot);
        throw err;
      }
    },
  };

  return {
    db,
    getState: () => ({ trucks, drivers, deliveries, plans, planItems }),
    seedItems: (items: any[]) => { planItems.push(...items); },
  };
}

describe('Load Plan Service — createLoadPlan', () => {
  it('creates a draft load plan without driver', async () => {
    const mock = createMockDb();
    const res = await createLoadPlan(mock.db, COMPANY_A, {
      truckId: TRUCK_A1,
      date: DATE_STR,
      notes: 'Test draft',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.data.status, 'DRAFT');
      assert.equal(res.data.truckId, TRUCK_A1);
      assert.equal(res.data.driverId, null);
    }
  });

  it('rejects cross-company truck with 404', async () => {
    const mock = createMockDb();
    const res = await createLoadPlan(mock.db, COMPANY_A, {
      truckId: TRUCK_B1,
      date: DATE_STR,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
  });

  it('rejects cross-company driver with 404', async () => {
    const mock = createMockDb();
    const res = await createLoadPlan(mock.db, COMPANY_A, {
      truckId: TRUCK_A1,
      driverId: DRIVER_B1,
      date: DATE_STR,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
  });

  it('rejects truck in MAINTENANCE with 409', async () => {
    const mock = createMockDb();
    const res = await createLoadPlan(mock.db, COMPANY_A, {
      truckId: TRUCK_A_MAINT,
      date: DATE_STR,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.match(res.error, /maintenance/i);
    }
  });

  it('rejects driver in OFF_DUTY with 409', async () => {
    const mock = createMockDb();
    const res = await createLoadPlan(mock.db, COMPANY_A, {
      truckId: TRUCK_A1,
      driverId: DRIVER_A_OFF,
      date: DATE_STR,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.match(res.error, /off duty/i);
    }
  });
});

describe('Load Plan Service — updateLoadPlan edits and eligibility', () => {
  it('rejects cross-company plan edit with 404', async () => {
    const mock = createMockDb();
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_B1, {
      items: [DEL_A1],
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
  });

  it('assigns eligible pending deliveries to DRAFT plan', async () => {
    const mock = createMockDb();
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, {
      items: [DEL_A1, DEL_A2],
    });
    assert.equal(res.ok, true);
    const state = mock.getState();
    const d1 = state.deliveries.find(d => d.id === DEL_A1);
    const d2 = state.deliveries.find(d => d.id === DEL_A2);
    assert.equal(d1?.status, 'ASSIGNED');
    assert.equal(d2?.status, 'ASSIGNED');
  });

  it('rejects cross-company delivery assignment with 404', async () => {
    const mock = createMockDb();
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, {
      items: [DEL_A1, DEL_B1],
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
  });

  it('rejects assignment of DELIVERED or non-PENDING delivery with 409', async () => {
    const mock = createMockDb();
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, {
      items: [DEL_A_DELIVERED],
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.match(res.error, /DELIVERED/);
    }
  });

  it('releases ASSIGNED delivery to PENDING when removed from plan', async () => {
    const mock = createMockDb();
    // Initially allocate DEL_A1 and DEL_A2
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1, DEL_A2] });

    // Now remove DEL_A2
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1] });
    assert.equal(res.ok, true);

    const state = mock.getState();
    const d1 = state.deliveries.find(d => d.id === DEL_A1);
    const d2 = state.deliveries.find(d => d.id === DEL_A2);
    assert.equal(d1?.status, 'ASSIGNED');
    assert.equal(d2?.status, 'PENDING');
  });

  it('does NOT reset CANCELLED delivery to PENDING on removal', async () => {
    const mock = createMockDb();
    // Seed DEL_A_CANCELLED into the plan items
    mock.seedItems([{ loadPlanId: PLAN_A1, deliveryId: DEL_A_CANCELLED, sortOrder: 0 }]);

    // Update plan with empty items, removing DEL_A_CANCELLED
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [] });
    assert.equal(res.ok, true);

    const state = mock.getState();
    const dCancelled = state.deliveries.find(d => d.id === DEL_A_CANCELLED);
    assert.equal(dCancelled?.status, 'CANCELLED');
  });

  it('rejects editing items or truck on a READY plan', async () => {
    const mock = createMockDb();
    // Transition to READY
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });

    // Attempt to edit items
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1] });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 400);
      assert.match(res.error, /Cannot modify a load plan that is READY/);
    }
  });

  it('allows reverting READY to DRAFT and then editing', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    const revertRes = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DRAFT' });
    assert.equal(revertRes.ok, true);

    const editRes = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1] });
    assert.equal(editRes.ok, true);
  });
});

describe('Load Plan Service — dispatch preconditions and execution', () => {
  it('rejects dispatching an empty plan', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.match(res.error, /no deliveries to dispatch/i);
    }
  });

  it('rejects dispatch without an assigned driver', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1] });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.match(res.error, /driver must be assigned/i);
    }
  });

  it('successfully dispatches a valid ready plan', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1], driverId: DRIVER_A1 });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });

    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });
    assert.equal(res.ok, true);

    const state = mock.getState();
    const plan = state.plans.find(p => p.id === PLAN_A1);
    const del = state.deliveries.find(d => d.id === DEL_A1);
    const truck = state.trucks.find(t => t.id === TRUCK_A1);
    const driver = state.drivers.find(d => d.id === DRIVER_A1);

    assert.equal(plan?.status, 'DISPATCHED');
    assert.equal(del?.status, 'IN_TRANSIT');
    assert.equal(truck?.status, 'IN_USE');
    assert.equal(driver?.status, 'ON_TRIP');
  });

  it('rejects DISPATCHED -> READY rollback', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1], driverId: DRIVER_A1 });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });

    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 400);
      assert.match(res.error, /Cannot transition from DISPATCHED to READY/);
    }
  });

  it('completes a dispatched plan and frees resources', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1], driverId: DRIVER_A1 });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });

    const res = await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'COMPLETED' });
    assert.equal(res.ok, true);

    const state = mock.getState();
    const plan = state.plans.find(p => p.id === PLAN_A1);
    const del = state.deliveries.find(d => d.id === DEL_A1);
    const truck = state.trucks.find(t => t.id === TRUCK_A1);
    const driver = state.drivers.find(d => d.id === DRIVER_A1);

    assert.equal(plan?.status, 'COMPLETED');
    assert.equal(del?.status, 'DELIVERED');
    assert.equal(truck?.status, 'AVAILABLE');
    assert.equal(driver?.status, 'AVAILABLE');
  });
});

describe('Load Plan Service — deleteLoadPlan', () => {
  it('deletes draft plan and releases ASSIGNED deliveries', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1] });

    const res = await deleteLoadPlan(mock.db, COMPANY_A, PLAN_A1);
    assert.equal(res.ok, true);

    const state = mock.getState();
    const plan = state.plans.find(p => p.id === PLAN_A1);
    const del = state.deliveries.find(d => d.id === DEL_A1);
    assert.equal(plan, undefined);
    assert.equal(del?.status, 'PENDING');
  });

  it('does NOT reset CANCELLED deliveries when plan is deleted', async () => {
    const mock = createMockDb();
    mock.seedItems([{ loadPlanId: PLAN_A1, deliveryId: DEL_A_CANCELLED, sortOrder: 0 }]);

    const res = await deleteLoadPlan(mock.db, COMPANY_A, PLAN_A1);
    assert.equal(res.ok, true);

    const state = mock.getState();
    const del = state.deliveries.find(d => d.id === DEL_A_CANCELLED);
    assert.equal(del?.status, 'CANCELLED');
  });

  it('rejects deleting a DISPATCHED or COMPLETED plan with 400', async () => {
    const mock = createMockDb();
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { items: [DEL_A1], driverId: DRIVER_A1 });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'READY' });
    await updateLoadPlan(mock.db, COMPANY_A, PLAN_A1, { status: 'DISPATCHED' });

    const res = await deleteLoadPlan(mock.db, COMPANY_A, PLAN_A1);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 400);
      assert.match(res.error, /Cannot delete a load plan that is DISPATCHED/);
    }
  });

  it('rejects deleting a cross-company plan with 404', async () => {
    const mock = createMockDb();
    const res = await deleteLoadPlan(mock.db, COMPANY_A, PLAN_B1);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
  });
});
