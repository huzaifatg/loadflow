import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  commitDocument,
  buildDeliveryData,
  COMMIT_CODES,
} from '../index';
import type {
  PrismaTransactionClient,
  CommitProfile,
} from '../types';
import type {
  ImportDocument,
  ImportRow,
  RowMappingState,
  RowPreviewState,
  FieldDiff,
} from '../../contract/types';
import { CONTRACT_VERSION } from '../../contract/constants';

// ─── Mock Prisma Transaction Client ───────────────────────────────────────────

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
        const existing = db.deliveries.find(d => d.id === id);
        if (existing) {
          Object.assign(existing.data, args.data);
        }
        return { id };
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        const found = db.deliveries.find(d => d.data.externalId === args.where.externalId);
        return found ? { id: found.id } : null;
      },
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

/** Failing mock that throws on create. */
function createFailingTx(errorMsg: string): PrismaTransactionClient {
  return {
    delivery: {
      create: async () => { throw new Error(errorMsg); },
      update: async () => { throw new Error(errorMsg); },
      findFirst: async () => null,
    },
    importJob: {
      update: async () => ({}),
    },
    importRow: {
      create: async () => ({}),
    },
  };
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: CommitProfile = {
  companyId: 'company-1',
  importJobId: 'job-1',
  uploadedBy: 'user-1',
  matchKey: 'customerName',
  source: 'CSV',
};

function makePreviewedDoc(
  rows: Array<{
    values: Record<string, string>;
    previewAction: RowPreviewState['action'];
    matchedRecordId?: string | null;
    fieldDiffs?: FieldDiff[];
    mappingStatus?: RowMappingState['status'];
  }>,
): ImportDocument {
  const importRows: ImportRow[] = rows.map((r, idx) => ({
    rowId: `row-${idx}`,
    sourceRowNumber: idx + 2,
    originalValues: { ...r.values },
    normalizedValues: { ...r.values },
    isMalformed: false,
    rowDiagnostics: [],
    validationState: {
      status: 'valid' as const,
      fieldResults: {},
      isCritical: false,
    },
    mappingState: {
      status: (r.mappingStatus ?? 'mapped') as RowMappingState['status'],
      mappedEntity: 'delivery',
      mappedValues: { ...r.values },
      unmappedFields: [],
    },
    previewState: {
      action: r.previewAction,
      matchedRecordId: r.matchedRecordId ?? null,
      fieldDiffs: r.fieldDiffs ?? [],
      userDecision: r.previewAction === 'no_change' ? null : 'pending',
    },
  }));

  return {
    documentId: 'test-doc',
    version: CONTRACT_VERSION,
    source: { sourceType: 'test', sourceIdentifier: 'test.csv', sourceMetadata: {} },
    adapter: { adapterName: 'test-adapter', adapterVersion: '1.0' },
    tenant: 'test-tenant',
    headers: [
      { original: 'customerName', normalized: 'customerName', index: 0, wasBlank: false, wasDuplicate: false },
      { original: 'pickupAddress', normalized: 'pickupAddress', index: 1, wasBlank: false, wasDuplicate: false },
      { original: 'deliveryAddress', normalized: 'deliveryAddress', index: 2, wasBlank: false, wasDuplicate: false },
    ],
    rows: importRows,
    diagnostics: [],
    statistics: {
      adapter: { totalRows: importRows.length, malformedRows: 0, blankRowsSkipped: 0, parseTimeMs: 1 },
      validation: { validRows: importRows.length, invalidRows: 0, skippedRows: 0, warningCount: 0, errorCount: 0, validationTimeMs: 1 },
      mapping: { mappedRows: importRows.length, unmappedRows: 0, mappingTimeMs: 1 },
      preview: { creates: 0, updates: 0, deletes: 0, noChange: 0 },
    },
    timestamps: {
      createdAt: new Date().toISOString(),
      validatedAt: new Date().toISOString(),
      mappedAt: new Date().toISOString(),
      previewedAt: new Date().toISOString(),
    },
    processingState: 'previewed',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Commit Engine', () => {

  // ── buildDeliveryData ─────────────────────────────────────────────────────

  describe('buildDeliveryData', () => {
    test('builds correct data from mapped values', () => {
      const data = buildDeliveryData(
        { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B', weight: '10.5' },
        DEFAULT_PROFILE,
      );

      assert.equal(data.companyId, 'company-1');
      assert.equal(data.source, 'CSV');
      assert.equal(data.importJobId, 'job-1');
      assert.equal(data.customerName, 'Acme');
      assert.equal(data.pickupAddress, 'A');
      assert.equal(data.deliveryAddress, 'B');
      assert.equal(data.weight, 10.5); // Converted from string
    });

    test('excludes null/undefined fields', () => {
      const data = buildDeliveryData(
        { customerName: 'Acme' },
        DEFAULT_PROFILE,
      );

      assert.ok(!('pickupAddress' in data));
      assert.ok(!('weight' in data));
    });

    test('converts scheduledDate string to Date', () => {
      const data = buildDeliveryData(
        { customerName: 'A', scheduledDate: '2026-01-15' },
        DEFAULT_PROFILE,
      );

      assert.ok(data.scheduledDate instanceof Date);
    });
  });

  // ── Successful Create Commit ──────────────────────────────────────────────

  describe('Create Commit', () => {
    test('commits create rows to the database', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
        { values: { customerName: 'Beta', pickupAddress: 'C', deliveryAddress: 'D' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, true);
      assert.equal(result.rollbackReason, null);
      assert.equal(result.document.processingState, 'committed');
      assert.equal(result.results.length, 2);
      assert.equal(result.results[0].action, 'create');
      assert.equal(result.results[0].status, 'committed');
      assert.ok(result.results[0].recordId);
      assert.equal(db.deliveries.length, 2);
      assert.equal(db.importRows.length, 2);
    });

    test('creates ImportRow records with IMPORTED status', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
      ]);

      await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(db.importRows.length, 1);
      assert.equal(db.importRows[0].status, 'IMPORTED');
      assert.equal(db.importRows[0].importJobId, 'job-1');
    });
  });

  // ── Successful Update Commit ──────────────────────────────────────────────

  describe('Update Commit', () => {
    test('commits update rows to the database', async () => {
      const db: MockDb = {
        deliveries: [{ id: 'existing-1', data: { customerName: 'Acme', pickupAddress: 'Old' } }],
        importRows: [],
        importJobUpdates: [],
      };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        {
          values: { customerName: 'Acme', pickupAddress: 'New' },
          previewAction: 'update',
          matchedRecordId: 'existing-1',
          fieldDiffs: [{ field: 'pickupAddress', oldValue: 'Old', newValue: 'New' }],
        },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, true);
      assert.equal(result.results[0].action, 'update');
      assert.equal(result.results[0].status, 'committed');
      assert.equal(result.results[0].recordId, 'existing-1');
    });
  });

  // ── Skip Commit ───────────────────────────────────────────────────────────

  describe('Skip Commit', () => {
    test('skips rows with skip preview action', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A' }, previewAction: 'skip' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, true);
      assert.equal(result.results[0].action, 'skip');
      assert.equal(result.results[0].status, 'skipped');
      assert.equal(db.deliveries.length, 0);
      assert.equal(db.importRows.length, 1);
      assert.equal(db.importRows[0].status, 'SKIPPED');
    });

    test('skips rows with no_change preview action', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A' }, previewAction: 'no_change', matchedRecordId: 'rec-1' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, true);
      assert.equal(result.results[0].action, 'skip');
      assert.equal(result.results[0].status, 'skipped');
      assert.equal(result.results[0].recordId, 'rec-1');
    });
  });

  // ── Transaction Rollback ──────────────────────────────────────────────────

  describe('Transaction Rollback', () => {
    test('rolls back on database error', async () => {
      const tx = createFailingTx('Connection refused');

      const doc = makePreviewedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, false);
      assert.ok(result.rollbackReason);
      assert.ok(result.rollbackReason!.includes('Connection refused'));
      // Document should remain in 'previewed' state
      assert.equal(result.document.processingState, 'previewed');
    });

    test('rollback preserves original document state', async () => {
      const tx = createFailingTx('Constraint violation');

      const doc = makePreviewedDoc([
        { values: { customerName: 'A' }, previewAction: 'create' },
        { values: { customerName: 'B' }, previewAction: 'create' },
      ]);

      const originalDiagCount = doc.diagnostics.length;
      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, false);
      // Rollback diagnostics should be added
      assert.ok(result.document.diagnostics.length > originalDiagCount);
      const rollbackDiag = result.document.diagnostics.find(
        d => d.code === COMMIT_CODES.TRANSACTION_ROLLBACK,
      );
      assert.ok(rollbackDiag);
      assert.equal(rollbackDiag!.severity, 'fatal');
    });
  });

  // ── ImportJob Updates ─────────────────────────────────────────────────────

  describe('ImportJob Updates', () => {
    test('updates ImportJob to COMPLETED on success', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
      ]);

      await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(db.importJobUpdates.length, 1);
      assert.equal(db.importJobUpdates[0].data.status, 'COMPLETED');
      assert.ok(db.importJobUpdates[0].data.summary);
      assert.ok(db.importJobUpdates[0].data.completedAt);
    });

    test('includes accurate summary in ImportJob update', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A', pickupAddress: 'X', deliveryAddress: 'Y' }, previewAction: 'create' },
        { values: { customerName: 'B' }, previewAction: 'skip' },
      ]);

      await commitDocument(doc, DEFAULT_PROFILE, tx);

      const summary = db.importJobUpdates[0].data.summary as Record<string, unknown>;
      assert.equal(summary.inserted, 1);
      assert.equal(summary.skipped, 1);
      assert.equal(summary.totalRows, 2);
    });
  });

  // ── Statistics ─────────────────────────────────────────────────────────────

  describe('Statistics', () => {
    test('produces accurate commit statistics', async () => {
      const db: MockDb = {
        deliveries: [{ id: 'e1', data: {} }],
        importRows: [],
        importJobUpdates: [],
      };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'New', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
        { values: { customerName: 'Upd', pickupAddress: 'C' }, previewAction: 'update', matchedRecordId: 'e1' },
        { values: { customerName: 'Skip' }, previewAction: 'skip' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.document.statistics.commit?.inserted, 1);
      assert.equal(result.document.statistics.commit?.updated, 1);
      assert.equal(result.document.statistics.commit?.failed, 0);
      assert.ok(typeof result.document.statistics.commit?.commitTimeMs === 'number');
    });
  });

  // ── Diagnostics ────────────────────────────────────────────────────────────

  describe('Diagnostics', () => {
    test('all diagnostics have stage "commit"', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A', pickupAddress: 'X', deliveryAddress: 'Y' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      const commitDiags = result.document.diagnostics.filter(d => d.stage === 'commit');
      assert.ok(commitDiags.length > 0);
      for (const d of commitDiags) {
        assert.equal(d.stage, 'commit');
        assert.ok(d.timestamp);
        assert.ok(d.code.startsWith('CMT_'));
      }
    });

    test('includes COMMIT_COMPLETE diagnostic on success', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A', pickupAddress: 'X', deliveryAddress: 'Y' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      const completeDiag = result.document.diagnostics.find(
        d => d.code === COMMIT_CODES.COMMIT_COMPLETE,
      );
      assert.ok(completeDiag);
    });

    test('includes COMMIT_FAILED diagnostic on rollback', async () => {
      const tx = createFailingTx('DB error');

      const doc = makePreviewedDoc([
        { values: { customerName: 'A' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      const failedDiag = result.document.diagnostics.find(
        d => d.code === COMMIT_CODES.COMMIT_FAILED,
      );
      assert.ok(failedDiag);
      assert.equal(failedDiag!.severity, 'fatal');
    });
  });

  // ── State Guards ──────────────────────────────────────────────────────────

  describe('State Guards', () => {
    test('rejects document not in previewed state', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);
      const doc = makePreviewedDoc([]);
      (doc as any).processingState = 'mapped';

      await assert.rejects(
        () => commitDocument(doc, DEFAULT_PROFILE, tx),
        /is in state "mapped" but expected "previewed"/,
      );
    });

    test('transitions document to committed state on success', async () => {
      const db: MockDb = { deliveries: [], importRows: [], importJobUpdates: [] };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'A', pickupAddress: 'X', deliveryAddress: 'Y' }, previewAction: 'create' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.document.processingState, 'committed');
      assert.ok(result.document.timestamps.committedAt);
    });
  });

  // ── Mixed Scenario ────────────────────────────────────────────────────────

  describe('Mixed Scenario (Integration)', () => {
    test('handles creates, updates, and skips in a single commit', async () => {
      const db: MockDb = {
        deliveries: [{ id: 'existing-1', data: { customerName: 'ExistCo', pickupAddress: 'Old' } }],
        importRows: [],
        importJobUpdates: [],
      };
      const tx = createMockTx(db);

      const doc = makePreviewedDoc([
        { values: { customerName: 'NewCo', pickupAddress: 'A', deliveryAddress: 'B' }, previewAction: 'create' },
        {
          values: { customerName: 'ExistCo', pickupAddress: 'Updated' },
          previewAction: 'update',
          matchedRecordId: 'existing-1',
          fieldDiffs: [{ field: 'pickupAddress', oldValue: 'Old', newValue: 'Updated' }],
        },
        { values: { customerName: 'SkipCo' }, previewAction: 'skip' },
        { values: { customerName: 'SameCo' }, previewAction: 'no_change', matchedRecordId: 'existing-2' },
      ]);

      const result = await commitDocument(doc, DEFAULT_PROFILE, tx);

      assert.equal(result.success, true);
      assert.equal(result.document.processingState, 'committed');

      // Verify results
      assert.equal(result.results.length, 4);
      assert.equal(result.results[0].action, 'create');
      assert.equal(result.results[0].status, 'committed');
      assert.equal(result.results[1].action, 'update');
      assert.equal(result.results[1].status, 'committed');
      assert.equal(result.results[2].action, 'skip');
      assert.equal(result.results[2].status, 'skipped');
      assert.equal(result.results[3].action, 'skip');
      assert.equal(result.results[3].status, 'skipped');

      // Verify database state
      assert.equal(db.deliveries.length, 2); // 1 existing + 1 created
      assert.equal(db.importRows.length, 4);

      // Verify statistics
      assert.equal(result.document.statistics.commit?.inserted, 1);
      assert.equal(result.document.statistics.commit?.updated, 1);
      assert.equal(result.document.statistics.commit?.failed, 0);

      // Verify ImportJob updated
      assert.equal(db.importJobUpdates.length, 1);
      const summary = db.importJobUpdates[0].data.summary as Record<string, unknown>;
      assert.equal(summary.inserted, 1);
      assert.equal(summary.updated, 1);
      assert.equal(summary.skipped, 2);
    });
  });
});
