import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';

import { importCsv, PIPELINE_CODES } from '../index';
import type { PipelineConfig } from '../types';
import type { PrismaTransactionClient, CommitProfile } from '../../commit';
import type { ValidationProfile } from '../../validation';
import type { MappingProfile } from '../../mapping';
import type { PreviewProfile, ExistingRecord, RecordLookupFn } from '../../preview';
import { DELIVERY_ENTITY } from '../../mapping/profiles';

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

interface MockDb {
  deliveries: Array<{ id: string; data: Record<string, unknown> }>;
  importRows: Array<Record<string, unknown>>;
  importJobUpdates: Array<Record<string, unknown>>;
}

function createMockTx(db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] }): PrismaTransactionClient {
  let idCounter = 0;
  return {
    delivery: {
      create: async (args: { data: Record<string, unknown> }) => {
        const id = `del-${++idCounter}`;
        db.deliveries.push({ id, data: args.data });
        return { id };
      },
      update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const id = String(args.where.id);
        return { id };
      },
      findFirst: async () => null,
    },
    importJob: {
      update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        db.importJobUpdates.push({ where: args.where, data: args.data });
        return {};
      },
    },
    importRow: {
      create: async (args: { data: Record<string, unknown> }) => {
        db.importRows.push(args.data);
        return {};
      },
    },
  };
}

function createFailingTx(errorMsg: string): PrismaTransactionClient {
  return {
    delivery: {
      create: async () => { throw new Error(errorMsg); },
      update: async () => { throw new Error(errorMsg); },
      findFirst: async () => null,
    },
    importJob: { update: async () => ({}) },
    importRow: { create: async () => ({}) },
  };
}

function makeLookup(records: Record<string, ExistingRecord> = {}): RecordLookupFn {
  return (_entity, _key, matchValue) => records[String(matchValue)] ?? null;
}

// ─── Default Profiles ─────────────────────────────────────────────────────────

const validationProfile: ValidationProfile = {
  name: 'delivery-validation',
  fields: [
    { column: 'customer_name', required: true, rules: [] },
    { column: 'pickup_address', required: true, rules: [] },
    { column: 'delivery_address', required: true, rules: [] },
  ],
};

const mappingProfile: MappingProfile = {
  name: 'delivery-mapping',
  entity: DELIVERY_ENTITY,
};

function makePreviewProfile(existingRecords: Record<string, ExistingRecord> = {}): PreviewProfile {
  return {
    matchKey: 'customerName',
    lookupFn: makeLookup(existingRecords),
  };
}

const commitProfile: CommitProfile = {
  companyId: 'company-1',
  importJobId: 'job-1',
  uploadedBy: 'user-1',
  matchKey: 'customerName',
  source: 'CSV',
};

function makeConfig(
  csv: string,
  overrides: Partial<PipelineConfig> = {},
): PipelineConfig {
  const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
  return {
    csvContent: csv,
    filename: 'test.csv',
    validationProfile,
    mappingProfile,
    previewProfile: makePreviewProfile(),
    commitProfile,
    tx: createMockTx(db),
    ...overrides,
  };
}

// ─── CSV Fixtures ─────────────────────────────────────────────────────────────

const VALID_CSV = `customer_name,pickup_address,delivery_address,weight
Acme Corp,123 Main St,456 Oak Ave,150.5
Beta Inc,789 Pine Rd,321 Elm St,200`;

const SINGLE_ROW_CSV = `customer_name,pickup_address,delivery_address
TestCustomer,TestPickup,TestDelivery`;

const EMPTY_CSV = '';

const HEADER_ONLY_CSV = `customer_name,pickup_address,delivery_address`;

const MALFORMED_CSV_MISSING_REQUIRED = `customer_name,pickup_address,delivery_address
,Missing Pickup,Missing Delivery`;

