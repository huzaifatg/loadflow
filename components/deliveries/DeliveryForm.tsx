'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';

export function DeliveryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Parse numeric fields for Prisma
    const payload = {
      ...data,
      weight: parseFloat(data.weight as string) || 0,
    };

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to create delivery');
      }

      toast.success('Delivery created successfully');
      router.push('/deliveries');
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
    <Card className="max-w-2xl p-6">
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              name="customerName"
              label="Customer Name"
              required
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              name="pickupAddress"
              label="Pickup Address"
              required
              placeholder="Full address"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              name="deliveryAddress"
              label="Delivery Address"
              required
              placeholder="Full address"
            />
          </div>
          <div>
            <Input
              name="weight"
              label="Weight (lbs)"
              type="number"
              min="0"
              step="0.1"
              required
              placeholder="e.g. 4500"
            />
          </div>
          <div>
            <Input
              name="scheduledDate"
              label="Scheduled Date"
              type="datetime-local"
            />
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
          <Button type="submit" loading={loading}>
            Create Delivery
          </Button>
        </div>
      </form>
    </Card>
  );
}
