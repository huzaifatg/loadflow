import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AllocationPanel } from '@/components/loads/AllocationPanel';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusPill } from '@/components/ui/StatusPill';
import { LoadPlanActions } from '@/components/loads/LoadPlanActions';
import { toNumber, getItemSummary, aggregateByUnit } from '@/lib/delivery-items';
import { cn } from '@/lib/utils';
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
    pickupAddress: item.delivery.pickupAddress,
    deliveryAddress: item.delivery.deliveryAddress,
    scheduledDate: item.delivery.scheduledDate ? item.delivery.scheduledDate.toISOString() : null,
    weight: toNumber(item.delivery.weight),
    itemCount: item.delivery._count?.items || 0,
    itemSummary: getItemSummary(item.delivery.items || []),
  }));

  const initialUnassigned = unassignedDeliveries.map(d => ({
    id: d.id,
    customerName: d.customerName,
    pickupAddress: d.pickupAddress,
    deliveryAddress: d.deliveryAddress,
    scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toISOString() : null,
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

  const remainingCapacity = truckCapacity - totalWeight;
  const utilizationPct = truckCapacity > 0 ? (totalWeight / truckCapacity) * 100 : 0;
  const isOverCapacity = totalWeight > truckCapacity;

  /**
   * Derive utilization color classes from a percentage.
   * Matches CapacityBar thresholds: <60% emerald, 60–85% amber, >85% rose, >100% red.
   */
  function getUtilizationStyle(pct: number) {
    if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-600', label: 'Over Capacity', labelBg: 'bg-red-50 text-red-700 ring-red-200' };
    if (pct > 85)  return { bar: 'bg-rose-500', text: 'text-rose-600', label: 'High', labelBg: 'bg-rose-50 text-rose-700 ring-rose-200' };
    if (pct >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600', label: 'Medium', labelBg: 'bg-amber-50 text-amber-700 ring-amber-200' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-600', label: 'Low', labelBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }

  const utilStyle = getUtilizationStyle(utilizationPct);

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

      {/* ── Utilization Metrics Summary ──────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-gray-100">
          {/* Total Deliveries */}
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{initialAssigned.length}</p>
            {initialAssigned.length > 0 && unitBreakdown.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {unitBreakdown.map(u => `${u.count.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${u.unit}`).join(', ')}
              </p>
            )}
          </div>

          {/* Total Weight */}
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Weight</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              <span className="text-sm font-normal text-gray-400 ml-1">kg</span>
            </p>
          </div>

          {/* Truck Capacity */}
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Truck Capacity</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {truckCapacity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-gray-400 ml-1">kg</span>
            </p>
          </div>

          {/* Remaining Capacity */}
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</p>
            <p className={cn("mt-1 text-xl font-bold", isOverCapacity ? "text-red-600" : "text-gray-900")}>
              {isOverCapacity ? '-' : ''}{Math.abs(remainingCapacity).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              <span className={cn("text-sm font-normal ml-1", isOverCapacity ? "text-red-400" : "text-gray-400")}>kg</span>
            </p>
            {isOverCapacity && (
              <p className="text-[10px] font-medium text-red-500 mt-0.5">Over by {Math.abs(remainingCapacity).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
            )}
          </div>

          {/* Utilization */}
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className={cn("text-xl font-bold", utilStyle.text)}>
                {Math.round(utilizationPct)}%
              </p>
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", utilStyle.labelBg)}>
                {utilStyle.label}
              </span>
            </div>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="px-4 sm:px-5 pb-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500 ease-out animate-fill', utilStyle.bar)}
              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
            />
          </div>
        </div>
      </div>
      
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

