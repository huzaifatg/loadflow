// ─── Recommendation Engine Tests ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRecommendation,
  type RecommendationInput,
  type RecommendationTruck,
  type RecommendationDriver,
  type RecommendationDelivery,
} from '../recommendation-engine';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeTruck(overrides: Partial<RecommendationTruck> = {}): RecommendationTruck {
  return {
    id: 'truck-1',
    name: 'Heavy Hauler',
    plateNumber: 'HH-001',
    weightCapacity: 10000,
    status: 'AVAILABLE',
    activePlanCount: 0,
    committedWeight: 0,
    ...overrides,
  };
}

function makeDriver(overrides: Partial<RecommendationDriver> = {}): RecommendationDriver {
  return {
    id: 'driver-1',
    name: 'John Smith',
    phone: '555-0001',
    licenseNumber: 'DL-001',
    status: 'AVAILABLE',
    activePlanCount: 0,
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<RecommendationDelivery> = {}): RecommendationDelivery {
  return {
    id: 'del-1',
    customerName: 'ACME Corp',
    deliveryAddress: '123 Main St',
    weight: 5000,
    scheduledDate: null,
    ...overrides,
  };
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Recommendation Engine', () => {
  describe('Basic Recommendations', () => {
    it('recommends the best truck for a delivery batch', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 8000 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);

      assert.ok(result.recommendation.truck, 'Should recommend a truck');
      assert.equal(result.recommendation.truck.truckId, 'truck-1');
      assert.ok(result.recommendation.truck.totalScore > 0, 'Score should be positive');
      assert.ok(result.recommendation.driver, 'Should recommend a driver');
      assert.equal(result.recommendation.driver.driverId, 'driver-1');
    });

    it('returns correct total weight from delivery batch', () => {
      const input: RecommendationInput = {
        deliveries: [
          makeDelivery({ id: 'del-1', weight: 3000 }),
          makeDelivery({ id: 'del-2', weight: 2000 }),
        ],
        trucks: [makeTruck()],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.totalWeight, 5000);
      assert.equal(result.stats.deliveryCount, 2);
    });

    it('returns explanations array', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 7500 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.ok(result.recommendation.explanations.length > 0, 'Should have explanations');
      assert.ok(
        result.recommendation.explanations.some(e => e.includes('Heavy Hauler')),
        'Should mention the truck name',
      );
    });
  });

  describe('Capacity Constraints', () => {
    it('does not recommend a truck that cannot fit the delivery', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 15000 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      // The truck should score 0 because capacity fit and remaining capacity both fail
      assert.equal(result.recommendation.truck?.totalScore ?? 0, 0);
    });

    it('prefers truck with better capacity fit', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 7500 })],
        trucks: [
          makeTruck({ id: 'small', name: 'Small', weightCapacity: 8000 }),  // 93% util
          makeTruck({ id: 'large', name: 'Large', weightCapacity: 25000 }), // 30% util
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.ok(result.recommendation.truck, 'Should recommend a truck');
      // Small truck should score higher (better capacity fit)
      assert.equal(result.recommendation.truck.truckId, 'small');
    });

    it('accounts for committed weight when scoring', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'free', name: 'Free', weightCapacity: 10000, committedWeight: 0 }),
          makeTruck({ id: 'loaded', name: 'Loaded', weightCapacity: 10000, committedWeight: 6000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      // Free truck has 10000 remaining, loaded has 4000 remaining (can't fit 5000)
      assert.equal(result.recommendation.truck?.truckId, 'free');
    });

    it('explains oversized truck as poor fit, not "cannot fit"', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [makeTruck({ weightCapacity: 3500 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor, 'Should have capacityFit factor');
      // Should NOT say "Cannot fit" — the delivery physically fits
      assert.ok(
        !capFactor.explanation.includes('Cannot fit'),
        `Explanation should not say "Cannot fit" when delivery fits. Got: "${capFactor.explanation}"`,
      );
      assert.ok(
        capFactor.explanation.includes('oversized'),
        `Explanation should mention oversized. Got: "${capFactor.explanation}"`,
      );
    });

    it('explains genuinely overloaded truck as "Cannot fit"', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 15000 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor, 'Should have capacityFit factor');
      assert.ok(
        capFactor.explanation.includes('Cannot fit'),
        `Explanation should say "Cannot fit" when delivery exceeds capacity. Got: "${capFactor.explanation}"`,
      );
    });
  });

  describe('Unavailable Trucks', () => {
    it('excludes trucks in MAINTENANCE status', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'maint', status: 'MAINTENANCE', weightCapacity: 20000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allTrucks.length, 0);
    });

    it('penalizes IN_USE trucks', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'avail', name: 'Available', status: 'AVAILABLE', weightCapacity: 10000 }),
          makeTruck({ id: 'in-use', name: 'InUse', status: 'IN_USE', weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const availScore = result.recommendation.allTrucks.find(t => t.truckId === 'avail')!.totalScore;
      const inUseScore = result.recommendation.allTrucks.find(t => t.truckId === 'in-use')!.totalScore;
      assert.ok(availScore > inUseScore, 'Available truck should score higher than IN_USE');
    });
  });

  describe('Unavailable Drivers', () => {
    it('excludes OFF_DUTY drivers', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [makeTruck()],
        drivers: [makeDriver({ status: 'OFF_DUTY' })],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allDrivers.length, 0);
      assert.equal(result.recommendation.driver, null);
    });

    it('penalizes ON_TRIP drivers', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [makeTruck()],
        drivers: [
          makeDriver({ id: 'avail', name: 'Available', status: 'AVAILABLE' }),
          makeDriver({ id: 'on-trip', name: 'OnTrip', status: 'ON_TRIP' }),
        ],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.driver?.driverId, 'avail');
    });
  });

  describe('Workload Scoring', () => {
    it('prefers trucks with fewer active plans', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'busy', name: 'Busy', activePlanCount: 3, weightCapacity: 10000 }),
          makeTruck({ id: 'free', name: 'Free', activePlanCount: 0, weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck?.truckId, 'free');
    });

    it('prefers drivers with fewer active plans', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [makeTruck()],
        drivers: [
          makeDriver({ id: 'busy', name: 'Busy', activePlanCount: 2 }),
          makeDriver({ id: 'free', name: 'Free', activePlanCount: 0 }),
        ],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.driver?.driverId, 'free');
    });
  });

  describe('Confidence Levels', () => {
    it('returns HIGH confidence for ideal match', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 8000 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.confidence, 'HIGH');
      assert.ok(result.recommendation.confidenceScore >= 75);
    });

    it('returns NONE when no trucks available', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.confidence, 'NONE');
      assert.equal(result.recommendation.confidenceScore, 0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty delivery list', () => {
      const input: RecommendationInput = {
        deliveries: [],
        trucks: [makeTruck()],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.totalWeight, 0);
      assert.equal(result.stats.deliveryCount, 0);
    });

    it('handles zero-weight deliveries', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 0 })],
        trucks: [makeTruck()],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.totalWeight, 0);
    });

    it('handles Prisma Decimal weight values', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: '3500.5000' as unknown })],
        trucks: [makeTruck()],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.totalWeight, 3500.5);
    });

    it('handles no trucks and no drivers', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [],
        drivers: [],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck, null);
      assert.equal(result.recommendation.driver, null);
      assert.equal(result.recommendation.confidence, 'NONE');
    });
  });

  describe('Custom Weights', () => {
    it('allows overriding scoring weights', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'avail', name: 'Available', status: 'AVAILABLE', weightCapacity: 10000 }),
          makeTruck({ id: 'in-use', name: 'InUse', status: 'IN_USE', weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
        weights: { truckAvailability: 0.90 }, // Heavily weight availability
      };

      const result = generateRecommendation(input);
      // With high availability weight, available truck should win decisively
      const availScore = result.recommendation.allTrucks.find(t => t.truckId === 'avail')!.totalScore;
      const inUseScore = result.recommendation.allTrucks.find(t => t.truckId === 'in-use')!.totalScore;
      assert.ok(availScore > inUseScore + 10, 'Availability should dominate scoring');
    });
  });

  describe('Ranking', () => {
    it('returns all trucks ranked best-to-worst', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 't1', name: 'T1', weightCapacity: 10000 }),
          makeTruck({ id: 't2', name: 'T2', weightCapacity: 8000 }),
          makeTruck({ id: 't3', name: 'T3', weightCapacity: 20000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allTrucks.length, 3);
      // Verify descending order
      for (let i = 1; i < result.recommendation.allTrucks.length; i++) {
        assert.ok(
          result.recommendation.allTrucks[i - 1].totalScore >= result.recommendation.allTrucks[i].totalScore,
          'Trucks should be sorted by score descending',
        );
      }
    });

    it('returns all drivers ranked best-to-worst', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [makeTruck()],
        drivers: [
          makeDriver({ id: 'd1', name: 'D1', activePlanCount: 0 }),
          makeDriver({ id: 'd2', name: 'D2', activePlanCount: 1 }),
          makeDriver({ id: 'd3', name: 'D3', activePlanCount: 3 }),
        ],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allDrivers.length, 3);
      for (let i = 1; i < result.recommendation.allDrivers.length; i++) {
        assert.ok(
          result.recommendation.allDrivers[i - 1].totalScore >= result.recommendation.allDrivers[i].totalScore,
          'Drivers should be sorted by score descending',
        );
      }
    });

    it('breaks ties deterministically by remaining capacity ascending (prefer smaller)', () => {
      // Two trucks with identical status, workload, and similar capacity
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'smaller', name: 'Smaller', weightCapacity: 10000 }),
          makeTruck({ id: 'larger', name: 'Larger', weightCapacity: 12000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const trucks = result.recommendation.allTrucks;
      assert.equal(trucks.length, 2);
      // If scores are equal, the truck with LESS remaining capacity (smaller) should come first
      if (trucks[0].totalScore === trucks[1].totalScore) {
        assert.ok(
          trucks[0].remainingCapacity <= trucks[1].remainingCapacity,
          'Tie should be broken by remaining capacity ascending (prefer smaller truck)',
        );
      }
    });
  });

  describe('Factor Details', () => {
    it('includes detailed factor scores for each truck', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 8000 })],
        trucks: [makeTruck({ weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const truck = result.recommendation.allTrucks[0];
      assert.equal(truck.factors.length, 4); // capacityFit, remainingCapacity, availability, workload
      for (const factor of truck.factors) {
        assert.ok(factor.score >= 0 && factor.score <= 1, `Factor ${factor.factor} score out of range`);
        assert.ok(factor.weight > 0, `Factor ${factor.factor} weight should be positive`);
        assert.ok(factor.explanation.length > 0, `Factor ${factor.factor} should have explanation`);
      }
    });

    it('includes detailed factor scores for each driver', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery()],
        trucks: [makeTruck()],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const driver = result.recommendation.allDrivers[0];
      assert.equal(driver.factors.length, 2); // availability, workload
    });
  });
});

