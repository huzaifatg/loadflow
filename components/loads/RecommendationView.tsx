'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Truck,
  User,
  Package,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { cn } from '@/lib/utils';

interface FactorScore {
  factor: string;
  score: number;
  weight: number;
  weighted: number;
  explanation: string;
}

interface TruckRecommendation {
  truckId: string;
  truckName: string;
  truckPlateNumber: string;
  truckCapacity: number;
  committedWeight: number;
  remainingCapacity: number;
  totalScore: number;
  factors: FactorScore[];
}

interface DriverRecommendation {
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  driverLicense: string | null;
  totalScore: number;
  factors: FactorScore[];
}

interface RecommendationResponse {
  date: string;
  totalWeight: number;
  recommendation: {
    truck: TruckRecommendation | null;
    driver: DriverRecommendation | null;
    utilizationPct: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    confidenceScore: number;
    explanations: string[];
    allTrucks: TruckRecommendation[];
    allDrivers: DriverRecommendation[];
  };
  stats: {
    deliveryCount: number;
    totalWeight: number;
    truckCandidates: number;
    driverCandidates: number;
    eligibleTrucks: number;
    eligibleDrivers: number;
  };
  deliveries: {
    id: string;
    customerName: string;
    deliveryAddress: string;
    weight: number;
    scheduledDate: string | null;
  }[];
}

const confidenceConfig = {
  HIGH: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    label: 'High Confidence Fit',
  },
  MEDIUM: {
    color: 'text-amber-700',
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    icon: Info,
    label: 'Moderate Confidence Fit',
  },
  LOW: {
    color: 'text-orange-700',
    bg: 'bg-orange-50/70',
    border: 'border-orange-200',
    icon: AlertTriangle,
    label: 'Low Confidence Fit',
  },
  NONE: {
    color: 'text-rose-700',
    bg: 'bg-rose-50/70',
    border: 'border-rose-200',
    icon: AlertTriangle,
    label: 'No Feasible Fit',
  },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-rose-600';
}

function getScoreBarColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
}

function getFactorLabel(factor: string) {
  const labels: Record<string, string> = {
    capacityFit: 'Payload Capacity Fit',
    remainingCapacity: 'Remaining Capacity Headroom',
    truckAvailability: 'Vehicle Availability',
    truckWorkload: 'Recent Vehicle Workload',
    driverAvailability: 'Driver Availability',
    driverWorkload: 'Recent Driver Workload',
  };
  return labels[factor] || factor;
}

function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-gray-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={getScoreColor(score)}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-sm font-bold tabular-nums', getScoreColor(score))}>
          {score}
        </span>
      </div>
    </div>
  );
}

