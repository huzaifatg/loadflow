import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import {
  Truck,
  Calendar,
  ArrowRight,
  Package,
  UserCheck,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export interface LoadPlanCardProps {
  id: string;
  date: string;
  status: string;
  truckName: string;
  truckPlate?: string;
  driverName?: string;
  totalDeliveries: number;
  totalWeight?: number;
  truckCapacity?: number;
  hasConflict?: boolean;
}

function getCardReadinessBadge(props: {
  status: string;
  driverName?: string;
  totalDeliveries: number;
  totalWeight: number;
  truckCapacity: number;
  hasConflict?: boolean;
}): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'neutral';
} {
  const {
    status,
    driverName,
    totalDeliveries,
    totalWeight,
    truckCapacity,
    hasConflict,
  } = props;
  if (status === 'COMPLETED') {
    return { label: 'Completed', tone: 'success' };
  }
  if (status === 'DISPATCHED') {
    return { label: 'In Transit', tone: 'primary' };
  }
  const isOverCapacity = truckCapacity > 0 && totalWeight > truckCapacity;
  if (hasConflict || isOverCapacity) {
    return {
      label: isOverCapacity ? 'Over Capacity' : 'Resource Conflict',
      tone: 'danger',
    };
  }
  if (!driverName && totalDeliveries === 0) {
    return { label: 'Needs Driver & Stops', tone: 'warning' };
  }
  if (!driverName) {
    return { label: 'Awaiting Driver', tone: 'warning' };
  }
  if (totalDeliveries === 0) {
    return { label: 'Empty Plan', tone: 'warning' };
  }
  if (status === 'READY') {
    return { label: 'Ready to Dispatch', tone: 'success' };
  }
  return { label: 'Ready to Lock', tone: 'info' };
}

export function LoadPlanCard({
  id,
  date,
  status,
  truckName,
  truckPlate,
  driverName,
  totalDeliveries,
  totalWeight = 0,
  truckCapacity = 0,
  hasConflict = false,
}: LoadPlanCardProps) {
  const readiness = getCardReadinessBadge({
    status,
    driverName,
    totalDeliveries,
    totalWeight,
    truckCapacity,
    hasConflict,
  });

  return (
    <Link href={`/loads/${id}`} className="block group focus-visible:outline-none">
      <Card className="flex h-full flex-col justify-between p-4 transition-all hover:border-primary-300 hover:shadow-sm">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>{date}</span>
              </div>
              <h3 className="mt-1 text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                Plan #{id.slice(-6).toUpperCase()}
              </h3>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge domain="loadPlan" status={status} />
              <Badge tone={readiness.tone} size="sm" dot>
                {readiness.label}
              </Badge>
            </div>
          </div>

          <div className="mt-3.5 space-y-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Truck className="h-3.5 w-3.5 text-gray-400" />
                Truck
              </span>
              <span className="font-semibold text-gray-900 truncate">
                {truckName}
                {truckPlate ? ` (${truckPlate})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-gray-500">
                <UserCheck className="h-3.5 w-3.5 text-gray-400" />
                Driver
              </span>
              {driverName ? (
                <span className="font-medium text-gray-800 truncate">
                  {driverName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Unassigned
                </span>
              )}
            </div>
          </div>

          {hasConflict && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>Scheduling or resource conflict detected</span>
            </div>
          )}

          <div className="mt-3.5">
            <CapacityBar
              current={Math.round(totalWeight)}
              max={truckCapacity}
              size="sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <Badge tone="neutral" size="sm">
            <Package className="h-3 w-3" />
            {totalDeliveries} {totalDeliveries === 1 ? 'delivery' : 'deliveries'}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
            Open Plan <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
