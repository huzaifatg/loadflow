import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Truck,
  Users,
  Package,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Kanban,
  CheckCircle2,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth';
import { getDispatchCalendarData } from '@/lib/services/dispatch-board';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import {
  FilterTabs,
  FilterSelect,
  ClearFiltersButton,
} from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export default async function DispatchCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    truckId?: string;
    driverId?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dispatch & Scheduling Intelligence"
          title="Dispatch Calendar"
          description="Configure your company profile in Settings to view your dispatch schedule."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const resolved = await searchParams;
  const calendar = await getDispatchCalendarData(prisma, companyId, {
    date: resolved.date ?? null,
    status: resolved.status ?? 'ALL',
    truckId: resolved.truckId ?? 'ALL',
    driverId: resolved.driverId ?? 'ALL',
  });

  const buildDateHref = (targetDate: string) => {
    const sp = new URLSearchParams();
    sp.set('date', targetDate);
    if (resolved.status && resolved.status !== 'ALL') sp.set('status', resolved.status);
    if (resolved.truckId && resolved.truckId !== 'ALL') sp.set('truckId', resolved.truckId);
    if (resolved.driverId && resolved.driverId !== 'ALL') sp.set('driverId', resolved.driverId);
    return `/dispatch/calendar?${sp.toString()}`;
  };

  const selectedDayData =
    calendar.days.find((d) => d.isSelected) ?? calendar.days[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Weekly Dispatch Schedule • ${calendar.weekRangeLabel}`}
        title="Dispatch Calendar"
        description="Chronological 7-day fleet schedule with live dispatch readiness, resource commitments, and unassigned delivery deadlines."
        actionLabel="New Load Plan"
        actionHref="/loads/new"
      >
        {/* Week & Day Navigation Controls */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-2xs">
          <ButtonLink
            href={buildDateHref(calendar.prevWeekDate)}
            variant="ghost"
            size="xs"
            title="Previous week"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Week
          </ButtonLink>
          <ButtonLink
            href={buildDateHref(calendar.prevDayDate)}
            variant="ghost"
            size="icon-sm"
            aria-label="Previous day"
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </ButtonLink>
          <span className="px-2.5 text-xs font-semibold text-gray-800 tabular-nums">
            {calendar.weekRangeLabel}
          </span>
          <ButtonLink
            href={buildDateHref(calendar.nextDayDate)}
            variant="ghost"
            size="icon-sm"
            aria-label="Next day"
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink
            href={buildDateHref(calendar.nextWeekDate)}
            variant="ghost"
            size="xs"
            title="Next week"
          >
            Week
            <ChevronRight className="h-3.5 w-3.5" />
          </ButtonLink>
          <ButtonLink
            href={buildDateHref(calendar.todayDate)}
            variant="secondary"
            size="xs"
          >
            Today
          </ButtonLink>
        </div>

        <ButtonLink
          href={`/dispatch?date=${calendar.selectedDate}`}
          variant="secondary"
          size="md"
        >
          <Kanban className="h-4 w-4 text-primary-600" />
          Dispatch Board
        </ButtonLink>
      </PageHeader>

      {/* Weekly Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Plans This Week"
          value={calendar.summary.totalPlansInWeek}
          sublabel={`${calendar.summary.draftCount} draft • ${calendar.summary.readyCount} ready`}
          icon={<Calendar className="h-4 w-4" />}
          tone="primary"
        />
        <MetricCard
          label="Dispatched & Completed"
          value={`${calendar.summary.dispatchedCount} / ${calendar.summary.completedCount}`}
          sublabel="In transit vs completed this week"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <MetricCard
          label="Unassigned Due This Week"
          value={calendar.summary.unassignedDueInWeek}
          sublabel="Pending deliveries with scheduled dates"
          icon={<Package className="h-4 w-4" />}
          tone={calendar.summary.unassignedDueInWeek > 0 ? 'warning' : 'neutral'}
          href="/deliveries?status=PENDING"
        />
        <MetricCard
          label="Plans With Conflicts"
          value={calendar.summary.conflictsInWeek}
          sublabel={
            calendar.summary.conflictsInWeek > 0
              ? 'Blocking resource or capacity conflicts'
              : 'All weekly plans conflict-free'
          }
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={calendar.summary.conflictsInWeek > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All Plans' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'READY', label: 'Ready' },
            { value: 'DISPATCHED', label: 'Dispatched' },
            { value: 'COMPLETED', label: 'Completed' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect
            paramName="truckId"
            defaultValue="ALL"
            options={[
              { value: 'ALL', label: 'Truck: All Vehicles' },
              ...calendar.trucks.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.plateNumber})`,
              })),
            ]}
          />
          <FilterSelect
            paramName="driverId"
            defaultValue="ALL"
            options={[
              { value: 'ALL', label: 'Driver: All Drivers' },
              { value: 'UNASSIGNED', label: 'Driver: Unassigned Only' },
              ...calendar.drivers.map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
          <ClearFiltersButton paramNames={['status', 'truckId', 'driverId']} />
        </div>
      </div>

      {/* 7-Day Weekly Schedule Grid */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-7">
        {calendar.days.map((day) => (
          <div
            key={day.date}
            className={cn(
              'flex min-h-[290px] flex-col overflow-hidden rounded-xl border bg-white shadow-xs transition-all',
              day.isSelected
                ? 'border-primary-400 ring-2 ring-primary-500/20'
                : day.isToday
                  ? 'border-primary-300 ring-1 ring-primary-200'
                  : 'border-gray-200'
            )}
          >
            {/* Day Column Header */}
            <Link
              href={buildDateHref(day.date)}
              className={cn(
                'flex items-center justify-between border-b px-3.5 py-2.5 transition-colors',
                day.isSelected
                  ? 'border-primary-200 bg-primary-50/80'
                  : day.isToday
                    ? 'border-primary-100 bg-primary-50/40'
                    : 'border-gray-200 bg-gray-50/80 hover:bg-gray-100/70'
              )}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      day.isToday || day.isSelected
                        ? 'text-primary-700'
                        : 'text-gray-500'
                    )}
                  >
                    {day.dayShort}
                  </span>
                  {day.isToday && (
                    <Badge tone="primary" size="sm">
                      Today
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-900">
                  {day.dayNumber}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-700 ring-1 ring-inset ring-gray-200 tabular-nums">
                {day.plans.length}
              </span>
            </Link>

            {/* Day Plans List */}
            <div className="flex-1 space-y-2.5 bg-gray-50/20 p-2.5">
              {day.plans.map((plan) => {
                const hasBlocking = plan.conflicts.some(
                  (c) => c.severity === 'BLOCKING'
                );
                return (
                  <Link
                    key={plan.id}
                    href={`/loads/${plan.id}`}
                    className={cn(
                      'block rounded-lg border bg-white p-2.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs space-y-1.5',
                      hasBlocking ? 'border-rose-300' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <StatusBadge domain="loadPlan" status={plan.status} />
                      <span className="text-[11px] font-semibold text-gray-600 tabular-nums">
                        {plan.deliveryCount}{' '}
                        {plan.deliveryCount === 1 ? 'stop' : 'stops'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-bold text-gray-900">
                        {plan.planRef}
                      </p>
                      <Badge tone={plan.readiness.readinessTone} size="sm">
                        {plan.readiness.readinessLabel}
                      </Badge>
                    </div>

                    <p className="truncate text-[11px] font-medium text-gray-700">
                      <Truck className="mr-1 inline h-3 w-3 text-gray-400" />
                      {plan.truck.name}
                    </p>
                    <p
                      className={cn(
                        'truncate text-[11px]',
                        plan.driver
                          ? 'text-gray-500'
                          : 'font-semibold text-amber-700'
                      )}
                    >
                      <Users className="mr-1 inline h-3 w-3 text-gray-400" />
                      {plan.driver?.name || 'Driver unassigned'}
                    </p>

                    <div className="pt-0.5 text-[10px] font-semibold text-gray-500 tabular-nums">
                      {Math.round(plan.totalWeight).toLocaleString()} /{' '}
                      {Math.round(plan.truckCapacity).toLocaleString()} kg
                    </div>
                  </Link>
                );
              })}

              {/* Unassigned Deliveries Due Indicator */}
              {day.unassignedDeliveriesDue.length > 0 && (
                <Link
                  href={`/dispatch?date=${day.date}&scope=date`}
                  className="block rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-800 hover:bg-amber-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1 font-bold">
                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                    <span>
                      {day.unassignedDeliveriesDue.length} unassigned{' '}
                      {day.unassignedDeliveriesDue.length === 1
                        ? 'delivery'
                        : 'deliveries'}{' '}
                      due
                    </span>
                  </div>
                </Link>
              )}

              {day.plans.length === 0 &&
                day.unassignedDeliveriesDue.length === 0 && (
                  <div className="flex h-36 flex-col items-center justify-center text-center text-xs text-gray-400">
                    <Calendar className="mb-1 h-4 w-4 text-gray-300" />
                    <span>No scheduled plans</span>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Operating Day Detail Section */}
      {selectedDayData && (
        <Card>
          <CardHeader
            title={`Selected Operating Date: ${calendar.selectedDateLabel}`}
            description={`${selectedDayData.plans.length} scheduled load ${selectedDayData.plans.length === 1 ? 'plan' : 'plans'} and ${selectedDayData.unassignedDeliveriesDue.length} unassigned ${selectedDayData.unassignedDeliveriesDue.length === 1 ? 'delivery' : 'deliveries'} due`}
            bordered
            actions={
              <ButtonLink
                href={`/dispatch?date=${calendar.selectedDate}&scope=date`}
                variant="primary"
                size="xs"
              >
                <Kanban className="h-3.5 w-3.5" />
                Open Date in Dispatch Board
              </ButtonLink>
            }
          />
          <div className="p-4">
            {selectedDayData.plans.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title={`No load plans scheduled for ${selectedDayData.dayNumber}`}
                description="Create a load plan for this operating date or open the Dispatch Board to allocate pending deliveries."
                actionLabel="Create Load Plan"
                actionHref="/loads/new"
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {selectedDayData.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/loads/${plan.id}`}
                          className="text-sm font-bold text-gray-900 hover:text-primary-600"
                        >
                          {plan.planRef}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={plan.readiness.readinessTone} size="sm" dot>
                            {plan.readiness.readinessLabel}
                          </Badge>
                          <StatusBadge domain="loadPlan" status={plan.status} />
                        </div>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Truck:</span>
                          <span className="font-semibold text-gray-900">
                            {plan.truck.name} ({plan.truck.plateNumber})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Driver:</span>
                          <span
                            className={cn(
                              'font-semibold',
                              plan.driver ? 'text-gray-900' : 'text-amber-700'
                            )}
                          >
                            {plan.driver?.name || 'Unassigned'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Deliveries:</span>
                          <span className="font-semibold text-gray-900">
                            {plan.deliveryCount}{' '}
                            {plan.deliveryCount === 1 ? 'stop' : 'stops'}
                          </span>
                        </div>
                      </div>

                      <CapacityBar
                        current={Math.round(plan.totalWeight)}
                        max={plan.truckCapacity}
                        size="sm"
                      />

                      {plan.readiness.blockingReasons.length > 0 && (
                        <div className="rounded-md border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-[11px] font-medium text-rose-800">
                          {plan.readiness.blockingReasons[0]}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs">
                      <Link
                        href={`/dispatch?date=${calendar.selectedDate}`}
                        className="font-medium text-gray-600 hover:text-primary-600"
                      >
                        Manage on Board
                      </Link>
                      <Link
                        href={`/loads/${plan.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Open Plan <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

