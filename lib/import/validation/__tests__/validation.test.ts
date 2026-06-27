// ─── Validation Engine — Comprehensive Unit Tests ─────────────────────────────
// Uses Node's built-in test runner (zero dependencies).
// Run with: npx tsx lib/import/validation/__tests__/validation.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Contract
import type {
  ImportDocument,
  ImportRow,
  ImportHeader,
  ImportDiagnostic,
} from '../../contract/types';
import { CONTRACT_VERSION } from '../../contract/constants';

// CSV Adapter
import { parseCsv } from '../../csv/parser';
import { csvToImportDocument } from '../../adapters/csv/adapter';

// Validation Engine
import { validateDocument, VAL_CODES } from '../engine';
import type { ValidationProfile } from '../types';

// Rules
import { requiredRule } from '../rules/required';
import { integerRule } from '../rules/integer';
import { decimalRule } from '../rules/decimal';
import { booleanRule } from '../rules/boolean';
import { enumRule } from '../rules/enum';
import { dateRule } from '../rules/date';
import { getRule, registerRule, getRegisteredRuleNames } from '../rules';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeDoc(csv: string, filename = 'test.csv', tenant = 'tenant-1'): ImportDocument {
  const parseResult = parseCsv(csv);
  return csvToImportDocument(parseResult, filename, tenant);
}

function makeProfile(overrides: Partial<ValidationProfile> = {}): ValidationProfile {
  return {
    name: 'test-profile',
    fields: [],
    ...overrides,
  };
}

// ─── ADAPTER TESTS ────────────────────────────────────────────────────────────

describe('CSV Adapter', () => {
  it('converts ImportParseResult to ImportDocument', () => {
    const doc = makeDoc('Name,Weight\nAlice,100\nBob,200');

    assert.equal(doc.version, CONTRACT_VERSION);
    assert.equal(doc.source.sourceType, 'csv');
    assert.equal(doc.source.sourceIdentifier, 'test.csv');
    assert.equal(doc.adapter.adapterName, 'csv-adapter');
    assert.equal(doc.processingState, 'parsed');
    assert.equal(doc.tenant, 'tenant-1');
    assert.equal(doc.headers.length, 2);
    assert.equal(doc.rows.length, 2);
    assert.ok(doc.documentId.length > 0);
    assert.ok(doc.timestamps.createdAt.length > 0);
  });

  it('preserves original and normalized values', () => {
    const doc = makeDoc('Name,Weight\n  Alice  , 100 ');

    assert.equal(doc.rows[0].originalValues['name'], '  Alice  ');
    assert.equal(doc.rows[0].normalizedValues['name'], 'Alice');
  });

  it('carries adapter statistics', () => {
    const doc = makeDoc('Name,Weight\nAlice,100\n\nBob,200');

    assert.ok(doc.statistics.adapter);
    assert.equal(doc.statistics.adapter!.totalRows, 2);
    assert.equal(doc.statistics.adapter!.blankRowsSkipped, 1);
  });

  it('translates adapter diagnostics with stage field', () => {
    const doc = makeDoc('\uFEFFName,Weight\nAlice,100');

    const bomDiag = doc.diagnostics.find(d => d.code === 'CSV_BOM_DETECTED');
    assert.ok(bomDiag);
    assert.equal(bomDiag!.stage, 'adapter');
    assert.ok(bomDiag!.timestamp.length > 0);
  });

  it('marks malformed rows', () => {
    const doc = makeDoc('Name,Weight\nAlice,100,extra');
    assert.equal(doc.rows[0].isMalformed, true);
  });

  it('carries header metadata', () => {
    const doc = makeDoc('Name,,Name\nAlice,x,Bob');

    assert.equal(doc.headers[1].wasBlank, true);
    assert.equal(doc.headers[2].wasDuplicate, true);
  });
});

// ─── INDIVIDUAL RULE TESTS ────────────────────────────────────────────────────

