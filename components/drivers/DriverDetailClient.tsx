'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Driver } from '@prisma/client';
import {
  User as UserIcon,
  Phone,
  FileText,
  Edit2,
  Archive,
  Save,
  X,
  Calendar,
  ClipboardList,
  ArrowRight,
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

export function DriverDetailClient({
  driver,
  loadPlans = [],
}: {
  driver: Driver;
  loadPlans?: LoadPlanSummary[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: driver.name,
    phone: driver.phone || '',
    licenseNumber: driver.licenseNumber || '',
    status: driver.status,
    notes: driver.notes || '',
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
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Driver profile updated');
        setIsEditing(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || err?.error || 'Failed to update driver');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error updating driver');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      if (res.ok) {
        toast.success('Driver archived');
        setShowArchiveConfirm(false);
        router.push('/drivers');
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Failed to archive driver');
        setShowArchiveConfirm(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error archiving driver');
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
        title={`Archive ${driver.name}?`}
        description="Archiving removes this driver from active roster selection while preserving historical load plan assignments."
        consequences={[
          'Driver will no longer appear in active driver lists or recommendations.',
          'Past load plans assigned to this driver remain intact.',
        ]}
        confirmLabel="Archive Driver"
      />

      <PageHeader
        breadcrumbs={[
          { label: 'Drivers', href: '/drivers' },
          { label: driver.name },
        ]}
        title={driver.name}
        description={`License: ${driver.licenseNumber || 'Not specified'} • Phone: ${driver.phone || 'Not specified'}`}
        meta={!isEditing && <StatusBadge domain="driver" status={driver.status} />}
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
              Edit Profile
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
              <UserIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-gray-900">
                {driver.name}
              </h2>
              <p className="text-xs text-gray-500">
                {driver.licenseNumber
                  ? `CDL: ${driver.licenseNumber}`
                  : 'Fleet Driver'}
              </p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <Input
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
              <Input
                label="CDL / License Number"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
              />
              <Select
                label="Availability Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={[
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'ON_TRIP', label: 'On Trip' },
                  { value: 'OFF_DUTY', label: 'Off Duty' },
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
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    Phone Number
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {driver.phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    License #
                  </span>
                  <span className="font-mono font-semibold text-gray-900">
                    {driver.licenseNumber || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    Added
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">
                    {new Date(driver.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Driver Notes
                </span>
                <p className="text-xs leading-relaxed text-gray-600">
                  {driver.notes || 'No driver notes recorded.'}
                </p>
              </div>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader
            title="Assigned Load Plans"
            description="Recent load plans assigned to this driver"
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
                title="No load plans assigned to this driver"
                description="Assign this driver when creating or editing a draft load plan."
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