// ─── Sprint 13.2: Vehicle-Fit Intelligence Tests ────────────────────────────

describe('Vehicle-Fit Intelligence (Sprint 13.2)', () => {
  // Reuse fixture factories from above
  function makeTruck(overrides: Partial<RecommendationTruck> = {}): RecommendationTruck {
    return {
      id: 'truck-1',
      name: 'Default Truck',
      plateNumber: 'DF-001',
      weightCapacity: 10000,
      status: 'AVAILABLE',
      activePlanCount: 0,
      committedWeight: 0,
      ...overrides,
    };
  }

  function makeDriver(overrides: Partial<RecommendationDriver> = {}): RecommendationDriver {
    return {
      id: 'driver-1',
      name: 'John Smith',
      phone: '555-0001',
      licenseNumber: 'DL-001',
      status: 'AVAILABLE',
      activePlanCount: 0,
      ...overrides,
    };
  }

  function makeDelivery(overrides: Partial<RecommendationDelivery> = {}): RecommendationDelivery {
    return {
      id: 'del-1',
      customerName: 'ACME Corp',
      deliveryAddress: '123 Main St',
      weight: 5000,
      scheduledDate: null,
      ...overrides,
    };
  }

  describe('CASE 1 — Very Small Delivery (95.7 kg)', () => {
    it('prefers 3,500 kg truck over 25,000 kg truck', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'sprinter', name: 'Sprinter Van', weightCapacity: 3500 }),
          makeTruck({ id: 'heavy', name: 'Heavy Hauler', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.ok(result.recommendation.truck, 'Should recommend a truck');
      assert.equal(result.recommendation.truck.truckId, 'sprinter',
        'Sprinter (3,500 kg) should be preferred over Heavy Hauler (25,000 kg) for 95.7 kg delivery');
    });

    it('ranks all truck sizes correctly for small delivery', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'sprinter', name: 'Sprinter', weightCapacity: 3500 }),
          makeTruck({ id: 'box', name: 'Box Truck', weightCapacity: 8000 }),
          makeTruck({ id: 'medium', name: 'Medium', weightCapacity: 15000 }),
          makeTruck({ id: 'heavy', name: 'Heavy', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const trucks = result.recommendation.allTrucks;
      assert.equal(trucks.length, 4);
      // Sprinter should rank first (smallest suitable)
      assert.equal(trucks[0].truckId, 'sprinter',
        'Sprinter should rank #1 for 95.7 kg delivery');
      // Scores should be strictly decreasing (smaller truck → higher score)
      for (let i = 0; i < trucks.length - 1; i++) {
        assert.ok(
          trucks[i].totalScore >= trucks[i + 1].totalScore,
          `Truck ${trucks[i].truckName} (score ${trucks[i].totalScore}) should score >= ${trucks[i + 1].truckName} (score ${trucks[i + 1].totalScore})`,
        );
      }
    });

    it('produces distinct scores for differently sized trucks', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'sprinter', name: 'Sprinter', weightCapacity: 3500 }),
          makeTruck({ id: 'heavy', name: 'Heavy', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const sprinterScore = result.recommendation.allTrucks.find(t => t.truckId === 'sprinter')!.totalScore;
      const heavyScore = result.recommendation.allTrucks.find(t => t.truckId === 'heavy')!.totalScore;
      assert.ok(
        sprinterScore > heavyScore,
        `Sprinter (score ${sprinterScore}) should score strictly higher than Heavy Hauler (score ${heavyScore})`,
      );
    });
  });

  describe('CASE 2 — Medium Delivery (2,000 kg)', () => {
    it('prefers appropriately sized truck over massively oversized', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 2000 })],
        trucks: [
          makeTruck({ id: 'sprinter', name: 'Sprinter', weightCapacity: 3500 }),
          makeTruck({ id: 'heavy', name: 'Heavy', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck?.truckId, 'sprinter',
        'Sprinter (3,500 kg) should be preferred for 2,000 kg delivery');
    });
  });

  describe('CASE 3 — Near Capacity (7,500 kg)', () => {
    it('prefers 8,000 kg truck over 15,000 kg and 25,000 kg trucks', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 7500 })],
        trucks: [
          makeTruck({ id: 'box', name: 'Box Truck', weightCapacity: 8000 }),
          makeTruck({ id: 'medium', name: 'Medium', weightCapacity: 15000 }),
          makeTruck({ id: 'heavy', name: 'Heavy', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck?.truckId, 'box',
        'Box Truck (8,000 kg) should be preferred for 7,500 kg delivery — near-perfect fit');
    });

    it('scores near-capacity fit higher than underutilized', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 7500 })],
        trucks: [
          makeTruck({ id: 'box', name: 'Box Truck', weightCapacity: 8000 }),    // 93.75% util
          makeTruck({ id: 'heavy', name: 'Heavy', weightCapacity: 25000 }),     // 30% util
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const boxScore = result.recommendation.allTrucks.find(t => t.truckId === 'box')!.totalScore;
      const heavyScore = result.recommendation.allTrucks.find(t => t.truckId === 'heavy')!.totalScore;
      assert.ok(boxScore > heavyScore,
        `Box Truck (score ${boxScore}) should score higher than Heavy Hauler (score ${heavyScore})`);
    });
  });

  describe('CASE 4 — Heavy Delivery (24,000 kg)', () => {
    it('only recommends trucks that can carry the load', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 24000 })],
        trucks: [
          makeTruck({ id: 'sprinter', name: 'Sprinter', weightCapacity: 3500 }),
          makeTruck({ id: 'box', name: 'Box Truck', weightCapacity: 8000 }),
          makeTruck({ id: 'heavy', name: 'Heavy Hauler', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.ok(result.recommendation.truck, 'Should recommend a truck');
      assert.equal(result.recommendation.truck.truckId, 'heavy',
        'Heavy Hauler is the only truck that can carry 24,000 kg');

      // Verify smaller trucks score 0
      const sprinterScore = result.recommendation.allTrucks.find(t => t.truckId === 'sprinter')!.totalScore;
      const boxScore = result.recommendation.allTrucks.find(t => t.truckId === 'box')!.totalScore;
      assert.equal(sprinterScore, 0, 'Sprinter should score 0 — cannot carry 24,000 kg');
      assert.equal(boxScore, 0, 'Box Truck should score 0 — cannot carry 24,000 kg');
    });
  });

  describe('CASE 5 — Physical Overflow', () => {
    it('scores 0 when delivery exceeds remaining capacity', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'tiny', name: 'Tiny Truck', weightCapacity: 100, committedWeight: 82.5 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const truck = result.recommendation.allTrucks[0];
      assert.equal(truck.totalScore, 0, 'Score must be 0 when delivery cannot fit');
    });

    it('explains overflow accurately', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'tiny', name: 'Tiny Truck', weightCapacity: 100, committedWeight: 82.5 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor, 'Should have capacityFit factor');
      assert.ok(
        capFactor.explanation.includes('Cannot fit'),
        `Should explain that delivery cannot fit. Got: "${capFactor.explanation}"`,
      );
    });

    it('does not recommend an overflowed truck', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'tiny', name: 'Tiny Truck', weightCapacity: 100, committedWeight: 82.5 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck, null,
        'Should not recommend a truck that cannot fit the delivery');
    });
  });

  describe('CASE 6 — Maintenance Trucks', () => {
    it('MAINTENANCE trucks are completely excluded from results', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 1000 })],
        trucks: [
          makeTruck({ id: 'maint', name: 'Maintenance', status: 'MAINTENANCE', weightCapacity: 10000 }),
          makeTruck({ id: 'avail', name: 'Available', status: 'AVAILABLE', weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allTrucks.length, 1, 'Only non-MAINTENANCE trucks in results');
      assert.equal(result.recommendation.allTrucks[0].truckId, 'avail');
    });
  });

  describe('CASE 7 — IN_USE Trucks', () => {
    it('IN_USE trucks receive availability penalty but are NOT excluded', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'in-use', name: 'In Use Truck', status: 'IN_USE', weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allTrucks.length, 1, 'IN_USE truck should appear in results');
      assert.ok(result.recommendation.allTrucks[0].totalScore > 0, 'IN_USE truck should have positive score');
    });

    it('AVAILABLE truck scores higher than equally-sized IN_USE truck', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'avail', name: 'Available', status: 'AVAILABLE', weightCapacity: 10000 }),
          makeTruck({ id: 'in-use', name: 'In Use', status: 'IN_USE', weightCapacity: 10000 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const availScore = result.recommendation.allTrucks.find(t => t.truckId === 'avail')!.totalScore;
      const inUseScore = result.recommendation.allTrucks.find(t => t.truckId === 'in-use')!.totalScore;
      assert.ok(availScore > inUseScore, `AVAILABLE (${availScore}) should outscore IN_USE (${inUseScore})`);
    });
  });

  describe('CASE 8 — Workload Influence', () => {
    it('fewer active plans produces higher score among similarly sized trucks', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 5000 })],
        trucks: [
          makeTruck({ id: 'busy', name: 'Busy', weightCapacity: 10000, activePlanCount: 3 }),
          makeTruck({ id: 'free', name: 'Free', weightCapacity: 10000, activePlanCount: 0 }),
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.truck?.truckId, 'free',
        'Truck with no plans should be preferred');
      const busyScore = result.recommendation.allTrucks.find(t => t.truckId === 'busy')!.totalScore;
      const freeScore = result.recommendation.allTrucks.find(t => t.truckId === 'free')!.totalScore;
      assert.ok(freeScore > busyScore, `Free (${freeScore}) should outscore Busy (${busyScore})`);
    });
  });

  describe('CASE 9 — Deterministic Ordering', () => {
    it('identical inputs always produce identical rankings', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [
          makeTruck({ id: 'a', name: 'Truck A', weightCapacity: 3500 }),
          makeTruck({ id: 'b', name: 'Truck B', weightCapacity: 8000 }),
          makeTruck({ id: 'c', name: 'Truck C', weightCapacity: 15000 }),
          makeTruck({ id: 'd', name: 'Truck D', weightCapacity: 25000 }),
        ],
        drivers: [makeDriver()],
      };

      const result1 = generateRecommendation(input);
      const result2 = generateRecommendation(input);

      const order1 = result1.recommendation.allTrucks.map(t => t.truckId);
      const order2 = result2.recommendation.allTrucks.map(t => t.truckId);
      assert.deepEqual(order1, order2, 'Rankings must be identical for identical inputs');

      const scores1 = result1.recommendation.allTrucks.map(t => t.totalScore);
      const scores2 = result2.recommendation.allTrucks.map(t => t.totalScore);
      assert.deepEqual(scores1, scores2, 'Scores must be identical for identical inputs');
    });

    it('order is stable regardless of input truck array order', () => {
      const trucks = [
        makeTruck({ id: 'a', name: 'A', weightCapacity: 3500 }),
        makeTruck({ id: 'b', name: 'B', weightCapacity: 8000 }),
        makeTruck({ id: 'c', name: 'C', weightCapacity: 15000 }),
      ];

      const input1: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [...trucks],
        drivers: [makeDriver()],
      };
      const input2: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [...trucks].reverse(),
        drivers: [makeDriver()],
      };

      const result1 = generateRecommendation(input1);
      const result2 = generateRecommendation(input2);

      const order1 = result1.recommendation.allTrucks.map(t => t.truckId);
      const order2 = result2.recommendation.allTrucks.map(t => t.truckId);
      assert.deepEqual(order1, order2, 'Output ranking should not depend on input order');
    });
  });

  describe('Scoring Model Properties', () => {
    it('capacity fit score is always positive for trucks that can fit the delivery', () => {
      const capacities = [3500, 8000, 15000, 25000, 50000];
      for (const cap of capacities) {
        const input: RecommendationInput = {
          deliveries: [makeDelivery({ weight: 95.7 })],
          trucks: [makeTruck({ id: `t-${cap}`, weightCapacity: cap })],
          drivers: [makeDriver()],
        };
        const result = generateRecommendation(input);
        const capFit = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
        assert.ok(capFit!.score > 0,
          `Capacity fit should be > 0 for ${cap} kg truck carrying 95.7 kg (got ${capFit!.score})`);
      }
    });

    it('capacity fit is monotonically increasing with utilization for underutilized trucks', () => {
      // For the same delivery weight, smaller trucks (higher utilization) should score higher
      const weights = [3500, 8000, 15000, 25000];
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 500 })],
        trucks: weights.map((w, i) => makeTruck({ id: `t-${i}`, name: `T${i}`, weightCapacity: w })),
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const scores = result.recommendation.allTrucks;
      // Already sorted by score descending — verify the smallest truck is first
      assert.equal(scores[0].truckCapacity, 3500,
        'Smallest truck should score highest for small delivery');
    });

    it('sweet spot region (40-100% util) always scores >= right-sizing region', () => {
      // 6000/8000 = 75% utilization (sweet spot) vs 6000/25000 = 24% (right-sizing)
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 6000 })],
        trucks: [
          makeTruck({ id: 'sweetspot', name: 'Sweet Spot', weightCapacity: 8000 }), // 75%
          makeTruck({ id: 'oversized', name: 'Oversized', weightCapacity: 25000 }), // 24%
        ],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const sweetSpotCap = result.recommendation.allTrucks
        .find(t => t.truckId === 'sweetspot')!.factors
        .find(f => f.factor === 'capacityFit')!.score;
      const oversizedCap = result.recommendation.allTrucks
        .find(t => t.truckId === 'oversized')!.factors
        .find(f => f.factor === 'capacityFit')!.score;
      assert.ok(sweetSpotCap > oversizedCap,
        `Sweet spot (${sweetSpotCap}) should score higher than right-sizing (${oversizedCap})`);
    });

    it('80% utilization scores highest in capacity fit', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 8000 })],
        trucks: [makeTruck({ id: 'ideal', name: 'Ideal', weightCapacity: 10000 })], // 80% util
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFit = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.equal(capFit!.score, 1.0, 'Capacity fit at exactly 80% utilization should be 1.0');
    });
  });

  describe('Explanation Accuracy', () => {
    it('labels undersized trucks as "oversized for this load"', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [makeTruck({ id: 't', weightCapacity: 3500 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor!.explanation.includes('oversized'),
        `Low-utilization explanation should mention oversized. Got: "${capFactor!.explanation}"`);
    });

    it('labels good utilization as "Capacity fit: X% utilization"', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 7500 })],
        trucks: [makeTruck({ id: 't', weightCapacity: 10000 })], // 75% util
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor!.explanation.startsWith('Capacity fit:'),
        `Good-fit explanation should start with "Capacity fit:". Got: "${capFactor!.explanation}"`);
    });

    it('labels overflow as "Cannot fit"', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 15000 })],
        trucks: [makeTruck({ id: 't', weightCapacity: 10000 })],
        drivers: [makeDriver()],
      };

      const result = generateRecommendation(input);
      const capFactor = result.recommendation.allTrucks[0].factors.find(f => f.factor === 'capacityFit');
      assert.ok(capFactor!.explanation.includes('Cannot fit'),
        `Overflow explanation should include "Cannot fit". Got: "${capFactor!.explanation}"`);
    });
  });

  describe('Driver Recommendations Unaffected', () => {
    it('driver scoring unchanged — available driver still scores 100', () => {
      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [makeTruck({ weightCapacity: 3500 })],
        drivers: [makeDriver({ status: 'AVAILABLE', activePlanCount: 0 })],
      };

      const result = generateRecommendation(input);
      assert.ok(result.recommendation.driver, 'Should recommend a driver');
      assert.equal(result.recommendation.driver.totalScore, 100,
        'Available driver with no plans should score 100');
    });

    it('driver ranking is independent of truck changes', () => {
      const drivers = [
        makeDriver({ id: 'd1', name: 'D1', activePlanCount: 0 }),
        makeDriver({ id: 'd2', name: 'D2', activePlanCount: 1 }),
        makeDriver({ id: 'd3', name: 'D3', status: 'ON_TRIP', activePlanCount: 0 }),
      ];

      const input: RecommendationInput = {
        deliveries: [makeDelivery({ weight: 95.7 })],
        trucks: [makeTruck({ weightCapacity: 3500 })],
        drivers,
      };

      const result = generateRecommendation(input);
      assert.equal(result.recommendation.allDrivers[0].driverId, 'd1',
        'D1 (available, 0 plans) should rank first');
    });
  });
});
