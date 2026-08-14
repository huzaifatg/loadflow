# ADR-003: Company-Scoped Tenant Isolation

**Status:** Accepted  
**Date:** 2026-06-15  
**Context:** Sprint 12 — Security Hardening

## Decision

Tenant isolation is enforced through `companyId` scoping at the application layer, with PostgreSQL Row Level Security as defense-in-depth.

## Context

Multi-tenant SaaS applications must prevent data leakage between tenants. The options considered:

1. **Separate databases per tenant** — strongest isolation, highest operational cost.
2. **Separate schemas per tenant** — good isolation, complex migration management.
3. **Shared schema with row-level filtering** — simplest operations, requires careful query discipline.

## Rationale

- **Operational simplicity:** Supabase provides a single PostgreSQL instance. Schema-per-tenant or DB-per-tenant would require custom infrastructure.
- **Prisma compatibility:** Prisma works best with a single schema. Multi-schema setups require complex workarounds.
- **Defense-in-depth:** Application-layer `companyId` filtering is the primary guard. PostgreSQL RLS policies in `prisma/rls/` serve as a secondary guard against application bugs.
- **Performance:** Composite indexes like `(company_id, is_archived)` ensure filtered queries remain fast.
- **Scalability:** This pattern scales to thousands of tenants without operational changes.

## Implementation

1. Every business model includes `companyId` as a required field.
2. `getAuthContext()` resolves `userId → companyId` on every request.
3. Every Prisma `where` clause includes `companyId`.
4. UUID path parameters are validated with `validatePathId()` before use.
5. RLS policies enforce `company_id = current_setting('app.company_id')` at the database level.

## Consequences

- Developers must remember to include `companyId` in every query. The centralized `getAuthContext()` pattern makes this straightforward.
- Cross-tenant queries (admin dashboards, analytics) require careful RLS policy management.
- A single bad query without `companyId` filtering would be caught by RLS but should never reach production.
