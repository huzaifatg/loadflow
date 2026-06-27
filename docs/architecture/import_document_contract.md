# Import Document Contract

**Version**: 1.0
**Status**: Approved
**Author**: LoadFlow Architecture
**Date**: 2026-06-27
**Scope**: Data Ingestion Platform (DIPA)

---

## 1. Purpose

### Why ImportDocument Exists

The ImportDocument is the **canonical in-memory data structure** that flows through every stage of LoadFlow's ingestion pipeline. It is the single contract between all data sources and all processing engines.

Without this contract, every downstream engine (Validation, Mapping, Preview, Commit) would need to understand the specifics of every data source (CSV, Excel, Shopify, SAP). This creates an N×M integration problem: N sources × M engines = N×M coupling points. The ImportDocument reduces this to N+M: each source produces one document, each engine consumes one document.

### Why Downstream Engines Must Never Depend on CSV

The CSV Parsing Engine is one adapter among many. Today we parse CSV files. Tomorrow we will ingest Excel workbooks, Shopify webhooks, WooCommerce REST payloads, SAP IDocs, and Oracle flat extracts. If the Validation Engine understood CSV column indices, it would break when Shopify sends JSON arrays. If the Mapping Engine referenced Excel cell coordinates, it would be useless for API payloads.

Every downstream engine operates exclusively on ImportDocument. The origin of the data is irrelevant once the adapter has completed its translation.

### Why Adapters Exist

An adapter is a translation layer. Its sole responsibility is:

1. Accept raw source data in its native format.
2. Detect characteristics (encoding, structure, schema).
3. Translate to ImportDocument.
4. Report diagnostics about the translation.

An adapter **never validates business rules**, **never maps to domain models**, **never writes to a database**. It translates, and nothing more.

---

## 2. Pipeline Overview

### Core Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│                                                                     │
│   CSV File    Excel File    Shopify    WooCommerce    SAP    Oracle │
│      │            │            │            │          │       │    │
│      ▼            ▼            ▼            ▼          ▼       ▼    │
│   ┌──────┐   ┌────────┐   ┌────────┐   ┌────────┐  ┌─────┐ ┌────┐ │
│   │ CSV  │   │ Excel  │   │Shopify │   │  Woo   │  │ SAP │ │Ora.│ │
│   │Adapt.│   │ Adapt. │   │ Adapt. │   │ Adapt. │  │Ad.  │ │Ad. │ │
│   └──┬───┘   └───┬────┘   └───┬────┘   └───┬────┘  └──┬──┘ └─┬──┘ │
│      │           │             │             │          │       │    │
│      └───────────┴──────┬──────┴─────────────┴──────────┴───────┘    │
│                         │                                            │
│                         ▼                                            │
│              ┌─────────────────────┐                                 │
│              │   ImportDocument    │  ← Canonical contract           │
│              └─────────┬───────────┘                                 │
│                        │                                             │
└────────────────────────┼─────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Validation Engine  │  → Enriches with validation state
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   Mapping Engine    │  → Enriches with mapped values
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   Preview Engine    │  → Enriches with preview/diff state
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   Commit Engine     │  → Consumes document, writes to DB
              └─────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │     Database        │
              └─────────────────────┘
