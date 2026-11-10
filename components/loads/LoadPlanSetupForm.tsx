'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Truck, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TruckOpt {
  id: string;
  name: string;
  type?: string;
  plateNumber: string;
  weightCapacity: number;
}

interface DriverOpt {
  id: string;
  name: string;
  licenseNumber?: string | null;
}

interface Props {
  trucks: TruckOpt[];
  drivers: DriverOpt[];
  pendingDeliveryCount?: number;
}

export function LoadPlanSetupForm({
  trucks,
  drivers,
  pendingDeliveryCount = 0,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string>(
    trucks[0]?.id || ''
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to create load plan');
      }

      const loadPlan = await res.json();
      router.push(`/loads/${loadPlan.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'An unexpected error occurred');
      } else {
        setError('An unexpected error occurred');
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {pendingDeliveryCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary-100 bg-primary-50/50 px-3.5 py-2.5 text-xs text-primary-900">
          <span className="flex items-center gap-2 font-medium">
            <Package className="h-4 w-4 text-primary-600" />
            {pendingDeliveryCount} pending{' '}
            {pendingDeliveryCount === 1 ? 'delivery is' : 'deliveries are'} ready
            to be allocated in the next step.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          name="date"
          type="date"
          label="Planned Dispatch Date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
          hint="Target date this truck is scheduled to depart."
        />

        <Select
          name="driverId"
          label="Assign Driver (Optional for Draft)"
          placeholder="Leave unassigned for now"
          hint="Required before dispatching the load plan."
          options={drivers.map((d) => ({
            value: d.id,
            label: d.licenseNumber
              ? `${d.name} (Lic: ${d.licenseNumber})`
              : d.name,
          }))}
        />
      </div>

      {/* Interactive Truck Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-700">
          Select Available Truck <span className="text-rose-500">*</span>
        </label>
        <input type="hidden" name="truckId" value={selectedTruckId} required />

        {trucks.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
            <p className="font-semibold">No available trucks found</p>
            <p className="mt-1 text-amber-700">
              All trucks are currently in use, in maintenance, or no vehicles have
              been added to your fleet yet.
            </p>
            <div className="mt-3">
              <ButtonLink href="/trucks/new" variant="secondary" size="xs">
                Add Fleet Truck
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {trucks.map((t) => {
              const isSelected = selectedTruckId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTruckId(t.id)}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        isSelected
                          ? 'border-primary-200 bg-primary-600 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                      )}
                    >
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {t.plateNumber}
                        {t.type ? ` • ${t.type}` : ''}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-700 tabular-nums">
                        {t.weightCapacity.toLocaleString()} kg max capacity
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Textarea
        name="notes"
        label="Operational Notes (Optional)"
        placeholder="Dock instructions, route notes, or special handling requirements..."
        rows={3}
      />

      <div className="flex items-center justify-end gap-2.5 border-t border-gray-200 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={trucks.length === 0 || !selectedTruckId}
        >
          Initialize Draft Plan
        </Button>
      </div>
    </form>
  );
}
