import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Truck as TruckIcon } from 'lucide-react';

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const id = (await params).id;
  const truck = await prisma.truck.findUnique({
    where: { id, companyId: company.id },
  });

  if (!truck) {
    return (
      <div className="space-y-6">
        <PageHeader title="Truck Not Found" />
        <Card className="p-6 text-gray-500">
          The requested truck could not be found or you don't have access.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={truck.name} 
        description={`Manage details for plate ${truck.plateNumber}`}
      >
        <StatusPill status={truck.status} />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-6 md:col-span-1">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <TruckIcon className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{truck.name}</h2>
              <p className="font-mono text-sm text-gray-500">{truck.plateNumber}</p>
            </div>
          </div>
          <div className="space-y-3 pt-6 border-t border-gray-100">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Capacity</span>
              <span className="text-sm font-medium text-gray-900">{truck.weightCapacity.toLocaleString()} lbs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Added</span>
              <span className="text-sm font-medium text-gray-900">{new Date(truck.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Load Plans</h3>
          <p className="text-sm text-gray-500">
            History will be displayed here when the backend is fully wired.
          </p>
        </Card>
      </div>
    </div>
  );
}
