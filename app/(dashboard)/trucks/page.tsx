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

  const displayData = trucks.length > 0 ? trucks : [
    { id: 'mock-t1', companyId: company?.id || 'mock-c', name: 'Volvo FH16', plateNumber: 'XYZ-1234', weightCapacity: 44000, status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mock-t2', companyId: company?.id || 'mock-c', name: 'Scania R450', plateNumber: 'ABC-9876', weightCapacity: 40000, status: 'IN_USE', notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mock-t3', companyId: company?.id || 'mock-c', name: 'Mercedes Actros', plateNumber: 'LMN-5555', weightCapacity: 42000, status: 'MAINTENANCE', notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mock-t4', companyId: company?.id || 'mock-c', name: 'Ford F-Max', plateNumber: 'DEF-1111', weightCapacity: 38000, status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
  ] as Truck[];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fleet Management" 
        description="Monitor and manage all your trucks and their capacities."
        actionLabel="Add Truck"
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayData.map((truck) => (
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
