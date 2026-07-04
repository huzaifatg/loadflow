import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  previewDocument,
  computeFieldDiffs,
  buildRowSummary,
  buildDocumentSummary,
  PREVIEW_CODES,
} from '../index';
import type {
  PreviewProfile,
  ExistingRecord,
  RecordLookupFn,
} from '../types';
import type {
  ImportDocument,
  ImportRow,
  RowMappingState,
  RowValidationState,
  ImportDiagnostic,
} from '../../contract/types';
import { CONTRACT_VERSION } from '../../contract/constants';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Build a mapped ImportDocument for testing. */
function makeMappedDoc(
  rows: Array<{
    values: Record<string, string>;
    mappingStatus?: RowMappingState['status'];
    validationStatus?: RowValidationState['status'];
  }>,
): ImportDocument {
  const headers = rows.length > 0
    ? Object.keys(rows[0].values)
    : [];

  const importRows: ImportRow[] = rows.map((r, idx) => ({
    rowId: `row-${idx}`,
    sourceRowNumber: idx + 2,
    originalValues: { ...r.values },
    normalizedValues: { ...r.values },
    isMalformed: false,
    rowDiagnostics: [],
    validationState: {
      status: r.validationStatus ?? 'valid',
      fieldResults: {},
      isCritical: r.validationStatus === 'invalid',
    },
    mappingState: {
      status: r.mappingStatus ?? 'mapped',
      mappedEntity: 'delivery',
      mappedValues: { ...r.values },
      unmappedFields: [],
    },
  }));

  return {
    documentId: 'test-doc',
    version: CONTRACT_VERSION,
    source: {
      sourceType: 'test',
      sourceIdentifier: 'test.csv',
      sourceMetadata: {},
    },
    adapter: {
      adapterName: 'test-adapter',
      adapterVersion: '1.0',
    },
    tenant: 'test-tenant',
    headers: headers.map((h, i) => ({
      original: h,
      normalized: h,
      index: i,
      wasBlank: false,
      wasDuplicate: false,
    })),
    rows: importRows,
    diagnostics: [],
    statistics: {
      adapter: {
        totalRows: importRows.length,
        malformedRows: 0,
        blankRowsSkipped: 0,
        parseTimeMs: 1,
      },
      validation: {
        validRows: importRows.length,
        invalidRows: 0,
        skippedRows: 0,
        warningCount: 0,
        errorCount: 0,
        validationTimeMs: 1,
      },
      mapping: {
        mappedRows: importRows.length,
        unmappedRows: 0,
        mappingTimeMs: 1,
      },
    },
    timestamps: {
      createdAt: new Date().toISOString(),
      validatedAt: new Date().toISOString(),
      mappedAt: new Date().toISOString(),
    },
    processingState: 'mapped',
  };
}

/** Create a simple in-memory lookup function. */
function makeLookup(records: Record<string, ExistingRecord>): RecordLookupFn {
  return (_entity: string, _matchKey: string, matchValue: unknown): ExistingRecord | null => {
    return records[String(matchValue)] ?? null;
  };
}

