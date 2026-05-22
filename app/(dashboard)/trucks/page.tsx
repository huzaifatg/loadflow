import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckCard } from '@/components/trucks/TruckCard';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Truck } from '@prisma/client';

export default async function TrucksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  let trucks: Truck[] = [];

  try {
    company = await prisma.company.findFirst();
    if (company) {
      trucks = await prisma.truck.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in Trucks:", err);
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fleet Management" 
        description="Monitor and manage all your trucks and their capacities."
        actionLabel="Add Truck"
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {trucks.map((truck) => (
          <TruckCard 
            key={truck.id}
            id={truck.id}
            name={truck.name}
            plateNumber={truck.plateNumber}
            weightCapacity={truck.weightCapacity}
            status={truck.status}
          />
        ))}
      </div>
    </div>
  );
}
