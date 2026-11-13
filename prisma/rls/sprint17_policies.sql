-- ─── Sprint 17: DDL + RLS for Customer Visibility & Shipment Tracking ───────
-- Idempotent migration + RLS policy script for:
--   1. tracking_link_status (enum)
--   2. tracking_event_type (enum)
--   3. shipment_tracking_links (table)
--   4. delivery_tracking_events (table)

DO $$ BEGIN
  CREATE TYPE tracking_link_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
END $$;

CREATE TABLE IF NOT EXISTS shipment_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
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
);

CREATE INDEX IF NOT EXISTS shipment_tracking_links_company_delivery_status_idx
  ON shipment_tracking_links (company_id, delivery_id, status);
CREATE INDEX IF NOT EXISTS shipment_tracking_links_delivery_created_idx
  ON shipment_tracking_links (delivery_id, created_at);
CREATE INDEX IF NOT EXISTS shipment_tracking_links_company_status_idx
  ON shipment_tracking_links (company_id, status);

CREATE TABLE IF NOT EXISTS delivery_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  event_type tracking_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_label TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  customer_visible BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS delivery_tracking_events_company_delivery_occurred_idx
  ON delivery_tracking_events (company_id, delivery_id, occurred_at);
CREATE INDEX IF NOT EXISTS delivery_tracking_events_delivery_visible_occurred_idx
  ON delivery_tracking_events (delivery_id, customer_visible, occurred_at);

ALTER TABLE shipment_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON shipment_tracking_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_tracking_events TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation" ON shipment_tracking_links;
CREATE POLICY "tenant_isolation"
  ON shipment_tracking_links FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "tenant_isolation" ON delivery_tracking_events;
CREATE POLICY "tenant_isolation"
  ON delivery_tracking_events FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
