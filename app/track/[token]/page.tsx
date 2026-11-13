import React from 'react';
import { format } from 'date-fns';
import {
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Calendar,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Box,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { resolvePublicTrackingByToken } from '@/lib/services/tracking';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function StatusPill({
  status,
  label,
}: {
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  label: string;
}) {
  const styles: Record<typeof status, string> = {
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    ASSIGNED: 'bg-sky-50 text-sky-800 border-sky-200',
    IN_TRANSIT: 'bg-primary-50 text-primary-800 border-primary-200',
    DELIVERED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  const dotStyles: Record<typeof status, string> = {
    PENDING: 'bg-amber-500',
    ASSIGNED: 'bg-sky-500',
    IN_TRANSIT: 'bg-primary-600 animate-pulse',
    DELIVERED: 'bg-emerald-600',
    CANCELLED: 'bg-rose-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold',
        styles[status]
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dotStyles[status])} />
      {label}
    </span>
  );
}

export default async function PublicCustomerTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolvePublicTrackingByToken(prisma, token);

  // ─── Invalid / Revoked / Expired States ────────────────────────────────────
  if (!result.ok) {
    const isExpired = result.reason === 'EXPIRED';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white shadow-2xs">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-gray-900">
                  LoadFlow
                </span>
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  Shipment Tracking
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-12 sm:px-6">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
            <div
              className={cn(
                'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border',
                isExpired
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : 'border-gray-200 bg-gray-100 text-gray-500'
              )}
            >
              {isExpired ? (
                <Clock className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              {isExpired
                ? 'Shipment Tracking Link Expired'
                : 'Tracking Link Unavailable'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {isExpired
                ? 'This shipment tracking link has passed its expiration date. Please contact the sender or carrier for an updated tracking link.'
                : 'This tracking link is invalid, has been revoked, or is no longer active. Please verify the link with your sender or carrier.'}
            </p>
          </div>
        </main>

        <footer className="border-t border-gray-200 bg-white py-5">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 text-xs text-gray-500 sm:px-6">
            <span>Powered by LoadFlow</span>
            <span>Enterprise Logistics Visibility</span>
          </div>
        </footer>
      </div>
    );
  }

  const { tracking, progress, milestones, company } = result.data;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between text-gray-900">
      {/* A. Tracking Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-2xs">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-gray-900">
                  {company.name}
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  Shipment Tracking
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Reference <span className="font-mono font-semibold text-gray-700">{tracking.reference}</span>
              </p>
            </div>
          </div>

          <StatusPill status={tracking.status} label={tracking.statusLabel} />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {/* B. Shipment Overview & Status Banner */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
          <div className="border-b border-gray-100 bg-gray-50/60 px-6 py-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <span>Shipment {tracking.reference}</span>
                  <span>•</span>
                  <span>Recipient: {tracking.recipientName}</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  {tracking.statusLabel}
                </h1>
                <p className="text-sm text-gray-600">{tracking.headline}</p>
              </div>

              {/* E. ETA / Completion Callout */}
              <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:text-right">
                {progress.isDelivered && tracking.deliveredAt ? (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      Delivered On
                    </span>
                    <p className="mt-0.5 text-sm font-bold text-gray-900 tabular-nums">
                      {format(new Date(tracking.deliveredAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      {format(new Date(tracking.deliveredAt), 'h:mm a')}
                    </p>
                  </div>
                ) : tracking.estimatedDeliveryAt ? (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">
                      Estimated Delivery
                    </span>
                    <p className="mt-0.5 text-sm font-bold text-gray-900 tabular-nums">
                      {format(new Date(tracking.estimatedDeliveryAt), 'EEE, MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      By end of day
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Estimated Delivery
                    </span>
                    <p className="mt-0.5 text-xs font-medium text-gray-600">
                      Estimated delivery not available yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* C. Delivery Progress Indicator */}
          <div className="px-6 py-6">
            {progress.isCancelled ? (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-900">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">Shipment Cancelled</p>
                  <p className="text-xs text-rose-800">
                    This delivery order has been cancelled and is no longer scheduled for transit. Please contact {company.name} if you have questions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {progress.steps.map((step, index) => {
                  const isCompleted = step.state === 'COMPLETED';
                  const isCurrent = step.state === 'CURRENT';

                  return (
                    <div
                      key={step.key}
                      className={cn(
                        'relative flex flex-col justify-between rounded-xl border p-3.5 transition-colors',
                        isCompleted
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : isCurrent
                            ? 'border-primary-300 bg-primary-50/40 ring-1 ring-primary-200'
                            : 'border-gray-200 bg-gray-50/40 opacity-75'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider',
                            isCompleted
                              ? 'text-emerald-700'
                              : isCurrent
                                ? 'text-primary-700'
                                : 'text-gray-400'
                          )}
                        >
                          {isCompleted
                            ? 'Complete'
                            : isCurrent
                              ? 'Current Stage'
                              : 'Upcoming'}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <p className="text-xs font-bold text-gray-900">
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Origin & Destination Route Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Origin / Pickup Location
                  </span>
                  <p className="mt-0.5 text-xs font-semibold text-gray-900 break-words">
                    {tracking.origin || 'Origin facility'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-primary-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Destination Address
                  </span>
                  <p className="mt-0.5 text-xs font-semibold text-gray-900 break-words">
                    {tracking.destination || 'Destination address'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Bottom Layout: Shipment Timeline (7 cols) + Package Summary (5 cols) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* D. Chronological Shipment Timeline */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs lg:col-span-7">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Shipment Activity & Milestones
                </h2>
                <p className="text-xs text-gray-500">
                  Verified chronological updates from {company.name}
                </p>
              </div>
              <Clock className="h-4 w-4 text-gray-400" />
            </div>

            {milestones.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500">
                No milestones recorded yet.
              </p>
            ) : (
              <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-gray-200">
                {[...milestones].reverse().map((m) => {
                  const isCurrent = m.status === 'CURRENT';
                  return (
                    <li key={m.id} className="relative flex items-start gap-3.5 pl-9">
                      <span
                        className={cn(
                          'absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border shadow-2xs',
                          isCurrent
                            ? 'border-primary-300 bg-primary-600 text-white'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-gray-900">
                            {m.title}
                          </span>
                          {m.timestamp && (
                            <time
                              dateTime={m.timestamp}
                              className="text-[11px] font-medium text-gray-400 tabular-nums"
                            >
                              {format(new Date(m.timestamp), 'MMM d, yyyy • h:mm a')}
                            </time>
                          )}
                        </div>
                        {m.locationLabel && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            {m.locationLabel}
                          </p>
                        )}
                        {m.description && (
                          <p className="mt-1 text-xs leading-relaxed text-gray-600">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Shipment Specification & Manifest Summary */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs lg:col-span-5 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Shipment Details
                </h2>
                <p className="text-xs text-gray-500">
                   Cargo summary and reference details
                </p>
              </div>
              <Box className="h-4 w-4 text-gray-400" />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                <dt className="text-[11px] font-medium text-gray-500">Reference</dt>
                <dd className="mt-0.5 font-mono font-bold text-gray-900">
                  {tracking.reference}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                <dt className="text-[11px] font-medium text-gray-500">Total Weight</dt>
                <dd className="mt-0.5 font-bold text-gray-900 tabular-nums">
                  {tracking.itemSummary.totalWeightKg.toLocaleString()} kg
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                <dt className="text-[11px] font-medium text-gray-500">Carrier</dt>
                <dd className="mt-0.5 font-semibold text-gray-900 truncate">
                  {company.name}
                </dd>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                <dt className="text-[11px] font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-0.5 font-semibold text-gray-900 tabular-nums">
                  {format(new Date(tracking.updatedAt), 'MMM d, h:mm a')}
                </dd>
              </div>
            </dl>

            {tracking.itemSummary.items.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Items in Shipment ({tracking.itemSummary.totalItems})
                </h3>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {tracking.itemSummary.items.map((item, idx) => (
                    <li
                      key={`${item.productName}-${idx}`}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-gray-800 truncate pr-2">
                        {item.productName}
                      </span>
                      <span className="shrink-0 font-semibold text-gray-600 tabular-nums">
                        {item.quantity} {item.quantityUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* G. Footer */}
      <footer className="border-t border-gray-200 bg-white py-5 mt-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-gray-500 sm:px-6">
          <span>
            Shipment fulfilled by <strong className="font-semibold text-gray-700">{company.name}</strong>
          </span>
          <span>Powered by LoadFlow</span>
        </div>
      </footer>
    </div>
  );
}
