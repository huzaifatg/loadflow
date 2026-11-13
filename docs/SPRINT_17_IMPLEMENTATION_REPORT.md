# LoadFlow — Sprint 17 Implementation Report

## Customer Visibility & Shipment Tracking

**Branch:** `feature/sprint-17-customer-tracking`  
**Base Release:** `v0.11.0` (`2019ae2393f9db575ac1a5b6b97ef0113f9931a5`)  
**Status:** Complete & Verified  

---

## 1. Executive Summary

Sprint 17 introduces a complete, customer-facing **Shipment Tracking System** for LoadFlow. Logistics operators can generate cryptographically secure, shareable tracking links (`/track/{token}`) for any delivery, manage link expiration and customer-facing ETAs, revoke or rotate links immediately, and publish customer-visible milestone updates — while recipients can view live shipment progress, route origin/destination, ETA, and chronological milestones in a dedicated public portal without creating an account or accessing internal workspace data.

---

## 2. Database Schema & RLS Policies

- **Prisma Schema ([`prisma/schema.prisma`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/prisma/schema.prisma)):**
  - `TrackingLinkStatus` enum (`ACTIVE`, `REVOKED`, `EXPIRED`)
  - `TrackingEventType` enum (`DELIVERY_CREATED`, `DELIVERY_ASSIGNED`, `DISPATCHED`, `IN_TRANSIT`, `ARRIVED_AT_DESTINATION`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_CANCELLED`, `DELAY_NOTICE`, `MANUAL_UPDATE`)
  - `ShipmentTrackingLink` (`shipment_tracking_links`): Company-scoped and delivery-scoped tracking link model storing `tokenHash` (`@unique`, SHA-256 digest), `tokenCiphertext` (AES-256-GCM encrypted token for authenticated company display), `tokenPreview`, `status`, `estimatedDeliveryAt`, `expiresAt`, `revokedAt`, and `lastAccessedAt`.
  - `DeliveryTrackingEvent` (`delivery_tracking_events`): Company-scoped and delivery-scoped shipment milestone model with `eventType`, `title`, `description`, `locationLabel`, `occurredAt`, `createdByUserId`, and `customerVisible`.
- **Idempotent DDL + RLS Script ([`prisma/rls/sprint17_policies.sql`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/prisma/rls/sprint17_policies.sql)):**
  - Creates the enums, tables, and composite indexes idempotently (`IF NOT EXISTS`), enables Row-Level Security, and enforces `tenant_isolation` (`company_id = public.get_user_company_id()`).

---

## 3. Feature Implementation Summary

1. **Feature A — Secure Shareable Tracking Links ([`lib/services/tracking.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/lib/services/tracking.ts)):**
   - Generates 192-bit (24-byte) cryptographically random URL-safe tokens via `crypto.randomBytes(24).toString('base64url')`.
   - Stores SHA-256 `tokenHash` for database lookup, verifies tokens using `crypto.timingSafeEqual`, and encrypts tokens at rest with AES-256-GCM (`tokenCiphertext`).
   - Reuses existing active links when `rotate: false` to prevent duplicate active links, and atomically revokes prior links when rotating (`rotate: true`) or revoking (`DELETE /api/deliveries/[id]/tracking`).
2. **Feature B & G — Public Customer Tracking Portal ([`app/track/[token]/page.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/track/[token]/page.tsx), [`app/track/[token]/loading.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/track/[token]/loading.tsx)):**
   - Unauthenticated customer portal (allowed in [`lib/supabase/middleware.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/lib/supabase/middleware.ts)).
   - Displays carrier company branding, customer-safe shipment reference (`SHP-XXXXXXXX` or external order reference), 4-stage delivery progress bar (`Order Received` → `Scheduled & Assigned` → `In Transit` → `Delivered`), dedicated `Cancelled` and `Delivered` states, Origin & Destination cards, ETA / completion timestamp, chronological milestone timeline, cargo summary, and expired/unavailable error states.
3. **Feature C — Public Tracking API ([`app/api/public/tracking/[token]/route.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/api/public/tracking/[token]/route.ts)):**
   - Enforces `Cache-Control: private, no-store, max-age=0, must-revalidate` and `Referrer-Policy: no-referrer`.
   - Returns strictly sanitized `PublicTrackingDTO` that never exposes `companyId`, `deliveryId`, `userId`, driver phone numbers, vehicle plate numbers, or internal dispatcher notes.
4. **Feature D, E & F — Delivery Detail Tracking Controls, Milestones & ETA ([`components/deliveries/CustomerTrackingPanel.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/components/deliveries/CustomerTrackingPanel.tsx), [`app/api/deliveries/[id]/tracking/route.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/api/deliveries/[id]/tracking/route.ts)):**
   - Integrated into [`app/(dashboard)/deliveries/[id]/page.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/(dashboard)/deliveries/[id]/page.tsx).
   - Supports one-click link generation, Copy Link, Open Portal, ETA & Expiration configuration, Link Rotation, Link Revocation, and Manual Milestone creation (with HTML stripping and `customerVisible` toggle).
   - Automatic lifecycle milestones wired into [`lib/services/load-plan-service.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/lib/services/load-plan-service.ts), [`app/api/deliveries/route.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/api/deliveries/route.ts), and [`app/api/deliveries/[id]/route.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/api/deliveries/[id]/route.ts).
5. **Feature H & I — Activity Timeline & Dashboard Integration:**
   - Added `TRACKING_LINK_GENERATED`, `TRACKING_LINK_REVOKED`, `TRACKING_LINK_REGENERATED`, `TRACKING_EXPIRATION_UPDATED`, `DELIVERY_ETA_UPDATED`, and `TRACKING_MILESTONE_ADDED` to [`lib/services/activity.ts`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/lib/services/activity.ts) and [`components/ui/ActivityTimeline.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/components/ui/ActivityTimeline.tsx).
   - Added company-scoped active tracking links count to [`app/(dashboard)/dashboard/page.tsx`](file:///c:/Users/huzai/OneDrive/Desktop/LoadFlow/app/(dashboard)/dashboard/page.tsx).
