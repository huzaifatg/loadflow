-- ─── Sprint 16: DDL + RLS for operational-efficiency tables ─────────────────
-- Idempotent migration + RLS policy script for:
--   1. activity_events
--   2. saved_views
--   3. notification_states
--
-- Column names strictly match `prisma/schema.prisma`:
--   ActivityEvent: id, company_id, entity_type, entity_id, type, message,
--                  actor_id, actor_label, metadata, created_at

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_id UUID,
  actor_label TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If an earlier draft created `action` / `summary` columns, migrate them safely:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'action'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.activity_events RENAME COLUMN action TO type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'summary'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'message'
  ) THEN
    ALTER TABLE public.activity_events RENAME COLUMN summary TO message;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS activity_events_company_entity_idx
  ON public.activity_events (company_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS activity_events_company_created_idx
  ON public.activity_events (company_id, created_at);

CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workspace TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, workspace, name)
);

CREATE INDEX IF NOT EXISTS saved_views_company_user_workspace_idx
  ON public.saved_views (company_id, user_id, workspace);

CREATE TABLE IF NOT EXISTS public.notification_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_states TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation" ON public.activity_events;
CREATE POLICY "tenant_isolation"
  ON public.activity_events FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "owner_isolation" ON public.saved_views;
CREATE POLICY "owner_isolation"
  ON public.saved_views FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.get_user_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "owner_isolation" ON public.notification_states;
CREATE POLICY "owner_isolation"
  ON public.notification_states FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.get_user_company_id() AND user_id = auth.uid());
