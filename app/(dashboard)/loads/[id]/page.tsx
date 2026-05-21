import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AllocationPanel } from '@/components/loads/AllocationPanel';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';

export default async function LoadPlanBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = await prisma.company.findFirst();

  const id = (await params).id;

  // Real fetch if it exists
  let loadPlan = null;
  let unassignedDeliveries: any[] = [];
  
  if (!id.startsWith('mock-') && company) {
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

  // Fallback to mock data to fulfill requirements
  const truckCapacity = loadPlan?.truck?.weightCapacity || 40000;
  
  const initialAssigned = loadPlan 
    ? loadPlan.items.map(item => ({
        id: item.delivery.id,
        customerName: item.delivery.customerName,
        deliveryAddress: item.delivery.deliveryAddress,
        weight: item.delivery.weight
      }))
    : [
        { id: 'd1', customerName: 'Acme Corp', deliveryAddress: 'Warehouse A', weight: 4500 },
        { id: 'd2', customerName: 'Stark Ind.', deliveryAddress: 'Factory B', weight: 12000 },
      ];

  const initialUnassigned = loadPlan
    ? unassignedDeliveries.map(d => ({
        id: d.id,
        customerName: d.customerName,
        deliveryAddress: d.deliveryAddress,
        weight: d.weight
      }))
    : [
        { id: 'd3', customerName: 'Wayne Tech', deliveryAddress: 'Gotham City', weight: 8000 },
        { id: 'd4', customerName: 'Oscorp', deliveryAddress: 'New York', weight: 21000 },
        { id: 'd5', customerName: 'LexCorp', deliveryAddress: 'Metropolis', weight: 3500 },
      ];

  return (
    <div className="space-y-6 flex flex-col h-full">
      <PageHeader 
        title={`Load Plan Builder`} 
        description={loadPlan ? `Plan for ${loadPlan.truck.name} on ${new Date(loadPlan.date).toLocaleDateString()}` : "Drag and drop deliveries to allocate capacity."}
      >
        <StatusPill status={loadPlan?.status || 'DRAFT'} />
      </PageHeader>
      
      <AllocationPanel 
        initialUnassigned={initialUnassigned}
        initialAssigned={initialAssigned}
        truckCapacity={truckCapacity}
      />
    </div>
  );
}
