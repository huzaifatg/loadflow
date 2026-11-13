'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Truck,
  Users,
  Package,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  ShieldAlert,
  ArrowRight,
  Plus,
  Search,
  X,
  UserPlus,
  Flag,
  Sparkles,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuickAssignResourcesDialog } from './QuickAssignResourcesDialog';
import { QuickAllocateDeliveryDialog } from './QuickAllocateDeliveryDialog';
import type {
  DispatchBoardResult,
  DispatchLoadPlanDTO,
  DispatchDeliveryItemDTO,
} from '@/lib/services/dispatch-board';
import { cn } from '@/lib/utils';

export interface DispatchBoardClientProps {
  board: DispatchBoardResult;
  initialFilters: {
    q: string;
    status: string;
    assignment: string;
    truckId: string;
    driverId: string;
    conflict: string;
    overdue: string;
  };
}

const PLAN_GROUPS: {
  key: 'DRAFT' | 'READY' | 'DISPATCHED' | 'COMPLETED';
  label: string;
  subtitle: string;
  headerBg: string;
}[] = [
  {
    key: 'DRAFT',
    label: 'Draft Plans',
    subtitle: 'Editable — allocating stops & resources',
    headerBg: 'border-gray-200 bg-gray-50/90',
  },
  {
    key: 'READY',
    label: 'Ready for Dispatch',
    subtitle: 'Locked & verified for departure',
    headerBg: 'border-sky-200 bg-sky-50/60',
  },
  {
    key: 'DISPATCHED',
    label: 'Dispatched (In Transit)',
    subtitle: 'Vehicles active on the road',
    headerBg: 'border-primary-200 bg-primary-50/50',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    subtitle: 'Fulfilled routes & released fleet',
    headerBg: 'border-emerald-200 bg-emerald-50/50',
  },
];

