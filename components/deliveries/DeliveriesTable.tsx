'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Delivery } from '@prisma/client';
import { format } from 'date-fns';
import {
  Package,
  XCircle,
  ArrowRight,
  ClipboardList,
  MapPin,
  Archive,
  Calendar,
  Download,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button, ButtonLink } from '@/components/ui/Button';
import { toNumber, getItemSummary } from '@/lib/delivery-items';

type DeliveryRow = Omit<Delivery, 'weight'> & {
  weight: number;
  _count?: { items?: number; loadPlanItems?: number };
  items?: { productName: string }[];
  loadPlanItems?: {
    loadPlan: {
      id: string;
      status: string;
      date: string | Date;
      truck?: { name: string; plateNumber: string } | null;
    };
  }[];
};

function DeliveryRowActions({ delivery }: { delivery: DeliveryRow }) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loading, setLoading] = useState(false);

  const canCancel =
    delivery.status === 'PENDING' || delivery.status === 'ASSIGNED';

  async function handleCancel() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        toast.success(`Delivery for ${delivery.customerName} cancelled`);
        setConfirmCancel(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || err?.error || 'Failed to cancel delivery');
        setConfirmCancel(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error cancelling delivery');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        loading={loading}
        tone="danger"
        title={`Cancel Delivery for ${delivery.customerName}?`}
        description="Cancelling marks this delivery order as CANCELLED so it is excluded from load planning."
        consequences={[
          'Delivery status transitions to CANCELLED.',
          'Cancelled deliveries cannot be assigned to load plans.',
        ]}
        confirmLabel="Cancel Delivery"
      />

      <div className="flex items-center justify-end gap-1.5">
        {canCancel && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
            title="Cancel delivery"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Cancel</span>
          </button>
        )}
        <Link
          href={`/deliveries/${delivery.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:border-primary-300 hover:text-primary-600"
        >
          Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </>
  );
}

export function DeliveriesTable({ data }: { data: DeliveryRow[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'archive' | 'cancel' | null>(
    null
  );
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );

  // Keep selection restricted to IDs visible in current dataset or across interactions
  const pageIds = useMemo(() => data.map((d) => d.id), [data]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOnPage = useMemo(
    () => pageIds.filter((id) => selectedSet.has(id)),
    [pageIds, selectedSet]
  );
  const allPageSelected =
    pageIds.length > 0 && selectedOnPage.length === pageIds.length;

  const selectedRows = useMemo(
    () => data.filter((d) => selectedSet.has(d.id)),
    [data, selectedSet]
  );
  const totalSelectedWeight = useMemo(
    () => selectedRows.reduce((sum, d) => sum + toNumber(d.weight), 0),
    [selectedRows]
  );

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkSubmit = async (
    action: 'archive' | 'cancel' | 'reschedule',
    scheduledDate?: string | null
  ) => {
    if (selectedIds.length === 0 || bulkLoading) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/deliveries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          deliveryIds: selectedIds,
          ...(action === 'reschedule' ? { scheduledDate } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error || 'Bulk operation failed');
        return;
      }

      const skippedCount = json.skipped?.length ?? 0;
      const label =
        action === 'archive'
          ? 'archived'
          : action === 'cancel'
          ? 'cancelled'
          : 'rescheduled';
      if (skippedCount > 0) {
        toast.warning(
          `${json.updatedCount} ${label}; ${skippedCount} skipped (${json.skipped[0]?.reason}).`
        );
      } else {
        toast.success(
          `Successfully ${label} ${json.updatedCount} ${
            json.updatedCount === 1 ? 'delivery' : 'deliveries'
          }.`
        );
      }

      setSelectedIds([]);
      setConfirmAction(null);
      setRescheduleOpen(false);
      router.refresh();
    } catch {
      toast.error('Failed to execute bulk operation');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportSelectedCsv = () => {
    const rowsToExport = selectedRows.length > 0 ? selectedRows : data;
    if (rowsToExport.length === 0) return;

    const escapeCsv = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      'id',
      'customer_name',
      'pickup_address',
      'delivery_address',
      'weight_kg',
      'status',
      'scheduled_date',
      'load_plan_id',
    ];
    const lines = [
      header.join(','),
      ...rowsToExport.map((r) =>
        [
          escapeCsv(r.id),
          escapeCsv(r.customerName),
          escapeCsv(r.pickupAddress),
          escapeCsv(r.deliveryAddress),
          escapeCsv(toNumber(r.weight)),
          escapeCsv(r.status),
          escapeCsv(
            r.scheduledDate
              ? new Date(r.scheduledDate).toISOString().split('T')[0]
              : ''
          ),
          escapeCsv(r.loadPlanItems?.[0]?.loadPlan?.id ?? ''),
        ].join(',')
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loadflow-deliveries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rowsToExport.length} deliveries to CSV`);
  };

  const columns: Column<DeliveryRow>[] = [
    {
      key: 'select',
      label: '',
      className: 'w-10 pr-0',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedSet.has(row.id)}
          onChange={() => toggleRow(row.id)}
          aria-label={`Select delivery for ${row.customerName}`}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        />
      ),
    },
    {
      key: 'customerName',
      label: 'Customer / Order',
      render: (row) => (
        <div>
          <Link
            href={`/deliveries/${row.id}`}
            className="font-semibold text-gray-900 hover:text-primary-600"
          >
            {row.customerName}
          </Link>
          <div className="font-mono text-[11px] text-gray-400">
            #{row.id.slice(-6).toUpperCase()}
          </div>
        </div>
      ),
    },
    {
      key: 'route',
      label: 'Route (Pickup → Destination)',
      render: (row) => (
        <div className="max-w-[260px]">
          <div className="flex items-center gap-1.5 truncate text-xs font-medium text-gray-800">
            <MapPin className="h-3 w-3 shrink-0 text-primary-600" />
            <span className="truncate">{row.deliveryAddress}</span>
          </div>
          <div className="truncate pl-4 text-[11px] text-gray-400">
            From: {row.pickupAddress}
          </div>
        </div>
      ),
    },
    {
      key: 'scheduledDate',
      label: 'Scheduled',
      render: (row) => (
        <span className="text-xs text-gray-600 tabular-nums">
          {row.scheduledDate
            ? format(new Date(row.scheduledDate), 'MMM d, yyyy')
            : 'Unscheduled'}
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      render: (row) => {
        const count = row._count?.items || 0;
        if (count === 0)
          return <span className="text-xs text-gray-400">Direct weight</span>;
        const summary = getItemSummary(row.items || [], 2);
        return (
          <div>
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            {summary && (
              <p className="mt-0.5 max-w-[150px] truncate text-[11px] text-gray-400">
                {summary}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'weight',
      label: 'Weight',
      render: (row) => (
        <span className="text-xs font-semibold text-gray-900 tabular-nums">
          {toNumber(row.weight).toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}{' '}
          kg
        </span>
      ),
    },
    {
      key: 'loadPlan',
      label: 'Load Plan',
      render: (row) => {
        const activePlan = row.loadPlanItems?.[0]?.loadPlan;
        if (!activePlan) {
          return <span className="text-xs text-gray-400">Unassigned</span>;
        }
        return (
          <Link
            href={`/loads/${activePlan.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:border-primary-300 hover:text-primary-600"
          >
            <ClipboardList className="h-3 w-3 text-primary-600" />
            <span>
              #{activePlan.id.slice(-6).toUpperCase()}
              {activePlan.truck ? ` • ${activePlan.truck.name}` : ''}
            </span>
          </Link>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge domain="delivery" status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => <DeliveryRowActions delivery={row} />,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Page selection & bulk toolbar */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleAllPage}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span>Select current page ({data.length})</span>
            </label>
            {selectedIds.length > 0 && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                <span className="rounded-md bg-primary-50 px-2 py-0.5 font-semibold text-primary-700 tabular-nums">
                  {selectedIds.length} selected
                  {selectedRows.length > 0
                    ? ` • ${totalSelectedWeight.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })} kg`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setRescheduleOpen(true)}
                  disabled={bulkLoading}
                >
                  <Calendar className="h-3.5 w-3.5 text-primary-600" />
                  Reschedule
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setConfirmAction('cancel')}
                  disabled={bulkLoading}
                >
                  <XCircle className="h-3.5 w-3.5 text-amber-600" />
                  Cancel Selected
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setConfirmAction('archive')}
                  disabled={bulkLoading}
                >
                  <Archive className="h-3.5 w-3.5 text-rose-600" />
                  Archive Selected
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleExportSelectedCsv}
            >
              <Download className="h-3.5 w-3.5 text-gray-500" />
              {selectedIds.length > 0
                ? `Export Selected (${selectedRows.length})`
                : 'Export Page CSV'}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Archive / Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) handleBulkSubmit(confirmAction);
        }}
        loading={bulkLoading}
        tone={confirmAction === 'cancel' ? 'danger' : 'warning'}
        title={
          confirmAction === 'cancel'
            ? `Cancel ${selectedIds.length} Selected ${
                selectedIds.length === 1 ? 'Delivery' : 'Deliveries'
              }?`
            : `Archive ${selectedIds.length} Selected ${
                selectedIds.length === 1 ? 'Delivery' : 'Deliveries'
              }?`
        }
        description={
          confirmAction === 'cancel'
            ? 'Eligible PENDING and ASSIGNED deliveries will be transitioned to CANCELLED.'
            : 'Eligible unallocated deliveries will be archived and removed from active operational queues.'
        }
        consequences={
          confirmAction === 'cancel'
            ? [
                'PENDING and ASSIGNED orders transition to CANCELLED.',
                'Deliveries already IN_TRANSIT or DELIVERED will be safely skipped.',
              ]
            : [
                'Unallocated deliveries are marked archived.',
                'Deliveries currently allocated to a Load Plan will be safely skipped.',
              ]
        }
        confirmLabel={
          confirmAction === 'cancel' ? 'Cancel Deliveries' : 'Archive Deliveries'
        }
      />

      {/* Bulk Reschedule Modal */}
      <Modal
        isOpen={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title={`Reschedule ${selectedIds.length} Selected ${
          selectedIds.length === 1 ? 'Delivery' : 'Deliveries'
        }`}
        description="Set a new target scheduled date for eligible PENDING and ASSIGNED orders."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => handleBulkSubmit('reschedule', null)}
              disabled={bulkLoading}
            >
              Clear Date (Unscheduled)
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={bulkLoading}
              onClick={() => handleBulkSubmit('reschedule', rescheduleDate)}
            >
              Apply Date
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            New Scheduled Date
          </label>
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-600 focus:outline-none"
          />
          <p className="text-xs text-gray-500">
            Deliveries already in transit, delivered, or cancelled will be skipped automatically.
          </p>
        </div>
      </Modal>

      <DataTable
        columns={columns}
        data={data}
        emptyState={
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="No deliveries match your current view"
            description="Create a new delivery order manually or bulk import customer orders from a CSV file."
            actionLabel="New Delivery"
            actionHref="/deliveries/new"
            secondaryAction={
              <ButtonLink href="/import" variant="secondary" size="sm">
                Import CSV
              </ButtonLink>
            }
          />
        }
      />
    </div>
  );
}
