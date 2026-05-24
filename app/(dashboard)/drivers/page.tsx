import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DriversTable } from '@/components/drivers/DriversTable';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Driver } from '@prisma/client';

export default async function DriversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  let drivers: Driver[] = [];

  try {
    company = await prisma.company.findFirst();
    if (company) {
      drivers = await prisma.driver.findMany({
        where: { companyId: company.id, isArchived: false },
        orderBy: { createdAt: 'desc' },
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in Drivers:", err);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Drivers" 
        description="Manage your drivers and their current availability."
        actionLabel="Add Driver"
        actionHref="/drivers/new"
      />
      <DriversTable data={drivers} />
    </div>
  );
}