```

### How New Adapters Integrate

When a new data source is added (e.g., a REST API adapter):

1. A new adapter is written that translates the source format into an ImportDocument.
2. **Zero changes** are made to Validation, Mapping, Preview, or Commit.
3. The new adapter registers itself with the adapter registry.
4. The pipeline consumes the ImportDocument identically regardless of origin.

This is the fundamental architectural guarantee.

---

## 3. Architectural Principles

### Separation of Concerns

| Engine | Sole Responsibility |
|--------|-------------------|
| Adapter | Translates source data to ImportDocument |
| Validation Engine | Validates data against business rules |
| Mapping Engine | Maps normalized values to domain model fields |
| Preview Engine | Generates a user-facing diff/preview of the intended changes |
| Commit Engine | Writes validated, mapped data to the database |

**No engine may perform another engine's responsibility.** An adapter must not validate. A validator must not map. A mapper must not write. A previewer must not commit.

### Single Responsibility Enforcement

- An adapter receives raw source data and produces an ImportDocument. It knows nothing about delivery business rules, Prisma models, or database schemas.
- The Validation Engine receives an ImportDocument and produces an enriched ImportDocument with validation results. It knows nothing about CSV column indices, Excel cell references, or API response formats.
- The Mapping Engine receives a validated ImportDocument and produces an enriched ImportDocument with mapped domain values. It does not run validation rules.
- The Preview Engine receives a mapped ImportDocument and produces an enriched ImportDocument with preview information. It does not execute database writes.
- The Commit Engine receives a fully processed ImportDocument and writes to the database. It does not validate, map, or generate previews.

### Data Flow Rules

1. **Unidirectional flow.** Data flows strictly from Adapter → Validation → Mapping → Preview → Commit. No engine may call back to a previous stage.
2. **Enrichment, not replacement.** Each engine enriches the ImportDocument by adding its own state. No engine removes, replaces, or overwrites data written by a previous stage.
3. **Diagnostics are append-only.** Every engine appends diagnostics to the document's diagnostic collection. No engine may delete, modify, or suppress diagnostics from a prior stage.
4. **Original data is sacred.** The original values extracted by the adapter are immutable. No engine may modify original values under any circumstances. If a value needs transformation, the transformed value is written to a separate field.
5. **Fail-safe progression.** If a stage cannot process a row, it marks the row with an appropriate diagnostic and continues. Only fatal errors halt the pipeline.
6. **Source agnosticism.** Every engine after the adapter layer must operate identically regardless of whether the data originated from CSV, Excel, Shopify, SAP, or any other source. Testing a downstream engine with data from one adapter is sufficient to guarantee correctness for all adapters.

---

## 4. ImportDocument Specification

The ImportDocument is the top-level container. Below is the specification of every top-level property.

### 4.1 `documentId`

| Attribute | Value |
|-----------|-------|
| Purpose | Unique identifier for this import operation |
| Ownership | Created by the adapter at document creation time |
| Mutability | Immutable after creation |
| Lifecycle | Persists from creation through commit |

A UUID assigned when the adapter creates the document. Used for tracing, logging, idempotency, and correlating the document across pipeline stages.

### 4.2 `version`

| Attribute | Value |
|-----------|-------|
| Purpose | Contract version this document conforms to |
| Ownership | Set by the adapter based on the contract version it implements |
| Mutability | Immutable |
| Lifecycle | Set at creation, never modified |

A semantic version string (e.g., `"1.0"`). Downstream engines check this version to confirm compatibility. Enables forward evolution of the contract without breaking existing adapters.

### 4.3 `source`

| Attribute | Value |
|-----------|-------|
| Purpose | Describes where the data came from |
| Ownership | Created by the adapter |
| Mutability | Immutable after creation |
| Lifecycle | Set at creation, never modified |

Contains:
- **sourceType**: The type of the data source (e.g., `csv`, `excel`, `shopify`, `woocommerce`, `sap`, `oracle`, `rest_api`).
- **sourceIdentifier**: A human-readable identifier for the specific source (e.g., filename, API endpoint, webhook event ID).
- **sourceMetadata**: An adapter-specific metadata bag. For CSV, this might include detected delimiter, BOM, line endings. For Shopify, this might include shop domain and webhook topic. No downstream engine reads this — it exists solely for diagnostics and debugging.

### 4.4 `adapter`

| Attribute | Value |
|-----------|-------|
| Purpose | Identifies which adapter produced this document |
| Ownership | Set by the adapter |
| Mutability | Immutable |
| Lifecycle | Set at creation, never modified |

Contains:
- **adapterName**: The registered name of the adapter (e.g., `csv-adapter`, `excel-adapter`, `shopify-adapter`).
- **adapterVersion**: The version of the adapter that produced this document.

### 4.5 `headers`

| Attribute | Value |
|-----------|-------|
| Purpose | The canonical column definitions for this import |
| Ownership | Created by the adapter |
| Mutability | Immutable after creation |
| Lifecycle | Set at creation, referenced by all downstream engines |

An ordered collection of header entries. Each entry contains:
- **index**: Position in the source (zero-based).
- **original**: The header as it appeared in the source (for CSV: the raw cell; for APIs: the JSON key; for Excel: the cell content).
- **normalized**: A cleaned, deterministic key derived from the original. Used as the canonical key for all row value lookups.
- **wasBlank**: Whether the header was absent or empty in the source.
- **wasDuplicate**: Whether the header required de-duplication.

Headers define the schema of the document. Every row references headers by normalized name. No downstream engine modifies headers.

### 4.6 `rows`

| Attribute | Value |
|-----------|-------|
| Purpose | The data rows of the import |
| Ownership | Created by the adapter, enriched by downstream engines |
| Mutability | Rows themselves are immutable; engines add enrichment fields alongside |
| Lifecycle | Created at adapter stage, enriched through pipeline, consumed at commit |

An ordered collection of ImportRow objects (see Section 5).

### 4.7 `diagnostics`

| Attribute | Value |
|-----------|-------|
| Purpose | Document-level diagnostic messages from all pipeline stages |
| Ownership | Append-only; every engine contributes |
| Mutability | Append-only |
| Lifecycle | Grows through every stage; never shrinks |

A collection of diagnostic entries. Diagnostics may be document-level (e.g., "BOM detected") or row-level (e.g., "Row 5 has column mismatch"). See Section 8 for the diagnostics model.

### 4.8 `statistics`

| Attribute | Value |
|-----------|-------|
| Purpose | Aggregate counters and metrics |
| Ownership | Created by the adapter, extended by downstream engines |
| Mutability | Each engine adds its own statistics section |
| Lifecycle | Grows through the pipeline |

Contains subsections keyed by stage:
- **adapter**: Row count, malformed count, blank rows skipped, parse time.
- **validation**: Valid count, invalid count, warning count, validation time.
- **mapping**: Mapped count, unmapped count, mapping time.
- **preview**: New records, updates, deletes, no-change count.
- **commit**: Inserted count, updated count, failed count, commit time.

Each engine writes only to its own subsection and never modifies another engine's statistics.

### 4.9 `timestamps`

| Attribute | Value |
|-----------|-------|
| Purpose | Track when each pipeline stage processed the document |
| Ownership | Each engine records its own timestamp |
| Mutability | Append-only |
| Lifecycle | Grows through the pipeline |

Contains:
- **createdAt**: When the adapter created the document.
- **validatedAt**: When validation completed.
- **mappedAt**: When mapping completed.
- **previewedAt**: When preview was generated.
- **committedAt**: When commit completed.

### 4.10 `processingState`

| Attribute | Value |
|-----------|-------|
| Purpose | The current pipeline stage of the document |
| Ownership | Updated by each engine upon completion |
| Mutability | Transitions forward only |
| Lifecycle | Progresses: `parsed` → `validated` → `mapped` → `previewed` → `committed` |

A string enum representing the furthest completed stage. Used to prevent out-of-order processing (e.g., the Commit Engine rejects a document in `parsed` state). State transitions are strictly forward; a document never regresses.

### 4.11 `tenant`

| Attribute | Value |
|-----------|-------|
| Purpose | Identifies which tenant/organization this import belongs to |
| Ownership | Set at document creation based on the authenticated user context |
| Mutability | Immutable |
| Lifecycle | Set at creation, used at commit for data isolation |

Contains the tenant identifier. Required for multi-tenant isolation. The Commit Engine uses this to scope database writes. No engine except Commit should use this for data access decisions.

---

## 5. ImportRow Specification

Each ImportRow represents a single record from the source data. The row model is designed to carry data through every pipeline stage without mutation of prior stages' output.

### 5.1 `rowId`

A unique identifier within the document (typically the row's ordinal position or a generated UUID). Used for correlating diagnostics, validation results, and commit outcomes back to specific rows.

### 5.2 `sourceRowNumber`

The 1-based row number from the original source. For CSV/Excel this is the line number. For APIs this may be the array index + 1. Immutable. Used in diagnostic messages and error reports for user-facing reference.

### 5.3 `originalValues`

A map of normalized header name → raw string value as extracted by the adapter. **Immutable after creation.** No engine may modify this map. If the adapter extracted `"  Alice  "` (with whitespace), this value remains `"  Alice  "` forever.

This is the audit trail. It allows any stage to reference what was actually in the source file.

### 5.4 `normalizedValues`

A map of normalized header name → cleaned string value. The adapter produces this by applying source-appropriate cleaning (e.g., trimming whitespace for CSV, stripping HTML tags for web sources). **Immutable after adapter stage.** Downstream engines read this but never write to it.

### 5.5 `rowDiagnostics`

Diagnostics specific to this row, accumulated across all pipeline stages. Append-only. Each diagnostic carries a `stage` field identifying which engine produced it. See Section 8.

### 5.6 `validationState`

Written exclusively by the Validation Engine. Contains:
- **status**: `valid`, `invalid`, or `skipped`.
- **fieldResults**: A map of normalized header name → validation result for that field. Each field result contains the rules that passed, the rules that failed, and associated messages.
- **isCritical**: Whether any critical validation error was found (prevents commit).

This section does not exist when the document leaves the adapter. The Validation Engine creates it.

### 5.7 `mappingState`

Written exclusively by the Mapping Engine. Contains:
- **status**: `mapped`, `partially_mapped`, `unmapped`, or `skipped`.
- **mappedEntity**: The target domain entity type (e.g., `delivery`, `driver`, `truck`).
- **mappedValues**: A map of domain field name → mapped value. These are the values that will be written to the database if commit proceeds.
- **unmappedFields**: A list of source fields that had no mapping rule.

This section does not exist until the Mapping Engine processes the document.

### 5.8 `previewState`

Written exclusively by the Preview Engine. Contains:
- **action**: `create`, `update`, `delete`, `skip`, or `no_change`.
- **matchedRecordId**: If updating an existing record, the ID of the matched record.
- **fieldDiffs**: For updates, a list of field-level diffs (old value, new value).
- **userDecision**: Placeholder for user approval/rejection during interactive preview.

This section does not exist until the Preview Engine processes the document.

### 5.9 `commitState`

Written exclusively by the Commit Engine. Contains:
- **status**: `committed`, `failed`, or `skipped`.
- **recordId**: The database ID of the created/updated record (null if failed).
- **error**: Error message if commit failed for this row.

This section does not exist until the Commit Engine processes the document.

### 5.10 `isMalformed`

A boolean set by the adapter indicating whether the row had structural issues (e.g., wrong column count). Immutable after adapter stage. Downstream engines may use this to decide whether to process the row.

---

## 6. Lifecycle

The ImportDocument progresses through a strict lifecycle. Each stage enriches the document and advances its processing state.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ADAPTER STAGE                                                      │
│  ─────────────                                                      │
│  Input:  Raw source data (CSV string, Excel buffer, API payload)    │
│  Output: ImportDocument with processingState = "parsed"             │
│                                                                     │
│  Creates:  documentId, version, source, adapter, headers, rows,     │
│            diagnostics (adapter-level), statistics.adapter,          │
│            timestamps.createdAt, processingState, tenant             │
│  Rows contain: rowId, sourceRowNumber, originalValues,              │
│                normalizedValues, rowDiagnostics, isMalformed         │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  VALIDATION STAGE                                                   │
│  ────────────────                                                   │
│  Input:  ImportDocument (processingState = "parsed")                │
│  Output: ImportDocument (processingState = "validated")             │
│                                                                     │
│  Adds to each row:  validationState                                 │
│  Appends:           diagnostics (validation-level)                  │
│  Creates:           statistics.validation                           │
│  Sets:              timestamps.validatedAt                          │
│                                                                     │
│  Does NOT modify:   originalValues, normalizedValues, headers,      │
│                     source, adapter, or adapter diagnostics          │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  MAPPING STAGE                                                      │
│  ─────────────                                                      │
│  Input:  ImportDocument (processingState = "validated")             │
│  Output: ImportDocument (processingState = "mapped")                │
│                                                                     │
│  Adds to each row:  mappingState                                    │
│  Appends:           diagnostics (mapping-level)                     │
│  Creates:           statistics.mapping                              │
│  Sets:              timestamps.mappedAt                             │
│                                                                     │
│  Does NOT modify:   originalValues, normalizedValues, headers,      │
│                     validationState, or any prior stage data         │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  PREVIEW STAGE                                                      │
│  ─────────────                                                      │
│  Input:  ImportDocument (processingState = "mapped")                │
│  Output: ImportDocument (processingState = "previewed")             │
│                                                                     │
│  Adds to each row:  previewState                                    │
│  Appends:           diagnostics (preview-level)                     │
│  Creates:           statistics.preview                              │
│  Sets:              timestamps.previewedAt                          │
│                                                                     │
│  Does NOT modify:   originalValues, normalizedValues, headers,      │
│                     validationState, mappingState, or any prior data │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  COMMIT STAGE                                                       │
│  ────────────                                                       │
│  Input:  ImportDocument (processingState = "previewed")             │
│  Output: ImportDocument (processingState = "committed")             │
│                                                                     │
│  Adds to each row:  commitState                                     │
│  Appends:           diagnostics (commit-level)                      │
│  Creates:           statistics.commit                               │
│  Sets:              timestamps.committedAt                          │
│                                                                     │
│  Reads:             mappingState.mappedValues for database writes    │
│  Reads:             previewState.action to determine operation       │
│  Reads:             tenant for data isolation                        │
│                                                                     │
│  Does NOT modify:   Any prior stage data                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Lifecycle Guarantees

1. The document is created once and enriched through each stage.
2. No stage creates a new document — the same document instance flows through the entire pipeline.
3. Each stage must verify the `processingState` before operating. If the state is not the expected input state, the engine must reject the document with a diagnostic.
4. The document is never serialized to disk between stages during a single import operation. It lives in memory.
5. If the pipeline is interrupted (e.g., user cancels after preview), the document can be persisted in its current state and resumed later.

---

## 7. Immutability Rules

### Fully Immutable After Creation (by Adapter)

These fields are set by the adapter and **must never be modified** by any downstream engine:

| Field | Reason |
|-------|--------|
| `documentId` | Identity must be stable for tracing |
| `version` | Contract version is fixed at creation |
| `source` | The origin of the data does not change |
| `adapter` | The adapter that produced the document does not change |
| `headers` | Column definitions are fixed by the source structure |
| `tenant` | Tenant identity does not change mid-pipeline |
| `row.rowId` | Row identity must be stable |
| `row.sourceRowNumber` | Source position does not change |
| `row.originalValues` | **The most critical immutability rule.** Original data is the audit trail. It must survive the entire pipeline untouched. |
| `row.normalizedValues` | Adapter-produced normalized values are the input to all downstream engines. If they changed, validation/mapping results would be inconsistent. |
| `row.isMalformed` | Structural assessment by the adapter is final |

### Append-Only

These fields grow but never shrink:

| Field | Rule |
|-------|------|
| `diagnostics` | Every engine appends, none removes |
| `row.rowDiagnostics` | Every engine appends to each row's diagnostics |
| `statistics` | Each engine adds its own subsection; prior subsections are not modified |
| `timestamps` | Each engine records its own timestamp; prior timestamps are not modified |

### Engine-Exclusive Write Fields

Each engine has exclusive write access to its own state section. No other engine may read-for-write or modify these sections:

| Section | Exclusive Owner |
|---------|----------------|
| `row.validationState` | Validation Engine |
| `row.mappingState` | Mapping Engine |
| `row.previewState` | Preview Engine |
| `row.commitState` | Commit Engine |

### Forward-Only State

| Field | Rule |
|-------|------|
| `processingState` | May only transition forward: `parsed` → `validated` → `mapped` → `previewed` → `committed`. No regression. |

---

## 8. Diagnostics Model

### Structure

Every diagnostic entry contains:

| Field | Description |
|-------|-------------|
| `severity` | One of: `info`, `warning`, `error`, `fatal` |
| `code` | A machine-readable error code (e.g., `CSV_BLANK_HEADER`, `VAL_REQUIRED_FIELD_MISSING`, `MAP_NO_RULE_FOUND`) |
| `message` | A human-readable description |
| `stage` | Which pipeline stage produced this diagnostic (e.g., `adapter`, `validation`, `mapping`, `preview`, `commit`) |
| `row` | Optional. The 1-based source row number this diagnostic relates to |
| `column` | Optional. The normalized header name this diagnostic relates to |
| `field` | Optional. The domain model field name (for mapping/commit diagnostics) |
| `timestamp` | When the diagnostic was created |

### Severity Levels

| Severity | Meaning | Pipeline Impact |
|----------|---------|-----------------|
| `info` | Informational observation. No action required. | Pipeline continues |
| `warning` | Potential issue detected. Data may be imprecise but is processable. | Pipeline continues; flagged for user review |
| `error` | Row-level problem. The specific row cannot be committed. | Row is excluded from commit; pipeline continues for other rows |
| `fatal` | Document-level failure. The entire import cannot proceed. | Pipeline halts |

### Code Namespacing

Diagnostic codes are prefixed by stage to prevent collisions:

| Prefix | Stage |
|--------|-------|
| `CSV_` | CSV Adapter |
| `XLS_` | Excel Adapter |
| `SHP_` | Shopify Adapter |
| `WOO_` | WooCommerce Adapter |
| `SAP_` | SAP Adapter |
| `ORA_` | Oracle Adapter |
| `API_` | Generic REST API Adapter |
| `VAL_` | Validation Engine |
| `MAP_` | Mapping Engine |
| `PRV_` | Preview Engine |
| `CMT_` | Commit Engine |

### Accumulation Rules

1. Diagnostics are never deleted, filtered, or suppressed by downstream engines.
2. If a downstream engine disagrees with a prior diagnostic, it appends its own diagnostic with appropriate context — it does not remove the prior one.
3. The final diagnostic collection on a committed document is a complete audit trail of every observation made during the entire pipeline.
4. Document-level diagnostics live in `ImportDocument.diagnostics`. Row-level diagnostics live in `ImportRow.rowDiagnostics` and are also duplicated in the document-level collection for aggregate querying.

---

## 9. Versioning Strategy

### Contract Versioning

The ImportDocument carries a `version` field conforming to major.minor semantics:

- **Major version increment**: Breaking changes to the contract. Existing adapters and engines must be updated. Examples: removing a required field, changing the shape of `ImportRow`, renaming `processingState` values.
- **Minor version increment**: Additive, backwards-compatible changes. Existing adapters continue to work. Examples: adding a new optional field to `ImportRow`, adding a new diagnostic code, adding a new `processingState` value at the end.

### Compatibility Rules

1. **Downstream engines must tolerate missing optional fields.** If an adapter built against v1.0 produces a document without a field added in v1.1, the engine must handle its absence gracefully.
2. **Adapters must declare their contract version.** The `version` field on the document tells downstream engines which contract generation to expect.
3. **Engines must reject incompatible major versions.** If the Validation Engine supports contract v1.x and receives a v2.0 document, it must fail with a clear diagnostic.
4. **Version migration utilities may be provided** to convert a v1.x document to v2.x format, but this is an explicit step — never implicit.

### Deprecation Process

1. A field or behavior is marked as deprecated in the contract documentation.
2. For at least one minor version, the deprecated element continues to work.
3. The next major version removes the deprecated element.
4. All adapters and engines are updated before the major version is released.

---

## 10. Future Extension Points

### Adapter Integration Pattern

Every new data source follows the same integration pattern:

1. **Create an adapter module** that translates the source format to ImportDocument.
2. **Register the adapter** in the adapter registry with a unique `sourceType` identifier.
3. **Write adapter-specific tests** that verify the adapter produces valid ImportDocuments.
4. **Zero changes to downstream engines.** The Validation, Mapping, Preview, and Commit engines remain untouched.

### Planned Adapter Extensions

| Adapter | Source Format | Translation Strategy |
|---------|--------------|---------------------|
| **CSV Adapter** ✅ | Comma/semicolon/tab/pipe-delimited text files | Parse lines, detect delimiter, normalize headers, extract row values |
| **Excel Adapter** | `.xlsx` / `.xls` workbooks | Read specified sheet, extract header row, iterate data rows, map cells to string values |
| **Shopify Adapter** | Shopify Admin REST/GraphQL API payloads, webhooks | Map JSON objects to flat row format using a field mapping configuration |
| **WooCommerce Adapter** | WooCommerce REST API payloads | Map JSON objects to flat row format using a field mapping configuration |
| **SAP Adapter** | SAP IDoc flat files, RFC function module outputs | Parse fixed-width or IDoc segment structure, map segments to rows |
| **Oracle Adapter** | Oracle database query results, flat extracts | Map result set columns to headers, iterate rows |
| **REST API Adapter** | Generic JSON/XML REST API responses | Configurable JSONPath/XPath extraction to flat row format |
| **Message Queue Adapter** | RabbitMQ/Kafka/SQS messages | Deserialize message payload, map to flat row format per message or batch |

### Why Downstream Engines Never Change

The ImportDocument is the stable contract boundary. All source-specific complexity is encapsulated inside the adapter. The downstream engines see only:

- A list of headers with normalized names.
- A list of rows with original and normalized values keyed by those names.
- Diagnostics about what happened during translation.

Whether the original data was a semicolon-delimited CSV with BOM encoding or a Shopify GraphQL response with nested line items is entirely invisible to the Validation Engine. This is the fundamental architectural guarantee that makes the system extensible without regression risk.

---

## 11. Engineering Rules

These rules are **non-negotiable** for all code within the Data Ingestion Platform.

### Data Integrity

1. **Never mutate original values.** The `originalValues` map on each row is the ground truth. No engine, utility, transformation, or migration may modify it.
2. **Never lose uploaded data.** If a user uploads a 50,000-row file, all 50,000 rows must be represented in the ImportDocument (even if some are marked invalid).
3. **Never silently drop rows.** If a row is excluded from processing, it must remain in the document with appropriate diagnostics explaining why.
4. **Never delete diagnostics.** Diagnostics are an append-only audit trail. Filtering for display purposes is acceptable; deletion from the document is not.

### Isolation

5. **Never expose Prisma models above the Commit Engine.** Adapters, Validation, Mapping, and Preview operate entirely on ImportDocument types. Prisma types are confined to the Commit Engine and database access layers.
6. **Never import adapter-specific types in downstream engines.** The Validation Engine must not import from `lib/import/csv/`. It imports only from the ImportDocument contract types.
7. **Never reference database schemas in adapters.** An adapter does not know what tables exist. It produces a source-agnostic document.

### Pipeline Discipline

8. **Never skip validation.** Every import must pass through the Validation Engine, even if the data appears clean. Validation is a mandatory pipeline stage.
9. **Never bypass the pipeline.** Direct database writes from adapters, CSV-to-Prisma shortcuts, or "fast import" paths that skip engines are forbidden.
10. **Never process out of order.** The Mapping Engine must not accept a document with `processingState = "parsed"`. Each engine enforces its required input state.

### Code Quality

11. **Every engine must be independently testable.** An engine must accept an ImportDocument (or a subset) as input and produce an enriched ImportDocument as output. No engine may require a running database, live API connection, or file system access for its core logic.
12. **Every adapter must have a conformance test suite.** A set of tests that verify the adapter produces valid ImportDocuments for representative inputs, including edge cases and error conditions.
13. **Diagnostics must be actionable.** Every diagnostic message must tell the user what happened, where it happened (row/column), and what they can do about it. Generic messages like "an error occurred" are unacceptable.

---

## 12. Dependency Rules

### Allowed Dependencies

```
Adapters ──────────► ImportDocument Contract Types
                            │
