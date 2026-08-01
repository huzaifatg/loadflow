// ─── Recommendation Engine Tests ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRecommendation,
  DEFAULT_WEIGHTS,
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
