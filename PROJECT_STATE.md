# PROJECT_STATE.md

## 1. Project Overview

LoadFlow is an enterprise logistics SaaS platform for managing deliveries, drivers, trucks, and load optimization. Built with Next.js 16, Prisma, Supabase, and TypeScript. The application supports multi-tenant operations with authentication, CRUD for core entities, and intelligent load planning.

---

## 2. Current Sprint

**Sprint 2 — Enterprise CSV Parsing Engine** ✅ COMPLETE

---

## 3. Overall Progress

| Status | Sprint |
|--------|--------|
| ✅ Complete | Sprint 1 — Database Foundation & Core Application |
| ✅ Complete | Sprint 2 — Enterprise CSV Parsing Engine |
| ⬜ Next | Sprint 3 — Validation Engine |

---

## 4. Architecture Status

- ✅ Database Foundation (Prisma + Supabase)
- ✅ Authentication & Middleware
- ✅ Core CRUD (Deliveries, Drivers, Trucks, Loads)
- ✅ Load Optimization Engine
- ✅ Enterprise CSV Parsing Engine
- ✅ Import Document Contract (architecture specification)
- ⬜ Validation Engine
- ⬜ Mapping Engine
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
| `import_document_contract.md` | Canonical specification for the ImportDocument contract. Defines the universal in-memory document flowing through the entire ingestion pipeline. Every adapter must produce this document; every downstream engine must consume it. |

---

## 6. Important Architectural Decisions

1. **Parser types are independent of Prisma models.** The CSV parser outputs `ImportParseResult`, not database entities. Mapping to Prisma models happens in a separate (future) Mapping Engine.
2. **Single entry point pattern.** `parseCsv()` is the only public function. All internal modules are orchestrated behind it.
3. **Diagnostics over exceptions.** Row-level issues produce diagnostic entries (warnings/errors) instead of throwing. Only truly fatal conditions (empty file, binary file) prevent parsing.
4. **Blank headers are valid.** The normalizer assigns synthetic names (`column_1`, etc.) rather than rejecting the file.
5. **Formula injection is detected but not mutated.** The parser warns about cells starting with formula characters but preserves original data. Sanitization (`sanitizeForExport`) is available as a utility for export scenarios.
6. **Zero dependencies.** The parser uses only Node.js built-ins. No external CSV libraries.
7. **Tests use `node:test`.** Zero test framework dependencies. Run with `npx tsx`.
8. **ImportDocument Contract established.** The canonical data structure for the entire ingestion pipeline is defined in `docs/architecture/import_document_contract.md`. All adapters produce this document; all downstream engines consume it.

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
3. Sprint 3 objective: **Validation Engine**.
4. Before implementing validation, implement the `ImportDocument` contract types in `lib/import/contract/` as defined in the architecture specification.
5. Create a thin CSV Adapter wrapper that translates `ImportParseResult` → `ImportDocument`.
6. The Validation Engine should consume `ImportDocument`, NOT `ImportParseResult` directly.
7. Do NOT modify the CSV parser unless a bug is found during integration.
8. Create `lib/import/validation/` as a new module.
9. Define validation rules (required fields, data types, format constraints).
10. Output an enriched ImportDocument with per-row `validationState`.
11. Write comprehensive tests.
12. Follow the same modular architecture (types → rules → engine → index).
13. Update this file before ending the session.

---

## 11. Git Status

| Field | Value |
|-------|-------|
| Current Branch | `develop` |
| Latest Commit Hash | `2dda75a` |
| Latest Commit Message | `merge: feature/csv-parsing-engine into develop` |
| Feature Branch | `feature/csv-parsing-engine` (merged) |
| Merge Status | ✅ Merged into develop, pushed to origin |

---

## 12. Sprint Summary

### Completed
- Full CSV Parsing Engine: 8 modules, 1 test file, 45 tests
- Auto-detection of delimiters, BOM, line endings
- Header normalization with de-duplication and synthetic names
- RFC 4180 quoted field parsing
- Security: formula injection detection, binary file rejection
- Production build verified

### Changed
- Fixed: `parser.ts` line 93 — removed overly strict all-blank-headers fatal check. The normalizer correctly handles blank headers by assigning synthetic names.

### Intentionally Left for Future Sprints
- Validation Engine (Sprint 3)
- Mapping Engine
- Preview Engine
- Commit Engine
- Full CSV Import pipeline
- UI components for import
