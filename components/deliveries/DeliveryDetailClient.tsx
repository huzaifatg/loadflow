'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  Delivery,
  DeliveryItem as PrismaDeliveryItem,
} from '@prisma/client';
import {
  MapPin,
  Package,
  User,
  Weight,
  Edit2,
  Archive,
  Save,
  X,
  ClipboardList,
  Truck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DeliveryItemsEditor,
  type DeliveryItemFormData,
} from './DeliveryItemsEditor';
import { toNumber } from '@/lib/delivery-items';
import { UNIT_TYPE_LABELS } from '@/lib/constants';

type ClientDeliveryItem = Omit<
  PrismaDeliveryItem,
  'quantity' | 'unitWeight' | 'totalWeight'
> & {
  quantity: number;
  unitWeight: number | null;
  totalWeight: number;
};

type DeliveryWithItems = Omit<Delivery, 'weight'> & {
  weight: number;
  items?: ClientDeliveryItem[];
  loadPlanItems?: {
    loadPlan: {
      id: string;
      status: string;
      date: string | Date;
      truck?: { id: string; name: string; plateNumber: string } | null;
      driver?: { id: string; name: string } | null;
    };
  }[];
};

export function DeliveryDetailClient({
  delivery,
}: {
  delivery: DeliveryWithItems;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const deliveryItems = delivery.items || [];
  const hasItems = deliveryItems.length > 0;
  const weightValue = toNumber(delivery.weight);
  const assignedPlan = delivery.loadPlanItems?.[0]?.loadPlan;

  const [formData, setFormData] = useState({
    customerName: delivery.customerName,
    weight: weightValue,
    pickupAddress: delivery.pickupAddress,
    deliveryAddress: delivery.deliveryAddress,
    notes: delivery.notes || '',
    scheduledDate: delivery.scheduledDate
      ? new Date(delivery.scheduledDate).toISOString().slice(0, 16)
      : '',
  });

  const [editItems, setEditItems] = useState<DeliveryItemFormData[]>(
    deliveryItems.map((item) => ({
      _key: item.id,
      productName: item.productName,
      sku: item.sku || '',
      quantity: toNumber(item.quantity),
      quantityUnit: item.quantityUnit,
      unitType: item.unitType,
      unitWeight: item.unitWeight ? toNumber(item.unitWeight) : null,
      totalWeight: toNumber(item.totalWeight),
      notes: item.notes || '',
    }))
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const hasEditItems = editItems.length > 0;

      const payload: Record<string, unknown> = {
        ...formData,
        weight: Number(formData.weight),
        scheduledDate: formData.scheduledDate
          ? new Date(formData.scheduledDate).toISOString()
          : null,
      };

      if (hasEditItems || hasItems) {
        payload.items = editItems.map((item, i) => ({
          productName: item.productName,
          sku: item.sku || null,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit,
          unitType: item.unitType,
          unitWeight: item.unitWeight,
          totalWeight: item.totalWeight,
          sortOrder: i,
        }));
      }

      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Delivery updated');
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(
          err?.error?.message || err?.error || 'Failed to update delivery'
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      if (res.ok) {
        toast.success('Delivery archived');
        setShowArchiveConfirm(false);
        router.push('/deliveries');
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Failed to archive delivery');
        setShowArchiveConfirm(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error archiving delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchive}
        loading={loading}
        tone="danger"
        title={`Archive Delivery #${delivery.id.slice(-6).toUpperCase()}?`}
        description="Archiving removes this delivery from active operational lists."
        consequences={[
          'Delivery will no longer appear in active delivery views or unassigned queues.',
        ]}
        confirmLabel="Archive Delivery"
      />

      <PageHeader
        breadcrumbs={[
          { label: 'Deliveries', href: '/deliveries' },
          { label: `${delivery.customerName} (#${delivery.id.slice(-6).toUpperCase()})` },
        ]}
        title={delivery.customerName}
        description={`Order #${delivery.id.slice(-6).toUpperCase()} • ${weightValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg total weight`}
        meta={<StatusBadge domain="delivery" status={delivery.status} />}
      >
        {!isEditing ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Order
            </Button>
            <Button
              type="button"
              variant="danger-subtle"
              size="sm"
              onClick={() => setShowArchiveConfirm(true)}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => {
                setFormData({
                  customerName: delivery.customerName,
                  weight: weightValue,
                  pickupAddress: delivery.pickupAddress,
                  deliveryAddress: delivery.deliveryAddress,
                  notes: delivery.notes || '',
                  scheduledDate: delivery.scheduledDate
                    ? new Date(delivery.scheduledDate).toISOString().slice(0, 16)
                    : '',
                });
                setEditItems(
                  deliveryItems.map((item) => ({
                    _key: item.id,
                    productName: item.productName,
                    sku: item.sku || '',
                    quantity: toNumber(item.quantity),
                    quantityUnit: item.quantityUnit,
                    unitType: item.unitType,
                    unitWeight: item.unitWeight ? toNumber(item.unitWeight) : null,
                    totalWeight: toNumber(item.totalWeight),
                    notes: item.notes || '',
                  }))
                );
                setIsEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={loading}
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </Button>
          </>
        )}
      </PageHeader>

      {/* Lifecycle Governance Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 shadow-2xs">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary-600 shrink-0" />
          <span>
            Delivery status transitions (<strong>PENDING</strong> →{' '}
            <strong>ASSIGNED</strong> → <strong>IN_TRANSIT</strong> →{' '}
            <strong>DELIVERED</strong>) are automatically governed by the assigned
            Load Plan&apos;s lifecycle.
          </span>
        </div>
        {assignedPlan ? (
          <Link
            href={`/loads/${assignedPlan.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 font-semibold text-primary-700 hover:bg-primary-100"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>
              Assigned to Plan #{assignedPlan.id.slice(-6).toUpperCase()}
              {assignedPlan.truck ? ` (${assignedPlan.truck.name})` : ''}
            </span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href="/loads/recommend"
            className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
          >
            Assign via Recommendation Engine <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <User className="h-4 w-4 text-gray-400" />
            Order & Customer Summary
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="Customer Name"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                required
              />
              {!editItems.length && (
                <Input
                  label="Weight (kg)"
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  required
                />
              )}
              <Input
                label="Scheduled Date & Time"
                type="datetime-local"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-gray-500">Customer</span>
                <span className="font-semibold text-gray-900">
                  {delivery.customerName}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Weight className="h-3.5 w-3.5 text-gray-400" />
                  Total Weight
                </span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {weightValue.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                  {hasItems && (
                    <span className="ml-1 font-normal text-gray-400">
                      (computed from items)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-gray-500">Scheduled Date</span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {delivery.scheduledDate
                    ? new Date(delivery.scheduledDate).toLocaleString()
                    : 'Not scheduled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-gray-500">Source</span>
                <Badge tone="neutral" size="sm">
                  {delivery.source || 'MANUAL'}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-gray-500">Created</span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {new Date(delivery.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-gray-400" />
            Route & Handling Notes
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="Pickup Address"
                name="pickupAddress"
                value={formData.pickupAddress}
                onChange={handleChange}
                required
              />
              <Input
                label="Delivery Destination Address"
                name="deliveryAddress"
                value={formData.deliveryAddress}
                onChange={handleChange}
                required
              />
              <Textarea
                label="Delivery Notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          ) : (
            <>
              <div className="space-y-4 pt-1">
                <div className="relative pl-6">
                  <div className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                  <div className="absolute left-[4px] top-4 h-full w-0.5 bg-gray-200" />
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Origin / Pickup
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-gray-900">
                    {delivery.pickupAddress}
                  </span>
                </div>
                <div className="relative pl-6">
                  <div className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-primary-600 ring-4 ring-primary-50" />
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Destination / Dropoff
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-gray-900">
                    {delivery.deliveryAddress}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Notes
                </span>
                <p className="text-xs leading-relaxed text-gray-600">
                  {delivery.notes || 'No special handling notes recorded.'}
                </p>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Delivery Items Section */}
      {(hasItems || isEditing) && (
        <Card>
          <CardHeader
            title="Line Items & Weight Breakdown"
            description="Individual SKU quantities and computed payload weights"
            icon={<Package className="h-4 w-4" />}
            bordered
            actions={
              hasItems &&
              !isEditing && (
                <Badge tone="neutral">
                  {deliveryItems.length}{' '}
                  {deliveryItems.length === 1 ? 'item' : 'items'}
                </Badge>
              )
            }
          />
          <div className="p-5">
            {isEditing ? (
              <DeliveryItemsEditor items={editItems} onChange={setEditItems} />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2.5 pl-4 pr-3 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Product / SKU</th>
                      <th className="px-3 py-2.5 text-left">Quantity</th>
                      <th className="px-3 py-2.5 text-left">Unit</th>
                      <th className="px-3 py-2.5 text-left">Weight Mode</th>
                      <th className="px-4 py-2.5 text-right">Total Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-xs">
                    {deliveryItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 font-medium text-gray-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="font-semibold text-gray-900">
                            {item.productName}
                          </div>
                          {item.sku && (
                            <div className="font-mono text-[11px] text-gray-500">
                              SKU: {item.sku}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900 tabular-nums">
                          {toNumber(item.quantity).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                          {item.quantityUnit}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge tone="neutral" size="sm">
                            {UNIT_TYPE_LABELS[item.unitType] || item.unitType}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                          {toNumber(item.totalWeight).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{' '}
                          kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 bg-gray-50/80 text-xs">
                    <tr>
                      <td
                        colSpan={5}
                        className="py-3 pl-4 pr-3 text-right font-semibold text-gray-600"
                      >
                        Aggregate Payload Weight
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                        {weightValue.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        kg
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
