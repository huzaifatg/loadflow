'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
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
        toast.error(err?.error || 'Failed to cancel delivery');
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
  const columns: Column<DeliveryRow>[] = [
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
  );
}
