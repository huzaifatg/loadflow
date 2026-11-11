import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveExceptions,
  summarizeExceptions,
  exceptionsForEntity,
  type ExceptionSnapshot,
} from '../operational-exceptions';

const NOW = new Date(2026, 10, 11, 10, 0, 0); // Nov 11 2026, local
const day = (offset: number) => new Date(2026, 10, 11 + offset, 0, 0, 0);

const TRUCK = { id: 't1', name: 'Truck 1', status: 'AVAILABLE', isArchived: false, weightCapacity: 1000 };
const DRIVER = { id: 'd1', name: 'Dana', status: 'AVAILABLE', isArchived: false };

function plan(overrides: Partial<ExceptionSnapshot['plans'][number]> = {}): ExceptionSnapshot['plans'][number] {
  return {
    id: 'plan-000001',
    status: 'DRAFT',
    date: day(1),
    truck: TRUCK,
    driver: DRIVER,
    deliveries: [{ id: 'del1', customerName: 'Acme', status: 'ASSIGNED', weight: 200 }],
    ...overrides,
  };
}

const types = (snap: ExceptionSnapshot) => deriveExceptions(snap, NOW).map(e => e.type);

describe('Operational Exceptions — deriveExceptions (Sprint 16)', () => {
  it('returns no exceptions for a healthy future plan and empty queue', () => {
    assert.deepEqual(deriveExceptions({ plans: [plan()], pendingDeliveries: [] }, NOW), []);
  });

  it('flags missing driver as warning for future plans and critical when due today', () => {
    const future = deriveExceptions({ plans: [plan({ driver: null })], pendingDeliveries: [] }, NOW);
    assert.equal(future[0].type, 'PLAN_MISSING_DRIVER');
    assert.equal(future[0].severity, 'warning');
    const today = deriveExceptions({ plans: [plan({ driver: null, date: day(0) })], pendingDeliveries: [] }, NOW);
    assert.equal(today.find(e => e.type === 'PLAN_MISSING_DRIVER')!.severity, 'critical');
  });

  it('flags overdue undispatched plans and uncompleted dispatched plans', () => {
    assert.ok(types({ plans: [plan({ date: day(-1), status: 'READY' })], pendingDeliveries: [] }).includes('PLAN_OVERDUE_DISPATCH'));
    const dispatched = types({
      plans: [plan({ date: day(-2), status: 'DISPATCHED', deliveries: [{ id: 'x', customerName: 'X', status: 'IN_TRANSIT', weight: 1 }] })],
      pendingDeliveries: [],
    });
    assert.deepEqual(dispatched, ['PLAN_DISPATCH_OVERDUE_COMPLETION']);
  });

  it('flags trucks in maintenance and off-duty drivers on active plans as critical', () => {
    const list = deriveExceptions(
      { plans: [plan({ truck: { ...TRUCK, status: 'MAINTENANCE' }, driver: { ...DRIVER, status: 'OFF_DUTY' } })], pendingDeliveries: [] },
      NOW,
    );
    const t = list.map(e => e.type);
    assert.ok(t.includes('PLAN_TRUCK_UNAVAILABLE'));
    assert.ok(t.includes('PLAN_DRIVER_UNAVAILABLE'));
    assert.ok(list.every(e => e.severity === 'critical'));
  });

  it('flags over-capacity plans, ignoring cancelled deliveries in the load', () => {
    const over = plan({
      deliveries: [
        { id: 'a', customerName: 'A', status: 'ASSIGNED', weight: 800 },
        { id: 'b', customerName: 'B', status: 'ASSIGNED', weight: 300 },
      ],
    });
    assert.ok(types({ plans: [over], pendingDeliveries: [] }).includes('PLAN_OVER_CAPACITY'));
    const withCancelled = plan({
      deliveries: [
        { id: 'a', customerName: 'A', status: 'ASSIGNED', weight: 800 },
        { id: 'b', customerName: 'B', status: 'CANCELLED', weight: 900 },
      ],
    });
    const t = types({ plans: [withCancelled], pendingDeliveries: [] });
    assert.ok(!t.includes('PLAN_OVER_CAPACITY'));
    assert.ok(t.includes('PLAN_CANCELLED_ITEMS'));
  });

  it('flags non-dispatchable items and empty plans', () => {
    const invalid = plan({ deliveries: [{ id: 'a', customerName: 'A', status: 'DELIVERED', weight: 1 }] });
    const t = types({ plans: [invalid], pendingDeliveries: [] });
    assert.ok(t.includes('PLAN_INVALID_ITEMS'));
    assert.ok(t.includes('PLAN_EMPTY'));
    const readyEmpty = deriveExceptions({ plans: [plan({ status: 'READY', deliveries: [] })], pendingDeliveries: [] }, NOW);
    assert.equal(readyEmpty[0].severity, 'warning');
  });

  it('classifies pending deliveries as overdue, due soon, or aggregated queue', () => {
    const list = deriveExceptions(
      {
        plans: [],
        pendingDeliveries: [
          { id: 'p1', customerName: 'Late', scheduledDate: day(-3) },
          { id: 'p2', customerName: 'Today', scheduledDate: day(0) },
          { id: 'p3', customerName: 'Tomorrow', scheduledDate: day(1) },
          { id: 'p4', customerName: 'Later', scheduledDate: day(5) },
          { id: 'p5', customerName: 'Unscheduled', scheduledDate: null },
        ],
      },
      NOW,
    );
    assert.deepEqual(list.map(e => e.type), ['DELIVERY_OVERDUE', 'DELIVERY_DUE_SOON', 'DELIVERY_DUE_SOON', 'PENDING_QUEUE']);
    assert.match(list[3].description, /^2 pending/);
  });

  it('never duplicates an exception for the same condition and sorts by severity', () => {
    const list = deriveExceptions(
      { plans: [plan({ driver: null, date: day(-1) }), plan({ driver: null, date: day(-1) })], pendingDeliveries: [] },
      NOW,
    );
    const keys = list.map(e => e.key);
    assert.equal(new Set(keys).size, keys.length);
    const sev = list.map(e => e.severity);
    assert.deepEqual(sev, [...sev].sort((a, b) => ['critical', 'warning', 'info'].indexOf(a) - ['critical', 'warning', 'info'].indexOf(b)));
  });

  it('every exception has a navigation link and summary counts add up', () => {
    const list = deriveExceptions(
      { plans: [plan({ driver: null, truck: { ...TRUCK, status: 'MAINTENANCE' } })], pendingDeliveries: [{ id: 'p', customerName: 'P', scheduledDate: day(-1) }] },
      NOW,
    );
    assert.ok(list.every(e => e.entity.href.startsWith('/')));
    const s = summarizeExceptions(list);
    assert.equal(s.critical + s.warning + s.info, s.total);
    assert.equal(exceptionsForEntity(list, 't1').length, 2); // truck related to both plan exceptions
  });
});

