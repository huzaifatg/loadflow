# Row Level Security — Migration Guide

## Current Status: **PREPARED (NOT ACTIVE)**

The policies in `policies.sql` are version-controlled and ready for activation. They are **not currently enforced** because the application connects to the database as the PostgreSQL `postgres` superuser (via Supabase's pgBouncer connection pooler), and PostgreSQL superusers bypass all RLS policies by design.

## Current Security Model

Application-level tenant isolation is enforced through:

1. **Centralized authentication** via `getAuthContext()` in `lib/auth.ts`
2. **Centralized security utilities** in `lib/security/` (UUID validation, ownership assertion, standardized responses)
3. **Mandatory `companyId` filtering** on every database query
4. **Defense-in-depth `companyId`** in all `UPDATE` and `DELETE` `WHERE` clauses
5. **UUID validation** on all externally-supplied identifiers

This provides strong production-grade tenant isolation appropriate for the current architecture, while true database-enforced RLS remains the long-term goal.

## Prerequisites for RLS Activation

To enforce RLS, the following architectural changes are required:

### 1. Create a Non-Superuser Role

Connect to the database via the Supabase SQL Editor and execute:

```sql
-- Create a dedicated application role
CREATE ROLE loadflow_app LOGIN PASSWORD 'your-secure-password';

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO loadflow_app;

-- Grant table-level access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO loadflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO loadflow_app;

-- Ensure future tables are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO loadflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO loadflow_app;
```

### 2. Update Connection Strings

Update `DATABASE_URL` and `DIRECT_URL` in `.env` (and Vercel environment variables) to use the new role instead of the `postgres` superuser.

> **Note:** Supabase's pgBouncer pooler only supports the `postgres` role at the time of writing. You may need to use a direct connection string or a self-managed connection pooler for the non-superuser role.

### 3. Apply RLS Policies

Execute `policies.sql` against the database:

```bash
psql "$DIRECT_URL" -f prisma/rls/policies.sql
```

### 4. Verify

- Confirm that all application queries still succeed through the new role.
- Confirm that a user in Company A cannot see data from Company B.
- Confirm that the application-level `companyId` filtering and the database-level RLS policies agree on access.

## Policy Design

| Table | Strategy | Scope |
|-------|----------|-------|
| `companies` | Direct: `id = auth.user_company_id()` | SELECT, UPDATE |
| `company_members` | Direct: `company_id = auth.user_company_id()` | SELECT |
| `trucks` | Direct: `company_id = auth.user_company_id()` | ALL |
| `drivers` | Direct: `company_id = auth.user_company_id()` | ALL |
| `deliveries` | Direct: `company_id = auth.user_company_id()` | ALL |
| `delivery_items` | Join-based: via `deliveries.company_id` | ALL |
| `load_plans` | Direct: `company_id = auth.user_company_id()` | ALL |
| `load_plan_items` | Join-based: via `load_plans.company_id` | ALL |
| `import_jobs` | Direct: `company_id = auth.user_company_id()` | ALL |
| `import_rows` | Join-based: via `import_jobs.company_id` | ALL |

### `auth.user_company_id()` Function

A `SECURITY DEFINER` function that resolves the authenticated user's `company_id` from the `company_members` table using the Supabase JWT claim `auth.uid()`.

## Files

- **`policies.sql`** — Complete RLS policy definitions for all tables
- **`README.md`** — This migration guide
