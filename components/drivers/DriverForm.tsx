'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';

export function DriverForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to add driver');
      }

      toast.success('Driver added to roster');
      router.push('/drivers');
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
              label="Driver Full Name"
              required
              placeholder="e.g. Marcus Johnson"
            />
          </div>
          <Input
            name="phone"
            label="Phone Number"
            placeholder="e.g. (555) 234-5678"
            hint="Direct contact number for dispatch notifications."
          />
          <Input
            name="licenseNumber"
            label="CDL / License Number"
            placeholder="e.g. CDL-849201"
          />
          <div className="sm:col-span-2">
            <Select
              name="status"
              label="Initial Availability Status"
              defaultValue="AVAILABLE"
              options={[
                { value: 'AVAILABLE', label: 'Available for Dispatch' },
                { value: 'OFF_DUTY', label: 'Off Duty' },
                { value: 'ON_TRIP', label: 'On Trip' },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              name="notes"
              label="Driver Notes (Optional)"
              rows={3}
              placeholder="Certifications, shift preferences, or route familiarity..."
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
            Add Driver
          </Button>
        </div>
      </form>
    </Card>
  );
}
