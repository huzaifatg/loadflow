import React from 'react';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { Users, CheckCircle2, Navigation, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DriversTable } from '@/components/drivers/DriversTable';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import { FilterTabs, ClearFiltersButton } from '@/components/ui/FilterBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth';

const ITEMS_PER_PAGE = 20;
const VALID_STATUSES = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY'] as const;

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
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

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Fleet — Drivers"
          description="Set up your company profile in Settings to onboard drivers."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const skip = (currentPage - 1) * ITEMS_PER_PAGE;
  const whereClause: Prisma.DriverWhereInput = {
    companyId,
    isArchived: false,
    ...(VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
      ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
      : {}),
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { phone: { contains: searchQuery, mode: 'insensitive' } },
            { licenseNumber: { contains: searchQuery, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [statusGroups, totalItems, drivers] = await prisma.$transaction([
    prisma.driver.groupBy({
      by: ['status'],
      where: { companyId, isArchived: false },
      orderBy: { status: 'asc' },
      _count: { _all: true },
    }),
    prisma.driver.count({ where: whereClause }),
    prisma.driver.findMany({
      where: whereClause,
      include: {
        _count: { select: { loadPlans: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: ITEMS_PER_PAGE,
    }),
  ]);

  const countStatus = (s: string) => {
    const found = statusGroups.find((g) => g.status === s);
    if (!found || typeof found._count !== 'object') return 0;
    return found._count._all ?? 0;
  };

  const availCount = countStatus('AVAILABLE');
  const onTripCount = countStatus('ON_TRIP');
  const offDutyCount = countStatus('OFF_DUTY');
  const totalRoster = availCount + onTripCount + offDutyCount;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet Management"
        title="Driver Roster"
        description="Manage company drivers, license credentials, and dispatch availability."
        actionLabel="Add Driver"
        actionHref="/drivers/new"
      />

      {/* Driver KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Driver Roster"
          value={totalRoster}
          sublabel="Active company drivers"
          icon={<Users className="h-4 w-4" />}
          tone="neutral"
          href="/drivers"
        />
        <MetricCard
          label="Available for Dispatch"
          value={availCount}
          sublabel="Ready to assign to plans"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/drivers?status=AVAILABLE"
        />
        <MetricCard
          label="On Active Trip"
          value={onTripCount}
          sublabel="Assigned to dispatched plans"
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
          href="/drivers?status=ON_TRIP"
        />
        <MetricCard
          label="Off Duty"
          value={offDutyCount}
          sublabel="Unavailable for dispatch"
          icon={<Clock className="h-4 w-4" />}
          tone="neutral"
          href="/drivers?status=OFF_DUTY"
        />
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All Drivers', count: totalRoster },
            { value: 'AVAILABLE', label: 'Available', count: availCount },
            { value: 'ON_TRIP', label: 'On Trip', count: onTripCount },
            { value: 'OFF_DUTY', label: 'Off Duty', count: offDutyCount },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchClient
            placeholder="Search name, phone, license..."
            className="w-full sm:w-64"
          />
          <ClearFiltersButton paramNames={['q', 'status']} />
        </div>
      </div>

      <DriversTable data={drivers} />

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={ITEMS_PER_PAGE}
      />
    </div>
  );
}
