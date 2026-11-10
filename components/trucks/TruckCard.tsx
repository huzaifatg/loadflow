'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Truck, Gauge, ArrowRight, ClipboardList } from 'lucide-react';

export interface TruckCardProps {
  id: string;
  name: string;
  plateNumber: string;
  type: string;
  weightCapacity: number;
  status: string;
  loadPlanCount?: number;
}

export function TruckCard({
  id,
  name,
  plateNumber,
  type,
  weightCapacity,
  status,
  loadPlanCount,
}: TruckCardProps) {
  return (
    <Link href={`/trucks/${id}`} className="block group focus-visible:outline-none">
      <Card className="flex h-full flex-col justify-between p-4 transition-all hover:border-primary-300 hover:shadow-sm">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {name}
                </h3>
                <p className="truncate text-xs text-gray-500">
                  <span className="font-mono font-semibold text-gray-700">
                    {plateNumber}
                  </span>{' '}
                  • {type}
                </p>
              </div>
            </div>
            <StatusBadge domain="truck" status={status} />
          </div>

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Gauge className="h-3.5 w-3.5 text-gray-400" />
                Payload Capacity
              </span>
              <span className="font-bold text-gray-900 tabular-nums">
                {weightCapacity.toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          {loadPlanCount !== undefined ? (
            <Badge tone="neutral" size="sm">
              <ClipboardList className="h-3 w-3" />
              {loadPlanCount} {loadPlanCount === 1 ? 'plan' : 'plans'}
            </Badge>
          ) : (
            <span className="text-xs text-gray-400">Vehicle record</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
            Inspect <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
