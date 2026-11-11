'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCheck,
  Clock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { OperationalException } from '@/lib/services/operational-exceptions';

interface NotificationActivityItem {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  message: string;
  actorLabel: string | null;
  createdAt: string;
  href: string;
  unread: boolean;
}

interface NotificationsPayload {
  exceptions: OperationalException[];
  exceptionSummary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  activities: NotificationActivityItem[];
  unreadActivityCount: number;
  badgeCount: number;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'alerts' | 'activity'>('alerts');
  const [data, setData] = useState<NotificationsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json: NotificationsPayload = await res.json();
        setData(json);
      }
    } catch {
      // Ignore network errors silently in background indicator
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'POST' });
      if (res.ok && data) {
        setData({
          ...data,
          activities: data.activities.map((a) => ({ ...a, unread: false })),
          unreadActivityCount: 0,
          badgeCount:
            data.exceptionSummary.critical + data.exceptionSummary.warning,
        });
      }
    } catch {
      // ignore
    }
  };

  const criticalCount = data?.exceptionSummary.critical ?? 0;
  const warningCount = data?.exceptionSummary.warning ?? 0;
  const unreadActivityCount = data?.unreadActivityCount ?? 0;
  const badgeCount = criticalCount + warningCount + unreadActivityCount;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
        aria-label="Operational notifications and alerts"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums',
              criticalCount > 0
                ? 'bg-rose-600'
                : warningCount > 0
                ? 'bg-amber-500'
                : 'bg-primary-600'
            )}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Operational Notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl animate-fade-in z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-900">
                Operational Notifications
              </h3>
              <p className="text-[11px] text-gray-500">
                Live dispatch alerts &amp; workspace activity
              </p>
            </div>
            {unreadActivityCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary-600 hover:bg-primary-50 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-gray-100 bg-gray-50/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('alerts')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors cursor-pointer',
                tab === 'alerts'
                  ? 'bg-white font-semibold text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <span>Action Required</span>
              {(criticalCount > 0 || warningCount > 0) && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums',
                    criticalCount > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {criticalCount + warningCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('activity')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors cursor-pointer',
                tab === 'activity'
                  ? 'bg-white font-semibold text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <span>Recent Activity</span>
              {unreadActivityCount > 0 && (
                <span className="rounded-full bg-primary-100 px-1.5 py-0.2 text-[10px] font-semibold text-primary-700 tabular-nums">
                  {unreadActivityCount}
                </span>
              )}
            </button>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {loading && !data ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Checking operational state...
              </div>
            ) : tab === 'alerts' ? (
              !data || data.exceptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  <p className="mt-2 text-xs font-semibold text-gray-900">
                    All Clear — No Operational Exceptions
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Active load plans and deliveries have no blocking issues.
                  </p>
                </div>
              ) : (
                data.exceptions.map((ex) => (
                  <Link
                    key={ex.key}
                    href={ex.action?.href || ex.entity.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="mt-0.5 shrink-0">
                      {ex.severity === 'critical' ? (
                        <AlertOctagon className="h-4 w-4 text-rose-600" />
                      ) : ex.severity === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Info className="h-4 w-4 text-sky-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          tone={
                            ex.severity === 'critical'
                              ? 'danger'
                              : ex.severity === 'warning'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        >
                          {ex.severity}
                        </Badge>
                        <span className="truncate text-xs font-semibold text-gray-900">
                          {ex.entity.label}: {ex.title}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-600">
                        {ex.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  </Link>
                ))
              )
            ) : !data || data.activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Clock className="h-6 w-6 text-gray-300" />
                <p className="mt-2 text-xs font-semibold text-gray-900">
                  No Recent Lifecycle Activity
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Load plan dispatches, completions, and order updates will appear here.
                </p>
              </div>
            ) : (
              data.activities.map((act) => (
                <Link
                  key={act.id}
                  href={act.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-gray-50',
                    act.unread && 'bg-primary-50/30'
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      act.unread ? 'bg-primary-600' : 'bg-gray-300'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-800">{act.message}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {formatDistanceToNow(new Date(act.createdAt), {
                        addSuffix: true,
                      })}
                      {act.actorLabel ? ` • ${act.actorLabel}` : ''}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-center">
            <Link
              href="/dashboard#exception-center"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Open Operational Exception Center →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

