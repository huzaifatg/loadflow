# ADR-004: Pure Business Logic Separation

**Status:** Accepted  
**Date:** 2026-07-22  
**Context:** Sprint 13.1 — Recommendation Engine Architecture

## Decision

Business logic engines (recommendation, import pipeline, delivery item weight calculation) are implemented as pure functions in `lib/` with zero React or Next.js dependencies.

## Context

The recommendation engine and import pipeline could have been implemented directly inside API route handlers. Instead, they were extracted into separate modules.

## Rationale

- **Testability:** Pure functions can be tested with Node.js test runner (`node:test`) without mocking Next.js, React, or Prisma. The recommendation engine has 26 tests that run in <25ms.
- **Portability:** The `generateRecommendation()` function accepts a plain TypeScript input object and returns a plain output object. It can be used from any context — API routes, server components, CLI scripts, or future microservices.
- **Separation of concerns:** API routes handle auth, data fetching, and HTTP semantics. Engines handle computation. This keeps both layers simple.
- **Replaceability:** The engine interface acts as a contract. A future ML model can implement the same input/output contract without changing the API or UI.

## Consequences

- Data transformation happens in the API route (Prisma models → engine types → JSON response). This adds a mapping layer but keeps the engine decoupled from the ORM.
- The engine cannot optimize its own data fetching. If the engine needs new data, the API route must be updated to provide it.
