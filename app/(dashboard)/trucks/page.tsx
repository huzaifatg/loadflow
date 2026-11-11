import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import {
  Truck as TruckIcon,
  CheckCircle2,
  Navigation,
  Wrench,
  LayoutGrid,
  List,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TruckCard } from '@/components/trucks/TruckCard';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import { FilterTabs, ClearFiltersButton } from '@/components/ui/FilterBar';
import { SavedViewsBar } from '@/components/ui/SavedViewsBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth';
import { listSavedViews } from '@/lib/services/saved-views';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 12;
const VALID_STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'] as const;

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    view?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const searchQuery = (resolvedParams.q || '').trim();
  const statusFilter = (resolvedParams.status || 'ALL').toUpperCase();
  const viewMode = resolvedParams.view === 'table' ? 'table' : 'cards';

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Fleet — Trucks"
          description="Set up your company profile in Settings to register fleet vehicles."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const skip = (currentPage - 1) * ITEMS_PER_PAGE;
  const whereClause: Prisma.TruckWhereInput = {
    companyId,
    isArchived: false,
    ...(VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
      ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
      : {}),
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { plateNumber: { contains: searchQuery, mode: 'insensitive' } },
            { type: { contains: searchQuery, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [[statusGroups, totalItems, trucks], customViews] = await Promise.all([
    prisma.$transaction([
      prisma.truck.groupBy({
        by: ['status'],
        where: { companyId, isArchived: false },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.truck.count({ where: whereClause }),
      prisma.truck.findMany({
        where: whereClause,
        include: {
          _count: { select: { loadPlans: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ITEMS_PER_PAGE,
      }),
    ]),
    listSavedViews(prisma, companyId, auth.userId, 'trucks'),
  ]);

  const countStatus = (s: string) => {
    const found = statusGroups.find((g) => g.status === s);
    if (!found || typeof found._count !== 'object') return 0;
    return found._count._all ?? 0;
  };

  const availCount = countStatus('AVAILABLE');
  const inUseCount = countStatus('IN_USE');
  const maintCount = countStatus('MAINTENANCE');
  const totalFleet = availCount + inUseCount + maintCount;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const buildViewHref = (targetView: 'cards' | 'table') => {
    const sp = new URLSearchParams();
    if (searchQuery) sp.set('q', searchQuery);
    if (statusFilter !== 'ALL') sp.set('status', statusFilter);
    if (targetView === 'table') sp.set('view', 'table');
    const qs = sp.toString();
    return qs ? `/trucks?${qs}` : '/trucks';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet Management"
        title="Trucks & Vehicles"
        description="Register fleet vehicles, track weight capacities, and monitor live dispatch availability."
        actionLabel="Add Truck"
        actionHref="/trucks/new"
      />

      {/* Fleet KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Active Fleet"
          value={totalFleet}
          sublabel="Registered vehicles"
          icon={<TruckIcon className="h-4 w-4" />}
          tone="neutral"
          href="/trucks"
        />
        <MetricCard
          label="Available for Dispatch"
          value={availCount}
          sublabel="Ready for load plans"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/trucks?status=AVAILABLE"
        />
        <MetricCard
          label="In Use (On Route)"
          value={inUseCount}
          sublabel="Assigned to dispatched plans"
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
          href="/trucks?status=IN_USE"
        />
        <MetricCard
          label="In Maintenance"
          value={maintCount}
          sublabel="Unavailable for planning"
          icon={<Wrench className="h-4 w-4" />}
          tone={maintCount > 0 ? 'warning' : 'neutral'}
          href="/trucks?status=MAINTENANCE"
        />
      </div>

      {/* Saved Views & Presets Bar */}
      <SavedViewsBar workspace="trucks" initialCustomViews={customViews} />

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All Trucks', count: totalFleet },
            { value: 'AVAILABLE', label: 'Available', count: availCount },
            { value: 'IN_USE', label: 'In Use', count: inUseCount },
            { value: 'MAINTENANCE', label: 'Maintenance', count: maintCount },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchClient
            placeholder="Search name, plate, or type..."
            className="w-full sm:w-64"
          />
          <ClearFiltersButton paramNames={['q', 'status']} />

          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-100 p-0.5">
            <Link
              href={buildViewHref('cards')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'cards'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </Link>
            <Link
              href={buildViewHref('table')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </Link>
          </div>
        </div>
      </div>

      {trucks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
          <EmptyState
            icon={<TruckIcon className="h-5 w-5" />}
            title={
              searchQuery || statusFilter !== 'ALL'
                ? 'No trucks match your current filters'
                : 'No trucks registered yet'
            }
            description={
              searchQuery || statusFilter !== 'ALL'
                ? 'Try clearing your search query or switching the availability filter.'
                : 'Add your first vehicle with its license plate and payload capacity to start building load plans.'
            }
            actionLabel="Add Truck"
            actionHref="/trucks/new"
          />
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Vehicle Name</th>
                <th className="px-4 py-3">License Plate</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Max Capacity</th>
                <th className="px-4 py-3">Load Plans</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trucks.map((truck) => (
                <tr
                  key={truck.id}
                  className="hover:bg-gray-50/90 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <Link
                      href={`/trucks/${truck.id}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {truck.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-gray-700">
                    {truck.plateNumber}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-600">
                    {truck.type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold text-gray-900 tabular-nums">
                    {truck.weightCapacity.toLocaleString()} kg
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-600 tabular-nums">
                    {truck._count.loadPlans}{' '}
                    {truck._count.loadPlans === 1 ? 'plan' : 'plans'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <StatusBadge domain="truck" status={truck.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <Link
                      href={`/trucks/${truck.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:border-primary-300 hover:text-primary-600"
                    >
                      Inspect <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trucks.map((truck) => (
            <TruckCard
              key={truck.id}
              id={truck.id}
              name={truck.name}
              plateNumber={truck.plateNumber}
              type={truck.type}
              weightCapacity={truck.weightCapacity}
              status={truck.status}
              loadPlanCount={truck._count.loadPlans}
            />
          ))}
        </div>
      )}

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={ITEMS_PER_PAGE}
      />
    </div>
  );
}
