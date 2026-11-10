import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import type { LoadPlan, Truck, Driver } from '@prisma/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { getAuthContext } from '@/lib/auth';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const rawDate = (await searchParams).date;
  const baseDate = rawDate ? new Date(rawDate) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const today = new Date();

  let loadPlans: LoadPlanWithRelations[] = [];
  try {
    const auth = await getAuthContext();
    const company = auth?.company;
    if (company) {
      loadPlans = await prisma.loadPlan.findMany({
        where: {
          companyId: company.id,
          date: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        include: {
          truck: true,
          driver: true,
          _count: { select: { items: true } },
        },
        orderBy: { date: 'asc' },
      });
    }
  } catch (err) {
    console.error('Prisma Connection Error in Schedule:', err);
  }

  const prevWeekStr = format(addDays(weekStart, -7), 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(weekStart, 7), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const dStr = format(d, 'yyyy-MM-dd');
    return {
      date: d,
      dateStr: dStr,
      dayName: format(d, 'EEE'),
      dayNumber: format(d, 'MMM d'),
      isToday: isSameDay(d, today),
      plans: loadPlans.filter(
        (p) => format(new Date(p.date), 'yyyy-MM-dd') === dStr
      ),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Weekly Dispatch Calendar"
        title="Schedule Overview"
        description="Chronological 7-day calendar of draft, ready, dispatched, and completed load plans."
        actionLabel="New Load Plan"
        actionHref="/loads/new"
      >
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1 shadow-2xs">
          <ButtonLink
            href={`/schedule?date=${prevWeekStr}`}
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </ButtonLink>
          <span className="px-2.5 text-xs font-semibold text-gray-800 tabular-nums">
            {format(weekStart, 'MMM d')} –{' '}
            {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <ButtonLink
            href={`/schedule?date=${nextWeekStr}`}
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink
            href={`/schedule?date=${todayStr}`}
            variant="secondary"
            size="xs"
          >
            Today
          </ButtonLink>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.dateStr}
            className={cn(
              'flex min-h-[260px] flex-col overflow-hidden rounded-xl border bg-white shadow-xs',
              day.isToday ? 'border-primary-300 ring-1 ring-primary-200' : 'border-gray-200'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between border-b px-3.5 py-2.5',
                day.isToday
                  ? 'border-primary-200 bg-primary-50/60'
                  : 'border-gray-200 bg-gray-50/80'
              )}
            >
              <div>
                <span
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    day.isToday ? 'text-primary-700' : 'text-gray-500'
                  )}
                >
                  {day.dayName}
                </span>
                <p className="text-xs font-semibold text-gray-900">
                  {day.dayNumber}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 ring-1 ring-inset ring-gray-200 tabular-nums">
                {day.plans.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 bg-gray-50/20 p-2.5">
              {day.plans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/loads/${plan.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-2.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <StatusBadge domain="loadPlan" status={plan.status} />
                    <span className="text-[11px] font-medium text-gray-500 tabular-nums">
                      {plan._count?.items || 0}{' '}
                      {plan._count?.items === 1 ? 'stop' : 'stops'}
                    </span>
                  </div>
                  <p className="truncate text-xs font-bold text-gray-900">
                    {plan.truck?.name || 'Unassigned'}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {plan.driver?.name || 'Driver unassigned'}
                  </p>
                </Link>
              ))}

              {day.plans.length === 0 && (
                <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-gray-400">
                  <Calendar className="mb-1 h-4 w-4 text-gray-300" />
                  <span>No plans</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
