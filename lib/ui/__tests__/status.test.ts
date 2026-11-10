import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStatusMeta,
  getAvailablePlanActions,
  getLifecycleStepIndex,
  getCapacityLevel,
  LIFECYCLE_STEPS,
} from '../status';

describe('LoadFlow Design System — Status & Lifecycle Presentation (lib/ui/status.ts)', () => {
  describe('getStatusMeta()', () => {
    it('returns semantic metadata for all LoadPlanStatus values', () => {
      assert.equal(getStatusMeta('loadPlan', 'DRAFT').tone, 'neutral');
      assert.equal(getStatusMeta('loadPlan', 'READY').tone, 'info');
      assert.equal(getStatusMeta('loadPlan', 'DISPATCHED').tone, 'primary');
      assert.equal(getStatusMeta('loadPlan', 'COMPLETED').tone, 'success');
    });

    it('returns semantic metadata for all DeliveryStatus values', () => {
      assert.equal(getStatusMeta('delivery', 'PENDING').tone, 'warning');
      assert.equal(getStatusMeta('delivery', 'ASSIGNED').tone, 'info');
      assert.equal(getStatusMeta('delivery', 'IN_TRANSIT').tone, 'primary');
      assert.equal(getStatusMeta('delivery', 'DELIVERED').tone, 'success');
      assert.equal(getStatusMeta('delivery', 'CANCELLED').tone, 'danger');
    });

    it('returns semantic metadata for all TruckStatus values', () => {
      assert.equal(getStatusMeta('truck', 'AVAILABLE').tone, 'success');
      assert.equal(getStatusMeta('truck', 'IN_USE').tone, 'primary');
      assert.equal(getStatusMeta('truck', 'MAINTENANCE').tone, 'warning');
    });

    it('returns semantic metadata for all DriverStatus values', () => {
      assert.equal(getStatusMeta('driver', 'AVAILABLE').tone, 'success');
      assert.equal(getStatusMeta('driver', 'ON_TRIP').tone, 'primary');
      assert.equal(getStatusMeta('driver', 'OFF_DUTY').tone, 'neutral');
    });

    it('gracefully handles unknown or null status strings without throwing', () => {
      const fallback = getStatusMeta('loadPlan', 'CUSTOM_STATUS');
      assert.equal(fallback.tone, 'neutral');
      assert.equal(fallback.label, 'CUSTOM STATUS');

      const empty = getStatusMeta('delivery', null);
      assert.equal(empty.label, 'Unknown');
    });
  });

  describe('getAvailablePlanActions() — Load Plan Lifecycle Integrity', () => {
    it('allows editing, marking ready, and deleting in DRAFT state', () => {
      const actions = getAvailablePlanActions('DRAFT');
      assert.equal(actions.canEdit, true);
      assert.equal(actions.canMarkReady, true);
      assert.equal(actions.canRevertToDraft, false);
      assert.equal(actions.canDispatch, false);
      assert.equal(actions.canComplete, false);
      assert.equal(actions.canDelete, true);
    });

    it('locks editing and allows dispatch, revert to draft, or delete in READY state', () => {
      const actions = getAvailablePlanActions('READY');
      assert.equal(actions.canEdit, false);
      assert.equal(actions.canMarkReady, false);
      assert.equal(actions.canRevertToDraft, true);
      assert.equal(actions.canDispatch, true);
      assert.equal(actions.canComplete, false);
      assert.equal(actions.canDelete, true);
    });

    it('only allows completing in DISPATCHED state (forbids delete and revert)', () => {
      const actions = getAvailablePlanActions('DISPATCHED');
      assert.equal(actions.canEdit, false);
      assert.equal(actions.canMarkReady, false);
      assert.equal(actions.canRevertToDraft, false);
      assert.equal(actions.canDispatch, false);
      assert.equal(actions.canComplete, true);
      assert.equal(actions.canDelete, false);
    });

    it('forbids all mutations in COMPLETED state', () => {
      const actions = getAvailablePlanActions('COMPLETED');
      assert.equal(actions.canEdit, false);
      assert.equal(actions.canMarkReady, false);
      assert.equal(actions.canRevertToDraft, false);
      assert.equal(actions.canDispatch, false);
      assert.equal(actions.canComplete, false);
      assert.equal(actions.canDelete, false);
    });
  });

  describe('getLifecycleStepIndex()', () => {
    it('maps each LoadPlanStatus to its ordered 0..3 step index', () => {
      assert.equal(LIFECYCLE_STEPS.length, 4);
      assert.equal(getLifecycleStepIndex('DRAFT'), 0);
      assert.equal(getLifecycleStepIndex('READY'), 1);
      assert.equal(getLifecycleStepIndex('DISPATCHED'), 2);
      assert.equal(getLifecycleStepIndex('COMPLETED'), 3);
      assert.equal(getLifecycleStepIndex('UNKNOWN'), 0);
    });
  });

  describe('getCapacityLevel()', () => {
    it('classifies low, medium, high, and overweight utilization thresholds accurately', () => {
      const low = getCapacityLevel(4000, 10000);
      assert.equal(low.level, 'low');
      assert.equal(low.rounded, 40);
      assert.equal(low.isOverweight, false);

      const medium = getCapacityLevel(7500, 10000);
      assert.equal(medium.level, 'medium');
      assert.equal(medium.rounded, 75);

      const high = getCapacityLevel(9200, 10000);
      assert.equal(high.level, 'high');
      assert.equal(high.rounded, 92);

      const over = getCapacityLevel(11500, 10000);
      assert.equal(over.level, 'over');
      assert.equal(over.rounded, 115);
      assert.equal(over.pct, 100);
      assert.equal(over.isOverweight, true);
    });

    it('handles zero or negative max capacity safely without NaN/Infinity', () => {
      const zero = getCapacityLevel(500, 0);
      assert.equal(zero.pct, 0);
      assert.equal(zero.rounded, 0);
      assert.equal(zero.level, 'low');
      assert.equal(zero.isOverweight, false);
    });
  });
});

