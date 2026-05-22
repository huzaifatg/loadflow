import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DeliveriesTable } from '@/components/deliveries/DeliveriesTable';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Delivery } from '@prisma/client';

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  let deliveries: Delivery[] = [];
  
  try {
    company = await prisma.company.findFirst();
    if (company) {
      deliveries = await prisma.delivery.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in Deliveries:", err);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Deliveries" 
        description="Manage all inbound and outbound deliveries."
        actionLabel="New Delivery"
        actionHref="/deliveries/new"
      />
      <DeliveriesTable data={deliveries} />
    </div>
  );
}