describe('Validation Rules', () => {
  describe('Required', () => {
    it('passes for non-empty value', () => {
      assert.equal(requiredRule.validate('hello'), null);
    });

    it('fails for empty string', () => {
      assert.ok(requiredRule.validate('') !== null);
    });

    it('fails for whitespace-only', () => {
      assert.ok(requiredRule.validate('   ') !== null);
    });
  });

  describe('Integer', () => {
    it('passes for valid integer', () => {
      assert.equal(integerRule.validate('42'), null);
      assert.equal(integerRule.validate('-7'), null);
      assert.equal(integerRule.validate('0'), null);
    });

    it('fails for decimal', () => {
      assert.ok(integerRule.validate('3.14') !== null);
    });

    it('fails for non-numeric', () => {
      assert.ok(integerRule.validate('abc') !== null);
    });

    it('skips empty values', () => {
      assert.equal(integerRule.validate(''), null);
    });

    it('validates min/max bounds', () => {
      assert.equal(integerRule.validate('5', { min: 1, max: 10 }), null);
      assert.ok(integerRule.validate('0', { min: 1 }) !== null);
      assert.ok(integerRule.validate('11', { max: 10 }) !== null);
    });
  });

  describe('Decimal', () => {
    it('passes for valid decimal', () => {
      assert.equal(decimalRule.validate('3.14'), null);
      assert.equal(decimalRule.validate('-2.5'), null);
      assert.equal(decimalRule.validate('100'), null);
    });

    it('fails for non-numeric', () => {
      assert.ok(decimalRule.validate('xyz') !== null);
    });

    it('skips empty values', () => {
      assert.equal(decimalRule.validate(''), null);
    });

    it('validates decimal places', () => {
      assert.equal(decimalRule.validate('3.14', { maxDecimalPlaces: 2 }), null);
      assert.ok(decimalRule.validate('3.141', { maxDecimalPlaces: 2 }) !== null);
    });
  });

  describe('Boolean', () => {
    it('passes for recognized booleans', () => {
      for (const v of ['true', 'false', 'yes', 'no', '1', '0', 'True', 'YES', 'y', 'n', 'on', 'off']) {
        assert.equal(booleanRule.validate(v), null, `Expected "${v}" to pass`);
      }
    });

    it('fails for unrecognized values', () => {
      assert.ok(booleanRule.validate('maybe') !== null);
      assert.ok(booleanRule.validate('2') !== null);
    });

    it('skips empty values', () => {
      assert.equal(booleanRule.validate(''), null);
    });
  });

  describe('Enum', () => {
    const opts = { values: ['small', 'medium', 'large'] };

    it('passes for allowed values (case insensitive)', () => {
      assert.equal(enumRule.validate('small', opts), null);
      assert.equal(enumRule.validate('MEDIUM', opts), null);
    });

    it('fails for disallowed values', () => {
      assert.ok(enumRule.validate('xlarge', opts) !== null);
    });

    it('supports case-sensitive mode', () => {
      const caseSensitive = { values: ['Small'], caseSensitive: true };
      assert.equal(enumRule.validate('Small', caseSensitive), null);
      assert.ok(enumRule.validate('small', caseSensitive) !== null);
    });

    it('skips empty values', () => {
      assert.equal(enumRule.validate('', opts), null);
    });
  });

  describe('Date', () => {
    it('passes for ISO 8601 dates', () => {
      assert.equal(dateRule.validate('2024-01-15'), null);
      assert.equal(dateRule.validate('2024-01-15T10:30:00Z'), null);
    });

    it('passes for US format', () => {
      assert.equal(dateRule.validate('01/15/2024'), null);
    });

    it('passes for compact format', () => {
      assert.equal(dateRule.validate('20240115'), null);
    });

    it('fails for invalid dates', () => {
      assert.ok(dateRule.validate('not-a-date') !== null);
    });

    it('skips empty values', () => {
      assert.equal(dateRule.validate(''), null);
    });
  });

  describe('Rule Registry', () => {
    it('returns all built-in rules', () => {
      const names = getRegisteredRuleNames();
      assert.ok(names.includes('required'));
      assert.ok(names.includes('integer'));
      assert.ok(names.includes('decimal'));
      assert.ok(names.includes('boolean'));
      assert.ok(names.includes('enum'));
      assert.ok(names.includes('date'));
    });

    it('looks up rules by name', () => {
      assert.ok(getRule('required'));
      assert.equal(getRule('nonexistent'), undefined);
    });

    it('supports custom rule registration', () => {
      registerRule({
        name: 'custom_test',
        description: 'Test rule',
        validate: (v) => v === 'bad' ? 'Bad value' : null,
      });
      const rule = getRule('custom_test');
      assert.ok(rule);
      assert.equal(rule!.validate('good'), null);
      assert.ok(rule!.validate('bad') !== null);
    });
  });
});

