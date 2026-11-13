'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Package,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import type { DispatchDeliveryItemDTO } from '@/lib/services/dispatch-board';
import { cn } from '@/lib/utils';

export interface DraftPlanOption {
  id: string;
  planRef: string;
  date: string;
  dateLabel: string;
  truckName: string;
  truckCapacity: number;
  currentWeight: number;
  remainingCapacity: number;
  deliveryIds: string[];
}

export interface QuickAllocateDeliveryDialogProps {
  delivery: DispatchDeliveryItemDTO | null;
  draftPlans: DraftPlanOption[];
  isOpen: boolean;
  onClose: () => void;
  onAllocated: () => void;
}

export function QuickAllocateDeliveryDialog({
  delivery,
  draftPlans,
  isOpen,
  onClose,
  onAllocated,
}: QuickAllocateDeliveryDialogProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !delivery) return null;

  const selectedPlan = draftPlans.find((p) => p.id === selectedPlanId) ?? null;
  const projectedWeight = selectedPlan
    ? selectedPlan.currentWeight + delivery.weight
    : delivery.weight;
  const exceedsCapacity = Boolean(
    selectedPlan &&
      selectedPlan.truckCapacity > 0 &&
      projectedWeight > selectedPlan.truckCapacity
  );

  async function handleAllocate() {
    if (!delivery || !selectedPlan || exceedsCapacity || saving) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      const nextItems = Array.from(new Set([...selectedPlan.deliveryIds, delivery.id]));
      const res = await fetch(`/api/loads/${selectedPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: nextItems }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to allocate delivery to load plan.');
      }

      const data = await res.json().catch(() => null);
      if (Array.isArray(data?._warnings) && data._warnings.length > 0) {
        toast.warning(data._warnings[0].message);
      }
      toast.success(`Allocated "${delivery.customerName}" to ${selectedPlan.planRef}`);
      onAllocated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error allocating delivery';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] animate-fade-in"
        onClick={saving ? undefined : onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocate-delivery-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gray-50/70 px-5 py-4">
          <div>
            <h2 id="allocate-delivery-title" className="text-base font-bold text-gray-900">
              Allocate Delivery to Draft Plan
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {delivery.reference} • <strong className="text-gray-800">{delivery.customerName}</strong>{' '}
              ({Math.round(delivery.weight).toLocaleString()} kg)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 cursor-pointer"
            aria-label="Close allocation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {/* Delivery Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary-600" />
                {delivery.customerName}
              </span>
              <Badge
                tone={
                  delivery.urgency === 'OVERDUE'
                    ? 'danger'
                    : delivery.urgency === 'DUE_TODAY'
                      ? 'warning'
                      : 'neutral'
                }
                size="sm"
              >
                {delivery.urgencyLabel}
              </Badge>
            </div>
            <p className="text-gray-600 truncate">
              From: {delivery.pickupAddress} → To: {delivery.deliveryAddress}
            </p>
            <p className="text-gray-500">
              Payload Weight: <strong className="text-gray-900">{delivery.weight.toLocaleString()} kg</strong>
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {draftPlans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center space-y-3">
              <ClipboardList className="mx-auto h-6 w-6 text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  No editable Draft Load Plans available
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Create a new draft load plan or revert a READY plan to DRAFT before allocating deliveries.
                </p>
              </div>
              <ButtonLink href="/loads/new" variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Create New Load Plan
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Select Target Draft Plan ({draftPlans.length})
              </p>
              <div className="space-y-2">
                {draftPlans.map((plan) => {
                  const fits =
                    plan.truckCapacity <= 0 ||
                    plan.currentWeight + delivery.weight <= plan.truckCapacity;
                  const isSelected = plan.id === selectedPlanId;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={!fits}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-all',
                        isSelected
                          ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                          : !fits
                            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                            : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-gray-900">
                            {plan.planRef} • {plan.truckName}
                          </span>
                          <p className="text-[11px] text-gray-500">
                            Planned: {plan.dateLabel} • {plan.deliveryIds.length}{' '}
                            {plan.deliveryIds.length === 1 ? 'stop' : 'stops'}
                          </p>
                        </div>
                        <Badge tone={fits ? 'success' : 'danger'} size="sm">
                          {fits
                            ? `${Math.round(plan.remainingCapacity).toLocaleString()} kg free`
                            : 'Insufficient Capacity'}
                        </Badge>
                      </div>

                      <div className="mt-2">
                        <CapacityBar
                          current={Math.round(
                            isSelected ? plan.currentWeight + delivery.weight : plan.currentWeight
                          )}
                          max={plan.truckCapacity}
                          size="sm"
                        />
                      </div>

                      {!fits && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Adding {Math.round(delivery.weight).toLocaleString()} kg would exceed{' '}
                          {plan.truckName} capacity ({plan.truckCapacity.toLocaleString()} kg).
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedPlan && !exceedsCapacity && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Projected payload on {selectedPlan.planRef}:{' '}
                <strong>{Math.round(projectedWeight).toLocaleString()} kg</strong> /{' '}
                {selectedPlan.truckCapacity.toLocaleString()} kg
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3.5">
          <Link
            href={`/deliveries/${delivery.id}`}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            View full delivery details →
          </Link>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            {draftPlans.length > 0 && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={!selectedPlan || exceedsCapacity || saving}
                onClick={handleAllocate}
              >
                Allocate to Plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

