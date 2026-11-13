// ─── Safe Database Schema Synchronization Script ────────────────────────────
// Applies idempotent Sprint 16 & Sprint 17 DDL and RLS policies over the
// working DATABASE_URL connection (bypassing unreachable IPv6 DIRECT_URL),
// without dropping any tables or modifying existing data.

import { prisma } from '../lib/prisma'
import { listActivityForEntity } from '../lib/services/activity'

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: 'Create table public.activity_events',
    sql: `
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
      )
    `,
  },
  {
    label: 'Migrate legacy column names on public.activity_events if present',
    sql: `
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
      END $$
    `,
  },
  {
    label: 'Create entity index on public.activity_events',
    sql: `
      CREATE INDEX IF NOT EXISTS activity_events_company_entity_idx
        ON public.activity_events (company_id, entity_type, entity_id, created_at)
    `,
  },
  {
    label: 'Create created_at index on public.activity_events',
    sql: `
      CREATE INDEX IF NOT EXISTS activity_events_company_created_idx
        ON public.activity_events (company_id, created_at)
    `,
  },
  {
    label: 'Create table public.saved_views',
    sql: `
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
      )
    `,
  },
  {
    label: 'Create index on public.saved_views',
    sql: `
      CREATE INDEX IF NOT EXISTS saved_views_company_user_workspace_idx
        ON public.saved_views (company_id, user_id, workspace)
    `,
  },
  {
    label: 'Create table public.notification_states',
    sql: `
      CREATE TABLE IF NOT EXISTS public.notification_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (company_id, user_id)
      )
    `,
  },
  {
    label: 'Enable RLS and apply policies on Sprint 16 tables',
    sql: `
      DO $$
      BEGIN
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
      END $$
    `,
  },
  {
    label: 'Create Sprint 17 enum tracking_link_status',
    sql: `
      DO $$ BEGIN
        CREATE TYPE tracking_link_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    label: 'Create Sprint 17 enum tracking_event_type',
    sql: `
      DO $$ BEGIN
        CREATE TYPE tracking_event_type AS ENUM (
          'DELIVERY_CREATED',
          'DELIVERY_ASSIGNED',
          'DISPATCHED',
          'IN_TRANSIT',
          'ARRIVED_AT_DESTINATION',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'DELIVERY_CANCELLED',
          'DELAY_NOTICE',
          'MANUAL_UPDATE'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `,
  },
  {
    label: 'Create table public.shipment_tracking_links',
    sql: `
      CREATE TABLE IF NOT EXISTS public.shipment_tracking_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        token_ciphertext TEXT,
        token_preview TEXT NOT NULL,
        status tracking_link_status NOT NULL DEFAULT 'ACTIVE',
        estimated_delivery_at TIMESTAMPTZ,
        created_by_user_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        last_accessed_at TIMESTAMPTZ
      )
    `,
  },
  {
    label: 'Create indexes on public.shipment_tracking_links',
    sql: `
      DO $$
      BEGIN
        CREATE INDEX IF NOT EXISTS shipment_tracking_links_company_delivery_status_idx
          ON public.shipment_tracking_links (company_id, delivery_id, status);
        CREATE INDEX IF NOT EXISTS shipment_tracking_links_delivery_created_idx
          ON public.shipment_tracking_links (delivery_id, created_at);
        CREATE INDEX IF NOT EXISTS shipment_tracking_links_company_status_idx
          ON public.shipment_tracking_links (company_id, status);
      END $$
    `,
  },
  {
    label: 'Create table public.delivery_tracking_events',
    sql: `
      CREATE TABLE IF NOT EXISTS public.delivery_tracking_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
        event_type tracking_event_type NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location_label TEXT,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by_user_id UUID,
        customer_visible BOOLEAN NOT NULL DEFAULT true
      )
    `,
  },
  {
    label: 'Create indexes on public.delivery_tracking_events',
    sql: `
      DO $$
      BEGIN
        CREATE INDEX IF NOT EXISTS delivery_tracking_events_company_delivery_occurred_idx
          ON public.delivery_tracking_events (company_id, delivery_id, occurred_at);
        CREATE INDEX IF NOT EXISTS delivery_tracking_events_delivery_visible_occurred_idx
          ON public.delivery_tracking_events (delivery_id, customer_visible, occurred_at);
      END $$
    `,
  },
  {
    label: 'Enable RLS and apply policies on Sprint 17 tables',
    sql: `
      DO $$
      BEGIN
        ALTER TABLE public.shipment_tracking_links ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;

        GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_tracking_links TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tracking_events TO authenticated;

        DROP POLICY IF EXISTS "tenant_isolation" ON public.shipment_tracking_links;
        CREATE POLICY "tenant_isolation"
          ON public.shipment_tracking_links FOR ALL
          TO authenticated
          USING (company_id = public.get_user_company_id())
          WITH CHECK (company_id = public.get_user_company_id());

        DROP POLICY IF EXISTS "tenant_isolation" ON public.delivery_tracking_events;
        CREATE POLICY "tenant_isolation"
          ON public.delivery_tracking_events FOR ALL
          TO authenticated
          USING (company_id = public.get_user_company_id())
          WITH CHECK (company_id = public.get_user_company_id());
      END $$
    `,
  },
]

async function main() {
  // Inspect safe connection metadata (host & port only — never print credentials)
  const dbUrl = process.env.DATABASE_URL || ''
  const directUrl = process.env.DIRECT_URL || ''
  const parseHostPort = (raw: string) => {
    try {
      const u = new URL(raw)
      return `${u.hostname}:${u.port || '5432'} (params: ${u.search || 'none'})`
    } catch {
      return 'unparseable'
    }
  }

  console.log('=== Database Connection Inspection (Redacted) ===')
  console.log('DATABASE_URL target :', parseHostPort(dbUrl))
  console.log('DIRECT_URL target   :', parseHostPort(directUrl))

  for (const step of STATEMENTS) {
    process.stdout.write(`Applying: ${step.label} ... `)
    await prisma.$executeRawUnsafe(step.sql)
    console.log('OK')
  }

  // Verify tables and columns in information_schema
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'activity_events',
        'saved_views',
        'notification_states',
        'shipment_tracking_links',
        'delivery_tracking_events'
      )
    ORDER BY table_name
  `)
  console.log('\nVerified public tables:', tables.map((t) => t.table_name).join(', '))

  const activityCols = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events'
    ORDER BY ordinal_position
  `)
  console.log(
    'Verified activity_events columns:',
    activityCols.map((c) => `${c.column_name} (${c.data_type})`).join(', ')
  )

  const policies = await prisma.$queryRawUnsafe<{ tablename: string; policyname: string }[]>(`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'activity_events',
        'saved_views',
        'notification_states',
        'shipment_tracking_links',
        'delivery_tracking_events'
      )
    ORDER BY tablename, policyname
  `)
  console.log(
    'Verified RLS policies:',
    policies.map((p) => `${p.tablename}.${p.policyname}`).join(', ')
  )

  // Verify listActivityForEntity() executes cleanly via Prisma client without any error
  const sampleDelivery = await prisma.delivery.findFirst({
    select: { id: true, companyId: true },
  })
  const testCompanyId = sampleDelivery?.companyId ?? '00000000-0000-4000-8000-000000000000'
  const testDeliveryId = sampleDelivery?.id ?? '00000000-0000-4000-8000-000000000000'

  const events = await listActivityForEntity(prisma, testCompanyId, 'DELIVERY', testDeliveryId)
  console.log(
    `Verified listActivityForEntity() call succeeded cleanly (returned ${events.length} events).`
  )
}

main()
  .catch((err) => {
    console.error('Schema sync failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
