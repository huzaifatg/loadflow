import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AllocationPanel } from '@/components/loads/AllocationPanel';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { LoadPlanActions } from '@/components/loads/LoadPlanActions';
import { toNumber, getItemSummary, aggregateByUnit } from '@/lib/delivery-items';
import { getAuthContext } from '@/lib/auth';

export default async function LoadPlanBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  try {
    const auth = await getAuthContext();
    company = auth?.company;
  } catch(e) {
    console.error("DB error:", e);
  }

  const id = (await params).id;

  // Real fetch if it exists
  let loadPlan = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unassignedDeliveries: any[] = [];
  
  if (company) {
    try {
      loadPlan = await prisma.loadPlan.findUnique({
        where: { id, companyId: company.id },
        include: {
          truck: true,
          driver: true,
          items: {
            include: {
              delivery: {
                include: {
                  items: { orderBy: { sortOrder: 'asc' } },
                  _count: { select: { items: true } },
                },
              },
            },
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
          },
          include: {
            items: { orderBy: { sortOrder: 'asc' } },
            _count: { select: { items: true } },
          },
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
    weight: toNumber(item.delivery.weight),
    itemCount: item.delivery._count?.items || 0,
    itemSummary: getItemSummary(item.delivery.items || []),
  }));

  const initialUnassigned = unassignedDeliveries.map(d => ({
    id: d.id,
    customerName: d.customerName,
    deliveryAddress: d.deliveryAddress,
    weight: toNumber(d.weight),
    itemCount: d._count?.items || 0,
    itemSummary: getItemSummary(d.items || []),
  }));

  // Compute load summary for assigned deliveries
  const allAssignedItems = loadPlan.items.flatMap(lpi => 
    (lpi.delivery.items || []).map(item => ({
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
    }))
  );
  const unitBreakdown = aggregateByUnit(allAssignedItems);
  const totalWeight = initialAssigned.reduce((sum, d) => sum + d.weight, 0);

  return (
    <div className="space-y-6 flex flex-col h-full">
      <PageHeader 
        title={`Load Plan Builder`} 
        description={loadPlan ? `Plan for ${loadPlan.truck.name} on ${new Date(loadPlan.date).toLocaleDateString()}` : "Drag and drop deliveries to allocate capacity."}
      >
        <div className="flex items-center gap-3">
          <StatusPill status={loadPlan?.status || 'DRAFT'} />
          <LoadPlanActions loadPlanId={id} currentStatus={loadPlan?.status || 'DRAFT'} />
        </div>
      </PageHeader>

      {/* Load Summary Bar */}
      {initialAssigned.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 rounded-lg ring-1 ring-gray-200 text-sm">
          <span className="font-semibold text-gray-700">{initialAssigned.length} {initialAssigned.length === 1 ? 'stop' : 'stops'}</span>
          <span className="text-gray-300">•</span>
          {unitBreakdown.map((item, i) => (
            <span key={item.unit} className="text-gray-600">
              {item.count.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
              {i < unitBreakdown.length - 1 && <span className="text-gray-300 ml-4">•</span>}
            </span>
          ))}
          {unitBreakdown.length > 0 && <span className="text-gray-300">•</span>}
          <span className="font-semibold text-gray-700">{totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span>
        </div>
      )}
      
      <AllocationPanel 
        loadPlanId={id}
        initialUnassigned={initialUnassigned}
        initialAssigned={initialAssigned}
        truckCapacity={truckCapacity}
        isFinalized={loadPlan?.status === 'DISPATCHED' || loadPlan?.status === 'COMPLETED'}
      />
    </div>
  );
}

