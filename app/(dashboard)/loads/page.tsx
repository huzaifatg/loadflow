import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import {
  ClipboardList,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  LayoutGrid,
  List,
  AlertCircle,
  Truck,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth';
import { toNumber } from '@/lib/delivery-items';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { SearchClient } from '@/components/ui/SearchClient';
import {
  FilterTabs,
  FilterSelect,
  ClearFiltersButton,
} from '@/components/ui/FilterBar';
import { StatusBadge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { LoadPlanCard } from '@/components/loads/LoadPlanCard';
import { SavedViewsBar } from '@/components/ui/SavedViewsBar';
import { listSavedViews } from '@/lib/services/saved-views';
import { cn } from '@/lib/utils';

const VALID_STATUSES = ['DRAFT', 'READY', 'DISPATCHED', 'COMPLETED'] as const;

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    view?: string;
    page?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const query = (resolvedParams.q || '').trim();
  const statusFilter = (resolvedParams.status || 'ALL').toUpperCase();
  const sortParam = resolvedParams.sort || 'date_desc';
  const viewMode = resolvedParams.view === 'cards' ? 'cards' : 'table';
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);
  const pageSize = 12;

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Load Plans"
          description="Set up your company profile in Settings to start planning loads."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const whereClause: Prisma.LoadPlanWhereInput = {
    companyId,
    ...(VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
      ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
      : {}),
    ...(query
      ? {
          OR: [
            { notes: { contains: query, mode: 'insensitive' } },
            { truck: { name: { contains: query, mode: 'insensitive' } } },
            { truck: { plateNumber: { contains: query, mode: 'insensitive' } } },
            { driver: { name: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.LoadPlanOrderByWithRelationInput =
    sortParam === 'date_asc'
      ? { date: 'asc' }
      : sortParam === 'updated_desc'
        ? { updatedAt: 'desc' }
        : { date: 'desc' };

  const [[statusGroups, filteredCount, loads], customViews] = await Promise.all([
    prisma.$transaction([
      prisma.loadPlan.groupBy({
        by: ['status'],
        where: { companyId },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.loadPlan.count({ where: whereClause }),
      prisma.loadPlan.findMany({
        where: whereClause,
        include: {
          truck: true,
          driver: true,
          _count: { select: { items: true } },
          items: {
            select: {
              delivery: { select: { weight: true } },
            },
          },
        },
        orderBy,
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    ]),
    listSavedViews(prisma, companyId, auth.userId, 'loads'),
  ]);

  const countStatus = (s: string) => {
    const found = statusGroups.find((g) => g.status === s);
    if (!found || typeof found._count !== 'object') return 0;
    return found._count._all ?? 0;
  };

  const draftCount = countStatus('DRAFT');
  const readyCount = countStatus('READY');
  const dispatchedCount = countStatus('DISPATCHED');
  const completedCount = countStatus('COMPLETED');
  const totalAll = draftCount + readyCount + dispatchedCount + completedCount;
  const totalPages = Math.ceil(filteredCount / pageSize);

  const buildViewHref = (targetView: 'table' | 'cards') => {
    const sp = new URLSearchParams();
    if (query) sp.set('q', query);
    if (statusFilter !== 'ALL') sp.set('status', statusFilter);
    if (sortParam !== 'date_desc') sp.set('sort', sortParam);
    if (targetView === 'cards') sp.set('view', 'cards');
    const qs = sp.toString();
    return qs ? `/loads?${qs}` : '/loads';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dispatch & Load Planning"
        title="Load Plans"
        description="Build draft load plans, validate vehicle weight capacities, and execute lifecycle transitions from DRAFT to COMPLETED."
        actionLabel="Create Load Plan"
        actionHref="/loads/new"
      >
        <ButtonLink href="/loads/recommend" variant="secondary" size="md">
          <Sparkles className="h-4 w-4 text-primary-600" />
          Recommend Truck
        </ButtonLink>
        <ButtonLink href="/loads/optimize" variant="secondary" size="md">
          <SlidersHorizontal className="h-4 w-4 text-primary-600" />
          Load Optimizer
        </ButtonLink>
      </PageHeader>

      {/* Lifecycle Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Draft Plans"
          value={draftCount}
          sublabel="Editable — allocating orders"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="neutral"
          href="/loads?status=DRAFT"
        />
        <MetricCard
          label="Ready to Dispatch"
          value={readyCount}
          sublabel="Locked & awaiting dispatch"
          icon={<Truck className="h-4 w-4" />}
          tone="info"
          href="/loads?status=READY"
        />
        <MetricCard
          label="Dispatched (In Transit)"
          value={dispatchedCount}
          sublabel="Active fleet on the road"
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
          href="/loads?status=DISPATCHED"
        />
        <MetricCard
          label="Completed Plans"
          value={completedCount}
          sublabel="All deliveries fulfilled"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/loads?status=COMPLETED"
        />
      </div>

      {/* Saved Views & Presets Bar */}
      <SavedViewsBar workspace="loads" initialCustomViews={customViews} />

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterTabs
            paramName="status"
            options={[
              { value: 'ALL', label: 'All Plans', count: totalAll },
              { value: 'DRAFT', label: 'Draft', count: draftCount },
              { value: 'READY', label: 'Ready', count: readyCount },
              { value: 'DISPATCHED', label: 'Dispatched', count: dispatchedCount },
              { value: 'COMPLETED', label: 'Completed', count: completedCount },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchClient
            placeholder="Search truck, plate, driver, notes..."
            className="w-full sm:w-64"
          />
          <FilterSelect
            paramName="sort"
            defaultValue="date_desc"
            options={[
              { value: 'date_desc', label: 'Date: Newest first' },
              { value: 'date_asc', label: 'Date: Oldest first' },
              { value: 'updated_desc', label: 'Recently updated' },
            ]}
          />
          <ClearFiltersButton paramNames={['q', 'status', 'sort']} />

          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-100 p-0.5">
            <Link
              href={buildViewHref('table')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </Link>
            <Link
              href={buildViewHref('cards')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
              title="Cards view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {loads.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={
              query || statusFilter !== 'ALL'
                ? 'No load plans match your current filters'
                : 'No load plans created yet'
            }
            description={
              query || statusFilter !== 'ALL'
                ? 'Try clearing your search query or switching the lifecycle status tab.'
                : 'Initialize a draft load plan to allocate pending customer deliveries onto an available truck.'
            }
            actionLabel="Create Load Plan"
            actionHref="/loads/new"
            secondaryAction={
              <ButtonLink href="/loads/recommend" variant="secondary" size="sm">
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                Run Recommendations
              </ButtonLink>
            }
          />
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loads.map((load) => {
            const totalWeight = load.items.reduce(
              (sum, item) => sum + toNumber(item.delivery.weight),
              0
            );
            return (
              <LoadPlanCard
                key={load.id}
                id={load.id}
                date={format(new Date(load.date), 'MMM d, yyyy')}
                status={load.status}
                truckName={load.truck?.name || 'Unassigned Truck'}
                truckPlate={load.truck?.plateNumber}
                driverName={load.driver?.name}
                totalDeliveries={load._count?.items || 0}
                totalWeight={totalWeight}
                truckCapacity={load.truck?.weightCapacity || 0}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Plan ID</th>
                <th className="px-4 py-3">Planned Date</th>
                <th className="px-4 py-3">Truck</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3 min-w-[200px]">Capacity Utilization</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loads.map((load) => {
                const totalWeight = load.items.reduce(
                  (sum, item) => sum + toNumber(item.delivery.weight),
                  0
                );
                const maxCap = load.truck?.weightCapacity || 0;
                const stopCount = load._count?.items || 0;

                return (
                  <tr
                    key={load.id}
                    className="group hover:bg-gray-50/90 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Link
                        href={`/loads/${load.id}`}
                        className="font-semibold text-gray-900 hover:text-primary-600"
                      >
                        #{load.id.slice(-6).toUpperCase()}
                      </Link>
                      {load.notes && (
                        <p className="max-w-[160px] truncate text-xs text-gray-400">
                          {load.notes}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-gray-700 tabular-nums">
                      {format(new Date(load.date), 'MMM d, yyyy')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="font-medium text-gray-900">
                        {load.truck?.name || 'Unassigned'}
                      </div>
                      {load.truck?.plateNumber && (
                        <div className="text-xs text-gray-500 font-mono">
                          {load.truck.plateNumber} • {load.truck.type}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {load.driver ? (
                        <span className="text-sm font-medium text-gray-800">
                          {load.driver.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-gray-800 tabular-nums">
                      {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
                    </td>
                    <td className="px-4 py-3.5 min-w-[200px]">
                      <CapacityBar
                        current={Math.round(totalWeight)}
                        max={maxCap}
                        size="sm"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <StatusBadge domain="loadPlan" status={load.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <Link
                        href={`/loads/${load.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:border-primary-300 hover:text-primary-600"
                      >
                        Manage
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredCount}
        pageSize={pageSize}
      />
    </div>
  );
}
