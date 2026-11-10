'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';

export function TruckForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const payload = {
      ...data,
      weightCapacity: parseFloat(data.weightCapacity as string) || 0,
    };

    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to add truck');
      }

      toast.success('Truck added to fleet');
      router.push('/trucks');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || 'An unexpected error occurred');
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card padding="lg" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              name="name"
              label="Vehicle Name / Identifier"
              required
              placeholder="e.g. Freightliner M2 #104"
              hint="Friendly name shown on load plans and dispatch schedules."
            />
          </div>
          <Input
            name="plateNumber"
            label="License Plate Number"
            required
            placeholder="e.g. TX-8492A"
          />
          <Input
            name="type"
            label="Vehicle Type"
            required
            defaultValue="Box Truck"
            placeholder="e.g. Box Truck, Refrigerated, Flatbed"
          />
          <Input
            name="weightCapacity"
            label="Maximum Payload Capacity (kg)"
            type="number"
            min="1"
            step="0.1"
            required
            placeholder="e.g. 12000"
            hint="Used to enforce load plan capacity limits."
          />
          <Select
            name="status"
            label="Initial Status"
            defaultValue="AVAILABLE"
            options={[
              { value: 'AVAILABLE', label: 'Available for Dispatch' },
              { value: 'IN_USE', label: 'In Use' },
              { value: 'MAINTENANCE', label: 'In Maintenance' },
            ]}
          />
          <div className="sm:col-span-2">
            <Textarea
              name="notes"
              label="Vehicle Notes (Optional)"
              rows={3}
              placeholder="Liftgate equipped, temperature range, or maintenance notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-gray-200 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Register Truck
          </Button>
        </div>
      </form>
    </Card>
  );
}
