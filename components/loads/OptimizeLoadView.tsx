'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Sparkles,
  Package,
  Truck,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';

// ─── Types (mirrors API response) ────────────────────────────────────────────

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

// ─── Utilization color helper ────────────────────────────────────────────────

function getUtilColor(pct: number) {
  if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-600' };
  if (pct > 85) return { bar: 'bg-rose-500', text: 'text-rose-600' };
  if (pct >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OptimizeLoadView() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);

  // ── Generate optimization preview ──

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

  // ── Apply: create DRAFT plans via existing APIs ──

  async function handleApply() {
    if (!result || applying) return;
    setApplying(true);

    try {
      let created = 0;

      for (const plan of result.plans) {
        // Step 1: Create DRAFT load plan
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
          toast.error(`Failed to create plan for ${plan.truckName}: ${errData?.error || 'Unknown error'}`);
          continue;
        }

        const newPlan = await createRes.json();

        // Step 2: Assign deliveries to the plan
        const assignRes = await fetch(`/api/loads/${newPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: plan.deliveries.map(d => d.id),
          }),
        });

        if (!assignRes.ok) {
          const errData = await assignRes.json().catch(() => null);
          toast.error(`Failed to assign deliveries to ${plan.truckName}: ${errData?.error || 'Unknown error'}`);
          continue;
        }

        created++;
      }

      if (created === result.plans.length) {
        toast.success(`Created ${created} optimized load plan${created !== 1 ? 's' : ''}`);
      } else if (created > 0) {
        toast.warning(`Created ${created} of ${result.plans.length} plans. Check the load plans page for details.`);
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

  // ── Render: Configuration (no results yet) ──

  if (!result) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
              <Sparkles className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Configure Optimization</h3>
              <p className="text-sm text-gray-500">
                Select a target date. The optimizer will distribute eligible deliveries across available trucks by weight.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Target Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <p className="text-xs text-gray-400">
              Includes deliveries scheduled for this date or with no scheduled date. Excludes trucks already assigned on this date.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.push('/loads')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Plans
            </Button>
            <Button onClick={handleGenerate} loading={loading} disabled={!date}>
              <Sparkles className="h-4 w-4 mr-1" />
              Generate Plans
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Render: Results ──

  const { plans, unassigned, stats } = result;

  return (
    <div className="space-y-6">
      {/* ── Stats Summary ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
          <StatCell label="Total Deliveries" value={stats.totalDeliveries} />
          <StatCell label="Assigned" value={stats.assignedCount} color="text-emerald-600" />
          <StatCell label="Unassigned" value={stats.unassignedCount} color={stats.unassignedCount > 0 ? 'text-amber-600' : undefined} />
          <StatCell label="Plans" value={stats.plansCreated} />
          <StatCell label="Trucks Used" value={`${stats.trucksUsed} / ${stats.trucksAvailable}`} />
          <StatCell label="Avg Utilization" value={`${stats.avgUtilization}%`} color={getUtilColor(stats.avgUtilization).text} />
        </div>
      </div>

      {/* ── Proposed Plans ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Proposed Plans ({plans.length})
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plans.map((plan, idx) => {
            const style = getUtilColor(plan.utilizationPct);
            return (
              <Card key={`${plan.truckId}-${idx}`} className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      <Truck className="h-4.5 w-4.5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{plan.truckName}</p>
                      <p className="text-xs text-gray-500">{plan.truckPlateNumber}</p>
                    </div>
                  </div>
                  <span className={cn('text-lg font-bold', style.text)}>
                    {plan.utilizationPct}%
                  </span>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {plan.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {plan.truckCapacity.toLocaleString()} kg
                    </span>
                    <span>{plan.deliveries.length} {plan.deliveries.length === 1 ? 'delivery' : 'deliveries'}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500 ease-out', style.bar)}
                      style={{ width: `${Math.min(plan.utilizationPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Delivery List */}
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {plan.deliveries.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-medium text-gray-900 truncate">{d.customerName}</p>
                        <p className="text-xs text-gray-500 truncate">{d.deliveryAddress}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap bg-white px-2 py-0.5 rounded border border-gray-200">
                        {d.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Unassigned Deliveries ──────────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600">
            Unassigned Deliveries ({unassigned.length})
          </h3>
          <Card className="divide-y divide-gray-100">
            {unassigned.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.customerName}</p>
                    <p className="text-xs text-gray-500 truncate">{d.reason}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-700 whitespace-nowrap bg-gray-100 px-2 py-1 rounded">
                  {d.weight.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <Button
          variant="ghost"
          onClick={() => setResult(null)}
          disabled={applying}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Change Date
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/loads')}
            disabled={applying}
          >
            Discard
          </Button>
          <Button
            onClick={handleApply}
            loading={applying}
            disabled={plans.length === 0}
            size="lg"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Create {plans.length} Draft Plan{plans.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Cell helper ────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', color || 'text-gray-900')}>
        {value}
      </p>
    </div>
  );
}
