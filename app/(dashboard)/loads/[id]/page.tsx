import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AllocationPanel } from '@/components/loads/AllocationPanel';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Delivery } from '@prisma/client';

export default async function LoadPlanBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  try {
    company = await prisma.company.findFirst();
  } catch(e) {
    console.error("DB error:", e);
  }

  const id = (await params).id;

  // Real fetch if it exists
  let loadPlan = null;
  let unassignedDeliveries: Delivery[] = [];
  
  if (company) {
    try {
      loadPlan = await prisma.loadPlan.findUnique({
        where: { id, companyId: company.id },
        include: {
          truck: true,
          driver: true,
          items: {
            include: { delivery: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (loadPlan) {
        unassignedDeliveries = await prisma.delivery.findMany({
          where: {
            companyId: company.id,
            status: 'PENDING',
            loadPlanItems: { none: {} }
          }
        });
      }
    } catch(e) {
      console.error("Load plan fetch error", e);
    }
  }

  if (!loadPlan) {
    return (
      <div className="space-y-6 flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-xl font-bold text-gray-900">Load Plan Not Found</h2>
        <p className="text-gray-500">The load plan you are looking for does not exist.</p>
      </div>
    );
  }

  const truckCapacity = loadPlan.truck?.weightCapacity || 40000;
  
  const initialAssigned = loadPlan.items.map(item => ({
    id: item.delivery.id,
    customerName: item.delivery.customerName,
    deliveryAddress: item.delivery.deliveryAddress,
    weight: item.delivery.weight
  }));

  const initialUnassigned = unassignedDeliveries.map(d => ({
    id: d.id,
    customerName: d.customerName,
    deliveryAddress: d.deliveryAddress,
    weight: d.weight
  }));

  return (
    <div className="space-y-6 flex flex-col h-full">
      <PageHeader 
        title={`Load Plan Builder`} 
        description={loadPlan ? `Plan for ${loadPlan.truck.name} on ${new Date(loadPlan.date).toLocaleDateString()}` : "Drag and drop deliveries to allocate capacity."}
      >
        <StatusPill status={loadPlan?.status || 'DRAFT'} />
      </PageHeader>
      
      <AllocationPanel 
        loadPlanId={id}
        initialUnassigned={initialUnassigned}
        initialAssigned={initialAssigned}
        truckCapacity={truckCapacity}
      />
    </div>
  );
}
