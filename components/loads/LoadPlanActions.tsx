'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Truck, Flag, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function LoadPlanActions({ loadPlanId, currentStatus }: { loadPlanId: string, currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function updateStatus(newStatus: string) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/loads/${loadPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Plan marked as ${newStatus}`);
        router.refresh();
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Failed to update status');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating status');
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
        toast.success('Load plan deleted');
        router.push('/loads');
        router.refresh();
      } else {
        const errData = await res.json().catch(() => null);
        toast.error(errData?.error || 'Failed to delete plan');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error deleting plan');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  // ── Delete confirmation inline dialog ──────────────────────────────────
  const deleteConfirmation = showDeleteConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Delete Load Plan?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          This action cannot be undone. The load plan and all delivery assignments will be removed.
        </p>
        <p className="text-xs text-gray-400 mb-5">
          Assigned deliveries will return to Pending status.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete Plan'}
          </button>
        </div>
      </div>
    </div>
  );

  if (currentStatus === 'DRAFT') {
    return (
      <>
        {deleteConfirmation}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-600/20 hover:bg-red-100 disabled:opacity-50 transition-colors"
            title="Delete this draft plan"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={() => updateStatus('READY')}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark as Ready
          </button>
        </div>
      </>
    );
  }

  if (currentStatus === 'READY') {
    return (
      <>
        {deleteConfirmation}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-600/20 hover:bg-red-100 disabled:opacity-50 transition-colors"
            title="Delete this plan"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            onClick={() => {
              if (!confirm('Revert to Draft? This will unlock the plan for editing.')) return;
              updateStatus('DRAFT');
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Revert to Draft
          </button>
          <button
            onClick={() => {
              if (!confirm('Are you sure you want to dispatch this truck? This will mark deliveries as In Transit.')) return;
              updateStatus('DISPATCHED');
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Truck className="h-4 w-4" />
            Dispatch Truck
          </button>
        </div>
      </>
    );
  }

  if (currentStatus === 'DISPATCHED') {
    return (
      <button
        onClick={() => {
          if (!confirm('Are you sure you want to complete this plan? This will mark all deliveries as Delivered.')) return;
          updateStatus('COMPLETED');
        }}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        <Flag className="h-4 w-4" />
        Complete Plan
      </button>
    );
  }

  // COMPLETED — no further actions available
  if (currentStatus === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        Plan Completed
      </span>
    );
  }

  return null;
}
