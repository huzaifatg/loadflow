'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Truck } from '@prisma/client';
import {
  Truck as TruckIcon,
  Gauge,
  Calendar,
  Edit2,
  Archive,
  Save,
  X,
  ClipboardList,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

interface LoadPlanSummary {
  id: string;
  date: string | Date;
  status: string;
  _count?: { items: number };
}

export function TruckDetailClient({
  truck,
  loadPlans = [],
}: {
  truck: Truck;
  loadPlans?: LoadPlanSummary[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: truck.name,
    type: truck.type,
    plateNumber: truck.plateNumber,
    weightCapacity: truck.weightCapacity,
    status: truck.status,
    notes: truck.notes || '',
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        weightCapacity: Number(formData.weightCapacity),
      };

      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Truck updated');
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || err?.error || 'Failed to update truck');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating truck');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      if (res.ok) {
        toast.success('Truck archived');
        setShowArchiveConfirm(false);
        router.push('/trucks');
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Failed to archive truck');
        setShowArchiveConfirm(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error archiving truck');
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
        title={`Archive ${truck.name}?`}
        description="Archiving removes this vehicle from active fleet selection while preserving historical load plan records."
        consequences={[
          'Vehicle will no longer appear in active truck lists or recommendations.',
          'Historical load plans referencing this truck remain intact.',
        ]}
        confirmLabel="Archive Truck"
      />

      <PageHeader
        breadcrumbs={[
          { label: 'Trucks', href: '/trucks' },
          { label: truck.name },
        ]}
        title={truck.name}
        description={`License Plate: ${truck.plateNumber} • ${truck.type}`}
        meta={!isEditing && <StatusBadge domain="truck" status={truck.status} />}
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
              Edit Vehicle
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
              onClick={() => setIsEditing(false)}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 space-y-5 lg:col-span-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-600">
              <TruckIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-gray-900">
                {truck.name}
              </h2>
              <p className="font-mono text-xs font-semibold text-gray-500">
                {truck.plateNumber}
              </p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <Input
                label="Vehicle Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <Input
                label="License Plate"
                name="plateNumber"
                value={formData.plateNumber}
                onChange={handleChange}
                required
              />
              <Input
                label="Vehicle Type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              />
              <Input
                label="Weight Capacity (kg)"
                type="number"
                name="weightCapacity"
                value={formData.weightCapacity}
                onChange={handleChange}
                required
              />
              <Select
                label="Operational Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'IN_USE', label: 'In Use' },
                  { value: 'MAINTENANCE', label: 'Maintenance' },
                ]}
              />
              <Textarea
                label="Notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          ) : (
            <>
              <div className="space-y-3 border-t border-gray-100 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Tag className="h-3.5 w-3.5 text-gray-400" />
                    Vehicle Type
                  </span>
                  <span className="font-semibold text-gray-900">{truck.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Gauge className="h-3.5 w-3.5 text-gray-400" />
                    Max Payload
                  </span>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {truck.weightCapacity.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    Registered
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">
                    {new Date(truck.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Operational Notes
                </span>
                <p className="text-xs leading-relaxed text-gray-600">
                  {truck.notes || 'No vehicle notes recorded.'}
                </p>
              </div>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader
            title="Assigned Load Plans"
            description="Recent load plans scheduled on this vehicle"
            bordered
            actions={
              <ButtonLink href="/loads/new" variant="secondary" size="xs">
                New Load Plan
              </ButtonLink>
            }
          />
          <div className="flex-1">
            {loadPlans.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {loadPlans.map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/loads/${plan.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          Plan #{plan.id.slice(-6).toUpperCase()} •{' '}
                          {new Date(plan.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {plan._count?.items || 0}{' '}
                          {plan._count?.items === 1 ? 'delivery' : 'deliveries'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <StatusBadge domain="loadPlan" status={plan.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No load plans assigned to this truck"
                description="Create a new load plan and select this truck to begin allocating deliveries."
                actionLabel="Create Load Plan"
                actionHref="/loads/new"
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
