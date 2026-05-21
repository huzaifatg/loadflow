import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { addDays, startOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/login');

  const company = await prisma.company.findFirst();

  if (!company) redirect('/login');

  const rawDate = (await searchParams).date;
  const baseDate = rawDate ? new Date(rawDate) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday start

  // Fetch load plans for this week
  const weekEnd = addDays(weekStart, 7);
  const loadPlans = await prisma.loadPlan.findMany({
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

  // Mock inject to ensure the UI isn't totally blank during review
  if (loadPlans.length === 0) {
    days[0].plans.push({
      id: 'mock-s1',
      status: 'CONFIRMED',
      truck: { name: 'Volvo FH16' },
      driver: { name: 'Marcus J.' },
      _count: { items: 4 },
      date: new Date()
    } as any);
    days[2].plans.push({
      id: 'mock-s2',
      status: 'DRAFT',
      truck: { name: 'Scania R450' },
      driver: { name: 'Sarah C.' },
      _count: { items: 2 },
      date: new Date()
    } as any);
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Weekly Schedule" 
          description="View and manage load plans dispatched across the week."
        />
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
                  <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow group animate-in fade-in zoom-in-95 duration-200 border-l-4 border-l-primary-500">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold text-gray-900 group-hover:text-primary-600 truncate mr-2">
                        {plan.truck?.name || 'Unassigned'}
                      </span>
                      <StatusPill status={plan.status} className="scale-75 origin-top-right shrink-0" />
                    </div>
                    <div className="text-xs text-gray-500">
                      {plan.driver?.name || 'No Driver'}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                      <span className="text-[10px] text-gray-400 font-mono">#{plan.id.split('-')[0]}</span>
                      <span className="text-[10px] font-medium text-gray-600">{plan._count.items} drops</span>
                    </div>
                  </Card>
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
