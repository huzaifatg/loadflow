'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface TruckOpt {
  id: string;
  name: string;
  plateNumber: string;
  weightCapacity: number;
}

interface DriverOpt {
  id: string;
  name: string;
}

interface Props {
  trucks: TruckOpt[];
  drivers: DriverOpt[];
}

export function LoadPlanSetupForm({ trucks, drivers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error('Failed to create load plan');
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
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dispatch Date
          </label>
          <Input
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Truck
          </label>
          <select
            name="truckId"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
          >
            <option value="">-- Choose a truck --</option>
            {trucks.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.plateNumber}) - {t.weightCapacity.toLocaleString()} kg capacity
              </option>
            ))}
          </select>
          {trucks.length === 0 && (
            <p className="mt-1 text-sm text-red-500">No available trucks. Please add one first.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Driver (Optional)
          </label>
          <select
            name="driverId"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
          >
            <option value="">-- Unassigned --</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={trucks.length === 0}>
          Initialize Plan
        </Button>
      </div>
    </form>
  );
}