Validation Engine ──────────┤
                            │
Mapping Engine ─────────────┤
                            │
Preview Engine ─────────────┤
                            │
Commit Engine ──────────────┤
                            │
                            ▼
                    (Each engine depends ONLY
                     on ImportDocument types)
```

### Forbidden Dependencies

| From | May NOT depend on |
|------|--------------------|
| Validation Engine | Any adapter module (csv, excel, shopify, etc.) |
| Mapping Engine | Any adapter module, Validation Engine internals |
| Preview Engine | Any adapter module, Validation Engine internals, Mapping Engine internals |
| Commit Engine | Any adapter module, Validation/Mapping/Preview internals |
| Any adapter | Validation, Mapping, Preview, or Commit engines |
| Any adapter | Prisma client or database models |
| Validation/Mapping/Preview | Prisma client or database models |

### Allowed Cross-Engine Reads

While engines have exclusive write access to their own state sections, downstream engines may **read** (but not modify) prior engines' output:

| Engine | May Read |
|--------|----------|
| Mapping Engine | `row.validationState.status` (to skip invalid rows) |
| Preview Engine | `row.mappingState.mappedValues` (to generate diffs) |
| Commit Engine | `row.mappingState.mappedValues`, `row.previewState.action`, `row.previewState.userDecision` |

### No Circular Dependencies

The dependency graph is strictly a DAG (Directed Acyclic Graph). If engine A depends on engine B's output, engine B must not depend on engine A's output.

---

## 13. Folder Structure Recommendations

```
lib/
└── import/
    ├── contract/                    ← ImportDocument contract types
    │   ├── types.ts                 ← ImportDocument, ImportRow, Diagnostic, etc.
    │   ├── constants.ts             ← Processing states, severity levels
    │   ├── guards.ts                ← Type guards and state assertions
    │   └── index.ts                 ← Barrel export
    │
    ├── adapters/                    ← All source adapters
    │   ├── csv/                     ← CSV adapter (existing, to be refactored)
    │   │   ├── parser.ts
    │   │   ├── detector.ts
    │   │   ├── normalizer.ts
    │   │   ├── security.ts
    │   │   ├── adapter.ts           ← Translates ImportParseResult → ImportDocument
    │   │   ├── __tests__/
    │   │   └── index.ts
    │   ├── excel/                   ← Future
    │   ├── shopify/                 ← Future
    │   └── registry.ts              ← Adapter registry
    │
    ├── validation/                  ← Validation Engine
    │   ├── engine.ts
    │   ├── rules/
    │   ├── __tests__/
    │   └── index.ts
    │
    ├── mapping/                     ← Mapping Engine
    │   ├── engine.ts
    │   ├── profiles/
    │   ├── __tests__/
    │   └── index.ts
    │
    ├── preview/                     ← Preview Engine
    │   ├── engine.ts
    │   ├── differ.ts
    │   ├── __tests__/
    │   └── index.ts
    │
    └── commit/                      ← Commit Engine
        ├── engine.ts
        ├── __tests__/
        └── index.ts
