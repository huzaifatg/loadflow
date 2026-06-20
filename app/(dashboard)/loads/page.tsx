import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadPlanCard } from '@/components/loads/LoadPlanCard';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { LoadPlan, Truck, Driver, Delivery } from '@prisma/client';
import { getAuthContext } from '@/lib/auth';
import { toNumber } from '@/lib/delivery-items';
import { Package, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';

type LoadPlanWithRelations = LoadPlan & {
  truck: Truck;
  driver: Driver | null;
  _count: { items: number };
  items: { delivery: Pick<Delivery, 'weight'> }[];
};

export default async function LoadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  let loads: LoadPlanWithRelations[] = [];

  try {
    const auth = await getAuthContext();
    company = auth?.company;
    
    if (company) {
      loads = await prisma.loadPlan.findMany({
        where: { companyId: company.id },
        include: {
          truck: true,
          driver: true,
          _count: {
            select: { items: true }
          },
          items: {
            select: {
              delivery: {
                select: { weight: true }
              }
            }
          }
        },
        orderBy: { date: 'desc' },
      });
    }
  } catch (error) {
    console.error("Database connection failed:", error);
  }

  // Group by date
  const groupedLoads = loads.reduce((acc, load) => {
    const dateStr = format(new Date(load.date), 'MMMM d, yyyy');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(load);
    return acc;
  }, {} as Record<string, typeof loads>);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Load Plans" 
        description="Organize and dispatch your deliveries onto trucks."
        actionLabel="Create Plan"
        actionHref="/loads/new" 
      >
        <Link
          href="/loads/optimize"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Optimize
        </Link>
      </PageHeader>
      
      <div className="space-y-8">
        {Object.entries(groupedLoads).map(([dateLabel, groupLoads]) => (
          <div key={dateLabel}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{dateLabel}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(groupLoads as LoadPlanWithRelations[]).map((load) => {
                const totalWeight = load.items.reduce((sum, item) => sum + toNumber(item.delivery.weight), 0);
                return (
                  <LoadPlanCard 
                    key={load.id}
                    id={load.id}
                    date={format(new Date(load.date), 'MMM d, yyyy')}
                    status={load.status}
                    truckName={load.truck?.name || 'Unassigned Truck'}
                    driverName={load.driver?.name}
                    totalDeliveries={load._count?.items || 0}
                    totalWeight={totalWeight}
                    truckCapacity={load.truck?.weightCapacity || 0}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {loads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No load plans yet</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-xs">
              Create your first load plan to start organizing deliveries onto trucks.
            </p>
            <Link href="/loads/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors">
              <Plus className="h-4 w-4" />
              Create Plan
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
