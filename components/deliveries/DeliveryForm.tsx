'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';
import {
  DeliveryItemsEditor,
  type DeliveryItemFormData,
} from './DeliveryItemsEditor';
import { computeItemWeight } from '@/lib/delivery-items';

export function DeliveryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DeliveryItemFormData[]>([]);

  const itemsWeight = items.reduce((sum, item) => {
    return (
      sum +
      computeItemWeight({
        unitType: item.unitType,
        quantity: item.quantity,
        unitWeight: item.unitWeight,
        totalWeight: item.totalWeight,
      })
    );
  }, 0);

  const hasItems = items.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const payload: Record<string, unknown> = {
      customerName: data.customerName,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      scheduledDate: data.scheduledDate || null,
      notes: data.notes || null,
    };

    if (hasItems) {
      payload.items = items.map((item, i) => ({
        productName: item.productName,
        sku: item.sku || null,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        unitType: item.unitType,
        unitWeight: item.unitWeight,
        totalWeight: item.totalWeight,
        sortOrder: i,
      }));

      if (itemsWeight <= 0) {
        toast.error(
          'Items must have a total weight greater than zero. Check your item weights.'
        );
        setLoading(false);
        return;
      }
    } else {
      payload.weight = parseFloat(data.weight as string) || 0;
    }

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error?.message || errData?.error || 'Failed to create delivery'
        );
      }

      toast.success('Delivery order created');
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
    <Card padding="lg" className="max-w-3xl">
      {error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              name="customerName"
              label="Customer / Recipient Name"
              required
              placeholder="e.g. Sysco Midwest Distribution"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              name="pickupAddress"
              label="Origin / Pickup Address"
              required
              placeholder="e.g. 1400 Industrial Pkwy, Dallas, TX"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              name="deliveryAddress"
              label="Destination / Delivery Address"
              required
              placeholder="e.g. 820 Commerce Blvd, Austin, TX"
            />
          </div>
          <Input
            name="scheduledDate"
            label="Requested Delivery Date & Time"
            type="datetime-local"
          />

          {!hasItems ? (
            <Input
              name="weight"
              label="Total Order Weight (kg)"
              type="number"
              min="0.1"
              step="0.1"
              required={!hasItems}
              placeholder="e.g. 2400"
              hint="Or add itemized SKUs below to auto-compute weight."
            />
          ) : (
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Computed Order Weight
              </label>
              <div className="flex h-9 items-center rounded-lg border border-primary-200 bg-primary-50/60 px-3 text-sm font-bold text-primary-900 tabular-nums">
                {itemsWeight > 0
                  ? `${itemsWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
                  : 'Enter item quantities below'}
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <Textarea
              name="notes"
              label="Delivery Notes (Optional)"
              rows={2}
              placeholder="Receiving hours, dock gate code, or handling instructions..."
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-5">
          <DeliveryItemsEditor items={items} onChange={setItems} />
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
            Create Delivery Order
          </Button>
        </div>
      </form>
    </Card>
  );
}
