// ─── CSV Parsing Engine — Comprehensive Unit Tests ────────────────────────────
// Uses Node's built-in test runner (zero dependencies).
// Run with: npx tsx lib/import/csv/__tests__/parser.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../parser';
import { detectDelimiter, stripBOM, detectLineEnding } from '../detector';
import { normalizeHeaderName, normalizeHeaders } from '../normalizer';
import { isBinaryContent, isFormulaInjection, sanitizeForExport } from '../security';
import { CSV_ERROR_CODES } from '../errors';

// ─── DETECTOR TESTS ───────────────────────────────────────────────────────────

describe('Detector', () => {
  describe('detectDelimiter', () => {
    it('detects comma delimiter', () => {
      const csv = 'a,b,c\n1,2,3\n4,5,6';
      assert.equal(detectDelimiter(csv), ',');
    });

    it('detects semicolon delimiter', () => {
      const csv = 'a;b;c\n1;2;3\n4;5;6';
      assert.equal(detectDelimiter(csv), ';');
    });

    it('detects tab delimiter', () => {
      const csv = 'a\tb\tc\n1\t2\t3\n4\t5\t6';
      assert.equal(detectDelimiter(csv), '\t');
    });

    it('detects pipe delimiter', () => {
      const csv = 'a|b|c\n1|2|3\n4|5|6';
      assert.equal(detectDelimiter(csv), '|');
    });

    it('defaults to comma for ambiguous content', () => {
      const csv = 'abc';
      assert.equal(detectDelimiter(csv), ',');
    });

    it('handles quoted commas correctly during detection', () => {
      const csv = '"a,b",c,d\n"e,f",g,h';
      assert.equal(detectDelimiter(csv), ',');
    });
  });

  describe('stripBOM', () => {
    it('strips UTF-8 BOM', () => {
      assert.equal(stripBOM('\uFEFFhello'), 'hello');
    });

    it('leaves non-BOM content unchanged', () => {
      assert.equal(stripBOM('hello'), 'hello');
    });
  });

  describe('detectLineEnding', () => {
    it('detects CRLF', () => {
      assert.equal(detectLineEnding('a\r\nb\r\nc'), 'CRLF');
    });

    it('detects LF', () => {
      assert.equal(detectLineEnding('a\nb\nc'), 'LF');
    });

    it('detects mixed', () => {
      assert.equal(detectLineEnding('a\r\nb\nc'), 'mixed');
    });
  });
});

// ─── NORMALIZER TESTS ─────────────────────────────────────────────────────────

describe('Normalizer', () => {
  describe('normalizeHeaderName', () => {
    it('lowercases and trims', () => {
      assert.equal(normalizeHeaderName('  Customer Name  '), 'customer_name');
    });

    it('replaces dashes with underscores', () => {
      assert.equal(normalizeHeaderName('delivery-address'), 'delivery_address');
    });

    it('removes special characters', () => {
      assert.equal(normalizeHeaderName('Weight (kg)'), 'weight_kg');
    });

    it('collapses multiple underscores', () => {
      assert.equal(normalizeHeaderName('a___b'), 'a_b');
    });

    it('handles empty string', () => {
      assert.equal(normalizeHeaderName(''), '');
    });
  });

  describe('normalizeHeaders', () => {
    it('normalizes simple headers', () => {
      const result = normalizeHeaders(['Name', 'Weight', 'Address']);
      assert.equal(result.headers.length, 3);
      assert.equal(result.headers[0].normalized, 'name');
      assert.equal(result.headers[1].normalized, 'weight');
      assert.equal(result.headers[2].normalized, 'address');
    });

    it('handles blank headers', () => {
      const result = normalizeHeaders(['Name', '', 'Address']);
      assert.equal(result.headers[1].normalized, 'column_2');
      assert.equal(result.headers[1].wasBlank, true);
      assert.ok(result.diagnostics.some(d => d.code === CSV_ERROR_CODES.BLANK_HEADER));
    });

    it('handles duplicate headers', () => {
      const result = normalizeHeaders(['Weight', 'Weight', 'Weight']);
      assert.equal(result.headers[0].normalized, 'weight');
      assert.equal(result.headers[1].normalized, 'weight_2');
      assert.equal(result.headers[2].normalized, 'weight_3');
      assert.equal(result.headers[1].wasDuplicate, true);
    });
  });
});

// ─── SECURITY TESTS ───────────────────────────────────────────────────────────

