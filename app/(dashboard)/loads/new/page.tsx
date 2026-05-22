import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LoadPlanSetupForm } from '@/components/loads/LoadPlanSetupForm';
import { AlertTriangle } from 'lucide-react';

export default async function NewLoadPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let trucks: { id: string; name: string; plateNumber: string; weightCapacity: number }[] = [];
  let drivers: { id: string; name: string }[] = [];
  let dbError = false;

  try {
    const company = await prisma.company.findFirst();
    if (company) {
      trucks = await prisma.truck.findMany({
        where: { companyId: company.id, status: 'AVAILABLE' },
        select: { id: true, name: true, plateNumber: true, weightCapacity: true },
        orderBy: { name: 'asc' }
      });

      drivers = await prisma.driver.findMany({
        where: { companyId: company.id, status: 'AVAILABLE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });
    }
  } catch (err) {
    console.error("DB error in NewLoadPlanPage:", err);
    dbError = true;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader 
        title="Create Load Plan" 
        description="Select a truck, date, and optional driver to initialize a new load plan."
      />
      
      {dbError ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-gray-600 font-medium">Unable to connect to the database</p>
          <p className="text-sm text-gray-500 mt-1">Please check your connection and try again.</p>
        </Card>
      ) : (
        <Card className="p-6">
          <LoadPlanSetupForm trucks={trucks} drivers={drivers} />
        </Card>
      )}
    </div>
  );
}
