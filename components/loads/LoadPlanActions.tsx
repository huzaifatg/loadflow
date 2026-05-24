'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Truck, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function LoadPlanActions({ loadPlanId, currentStatus }: { loadPlanId: string, currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  if (currentStatus === 'DRAFT') {
    return (
      <button
        onClick={() => updateStatus('READY')}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        Mark as Ready
      </button>
    );
  }

  if (currentStatus === 'READY') {
    return (
      <button
        onClick={() => updateStatus('DISPATCHED')}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        <Truck className="h-4 w-4" />
        Dispatch Truck
      </button>
    );
  }

  if (currentStatus === 'DISPATCHED') {
    return (
      <button
        onClick={() => updateStatus('COMPLETED')}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        <Flag className="h-4 w-4" />
        Complete Plan
      </button>
    );
  }

  return null;
}
