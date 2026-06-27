import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';

import { 
  matchHeaders, 
  mapDocument, 
  DELIVERY_ENTITY, 
  MAP_CODES,
  CONFIDENCE_SCORES
} from '../index';
import type { ImportDocument, ImportRow, RowValidationState } from '../../contract/types';
import { CONTRACT_VERSION } from '../../contract/constants';

describe('Mapping Engine', () => {
  describe('Matcher (matchHeaders)', () => {
    test('exact matches have highest confidence', () => {
      const headers = ['customerName', 'pickupAddress'];
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.mappings.length, 2);
      assert.equal(result.mappings[0].targetField, 'customerName');
      assert.equal(result.mappings[0].confidence, 'exact');
      assert.equal(result.mappings[0].score, CONFIDENCE_SCORES.exact);
    });

    test('normalized matches are correctly identified', () => {
      const headers = ['CUSTOMER_NAME', 'Pickup Address'];
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.mappings.length, 2);
      assert.equal(result.mappings[0].confidence, 'normalized');
      assert.equal(result.mappings[0].score, CONFIDENCE_SCORES.normalized);
    });

    test('alias matches are correctly identified', () => {
      // 'client' is an alias for customerName, 'origin' for pickupAddress
      const headers = ['client', 'origin'];
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.mappings.length, 2);
      assert.equal(result.mappings[0].confidence, 'alias');
      assert.equal(result.mappings[0].score, CONFIDENCE_SCORES.alias);
    });

    test('overrides take absolute precedence', () => {
      // 'random_col' -> 'customerName'
      const headers = ['random_col'];
      const result = matchHeaders(headers, { 
        name: 'test', 
        entity: DELIVERY_ENTITY,
        overrides: { 'random_col': 'customerName' }
      });

      assert.equal(result.mappings.length, 1);
      assert.equal(result.mappings[0].targetField, 'customerName');
      assert.equal(result.mappings[0].confidence, 'exact');
    });

    test('resolves duplicate mappings deterministically by confidence', () => {
      // 'customerName' (exact) vs 'client' (alias for customerName)
      const headers = ['client', 'customerName'];
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.mappings.length, 1); // Only one mapping for customerName
      assert.equal(result.mappings[0].targetField, 'customerName');
      assert.equal(result.mappings[0].sourceColumn, 'customerName'); // the exact match wins

      assert.equal(result.duplicateMappings.length, 1);
      assert.equal(result.duplicateMappings[0].targetField, 'customerName');
      assert.deepEqual(result.duplicateMappings[0].sourceColumns.sort(), ['client', 'customerName']);
    });

    test('identifies unmapped headers', () => {
      const headers = ['customerName', 'unknown_field', 'another_one'];
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.unmappedHeaders.length, 2);
      assert.deepEqual(result.unmappedHeaders, ['unknown_field', 'another_one']);
    });

    test('identifies missing required fields', () => {
      const headers = ['customerName']; // missing pickupAddress, deliveryAddress
      const result = matchHeaders(headers, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.missingRequiredFields.length, 2);
      assert.ok(result.missingRequiredFields.includes('pickupAddress'));
      assert.ok(result.missingRequiredFields.includes('deliveryAddress'));
    });
  });

  describe('Engine (mapDocument)', () => {
    // Helper to create a dummy validated document
    function makeValidatedDoc(headers: string[], rowsData: Record<string, string>[]): ImportDocument {
      const rows: ImportRow[] = rowsData.map((data, idx) => ({
        rowId: `row-${idx}`,
        sourceRowNumber: idx + 2,
        originalValues: { ...data },
        normalizedValues: { ...data },
        isMalformed: false,
        rowDiagnostics: [],
        validationState: {
          status: 'valid',
          fieldResults: {},
          isCritical: false
        }
      }));

      return {
        documentId: 'test-doc',
        version: CONTRACT_VERSION,
        source: {
          sourceType: 'test',
          sourceIdentifier: 'test.csv',
          sourceMetadata: {}
        },
        adapter: {
          adapterName: 'test-adapter',
          adapterVersion: '1.0'
        },
        tenant: 'test-tenant',
        headers: headers.map((h, i) => ({ 
          original: h, 
          normalized: h, 
          index: i, 
          wasBlank: false, 
          wasDuplicate: false 
        })),
        rows,
        diagnostics: [],
        statistics: {
          adapter: {
            totalRows: rows.length,
            malformedRows: 0,
            blankRowsSkipped: 0,
            parseTimeMs: 1
          },
          validation: {
            validRows: rows.length,
            invalidRows: 0,
            skippedRows: 0,
            warningCount: 0,
            errorCount: 0,
            validationTimeMs: 1
          }
        },
        timestamps: {
          createdAt: new Date().toISOString(),
          validatedAt: new Date().toISOString()
        },
        processingState: 'validated'
      };
    }

    test('successfully maps a clean document', () => {
      const doc = makeValidatedDoc(
        ['customerName', 'pickupAddress', 'deliveryAddress', 'weight'],
        [
          { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B', weight: '10' }
        ]
      );

      const result = mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.processingState, 'mapped');
      assert.equal(result.rows[0].mappingState?.status, 'mapped');
      assert.equal(result.rows[0].mappingState?.mappedEntity, 'delivery');
      assert.deepEqual(result.rows[0].mappingState?.mappedValues, {
        customerName: 'Acme',
        pickupAddress: 'A',
        deliveryAddress: 'B',
        weight: '10'
      });
      assert.equal(result.statistics?.mapping?.mappedRows, 1);
      assert.equal(result.statistics?.mapping?.unmappedRows, 0);
    });

    test('identifies partially mapped rows (missing optional fields)', () => {
      const doc = makeValidatedDoc(
        ['customerName', 'pickupAddress', 'deliveryAddress'], // missing weight
        [
          { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' },
          { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' }
        ]
      );

      // We didn't map all possible mappable fields (if there are fields mapped to nothing, they don't count towards 'partially mapped' unless mappedFieldCount < totalMappableFields)
      // Actually, if we map all columns we had, but the document didn't have all entity columns, is it partially mapped?
      // Wait, mapDocument checks `mappedFieldCount < totalMappableFields`. 
      // totalMappableFields is `mappingResult.mappings.length`.
      // Since `weight` column is not in the document, it's not in `mappingResult.mappings`.
      // So mappedFieldCount (3) === totalMappableFields (3). It will be 'mapped'.
      const result = mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY });
      assert.equal(result.rows[0].mappingState?.status, 'mapped');
    });
    
    test('identifies partially mapped rows (null/empty values)', () => {
      const doc = makeValidatedDoc(
        ['customerName', 'pickupAddress', 'deliveryAddress', 'weight'],
        [
          { customerName: 'Acme', pickupAddress: 'A', deliveryAddress: 'B' } // weight is missing from row
        ]
      );
      
      const result = mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY });
      // totalMappableFields = 4. mappedFieldCount = 3 (since weight is undefined).
      assert.equal(result.rows[0].mappingState?.status, 'partially_mapped');
    });

    test('skips invalid rows without mapping', () => {
      const doc = makeValidatedDoc(['customerName', 'pickupAddress'], [{ customerName: 'A', pickupAddress: 'B' }]);
      // Force row to be invalid
      doc.rows[0].validationState = {
        status: 'invalid',
        fieldResults: {},
        isCritical: true
      };

      const result = mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY });

      assert.equal(result.rows[0].mappingState?.status, 'skipped');
      assert.deepEqual(result.rows[0].mappingState?.mappedValues, {});
      assert.equal(result.statistics?.mapping?.mappedRows, 0);
      assert.equal(result.statistics?.mapping?.unmappedRows, 1);
      
      // Should have a diagnostic about skipping
      const skipDiag = result.rows[0].rowDiagnostics.find(d => d.code === MAP_CODES.ROW_SKIPPED_INVALID);
      assert.ok(skipDiag);
    });

    test('generates document-level diagnostics for unmapped and missing fields', () => {
      // missing pickupAddress, deliveryAddress. Has unknown column 'foo'
      const doc = makeValidatedDoc(['customerName', 'foo'], [{ customerName: 'A', foo: 'bar' }]);

      const result = mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY });

      const unmappedDiag = result.diagnostics.find(d => d.code === MAP_CODES.FIELD_UNMAPPED);
      assert.ok(unmappedDiag);
      assert.equal(unmappedDiag?.column, 'foo');

      const missingDiags = result.diagnostics.filter(d => d.code === MAP_CODES.REQUIRED_FIELD_MISSING);
      assert.equal(missingDiags.length, 2); // pickupAddress, deliveryAddress
    });

    test('rejects document not in validated state', () => {
      const doc = makeValidatedDoc(['customerName'], []);
      (doc as any).processingState = 'parsed'; // Invalid state

      assert.throws(
        () => mapDocument(doc, { name: 'test', entity: DELIVERY_ENTITY }),
        /is in state "parsed" but expected "validated"/
      );
    });
  });
});
