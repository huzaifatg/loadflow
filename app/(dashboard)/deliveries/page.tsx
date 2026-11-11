import React from 'react';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import {
  Package,
  Clock,
  Navigation,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { DeliveriesTable } from '@/components/deliveries/DeliveriesTable';
import { PaginationClient } from '@/components/ui/PaginationClient';
import { SearchClient } from '@/components/ui/SearchClient';
import {
  FilterTabs,
  FilterSelect,
  ClearFiltersButton,
} from '@/components/ui/FilterBar';
import { SavedViewsBar } from '@/components/ui/SavedViewsBar';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { serializeDelivery } from '@/lib/delivery-items';
import { getAuthContext } from '@/lib/auth';
import { listSavedViews } from '@/lib/services/saved-views';
import { addDays, startOfDay } from 'date-fns';

const ITEMS_PER_PAGE = 20;
const VALID_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const;

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    schedule?: string;
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
  const scheduleFilter = resolvedParams.schedule || 'ALL';

  const auth = await getAuthContext();
  const companyId = auth?.companyId;

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Deliveries"
          description="Set up your company profile in Settings to begin managing deliveries."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const skip = (currentPage - 1) * ITEMS_PER_PAGE;
  const dueSoonCutoff = addDays(startOfDay(new Date()), 2);
  const whereClause: Prisma.DeliveryWhereInput = {
    companyId,
    isArchived: false,
    ...(VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
      ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
      : {}),
    ...(scheduleFilter === 'scheduled'
      ? { scheduledDate: { not: null } }
      : scheduleFilter === 'unscheduled'
        ? { scheduledDate: null }
        : scheduleFilter === 'overdue'
          ? { scheduledDate: { not: null, lt: dueSoonCutoff } }
          : {}),
    ...(searchQuery
      ? {
          OR: [
            { customerName: { contains: searchQuery, mode: 'insensitive' } },
            { pickupAddress: { contains: searchQuery, mode: 'insensitive' } },
            { deliveryAddress: { contains: searchQuery, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [[statusGroups, totalItems, fetchedDeliveries], customViews] =
    await Promise.all([
      prisma.$transaction([
        prisma.delivery.groupBy({
          by: ['status'],
          where: { companyId, isArchived: false },
          orderBy: { status: 'asc' },
          _count: { _all: true },
        }),
        prisma.delivery.count({ where: whereClause }),
        prisma.delivery.findMany({
          where: whereClause,
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: ITEMS_PER_PAGE,
          include: {
            items: { orderBy: { sortOrder: 'asc' }, take: 3 },
            _count: { select: { items: true, loadPlanItems: true } },
            loadPlanItems: {
              include: {
                loadPlan: {
                  select: {
                    id: true,
                    status: true,
                    date: true,
                    truck: { select: { name: true, plateNumber: true } },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
      ]),
      listSavedViews(prisma, companyId, auth.userId, 'deliveries'),
    ]);

  const deliveries = fetchedDeliveries.map((d) => serializeDelivery(d));

  const countStatus = (s: string) => {
    const found = statusGroups.find((g) => g.status === s);
    if (!found || typeof found._count !== 'object') return 0;
    return found._count._all ?? 0;
  };

  const pendingCount = countStatus('PENDING');
  const assignedCount = countStatus('ASSIGNED');
  const inTransitCount = countStatus('IN_TRANSIT');
  const deliveredCount = countStatus('DELIVERED');
  const cancelledCount = countStatus('CANCELLED');
  const totalAll =
    pendingCount +
    assignedCount +
    inTransitCount +
    deliveredCount +
    cancelledCount;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Order & Shipment Pipeline"
        title="Deliveries"
        description="Track customer delivery orders, inspect item weight breakdowns, and monitor load plan allocation."
        actionLabel="New Delivery"
        actionHref="/deliveries/new"
      >
        <ButtonLink href="/import" variant="secondary" size="md">
          <FileUp className="h-4 w-4" />
          Import CSV
        </ButtonLink>
        {pendingCount > 0 && (
          <ButtonLink href="/loads/recommend" variant="secondary" size="md">
            <Sparkles className="h-4 w-4 text-primary-600" />
            Recommend Fleet
          </ButtonLink>
        )}
      </PageHeader>

      {/* Delivery Pipeline KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Pending Allocation"
          value={pendingCount}
          sublabel="Awaiting assignment to a plan"
          icon={<Clock className="h-4 w-4" />}
          tone={pendingCount > 0 ? 'warning' : 'neutral'}
          href="/deliveries?status=PENDING"
        />
        <MetricCard
          label="Assigned to Plans"
          value={assignedCount}
          sublabel="Reserved on DRAFT or READY plans"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="info"
          href="/deliveries?status=ASSIGNED"
        />
        <MetricCard
          label="In Transit"
          value={inTransitCount}
          sublabel="On dispatched vehicles"
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
          href="/deliveries?status=IN_TRANSIT"
        />
        <MetricCard
          label="Delivered"
          value={deliveredCount}
          sublabel="Completed orders"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/deliveries?status=DELIVERED"
        />
      </div>

      {/* Saved Views & Presets Bar */}
      <SavedViewsBar workspace="deliveries" initialCustomViews={customViews} />

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs xl:flex-row xl:items-center xl:justify-between">
        <FilterTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All Orders', count: totalAll },
            { value: 'PENDING', label: 'Pending', count: pendingCount },
            { value: 'ASSIGNED', label: 'Assigned', count: assignedCount },
            { value: 'IN_TRANSIT', label: 'In Transit', count: inTransitCount },
            { value: 'DELIVERED', label: 'Delivered', count: deliveredCount },
            { value: 'CANCELLED', label: 'Cancelled', count: cancelledCount },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchClient
            placeholder="Search customer, pickup, destination..."
            className="w-full sm:w-64"
          />
          <FilterSelect
            paramName="schedule"
            defaultValue="ALL"
            options={[
              { value: 'ALL', label: 'All Schedules' },
              { value: 'overdue', label: 'Overdue & Due Soon' },
              { value: 'scheduled', label: 'Has Scheduled Date' },
              { value: 'unscheduled', label: 'Unscheduled Only' },
            ]}
          />
          <ClearFiltersButton paramNames={['q', 'status', 'schedule']} />
        </div>
      </div>

      <DeliveriesTable data={deliveries} />

      <PaginationClient
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={ITEMS_PER_PAGE}
      />
    </div>
  );
}
