import React from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  ClipboardList,
  Navigation,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  Truck,
  Users,
  XCircle,
  Archive,
  Calendar,
  FileText,
  Clock,
  Share2,
  ShieldOff,
  MapPin,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from './Card';
import { cn } from '@/lib/utils';
import type { ActivityRecord } from '@/lib/services/activity';

interface EventStyle {
  icon: React.ReactNode;
  ring: string;
  label: string;
}

function getEventStyle(type: string): EventStyle {
  switch (type) {
    case 'LOAD_PLAN_CREATED':
    case 'DELIVERY_CREATED':
      return {
        icon: <Plus className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label: 'Created',
      };
    case 'LOAD_PLAN_MARKED_READY':
      return {
        icon: <ClipboardList className="h-3.5 w-3.5 text-sky-600" />,
        ring: 'bg-sky-50 border-sky-200',
        label: 'Marked Ready',
      };
    case 'LOAD_PLAN_REVERTED_TO_DRAFT':
      return {
        icon: <RotateCcw className="h-3.5 w-3.5 text-amber-600" />,
        ring: 'bg-amber-50 border-amber-200',
        label: 'Reverted to Draft',
      };
    case 'LOAD_PLAN_DISPATCHED':
    case 'DELIVERY_IN_TRANSIT':
      return {
        icon: <Navigation className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label: 'Dispatched',
      };
    case 'LOAD_PLAN_COMPLETED':
    case 'DELIVERY_DELIVERED':
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
        ring: 'bg-emerald-50 border-emerald-200',
        label: 'Completed',
      };
    case 'LOAD_PLAN_DELIVERIES_ADDED':
    case 'DELIVERY_ALLOCATED':
      return {
        icon: <Package className="h-3.5 w-3.5 text-sky-600" />,
        ring: 'bg-sky-50 border-sky-200',
        label: 'Allocated',
      };
    case 'LOAD_PLAN_DELIVERIES_REMOVED':
    case 'DELIVERY_RELEASED':
      return {
        icon: <Package className="h-3.5 w-3.5 text-amber-600" />,
        ring: 'bg-amber-50 border-amber-200',
        label: 'Released',
      };
    case 'LOAD_PLAN_TRUCK_CHANGED':
      return {
        icon: <Truck className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label: 'Truck Updated',
      };
    case 'LOAD_PLAN_DRIVER_ASSIGNED':
    case 'LOAD_PLAN_DRIVER_REMOVED':
      return {
        icon: <Users className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label: 'Driver Assignment',
      };
    case 'DELIVERY_CANCELLED':
      return {
        icon: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
        ring: 'bg-rose-50 border-rose-200',
        label: 'Cancelled',
      };
    case 'DELIVERY_ARCHIVED':
    case 'DELIVERY_RESTORED':
      return {
        icon: <Archive className="h-3.5 w-3.5 text-gray-600" />,
        ring: 'bg-gray-100 border-gray-200',
        label: type === 'DELIVERY_ARCHIVED' ? 'Archived' : 'Restored',
      };
    case 'DELIVERY_RESCHEDULED':
      return {
        icon: <Calendar className="h-3.5 w-3.5 text-sky-600" />,
        ring: 'bg-sky-50 border-sky-200',
        label: 'Rescheduled',
      };
    case 'LOAD_PLAN_DELETED':
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-rose-600" />,
        ring: 'bg-rose-50 border-rose-200',
        label: 'Deleted',
      };
    case 'TRACKING_LINK_GENERATED':
    case 'TRACKING_LINK_REGENERATED':
    case 'TRACKING_EXPIRATION_UPDATED':
      return {
        icon: <Share2 className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label:
          type === 'TRACKING_LINK_GENERATED'
            ? 'Tracking Link Generated'
            : type === 'TRACKING_LINK_REGENERATED'
              ? 'Tracking Link Rotated'
              : 'Tracking Expiration Updated',
      };
    case 'TRACKING_LINK_REVOKED':
      return {
        icon: <ShieldOff className="h-3.5 w-3.5 text-rose-600" />,
        ring: 'bg-rose-50 border-rose-200',
        label: 'Tracking Link Revoked',
      };
    case 'DELIVERY_ETA_UPDATED':
      return {
        icon: <Calendar className="h-3.5 w-3.5 text-primary-600" />,
        ring: 'bg-primary-50 border-primary-200',
        label: 'ETA Updated',
      };
    case 'TRACKING_MILESTONE_ADDED':
      return {
        icon: <MapPin className="h-3.5 w-3.5 text-emerald-600" />,
        ring: 'bg-emerald-50 border-emerald-200',
        label: 'Customer Tracking Milestone',
      };
    default:
      return {
        icon: <FileText className="h-3.5 w-3.5 text-gray-500" />,
        ring: 'bg-gray-100 border-gray-200',
        label: 'Updated',
      };
  }
}

export function ActivityTimeline({
  events,
  title = 'Operational Activity & Audit Log',
  description = 'Chronological record of verified lifecycle transitions and edits',
  emptyMessage = 'No operational events recorded since activity tracking was enabled.',
}: {
  events: ActivityRecord[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        icon={<Clock className="h-4 w-4" />}
        bordered
      />
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">{emptyMessage}</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-gray-200">
            {events.map((evt) => {
              const style = getEventStyle(evt.type);
              return (
                <li key={evt.id} className="relative flex items-start gap-3 pl-9">
                  <span
                    className={cn(
                      'absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border shadow-2xs',
                      style.ring
                    )}
                    aria-hidden
                  >
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {style.label}
                      </span>
                      <time
                        dateTime={new Date(evt.createdAt).toISOString()}
                        className="text-[11px] text-gray-400 tabular-nums"
                      >
                        {format(new Date(evt.createdAt), 'MMM d, yyyy • h:mm a')}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
                      {evt.message}
                    </p>
                    {evt.actorLabel && (
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        By {evt.actorLabel}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

