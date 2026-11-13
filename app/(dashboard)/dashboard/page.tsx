import React from 'react';
import Link from 'next/link';
import {
  Package,
  Truck,
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Plus,
  FileUp,
  Navigation,
  CalendarClock,
  Kanban,
  ShieldAlert,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { format, startOfDay, endOfDay } from 'date-fns';
import { getAuthContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { DistributionBar } from '@/components/ui/DistributionBar';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { getOperationalExceptions } from '@/lib/services/operational-exceptions';
import { getDispatchConflicts } from '@/lib/services/dispatch-conflicts';
import { ExceptionCenterPanel } from '@/components/operations/ExceptionCenterPanel';

export default async function DashboardPage() {
  const auth = await getAuthContext();
  const companyId = auth?.companyId;
  const companyName =
    auth?.company?.displayName || auth?.company?.name || 'Your Company';

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace Overview"
          title="Operations Control Center"
          description="Configure your company profile in Settings to begin managing deliveries, fleet, and load plans."
          actionLabel="Open Settings"
          actionHref="/settings"
        />
      </div>
    );
  }

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [
    [
      deliveryGroups,
      loadPlanGroups,
      truckGroups,
      driverGroups,
      activeLoadPlans,
      pendingDeliveries,
      plansMissingDriverCount,
      todaysPlansCount,
      overdueDeliveriesCount,
    ],
    exceptions,
    activeTrackingLinksCount,
    dispatchConflictResult,
  ] = await Promise.all([
    prisma.$transaction([
      prisma.delivery.groupBy({
        by: ['status'],
        where: { companyId, isArchived: false },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.loadPlan.groupBy({
        by: ['status'],
        where: { companyId },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.truck.groupBy({
        by: ['status'],
        where: { companyId, isArchived: false },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.driver.groupBy({
        by: ['status'],
        where: { companyId, isArchived: false },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.loadPlan.findMany({
        where: {
          companyId,
          status: { in: ['DRAFT', 'READY', 'DISPATCHED'] },
        },
        include: {
          truck: true,
          driver: true,
          items: {
            include: {
              delivery: {
                select: { id: true, weight: true },
              },
            },
          },
        },
        orderBy: [{ status: 'desc' }, { date: 'asc' }],
        take: 6,
      }),
      prisma.delivery.findMany({
        where: { companyId, status: 'PENDING', isArchived: false },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        take: 6,
      }),
      prisma.loadPlan.count({
        where: {
          companyId,
          status: { in: ['DRAFT', 'READY'] },
          driverId: null,
        },
      }),
      prisma.loadPlan.count({
        where: {
          companyId,
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.delivery.count({
        where: {
          companyId,
          isArchived: false,
          status: 'PENDING',
          scheduledDate: { lt: todayStart },
        },
      }),
    ]),
    getOperationalExceptions(prisma, companyId),
    prisma.shipmentTrackingLink.count({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
    getDispatchConflicts(prisma, companyId),
  ]);

  const resourceConflictCount = dispatchConflictResult.summary.blocking;

  const countBy = (
    groups: { status: string; _count?: { _all?: number } | true }[],
    status: string
  ) => {
    const found = groups.find((g) => g.status === status);
    if (!found || typeof found._count !== 'object') return 0;
    return found._count._all ?? 0;
  };

  // Delivery counts
  const delPending = countBy(deliveryGroups, 'PENDING');
  const delAssigned = countBy(deliveryGroups, 'ASSIGNED');
  const delInTransit = countBy(deliveryGroups, 'IN_TRANSIT');
  const delDelivered = countBy(deliveryGroups, 'DELIVERED');
  const delCancelled = countBy(deliveryGroups, 'CANCELLED');
  const totalDeliveries =
    delPending + delAssigned + delInTransit + delDelivered + delCancelled;

  // LoadPlan counts
  const planDraft = countBy(loadPlanGroups, 'DRAFT');
  const planReady = countBy(loadPlanGroups, 'READY');
  const planDispatched = countBy(loadPlanGroups, 'DISPATCHED');
  const planCompleted = countBy(loadPlanGroups, 'COMPLETED');
  const totalPlans = planDraft + planReady + planDispatched + planCompleted;
  const activePlansCount = planDraft + planReady + planDispatched;

  // Truck counts
  const truckAvailable = countBy(truckGroups, 'AVAILABLE');
  const truckInUse = countBy(truckGroups, 'IN_USE');
  const truckMaintenance = countBy(truckGroups, 'MAINTENANCE');
  const totalTrucks = truckAvailable + truckInUse + truckMaintenance;

  // Driver counts
  const driverAvailable = countBy(driverGroups, 'AVAILABLE');
  const driverOnTrip = countBy(driverGroups, 'ON_TRIP');
  const driverOffDuty = countBy(driverGroups, 'OFF_DUTY');
  const totalDrivers = driverAvailable + driverOnTrip + driverOffDuty;

  const isBrandNewWorkspace =
    totalDeliveries === 0 &&
    totalTrucks === 0 &&
    totalDrivers === 0 &&
    totalPlans === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${companyName} • Live Operations`}
        title="Operations Control Center"
        description="Real-time dispatch pipeline, fleet availability, and load plan execution across your workspace."
        actionLabel="Create Load Plan"
        actionHref="/loads/new"
      >
        <ButtonLink href="/dispatch" variant="secondary" size="md">
          <Kanban className="h-4 w-4 text-primary-600" />
          Dispatch Board
        </ButtonLink>
        <ButtonLink href="/loads/recommend" variant="secondary" size="md">
          <Sparkles className="h-4 w-4 text-primary-600" />
          Recommend Fleet
        </ButtonLink>
        <ButtonLink href="/deliveries/new" variant="secondary" size="md">
          <Plus className="h-4 w-4" />
          New Delivery
        </ButtonLink>
      </PageHeader>

      {/* Onboarding Checklist for empty workspaces */}
      {isBrandNewWorkspace && (
        <Card className="border-primary-200 bg-primary-50/30">
          <CardHeader
            title="Welcome to LoadFlow — Complete Your Operational Setup"
            description="Follow these 4 steps to configure your fleet, import orders, and dispatch your first load plan."
          />
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/trucks/new"
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-colors hover:border-primary-300"
            >
              <div>
                <Badge tone="primary" size="sm">
                  Step 1
                </Badge>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  Register Fleet Trucks
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add vehicles with plate numbers and weight capacities.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                Add Truck <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              href="/drivers/new"
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-colors hover:border-primary-300"
            >
              <div>
                <Badge tone="primary" size="sm">
                  Step 2
                </Badge>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  Add Drivers
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Onboard drivers so load plans can transition to READY & DISPATCHED.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                Add Driver <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              href="/deliveries/new"
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-colors hover:border-primary-300"
            >
              <div>
                <Badge tone="primary" size="sm">
                  Step 3
                </Badge>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  Create or Import Deliveries
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Enter customer delivery orders manually or bulk upload via CSV.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                New Delivery <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>

            <Link
              href="/loads/new"
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-2xs transition-colors hover:border-primary-300"
            >
              <div>
                <Badge tone="primary" size="sm">
                  Step 4
                </Badge>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  Build & Dispatch Load Plan
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Allocate pending orders, verify capacity, and dispatch.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                Create Plan <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Today's Dispatch & Urgency Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-700 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900">
            <CalendarClock className="h-4 w-4 text-primary-600" />
            Today ({format(new Date(), 'MMM d, yyyy')}):
          </span>
          <Link
            href="/dispatch?scope=date"
            className="font-medium text-gray-700 hover:text-primary-600"
          >
            <strong className="font-semibold text-gray-900">{todaysPlansCount}</strong>{' '}
            {todaysPlansCount === 1 ? 'load plan' : 'load plans'} scheduled today
          </Link>
          <span className="text-gray-300">•</span>
          <Link
            href="/dispatch?status=READY"
            className="font-medium text-gray-700 hover:text-primary-600"
          >
            <strong className="font-semibold text-blue-700">{planReady}</strong>{' '}
            ready for dispatch
          </Link>
          <span className="text-gray-300">•</span>
          <Link
            href="/dispatch"
            className="font-medium text-gray-700 hover:text-primary-600"
          >
            <strong className="font-semibold text-amber-700">{delPending}</strong>{' '}
            unassigned {delPending === 1 ? 'delivery' : 'deliveries'}
          </Link>
          {overdueDeliveriesCount > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <Link
                href="/dispatch?overdue=OVERDUE_ONLY"
                className="inline-flex items-center gap-1 font-semibold text-red-700 hover:text-red-800"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueDeliveriesCount} overdue unassigned {overdueDeliveriesCount === 1 ? 'delivery' : 'deliveries'}
              </Link>
            </>
          )}
          {resourceConflictCount > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <Link
                href="/dispatch?conflict=BLOCKING_ONLY"
                className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-800"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {resourceConflictCount} resource {resourceConflictCount === 1 ? 'conflict' : 'conflicts'}
              </Link>
            </>
          )}
          {plansMissingDriverCount > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <Link
                href="/dispatch?assignment=UNASSIGNED_DRIVER"
                className="font-medium text-amber-700 hover:text-amber-800"
              >
                {plansMissingDriverCount} active {plansMissingDriverCount === 1 ? 'plan' : 'plans'} missing driver
              </Link>
            </>
          )}
          <span className="text-gray-300">•</span>
          <Link
            href="/deliveries"
            className="font-medium text-gray-700 hover:text-primary-600"
          >
            <strong className="font-semibold text-emerald-700">{activeTrackingLinksCount}</strong>{' '}
            active customer tracking {activeTrackingLinksCount === 1 ? 'link' : 'links'}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
          >
            Dispatch Board <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dispatch/calendar"
            className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-primary-600"
          >
            Dispatch Calendar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/loads/optimize"
            className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-primary-600"
          >
            Multi-Load Optimizer <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Sprint 16: Live Operational Exception Center */}
      <div id="exception-center">
        <ExceptionCenterPanel exceptions={exceptions} />
      </div>

      {/* 6 Real KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Pending Deliveries"
          value={delPending}
          sublabel={
            delAssigned > 0
              ? `${delAssigned} assigned to plans`
              : 'Unassigned queue'
          }
          icon={<Clock className="h-4 w-4" />}
          tone={delPending > 0 ? 'warning' : 'neutral'}
          href="/deliveries?status=PENDING"
        />
        <MetricCard
          label="In Transit"
          value={delInTransit}
          sublabel={`${planDispatched} dispatched ${planDispatched === 1 ? 'plan' : 'plans'}`}
          icon={<Navigation className="h-4 w-4" />}
          tone="primary"
          href="/deliveries?status=IN_TRANSIT"
        />
        <MetricCard
          label="Active Load Plans"
          value={activePlansCount}
          sublabel={`${planDraft} draft • ${planReady} ready • ${planDispatched} live`}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="info"
          href="/loads"
        />
        <MetricCard
          label="Available Trucks"
          value={`${truckAvailable} / ${totalTrucks}`}
          sublabel={`${truckInUse} in use • ${truckMaintenance} maint.`}
          icon={<Truck className="h-4 w-4" />}
          tone={truckAvailable > 0 ? 'success' : 'neutral'}
          href="/trucks"
        />
        <MetricCard
          label="Available Drivers"
          value={`${driverAvailable} / ${totalDrivers}`}
          sublabel={`${driverOnTrip} on trip • ${driverOffDuty} off duty`}
          icon={<Users className="h-4 w-4" />}
          tone={driverAvailable > 0 ? 'success' : 'neutral'}
          href="/drivers"
        />
        <MetricCard
          label="Delivered Orders"
          value={delDelivered}
          sublabel={
            totalDeliveries > 0
              ? `${Math.round((delDelivered / totalDeliveries) * 100)}% of ${totalDeliveries} total`
              : 'No deliveries yet'
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          href="/deliveries?status=DELIVERED"
        />
      </div>

      {/* 3 Operational Distribution Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Delivery Pipeline"
            description="Current status distribution across all orders"
            actions={
              <Link
                href="/deliveries"
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                All Deliveries →
              </Link>
            }
          />
          <CardContent>
            <DistributionBar
              totalLabel="Total Deliveries"
              emptyLabel="No deliveries recorded yet"
              segments={[
                {
                  key: 'PENDING',
                  label: 'Pending',
                  count: delPending,
                  tone: 'warning',
                  href: '/deliveries?status=PENDING',
                },
                {
                  key: 'ASSIGNED',
                  label: 'Assigned',
                  count: delAssigned,
                  tone: 'info',
                  href: '/deliveries?status=ASSIGNED',
                },
                {
                  key: 'IN_TRANSIT',
                  label: 'In Transit',
                  count: delInTransit,
                  tone: 'primary',
                  href: '/deliveries?status=IN_TRANSIT',
                },
                {
                  key: 'DELIVERED',
                  label: 'Delivered',
                  count: delDelivered,
                  tone: 'success',
                  href: '/deliveries?status=DELIVERED',
                },
                {
                  key: 'CANCELLED',
                  label: 'Cancelled',
                  count: delCancelled,
                  tone: 'danger',
                  href: '/deliveries?status=CANCELLED',
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Load Plan Lifecycle"
            description="Plans by operational lifecycle stage"
            actions={
              <Link
                href="/loads"
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                All Plans →
              </Link>
            }
          />
          <CardContent>
            <DistributionBar
              totalLabel="Total Load Plans"
              emptyLabel="No load plans created yet"
              segments={[
                {
                  key: 'DRAFT',
                  label: 'Draft',
                  count: planDraft,
                  tone: 'neutral',
                  href: '/loads?status=DRAFT',
                },
                {
                  key: 'READY',
                  label: 'Ready',
                  count: planReady,
                  tone: 'info',
                  href: '/loads?status=READY',
                },
                {
                  key: 'DISPATCHED',
                  label: 'Dispatched',
                  count: planDispatched,
                  tone: 'primary',
                  href: '/loads?status=DISPATCHED',
                },
                {
                  key: 'COMPLETED',
                  label: 'Completed',
                  count: planCompleted,
                  tone: 'success',
                  href: '/loads?status=COMPLETED',
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Fleet Readiness"
            description="Vehicle availability and maintenance status"
            actions={
              <Link
                href="/trucks"
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                Manage Fleet →
              </Link>
            }
          />
          <CardContent>
            <DistributionBar
              totalLabel="Registered Trucks"
              emptyLabel="No trucks registered yet"
              segments={[
                {
                  key: 'AVAILABLE',
                  label: 'Available',
                  count: truckAvailable,
                  tone: 'success',
                  href: '/trucks?status=AVAILABLE',
                },
                {
                  key: 'IN_USE',
                  label: 'In Use',
                  count: truckInUse,
                  tone: 'primary',
                  href: '/trucks?status=IN_USE',
                },
                {
                  key: 'MAINTENANCE',
                  label: 'Maintenance',
                  count: truckMaintenance,
                  tone: 'warning',
                  href: '/trucks?status=MAINTENANCE',
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Operational Tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Active & Upcoming Load Plans (7 cols) */}
        <Card className="xl:col-span-7 flex flex-col">
          <CardHeader
            title="Active & Upcoming Load Plans"
            description="Plans currently in DRAFT, READY, or DISPATCHED state with live capacity utilization"
            bordered
            actions={
              <div className="flex items-center gap-2">
                <ButtonLink href="/loads/optimize" variant="ghost" size="xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Optimizer
                </ButtonLink>
                <ButtonLink href="/loads" variant="secondary" size="xs">
                  View All ({totalPlans})
                </ButtonLink>
              </div>
            }
          />
          <div className="flex-1 overflow-x-auto">
            {activeLoadPlans.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No active load plans"
                description="All load plans are completed or none have been created yet. Start a new draft plan or use the recommendation engine."
                actionLabel="Create Load Plan"
                actionHref="/loads/new"
                secondaryAction={
                  <ButtonLink
                    href="/loads/recommend"
                    variant="secondary"
                    size="sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                    Recommend Fleet
                  </ButtonLink>
                }
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Plan / Date</th>
                    <th className="px-4 py-2.5">Truck & Driver</th>
                    <th className="px-4 py-2.5">Capacity Utilization</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeLoadPlans.map((plan) => {
                    const totalWeight = plan.items.reduce(
                      (sum, item) => sum + Number(item.delivery?.weight || 0),
                      0
                    );
                    const maxCap = plan.truck?.weightCapacity || 0;

                    return (
                      <tr
                        key={plan.id}
                        className="hover:bg-gray-50/80 transition-colors"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={`/loads/${plan.id}`}
                            className="font-semibold text-gray-900 hover:text-primary-600"
                          >
                            Plan #{plan.id.slice(-6).toUpperCase()}
                          </Link>
                          <div className="text-xs text-gray-500 tabular-nums">
                            {format(new Date(plan.date), 'MMM d, yyyy')} •{' '}
                            {plan.items.length}{' '}
                            {plan.items.length === 1 ? 'stop' : 'stops'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {plan.truck?.name || 'Unassigned'}{' '}
                            {plan.truck?.plateNumber && (
                              <span className="text-xs text-gray-400">
                                ({plan.truck.plateNumber})
                              </span>
                            )}
                          </div>
                          <div className="text-xs">
                            {plan.driver ? (
                              <span className="text-gray-500">
                                Driver: {plan.driver.name}
                              </span>
                            ) : (
                              <span className="font-medium text-amber-600">
                                Driver unassigned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[170px]">
                          <CapacityBar
                            current={Math.round(totalWeight)}
                            max={maxCap}
                            size="sm"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <StatusBadge domain="loadPlan" status={plan.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Pending Deliveries Queue (5 cols) */}
        <Card className="xl:col-span-5 flex flex-col">
          <CardHeader
            title="Unassigned Delivery Queue"
            description="Pending orders awaiting assignment to a draft load plan"
            bordered
            actions={
              <div className="flex items-center gap-2">
                <ButtonLink href="/import" variant="ghost" size="xs">
                  <FileUp className="h-3.5 w-3.5" />
                  Import CSV
                </ButtonLink>
                <ButtonLink
                  href="/deliveries?status=PENDING"
                  variant="secondary"
                  size="xs"
                >
                  View Queue ({delPending})
                </ButtonLink>
              </div>
            }
          />
          <div className="flex-1 overflow-x-auto">
            {pendingDeliveries.length === 0 ? (
              <EmptyState
                icon={<Package className="h-5 w-5" />}
                title="No unassigned deliveries"
                description="Every active delivery has been assigned to a load plan, or no deliveries have been created yet."
                actionLabel="New Delivery"
                actionHref="/deliveries/new"
                secondaryAction={
                  <ButtonLink href="/import" variant="secondary" size="sm">
                    <FileUp className="h-3.5 w-3.5" />
                    Import CSV
                  </ButtonLink>
                }
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Customer / Destination</th>
                    <th className="px-4 py-2.5">Scheduled</th>
                    <th className="px-4 py-2.5 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingDeliveries.map((del) => (
                    <tr
                      key={del.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/deliveries/${del.id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 block truncate max-w-[200px]"
                        >
                          {del.customerName}
                        </Link>
                        <div className="text-xs text-gray-500 truncate max-w-[210px]">
                          {del.deliveryAddress}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600 tabular-nums">
                        {del.scheduledDate
                          ? format(new Date(del.scheduledDate), 'MMM d, yyyy')
                          : 'Unscheduled'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-gray-900 tabular-nums">
                        {Math.round(Number(del.weight)).toLocaleString()} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
