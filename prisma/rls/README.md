# Row Level Security — Architecture & Operations

## Status: **ACTIVE ✓**

Database-enforced tenant isolation is enabled on all application tables. RLS policies are actively enforced whenever the application operates within an authenticated context.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Application                                            │
│                                                                 │
│  getAuthContext() → userId                                      │
│       │                                                         │
│       ▼                                                         │
│  withRLS(userId, async (tx) => { ... })                        │
│       │                                                         │
│       ├── set_config('request.jwt.claim.sub', userId, true)    │
│       ├── SET LOCAL ROLE authenticated                          │
│       │   (transaction-scoped, auto-resets on commit/rollback)  │
│       │                                                         │
│       ▼                                                         │
│  PostgreSQL evaluates RLS policies                              │
│       │                                                         │
│       ├── auth.uid() → userId (from JWT claim)                 │
│       ├── public.get_user_company_id() → companyId             │
│       │   (resolves via company_members table)                  │
│       │                                                         │
│       ▼                                                         │
│  Only rows matching the user's company are returned/modified    │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Roles

| Role | `rolbypassrls` | Used For |
|------|---------------|----------|
| `postgres` | `true` | Default Prisma connection, migrations, management |
| `authenticated` | `false` | RLS-enforced operations via `SET LOCAL ROLE` |

### How It Works

1. **Prisma connects as `postgres`** — this role has `BYPASSRLS = true`, so direct queries bypass RLS. This is intentional for management operations and migrations.

2. **For tenant-scoped operations**, the application calls `withRLS(userId, fn)` which:
   - Opens a Prisma `$transaction`
   - Sets `request.jwt.claim.sub` to the user's Supabase auth ID
   - Switches to `SET LOCAL ROLE authenticated` (transaction-scoped)
   - Executes the provided function within the RLS-enforced context
   - On commit/rollback, the role automatically resets to `postgres`

3. **`auth.uid()`** reads from the `request.jwt.claim.sub` session variable, returning the current user's UUID.

4. **`public.get_user_company_id()`** looks up the user's company from `company_members` using `auth.uid()`.

5. **RLS policies** filter all rows by `company_id = public.get_user_company_id()`.

## Security Layers

The application implements defense-in-depth with TWO layers of tenant isolation:

1. **Application-level** (Sprint 12): `getAuthContext()` + `companyId` filtering in every Prisma query
2. **Database-level** (this migration): RLS policies enforced by PostgreSQL when using `withRLS()`

## Tables & Policies

| Table | RLS | Policy Strategy |
|-------|-----|-----------------|
| `companies` | ✓ Enabled | `id = get_user_company_id()` |
| `company_members` | ✓ Enabled | `company_id = get_user_company_id() OR user_id = auth.uid()` |
| `trucks` | ✓ Enabled | `company_id = get_user_company_id()` |
| `drivers` | ✓ Enabled | `company_id = get_user_company_id()` |
| `deliveries` | ✓ Enabled | `company_id = get_user_company_id()` |
| `delivery_items` | ✓ Enabled | JOIN via `deliveries.company_id` |
| `load_plans` | ✓ Enabled | `company_id = get_user_company_id()` |
| `load_plan_items` | ✓ Enabled | JOIN via `load_plans.company_id` |
| `import_jobs` | ✓ Enabled | `company_id = get_user_company_id()` |
| `import_rows` | ✓ Enabled | JOIN via `import_jobs.company_id` |

## Connection Configuration

```env
# Transaction-mode pooler (port 6543) — used for Prisma runtime queries
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (port 5432) — used for migrations and schema operations
DIRECT_URL="postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres"
```

## Files

- **`prisma/rls/policies.sql`** — Complete RLS migration (function, grants, policies)
- **`prisma/rls/README.md`** — This document
- **`lib/rls.ts`** — `withRLS()` helper for RLS-enforced Prisma transactions

## Rollback

To disable RLS (emergency only):

```sql
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE trucks DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE load_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE load_plan_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows DISABLE ROW LEVEL SECURITY;
```
