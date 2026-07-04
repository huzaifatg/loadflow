# PROJECT_STATE.md

## 1. Project Overview

LoadFlow is an enterprise logistics SaaS platform for managing deliveries, drivers, trucks, and load optimization. Built with Next.js 16, Prisma, Supabase, and TypeScript. The application supports multi-tenant operations with authentication, CRUD for core entities, and intelligent load planning.

---

## 2. Current Sprint

**Sprint 5 — Preview Engine** ✅ COMPLETE

---

## 3. Overall Progress

| Status | Sprint |
|--------|--------|
| ✅ Complete | Sprint 1 — Database Foundation & Core Application |
| ✅ Complete | Sprint 2 — Enterprise CSV Parsing Engine |
| ✅ Complete | Sprint 3 — Validation Engine |
| ✅ Complete | Sprint 4 — Mapping Engine |
| ✅ Complete | Sprint 5 — Preview Engine |
| ⬜ Next | Sprint 6 — Commit Engine |

---

## 4. Architecture Status

- ✅ Database Foundation (Prisma + Supabase)
- ✅ Authentication & Middleware
- ✅ Core CRUD (Deliveries, Drivers, Trucks, Loads)
- ✅ Load Optimization Engine
- ✅ Enterprise CSV Parsing Engine
- ✅ Import Document Contract (architecture specification)
- ✅ Import Document Contract (code implementation)
- ✅ CSV Adapter
- ✅ Validation Engine
- ✅ Mapping Engine
- ⬜ Preview Engine
- ⬜ Commit Engine
- ⬜ CSV Import (full pipeline)
- ⬜ Driver Web App

---

## 5. Major Files & Modules

### CSV Parsing Engine (`lib/import/csv/`)

| File | Purpose |
|------|---------|
| `types.ts` | All parser types: `ImportParseResult`, `ParsedRow`, `CsvParseOptions`, etc. Independent of Prisma. |
| `constants.ts` | Parser constants: BOM, max file size, candidate delimiters, formula injection chars. |
| `errors.ts` | Error classes (`CsvParseError`, `CsvFatalError`, `CsvRowError`) and error codes. |
| `security.ts` | Formula injection detection, binary content detection, file size validation. |
| `detector.ts` | Auto-detect delimiter, BOM, line endings. Quote-aware delimiter scoring. |
| `normalizer.ts` | Header normalization, de-duplication, synthetic name assignment for blank columns. |
| `parser.ts` | Core parser. Orchestrates detection → splitting → normalization → row parsing. Single public entry: `parseCsv()`. |
| `index.ts` | Barrel export. Public API surface for all consumers. |
| `__tests__/parser.test.ts` | 45 comprehensive unit tests covering all modules. Uses Node's built-in test runner. |

### Architecture (`docs/architecture/`)

| File | Purpose |
|------|---------|
| `import_document_contract.md` | Canonical specification for the ImportDocument contract. |

### Import Contract (`lib/import/contract/`)

| File | Purpose |
|------|---------|
| `types.ts` | ImportDocument, ImportRow, ImportDiagnostic, all pipeline state types. |
| `constants.ts` | CONTRACT_VERSION, processing states, severity levels, code prefixes. |
| `guards.ts` | Type guards, state assertions, forward-only transition checks. |
| `index.ts` | Barrel export. |

### CSV Adapter (`lib/import/adapters/csv/`)

| File | Purpose |
|------|---------|
| `adapter.ts` | Translates ImportParseResult → ImportDocument (ADR-005). |
| `index.ts` | Barrel export. |

### Validation Engine (`lib/import/validation/`)

| File | Purpose |
|------|---------|
| `types.ts` | ValidationRule, ValidationProfile, FieldValidationConfig. |
| `engine.ts` | Core engine: validateDocument(). Enriches ImportDocument with validation state. |
| `rules/required.ts` | Required field rule. |
| `rules/integer.ts` | Integer validation with min/max. |
| `rules/decimal.ts` | Decimal validation with precision. |
| `rules/boolean.ts` | Boolean validation (true/false/yes/no/1/0). |
| `rules/enum.ts` | Enum validation with case sensitivity option. |
| `rules/date.ts` | Date validation (ISO 8601, US, EU, compact). |
| `rules/index.ts` | Rule registry with extensibility. |
| `index.ts` | Barrel export. |
| `__tests__/validation.test.ts` | 55 tests: adapter, rules, engine, diagnostics, end-to-end. |

### Mapping Engine (`lib/import/mapping/`)

