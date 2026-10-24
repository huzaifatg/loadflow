// ─── Load Plan Lifecycle Tests ──────────────────────────────────────────────
// Sprint 14: Unit tests for pure lifecycle state machine, delivery eligibility,
// release semantics, and dispatch preconditions.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransition,
  canTransition,
  isPlanEditable,
  isPlanDeletable,
  evaluateDeliveryEligibility,
  releasedDeliveryStatus,
  evaluateDispatchPreconditions,
  dispatchableDeliveries,
  ALLOWED_TRANSITIONS,
} from '../load-plan-lifecycle';

describe('Load Plan Lifecycle — State Machine', () => {
  it('allows valid state transitions', () => {
    assert.equal(canTransition('DRAFT', 'READY'), true);
    assert.equal(canTransition('READY', 'DRAFT'), true);
    assert.equal(canTransition('READY', 'DISPATCHED'), true);
    assert.equal(canTransition('DISPATCHED', 'COMPLETED'), true);
  });

  it('rejects invalid state transitions', () => {
    assert.equal(canTransition('DRAFT', 'DISPATCHED'), false);
    assert.equal(canTransition('DRAFT', 'COMPLETED'), false);
    assert.equal(canTransition('READY', 'COMPLETED'), false);
    assert.equal(canTransition('DISPATCHED', 'READY'), false);
    assert.equal(canTransition('DISPATCHED', 'DRAFT'), false);
    assert.equal(canTransition('COMPLETED', 'DRAFT'), false);
    assert.equal(canTransition('COMPLETED', 'READY'), false);
    assert.equal(canTransition('COMPLETED', 'DISPATCHED'), false);
    assert.equal(canTransition('COMPLETED', 'COMPLETED'), false);
  });

  it('rejects unknown or invalid status strings', () => {
    const invalidFrom = validateTransition('UNKNOWN', 'READY');
    assert.equal(invalidFrom.ok, false);
    assert.match(invalidFrom.error, /unknown status/i);

    const invalidTo = validateTransition('DRAFT', 'FLYING');
    assert.equal(invalidTo.ok, false);
    assert.match(invalidTo.error, /invalid status/i);
  });

  it('correctly reports editable and deletable plan statuses', () => {
    assert.equal(isPlanEditable('DRAFT'), true);
    assert.equal(isPlanEditable('READY'), false);
    assert.equal(isPlanEditable('DISPATCHED'), false);
    assert.equal(isPlanEditable('COMPLETED'), false);

    assert.equal(isPlanDeletable('DRAFT'), true);
    assert.equal(isPlanDeletable('READY'), true);
    assert.equal(isPlanDeletable('DISPATCHED'), false);
    assert.equal(isPlanDeletable('COMPLETED'), false);
  });
});

describe('Load Plan Lifecycle — Delivery Eligibility', () => {
  it('permits pending unallocated non-archived deliveries', () => {
    const res = evaluateDeliveryEligibility(
      { status: 'PENDING', isArchived: false, activePlanIds: [] },
      null,
    );
    assert.equal(res.eligible, true);
  });

  it('permits a delivery that is already an item of the same plan', () => {
    const res = evaluateDeliveryEligibility(
      { status: 'ASSIGNED', isArchived: false, activePlanIds: ['plan-1'] },
      'plan-1',
    );
    assert.equal(res.eligible, true);
  });

  it('rejects archived deliveries', () => {
    const res = evaluateDeliveryEligibility(
      { status: 'PENDING', isArchived: true, activePlanIds: [] },
      null,
    );
    assert.equal(res.eligible, false);
    assert.match(res.reason, /archived/i);
  });

  it('rejects deliveries in non-PENDING status when not already in plan', () => {
    for (const status of ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']) {
      const res = evaluateDeliveryEligibility(
        { status, isArchived: false, activePlanIds: [] },
        'plan-1',
      );
      assert.equal(res.eligible, false);
      assert.match(res.reason, /only PENDING deliveries/i);
    }
  });

  it('rejects deliveries already allocated to another active plan', () => {
    const res = evaluateDeliveryEligibility(
      { status: 'PENDING', isArchived: false, activePlanIds: ['plan-other'] },
      'plan-1',
    );
    assert.equal(res.eligible, false);
    assert.match(res.reason, /already allocated/i);
  });
});

