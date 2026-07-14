# PROJECT_STATE.md

## 1. Project Overview

LoadFlow is an enterprise logistics SaaS platform for managing deliveries, drivers, trucks, and load optimization. Built with Next.js 16, Prisma, Supabase, and TypeScript. The application supports multi-tenant operations with authentication, CRUD for core entities, and intelligent load planning.

---

## 2. Current Sprint

**Sprint 11 — Review Import Workflow** ✅ COMPLETE

---

## 3. Overall Progress

| Status | Sprint |
|--------|--------|
| ✅ Complete | Sprint 1 — Database Foundation & Core Application |
| ✅ Complete | Sprint 2 — Enterprise CSV Parsing Engine |
| ✅ Complete | Sprint 3 — Validation Engine |
| ✅ Complete | Sprint 4 — Mapping Engine |
| ✅ Complete | Sprint 5 — Preview Engine |
| ✅ Complete | Sprint 6 — Commit Engine |
| ✅ Complete | Sprint 7 — Full CSV Import Pipeline |
| ✅ Complete | Sprint 8 — CSV Upload UI & API Routes |
| ✅ Complete | Sprint 9 — Import History |
| ✅ Complete | Sprint 10 — Import Details |
| ✅ Complete | Sprint 11 — Review Import Workflow |
| ⬜ Next | Sprint 12 — TBD |

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
- ✅ Preview Engine
- ✅ Commit Engine
- ✅ CSV Import (full pipeline)
- ✅ CSV Upload API Route
- ✅ CSV Import UI Page
- ✅ Import History API & UI
- ✅ Import Details API & UI
- ✅ Review Import Workflow (Preview UI + Commit API)
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

### Commit Engine (`lib/import/commit/`)

| File | Purpose |
|------|---------|
| `types.ts` | PrismaTransactionClient interface, CommitProfile, RowCommitResult, CommitEngineResult. |
| `constants.ts` | COMMIT_CODES diagnostic constants, DELIVERY_FIELD_MAP. |
| `persistence.ts` | Database write operations: create/update Delivery, persist ImportRow, update ImportJob. |
| `engine.ts` | Core engine: commitDocument(). Atomic transaction with full rollback on failure. |
| `index.ts` | Barrel export. |
| `__tests__/commit.test.ts` | 19 tests: create, update, skip, rollback, ImportJob, statistics, diagnostics, integration. |

### Import Pipeline (`lib/import/pipeline/`)

| File | Purpose |
|------|---------|
| `types.ts` | PipelineConfig, ImportPipelineResult, PipelineStageTiming. |
| `constants.ts` | PIPELINE_CODES diagnostic constants, PIPELINE_STAGES ordering. |
| `engine.ts` | Core orchestrator: importCsv(). Executes all stages in sequence with failure handling. |
| `index.ts` | Barrel export. |
| `__tests__/pipeline.test.ts` | 15 tests: full pipeline, parse failures, validation halt, commit rollback, update flow, duplicates, diagnostics. |

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
2. Sprint 12 objective: TBD.
3. The pipeline supports `stopAfterPreview` for two-step import workflow.
4. The upload API is at `app/api/import/csv/route.ts` (preview-only mode).
5. The commit API is at `app/api/import/commit/route.ts`.
6. The history API is at `app/api/import/history/route.ts`.
7. The detail API is at `app/api/import/history/[id]/route.ts`.
8. The Import page is at `app/(dashboard)/import/page.tsx`.
9. The Import History page is at `app/(dashboard)/import/history/page.tsx`.
10. The Import Detail page is at `app/(dashboard)/import/history/[id]/page.tsx`.
11. Do NOT modify previously completed engines unless a bug is found.
12. Update this file before ending the session.

---

## 11. Git Status

| Field | Value |
|-------|-------|
| Current Branch | `develop` |
| Feature Branch | `feature/review-import` (merged) |
| Merge Status | ✅ Merged into develop, pushed to origin |

---

## 12. Sprint Summary

### Sprint 11 — Completed
- Two-step import workflow: Upload → Preview → Review → Confirm → Commit → History.
- Pipeline `stopAfterPreview` option added to `PipelineConfig`.
- CSV upload API now stops after preview, saves ImportRows, sets ImportJob to READY_FOR_REVIEW.
- New Commit API: `POST /api/import/commit` accepts importJobId, runs full pipeline with commit.
- ImportReviewClient: summary cards (8 metrics), expandable row preview table, commit controls.
- CsvImportClient updated: upload triggers preview, then shows review UI.
- Button label changed from "Import Deliveries" to "Preview Import".
- After commit, navigates to Import Details page.
- Cancel/Back returns to upload form.
- 173 existing tests still passing — zero regressions.
- Production build verified (33 routes).
- Prisma schema validated.

### Intentionally Left for Future Sprints
- Retry / rollback actions
- Background job processing
- Excel support
- Driver Web App
