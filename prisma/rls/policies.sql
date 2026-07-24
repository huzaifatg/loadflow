-- ════════════════════════════════════════════════════════════════════════════
-- LoadFlow — Row Level Security: Database Migration
-- ════════════════════════════════════════════════════════════════════════════
--
-- This migration:
--   1. Creates the public.get_user_company_id() helper function
--   2. Enables RLS on all application tables
--   3. Creates tenant-isolation policies
--
-- ARCHITECTURE:
--   Prisma connects as the `postgres` role (BYPASSRLS = true).
--   For RLS enforcement, the application uses SET LOCAL ROLE authenticated
--   within transactions, after setting request.jwt.claim.sub via set_config.
--   This causes auth.uid() to return the current user's ID, and the
--   `authenticated` role (BYPASSRLS = false) enforces RLS policies.
--
-- ════════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  1. Helper Function: public.get_user_company_id()                     │
-- │     Resolves the authenticated user's company_id from company_members. │
-- │     Uses auth.uid() which reads from request.jwt.claim.sub.           │
-- │     Placed in `public` schema because Supabase restricts `auth`.      │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM company_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO anon;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  2. Grant table permissions to authenticated role                      │
-- │     The authenticated role needs access to all application tables.     │
-- └─────────────────────────────────────────────────────────────────────────┘

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure future tables/sequences are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  3. Enable RLS on all application tables                               │
-- └─────────────────────────────────────────────────────────────────────────┘

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  4. RLS Policies                                                       │
-- │     Every tenant-scoped table gets a policy filtering by company_id.   │
-- │     Child tables use JOIN-based policies via their parent.             │
-- └─────────────────────────────────────────────────────────────────────────┘

-- ── COMPANIES ────────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation_select"
  ON companies FOR SELECT
  TO authenticated
  USING (id = public.get_user_company_id());

CREATE POLICY "tenant_isolation_update"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- Allow INSERT for auto-provisioning (new user signup creates a company)
CREATE POLICY "tenant_isolation_insert"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ── COMPANY_MEMBERS ──────────────────────────────────────────────────────

-- SELECT: can see own company's members OR own membership (for initial lookup)
CREATE POLICY "tenant_isolation_select"
  ON company_members FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id() OR user_id = auth.uid());

-- INSERT: allowed for auto-provisioning during signup
CREATE POLICY "tenant_isolation_insert"
  ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "tenant_isolation_update"
  ON company_members FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant_isolation_delete"
  ON company_members FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id());


-- ── TRUCKS ───────────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON trucks FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());


-- ── DRIVERS ──────────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON drivers FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());


-- ── DELIVERIES ───────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON deliveries FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());


-- ── DELIVERY_ITEMS (child of deliveries) ─────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON delivery_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_items.delivery_id
        AND deliveries.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_items.delivery_id
        AND deliveries.company_id = public.get_user_company_id()
    )
  );


-- ── LOAD_PLANS ───────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON load_plans FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());


-- ── LOAD_PLAN_ITEMS (child of load_plans) ────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON load_plan_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM load_plans
      WHERE load_plans.id = load_plan_items.load_plan_id
        AND load_plans.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM load_plans
      WHERE load_plans.id = load_plan_items.load_plan_id
        AND load_plans.company_id = public.get_user_company_id()
    )
  );


-- ── IMPORT_JOBS ──────────────────────────────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON import_jobs FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());


-- ── IMPORT_ROWS (child of import_jobs) ───────────────────────────────────

CREATE POLICY "tenant_isolation"
  ON import_rows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = import_rows.import_job_id
        AND import_jobs.company_id = public.get_user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = import_rows.import_job_id
        AND import_jobs.company_id = public.get_user_company_id()
    )
  );
