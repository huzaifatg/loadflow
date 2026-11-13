import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Calendar,
  Package,
  ArrowLeft,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AllocationPanel } from '@/components/loads/AllocationPanel';
import {
  LoadPlanActions,
  DraftDriverSelector,
} from '@/components/loads/LoadPlanActions';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import {
  toNumber,
  getItemSummary,
  aggregateByUnit,
} from '@/lib/delivery-items';
import {
  LIFECYCLE_STEPS,
  getLifecycleStepIndex,
  getCapacityLevel,
} from '@/lib/ui/status';
import { cn } from '@/lib/utils';
import { getAuthContext } from '@/lib/auth';
import { listActivityForEntity, type ActivityRecord } from '@/lib/services/activity';
import {
  getOperationalExceptions,
  exceptionsForEntity,
  type OperationalException,
} from '@/lib/services/operational-exceptions';
import {
  getDispatchConflicts,
  type PlanDispatchReadinessDTO,
} from '@/lib/services/dispatch-conflicts';
import { ActivityTimeline } from '@/components/ui/ActivityTimeline';
import { EntityExceptionBanner } from '@/components/operations/ExceptionCenterPanel';

export default async function LoadPlanBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let company = null;
  try {
    const auth = await getAuthContext();
    company = auth?.company;
  } catch (e) {
    console.error('DB error:', e);
  }

  const id = (await params).id;

  let loadPlan = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unassignedDeliveries: any[] = [];
  let availableDrivers: { id: string; name: string }[] = [];
  let activityEvents: ActivityRecord[] = [];
  let planExceptions: OperationalException[] = [];
  let planReadiness: PlanDispatchReadinessDTO | null = null;

  if (company) {
    try {
      loadPlan = await prisma.loadPlan.findUnique({
        where: { id, companyId: company.id },
        include: {
          truck: true,
          driver: true,
          items: {
            include: {
              delivery: {
                include: {
                  items: { orderBy: { sortOrder: 'asc' } },
                  _count: { select: { items: true } },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (loadPlan) {
        const [[unassigned, drivers], events, allExceptions, conflictInfo] = await Promise.all([
          prisma.$transaction([
            prisma.delivery.findMany({
              where: {
                companyId: company.id,
                status: 'PENDING',
                isArchived: false,
                loadPlanItems: { none: {} },
              },
              include: {
                items: { orderBy: { sortOrder: 'asc' } },
                _count: { select: { items: true } },
              },
              orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
            }),
            prisma.driver.findMany({
              where: {
                companyId: company.id,
                status: 'AVAILABLE',
                isArchived: false,
              },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            }),
          ]),
          listActivityForEntity(prisma, company.id, 'LOAD_PLAN', id),
          getOperationalExceptions(prisma, company.id),
          getDispatchConflicts(prisma, company.id, { planId: id }),
        ]);
        unassignedDeliveries = unassigned;
        availableDrivers = drivers;
        activityEvents = events;
        planExceptions = exceptionsForEntity(allExceptions, id);
        planReadiness = conflictInfo.readinessByPlan[id] ?? null;
      }
    } catch (e) {
      console.error('Load plan fetch error', e);
    }
  }

  if (!loadPlan) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4 text-center">
        <h2 className="text-lg font-bold text-gray-900">Load Plan Not Found</h2>
        <p className="max-w-sm text-xs text-gray-500">
          The requested load plan does not exist or belongs to another workspace.
        </p>
        <ButtonLink href="/loads" variant="secondary" size="sm">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Load Plans
        </ButtonLink>
      </div>
    );
  }

  const truckCapacity = loadPlan.truck?.weightCapacity ?? 0;

  const initialAssigned = loadPlan.items.map((item) => ({
    id: item.delivery.id,
    customerName: item.delivery.customerName,
    pickupAddress: item.delivery.pickupAddress,
    deliveryAddress: item.delivery.deliveryAddress,
    scheduledDate: item.delivery.scheduledDate
      ? item.delivery.scheduledDate.toISOString()
      : null,
    weight: toNumber(item.delivery.weight),
    itemCount: item.delivery._count?.items || 0,
    itemSummary: getItemSummary(item.delivery.items || []),
  }));

  const initialUnassigned = unassignedDeliveries.map((d) => ({
    id: d.id,
    customerName: d.customerName,
    pickupAddress: d.pickupAddress,
    deliveryAddress: d.deliveryAddress,
    scheduledDate: d.scheduledDate
      ? new Date(d.scheduledDate).toISOString()
      : null,
    weight: toNumber(d.weight),
    itemCount: d._count?.items || 0,
    itemSummary: getItemSummary(d.items || []),
  }));

  const allAssignedItems = loadPlan.items.flatMap((lpi) =>
    (lpi.delivery.items || []).map((item) => ({
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
    }))
  );
  const unitBreakdown = aggregateByUnit(allAssignedItems);
  const totalWeight = initialAssigned.reduce((sum, d) => sum + d.weight, 0);
  const remainingCapacity = truckCapacity - totalWeight;
  const { isOverweight } = getCapacityLevel(totalWeight, truckCapacity);

  const currentStepIdx = getLifecycleStepIndex(loadPlan.status);
  const isDraft = loadPlan.status === 'DRAFT';
  const hasDriver = Boolean(loadPlan.driverId);
  const hasStops = initialAssigned.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: 'Load Plans', href: '/loads' },
          { label: `Plan #${loadPlan.id.slice(-6).toUpperCase()}` },
        ]}
        title={`Load Plan #${loadPlan.id.slice(-6).toUpperCase()}`}
        description={`${loadPlan.truck.name} (${loadPlan.truck.plateNumber}) • Planned for ${format(new Date(loadPlan.date), 'MMMM d, yyyy')}`}
        meta={
          <div className="flex items-center gap-1.5">
            <StatusBadge domain="loadPlan" status={loadPlan.status} />
            {planReadiness && (
              <Badge tone={planReadiness.readinessTone} size="sm" dot>
                {planReadiness.readinessLabel}
              </Badge>
            )}
          </div>
        }
      >
        <ButtonLink
          href={`/dispatch?date=${format(new Date(loadPlan.date), 'yyyy-MM-dd')}`}
          variant="secondary"
          size="sm"
        >
          Dispatch Board
        </ButtonLink>
        <LoadPlanActions
          loadPlanId={id}
          currentStatus={loadPlan.status}
          hasDriver={hasDriver}
          deliveryCount={initialAssigned.length}
          isOverCapacity={isOverweight}
        />
      </PageHeader>

      <EntityExceptionBanner exceptions={planExceptions} />

      {/* Sprint 18: Scheduling Conflicts & Readiness Reasons */}
      {planReadiness && planReadiness.conflicts.some((c) => c.code === 'TRUCK_CONFLICT' || c.code === 'DRIVER_CONFLICT' || c.code === 'DELIVERY_DATE_MISMATCH') && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            Scheduling & Resource Intelligence Alerts
          </p>
          {planReadiness.conflicts
            .filter(
              (c) =>
                c.code === 'TRUCK_CONFLICT' ||
                c.code === 'DRIVER_CONFLICT' ||
                c.code === 'DELIVERY_DATE_MISMATCH'
            )
            .map((c) => (
              <p key={c.id} className="text-rose-800">
                • <strong>{c.title}:</strong> {c.message}
              </p>
            ))}
        </div>
      )}

      {/* ── Visual Lifecycle Stepper ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isComplete = idx < currentStepIdx || loadPlan.status === 'COMPLETED';
            const isCurrent = idx === currentStepIdx;
            return (
              <div
                key={step.status}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                  isCurrent
                    ? 'border-primary-300 bg-primary-50/40'
                    : isComplete
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-gray-100 bg-gray-50/50 opacity-70'
                )}
              >
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isComplete
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900">
                      {step.label}
                    </span>
                    {isCurrent && (
                      <Badge tone="primary" size="sm">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dispatch Readiness Checklist when in DRAFT or READY */}
        {(loadPlan.status === 'DRAFT' || loadPlan.status === 'READY') && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-semibold text-gray-700">
                Dispatch Preconditions:
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Truck assigned ({loadPlan.truck.name})
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  hasDriver ? 'text-emerald-700' : 'text-amber-700'
                )}
              >
                {hasDriver ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                )}
                {hasDriver
                  ? `Driver assigned (${loadPlan.driver?.name})`
                  : 'Driver required before dispatch'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  hasStops ? 'text-emerald-700' : 'text-amber-700'
                )}
              >
                {hasStops ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                )}
                {hasStops
                  ? `${initialAssigned.length} ${initialAssigned.length === 1 ? 'delivery' : 'deliveries'} allocated`
                  : 'At least 1 delivery required'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  !isOverweight ? 'text-emerald-700' : 'text-rose-700'
                )}
              >
                {!isOverweight ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                )}
                {!isOverweight ? 'Within truck weight capacity' : 'Over truck weight capacity'}
              </span>
            </div>

            {!isDraft && (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Lock className="h-3.5 w-3.5" />
                Revert to Draft to modify driver or deliveries
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Resource & Capacity Summary Card ─────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0">
          {/* Assigned Truck */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Assigned Truck
            </p>
            <Link
              href={`/trucks/${loadPlan.truck.id}`}
              className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900 hover:text-primary-600"
            >
              <Truck className="h-4 w-4 text-primary-600 shrink-0" />
              <span className="truncate">{loadPlan.truck.name}</span>
            </Link>
            <p className="mt-0.5 text-xs text-gray-500 font-mono">
              {loadPlan.truck.plateNumber}
            </p>
          </div>

          {/* Assigned Driver */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Assigned Driver
            </p>
            <DraftDriverSelector
              loadPlanId={loadPlan.id}
              currentDriverId={loadPlan.driverId}
              currentDriverName={loadPlan.driver?.name || null}
              availableDrivers={availableDrivers}
              isEditable={isDraft}
            />
            {!hasDriver && !isDraft && (
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                Revert to Draft to assign driver
              </p>
            )}
          </div>

          {/* Planned Date */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Planned Date
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900 tabular-nums">
              <Calendar className="h-4 w-4 text-gray-400" />
              {format(new Date(loadPlan.date), 'MMM d, yyyy')}
            </p>
            {loadPlan.notes && (
              <p className="mt-0.5 truncate text-xs text-gray-500" title={loadPlan.notes}>
                {loadPlan.notes}
              </p>
            )}
          </div>

          {/* Deliveries / Stops */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Allocated Stops
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-gray-900 tabular-nums">
              <Package className="h-4 w-4 text-gray-400" />
              {initialAssigned.length}
            </p>
            {initialAssigned.length > 0 && unitBreakdown.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {unitBreakdown
                  .map(
                    (u) =>
                      `${u.count.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${u.unit}`
                  )
                  .join(', ')}
              </p>
            )}
          </div>

          {/* Total Weight */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Total Payload
            </p>
            <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
              {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
              <span className="text-xs font-normal text-gray-400">kg</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
              Max: {truckCapacity.toLocaleString()} kg
            </p>
          </div>

          {/* Remaining Capacity */}
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Remaining Capacity
            </p>
            <p
              className={cn(
                'mt-1 text-lg font-bold tabular-nums',
                isOverweight ? 'text-rose-600' : 'text-gray-900'
              )}
            >
              {isOverweight ? '-' : ''}
              {Math.abs(remainingCapacity).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}{' '}
              <span className="text-xs font-normal text-gray-400">kg</span>
            </p>
            {isOverweight && (
              <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
                Overweight by {Math.abs(remainingCapacity).toLocaleString()} kg
              </p>
            )}
          </div>
        </div>

        {/* Full-width Capacity Bar */}
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
          <CapacityBar
            current={Math.round(totalWeight)}
            max={truckCapacity}
            size="md"
          />
        </div>
      </div>

      <AllocationPanel
        loadPlanId={id}
        initialUnassigned={initialUnassigned}
        initialAssigned={initialAssigned}
        truckCapacity={truckCapacity}
        isFinalized={loadPlan.status !== 'DRAFT'}
      />

      <ActivityTimeline
        events={activityEvents}
        title="Load Plan Lifecycle & Audit Log"
        description="Chronological record of plan creation, delivery allocations, driver assignments, and dispatch transitions"
      />
    </div>
  );
}
