'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
  ArrowLeft,
  BarChart3,
  Shield,
  Zap,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types (mirror API response) ────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const confidenceConfig = {
  HIGH: { color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-500/20', icon: CheckCircle2, label: 'High Confidence' },
  MEDIUM: { color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500/20', icon: Info, label: 'Medium Confidence' },
  LOW: { color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-500/20', icon: AlertTriangle, label: 'Low Confidence' },
  NONE: { color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-500/20', icon: AlertTriangle, label: 'No Recommendation' },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBarColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getFactorLabel(factor: string) {
  const labels: Record<string, string> = {
    capacityFit: 'Capacity Fit',
    remainingCapacity: 'Remaining Capacity',
    truckAvailability: 'Availability',
    truckWorkload: 'Workload',
    driverAvailability: 'Availability',
    driverWorkload: 'Workload',
  };
  return labels[factor] || factor;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
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
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-lg font-bold', getScoreColor(score))}>{score}</span>
      </div>
    </div>
  );
}

function FactorBreakdown({ factors }: { factors: FactorScore[] }) {
  return (
    <div className="space-y-2.5">
      {factors.map((f) => (
        <div key={f.factor}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-gray-600">{getFactorLabel(f.factor)}</span>
            <span className={cn('font-semibold', getScoreColor(Math.round(f.score * 100)))}>
              {Math.round(f.score * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', getScoreBarColor(Math.round(f.score * 100)))}
              style={{ width: `${Math.round(f.score * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{f.explanation}</p>
        </div>
      ))}
    </div>
  );
}

function TruckCard({
  truck,
  rank,
  isBest,
}: {
  truck: TruckRecommendation;
  rank: number;
  isBest: boolean;
}) {
  const [expanded, setExpanded] = useState(isBest);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        isBest
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white shadow-sm ring-1 ring-emerald-500/10'
          : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={truck.totalScore} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isBest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <Zap className="h-3 w-3" /> Best Match
              </span>
            )}
            {!isBest && (
              <span className="text-xs text-gray-400 font-medium">#{rank}</span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900 mt-0.5">{truck.truckName}</h4>
          <p className="text-xs text-gray-500">{truck.truckPlateNumber}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span>Capacity: {truck.truckCapacity.toLocaleString()} kg</span>
            <span>Available: {truck.remainingCapacity.toLocaleString()} kg</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-3 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Hide details' : 'Show scoring details'}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <FactorBreakdown factors={truck.factors} />
        </div>
      )}
    </div>
  );
}

function DriverCard({
  driver,
  rank,
  isBest,
}: {
  driver: DriverRecommendation;
  rank: number;
  isBest: boolean;
}) {
  const [expanded, setExpanded] = useState(isBest);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        isBest
          ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white shadow-sm ring-1 ring-indigo-500/10'
          : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={driver.totalScore} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isBest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                <Zap className="h-3 w-3" /> Best Match
              </span>
            )}
            {!isBest && (
              <span className="text-xs text-gray-400 font-medium">#{rank}</span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900 mt-0.5">{driver.driverName}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {driver.driverLicense && <span>License: {driver.driverLicense}</span>}
            {driver.driverPhone && <span>{driver.driverPhone}</span>}
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-3 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Hide details' : 'Show scoring details'}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <FactorBreakdown factors={driver.factors} />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RecommendationView() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
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
      toast.success('Recommendation generated successfully.');
    } catch {
      setError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!result || !result.recommendation.truck) return;
    setAssigning(true);

    try {
      const res = await fetch('/api/recommendations/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truckId: result.recommendation.truck.truckId,
          driverId: result.recommendation.driver?.driverId || null,
          deliveryIds: result.deliveries.map(d => d.id),
          date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create load plan.');
        return;
      }

      setAssignedPlanId(data.loadPlan.id);
      toast.success('Load Plan created successfully!');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setAssigning(false);
    }
  }

  const rec = result?.recommendation;
  const conf = rec ? confidenceConfig[rec.confidence] : null;
  const canAssign = rec && rec.truck && rec.confidence !== 'NONE' && !assignedPlanId;

  return (
    <div className="space-y-6">
      {/* ── Input Section ── */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="rec-date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Target Date
            </label>
            <Input
              id="rec-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pending deliveries scheduled for this date (or unscheduled) will be evaluated.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || !date}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Recommendation
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* ── Error ── */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* ── Results ── */}
      {result && rec && conf && (
        <>
          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <Package className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{result.stats.deliveryCount}</p>
              <p className="text-xs text-gray-500">Deliveries</p>
            </Card>
            <Card className="p-4 text-center">
              <BarChart3 className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{result.totalWeight.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Weight (kg)</p>
            </Card>
            <Card className="p-4 text-center">
              <TrendingUp className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{rec.utilizationPct}%</p>
              <p className="text-xs text-gray-500">Utilization</p>
            </Card>
            <Card className={cn('p-4 text-center', conf.bg, 'border', conf.ring)}>
              <conf.icon className={cn('h-5 w-5 mx-auto mb-1', conf.color)} />
              <p className={cn('text-2xl font-bold', conf.color)}>{rec.confidenceScore}</p>
              <p className={cn('text-xs', conf.color)}>{conf.label}</p>
            </Card>
          </div>

          {/* Explanation */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Shield className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Recommendation Summary</h3>
                <ul className="space-y-1">
                  {rec.explanations.map((exp, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">•</span>
                      {exp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* ── Assignment Action ── */}
          {rec.truck && (
            <Card className={cn(
              'p-5 border-2 transition-all duration-200',
              assignedPlanId
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white',
            )}>
              {assignedPlanId ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">Load Plan Created</p>
                      <p className="text-sm text-emerald-600">
                        {rec.truck.truckName} assigned with {result.deliveries.length} deliver{result.deliveries.length !== 1 ? 'ies' : 'y'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/loads/${assignedPlanId}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    View Load Plan
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Accept Recommendation</p>
                      <p className="text-sm text-gray-500">
                        Create a Load Plan using {rec.truck.truckName}
                        {rec.driver ? ` with ${rec.driver.driverName}` : ''}
                        {' '}for {result.deliveries.length} deliver{result.deliveries.length !== 1 ? 'ies' : 'y'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAssign}
                    disabled={!canAssign || assigning}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {assigning ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Create Load Plan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Truck Recommendations */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
              <Truck className="h-5 w-5 text-gray-400" />
              Truck Recommendations
              <span className="text-xs text-gray-400 font-normal">
                ({rec.allTrucks.length} candidate{rec.allTrucks.length !== 1 ? 's' : ''})
              </span>
            </h3>
            {rec.allTrucks.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {rec.allTrucks.map((truck, i) => (
                  <TruckCard
                    key={truck.truckId}
                    truck={truck}
                    rank={i + 1}
                    isBest={i === 0 && truck.totalScore > 0}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <AlertTriangle className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No eligible trucks found.</p>
              </Card>
            )}
          </div>

          {/* Driver Recommendations */}
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
              <User className="h-5 w-5 text-gray-400" />
              Driver Recommendations
              <span className="text-xs text-gray-400 font-normal">
                ({rec.allDrivers.length} candidate{rec.allDrivers.length !== 1 ? 's' : ''})
              </span>
            </h3>
            {rec.allDrivers.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {rec.allDrivers.map((driver, i) => (
                  <DriverCard
                    key={driver.driverId}
                    driver={driver}
                    rank={i + 1}
                    isBest={i === 0 && driver.totalScore > 0}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <AlertTriangle className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No eligible drivers found.</p>
              </Card>
            )}
          </div>

          {/* Deliveries Evaluated */}
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Deliveries Evaluated ({result.deliveries.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Address</th>
                    <th className="pb-2 pr-4 text-right">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{d.customerName}</td>
                      <td className="py-2 pr-4 text-gray-500 truncate max-w-[200px]">{d.deliveryAddress}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">{Number(d.weight).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <Link
              href="/loads"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Load Plans
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
