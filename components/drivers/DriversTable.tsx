'use client';

import React from 'react';
import Link from 'next/link';
import type { Driver } from '@prisma/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, ArrowRight } from 'lucide-react';

type DriverWithCounts = Driver & {
  _count?: { loadPlans: number };
};

export function DriversTable({ data }: { data: DriverWithCounts[] }) {
  const columns: Column<DriverWithCounts>[] = [
    {
      key: 'name',
      label: 'Driver Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 ring-1 ring-inset ring-primary-200">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link
              href={`/drivers/${row.id}`}
              className="font-semibold text-gray-900 hover:text-primary-600"
            >
              {row.name}
            </Link>
            {row.notes && (
              <p className="max-w-[200px] truncate text-xs text-gray-400">
                {row.notes}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone Number',
      render: (row) => (
        <span className="text-xs font-medium text-gray-700 tabular-nums">
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'licenseNumber',
      label: 'CDL / License #',
      render: (row) => (
        <span className="font-mono text-xs text-gray-700">
          {row.licenseNumber || '—'}
        </span>
      ),
    },
    {
      key: 'loadPlans',
      label: 'Load Plans',
      render: (row) => (
        <span className="text-xs text-gray-600 tabular-nums">
          {row._count?.loadPlans ?? 0}{' '}
          {(row._count?.loadPlans ?? 0) === 1 ? 'plan' : 'plans'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge domain="driver" status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Link
          href={`/drivers/${row.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:border-primary-300 hover:text-primary-600"
        >
          Profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyState={
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No drivers found"
          description="Add drivers to your roster so they can be assigned to load plans and dispatched."
          actionLabel="Add Driver"
          actionHref="/drivers/new"
        />
      }
    />
  );
}
