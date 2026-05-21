import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LoadPlanSetupForm } from '@/components/loads/LoadPlanSetupForm';

export default async function NewLoadPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();
  if (!company) redirect('/settings');

  const trucks = await prisma.truck.findMany({
    where: { companyId: company.id, status: 'AVAILABLE' },
    select: { id: true, name: true, plateNumber: true, weightCapacity: true },
    orderBy: { name: 'asc' }
  });

  const drivers = await prisma.driver.findMany({
    where: { companyId: company.id, status: 'AVAILABLE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader 
        title="Create Load Plan" 
        description="Select a truck, date, and optional driver to initialize a new load plan."
      />
      
      <Card className="p-6">
        <LoadPlanSetupForm trucks={trucks} drivers={drivers} />
      </Card>
    </div>
  );
}
