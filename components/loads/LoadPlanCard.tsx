import React from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Truck, Calendar, ArrowRight, Package, Weight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LoadPlanCardProps {
  id: string;
  date: string;
  status: string;
  truckName: string;
  driverName?: string;
  totalDeliveries: number;
  /** Total assigned weight in kg */
  totalWeight?: number;
  /** Truck weight capacity in kg */
  truckCapacity?: number;
}

/**
 * Derive utilization color classes from a percentage.
 * Mirrors the thresholds used by CapacityBar:
 *   <60% → emerald (low)
 *   60–85% → amber (medium)
 *   85–100% → rose (high)
 *   >100% → red (over capacity)
 */
function getUtilizationStyle(pct: number) {
  if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
  if (pct > 85) return { bar: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' };
  if (pct >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
}

export function LoadPlanCard({ id, date, status, truckName, driverName, totalDeliveries, totalWeight = 0, truckCapacity = 0 }: LoadPlanCardProps) {
  const hasCapacityData = truckCapacity > 0;
  const utilizationPct = hasCapacityData ? (totalWeight / truckCapacity) * 100 : 0;
  const clampedPct = Math.min(utilizationPct, 100);
  const style = getUtilizationStyle(utilizationPct);

  return (
    <Link href={`/loads/${id}`}>
      <Card className="hover:shadow-md transition-all group cursor-pointer p-5 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <Calendar className="h-4 w-4 mr-1.5" />
              {date}
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
              Plan {id.split('-')[0]}...
            </h3>
          </div>
          <StatusPill status={status} />
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="flex items-center text-sm">
            <Truck className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-gray-700">{truckName}</span>
            {driverName && <span className="text-gray-400 ml-1">({driverName})</span>}
          </div>
        </div>

        {/* Utilization Section */}
        {hasCapacityData && totalDeliveries > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Weight className="h-3 w-3" />
                {totalWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {truckCapacity.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
              </span>
              <span className={cn('font-semibold', style.text)}>
                {Math.round(utilizationPct)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn('h-full rounded-full transition-all duration-500 ease-out', style.bar)}
                style={{ width: `${clampedPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {totalDeliveries} {totalDeliveries === 1 ? 'Delivery' : 'Deliveries'}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
        </div>
      </Card>
    </Link>
  );
}
