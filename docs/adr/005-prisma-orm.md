# ADR-005: Prisma as ORM

**Status:** Accepted  
**Date:** 2026-05-01  
**Context:** Initial project setup

## Decision

Use Prisma as the database ORM with PostgreSQL (Supabase).

## Context

Alternatives considered: Drizzle ORM, Kysely, raw SQL with `pg`.

## Rationale

- **Type safety:** Prisma generates TypeScript types from the schema, preventing field name typos and type mismatches at compile time.
- **Schema management:** `prisma db push` and migrations provide a single source of truth for database structure.
- **Supabase integration:** Prisma works well with Supabase PostgreSQL via pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connections.
- **Ecosystem:** Prisma has mature documentation, active maintenance, and widespread Next.js adoption.
- **Relational queries:** Prisma's `include` and `select` syntax handles eager loading without manual JOIN management.

## Tradeoffs

- **Decimal handling:** Prisma returns `Decimal(12,4)` as `Prisma.Decimal` objects, not native numbers. The application uses a `toNumber()` helper to convert.
- **Raw SQL for RLS:** Prisma cannot manage RLS policies natively. RLS setup is done via raw SQL in `prisma/rls/`.
- **Transaction API:** Prisma's `$transaction()` requires callbacks, which can be verbose compared to raw SQL `BEGIN/COMMIT`.

## Consequences

- All database interactions go through Prisma. No raw SQL is used in application code (only in RLS setup scripts).
- Schema changes require `npx prisma generate` to regenerate the client.
- Prisma's query engine adds ~2-3ms overhead per query, acceptable for this application's scale.
