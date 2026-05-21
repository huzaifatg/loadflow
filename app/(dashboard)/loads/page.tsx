import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadPlanCard } from '@/components/loads/LoadPlanCard';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';

export default async function LoadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  let company = null;
  let loads: any[] = [];
  let dbError = false;

  try {
    company = await prisma.company.findFirst();
    
    if (company) {
      loads = await prisma.loadPlan.findMany({
        where: { companyId: company.id },
        include: {
          truck: true,
          driver: true,
          _count: {
            select: { items: true }
          }
        },
        orderBy: { date: 'desc' },
      });
    }
  } catch (error) {
    console.error("Database connection failed:", error);
    dbError = true;
  }

  // Group by date
  const groupedLoads = loads.reduce((acc, load) => {
    const dateStr = format(new Date(load.date), 'MMMM d, yyyy');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(load);
    return acc;
  }, {} as Record<string, typeof loads>);

  const hasData = loads.length > 0;

  // Mock data if none exists
  const mockGroups = {
    'Today': [
      { id: 'mock-l1', date: new Date(), status: 'DISPATCHED', truck: { name: 'Volvo FH16' }, driver: { name: 'Marcus J.' }, _count: { items: 4 } },
      { id: 'mock-l2', date: new Date(), status: 'CONFIRMED', truck: { name: 'Scania R450' }, driver: { name: 'Sarah C.' }, _count: { items: 2 } }
    ],
    'Tomorrow': [
      { id: 'mock-l3', date: new Date(Date.now() + 86400000), status: 'DRAFT', truck: { name: 'Mercedes Actros' }, driver: null, _count: { items: 6 } },
    ]
  };

  const displayGroups = hasData ? groupedLoads : mockGroups;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Load Plans" 
        description="Organize and dispatch your deliveries onto trucks."
        actionLabel="Create Plan"
        // In a real app, this might open a modal to select a date and truck first
        // For now, we'll just link to a builder with a mock new ID
        actionHref="/loads/new" 
      />
      
      <div className="space-y-8">
        {Object.entries(displayGroups).map(([dateLabel, groupLoads]) => (
          <div key={dateLabel}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">{dateLabel}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(groupLoads as any[]).map((load: any) => (
                <LoadPlanCard 
                  key={load.id}
                  id={load.id}
                  date={format(new Date(load.date), 'MMM d, yyyy')}
                  status={load.status}
                  truckName={load.truck?.name || 'Unassigned Truck'}
                  driverName={load.driver?.name}
                  totalDeliveries={load._count?.items || 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