```

### Notes

- The existing `lib/import/csv/` module remains as-is. When the adapter layer is built, a thin `adapter.ts` file will be added that converts the CSV parser's `ImportParseResult` to the canonical `ImportDocument`. The core parsing logic does not change.
- `lib/import/contract/` is the shared dependency. Every adapter and every engine imports from here and only here for document-related types.
- Each engine directory is self-contained with its own tests, following the pattern established by the CSV parsing engine.

---

## 14. Architectural Decision Log

### ADR-001: Single Document Contract vs. Per-Engine Interfaces

**Decision**: One `ImportDocument` type flows through the entire pipeline.

**Alternatives considered**:
- Per-engine interfaces (e.g., `ValidationInput`, `MappingInput`, `PreviewInput`). Each engine defines its own input/output contract.
- Rejected because: It fragments the data model, requiring transformation between stages. Each transformation is a potential data loss point. A single enrichable document is simpler, more auditable, and eliminates inter-stage translation.

**Tradeoffs**: The ImportDocument type grows larger as more engines add their sections. This is acceptable because each section is optional (created only by its owning engine) and the alternative (N separate types with transformation functions) is worse.

### ADR-002: Enrichment Model vs. Transformation Model

**Decision**: Engines enrich the existing document rather than transforming it into a new shape.

**Alternatives considered**:
- Functional transformation: each engine returns a new type (e.g., `ValidatedDocument`, `MappedDocument`).
- Rejected because: While type-safe, it creates a proliferation of types and requires copying all prior data into the new shape. Enrichment preserves the original data structure and adds new fields alongside existing ones.

**Tradeoffs**: Less compile-time type safety for stage transitions. Mitigated by `processingState` runtime checks and type guard functions.

### ADR-003: String Values vs. Typed Values in Rows

**Decision**: All row values in `originalValues` and `normalizedValues` are strings. Typed values (numbers, dates, booleans) appear only in `mappingState.mappedValues`.

**Alternatives considered**:
- Adapters produce typed values (parse numbers, dates during adaptation).
- Rejected because: Type parsing is a business decision, not a structural one. The CSV value `"100"` might be a weight in kilograms, a count, or a price — the adapter cannot know. The Mapping Engine applies the appropriate type conversion based on the mapping profile.

**Tradeoffs**: Downstream engines must handle string-to-type conversion. This is intentional — it centralizes type parsing in the Mapping Engine where business context is available.

### ADR-004: Diagnostics as Append-Only Log

**Decision**: Diagnostics accumulate through the pipeline and are never deleted.

**Alternatives considered**:
- Allow downstream engines to resolve/dismiss prior diagnostics (e.g., validation could dismiss an adapter warning if the data passes validation).
- Rejected because: Diagnostic deletion creates ambiguity. If a user reviews the import and sees only commit-stage diagnostics, they lose visibility into adapter-level issues. The full diagnostic history is an audit trail.

**Tradeoffs**: The diagnostic array can become large for big imports. This is acceptable; diagnostics can be filtered by stage/severity for display purposes.

### ADR-005: CSV Adapter Wraps Existing Parser

**Decision**: The existing `parseCsv()` function remains unchanged. A thin `CsvAdapter` wrapper translates `ImportParseResult` to `ImportDocument`.

**Alternatives considered**:
- Rewrite the CSV parser to output ImportDocument directly.
- Rejected because: The parser is complete, tested (45/45), and production-ready. Rewriting it introduces regression risk with zero functional benefit. The adapter wrapper is ~50 lines of straightforward translation.

**Tradeoffs**: One extra translation step. Negligible performance cost.

### ADR-006: Forward-Only Processing State

**Decision**: `processingState` can only transition forward (parsed → validated → mapped → previewed → committed).

**Alternatives considered**:
- Allow re-validation (e.g., user edits data in preview, document goes back to `parsed`).
- Rejected because: Backward state transitions invalidate all downstream stage results. If a document regresses from `mapped` to `parsed`, the existing `validationState` and `mappingState` on each row are stale. It is simpler and safer to create a new ImportDocument for re-imports.

**Tradeoffs**: Re-imports require creating a new document from scratch. This is acceptable and safer than partial re-processing.

---

## 15. Definition of Done

The Import Document Contract is complete when:

- [ ] This specification document exists in the repository at `docs/architecture/import_document_contract.md`.
- [ ] The specification has been reviewed and approved by the engineering lead.
- [ ] `PROJECT_STATE.md` references this document.
- [ ] Every future sprint implementation prompt includes a directive to read this document before writing code.
- [ ] The contract types (when eventually implemented in Sprint 3+) conform exactly to this specification.
- [ ] No implementation code has been written as part of this architecture task — this is a specification only.

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **ImportDocument** | The canonical in-memory data structure flowing through the ingestion pipeline |
| **ImportRow** | A single record within an ImportDocument |
| **Adapter** | A module that translates source-specific data into an ImportDocument |
| **Engine** | A pipeline stage that enriches the ImportDocument (Validation, Mapping, Preview, Commit) |
| **Diagnostic** | An observation, warning, error, or fatal message produced during processing |
| **Processing State** | The current pipeline stage of an ImportDocument |
| **Contract Version** | The version of this specification that an ImportDocument conforms to |
| **DIPA** | Data Ingestion Platform Architecture — the umbrella name for LoadFlow's import system |
| **Adapter Registry** | A runtime registry mapping source types to their adapter implementations |
| **Mapping Profile** | A configuration defining how normalized values map to domain model fields |