describe('Security', () => {
  it('detects formula injection', () => {
    assert.equal(isFormulaInjection('=SUM(A1)'), true);
    assert.equal(isFormulaInjection('+cmd'), true);
    assert.equal(isFormulaInjection('-1'), true);
    assert.equal(isFormulaInjection('@import'), true);
    assert.equal(isFormulaInjection('hello'), false);
    assert.equal(isFormulaInjection(''), false);
  });

  it('sanitizes for export', () => {
    assert.equal(sanitizeForExport('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(sanitizeForExport('hello'), 'hello');
  });

  it('detects binary content', () => {
    assert.equal(isBinaryContent('hello world'), false);
    assert.equal(isBinaryContent('hello\0world'), true);
  });
});

// ─── PARSER CORE TESTS ───────────────────────────────────────────────────────

describe('Parser', () => {
  describe('Standard CSV', () => {
    it('parses a simple comma-delimited CSV', () => {
      const csv = 'Name,Weight,Address\nAlice,100,123 Main St\nBob,200,456 Oak Ave';
      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.equal(result.headers.length, 3);
      assert.equal(result.rows.length, 2);
      assert.equal(result.rows[0].trimmedValues['name'], 'Alice');
      assert.equal(result.rows[0].trimmedValues['weight'], '100');
      assert.equal(result.rows[1].trimmedValues['name'], 'Bob');
      assert.equal(result.stats.totalRows, 2);
      assert.equal(result.stats.validRows, 2);
    });

    it('preserves original values with whitespace', () => {
      const csv = 'Name,Weight\n  Alice  , 100 ';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].originalValues['name'], '  Alice  ');
      assert.equal(result.rows[0].trimmedValues['name'], 'Alice');
    });
  });

  describe('Semicolon CSV', () => {
    it('auto-detects and parses semicolon-delimited CSV', () => {
      const csv = 'Name;Weight;Address\nAlice;100;123 Main St\nBob;200;456 Oak Ave';
      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.equal(result.metadata?.detectedDelimiter, ';');
      assert.equal(result.rows[0].trimmedValues['name'], 'Alice');
    });
  });

  describe('Quoted Fields', () => {
    it('handles commas inside quoted fields', () => {
      const csv = 'Name,Address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak, Suite 2"';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].trimmedValues['address'], '123 Main St, Apt 4');
      assert.equal(result.rows[1].trimmedValues['address'], '456 Oak, Suite 2');
    });

    it('handles escaped quotes (double-quote)', () => {
      const csv = 'Name,Notes\nAlice,"She said ""hello"""\nBob,"Normal notes"';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].trimmedValues['notes'], 'She said "hello"');
    });
  });

  describe('Blank Rows', () => {
    it('skips blank rows by default', () => {
      const csv = 'Name,Weight\nAlice,100\n\nBob,200';
      const result = parseCsv(csv);

      assert.equal(result.rows.length, 2);
      assert.equal(result.stats.blankRowsSkipped, 1);
    });

    it('includes blank rows when configured', () => {
      const csv = 'Name,Weight\nAlice,100\n\nBob,200';
      const result = parseCsv(csv, { skipBlankRows: false });

      assert.equal(result.rows.length, 3);
    });
  });

  describe('Missing Headers', () => {
    it('assigns synthetic names when all headers are blank', () => {
      const csv = ',, \nAlice,100,Street';
      const result = parseCsv(csv);

      // The normalizer assigns column_1, column_2, column_3 for blank headers.
      // This is a valid (if unusual) CSV — not a fatal error.
      assert.equal(result.success, true);
      assert.equal(result.headers[0].normalized, 'column_1');
      assert.equal(result.headers[0].wasBlank, true);
    });

    it('returns fatal error for empty file', () => {
      const result = parseCsv('');
      assert.equal(result.success, false);
      assert.ok(result.diagnostics.some(d => d.code === CSV_ERROR_CODES.EMPTY_FILE));
    });

    it('returns fatal error for header-only file', () => {
      const csv = 'Name,Weight,Address';
      const result = parseCsv(csv);
      assert.equal(result.success, false);
      assert.ok(result.diagnostics.some(d => d.code === CSV_ERROR_CODES.NO_DATA_ROWS));
    });
  });

  describe('Duplicate Headers', () => {
    it('de-duplicates identical headers', () => {
      const csv = 'Weight,Weight,Weight\n1,2,3';
      const result = parseCsv(csv);

      assert.equal(result.headers[0].normalized, 'weight');
      assert.equal(result.headers[1].normalized, 'weight_2');
      assert.equal(result.headers[2].normalized, 'weight_3');
      assert.equal(result.rows[0].trimmedValues['weight'], '1');
      assert.equal(result.rows[0].trimmedValues['weight_2'], '2');
    });
  });

  describe('Column Count Mismatch', () => {
    it('handles rows with extra columns', () => {
      const csv = 'Name,Weight\nAlice,100,extra';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].isMalformed, true);
      assert.equal(result.stats.malformedRows, 1);
      // Extra column data is ignored but row is still parsed
      assert.equal(result.rows[0].trimmedValues['name'], 'Alice');
    });

    it('handles rows with missing columns', () => {
      const csv = 'Name,Weight,Address\nAlice,100';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].isMalformed, true);
      assert.equal(result.rows[0].trimmedValues['address'], '');
    });
  });

  describe('BOM Handling', () => {
    it('strips UTF-8 BOM and parses correctly', () => {
      const csv = '\uFEFFName,Weight\nAlice,100';
      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.equal(result.metadata?.hasBOM, true);
      assert.equal(result.headers[0].normalized, 'name');
      assert.equal(result.rows[0].trimmedValues['name'], 'Alice');
    });
  });

  describe('Line Endings', () => {
    it('handles Windows CRLF line endings', () => {
      const csv = 'Name,Weight\r\nAlice,100\r\nBob,200';
      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.equal(result.rows.length, 2);
      assert.equal(result.metadata?.lineEnding, 'CRLF');
    });

    it('handles Unix LF line endings', () => {
      const csv = 'Name,Weight\nAlice,100\nBob,200';
      const result = parseCsv(csv);

      assert.equal(result.rows.length, 2);
      assert.equal(result.metadata?.lineEnding, 'LF');
    });
  });

  describe('Large File Parsing', () => {
    it('parses 10,000 rows efficiently', () => {
      const header = 'Name,Weight,Address';
      const row = 'TestCustomer,1234.56,123 Test Street';
      const lines = [header, ...Array(10000).fill(row)];
      const csv = lines.join('\n');

      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.equal(result.rows.length, 10000);
      assert.equal(result.stats.totalRows, 10000);
      // Should parse in under 2 seconds
      assert.ok(result.stats.parseTimeMs < 2000, `Took ${result.stats.parseTimeMs}ms`);
    });
  });

  describe('Max Rows Limit', () => {
    it('limits parsed rows when maxRows is set', () => {
      const header = 'Name,Weight';
      const rows = Array(100).fill('Alice,100');
      const csv = [header, ...rows].join('\n');

      const result = parseCsv(csv, { maxRows: 10 });

      assert.equal(result.rows.length, 10);
    });
  });

  describe('Binary File Rejection', () => {
    it('rejects binary content', () => {
      const binary = 'PK\x03\x04\0\0\0\0\0\0\0\0';
      const result = parseCsv(binary);

      assert.equal(result.success, false);
      assert.ok(result.diagnostics.some(d => d.code === CSV_ERROR_CODES.BINARY_FILE));
    });
  });

  describe('Formula Injection Detection', () => {
    it('warns about cells starting with formula characters', () => {
      const csv = 'Name,Formula\nAlice,=SUM(A1:A10)\nBob,Normal';
      const result = parseCsv(csv);

      assert.equal(result.success, true);
      assert.ok(
        result.diagnostics.some(d => d.code === CSV_ERROR_CODES.FORMULA_INJECTION),
        'Should warn about formula injection'
      );
    });
  });

  describe('Row Numbering', () => {
    it('assigns correct 1-based source row numbers', () => {
      const csv = 'Name,Weight\nAlice,100\nBob,200\nCharlie,300';
      const result = parseCsv(csv);

      assert.equal(result.rows[0].sourceRowNumber, 2); // Row 1 is header
      assert.equal(result.rows[1].sourceRowNumber, 3);
      assert.equal(result.rows[2].sourceRowNumber, 4);
    });
  });

  describe('Forced Delimiter', () => {
    it('uses the forced delimiter instead of auto-detecting', () => {
      const csv = 'a;b;c\n1;2;3';
      const result = parseCsv(csv, { delimiter: ',' });

      // Forced comma delimiter means the entire line is one field
      assert.equal(result.headers.length, 1);
      assert.equal(result.metadata?.detectedDelimiter, ',');
    });
  });

  describe('Trailing Newline', () => {
    it('handles trailing newline without creating extra blank row', () => {
      const csv = 'Name,Weight\nAlice,100\nBob,200\n';
      const result = parseCsv(csv);

      assert.equal(result.rows.length, 2);
    });
  });
});

// ─── RUN ──────────────────────────────────────────────────────────────────────
console.log('Running CSV Parsing Engine tests...\n');
