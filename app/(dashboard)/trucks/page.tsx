import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckCard } from '@/components/trucks/TruckCard';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function TrucksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const trucks = await prisma.truck.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });

  const displayData = trucks.length > 0 ? trucks : [
    { id: 'mock-t1', name: 'Volvo FH16', plateNumber: 'XYZ-1234', weightCapacity: 44000, status: 'AVAILABLE' },
    { id: 'mock-t2', name: 'Scania R450', plateNumber: 'ABC-9876', weightCapacity: 40000, status: 'IN_USE' },
    { id: 'mock-t3', name: 'Mercedes Actros', plateNumber: 'LMN-5555', weightCapacity: 42000, status: 'MAINTENANCE' },
    { id: 'mock-t4', name: 'Ford F-Max', plateNumber: 'DEF-1111', weightCapacity: 38000, status: 'AVAILABLE' },
  ];

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
