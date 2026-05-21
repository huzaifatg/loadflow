import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Delivery } from '@prisma/client';

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

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const deliveries = await prisma.delivery.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });

  // Mock data fallback if empty
  const displayData = deliveries.length > 0 ? deliveries : [
    {
      id: 'mock-1',
      companyId: company.id,
      customerName: 'Acme Corp',
      pickupAddress: 'Warehouse A',
      deliveryAddress: 'Chicago, IL',
      weight: 4200,
      status: 'PENDING',
      scheduledDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'mock-2',
      companyId: company.id,
      customerName: 'Stark Ind.',
      pickupAddress: 'Factory B',
      deliveryAddress: 'Detroit, MI',
      weight: 1800,
      status: 'IN_TRANSIT',
      scheduledDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ] as Delivery[];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Deliveries" 
        description="Manage all inbound and outbound deliveries."
        actionLabel="New Delivery"
        actionHref="/deliveries/new"
      />
      <DataTable 
        columns={columns} 
        data={displayData} 
        emptyMessage="No deliveries found."
      />
    </div>
  );
}