export function DispatchBoardClient({
  board,
  initialFilters,
}: DispatchBoardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(initialFilters.q);
  const [assigningPlan, setAssigningPlan] = useState<DispatchLoadPlanDTO | null>(null);
  const [allocatingDelivery, setAllocatingDelivery] =
    useState<DispatchDeliveryItemDTO | null>(null);

  const [lifecycleConfirm, setLifecycleConfirm] = useState<{
    plan: DispatchLoadPlanDTO;
    targetStatus: 'READY' | 'DISPATCHED' | 'COMPLETED' | 'DRAFT';
  } | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const [resourceTab, setResourceTab] = useState<'trucks' | 'drivers'>('trucks');

  function updateQueryParams(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === 'ALL') {
        sp.delete(k);
      } else {
        sp.set(k, v);
      }
    }
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQueryParams({ q: searchInput.trim() || null });
  }

  function handleClearAllFilters() {
    setSearchInput('');
    const sp = new URLSearchParams();
    if (searchParams.get('date')) sp.set('date', searchParams.get('date')!);
    if (searchParams.get('scope')) sp.set('scope', searchParams.get('scope')!);
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  async function executeLifecycleTransition() {
    if (!lifecycleConfirm || lifecycleLoading) return;
    setLifecycleLoading(true);
    const { plan, targetStatus } = lifecycleConfirm;
    try {
      const res = await fetch(`/api/loads/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detail =
          Array.isArray(errData?.reasons) && errData.reasons.length > 0
            ? `${errData.error}: ${errData.reasons.join(' ')}`
            : errData?.error || `Failed to transition ${plan.planRef}`;
        toast.error(detail);
        setLifecycleConfirm(null);
        return;
      }

      toast.success(`${plan.planRef} transitioned to ${targetStatus}`);
      setLifecycleConfirm(null);
      router.refresh();
    } catch {
      toast.error('Network error while updating load plan status');
    } finally {
      setLifecycleLoading(false);
    }
  }

  const hasActiveFilters =
    Boolean(initialFilters.q) ||
    initialFilters.status !== 'ALL' ||
    initialFilters.assignment !== 'ALL' ||
    initialFilters.truckId !== 'ALL' ||
    initialFilters.driverId !== 'ALL' ||
    initialFilters.conflict !== 'ALL' ||
    initialFilters.overdue !== 'ALL';

  const visibleGroups =
    initialFilters.status !== 'ALL'
      ? PLAN_GROUPS.filter((g) => g.key === initialFilters.status)
      : PLAN_GROUPS;

  return (
    <div className="space-y-6">
      {/* ── A. Dispatch Board Header & Date Controls ─────────────────────────── */}
      <PageHeader
        eyebrow={`Operating Date • ${board.operatingDateLabel}`}
        title="Dispatch Board"
        description="Centralized dispatch control, unassigned delivery queue, resource availability intelligence, and real-time conflict detection."
        meta={
          <Badge tone={board.isToday ? 'primary' : 'neutral'} size="md" dot>
            {board.summary.plansOnOperatingDate}{' '}
            {board.summary.plansOnOperatingDate === 1 ? 'plan' : 'plans'} on{' '}
            {board.isToday ? 'Today' : board.operatingDate}
          </Badge>
        }
        actionLabel="New Load Plan"
        actionHref="/loads/new"
      >
        {/* Date Navigation Bar */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-2xs">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => updateQueryParams({ date: board.prevDate })}
            aria-label="Previous day"
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            aria-label="Operating date"
            value={board.operatingDate}
            onChange={(e) => {
              if (e.target.value) updateQueryParams({ date: e.target.value });
            }}
            className="h-7 rounded border-0 bg-transparent px-2 text-xs font-semibold text-gray-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => updateQueryParams({ date: board.nextDate })}
            aria-label="Next day"
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!board.isToday && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => updateQueryParams({ date: board.todayDate })}
            >
              Today
            </Button>
          )}
        </div>

        {/* Scope Toggle: All Active vs Operating Date Only */}
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => updateQueryParams({ scope: null })}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              board.scope === 'all_active'
                ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            All Active + Date
          </button>
          <button
            type="button"
            onClick={() => updateQueryParams({ scope: 'date' })}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
              board.scope === 'date'
                ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Date Only ({board.summary.plansOnOperatingDate})
          </button>
        </div>

        <ButtonLink
          href={`/dispatch/calendar?date=${board.operatingDate}`}
          variant="secondary"
          size="md"
        >
          <Calendar className="h-4 w-4 text-primary-600" />
          Calendar
        </ButtonLink>

        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
          title="Refresh Dispatch Board"
          aria-label="Refresh Dispatch Board"
        >
          <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
        </Button>
      </PageHeader>

      {/* ── B. 6 Summary Indicators (Real Company-Scoped Data) ───────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Pending Deliveries"
          value={board.summary.pendingDeliveries}
          sublabel={`${board.summary.dueTodayDeliveries} due on operating date`}
          icon={<Package className="h-4 w-4" />}
          tone={board.summary.pendingDeliveries > 0 ? 'warning' : 'neutral'}
          href="/deliveries?status=PENDING"
        />
        <MetricCard
          label="Unassigned Queue"
          value={board.summary.unassignedDeliveries}
          sublabel="Awaiting load plan allocation"
          icon={<Clock className="h-4 w-4" />}
          tone={board.summary.unassignedDeliveries > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Ready Load Plans"
          value={board.summary.readyLoadPlans}
          sublabel={`${board.summary.draftLoadPlans} draft plans in progress`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={board.summary.readyLoadPlans > 0 ? 'info' : 'neutral'}
        />
        <MetricCard
          label="Dispatched Plans"
          value={board.summary.dispatchedLoadPlans}
          sublabel={`${board.summary.availableTrucks}/${board.summary.totalTrucks} trucks available`}
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
        />
        <MetricCard
          label="Overdue Deliveries"
          value={board.summary.overdueDeliveries}
          sublabel={
            board.summary.overdueDeliveries > 0
              ? 'Past scheduled date, unplanned'
              : 'No overdue pending deliveries'
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={board.summary.overdueDeliveries > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="Resource Conflicts"
          value={board.summary.resourceConflictsCount}
          sublabel={
            board.summary.blockingPlansCount > 0
              ? `${board.summary.blockingPlansCount} ${board.summary.blockingPlansCount === 1 ? 'plan' : 'plans'} blocked`
              : 'All active plans conflict-free'
          }
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={board.summary.resourceConflictsCount > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* ── I. Filtering & Search Toolbar ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search plan #, customer, address, truck, plate, driver..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateQueryParams({ q: null });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Lifecycle Status Filter */}
            <select
              aria-label="Filter by load plan status"
              value={initialFilters.status}
              onChange={(e) => updateQueryParams({ status: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: All Lifecycle States</option>
              <option value="DRAFT">Status: Draft ({board.summary.draftLoadPlans})</option>
              <option value="READY">Status: Ready ({board.summary.readyLoadPlans})</option>
              <option value="DISPATCHED">
                Status: Dispatched ({board.summary.dispatchedLoadPlans})
              </option>
              <option value="COMPLETED">
                Status: Completed ({board.summary.completedLoadPlans})
              </option>
            </select>

            {/* Assignment / Readiness Filter */}
            <select
              aria-label="Filter by readiness or assignment"
              value={initialFilters.assignment}
              onChange={(e) => updateQueryParams({ assignment: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Readiness: All Plans</option>
              <option value="READY_ONLY">Ready to Lock / Dispatch</option>
              <option value="UNASSIGNED_DRIVER">Missing Driver Assignment</option>
              <option value="BLOCKED_ONLY">Blocked Plans Only</option>
            </select>

            {/* Conflict Filter */}
            <select
              aria-label="Filter by conflict state"
              value={initialFilters.conflict}
              onChange={(e) => updateQueryParams({ conflict: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Conflicts: All</option>
              <option value="BLOCKING_ONLY">Blocking Conflicts Only</option>
              <option value="HAS_CONFLICTS">Any Conflict or Warning</option>
            </select>

            {/* Overdue Filter */}
            <select
              aria-label="Filter by overdue state"
              value={initialFilters.overdue}
              onChange={(e) => updateQueryParams({ overdue: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Schedule: All Dates</option>
              <option value="OVERDUE_ONLY">Overdue Only</option>
              <option value="DUE_TODAY">Due Today & Overdue</option>
            </select>

            {/* Truck Filter */}
            <select
              aria-label="Filter by truck"
              value={initialFilters.truckId}
              onChange={(e) => updateQueryParams({ truckId: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Truck: All Vehicles</option>
              {board.availability.trucks.map((t) => (
                <option key={t.resourceId} value={t.resourceId}>
                  {t.resourceName} ({t.plateNumber})
                </option>
              ))}
            </select>

            {/* Driver Filter */}
            <select
              aria-label="Filter by driver"
              value={initialFilters.driverId}
              onChange={(e) => updateQueryParams({ driverId: e.target.value })}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-primary-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Driver: All Drivers</option>
              <option value="UNASSIGNED">Driver: Unassigned Only</option>
              {board.availability.drivers.map((d) => (
                <option key={d.resourceId} value={d.resourceId}>
                  {d.resourceName}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleClearAllFilters}
              >
                <X className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Workspace Grid: Unassigned Delivery Queue (4 cols) + Load Plan Board (8 cols) ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* C. Unassigned Delivery Queue (4 columns on XL) */}
        <div className="xl:col-span-4 flex flex-col space-y-4">
          <Card className="flex flex-col overflow-hidden">
            <CardHeader
              title={`Unassigned Delivery Queue (${board.unassignedQueue.length})`}
              description="Pending orders requiring allocation to a draft load plan"
              bordered
              actions={
                <div className="flex items-center gap-1.5">
                  <ButtonLink href="/loads/optimize" variant="ghost" size="xs">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary-600" />
                    Auto-Pack
                  </ButtonLink>
                  <ButtonLink href="/deliveries/new" variant="secondary" size="xs">
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </ButtonLink>
                </div>
              }
            />

            <div className="max-h-[680px] overflow-y-auto divide-y divide-gray-100">
              {board.unassignedQueue.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-5 w-5" />}
                  title="No unassigned pending deliveries"
                  description={
                    hasActiveFilters
                      ? 'No unassigned deliveries match your current search or overdue filters.'
                      : 'All pending deliveries have been allocated to a load plan.'
                  }
                  actionLabel="Create Delivery"
                  actionHref="/deliveries/new"
                />
              ) : (
                board.unassignedQueue.map((del) => (
                  <div
                    key={del.id}
                    className={cn(
                      'p-3.5 transition-colors hover:bg-gray-50/80 space-y-2',
                      del.urgency === 'OVERDUE' && 'bg-rose-50/25'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-gray-500">
                            {del.reference}
                          </span>
                          <Badge
                            tone={
                              del.urgency === 'OVERDUE'
                                ? 'danger'
                                : del.urgency === 'DUE_TODAY'
                                  ? 'warning'
                                  : 'neutral'
                            }
                            size="sm"
                          >
                            {del.urgencyLabel}
                          </Badge>
                        </div>
                        <Link
                          href={`/deliveries/${del.id}`}
                          className="mt-0.5 block truncate text-sm font-bold text-gray-900 hover:text-primary-600"
                        >
                          {del.customerName}
                        </Link>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-gray-900 tabular-nums">
                          {Math.round(del.weight).toLocaleString()} kg
                        </span>
                        <span className="block text-[10px] font-medium text-amber-700">
                          Unassigned
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600">
                      <div className="truncate">
                        <span className="font-semibold text-gray-500">Origin:</span>{' '}
                        {del.pickupAddress}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-gray-500">Dest:</span>{' '}
                        {del.deliveryAddress}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <Link
                        href={`/deliveries/${del.id}`}
                        className="text-xs font-semibold text-gray-600 hover:text-primary-600"
                      >
                        Delivery Details →
                      </Link>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setAllocatingDelivery(del)}
                      >
                        <Plus className="h-3.5 w-3.5 text-primary-600" />
                        Assign to Plan
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* D. Load Plan Board Grouped by Operational Lifecycle State (8 columns on XL) */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Load Plan Dispatch Board ({board.loadPlans.length})
              </h2>
              <p className="text-xs text-gray-500">
                Grouped by actual LoadPlan lifecycle status with real-time readiness & conflict checks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ButtonLink href="/loads/recommend" variant="secondary" size="xs">
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                Recommend Fleet
              </ButtonLink>
              <ButtonLink href="/loads" variant="ghost" size="xs">
                All Load Plans →
              </ButtonLink>
            </div>
          </div>

          {board.loadPlans.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No load plans match your current view"
                description={
                  hasActiveFilters || board.scope === 'date'
                    ? 'Try switching from "Date Only" to "All Active + Date" or clearing your filters.'
                    : 'Create a new draft load plan or use the Multi-Load Optimizer to pack pending deliveries.'
                }
                actionLabel="Create Load Plan"
                actionHref="/loads/new"
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleGroups.map((group) => {
                const plansInGroup = board.groupedPlans[group.key];
                return (
                  <div
                    key={group.key}
                    className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 shadow-2xs overflow-hidden"
                  >
                    {/* Column Header */}
                    <div
                      className={cn(
                        'flex items-center justify-between border-b px-4 py-3',
                        group.headerBg
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                            {group.label}
                          </h3>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-700 ring-1 ring-inset ring-gray-200 tabular-nums">
                            {plansInGroup.length}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {group.subtitle}
                        </p>
                      </div>
                      <StatusBadge domain="loadPlan" status={group.key} />
                    </div>

                    {/* Cards List */}
                    <div className="flex-1 space-y-3 p-3 max-h-[620px] overflow-y-auto">
                      {plansInGroup.length === 0 ? (
                        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/60 p-4 text-center text-xs text-gray-400">
                          No {group.label.toLowerCase()} in current view
                        </div>
                      ) : (
                        plansInGroup.map((plan) => {
                          const blockingConflicts = plan.conflicts.filter(
                            (c) => c.severity === 'BLOCKING'
                          );
                          const warningConflicts = plan.conflicts.filter(
                            (c) => c.severity === 'WARNING'
                          );

                          return (
                            <div
                              key={plan.id}
                              className={cn(
                                'rounded-xl border bg-white p-3.5 shadow-2xs transition-all hover:shadow-xs space-y-3',
                                blockingConflicts.length > 0
                                  ? 'border-rose-300 ring-1 ring-rose-100'
                                  : plan.readiness.readinessState === 'READY_TO_DISPATCH'
                                    ? 'border-emerald-300'
                                    : 'border-gray-200'
                              )}
                            >
                              {/* Top Row: Reference, Date & Readiness */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Link
                                      href={`/loads/${plan.id}`}
                                      className="text-sm font-bold text-gray-900 hover:text-primary-600"
                                    >
                                      {plan.planRef}
                                    </Link>
                                    {plan.isOperatingDate && (
                                      <Badge tone="primary" size="sm">
                                        Operating Date
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 tabular-nums">
                                    <Calendar className="h-3 w-3 text-gray-400" />
                                    {plan.dateLabel} • {plan.deliveryCount}{' '}
                                    {plan.deliveryCount === 1 ? 'delivery' : 'deliveries'}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    tone={plan.readiness.readinessTone}
                                    size="sm"
                                    dot
                                  >
                                    {plan.readiness.readinessLabel}
                                  </Badge>
                                </div>
                              </div>

                              {/* Resource Box: Truck & Driver */}
                              <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50/80 p-2.5 text-xs">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                                    Truck
                                  </span>
                                  <Link
                                    href={`/trucks/${plan.truck.id}`}
                                    className="mt-0.5 flex items-center gap-1 font-semibold text-gray-900 hover:text-primary-600 truncate"
                                  >
                                    <Truck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                    <span className="truncate">{plan.truck.name}</span>
                                  </Link>
                                  <span className="block text-[11px] font-mono text-gray-500">
                                    {plan.truck.plateNumber}
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                                    Driver
                                  </span>
                                  {plan.driver ? (
                                    <>
                                      <Link
                                        href={`/drivers/${plan.driver.id}`}
                                        className="mt-0.5 flex items-center gap-1 font-semibold text-gray-900 hover:text-primary-600 truncate"
                                      >
                                        <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                        <span className="truncate">{plan.driver.name}</span>
                                      </Link>
                                      <span className="block text-[11px] text-gray-500 truncate">
                                        {plan.driver.status}
                                      </span>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setAssigningPlan(plan)}
                                      className="mt-0.5 inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                      Assign Driver
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Capacity Bar */}
                              <div>
                                <CapacityBar
                                  current={Math.round(plan.totalWeight)}
                                  max={plan.truckCapacity}
                                  size="sm"
                                />
                              </div>

                              {/* Readiness & Conflict Reasons */}
                              {(plan.readiness.blockingReasons.length > 0 ||
                                warningConflicts.length > 0) && (
                                <div className="space-y-1.5">
                                  {plan.readiness.blockingReasons.map((reason, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50/80 px-2.5 py-1.5 text-[11px] font-medium text-rose-800"
                                    >
                                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                                      <span>{reason}</span>
                                    </div>
                                  ))}
                                  {warningConflicts.slice(0, 2).map((w) => (
                                    <div
                                      key={w.id}
                                      className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-800"
                                    >
                                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                      <span>{w.message}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Quick Actions Bar (Feature G) */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {plan.readiness.canAssignResources && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => setAssigningPlan(plan)}
                                    >
                                      <UserPlus className="h-3.5 w-3.5 text-primary-600" />
                                      {plan.driver ? 'Resources' : 'Assign Driver'}
                                    </Button>
                                  )}

                                  {plan.status === 'DRAFT' && (
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="xs"
                                      disabled={!plan.readiness.canMarkReady}
                                      title={
                                        plan.readiness.canMarkReady
                                          ? 'Lock plan as READY'
                                          : plan.readiness.blockingReasons.join(' ')
                                      }
                                      onClick={() =>
                                        setLifecycleConfirm({
                                          plan,
                                          targetStatus: 'READY',
                                        })
                                      }
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Mark Ready
                                    </Button>
                                  )}

                                  {plan.status === 'READY' && (
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="xs"
                                      disabled={!plan.readiness.canDispatch}
                                      title={
                                        plan.readiness.canDispatch
                                          ? 'Dispatch vehicle & start transit'
                                          : plan.readiness.blockingReasons.join(' ')
                                      }
                                      onClick={() =>
                                        setLifecycleConfirm({
                                          plan,
                                          targetStatus: 'DISPATCHED',
                                        })
                                      }
                                    >
                                      <Truck className="h-3.5 w-3.5" />
                                      Dispatch
                                    </Button>
                                  )}

                                  {plan.status === 'DISPATCHED' && (
                                    <Button
                                      type="button"
                                      variant="success"
                                      size="xs"
                                      onClick={() =>
                                        setLifecycleConfirm({
                                          plan,
                                          targetStatus: 'COMPLETED',
                                        })
                                      }
                                    >
                                      <Flag className="h-3.5 w-3.5" />
                                      Complete
                                    </Button>
                                  )}
                                </div>

                                <Link
                                  href={`/loads/${plan.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                                >
                                  Open <ArrowRight className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── E. Resource Availability Intelligence & Operational Attention ─────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Resource Availability Intelligence Panel (7 cols) */}
        <Card className="xl:col-span-7 flex flex-col overflow-hidden">
          <CardHeader
            title={`Fleet & Driver Availability (${board.operatingDateLabel})`}
            description="Live resource commitment and capacity evaluation derived from active load plans"
            bordered
            actions={
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setResourceTab('trucks')}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
                    resourceTab === 'trucks'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Trucks ({board.summary.availableTrucks}/{board.summary.totalTrucks})
                </button>
                <button
                  type="button"
                  onClick={() => setResourceTab('drivers')}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
                    resourceTab === 'drivers'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Drivers ({board.summary.availableDrivers}/{board.summary.totalDrivers})
                </button>
              </div>
            }
          />

          <div className="overflow-x-auto max-h-[420px]">
            {resourceTab === 'trucks' ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Vehicle</th>
                    <th className="px-4 py-2.5">Capacity</th>
                    <th className="px-4 py-2.5">Fleet Status</th>
                    <th className="px-4 py-2.5">Date Availability</th>
                    <th className="px-4 py-2.5">Commitments / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {board.availability.trucks.map((t) => (
                    <tr key={t.resourceId} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/trucks/${t.resourceId}`}
                          className="font-bold text-gray-900 hover:text-primary-600"
                        >
                          {t.resourceName}
                        </Link>
                        <div className="text-[11px] font-mono text-gray-500">
                          {t.plateNumber} • {t.vehicleType}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-800 tabular-nums">
                        {t.weightCapacity.toLocaleString()} kg
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge domain="truck" status={t.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge tone={t.available ? 'success' : 'warning'} size="sm" dot>
                          {t.available ? 'Available' : 'Committed / Unavailable'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {t.conflictReason ? (
                          <span className="text-amber-800 font-medium">{t.conflictReason}</span>
                        ) : t.currentAssignments.length > 0 ? (
                          <span>
                            Scheduled on{' '}
                            {t.currentAssignments.map((a) => a.planRef).join(', ')}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            Ready for assignment on {board.operatingDate}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Driver</th>
                    <th className="px-4 py-2.5">Contact / License</th>
                    <th className="px-4 py-2.5">Duty Status</th>
                    <th className="px-4 py-2.5">Date Availability</th>
                    <th className="px-4 py-2.5">Commitments / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {board.availability.drivers.map((d) => (
                    <tr key={d.resourceId} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/drivers/${d.resourceId}`}
                          className="font-bold text-gray-900 hover:text-primary-600"
                        >
                          {d.resourceName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {d.phone || 'No phone'} • {d.licenseNumber || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge domain="driver" status={d.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge tone={d.available ? 'success' : 'warning'} size="sm" dot>
                          {d.available ? 'Available' : 'Committed / Unavailable'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {d.conflictReason ? (
                          <span className="text-amber-800 font-medium">{d.conflictReason}</span>
                        ) : d.currentAssignments.length > 0 ? (
                          <span>
                            Assigned to{' '}
                            {d.currentAssignments.map((a) => a.planRef).join(', ')}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            Available for dispatch on {board.operatingDate}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Operational Attention & Scheduling Conflicts Panel (5 cols) */}
        <Card className="xl:col-span-5 flex flex-col overflow-hidden">
          <CardHeader
            title={`Operational Attention & Conflicts (${board.conflicts.length + (board.summary.overdueDeliveries > 0 ? 1 : 0)})`}
            description="Actionable scheduling conflicts, capacity blockers, and overdue alerts"
            bordered
          />

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
            {board.conflicts.length === 0 && board.exceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-gray-900">
                  No scheduling conflicts or operational blockers
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  All active load plans and resources pass validation checks.
                </p>
              </div>
            ) : (
              <>
                {board.conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className={cn(
                      'p-3.5 space-y-1.5',
                      conflict.severity === 'BLOCKING'
                        ? 'bg-rose-50/40'
                        : conflict.severity === 'WARNING'
                          ? 'bg-amber-50/30'
                          : 'bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {conflict.severity === 'BLOCKING' ? (
                          <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                        ) : conflict.severity === 'WARNING' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <Info className="h-4 w-4 text-sky-600 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-gray-900">
                          {conflict.title}
                        </span>
                      </div>
                      <Badge
                        tone={
                          conflict.severity === 'BLOCKING'
                            ? 'danger'
                            : conflict.severity === 'WARNING'
                              ? 'warning'
                              : 'info'
                        }
                        size="sm"
                      >
                        {conflict.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{conflict.message}</p>
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/loads/${conflict.planId}`}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Open {conflict.planRef} →
                      </Link>
                      {conflict.conflictingPlanId && (
                        <Link
                          href={`/loads/${conflict.conflictingPlanId}`}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800"
                        >
                          Conflicting: {conflict.conflictingPlanRef} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}

                {/* Overdue Unassigned Delivery Exceptions */}
                {board.exceptions
                  .filter(
                    (ex) =>
                      ex.type === 'DELIVERY_OVERDUE' ||
                      ex.type === 'DELIVERY_DUE_SOON' ||
                      ex.type === 'PENDING_QUEUE'
                  )
                  .slice(0, 6)
                  .map((ex) => (
                    <div key={ex.key} className="p-3.5 space-y-1 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          {ex.title}
                        </span>
                        <Badge
                          tone={
                            ex.severity === 'critical'
                              ? 'danger'
                              : ex.severity === 'warning'
                                ? 'warning'
                                : 'neutral'
                          }
                          size="sm"
                        >
                          {ex.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{ex.description}</p>
                      <div className="pt-1">
                        <Link
                          href={ex.entity.href}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          Review {ex.entity.label} →
                        </Link>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── Quick Assignment Dialog (Feature D) ──────────────────────────────── */}
      <QuickAssignResourcesDialog
        plan={assigningPlan}
        isOpen={Boolean(assigningPlan)}
        onClose={() => setAssigningPlan(null)}
        onSaved={() => router.refresh()}
      />

      {/* ── Quick Delivery Allocation Dialog ─────────────────────────────────── */}
      <QuickAllocateDeliveryDialog
        delivery={allocatingDelivery}
        draftPlans={board.draftPlansForAllocation}
        isOpen={Boolean(allocatingDelivery)}
        onClose={() => setAllocatingDelivery(null)}
        onAllocated={() => router.refresh()}
      />

      {/* ── Lifecycle Transition Confirmation Modal (Feature G) ──────────────── */}
      <ConfirmDialog
        isOpen={Boolean(lifecycleConfirm)}
        onClose={() => setLifecycleConfirm(null)}
        onConfirm={executeLifecycleTransition}
        loading={lifecycleLoading}
        tone={
          lifecycleConfirm?.targetStatus === 'COMPLETED'
            ? 'success'
            : 'primary'
        }
        title={
          lifecycleConfirm?.targetStatus === 'READY'
            ? `Mark ${lifecycleConfirm.plan.planRef} as Ready?`
            : lifecycleConfirm?.targetStatus === 'DISPATCHED'
              ? `Dispatch ${lifecycleConfirm.plan.planRef} Now?`
              : `Complete ${lifecycleConfirm?.plan.planRef}?`
        }
        description={
          lifecycleConfirm?.targetStatus === 'READY'
            ? 'Marking this plan as READY locks delivery allocation and prepares the vehicle for dispatch.'
            : lifecycleConfirm?.targetStatus === 'DISPATCHED'
              ? `Dispatching commits ${lifecycleConfirm.plan.truck.name} and ${lifecycleConfirm.plan.driver?.name || 'driver'} to active transit.`
              : 'Completing this plan marks all in-transit deliveries as DELIVERED and releases the vehicle and driver.'
        }
        consequences={
          lifecycleConfirm?.targetStatus === 'READY'
            ? [
                'Plan status transitions from DRAFT to READY.',
                'Deliveries remain reserved on this truck.',
              ]
            : lifecycleConfirm?.targetStatus === 'DISPATCHED'
              ? [
                  `All ${lifecycleConfirm.plan.dispatchableDeliveryCount} assigned deliveries transition to IN_TRANSIT.`,
                  'Truck status becomes IN_USE and driver status becomes ON_TRIP.',
                ]
              : [
                  'Load plan transitions permanently to COMPLETED.',
                  'Truck and driver return to AVAILABLE status.',
                ]
        }
        confirmLabel={
          lifecycleConfirm?.targetStatus === 'READY'
            ? 'Mark Ready'
            : lifecycleConfirm?.targetStatus === 'DISPATCHED'
              ? 'Dispatch Truck'
              : 'Complete Plan'
        }
      />
    </div>
  );
}