const DUPLICATE_ROWS_CSV = `customer_name,pickup_address,delivery_address
Acme Corp,123 Main,456 Oak
Acme Corp,789 Pine,321 Elm`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Import Pipeline', () => {

  // ── Successful Full Pipeline ──────────────────────────────────────────────

  describe('Successful Import', () => {
    test('completes the full pipeline for valid CSV', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      assert.equal(result.success, true);
      assert.equal(result.completedStage, 'commit');
      assert.equal(result.failedStage, null);
      assert.equal(result.failureReason, null);
      assert.equal(result.wasRolledBack, false);
      assert.equal(result.document.processingState, 'committed');
      assert.ok(result.totalDurationMs > 0);
    });

    test('produces timing for all stages', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      assert.equal(result.timings.length, 6);
      const stages = result.timings.map(t => t.stage);
      assert.deepEqual(stages, ['parse', 'adapt', 'validate', 'map', 'preview', 'commit']);
      for (const t of result.timings) {
        assert.ok(typeof t.durationMs === 'number');
      }
    });

    test('includes preview summary', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      assert.ok(result.previewSummary);
      assert.equal(result.previewSummary!.rowsToCreate, 2);
    });

    test('includes commit results', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      assert.ok(result.commitResults);
      assert.equal(result.commitResults!.length, 2);
      for (const cr of result.commitResults!) {
        assert.equal(cr.status, 'committed');
        assert.equal(cr.action, 'create');
      }
    });

    test('propagates all statistics', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      assert.ok(result.document.statistics.adapter);
      assert.ok(result.document.statistics.validation);
      assert.ok(result.document.statistics.mapping);
      assert.ok(result.document.statistics.preview);
      assert.ok(result.document.statistics.commit);
    });
  });

  // ── Empty / Fatal Parse Failures ──────────────────────────────────────────

  describe('Parse Failures', () => {
    test('halts on empty CSV', async () => {
      const config = makeConfig(EMPTY_CSV);
      const result = await importCsv(config);

      assert.equal(result.success, false);
      assert.equal(result.failedStage, 'parse');
      assert.ok(result.failureReason);
    });

    test('halts on header-only CSV', async () => {
      const config = makeConfig(HEADER_ONLY_CSV);
      const result = await importCsv(config);

      assert.equal(result.success, false);
      assert.equal(result.failedStage, 'parse');
    });
  });

  // ── Validation Failures ───────────────────────────────────────────────────

  describe('Validation Halt', () => {
    test('halts pipeline when validation produces errors', async () => {
      // Use a stricter validation profile that requires a field with type checking
      const strictProfile: ValidationProfile = {
        name: 'strict',
        fields: [
          { column: 'customer_name', required: true, rules: [] },
          { column: 'pickup_address', required: true, rules: [] },
          { column: 'delivery_address', required: true, rules: [] },
          { column: 'weight', required: false, rules: [{ ruleName: 'integer' }] },
        ],
      };

      const config = makeConfig(VALID_CSV, { validationProfile: strictProfile });
      const result = await importCsv(config);

      // weight "150.5" and "200" — "150.5" will fail integer validation
      assert.equal(result.success, false);
      assert.equal(result.failedStage, 'validate');
      assert.ok(result.failureReason?.includes('validation error'));
      assert.equal(result.document.processingState, 'validated');
    });
  });

  // ── Commit Rollback ───────────────────────────────────────────────────────

  describe('Commit Rollback', () => {
    test('rolls back and reports failure when commit throws', async () => {
      const failTx = createFailingTx('Unique constraint violation');
      const config = makeConfig(SINGLE_ROW_CSV, { tx: failTx });
      const result = await importCsv(config);

      assert.equal(result.success, false);
      assert.equal(result.failedStage, 'commit');
      assert.equal(result.wasRolledBack, true);
      assert.ok(result.failureReason);
      // Preview summary should still be present
      assert.ok(result.previewSummary);
    });
  });

  // ── Update Flow ───────────────────────────────────────────────────────────

  describe('Update Flow', () => {
    test('classifies rows as update when existing records match', async () => {
      const previewProfile = makePreviewProfile({
        'Acme Corp': { id: 'rec-1', values: { customerName: 'Acme Corp', pickupAddress: 'Old Address', deliveryAddress: 'Old Delivery' } },
      });

      const db: MockDb = {
        deliveries: [{ id: 'rec-1', data: {} }],
        importRows: [],
        importJobUpdates: [],
      };

      const config = makeConfig(VALID_CSV, {
        previewProfile,
        tx: createMockTx(db),
      });

      const result = await importCsv(config);

      assert.equal(result.success, true);
      assert.ok(result.previewSummary);
      // Acme should be update, Beta should be create
      assert.equal(result.previewSummary!.rowsToUpdate, 1);
      assert.equal(result.previewSummary!.rowsToCreate, 1);
    });
  });

  // ── Duplicate Detection ───────────────────────────────────────────────────

  describe('Duplicate Detection', () => {
    test('detects duplicate rows in the CSV', async () => {
      const config = makeConfig(DUPLICATE_ROWS_CSV);
      const result = await importCsv(config);

      assert.equal(result.success, true);
      assert.ok(result.previewSummary);
      assert.equal(result.previewSummary!.duplicateKeyCount, 2);
    });
  });

  // ── Diagnostics ───────────────────────────────────────────────────────────

  describe('Diagnostics', () => {
    test('produces pipeline diagnostics', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      const pipDiags = result.diagnostics.filter(d => d.code.startsWith('PIP_'));
      assert.ok(pipDiags.length > 0);

      const started = pipDiags.find(d => d.code === PIPELINE_CODES.STARTED);
      assert.ok(started);

      const complete = pipDiags.find(d => d.code === PIPELINE_CODES.COMPLETE);
      assert.ok(complete);
    });

    test('includes stage completion diagnostics', async () => {
      const config = makeConfig(VALID_CSV);
      const result = await importCsv(config);

      const stageCompletions = result.diagnostics.filter(
        d => d.code === PIPELINE_CODES.STAGE_COMPLETE,
      );
      // parse, adapt, validate, map, preview = 5 stage completions
      assert.ok(stageCompletions.length >= 5);
    });
  });

  // ── Single Row ────────────────────────────────────────────────────────────

  describe('Single Row', () => {
    test('processes a single-row CSV through the full pipeline', async () => {
      const config = makeConfig(SINGLE_ROW_CSV);
      const result = await importCsv(config);

      assert.equal(result.success, true);
      assert.equal(result.document.processingState, 'committed');
      assert.equal(result.commitResults?.length, 1);
      assert.equal(result.commitResults?.[0].action, 'create');
    });
  });

  // ── Missing Required Fields (through validation) ──────────────────────────

  describe('Missing Required Fields', () => {
    test('validation halts on missing required values', async () => {
      const config = makeConfig(MALFORMED_CSV_MISSING_REQUIRED);
      const result = await importCsv(config);

      assert.equal(result.success, false);
      assert.equal(result.failedStage, 'validate');
    });
  });
});