function FactorBreakdown({ factors }: { factors: FactorScore[] }) {
  return (
    <div className="space-y-2.5">
      {factors.map((f) => {
        const pct = Math.round(f.score * 100);
        return (
          <div key={f.factor}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700">
                {getFactorLabel(f.factor)}
              </span>
              <span className={cn('font-semibold tabular-nums', getScoreColor(pct))}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  getScoreBarColor(pct)
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">{f.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}

function TruckCandidateCard({
  truck,
  rank,
  isBest,
  isSelected,
  totalDemandWeight,
  onSelect,
}: {
  truck: TruckRecommendation;
  rank: number;
  isBest: boolean;
  isSelected: boolean;
  totalDemandWeight: number;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(isBest);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        isSelected
          ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500/15 shadow-xs'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      <div className="flex items-start gap-3.5">
        <ScoreRing score={truck.totalScore} size={54} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isBest ? (
                <Badge tone="success" size="sm">
                  <Zap className="h-3 w-3" /> Top Match
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Rank #{rank}
                </Badge>
              )}
              {isSelected && (
                <Badge tone="primary" size="sm">
                  Selected
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant={isSelected ? 'primary' : 'secondary'}
              size="xs"
              onClick={onSelect}
            >
              {isSelected ? 'Selected' : 'Use Truck'}
            </Button>
          </div>

          <h4 className="mt-1.5 text-sm font-bold text-gray-900">
            {truck.truckName}
          </h4>
          <p className="font-mono text-xs text-gray-500">
            {truck.truckPlateNumber} • {truck.truckCapacity.toLocaleString()} kg max
          </p>

          <div className="mt-2.5">
            <CapacityBar
              current={Math.round(truck.committedWeight + totalDemandWeight)}
              max={truck.truckCapacity}
              size="sm"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 cursor-pointer"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expanded ? 'Hide factor breakdown' : 'View factor breakdown'}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <FactorBreakdown factors={truck.factors} />
        </div>
      )}
    </div>
  );
}

function DriverCandidateCard({
  driver,
  rank,
  isBest,
  isSelected,
  onSelect,
}: {
  driver: DriverRecommendation;
  rank: number;
  isBest: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(isBest);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        isSelected
          ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500/15 shadow-xs'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      <div className="flex items-start gap-3.5">
        <ScoreRing score={driver.totalScore} size={54} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isBest ? (
                <Badge tone="success" size="sm">
                  <Zap className="h-3 w-3" /> Top Match
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Rank #{rank}
                </Badge>
              )}
              {isSelected && (
                <Badge tone="primary" size="sm">
                  Selected
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant={isSelected ? 'primary' : 'secondary'}
              size="xs"
              onClick={onSelect}
            >
              {isSelected ? 'Selected' : 'Use Driver'}
            </Button>
          </div>

          <h4 className="mt-1.5 text-sm font-bold text-gray-900">
            {driver.driverName}
          </h4>
          <p className="text-xs text-gray-500">
            {driver.driverLicense ? `CDL: ${driver.driverLicense}` : 'No license #'}
            {driver.driverPhone ? ` • ${driver.driverPhone}` : ''}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 cursor-pointer"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expanded ? 'Hide factor breakdown' : 'View factor breakdown'}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <FactorBreakdown factors={driver.factors} />
        </div>
      )}
    </div>
  );
}

export function RecommendationView() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignedPlanId, setAssignedPlanId] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setAssignedPlanId(null);

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate recommendation.');
        toast.error(data.error || 'Failed to generate recommendation.');
        return;
      }

      setResult(data);
      setSelectedTruckId(data.recommendation?.truck?.truckId || null);
      setSelectedDriverId(data.recommendation?.driver?.driverId || null);
      toast.success('Fleet recommendation generated');
    } catch {
      setError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!result || !selectedTruckId) return;
    setAssigning(true);

    try {
      const res = await fetch('/api/recommendations/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: selectedTruckId,
          driverId: selectedDriverId || null,
          deliveryIds: result.deliveries.map((d) => d.id),
          date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create load plan.');
        return;
      }

      setAssignedPlanId(data.loadPlan.id);
      toast.success('Draft Load Plan created from recommendation');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setAssigning(false);
    }
  }

  const rec = result?.recommendation;
  const conf = rec ? confidenceConfig[rec.confidence] : null;
  const chosenTruck =
    rec?.allTrucks.find((t) => t.truckId === selectedTruckId) || rec?.truck;
  const chosenDriver =
    rec?.allDrivers.find((d) => d.driverId === selectedDriverId) || rec?.driver;
  const canAssign =
    Boolean(rec && chosenTruck && result.deliveries.length > 0 && !assignedPlanId);

  return (
    <div className="space-y-6">
      {/* Target Date Configuration Card */}
      <Card padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-sm flex-1">
            <Input
              id="rec-date"
              type="date"
              label="Target Dispatch Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              hint="Evaluates PENDING deliveries scheduled on this date (plus unscheduled orders)."
            />
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleGenerate}
            loading={loading}
            disabled={!date}
          >
            <Sparkles className="h-4 w-4" />
            Analyze Fleet & Score Candidates
          </Button>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {result && rec && conf && (
        <>
          {/* Summary KPI Bar */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Eligible Deliveries</span>
                <Package className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">
                {result.stats.deliveryCount}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Pending orders</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Aggregate Payload</span>
                <BarChart3 className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">
                {result.totalWeight.toLocaleString()} kg
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Total demand weight</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Projected Utilization</span>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">
                {rec.utilizationPct}%
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Top vehicle fit</p>
            </Card>

            <Card className={cn('p-4', conf.bg, conf.border)}>
              <div className={cn('flex items-center justify-between text-xs font-medium', conf.color)}>
                <span>Confidence Score</span>
                <conf.icon className="h-4 w-4" />
              </div>
              <p className={cn('mt-2 text-2xl font-bold tabular-nums', conf.color)}>
                {rec.confidenceScore} / 100
              </p>
              <p className={cn('mt-0.5 text-xs font-semibold', conf.color)}>
                {conf.label}
              </p>
            </Card>
          </div>

          {/* Reasoning & One-Click Assignment Banner */}
          <Card className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Scoring Analysis & Recommendation Rationale
                  </h3>
                  <ul className="mt-1.5 space-y-1">
                    {rec.explanations.map((exp, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-600"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-500" />
                        <span>{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {chosenTruck && (
                <div className="shrink-0">
                  {assignedPlanId ? (
                    <ButtonLink
                      href={`/loads/${assignedPlanId}`}
                      variant="success"
                      size="md"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Open Created Load Plan
                      <ArrowRight className="h-4 w-4" />
                    </ButtonLink>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={handleAssign}
                        loading={assigning}
                        disabled={!canAssign}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Create Draft Plan ({chosenTruck.truckName}
                        {chosenDriver ? ` + ${chosenDriver.driverName}` : ''})
                      </Button>
                      <span className="text-[11px] text-gray-500">
                        Allocates {result.deliveries.length}{' '}
                        {result.deliveries.length === 1
                          ? 'delivery'
                          : 'deliveries'}{' '}
                        onto a new DRAFT load plan
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Ranked Truck & Driver Candidates */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Truck className="h-4 w-4 text-primary-600" />
                  Ranked Truck Candidates ({rec.allTrucks.length})
                </h3>
                <span className="text-xs text-gray-500">
                  Click &ldquo;Use Truck&rdquo; to override selection
                </span>
              </div>
              {rec.allTrucks.length > 0 ? (
                <div className="space-y-3">
                  {rec.allTrucks.map((truck, i) => (
                    <TruckCandidateCard
                      key={truck.truckId}
                      truck={truck}
                      rank={i + 1}
                      isBest={i === 0 && truck.totalScore > 0}
                      isSelected={selectedTruckId === truck.truckId}
                      totalDemandWeight={result.totalWeight}
                      onSelect={() => setSelectedTruckId(truck.truckId)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-xs text-gray-500">
                  No eligible trucks found for this date.
                </Card>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <User className="h-4 w-4 text-primary-600" />
                  Ranked Driver Candidates ({rec.allDrivers.length})
                </h3>
                <span className="text-xs text-gray-500">
                  Click &ldquo;Use Driver&rdquo; to override selection
                </span>
              </div>
              {rec.allDrivers.length > 0 ? (
                <div className="space-y-3">
                  {rec.allDrivers.map((driver, i) => (
                    <DriverCandidateCard
                      key={driver.driverId}
                      driver={driver}
                      rank={i + 1}
                      isBest={i === 0 && driver.totalScore > 0}
                      isSelected={selectedDriverId === driver.driverId}
                      onSelect={() => setSelectedDriverId(driver.driverId)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-xs text-gray-500">
                  No eligible drivers found for this date.
                </Card>
              )}
            </div>
          </div>

          {/* Deliveries Evaluated Table */}
          <Card>
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h3 className="text-sm font-bold text-gray-900">
                Deliveries Evaluated ({result.deliveries.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Destination</th>
                    <th className="px-4 py-2.5 text-right">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {result.deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">
                        <Link
                          href={`/deliveries/${d.id}`}
                          className="hover:text-primary-600"
                        >
                          {d.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {d.deliveryAddress}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                        {Number(d.weight).toLocaleString()} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
