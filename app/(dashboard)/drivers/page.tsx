import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Driver } from '@prisma/client';

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

export default async function DriversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const drivers = await prisma.driver.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });

  const displayData = drivers.length > 0 ? drivers : [
    { id: 'mock-d1', companyId: company.id, name: 'Marcus Johnson', phone: '555-0101', licenseNumber: 'DL-123456', status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mock-d2', companyId: company.id, name: 'Sarah Connor', phone: '555-0102', licenseNumber: 'DL-987654', status: 'ON_TRIP', notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mock-d3', companyId: company.id, name: 'David Chen', phone: '555-0103', licenseNumber: 'DL-555555', status: 'OFF_DUTY', notes: null, createdAt: new Date(), updatedAt: new Date() },
  ] as Driver[];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Drivers" 
        description="Manage your drivers and their current availability."
        actionLabel="Add Driver"
      />
      <DataTable 
        columns={columns} 
        data={displayData} 
        emptyMessage="No drivers found."
      />
    </div>
  );
}