// ─── VALIDATION ENGINE TESTS ──────────────────────────────────────────────────

describe('Validation Engine', () => {
  describe('Successful Validation', () => {
    it('validates a clean document with no rules', () => {
      const doc = makeDoc('Name,Weight\nAlice,100\nBob,200');
      const profile = makeProfile();

      const result = validateDocument(doc, profile);

      assert.equal(result.processingState, 'validated');
      assert.ok(result.timestamps.validatedAt);
      assert.ok(result.statistics.validation);
      assert.equal(result.statistics.validation!.validRows, 2);
      assert.equal(result.statistics.validation!.invalidRows, 0);
    });

    it('validates fields that pass all rules', () => {
      const doc = makeDoc('Name,Weight\nAlice,100\nBob,200');
      const profile = makeProfile({
        fields: [
          { column: 'name', required: true, rules: [] },
          { column: 'weight', required: true, rules: [{ ruleName: 'integer', params: { min: 0 } }] },
        ],
      });

      const result = validateDocument(doc, profile);

      assert.equal(result.statistics.validation!.validRows, 2);
      assert.equal(result.statistics.validation!.invalidRows, 0);

      // Check per-row state
      assert.equal(result.rows[0].validationState?.status, 'valid');
      assert.equal(result.rows[0].validationState?.isCritical, false);
      assert.ok(result.rows[0].validationState?.fieldResults['name'].rulesPassed.includes('required'));
    });
  });

  describe('Required Field Validation', () => {
    it('detects missing required fields', () => {
      const doc = makeDoc('Name,Weight\n,100\nBob,');
      const profile = makeProfile({
        fields: [
          { column: 'name', required: true, rules: [] },
          { column: 'weight', required: true, rules: [] },
        ],
      });

      const result = validateDocument(doc, profile);

      assert.equal(result.rows[0].validationState?.status, 'invalid');
      assert.ok(result.rows[0].validationState?.fieldResults['name'].rulesFailed.includes('required'));

      assert.equal(result.rows[1].validationState?.status, 'invalid');
      assert.ok(result.rows[1].validationState?.fieldResults['weight'].rulesFailed.includes('required'));
    });

    it('detects whitespace-only as missing', () => {
      const doc = makeDoc('Name,Weight\n   ,100');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'invalid');
    });
  });

  describe('Type Validation', () => {
    it('rejects non-integer values', () => {
      const doc = makeDoc('Name,Weight\nAlice,abc');
      const profile = makeProfile({
        fields: [
          { column: 'weight', rules: [{ ruleName: 'integer' }] },
        ],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'invalid');
      assert.ok(result.rows[0].validationState?.fieldResults['weight'].rulesFailed.includes('integer'));
    });

    it('rejects invalid decimal values', () => {
      const doc = makeDoc('Name,Price\nAlice,twelve');
      const profile = makeProfile({
        fields: [{ column: 'price', rules: [{ ruleName: 'decimal' }] }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'invalid');
    });

    it('validates boolean fields', () => {
      const doc = makeDoc('Name,Active\nAlice,yes\nBob,maybe');
      const profile = makeProfile({
        fields: [{ column: 'active', rules: [{ ruleName: 'boolean' }] }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'valid');
      assert.equal(result.rows[1].validationState?.status, 'invalid');
    });

    it('validates enum fields', () => {
      const doc = makeDoc('Name,Size\nAlice,Small\nBob,Huge');
      const profile = makeProfile({
        fields: [{
          column: 'size',
          rules: [{ ruleName: 'enum', params: { values: ['small', 'medium', 'large'] } }],
        }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'valid');
      assert.equal(result.rows[1].validationState?.status, 'invalid');
    });

    it('validates date fields', () => {
      const doc = makeDoc('Name,Date\nAlice,2024-01-15\nBob,not-a-date');
      const profile = makeProfile({
        fields: [{ column: 'date', rules: [{ ruleName: 'date' }] }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'valid');
      assert.equal(result.rows[1].validationState?.status, 'invalid');
    });
  });

  describe('Duplicate Detection', () => {
    it('detects duplicate rows by composite key', () => {
      const doc = makeDoc('Name,City\nAlice,NYC\nBob,LA\nAlice,NYC');
      const profile = makeProfile({
        fields: [],
        detectDuplicates: true,
        duplicateKeyColumns: ['name', 'city'],
      });

      const result = validateDocument(doc, profile);

      // First Alice is valid, second Alice is duplicate
      assert.equal(result.rows[0].validationState?.status, 'valid');
      assert.equal(result.rows[1].validationState?.status, 'valid');
      assert.equal(result.rows[2].validationState?.status, 'invalid');
      assert.ok(
        result.diagnostics.some(d => d.code === VAL_CODES.DUPLICATE_ROW && d.row === 4),
      );
    });

    it('does not flag unique rows', () => {
      const doc = makeDoc('Name,City\nAlice,NYC\nBob,LA');
      const profile = makeProfile({
        fields: [],
        detectDuplicates: true,
        duplicateKeyColumns: ['name'],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.statistics.validation!.invalidRows, 0);
    });
  });

  describe('Malformed Row Handling', () => {
    it('skips malformed rows with a warning', () => {
      const doc = makeDoc('Name,Weight\nAlice,100,extra');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const result = validateDocument(doc, profile);

      assert.equal(result.rows[0].validationState?.status, 'skipped');
      assert.equal(result.statistics.validation!.skippedRows, 1);
      assert.ok(
        result.diagnostics.some(d => d.code === VAL_CODES.MALFORMED_ROW_SKIPPED),
      );
    });
  });

  describe('Diagnostics Accumulation', () => {
    it('appends validation diagnostics to adapter diagnostics', () => {
      const doc = makeDoc('\uFEFFName,Weight\n,100');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const adapterDiagCount = doc.diagnostics.length;
      const result = validateDocument(doc, profile);

      // Adapter diagnostics preserved + validation diagnostics appended
      assert.ok(result.diagnostics.length > adapterDiagCount);
      assert.ok(result.diagnostics.some(d => d.stage === 'adapter'));
      assert.ok(result.diagnostics.some(d => d.stage === 'validation'));
    });

    it('includes row and column in validation diagnostics', () => {
      const doc = makeDoc('Name,Weight\n,100');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const result = validateDocument(doc, profile);
      const valDiag = result.diagnostics.find(
        d => d.stage === 'validation' && d.code === VAL_CODES.REQUIRED_FIELD_MISSING,
      );

      assert.ok(valDiag);
      assert.equal(valDiag!.row, 2);
      assert.equal(valDiag!.column, 'name');
    });

    it('row diagnostics include validation-stage entries', () => {
      const doc = makeDoc('Name,Weight\n,100');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const result = validateDocument(doc, profile);
      const rowDiags = result.rows[0].rowDiagnostics;

      assert.ok(rowDiags.some(d => d.stage === 'validation'));
    });
  });

  describe('Document Integrity', () => {
    it('preserves immutable fields after validation', () => {
      const doc = makeDoc('Name,Weight\nAlice,100');
      const profile = makeProfile({
        fields: [{ column: 'name', required: true, rules: [] }],
      });

      const result = validateDocument(doc, profile);

      // Immutable fields preserved
      assert.equal(result.documentId, doc.documentId);
      assert.equal(result.version, doc.version);
      assert.equal(result.source.sourceType, doc.source.sourceType);
      assert.equal(result.adapter.adapterName, doc.adapter.adapterName);
      assert.equal(result.tenant, doc.tenant);
      assert.deepStrictEqual(result.headers, doc.headers);

      // Original values untouched
      assert.deepStrictEqual(result.rows[0].originalValues, doc.rows[0].originalValues);
      assert.deepStrictEqual(result.rows[0].normalizedValues, doc.rows[0].normalizedValues);

      // State advanced
      assert.equal(result.processingState, 'validated');
    });

    it('preserves adapter statistics', () => {
      const doc = makeDoc('Name,Weight\nAlice,100');
      const profile = makeProfile();

      const result = validateDocument(doc, profile);
      assert.deepStrictEqual(result.statistics.adapter, doc.statistics.adapter);
    });

    it('rejects document not in parsed state', () => {
      const doc = makeDoc('Name,Weight\nAlice,100');
      const profile = makeProfile();

      // Validate once
      const validated = validateDocument(doc, profile);

      // Trying to validate again should throw
      assert.throws(() => validateDocument(validated, profile), {
        message: /expected "parsed"/,
      });
    });
  });

  describe('Multiple Rules Per Field', () => {
    it('applies multiple rules and reports all failures', () => {
      const doc = makeDoc('Name,Weight\nAlice,-5');
      const profile = makeProfile({
        fields: [{
          column: 'weight',
          required: true,
          rules: [{ ruleName: 'integer', params: { min: 0 } }],
        }],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'invalid');
      assert.ok(result.rows[0].validationState?.fieldResults['weight'].rulesFailed.includes('integer'));
    });
  });

  describe('Empty Optional Fields', () => {
    it('allows empty non-required fields', () => {
      const doc = makeDoc('Name,Weight\nAlice,');
      const profile = makeProfile({
        fields: [
          { column: 'name', required: true, rules: [] },
          { column: 'weight', required: false, rules: [{ ruleName: 'integer' }] },
        ],
      });

      const result = validateDocument(doc, profile);
      assert.equal(result.rows[0].validationState?.status, 'valid');
    });
  });

  describe('Statistics', () => {
    it('produces accurate validation statistics', () => {
      const doc = makeDoc('Name,Weight\nAlice,100\n,200\nBob,abc');
      const profile = makeProfile({
        fields: [
          { column: 'name', required: true, rules: [] },
          { column: 'weight', rules: [{ ruleName: 'integer' }] },
        ],
      });

      const result = validateDocument(doc, profile);
      const stats = result.statistics.validation!;

      assert.equal(stats.validRows, 1); // Alice
      assert.equal(stats.invalidRows, 2); // empty name + invalid weight
      assert.ok(stats.validationTimeMs >= 0);
    });
  });
});

// ─── END-TO-END PIPELINE TEST ─────────────────────────────────────────────────

describe('End-to-End: CSV → Adapter → Validation', () => {
  it('processes a complete flow from CSV to validated document', () => {
    const csv = [
      'Name,Weight,Size,Active,DeliveryDate',
      'Alice,100,Small,yes,2024-01-15',
      'Bob,200,Large,no,2024-06-30',
      ',300,Medium,yes,2024-03-01',      // Missing name
      'Charlie,abc,XL,maybe,not-a-date',  // Multiple failures
    ].join('\n');

    const parseResult = parseCsv(csv);
    const doc = csvToImportDocument(parseResult, 'deliveries.csv', 'acme-corp');
    const profile: ValidationProfile = {
      name: 'delivery-validation',
      fields: [
        { column: 'name', required: true, rules: [] },
        { column: 'weight', required: true, rules: [{ ruleName: 'integer', params: { min: 0 } }] },
        { column: 'size', rules: [{ ruleName: 'enum', params: { values: ['small', 'medium', 'large'] } }] },
        { column: 'active', rules: [{ ruleName: 'boolean' }] },
        { column: 'deliverydate', rules: [{ ruleName: 'date' }] },
      ],
      detectDuplicates: true,
      duplicateKeyColumns: ['name'],
    };

    const result = validateDocument(doc, profile);

    // Pipeline state
    assert.equal(result.processingState, 'validated');
    assert.equal(result.version, CONTRACT_VERSION);

    // Row 1 (Alice): all valid
    assert.equal(result.rows[0].validationState?.status, 'valid');

    // Row 2 (Bob): all valid
    assert.equal(result.rows[1].validationState?.status, 'valid');

    // Row 3 (missing name): invalid
    assert.equal(result.rows[2].validationState?.status, 'invalid');

    // Row 4 (Charlie): multiple failures
    assert.equal(result.rows[3].validationState?.status, 'invalid');

    // Overall stats
    assert.equal(result.statistics.validation!.validRows, 2);
    assert.equal(result.statistics.validation!.invalidRows, 2);

    // Diagnostics integrity
    assert.ok(result.diagnostics.length > 0);
    assert.ok(result.diagnostics.some(d => d.stage === 'validation'));

    // Immutability: original values preserved
    assert.equal(result.rows[0].originalValues['name'], 'Alice');
    assert.equal(result.rows[0].normalizedValues['name'], 'Alice');
  });
});

// ─── RUN ──────────────────────────────────────────────────────────────────────
console.log('Running Validation Engine tests...\n');