| File | Purpose |
|------|---------|
| `types.ts` | Domain field, entity, mapping result, and confidence types. |
| `constants.ts` | MAP_CODES, confidence scores, priority rules. |
| `profiles.ts` | Canonical LoadFlow entity definitions (Delivery, Driver, Truck). |
| `matcher.ts` | Resolves header-to-field matching with aliases and overrides. |
| `engine.ts` | Core engine: enriches validated ImportDocument with row mappings. |
| `index.ts` | Barrel export. |
| `__tests__/mapping.test.ts` | 13 tests: matcher scenarios and document mapping validation. |

### Preview Engine (`lib/import/preview/`)

| File | Purpose |
|------|---------|
| `types.ts` | Preview domain types: profiles, row/document summaries, commit impact. |
| `constants.ts` | PREVIEW_CODES diagnostic constants. |
| `diff.ts` | Field-level diff computation with smart equality (string-number coercion). |
| `summaries.ts` | Builds per-row and document-level preview summaries for UI consumption. |
| `engine.ts` | Core engine: previewDocument(). Classifies rows, computes diffs, detects duplicates. |
| `index.ts` | Barrel export. |
| `__tests__/preview.test.ts` | 26 tests: diffs, create/update/skip/no_change, duplicates, summaries, integration. |

---

## 6. Important Architectural Decisions

1. **Parser types are independent of Prisma models.**
2. **Single entry point pattern.** `parseCsv()` and `validateDocument()` are sole public entries.
3. **Diagnostics over exceptions.** Row-level issues produce diagnostics, not throws.
4. **Blank headers are valid.** Normalizer assigns synthetic names.
5. **Formula injection is detected but not mutated.**
6. **Zero dependencies.** Parser and validation use only Node.js built-ins.
7. **Tests use `node:test`.** Run with `npx tsx`.
8. **ImportDocument Contract.** Defined in `docs/architecture/import_document_contract.md`, implemented in `lib/import/contract/`.
9. **CSV Adapter wraps parser (ADR-005).** `parseCsv()` remains unchanged; adapter translates output.
10. **Validation Engine is source-agnostic.** Imports only from `lib/import/contract/`, never from CSV modules.

---

## 7. Technical Debt

- No streaming parser for files exceeding memory limits (currently loads entire string).
- File size check uses `string.length * 2` as approximation; actual byte size would be more accurate.
- No multiline field support across line boundaries (fields with embedded newlines inside quotes).
- CRLF normalization warnings not yet surfaced.

---

## 8. Known Issues

No known issues.

---

## 9. Future Recommendations

- **Streaming parser**: For files >100MB, implement a streaming/chunked parser.
- **Encoding detection**: Add `chardet`-style detection for non-UTF-8 files (Shift-JIS, ISO-8859-1).
- **Multiline quoted fields**: RFC 4180 allows newlines inside quoted fields; current `splitLines` + `parseLineToFields` architecture would need refactoring to support this.
- **Progress callbacks**: For UI integration, add an `onProgress` callback to `CsvParseOptions`.
- **Worker thread support**: Parse large files in a worker thread to avoid blocking the main event loop.

---

## 10. Next Session Instructions

1. Read this file first.
2. Read `docs/architecture/import_document_contract.md` before writing any code.
3. Sprint 6 objective: **Commit Engine**.
4. The Commit Engine consumes a previewed `ImportDocument` (processingState = `previewed`).
5. Implement database persistence using Prisma for approved preview rows.
6. Create `lib/import/commit/` following the same modular architecture.
7. The Commit Engine is the ONLY engine permitted to perform Prisma writes.
8. Write comprehensive tests.
9. Do NOT modify previously completed engines unless a bug is found.
10. Update this file before ending the session.

---

## 11. Git Status

| Field | Value |
|-------|-------|
| Current Branch | `develop` |
| Feature Branch | `feature/preview-engine` (merged) |
| Merge Status | ✅ Merged into develop, pushed to origin |

---

## 12. Sprint Summary

### Sprint 5 — Completed
- Preview Engine Core: consumes mapped documents, classifies rows as create/update/skip/no_change.
- Field-level diff computation with smart equality handling (string-number, null-undefined).
- Duplicate match key detection across import rows.
- Per-row preview summaries with before/after values, changed fields, skip reasons.
- Document-level preview summary with commit impact projection.
- Configurable match key lookup (database-agnostic via RecordLookupFn).
- Ignored fields support for diff exclusion.
- Complete diagnostic trail with PRV_ prefix.
- Comprehensive test suite (26 passing tests).
- 139 total project tests passing (45 + 55 + 13 + 26).
- Production build verified.

### Intentionally Left for Future Sprints
- Commit Engine (Sprint 6)
- Full CSV Import pipeline
- UI components for import
