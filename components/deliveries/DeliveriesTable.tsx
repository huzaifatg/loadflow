'use client';

import React from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import Link from 'next/link';
import type { Delivery } from '@prisma/client';

export function DeliveriesTable({ data }: { data: Delivery[] }) {
  const columns: Column<Delivery>[] = [
    {
      key: 'id',
      label: 'Order ID',
      render: (row) => (
        <Link href={`/deliveries/${row.id}`} className="font-medium text-primary-600 hover:text-primary-700">
          {row.id.split('-')[0]}...
        </Link>
      ),
    },
    { key: 'customerName', label: 'Customer' },
    { key: 'pickupAddress', label: 'Pickup' },
    { key: 'deliveryAddress', label: 'Destination' },
    { 
      key: 'weight', 
      label: 'Weight (lbs)',
      render: (row) => row.weight.toLocaleString()
    },
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
      emptyMessage="No deliveries found."
    />
  );
}
