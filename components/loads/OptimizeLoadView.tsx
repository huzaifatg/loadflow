'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import {
  Sparkles,
  Truck,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface OptimizedDelivery {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: number;
  scheduledDate: string | null;
  itemSummary: string;
}

interface OptimizedPlan {
  truckId: string;
  truckName: string;
  truckPlateNumber: string;
  truckCapacity: number;
  totalWeight: number;
  utilizationPct: number;
  deliveries: OptimizedDelivery[];
}

interface UnassignedDelivery {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: number;
  reason: string;
}

interface OptimizeStats {
  totalDeliveries: number;
  assignedCount: number;
  unassignedCount: number;
  plansCreated: number;
  trucksUsed: number;
  trucksAvailable: number;
  avgUtilization: number;
}

interface OptimizeResponse {
  date: string;
  plans: OptimizedPlan[];
  unassigned: UnassignedDelivery[];
  stats: OptimizeStats;
}

export function OptimizeLoadView() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);

  async function handleGenerate() {
    if (loading || !date) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/loads/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || 'Optimization failed. Please try again.');
        return;
      }

      const data: OptimizeResponse = await res.json();
      setResult(data);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!result || applying) return;
    setApplying(true);

    try {
      let created = 0;

      for (const plan of result.plans) {
        const createRes = await fetch('/api/loads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            truckId: plan.truckId,
            date: date,
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => null);
          toast.error(
            `Failed to create plan for ${plan.truckName}: ${errData?.error || 'Unknown error'}`
          );
          continue;
        }

        const newPlan = await createRes.json();

        const assignRes = await fetch(`/api/loads/${newPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: plan.deliveries.map((d) => d.id),
          }),
        });

        if (!assignRes.ok) {
          const errData = await assignRes.json().catch(() => null);
          toast.error(
            `Failed to assign deliveries to ${plan.truckName}: ${errData?.error || 'Unknown error'}`
          );
          continue;
        }

        created++;
      }

      if (created === result.plans.length) {
        toast.success(
          `Created ${created} optimized load plan${created !== 1 ? 's' : ''}`
        );
      } else if (created > 0) {
        toast.warning(
          `Created ${created} of ${result.plans.length} plans. Check the load plans page for details.`
        );
      } else {
        toast.error('Failed to create any plans. Please try again.');
        setApplying(false);
        return;
      }

      router.push('/loads');
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
      setApplying(false);
    }
  }

  if (!result) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card padding="lg">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-600">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Configure Multi-Truck Packing
              </h3>
              <p className="text-xs text-gray-500">
                Select a dispatch date to pack pending deliveries across available
                vehicles.
              </p>
            </div>
          </div>

          <Input
            label="Target Dispatch Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint="Includes deliveries scheduled for this date or with no scheduled date. Excludes trucks already committed on this date."
          />

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <Button variant="secondary" onClick={() => router.push('/loads')}>
              <ArrowLeft className="h-4 w-4" />
              Back to Plans
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={loading}
              disabled={!date}
            >
              <Sparkles className="h-4 w-4" />
              Simulate Optimization
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { plans, unassigned, stats } = result;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="grid grid-cols-2 divide-x divide-gray-100 sm:grid-cols-3 lg:grid-cols-6">
          <StatCell label="Total Deliveries" value={stats.totalDeliveries} />
          <StatCell
            label="Packed"
            value={stats.assignedCount}
            tone="text-emerald-600"
          />
          <StatCell
            label="Unassigned"
            value={stats.unassignedCount}
            tone={stats.unassignedCount > 0 ? 'text-amber-600' : undefined}
          />
          <StatCell label="Proposed Plans" value={stats.plansCreated} />
          <StatCell
            label="Trucks Used"
            value={`${stats.trucksUsed} / ${stats.trucksAvailable}`}
          />
          <StatCell
            label="Avg Utilization"
            value={`${stats.avgUtilization}%`}
            tone="text-primary-600"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Proposed Truck Load Plans ({plans.length})
        </h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((plan, idx) => (
            <Card key={`${plan.truckId}-${idx}`} className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {plan.truckName}
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      {plan.truckPlateNumber}
                    </p>
                  </div>
                </div>
                <Badge tone="primary">
                  {plan.deliveries.length}{' '}
                  {plan.deliveries.length === 1 ? 'stop' : 'stops'}
                </Badge>
              </div>

              <CapacityBar
                current={Math.round(plan.totalWeight)}
                max={plan.truckCapacity}
                size="sm"
              />

              <div className="max-h-[200px] space-y-1.5 overflow-y-auto pt-1">
                {plan.deliveries.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs"
                  >
                    <div className="mr-2 min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {d.customerName}
                      </p>
                      <p className="truncate text-gray-500">
                        {d.deliveryAddress}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded border border-gray-200 bg-white px-2 py-0.5 font-semibold text-gray-800 tabular-nums">
                      {d.weight.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{' '}
                      kg
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Unassigned Deliveries ({unassigned.length})
          </h3>
          <Card className="divide-y divide-gray-100">
            {unassigned.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-4 py-3 text-xs"
              >
                <div className="mr-3 flex min-w-0 flex-1 items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {d.customerName}
                    </p>
                    <p className="truncate text-gray-500">{d.reason}</p>
                  </div>
                </div>
                <span className="whitespace-nowrap rounded bg-gray-100 px-2 py-0.5 font-semibold text-gray-800 tabular-nums">
                  {d.weight.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{' '}
                  kg
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-200 pt-5">
        <Button
          variant="secondary"
          onClick={() => setResult(null)}
          disabled={applying}
        >
          <ArrowLeft className="h-4 w-4" />
          Change Date
        </Button>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => router.push('/loads')}
            disabled={applying}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            loading={applying}
            disabled={plans.length === 0}
          >
            <CheckCircle2 className="h-4 w-4" />
            Create {plans.length} Draft Plan{plans.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone || 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
