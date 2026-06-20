// ─── Load Optimizer Service ──────────────────────────────────────────────────
// First-Fit Decreasing (FFD) bin-packing algorithm for distributing deliveries
// across available trucks by weight. This is a read-only computation — it does
// not write to the database.
//
// FFD guarantees:
//   - Uses at most ⌈11/9 × OPT + 6/9⌉ bins (within ~22% of optimal)
//   - Deterministic: same inputs always produce same outputs
//   - O(n log n + n × m) where n = deliveries, m = trucks

import { toNumber, getItemSummary } from '@/lib/delivery-items'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OptimizeInput {
  deliveries: {
    id: string
    customerName: string
    deliveryAddress: string
    weight: unknown // Prisma Decimal — resolved via toNumber()
    scheduledDate: Date | null
    items?: { productName: string }[]
  }[]
  trucks: {
    id: string
    name: string
    plateNumber: string
    weightCapacity: number
  }[]
}

export interface OptimizedDelivery {
  id: string
  customerName: string
  deliveryAddress: string
  weight: number
  scheduledDate: string | null
  itemSummary: string
}

export interface OptimizedPlan {
  truckId: string
  truckName: string
  truckPlateNumber: string
  truckCapacity: number
  totalWeight: number
  utilizationPct: number
  deliveries: OptimizedDelivery[]
}

export interface UnassignedDelivery {
  id: string
  customerName: string
  deliveryAddress: string
  weight: number
  reason: string
}

export interface OptimizeStats {
  totalDeliveries: number
  assignedCount: number
  unassignedCount: number
  plansCreated: number
  trucksUsed: number
  trucksAvailable: number
  avgUtilization: number
}

export interface OptimizeResult {
  plans: OptimizedPlan[]
  unassigned: UnassignedDelivery[]
  stats: OptimizeStats
}

// ─── FFD Algorithm ───────────────────────────────────────────────────────────

export function optimizeLoads(input: OptimizeInput): OptimizeResult {
  const { deliveries, trucks } = input

  // Resolve weights and sort deliveries by weight DESC (heaviest first)
  const resolvedDeliveries = deliveries.map(d => ({
    ...d,
    resolvedWeight: toNumber(d.weight),
  }))
  resolvedDeliveries.sort((a, b) => b.resolvedWeight - a.resolvedWeight)

  // Sort trucks by capacity DESC (largest first)
  const sortedTrucks = [...trucks].sort((a, b) => b.weightCapacity - a.weightCapacity)

  // Find max truck capacity (for oversized detection)
  const maxCapacity = sortedTrucks.length > 0 ? sortedTrucks[0].weightCapacity : 0

  // Initialize bins — one per truck
  const bins = sortedTrucks.map(truck => ({
    truck,
    items: [] as typeof resolvedDeliveries,
    remainingCapacity: truck.weightCapacity,
  }))

  const unassigned: UnassignedDelivery[] = []

  // First-Fit Decreasing: for each delivery, find the first bin where it fits
  for (const delivery of resolvedDeliveries) {
    // Skip zero-weight edge case — still assignable but flag if truly zero
    if (delivery.resolvedWeight > maxCapacity) {
      unassigned.push({
        id: delivery.id,
        customerName: delivery.customerName,
        deliveryAddress: delivery.deliveryAddress,
        weight: delivery.resolvedWeight,
        reason: `Exceeds capacity of all available trucks (max: ${maxCapacity.toLocaleString()} kg)`,
      })
      continue
    }

    let placed = false
    for (const bin of bins) {
      if (delivery.resolvedWeight <= bin.remainingCapacity) {
        bin.items.push(delivery)
        bin.remainingCapacity -= delivery.resolvedWeight
        placed = true
        break
      }
    }

    if (!placed) {
      unassigned.push({
        id: delivery.id,
        customerName: delivery.customerName,
        deliveryAddress: delivery.deliveryAddress,
        weight: delivery.resolvedWeight,
        reason: 'No remaining truck capacity',
      })
    }
  }

  // Build result plans from non-empty bins
  const plans: OptimizedPlan[] = bins
    .filter(bin => bin.items.length > 0)
    .map(bin => {
      const totalWeight = bin.truck.weightCapacity - bin.remainingCapacity
      return {
        truckId: bin.truck.id,
        truckName: bin.truck.name,
        truckPlateNumber: bin.truck.plateNumber,
        truckCapacity: bin.truck.weightCapacity,
        totalWeight,
        utilizationPct: bin.truck.weightCapacity > 0
          ? Math.round((totalWeight / bin.truck.weightCapacity) * 100)
          : 0,
        deliveries: bin.items.map(d => ({
          id: d.id,
          customerName: d.customerName,
          deliveryAddress: d.deliveryAddress,
          weight: d.resolvedWeight,
          scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toISOString() : null,
          itemSummary: getItemSummary(d.items || []),
        })),
      }
    })

  // Compute stats
  const assignedCount = plans.reduce((sum, p) => sum + p.deliveries.length, 0)
  const avgUtilization = plans.length > 0
    ? Math.round(plans.reduce((sum, p) => sum + p.utilizationPct, 0) / plans.length)
    : 0

  const stats: OptimizeStats = {
    totalDeliveries: deliveries.length,
    assignedCount,
    unassignedCount: unassigned.length,
    plansCreated: plans.length,
    trucksUsed: plans.length,
    trucksAvailable: trucks.length,
    avgUtilization,
  }

  return { plans, unassigned, stats }
}
