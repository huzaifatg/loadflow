import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Truck as TruckIcon, Gauge, Calendar } from 'lucide-react';

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const id = (await params).id;

  let truck = null;
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      truck = await prisma.truck.findUnique({
        where: { id, companyId: company.id },
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in TruckDetail:", err);
  }

  // Mock fallback for demo
  if (!truck && id.startsWith('mock-')) {
    truck = {
      id,
      name: 'Demo Truck',
      plateNumber: 'DEMO-1234',
      weightCapacity: 40000,
      status: 'AVAILABLE',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  }

  if (!truck) {
    return (
      <div className="space-y-6">
        <PageHeader title="Truck Not Found" />
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <TruckIcon className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500">The requested truck could not be found or you don&apos;t have access.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={truck.name} 
        description={`Plate: ${truck.plateNumber}`}
      >
        <StatusPill status={truck.status} />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-6 md:col-span-1">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center">
              <TruckIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{truck.name}</h2>
              <p className="font-mono text-sm text-gray-500">{truck.plateNumber}</p>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Capacity
              </span>
              <span className="text-sm font-semibold text-gray-900">{truck.weightCapacity.toLocaleString()} lbs</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Added
              </span>
              <span className="text-sm font-medium text-gray-900">{new Date(truck.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          {truck.notes && (
            <div className="pt-4 border-t border-gray-100">
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</span>
              <p className="text-sm text-gray-700">{truck.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Load Plans</h3>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <TruckIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Load plan history will appear here once connected to the database.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
