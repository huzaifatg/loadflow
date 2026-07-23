-- ════════════════════════════════════════════════════════════════════════════
-- LoadFlow — Row Level Security Policies (Version-Controlled)
-- ════════════════════════════════════════════════════════════════════════════
--
-- STATUS: PREPARED — NOT YET ACTIVE
--
-- These policies are version-controlled and ready for activation when
-- the connection architecture supports a non-superuser database role.
--
-- IMPORTANT: Under the current architecture (Prisma + pgBouncer + postgres
-- superuser role), these policies will NOT be enforced even if applied,
-- because PostgreSQL superusers bypass RLS entirely.
--
-- To activate these policies, you must:
--   1. Create a dedicated non-superuser role (see README.md)
--   2. Grant appropriate table permissions to the new role
--   3. Update DATABASE_URL to use the new role
--   4. Run this SQL file against the database
--
-- DESIGN PRINCIPLES:
--   - Every tenant-scoped table has RLS enabled
--   - Every policy filters by company_id using the JWT claim
--   - Child tables (delivery_items, load_plan_items, import_rows) inherit
--     security from their parent via JOIN-based policies
--   - The companies table itself allows users to read only companies they
--     belong to (via company_members)
--
-- ════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  Helper: Extract company_id from the authenticated user's JWT claims  │
-- │  Supabase injects the user's ID into the JWT as `sub`.                │
-- │  We look up the user's company membership to resolve their company.   │
-- └─────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION auth.user_company_id()
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


-- ════════════════════════════════════════════════════════════════════════════
-- COMPANIES
-- Users can only see companies they are a member of.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id = auth.user_company_id());

CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  USING (id = auth.user_company_id())
  WITH CHECK (id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- COMPANY_MEMBERS
-- Users can only see memberships in their own company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their company"
  ON company_members FOR SELECT
  USING (company_id = auth.user_company_id());

-- INSERT restricted to company owners (future role-based feature)
CREATE POLICY "Users can read their own membership"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- TRUCKS
-- Full CRUD scoped to the user's company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: trucks"
  ON trucks FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- DRIVERS
-- Full CRUD scoped to the user's company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: drivers"
  ON drivers FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- DELIVERIES
-- Full CRUD scoped to the user's company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: deliveries"
  ON deliveries FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- DELIVERY_ITEMS
-- Child of deliveries. Access granted if the parent delivery belongs to
-- the user's company. No direct company_id column on this table.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: delivery_items (via parent)"
  ON delivery_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_items.delivery_id
        AND deliveries.company_id = auth.user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.id = delivery_items.delivery_id
        AND deliveries.company_id = auth.user_company_id()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- LOAD_PLANS
-- Full CRUD scoped to the user's company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE load_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: load_plans"
  ON load_plans FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- LOAD_PLAN_ITEMS
-- Child of load_plans. Access granted if the parent load_plan belongs to
-- the user's company. No direct company_id column on this table.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE load_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: load_plan_items (via parent)"
  ON load_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM load_plans
      WHERE load_plans.id = load_plan_items.load_plan_id
        AND load_plans.company_id = auth.user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM load_plans
      WHERE load_plans.id = load_plan_items.load_plan_id
        AND load_plans.company_id = auth.user_company_id()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- IMPORT_JOBS
-- Full CRUD scoped to the user's company.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: import_jobs"
  ON import_jobs FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());


-- ════════════════════════════════════════════════════════════════════════════
-- IMPORT_ROWS
-- Child of import_jobs. Access granted if the parent import_job belongs to
-- the user's company. No direct company_id column on this table.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation: import_rows (via parent)"
  ON import_rows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = import_rows.import_job_id
        AND import_jobs.company_id = auth.user_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = import_rows.import_job_id
        AND import_jobs.company_id = auth.user_company_id()
    )
  );
