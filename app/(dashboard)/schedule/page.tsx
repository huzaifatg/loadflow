import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { addDays, startOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { LoadPlan, Truck, Driver } from '@prisma/client';

type LoadPlanWithRelations = LoadPlan & {
  truck: Truck | null;
  driver: Driver | null;
  _count: { items: number };
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const rawDate = (await searchParams).date;
  const baseDate = rawDate ? new Date(rawDate) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday start
  const weekEnd = addDays(weekStart, 7);

  let loadPlans: LoadPlanWithRelations[] = [];
  try {
    const company = await prisma.company.findFirst();
    if (company) {
      loadPlans = await prisma.loadPlan.findMany({
        where: {
          companyId: company.id,
          date: {
            gte: weekStart,
            lt: weekEnd,
          }
        },
        include: {
          truck: true,
          driver: true,
          _count: { select: { items: true } }
        }
      });
    }
  } catch (err) {
    console.error("Prisma Connection Error in Schedule:", err);
  }

  const prevWeekStr = format(addDays(weekStart, -7), 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(weekStart, 7), 'yyyy-MM-dd');

  // Generate days array
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: d,
      dateStr: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE, MMM d'),
      plans: loadPlans.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'))
    };
  });

  // Sort plans chronologically
  days.forEach(day => {
    day.plans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Schedule Overview" 
          description="Weekly view of your dispatched and upcoming load plans."
        >
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-500/10">
            <Lock className="w-3 h-3 mr-1" />
            Read-Only View
          </span>
        </PageHeader>
        <div className="flex items-center gap-2 pb-8">
          <Link href={`/schedule?date=${prevWeekStr}`}>
            <Button variant="secondary" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <span className="text-sm font-medium px-4 text-gray-700">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Link href={`/schedule?date=${nextWeekStr}`}>
            <Button variant="secondary" size="sm"><ChevronRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-7 gap-4 flex-1">
        {days.map((day) => (
          <div key={day.dateStr} className="flex flex-col h-full bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 text-center">
              <span className="text-sm font-semibold text-gray-700">{day.label}</span>
            </div>
            <div className="flex-1 p-3 space-y-3 bg-gray-50/30 overflow-y-auto">
              {day.plans.map(plan => (
                <Link key={plan.id} href={`/loads/${plan.id}`}>
                  <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg group hover:border-gray-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase",
                        plan.status === 'DRAFT' ? "bg-gray-200 text-gray-700" :
                        plan.status === 'READY' ? "bg-amber-100 text-amber-800" :
                        plan.status === 'DISPATCHED' ? "bg-blue-100 text-blue-800" :
                        plan.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-800" :
                        "bg-gray-100 text-gray-800"
                      )}>
                        {plan.status}
                      </span>
                      <span className="text-xs font-medium text-gray-500">{plan._count?.items || 0} stops</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {plan.truck?.name || 'Unassigned'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {plan.driver?.name || 'No driver'}
                    </p>
                  </div>
                </Link>
              ))}
              {day.plans.length === 0 && (
                <div className="h-full min-h-[100px] flex items-center justify-center text-xs text-gray-400">
                  No plans
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
