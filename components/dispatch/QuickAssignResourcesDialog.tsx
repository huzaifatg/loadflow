'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import type { DispatchLoadPlanDTO } from '@/lib/services/dispatch-board';
import type {
  DispatchAvailabilityResult,
  TruckAvailabilityDTO,
  DriverAvailabilityDTO,
} from '@/lib/services/dispatch-availability';
import { cn } from '@/lib/utils';

export interface QuickAssignResourcesDialogProps {
  plan: DispatchLoadPlanDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickAssignResourcesDialog({
  plan,
  isOpen,
  onClose,
  onSaved,
}: QuickAssignResourcesDialogProps) {
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [availability, setAvailability] = useState<DispatchAvailabilityResult | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const planDateStr = useMemo(() => {
    if (!plan) return '';
    return plan.date.slice(0, 10);
  }, [plan]);

  useEffect(() => {
    if (!isOpen || !plan) return;
    setSelectedTruckId(plan.truck.id);
    setSelectedDriverId(plan.driver?.id ?? '');
    setErrorMessage(null);

    let cancelled = false;
    setLoadingAvailability(true);
    const params = new URLSearchParams({
      date: planDateStr,
      excludePlanId: plan.id,
      requiredWeight: String(plan.totalWeight),
    });

    fetch(`/api/dispatch/availability?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load resource availability');
        const data: DispatchAvailabilityResult = await res.json();
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, plan, planDateStr]);

  const trucks: TruckAvailabilityDTO[] = useMemo(
    () => availability?.trucks ?? [],
    [availability]
  );
  const drivers: DriverAvailabilityDTO[] = useMemo(
    () => availability?.drivers ?? [],
    [availability]
  );

  const selectedTruck = useMemo(
    () => trucks.find((t) => t.resourceId === selectedTruckId) ?? null,
    [trucks, selectedTruckId]
  );
  const selectedDriver = useMemo(
    () => drivers.find((d) => d.resourceId === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  );

  if (!isOpen || !plan) return null;

  const isLockedReady = plan.status === 'READY';
  const effectiveCapacity = selectedTruck?.weightCapacity ?? plan.truck.weightCapacity;
  const isOverCapacity = effectiveCapacity > 0 && plan.totalWeight > effectiveCapacity;

  const truckHasConflict = Boolean(selectedTruck && !selectedTruck.available);
  const driverHasConflict = Boolean(
    selectedDriverId && selectedDriver && !selectedDriver.available
  );

  const canSubmit =
    Boolean(selectedTruckId) &&
    !isOverCapacity &&
    !truckHasConflict &&
    !driverHasConflict &&
    !saving;

  const hasChanges =
    selectedTruckId !== plan.truck.id ||
    (selectedDriverId || null) !== (plan.driver?.id ?? null);

  async function handleSave() {
    if (!plan || !canSubmit) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      // If plan is READY, we must revert to DRAFT first via lifecycle endpoint
      if (plan.status === 'READY') {
        const revertRes = await fetch(`/api/loads/${plan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DRAFT' }),
        });
        if (!revertRes.ok) {
          const revertErr = await revertRes.json().catch(() => null);
          throw new Error(revertErr?.error || 'Could not revert load plan to DRAFT for editing.');
        }
      }

      const patchRes = await fetch(`/api/loads/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: selectedTruckId,
          driverId: selectedDriverId || null,
        }),
      });

      if (!patchRes.ok) {
        const errData = await patchRes.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to save resource assignment.');
      }

      toast.success(`Resources updated on ${plan.planRef}`);
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating resource assignment';
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
        aria-labelledby="assign-resources-title"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gray-50/70 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="assign-resources-title" className="text-base font-bold text-gray-900">
                Assign Truck & Driver — {plan.planRef}
              </h2>
              <StatusBadge domain="loadPlan" status={plan.status} />
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Operating Date: <strong className="text-gray-800">{plan.dateLabel}</strong> •{' '}
              {plan.deliveryCount} {plan.deliveryCount === 1 ? 'stop' : 'stops'} •{' '}
              {Math.round(plan.totalWeight).toLocaleString()} kg payload
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 cursor-pointer"
            aria-label="Close assignment dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[72vh] overflow-y-auto p-5 space-y-5">
          {isLockedReady && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Plan is currently locked in READY status</p>
                <p className="mt-0.5 text-amber-700">
                  Saving resource changes will automatically revert {plan.planRef} to{' '}
                  <strong>DRAFT</strong>, apply the new assignment, and keep dispatch separate.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold">Assignment Validation Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Capacity & Compatibility Bar */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">
                Payload vs Selected Truck Capacity
              </span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  isOverCapacity ? 'text-rose-600' : 'text-emerald-700'
                )}
              >
                {Math.round(plan.totalWeight).toLocaleString()} /{' '}
                {Math.round(effectiveCapacity).toLocaleString()} kg
              </span>
            </div>
            <CapacityBar
              current={Math.round(plan.totalWeight)}
              max={effectiveCapacity}
              size="md"
            />
            {isOverCapacity && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Selected truck capacity ({effectiveCapacity.toLocaleString()} kg) is insufficient for
                this load ({Math.round(plan.totalWeight).toLocaleString()} kg). Select a larger vehicle.
              </p>
            )}
          </div>

          {loadingAvailability ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              Evaluating fleet & driver availability for {plan.dateLabel}...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Showing real-time availability for {plan.dateLabel}
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUnavailable}
                    onChange={(e) => setShowUnavailable(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show unavailable resources
                </label>
              </div>

              {/* Truck Selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                  <Truck className="h-3.5 w-3.5 text-primary-600" />
                  Select Fleet Truck (Required)
                </label>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {trucks
                    .filter(
                      (t) =>
                        showUnavailable ||
                        t.eligibleForAssignment ||
                        t.resourceId === selectedTruckId
                    )
                    .map((t) => {
                      const isSelected = t.resourceId === selectedTruckId;
                      const isDisabled = !t.eligibleForAssignment && !isSelected;

                      return (
                        <button
                          key={t.resourceId}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedTruckId(t.resourceId)}
                          className={cn(
                            'flex flex-col justify-between rounded-lg border p-3 text-left transition-all',
                            isSelected
                              ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                              : isDisabled
                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-900">
                                {t.resourceName}
                              </p>
                              <p className="text-[11px] font-mono text-gray-500">
                                {t.plateNumber} • {t.vehicleType}
                              </p>
                            </div>
                            <Badge
                              tone={
                                t.eligibleForAssignment
                                  ? 'success'
                                  : !t.available
                                    ? 'danger'
                                    : 'warning'
                              }
                              size="sm"
                            >
                              {t.eligibleForAssignment
                                ? 'Available'
                                : !t.available
                                  ? 'Unavailable'
                                  : 'Under Capacity'}
                            </Badge>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                            <span>
                              Capacity:{' '}
                              <strong className="text-gray-900">
                                {t.weightCapacity.toLocaleString()} kg
                              </strong>
                            </span>
                            {t.capacityCompatible ? (
                              <span className="text-emerald-700 font-medium">
                                +{Math.round(t.remainingCapacityIfAssigned).toLocaleString()} kg spare
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold">
                                Over by {Math.abs(Math.round(t.remainingCapacityIfAssigned)).toLocaleString()} kg
                              </span>
                            )}
                          </div>

                          {t.conflictReason && (
                            <p className="mt-1.5 flex items-start gap-1 text-[11px] font-medium text-rose-600">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{t.conflictReason}</span>
                            </p>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Driver Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                    <Users className="h-3.5 w-3.5 text-primary-600" />
                    Select Driver
                  </label>
                  {selectedDriverId && (
                    <button
                      type="button"
                      onClick={() => setSelectedDriverId('')}
                      className="text-xs font-semibold text-gray-500 hover:text-rose-600 cursor-pointer"
                    >
                      Clear driver (leave unassigned)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {drivers
                    .filter(
                      (d) =>
                        showUnavailable ||
                        d.eligibleForAssignment ||
                        d.resourceId === selectedDriverId
                    )
                    .map((d) => {
                      const isSelected = d.resourceId === selectedDriverId;
                      const isDisabled = !d.eligibleForAssignment && !isSelected;

                      return (
                        <button
                          key={d.resourceId}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedDriverId(d.resourceId)}
                          className={cn(
                            'flex flex-col justify-between rounded-lg border p-3 text-left transition-all',
                            isSelected
                              ? 'border-primary-600 bg-primary-50/50 ring-2 ring-primary-500/20'
                              : isDisabled
                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                : 'border-gray-200 bg-white hover:border-primary-300 cursor-pointer'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-900">
                                {d.resourceName}
                              </p>
                              <p className="truncate text-[11px] text-gray-500">
                                {d.phone || 'No phone'} • {d.licenseNumber || 'License on file'}
                              </p>
                            </div>
                            <Badge
                              tone={d.eligibleForAssignment ? 'success' : 'danger'}
                              size="sm"
                            >
                              {d.eligibleForAssignment ? 'Available' : 'Unavailable'}
                            </Badge>
                          </div>

                          {d.conflictReason && (
                            <p className="mt-1.5 flex items-start gap-1 text-[11px] font-medium text-rose-600">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{d.conflictReason}</span>
                            </p>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </>
          )}

          {/* Conflict / Readiness Preview */}
          {(truckHasConflict || driverHasConflict) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Conflicting resource selected — cannot save assignment
              </p>
              {truckHasConflict && selectedTruck?.conflictReason && (
                <p>• {selectedTruck.conflictReason}</p>
              )}
              {driverHasConflict && selectedDriver?.conflictReason && (
                <p>• {selectedDriver.conflictReason}</p>
              )}
            </div>
          )}

          {!truckHasConflict && !driverHasConflict && !isOverCapacity && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                {selectedDriverId
                  ? 'Truck and driver are verified available with sufficient weight capacity.'
                  : 'Truck is verified available. Assign a driver before dispatching.'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3.5">
          <span className="text-[11px] text-gray-500">
            Assignment does not automatically dispatch the vehicle.
          </span>
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!canSubmit || !hasChanges}
              onClick={handleSave}
            >
              {isLockedReady ? 'Revert to Draft & Save' : 'Save Assignment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

