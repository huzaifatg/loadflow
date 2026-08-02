// ─── Recommendation Engine ──────────────────────────────────────────────────
// Rule-based scoring engine that recommends the best truck and driver for a
// set of deliveries. Deterministic, configurable, and designed for future
// replacement with ML/AI models without rewriting the application.
//
// Architecture:
//   1. Scorer: computes individual factor scores (0–1) for each candidate
//   2. Aggregator: combines factor scores using configurable weights
//   3. Explainer: produces human-readable justification for each recommendation
//
// The engine is pure computation — no database access, no side effects.
// Data fetching is the caller's responsibility.

import { toNumber } from '@/lib/delivery-items';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ScoringWeights {
  /** How important is capacity fit (0–1). Higher = prefer tighter fit. */
  capacityFit: number;
  /** How important is remaining capacity after loading (0–1). */
  remainingCapacity: number;
  /** How important is truck availability status (0–1). */
  truckAvailability: number;
  /** How important is low existing truck workload (0–1). */
  truckWorkload: number;
  /** How important is driver availability status (0–1). */
  driverAvailability: number;
  /** How important is low existing driver workload (0–1). */
  driverWorkload: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  capacityFit: 0.30,
  remainingCapacity: 0.15,
  truckAvailability: 0.15,
  truckWorkload: 0.10,
  driverAvailability: 0.20,
  driverWorkload: 0.10,
};

// ─── Input Types ────────────────────────────────────────────────────────────

export interface RecommendationDelivery {
  id: string;
  customerName: string;
  deliveryAddress: string;
  weight: unknown; // Prisma Decimal
  scheduledDate: Date | string | null;
}

export interface RecommendationTruck {
  id: string;
  name: string;
  plateNumber: string;
  weightCapacity: number;
  status: string;
  /** Number of active load plans assigned to this truck on the target date. */
  activePlanCount: number;
  /** Total weight already committed on those plans. */
  committedWeight: number;
}

export interface RecommendationDriver {
  id: string;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  /** Number of active load plans assigned to this driver on the target date. */
  activePlanCount: number;
}

export interface RecommendationInput {
  deliveries: RecommendationDelivery[];
  trucks: RecommendationTruck[];
  drivers: RecommendationDriver[];
  weights?: Partial<ScoringWeights>;
}

// ─── Output Types ───────────────────────────────────────────────────────────

export interface FactorScore {
  factor: string;
  score: number;     // 0–1
  weight: number;    // from config
  weighted: number;  // score × weight
  explanation: string;
}

export interface TruckRecommendation {
  truckId: string;
  truckName: string;
  truckPlateNumber: string;
  truckCapacity: number;
  committedWeight: number;
  remainingCapacity: number;
  totalScore: number;  // 0–100
  factors: FactorScore[];
}

