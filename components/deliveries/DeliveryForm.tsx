'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from 'sonner';
import { DeliveryItemsEditor, type DeliveryItemFormData } from './DeliveryItemsEditor';
import { computeItemWeight } from '@/lib/delivery-items';

export function DeliveryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DeliveryItemFormData[]>([]);

  // Compute total weight from items
  const itemsWeight = items.reduce((sum, item) => {
    return sum + computeItemWeight({
      unitType: item.unitType,
      quantity: item.quantity,
      unitWeight: item.unitWeight,
      totalWeight: item.totalWeight,
    });
  }, 0);

  const hasItems = items.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Build payload
    const payload: Record<string, unknown> = {
      customerName: data.customerName,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      scheduledDate: data.scheduledDate || null,
    };

    if (hasItems) {
      // Items mode: weight is computed from items
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

      // H-7: Validate items have meaningful weight
      if (itemsWeight <= 0) {
        toast.error('Items must have a total weight greater than zero. Check your item weights.');
        setLoading(false);
        return;
      }
    } else {
      // Legacy mode: manual weight entry
      payload.weight = parseFloat(data.weight as string) || 0;
    }

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to create delivery');
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
              name="scheduledDate"
              label="Scheduled Date"
              type="datetime-local"
            />
          </div>
          {/* Show manual weight only if no items */}
          {!hasItems && (
            <div>
              <Input
                name="weight"
                label="Weight (kg)"
                type="number"
                min="0"
                step="0.1"
                required={!hasItems}
                placeholder="e.g. 4500"
              />
            </div>
          )}
          {/* Show computed weight if items exist */}
          {hasItems && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Weight</label>
              <div className="flex items-center h-[38px] px-3 rounded-md bg-gray-100 text-sm font-semibold text-gray-900">
                {itemsWeight > 0
                  ? `${itemsWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`
                  : 'Add items to compute weight'
                }
              </div>
            </div>
          )}
        </div>

        {/* Delivery Items Editor */}
        <div className="pt-4 border-t border-gray-100">
          <DeliveryItemsEditor items={items} onChange={setItems} />
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
