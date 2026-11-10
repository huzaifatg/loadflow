'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Truck,
  Flag,
  Trash2,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getAvailablePlanActions } from '@/lib/ui/status';

export interface LoadPlanActionsProps {
  loadPlanId: string;
  currentStatus: string;
  hasDriver?: boolean;
  deliveryCount?: number;
  isOverCapacity?: boolean;
}

type PendingTransition =
  | null
  | 'READY'
  | 'DRAFT'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'DELETE';

export function LoadPlanActions({
  loadPlanId,
  currentStatus,
  hasDriver = true,
  deliveryCount = 0,
  isOverCapacity = false,
}: LoadPlanActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingTransition>(null);

  const available = getAvailablePlanActions(currentStatus);

  async function updateStatus(newStatus: string) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Load plan transitioned to ${newStatus}`);
        setPendingAction(null);
        router.refresh();
      } else {
        const errData = await res.json().catch(() => null);
        const detail =
          Array.isArray(errData?.reasons) && errData.reasons.length > 0
            ? `${errData.error}: ${errData.reasons.join(' ')}`
            : errData?.error || 'Failed to update status';
        toast.error(detail);
        setPendingAction(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating load plan status');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Load plan deleted and assigned deliveries released');
        setPendingAction(null);
        router.push('/loads');
        router.refresh();
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Failed to delete plan');
        setPendingAction(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error deleting load plan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Mark Ready Confirmation */}
      <ConfirmDialog
        isOpen={pendingAction === 'READY'}
        onClose={() => setPendingAction(null)}
        onConfirm={() => updateStatus('READY')}
        loading={loading}
        tone="primary"
        title="Lock Plan & Mark as Ready?"
        description="Marking this load plan as READY locks delivery allocation and prepares the vehicle for dispatch."
        consequences={[
          'Delivery assignments and stop order will be locked against edits.',
          'Assigned deliveries remain reserved for this truck.',
          'You can still revert to DRAFT if changes are needed before dispatch.',
        ]}
        confirmLabel="Mark as Ready"
      />

      {/* Revert to Draft Confirmation */}
      <ConfirmDialog
        isOpen={pendingAction === 'DRAFT'}
        onClose={() => setPendingAction(null)}
        onConfirm={() => updateStatus('DRAFT')}
        loading={loading}
        tone="warning"
        title="Revert Load Plan to Draft?"
        description="Reverting to DRAFT unlocks this load plan so you can add, remove, or reorder deliveries and change assigned resources."
        consequences={[
          'Plan status returns to DRAFT.',
          'Delivery allocation and driver assignment become editable again.',
        ]}
        confirmLabel="Revert to Draft"
      />

      {/* Dispatch Confirmation */}
      <ConfirmDialog
        isOpen={pendingAction === 'DISPATCHED'}
        onClose={() => setPendingAction(null)}
        onConfirm={() => updateStatus('DISPATCHED')}
        loading={loading}
        tone="primary"
        title="Dispatch Truck & Begin Transit?"
        description="Dispatching this load plan commits the vehicle and driver to active transit."
        consequences={[
          'Load plan transitions to DISPATCHED (cannot be deleted or reverted to DRAFT).',
          `All ${deliveryCount} assigned deliveries transition to IN_TRANSIT.`,
          'Assigned truck status becomes IN_USE and driver status becomes ON_TRIP.',
          ...(!hasDriver
            ? ['WARNING: No driver is currently assigned. Dispatch requires an AVAILABLE driver.']
            : []),
          ...(deliveryCount === 0
            ? ['WARNING: No deliveries are allocated. Dispatch requires at least 1 delivery.']
            : []),
          ...(isOverCapacity
            ? ['WARNING: Total load weight exceeds truck capacity.']
            : []),
        ]}
        confirmLabel="Dispatch Truck"
      />

      {/* Complete Plan Confirmation */}
      <ConfirmDialog
        isOpen={pendingAction === 'COMPLETED'}
        onClose={() => setPendingAction(null)}
        onConfirm={() => updateStatus('COMPLETED')}
        loading={loading}
        tone="success"
        title="Complete Load Plan?"
        description="Confirm that the truck has completed its route and all assigned deliveries have been fulfilled."
        consequences={[
          'Load plan transitions permanently to COMPLETED.',
          'All assigned IN_TRANSIT deliveries are marked as DELIVERED.',
          'Truck and driver are released back to AVAILABLE (unless assigned to another active trip).',
        ]}
        confirmLabel="Complete Plan"
      />

      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        isOpen={pendingAction === 'DELETE'}
        onClose={() => setPendingAction(null)}
        onConfirm={handleDelete}
        loading={loading}
        tone="danger"
        title="Delete Load Plan?"
        description="This load plan will be permanently removed from your workspace."
        consequences={[
          'All assigned deliveries on this plan will be safely released back to PENDING status.',
          'Truck and driver remain available for other plans.',
          'This action cannot be undone.',
        ]}
        confirmLabel="Delete Plan"
      />

      {/* Action Buttons by Lifecycle State */}
      <div className="flex flex-wrap items-center gap-2">
        {available.canDelete && (
          <Button
            type="button"
            variant="danger-subtle"
            size="sm"
            disabled={loading}
            onClick={() => setPendingAction('DELETE')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}

        {available.canRevertToDraft && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => setPendingAction('DRAFT')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Revert to Draft
          </Button>
        )}

        {available.canMarkReady && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading}
            onClick={() => setPendingAction('READY')}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark as Ready
          </Button>
        )}

        {available.canDispatch && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading}
            onClick={() => setPendingAction('DISPATCHED')}
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch Truck
          </Button>
        )}

        {available.canComplete && (
          <Button
            type="button"
            variant="success"
            size="sm"
            disabled={loading}
            onClick={() => setPendingAction('COMPLETED')}
          >
            <Flag className="h-3.5 w-3.5" />
            Complete Plan
          </Button>
        )}

        {currentStatus === 'COMPLETED' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Lifecycle Completed
          </span>
        )}
      </div>
    </>
  );
}

export function DraftDriverSelector({
  loadPlanId,
  currentDriverId,
  currentDriverName,
  availableDrivers,
  isEditable,
}: {
  loadPlanId: string;
  currentDriverId: string | null;
  currentDriverName: string | null;
  availableDrivers: { id: string; name: string }[];
  isEditable: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!isEditable) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <UserCheck className="h-4 w-4 text-gray-400" />
        <span>{currentDriverName || 'Unassigned'}</span>
      </div>
    );
  }

  // Ensure current driver is in the options list even if not in availableDrivers
  const options = [...availableDrivers];
  if (
    currentDriverId &&
    currentDriverName &&
    !options.some((d) => d.id === currentDriverId)
  ) {
    options.unshift({ id: currentDriverId, name: currentDriverName });
  }

  async function handleDriverChange(newDriverId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: newDriverId || null }),
      });
      if (res.ok) {
        toast.success(
          newDriverId ? 'Driver assigned to load plan' : 'Driver unassigned'
        );
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Failed to update driver');
      }
    } catch {
      toast.error('Error updating driver');
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      aria-label="Assign driver"
      disabled={saving}
      value={currentDriverId || ''}
      onChange={(e) => handleDriverChange(e.target.value)}
      className="mt-1 block h-8 w-full max-w-[200px] rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-900 shadow-2xs focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 cursor-pointer"
    >
      <option value="">-- Unassigned --</option>
      {options.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