/** Default preview profile using customerName as match key. */
function makeProfile(
  records: Record<string, ExistingRecord> = {},
  ignoredFields?: string[],
): PreviewProfile {
  return {
    matchKey: 'customerName',
    lookupFn: makeLookup(records),
    ignoredFields,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Preview Engine', () => {

  // ── Diff Module ───────────────────────────────────────────────────────────

  describe('computeFieldDiffs', () => {
    test('detects changed fields', () => {
      const diffs = computeFieldDiffs(
        { name: 'New', address: '456 St' },
        { name: 'Old', address: '456 St' },
      );
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].field, 'name');
      assert.equal(diffs[0].oldValue, 'Old');
      assert.equal(diffs[0].newValue, 'New');
    });

    test('returns empty array when values are identical', () => {
      const diffs = computeFieldDiffs(
        { name: 'Same', weight: '10' },
        { name: 'Same', weight: '10' },
      );
      assert.equal(diffs.length, 0);
    });

    test('handles string-number coercion', () => {
      const diffs = computeFieldDiffs(
        { weight: '10' },
        { weight: 10 },
      );
      assert.equal(diffs.length, 0, 'String "10" should equal number 10');
    });

    test('treats null and undefined as equal', () => {
      const diffs = computeFieldDiffs(
        { name: 'A' },
        { name: 'A', extra: undefined as unknown as string },
      );
      assert.equal(diffs.length, 0);
    });

    test('detects null to value change', () => {
      const diffs = computeFieldDiffs(
        { name: 'A' },
        { name: null as unknown as string },
      );
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].oldValue, null);
      assert.equal(diffs[0].newValue, 'A');
    });

    test('respects ignored fields', () => {
      const diffs = computeFieldDiffs(
        { name: 'New', id: '123' },
        { name: 'Old', id: '456' },
        new Set(['id']),
      );
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].field, 'name');
    });
  });

  // ── Engine — Create Classification ────────────────────────────────────────

  describe('Create Classification', () => {
    test('classifies rows as create when no existing record exists', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' } },
      ]);
      const profile = makeProfile(); // empty lookup

      const result = previewDocument(doc, profile);

      assert.equal(result.document.processingState, 'previewed');
      assert.equal(result.document.rows[0].previewState?.action, 'create');
      assert.equal(result.document.rows[0].previewState?.matchedRecordId, null);
      assert.equal(result.summary.rowsToCreate, 1);
      assert.equal(result.summary.rowsToUpdate, 0);
    });

    test('classifies row with missing match key as create with warning', () => {
      const doc = makeMappedDoc([
        { values: { pickupAddress: 'A', deliveryAddress: 'B' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.document.rows[0].previewState?.action, 'create');
      const warningDiag = result.document.rows[0].rowDiagnostics.find(
        d => d.code === PREVIEW_CODES.MATCH_KEY_MISSING,
      );
      assert.ok(warningDiag);
    });

    test('multiple creates are counted correctly', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A', pickupAddress: 'X' } },
        { values: { customerName: 'B', pickupAddress: 'Y' } },
        { values: { customerName: 'C', pickupAddress: 'Z' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.summary.rowsToCreate, 3);
      assert.equal(result.summary.commitImpact.newRecords, 3);
    });
  });

  // ── Engine — Update Classification ────────────────────────────────────────

  describe('Update Classification', () => {
    test('classifies rows as update when existing record has different values', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'NewAddress' } },
      ]);
      const profile = makeProfile({
        'Acme': { id: 'rec-1', values: { customerName: 'Acme', pickupAddress: 'OldAddress' } },
      });

      const result = previewDocument(doc, profile);

      assert.equal(result.document.rows[0].previewState?.action, 'update');
      assert.equal(result.document.rows[0].previewState?.matchedRecordId, 'rec-1');
      assert.equal(result.document.rows[0].previewState?.fieldDiffs.length, 1);
      assert.equal(result.document.rows[0].previewState?.fieldDiffs[0].field, 'pickupAddress');
      assert.equal(result.summary.rowsToUpdate, 1);
      assert.equal(result.summary.commitImpact.updatedRecords, 1);
    });

    test('reports field-level changes in diagnostics', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'New', deliveryAddress: 'Also New' } },
      ]);
      const profile = makeProfile({
        'Acme': { id: 'rec-1', values: { customerName: 'Acme', pickupAddress: 'Old', deliveryAddress: 'Old Too' } },
      });

      const result = previewDocument(doc, profile);

      const fieldChangeDiags = result.document.rows[0].rowDiagnostics.filter(
        d => d.code === PREVIEW_CODES.FIELD_CHANGED,
      );
      assert.equal(fieldChangeDiags.length, 2);
      assert.equal(result.summary.commitImpact.totalFieldChanges, 2);
    });
  });

  // ── Engine — No Change Classification ─────────────────────────────────────

  describe('No Change Classification', () => {
    test('classifies row as no_change when all values match', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'Same' } },
      ]);
      const profile = makeProfile({
        'Acme': { id: 'rec-1', values: { customerName: 'Acme', pickupAddress: 'Same' } },
      });

      const result = previewDocument(doc, profile);

      assert.equal(result.document.rows[0].previewState?.action, 'no_change');
      assert.equal(result.document.rows[0].previewState?.matchedRecordId, 'rec-1');
      assert.equal(result.document.rows[0].previewState?.fieldDiffs.length, 0);
      assert.equal(result.document.rows[0].previewState?.userDecision, null);
      assert.equal(result.summary.rowsNoChange, 1);
      assert.equal(result.summary.commitImpact.unchangedRecords, 1);
    });
  });

  // ── Engine — Skip Classification ──────────────────────────────────────────

  describe('Skip Classification', () => {
    test('skips rows with skipped mapping status', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A' }, mappingStatus: 'skipped' },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.document.rows[0].previewState?.action, 'skip');
      assert.equal(result.summary.rowsSkipped, 1);
    });

    test('skips rows with unmapped mapping status', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A' }, mappingStatus: 'unmapped' },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.document.rows[0].previewState?.action, 'skip');
      assert.equal(result.summary.rowsSkipped, 1);
    });
  });

  // ── Engine — Duplicate Detection ──────────────────────────────────────────

  describe('Duplicate Detection', () => {
    test('detects duplicate match keys across rows', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A' } },
        { values: { customerName: 'Acme', pickupAddress: 'B' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      const dupDiag = result.document.diagnostics.find(
        d => d.code === PREVIEW_CODES.DUPLICATE_KEY,
      );
      assert.ok(dupDiag);
      assert.equal(result.summary.duplicateKeyCount, 2);
    });

    test('does not flag unique keys as duplicates', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A', pickupAddress: 'X' } },
        { values: { customerName: 'B', pickupAddress: 'Y' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.summary.duplicateKeyCount, 0);
    });
  });

  // ── Engine — Ignored Fields ───────────────────────────────────────────────

  describe('Ignored Fields', () => {
    test('excludes ignored fields from diff computation', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', internalId: '999', pickupAddress: 'Same' } },
      ]);
      const profile = makeProfile(
        { 'Acme': { id: 'rec-1', values: { customerName: 'Acme', internalId: '111', pickupAddress: 'Same' } } },
        ['internalId'],
      );

      const result = previewDocument(doc, profile);

      // internalId differs but is ignored → no_change
      assert.equal(result.document.rows[0].previewState?.action, 'no_change');
    });
  });

  // ── Engine — Statistics ───────────────────────────────────────────────────

  describe('Statistics', () => {
    test('produces accurate preview statistics', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'New1', pickupAddress: 'A' } },                    // create
        { values: { customerName: 'Existing', pickupAddress: 'Changed' } },           // update
        { values: { customerName: 'Unchanged', pickupAddress: 'Same' } },             // no_change
        { values: { customerName: 'Skipped' }, mappingStatus: 'skipped' },            // skip
      ]);
      const profile = makeProfile({
        'Existing': { id: 'r1', values: { customerName: 'Existing', pickupAddress: 'Old' } },
        'Unchanged': { id: 'r2', values: { customerName: 'Unchanged', pickupAddress: 'Same' } },
      });

      const result = previewDocument(doc, profile);

      assert.equal(result.document.statistics.preview?.creates, 1);
      assert.equal(result.document.statistics.preview?.updates, 1);
      assert.equal(result.document.statistics.preview?.noChange, 1);
      assert.equal(result.document.statistics.preview?.deletes, 0);
    });
  });

  // ── Engine — Summaries ────────────────────────────────────────────────────

  describe('Summaries', () => {
    test('builds correct commit impact summary', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A', pickupAddress: 'X' } },
        { values: { customerName: 'B', pickupAddress: 'Changed' } },
      ]);
      const profile = makeProfile({
        'B': { id: 'r1', values: { customerName: 'B', pickupAddress: 'Original' } },
      });

      const result = previewDocument(doc, profile);

      assert.equal(result.summary.commitImpact.newRecords, 1);
      assert.equal(result.summary.commitImpact.updatedRecords, 1);
      assert.equal(result.summary.commitImpact.totalFieldChanges, 1);
      assert.deepEqual(result.summary.commitImpact.fieldsAffected, ['pickupAddress']);
    });

    test('summary includes per-row details', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'Acme', pickupAddress: 'A' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.summary.rows.length, 1);
      assert.equal(result.summary.rows[0].rowId, 'row-0');
      assert.equal(result.summary.rows[0].action, 'create');
      assert.equal(result.summary.rows[0].mappedEntity, 'delivery');
      assert.equal(result.summary.rows[0].validationStatus, 'valid');
      assert.equal(result.summary.rows[0].mappingStatus, 'mapped');
    });

    test('skipped rows have skip reason', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A' }, mappingStatus: 'skipped' },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.ok(result.summary.rows[0].skipReason);
      assert.ok(result.summary.rows[0].skipReason!.includes('skipped'));
    });
  });

  // ── Engine — Diagnostics ──────────────────────────────────────────────────

  describe('Diagnostics', () => {
    test('all diagnostics have stage "preview"', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A', pickupAddress: 'X' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      // Check doc-level diagnostics added by preview
      const previewDiags = result.document.diagnostics.filter(d => d.stage === 'preview');
      assert.ok(previewDiags.length > 0);
      for (const d of previewDiags) {
        assert.equal(d.stage, 'preview');
        assert.ok(d.timestamp);
        assert.ok(d.code.startsWith('PRV_'));
      }
    });

    test('includes PREVIEW_COMPLETE diagnostic', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      const completeDiag = result.document.diagnostics.find(
        d => d.code === PREVIEW_CODES.PREVIEW_COMPLETE,
      );
      assert.ok(completeDiag);
    });
  });

  // ── Engine — State Guards ─────────────────────────────────────────────────

  describe('State Guards', () => {
    test('rejects document not in mapped state', () => {
      const doc = makeMappedDoc([]);
      (doc as any).processingState = 'validated';

      assert.throws(
        () => previewDocument(doc, makeProfile()),
        /is in state "validated" but expected "mapped"/,
      );
    });

    test('transitions document to previewed state', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'A' } },
      ]);
      const profile = makeProfile();

      const result = previewDocument(doc, profile);

      assert.equal(result.document.processingState, 'previewed');
      assert.ok(result.document.timestamps.previewedAt);
    });
  });

  // ── Engine — Mixed Scenario ───────────────────────────────────────────────

  describe('Mixed Scenario (Integration)', () => {
    test('handles creates, updates, no-change, and skips in a single document', () => {
      const doc = makeMappedDoc([
        { values: { customerName: 'NewCo', pickupAddress: 'A', deliveryAddress: 'B' } },
        { values: { customerName: 'ExistCo', pickupAddress: 'Changed', deliveryAddress: 'Also Changed' } },
        { values: { customerName: 'SameCo', pickupAddress: 'Same', deliveryAddress: 'Same' } },
        { values: { customerName: 'BadRow' }, mappingStatus: 'skipped' },
        { values: { customerName: 'NewCo2', pickupAddress: 'C', deliveryAddress: 'D' } },
      ]);

      const profile = makeProfile({
        'ExistCo': { id: 'r1', values: { customerName: 'ExistCo', pickupAddress: 'Old', deliveryAddress: 'Old' } },
        'SameCo': { id: 'r2', values: { customerName: 'SameCo', pickupAddress: 'Same', deliveryAddress: 'Same' } },
      });

      const result = previewDocument(doc, profile);

      // Verify individual rows
      assert.equal(result.document.rows[0].previewState?.action, 'create');
      assert.equal(result.document.rows[1].previewState?.action, 'update');
      assert.equal(result.document.rows[2].previewState?.action, 'no_change');
      assert.equal(result.document.rows[3].previewState?.action, 'skip');
      assert.equal(result.document.rows[4].previewState?.action, 'create');

      // Verify summary
      assert.equal(result.summary.rowsToCreate, 2);
      assert.equal(result.summary.rowsToUpdate, 1);
      assert.equal(result.summary.rowsNoChange, 1);
      assert.equal(result.summary.rowsSkipped, 1);
      assert.equal(result.summary.totalRows, 5);

      // Verify commit impact
      assert.equal(result.summary.commitImpact.newRecords, 2);
      assert.equal(result.summary.commitImpact.updatedRecords, 1);
      assert.equal(result.summary.commitImpact.unchangedRecords, 1);
      assert.equal(result.summary.commitImpact.skippedRecords, 1);
      assert.equal(result.summary.commitImpact.totalFieldChanges, 2);

      // Verify update diffs
      assert.equal(result.document.rows[1].previewState?.fieldDiffs.length, 2);

      // Verify document state
      assert.equal(result.document.processingState, 'previewed');
      assert.ok(result.document.statistics.preview);
    });
  });
});
