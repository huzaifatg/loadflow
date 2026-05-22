'use client';

import React from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Driver } from '@prisma/client';

export function DriversTable({ data }: { data: Driver[] }) {
  const columns: Column<Driver>[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'licenseNumber', label: 'License #' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.status} />
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No drivers found."
    />
  );
}
