'use client';

import React from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import Link from 'next/link';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Driver } from '@prisma/client';


export function DriversTable({ data }: { data: Driver[] }) {
  const columns: Column<Driver>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link href={`/drivers/${row.id}`} className="font-medium text-primary-600 hover:text-primary-700">
          {row.name}
        </Link>
      ),
    },
    { key: 'phone', label: 'Phone Number' },
    { key: 'licenseNumber', label: 'License #' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No active drivers found."
    />
  );
}
