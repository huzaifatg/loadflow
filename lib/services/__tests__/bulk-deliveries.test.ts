import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeBulkDeliveries, type BulkDeliveryDb } from '../bulk-deliveries';

const COMPANY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPANY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const DEL_PENDING = '00000000-0000-4000-8000-000000000001';
const DEL_ASSIGNED = '00000000-0000-4000-8000-000000000002';
const DEL_IN_TRANSIT = '00000000-0000-4000-8000-000000000003';
const DEL_DELIVERED = '00000000-0000-4000-8000-000000000004';
const DEL_OTHER_CO = '00000000-0000-4000-8000-000000000005';

function makeMockBulkDb() {
  const deliveries = [
    {
      id: DEL_PENDING,
      companyId: COMPANY_A,
      customerName: 'Alpha Co',
      status: 'PENDING',
      isArchived: false,
      scheduledDate: null as Date | null,
      loadPlanItemsCount: 0,
    },
    {
      id: DEL_ASSIGNED,
      companyId: COMPANY_A,
      customerName: 'Beta Co',
      status: 'ASSIGNED',
      isArchived: false,
      scheduledDate: new Date('2026-11-12T00:00:00.000Z'),
      loadPlanItemsCount: 1,
    },
    {
      id: DEL_IN_TRANSIT,
      companyId: COMPANY_A,
      customerName: 'Gamma Co',
      status: 'IN_TRANSIT',
      isArchived: false,
      scheduledDate: new Date('2026-11-12T00:00:00.000Z'),
      loadPlanItemsCount: 1,
    },
    {
      id: DEL_DELIVERED,
      companyId: COMPANY_A,
      customerName: 'Delta Co',
      status: 'DELIVERED',
      isArchived: false,
      scheduledDate: new Date('2026-11-10T00:00:00.000Z'),
      loadPlanItemsCount: 0,
    },
    {
      id: DEL_OTHER_CO,
      companyId: COMPANY_B,
      customerName: 'Other Tenant',
      status: 'PENDING',
      isArchived: false,
      scheduledDate: null as Date | null,
      loadPlanItemsCount: 0,
    },
  ];
  const activities: any[] = [];

  const db: BulkDeliveryDb = {
    $transaction: async (fn) => {
      const tx = {
        delivery: {
          findMany: async ({ where }: any) => {
            return deliveries
              .filter(d => d.companyId === where.companyId && where.id.in.includes(d.id))
              .map(d => ({
                id: d.id,
                customerName: d.customerName,
                status: d.status,
                isArchived: d.isArchived,
                scheduledDate: d.scheduledDate,
                _count: { loadPlanItems: d.loadPlanItemsCount },
              }));
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const d of deliveries) {
              if (d.companyId === where.companyId && where.id.in.includes(d.id)) {
                Object.assign(d, data);
                count++;
              }
            }
            return { count };
          },
        },
        activityEvent: {
          createMany: async ({ data }: any) => {
            activities.push(...data);
            return { count: data.length };
          },
        },
      };
      return fn(tx);
    },
  };

  return { db, deliveries, activities };
}

describe('Bulk Deliveries Service (Sprint 16)', () => {
  it('archives unallocated deliveries and skips deliveries allocated to a load plan', async () => {
    const { db, deliveries, activities } = makeMockBulkDb();
    const res = await executeBulkDeliveries(
      db,
      COMPANY_A,
      { action: 'archive', deliveryIds: [DEL_PENDING, DEL_ASSIGNED, DEL_DELIVERED] },
      { userId: '11111111-1111-4111-8111-111111111111', label: 'ops@loadflow.io' },
    );
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.deepEqual(res.data.updatedIds.sort(), [DEL_PENDING, DEL_DELIVERED].sort());
      assert.equal(res.data.skipped.length, 1);
      assert.equal(res.data.skipped[0].id, DEL_ASSIGNED);
      assert.match(res.data.skipped[0].reason, /load plan/i);
    }
    assert.equal(deliveries.find(d => d.id === DEL_PENDING)!.isArchived, true);
    assert.equal(deliveries.find(d => d.id === DEL_ASSIGNED)!.isArchived, false);
    assert.equal(activities.length, 2);
    assert.ok(activities.every(a => a.type === 'DELIVERY_ARCHIVED'));
  });

  it('cancels PENDING and ASSIGNED deliveries while skipping IN_TRANSIT and DELIVERED', async () => {
    const { db, deliveries, activities } = makeMockBulkDb();
    const res = await executeBulkDeliveries(db, COMPANY_A, {
      action: 'cancel',
      deliveryIds: [DEL_PENDING, DEL_ASSIGNED, DEL_IN_TRANSIT, DEL_DELIVERED],
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.deepEqual(res.data.updatedIds.sort(), [DEL_PENDING, DEL_ASSIGNED].sort());
      assert.equal(res.data.skipped.length, 2);
    }
    assert.equal(deliveries.find(d => d.id === DEL_PENDING)!.status, 'CANCELLED');
    assert.equal(deliveries.find(d => d.id === DEL_IN_TRANSIT)!.status, 'IN_TRANSIT');
    assert.equal(activities.length, 2);
  });

  it('reschedules eligible deliveries and records activity events', async () => {
    const { db, deliveries, activities } = makeMockBulkDb();
    const res = await executeBulkDeliveries(db, COMPANY_A, {
      action: 'reschedule',
      deliveryIds: [DEL_PENDING, DEL_IN_TRANSIT],
      scheduledDate: '2026-11-20T00:00:00.000Z',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.deepEqual(res.data.updatedIds, [DEL_PENDING]);
      assert.equal(res.data.skipped.length, 1);
    }
    assert.equal(
      deliveries.find(d => d.id === DEL_PENDING)!.scheduledDate?.toISOString(),
      '2026-11-20T00:00:00.000Z',
    );
    assert.equal(activities[0].type, 'DELIVERY_RESCHEDULED');
  });

  it('rejects cross-company delivery IDs with 404 and makes no changes', async () => {
    const { db, deliveries, activities } = makeMockBulkDb();
    const res = await executeBulkDeliveries(db, COMPANY_A, {
      action: 'cancel',
      deliveryIds: [DEL_PENDING, DEL_OTHER_CO],
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 404);
    assert.equal(deliveries.find(d => d.id === DEL_PENDING)!.status, 'PENDING');
    assert.equal(activities.length, 0);
  });

  it('returns 409 when no selected deliveries are eligible for the action', async () => {
    const { db } = makeMockBulkDb();
    const res = await executeBulkDeliveries(db, COMPANY_A, {
      action: 'cancel',
      deliveryIds: [DEL_IN_TRANSIT, DEL_DELIVERED],
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.status, 409);
  });
});