describe('Load Plan Lifecycle — Release Semantics', () => {
  it('resets ASSIGNED deliveries to PENDING on release', () => {
    assert.equal(releasedDeliveryStatus('ASSIGNED'), 'PENDING');
  });

  it('leaves CANCELLED, IN_TRANSIT, and DELIVERED intact on release', () => {
    assert.equal(releasedDeliveryStatus('CANCELLED'), null);
    assert.equal(releasedDeliveryStatus('IN_TRANSIT'), null);
    assert.equal(releasedDeliveryStatus('DELIVERED'), null);
    assert.equal(releasedDeliveryStatus('PENDING'), null);
  });
});

describe('Load Plan Lifecycle — Dispatch Preconditions', () => {
  const validSnapshot = {
    planStatus: 'READY',
    truck: { status: 'AVAILABLE', isArchived: false, name: 'Truck 1' },
    driverId: 'driver-1',
    driver: { status: 'AVAILABLE', isArchived: false, name: 'Driver 1' },
    deliveries: [
      { id: 'del-1', customerName: 'Cust 1', status: 'ASSIGNED' },
      { id: 'del-2', customerName: 'Cust 2', status: 'ASSIGNED' },
    ],
  };

  it('passes when all preconditions are satisfied', () => {
    const reasons = evaluateDispatchPreconditions(validSnapshot);
    assert.deepEqual(reasons, []);
    assert.equal(dispatchableDeliveries(validSnapshot.deliveries).length, 2);
  });

  it('fails if plan is in DRAFT instead of READY', () => {
    const reasons = evaluateDispatchPreconditions({
      ...validSnapshot,
      planStatus: 'DRAFT',
    });
    assert.ok(reasons.length > 0);
    assert.match(reasons[0], /Cannot transition from DRAFT to DISPATCHED/);
  });

  it('fails if truck is missing or in maintenance or archived', () => {
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, truck: null }).some(r => /Truck not found/.test(r)));
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, truck: { status: 'MAINTENANCE', isArchived: false, name: 'Truck 1' } }).some(r => /maintenance/.test(r)));
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, truck: { status: 'AVAILABLE', isArchived: true, name: 'Truck 1' } }).some(r => /archived/.test(r)));
  });

  it('fails if driver is missing or off-duty or archived', () => {
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, driverId: null }).some(r => /driver must be assigned/.test(r)));
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, driver: null }).some(r => /driver not found/.test(r)));
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, driver: { status: 'OFF_DUTY', isArchived: false, name: 'Driver 1' } }).some(r => /off duty/.test(r)));
    assert.ok(evaluateDispatchPreconditions({ ...validSnapshot, driver: { status: 'AVAILABLE', isArchived: true, name: 'Driver 1' } }).some(r => /archived/.test(r)));
  });

  it('fails if plan has no dispatchable deliveries', () => {
    const reasons = evaluateDispatchPreconditions({
      ...validSnapshot,
      deliveries: [],
    });
    assert.ok(reasons.some(r => /no deliveries to dispatch/i.test(r)));
  });

  it('fails if non-assigned non-cancelled delivery is in plan', () => {
    const reasons = evaluateDispatchPreconditions({
      ...validSnapshot,
      deliveries: [
        { id: 'del-1', customerName: 'Cust 1', status: 'DELIVERED' },
      ],
    });
    assert.ok(reasons.some(r => /only ASSIGNED deliveries can be dispatched/i.test(r)));
  });

  it('ignores CANCELLED items in plan when other dispatchable items exist', () => {
    const reasons = evaluateDispatchPreconditions({
      ...validSnapshot,
      deliveries: [
        { id: 'del-1', customerName: 'Cust 1', status: 'ASSIGNED' },
        { id: 'del-cancelled', customerName: 'Cust C', status: 'CANCELLED' },
      ],
    });
    assert.deepEqual(reasons, []);
  });
});
