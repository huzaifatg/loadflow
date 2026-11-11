'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type {
  OperationalException,
  ExceptionSeverity,
} from '@/lib/services/operational-exceptions';

const SEVERITY_META: Record<
  ExceptionSeverity,
  {
    label: string;
    tone: 'danger' | 'warning' | 'info';
    icon: React.ReactNode;
    border: string;
    bg: string;
  }
> = {
  critical: {
    label: 'Critical',
    tone: 'danger',
    icon: <AlertOctagon className="h-4 w-4 text-rose-600" />,
    border: 'border-l-4 border-l-rose-500',
    bg: 'bg-rose-50/30',
  },
  warning: {
    label: 'Warning',
    tone: 'warning',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    border: 'border-l-4 border-l-amber-500',
    bg: 'bg-amber-50/20',
  },
  info: {
    label: 'Info',
    tone: 'info',
    icon: <Info className="h-4 w-4 text-sky-600" />,
    border: 'border-l-4 border-l-sky-500',
    bg: 'bg-sky-50/20',
  },
};

export function ExceptionCenterPanel({
  exceptions,
}: {
  exceptions: OperationalException[];
}) {
  const [filter, setFilter] = useState<'all' | ExceptionSeverity>('all');

  const counts = {
    all: exceptions.length,
    critical: exceptions.filter((e) => e.severity === 'critical').length,
    warning: exceptions.filter((e) => e.severity === 'warning').length,
    info: exceptions.filter((e) => e.severity === 'info').length,
  };

  const visible =
    filter === 'all'
      ? exceptions
      : exceptions.filter((e) => e.severity === filter);

  return (
    <Card id="exception-center">
      <CardHeader
        title="Operational Exception Center"
        description="Live dispatch blockers, overdue orders, capacity violations, and resource conflicts derived from active company data"
        icon={
          counts.critical > 0 ? (
            <AlertOctagon className="h-4 w-4 text-rose-600" />
          ) : counts.warning > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          )
        }
        bordered
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100/80 p-0.5 text-xs">
            {(
              [
                { key: 'all', label: 'All', count: counts.all },
                { key: 'critical', label: 'Critical', count: counts.critical },
                { key: 'warning', label: 'Warning', count: counts.warning },
                { key: 'info', label: 'Info', count: counts.info },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  filter === tab.key
                    ? 'bg-white font-semibold text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums',
                    tab.key === 'critical' && tab.count > 0
                      ? 'bg-rose-100 text-rose-700'
                      : tab.key === 'warning' && tab.count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-200/70 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        }
      />

      <CardContent className="p-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-gray-900">
              {exceptions.length === 0
                ? 'Zero Operational Exceptions'
                : `No ${filter} exceptions`}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {exceptions.length === 0
                ? 'All active load plans, scheduled deliveries, trucks, and drivers satisfy operational checks.'
                : 'Switch severity filters above to inspect other operational alerts.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map((ex) => {
              const meta = SEVERITY_META[ex.severity];
              return (
                <div
                  key={ex.key}
                  className={cn(
                    'flex flex-col justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center',
                    meta.border,
                    meta.bg
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">{meta.icon}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={meta.tone} size="sm">
                          {meta.label}
                        </Badge>
                        <Link
                          href={ex.entity.href}
                          className="text-xs font-semibold text-gray-900 hover:text-primary-600 underline decoration-gray-300 underline-offset-2"
                        >
                          {ex.entity.label}
                        </Link>
                        <span className="text-xs font-semibold text-gray-800">
                          — {ex.title}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        {ex.description}
                      </p>
                      {ex.related.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {ex.related.map((rel) => (
                            <Link
                              key={`${rel.kind}-${rel.id}`}
                              href={rel.href}
                              className="inline-flex items-center rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:border-primary-300 hover:text-primary-700"
                            >
                              {rel.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:pl-3">
                    {ex.action && (
                      <Link
                        href={ex.action.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs transition-colors hover:border-primary-300 hover:text-primary-600"
                      >
                        <span>{ex.action.label}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EntityExceptionBanner({
  exceptions,
}: {
  exceptions: OperationalException[];
}) {
  if (exceptions.length === 0) return null;

  return (
    <div className="space-y-2">
      {exceptions.map((ex) => {
        const meta = SEVERITY_META[ex.severity];
        return (
          <div
            key={ex.key}
            className={cn(
              'flex flex-col justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-2xs sm:flex-row sm:items-center',
              meta.border
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{meta.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={meta.tone} size="sm">
                    {meta.label}
                  </Badge>
                  <span className="text-xs font-semibold text-gray-900">
                    {ex.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">{ex.description}</p>
              </div>
            </div>
            {ex.action && (
              <Link
                href={ex.action.href}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary-300 hover:text-primary-600"
              >
                {ex.action.label} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