export interface DriverRecommendation {
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  driverLicense: string | null;
  totalScore: number; // 0–100
  factors: FactorScore[];
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface Recommendation {
  /** Best truck recommendation */
  truck: TruckRecommendation | null;
  /** Best driver recommendation */
  driver: DriverRecommendation | null;
  /** Overall utilization (delivery weight / truck capacity) */
  utilizationPct: number;
  /** Overall confidence in the recommendation */
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0–100
  /** Human-readable explanation paragraphs */
  explanations: string[];
  /** All scored trucks ranked best-to-worst */
  allTrucks: TruckRecommendation[];
  /** All scored drivers ranked best-to-worst */
  allDrivers: DriverRecommendation[];
}

export interface RecommendationResult {
  /** Total weight of the delivery batch */
  totalWeight: number;
  /** The recommendation */
  recommendation: Recommendation;
  /** Input statistics */
  stats: {
    deliveryCount: number;
    totalWeight: number;
    truckCandidates: number;
    driverCandidates: number;
    eligibleTrucks: number;
    eligibleDrivers: number;
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────────────

/**
 * Score a truck's capacity fit for the delivery batch.
 * Prefers trucks whose capacity is close to but greater than the total weight.
 * Uses a bell-curve peaking at ~80% utilization.
 */
function scoreCapacityFit(truckCapacity: number, totalWeight: number): number {
  if (truckCapacity <= 0 || totalWeight <= 0) return 0;
  if (totalWeight > truckCapacity) return 0; // Cannot fit

  const utilization = totalWeight / truckCapacity;
  // Bell curve peaking at 0.80 utilization
  // score = 1 - ((utilization - 0.80) / 0.40)^2
  const deviation = (utilization - 0.80) / 0.40;
  const score = Math.max(0, 1 - deviation * deviation);
  return Math.round(score * 100) / 100;
}

/**
 * Score remaining capacity after loading.
 * Prefers trucks that still have usable remaining capacity.
 */
function scoreRemainingCapacity(truckCapacity: number, committedWeight: number, totalWeight: number): number {
  if (truckCapacity <= 0) return 0;
  const afterLoading = truckCapacity - committedWeight - totalWeight;
  if (afterLoading < 0) return 0; // Won't fit
  const remainingPct = afterLoading / truckCapacity;
  // Prefer moderate remaining (not too full, not wasted)
  if (remainingPct > 0.5) return 0.6; // Lots of wasted space
  if (remainingPct > 0.2) return 1.0; // Sweet spot
  if (remainingPct > 0.05) return 0.8; // Tight but fine
  return 0.5; // Nearly full
}

/**
 * Score truck availability status.
 */
function scoreTruckAvailability(status: string): number {
  switch (status) {
    case 'AVAILABLE': return 1.0;
    case 'IN_USE': return 0.3;
    case 'MAINTENANCE': return 0.0;
    default: return 0.0;
  }
}

/**
 * Score truck workload — fewer active plans = higher score.
 */
function scoreTruckWorkload(activePlanCount: number): number {
  if (activePlanCount === 0) return 1.0;
  if (activePlanCount === 1) return 0.6;
  if (activePlanCount === 2) return 0.3;
  return 0.1;
}

/**
 * Score driver availability status.
 */
function scoreDriverAvailability(status: string): number {
  switch (status) {
    case 'AVAILABLE': return 1.0;
    case 'ON_TRIP': return 0.2;
    case 'OFF_DUTY': return 0.0;
    default: return 0.0;
  }
}

/**
 * Score driver workload — fewer active plans = higher score.
 */
function scoreDriverWorkload(activePlanCount: number): number {
  if (activePlanCount === 0) return 1.0;
  if (activePlanCount === 1) return 0.5;
  if (activePlanCount === 2) return 0.2;
  return 0.0;
}

// ─── Explanation Generator ──────────────────────────────────────────────────

function generateExplanations(
  truck: TruckRecommendation | null,
  driver: DriverRecommendation | null,
  totalWeight: number,
  confidence: ConfidenceLevel,
): string[] {
  const lines: string[] = [];

  if (!truck) {
    lines.push('No suitable truck found for this delivery batch.');
    return lines;
  }

  const utilPct = truck.truckCapacity > 0
    ? Math.round((totalWeight / (truck.truckCapacity - truck.committedWeight)) * 100)
    : 0;

  lines.push(
    `${truck.truckName} (${truck.truckPlateNumber}) recommended with a score of ${truck.totalScore}/100.`
  );

  // Capacity explanation
  const remaining = truck.truckCapacity - truck.committedWeight;
  if (remaining > 0) {
    lines.push(
      `Capacity utilization: ${Math.min(utilPct, 100)}% — ${totalWeight.toLocaleString()} kg of ${remaining.toLocaleString()} kg available.`
    );
  }

  // Workload
  if (truck.committedWeight === 0) {
    lines.push('No existing load plans — truck is fully available.');
  } else {
    lines.push(
      `${truck.committedWeight.toLocaleString()} kg already committed on this date.`
    );
  }

  // Driver
  if (driver) {
    lines.push(
      `Driver: ${driver.driverName} recommended (score: ${driver.totalScore}/100).`
    );
    if (driver.factors.find(f => f.factor === 'driverAvailability')?.score === 1.0) {
      lines.push('Driver is currently available with no scheduling conflicts.');
    }
  } else {
    lines.push('No suitable driver found — manual assignment recommended.');
  }

  // Confidence
  const confidenceLabels: Record<ConfidenceLevel, string> = {
    HIGH: 'High confidence recommendation.',
    MEDIUM: 'Medium confidence — review before assigning.',
    LOW: 'Low confidence — significant constraints detected.',
    NONE: 'Unable to generate a recommendation.',
  };
  lines.push(confidenceLabels[confidence]);

  return lines;
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export function generateRecommendation(input: RecommendationInput): RecommendationResult {
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...input.weights };

  // Resolve total weight
  const totalWeight = input.deliveries.reduce(
    (sum, d) => sum + toNumber(d.weight),
    0,
  );

  // Score all trucks
  const scoredTrucks: TruckRecommendation[] = input.trucks
    .filter(t => t.status !== 'MAINTENANCE') // Hard filter
    .map(truck => {
      const remainingCapacity = truck.weightCapacity - truck.committedWeight;
      const factors: FactorScore[] = [];

      // Capacity fit
      const canFitPhysically = totalWeight <= remainingCapacity;
      const capFit = scoreCapacityFit(remainingCapacity, totalWeight);
      const capFitExplanation = !canFitPhysically
        ? `Cannot fit ${totalWeight.toLocaleString()} kg into ${remainingCapacity.toLocaleString()} kg remaining`
        : capFit > 0
          ? `Capacity fit: ${Math.round((totalWeight / remainingCapacity) * 100)}% utilization`
          : `Poor capacity fit — truck is oversized (${Math.round((totalWeight / remainingCapacity) * 100)}% utilization)`;
      factors.push({
        factor: 'capacityFit',
        score: capFit,
        weight: weights.capacityFit,
        weighted: capFit * weights.capacityFit,
        explanation: capFitExplanation,
      });

      // Remaining capacity
      const remCap = scoreRemainingCapacity(truck.weightCapacity, truck.committedWeight, totalWeight);
      factors.push({
        factor: 'remainingCapacity',
        score: remCap,
        weight: weights.remainingCapacity,
        weighted: remCap * weights.remainingCapacity,
        explanation: remCap > 0
          ? `${(remainingCapacity - totalWeight).toLocaleString()} kg remaining after loading`
          : 'Insufficient remaining capacity',
      });

      // Availability
      const avail = scoreTruckAvailability(truck.status);
      factors.push({
        factor: 'truckAvailability',
        score: avail,
        weight: weights.truckAvailability,
        weighted: avail * weights.truckAvailability,
        explanation: avail === 1.0 ? 'Truck is available' : `Truck status: ${truck.status}`,
      });

      // Workload
      const workload = scoreTruckWorkload(truck.activePlanCount);
      factors.push({
        factor: 'truckWorkload',
        score: workload,
        weight: weights.truckWorkload,
        weighted: workload * weights.truckWorkload,
        explanation: truck.activePlanCount === 0
          ? 'No existing assignments'
          : `${truck.activePlanCount} active plan(s) on this date`,
      });

      // Hard constraint: if delivery cannot physically fit, zero the score
      const rawScore = factors.reduce((sum, f) => sum + f.weighted, 0);
      const maxTruckWeight = weights.capacityFit + weights.remainingCapacity +
        weights.truckAvailability + weights.truckWorkload;
      const totalScore = canFitPhysically ? Math.round((rawScore / maxTruckWeight) * 100) : 0;

      return {
        truckId: truck.id,
        truckName: truck.name,
        truckPlateNumber: truck.plateNumber,
        truckCapacity: truck.weightCapacity,
        committedWeight: truck.committedWeight,
        remainingCapacity,
        totalScore,
        factors,
      };
    })
    // Stable sort: primary by score descending, secondary by remaining capacity descending
    .sort((a, b) => b.totalScore - a.totalScore || b.remainingCapacity - a.remainingCapacity);

  // Score all drivers
  const scoredDrivers: DriverRecommendation[] = input.drivers
    .filter(d => d.status !== 'OFF_DUTY') // Hard filter
    .map(driver => {
      const factors: FactorScore[] = [];

      const avail = scoreDriverAvailability(driver.status);
      factors.push({
        factor: 'driverAvailability',
        score: avail,
        weight: weights.driverAvailability,
        weighted: avail * weights.driverAvailability,
        explanation: avail === 1.0 ? 'Driver is available' : `Driver status: ${driver.status}`,
      });

      const workload = scoreDriverWorkload(driver.activePlanCount);
      factors.push({
        factor: 'driverWorkload',
        score: workload,
        weight: weights.driverWorkload,
        weighted: workload * weights.driverWorkload,
        explanation: driver.activePlanCount === 0
          ? 'No existing assignments'
          : `${driver.activePlanCount} active plan(s) on this date`,
      });

      const rawScore = factors.reduce((sum, f) => sum + f.weighted, 0);
      const maxDriverWeight = weights.driverAvailability + weights.driverWorkload;
      const totalScore = Math.round((rawScore / maxDriverWeight) * 100);

      return {
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        driverLicense: driver.licenseNumber,
        totalScore,
        factors,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  // Pick best
  const bestTruck = scoredTrucks.length > 0 && scoredTrucks[0].totalScore > 0
    ? scoredTrucks[0]
    : null;
  const bestDriver = scoredDrivers.length > 0 && scoredDrivers[0].totalScore > 0
    ? scoredDrivers[0]
    : null;

  // Compute confidence
  const truckScore = bestTruck?.totalScore ?? 0;
  const driverScore = bestDriver?.totalScore ?? 0;
  const confidenceScore = bestTruck
    ? Math.round((truckScore * 0.6 + driverScore * 0.4))
    : 0;

  let confidence: ConfidenceLevel;
  if (confidenceScore >= 75) confidence = 'HIGH';
  else if (confidenceScore >= 50) confidence = 'MEDIUM';
  else if (confidenceScore > 0) confidence = 'LOW';
  else confidence = 'NONE';

  // Utilization
  const utilizationPct = bestTruck && bestTruck.remainingCapacity > 0
    ? Math.round((totalWeight / bestTruck.remainingCapacity) * 100)
    : 0;

  const explanations = generateExplanations(bestTruck, bestDriver, totalWeight, confidence);

  return {
    totalWeight,
    recommendation: {
      truck: bestTruck,
      driver: bestDriver,
      utilizationPct: Math.min(utilizationPct, 100),
      confidence,
      confidenceScore,
      explanations,
      allTrucks: scoredTrucks,
      allDrivers: scoredDrivers,
    },
    stats: {
      deliveryCount: input.deliveries.length,
      totalWeight,
      truckCandidates: input.trucks.length,
      driverCandidates: input.drivers.length,
      eligibleTrucks: scoredTrucks.length,
      eligibleDrivers: scoredDrivers.length,
    },
  };
}
