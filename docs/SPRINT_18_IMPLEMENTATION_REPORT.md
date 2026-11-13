# LoadFlow Sprint 18 Implementation Report — Dispatch Board & Scheduling Intelligence

## 1. Executive Summary

Sprint 18 introduces the **Dispatch Board & Scheduling Intelligence** workspace, transforming LoadFlow into a real-time operational command center for dispatchers. All metrics, availability determinations, scheduling conflict alerts, and readiness states are computed directly from company-scoped PostgreSQL/Prisma records without fabricating operational state.

---

## 2. Implemented Capabilities

### Feature A — Dispatch Board (`app/(dashboard)/dispatch/page.tsx`)
- Dedicated workspace accessible from the primary sidebar (`Dispatch Board`), mobile bottom bar, dashboard urgency strip, and `Ctrl+K` Command Palette.
- **Header & Operating Date Navigation:** Displays selected operating date, daily plan count badge, Previous/Next Day navigation, direct date jumper, `All Active + Date` vs `Date Only` scope toggle, Refresh button, and quick links to the Dispatch Calendar (`/dispatch/calendar`) and New Load Plan (`/loads/new`).
- **6 Company-Scoped KPI Summary Cards:** Pending Deliveries, Unassigned Queue, Ready Load Plans, Dispatched Plans, Overdue Deliveries, and Resource Conflicts.
- **Unassigned Delivery Queue:** Lists pending deliveries requiring allocation sorted by urgency (`OVERDUE` → `DUE_TODAY` → `SCHEDULED` → `UNSCHEDULED`), with origin, destination, weight, and one-click **Assign to Plan** modal (`QuickAllocateDeliveryDialog.tsx`).
- **Load Plan Board:** Groups load plans into `DRAFT`, `READY`, `DISPATCHED`, and `COMPLETED` columns with capacity bars, truck/driver links, readiness badges, conflict alerts, and quick lifecycle actions.
- **Operational Attention & Fleet Availability Panels:** Unified view of scheduling conflicts, operational exceptions, and per-resource availability for the operating date.

### Feature B — Resource Availability Intelligence (`lib/services/dispatch-availability.ts`)
- Pure evaluation functions (`evaluateTruckAvailability`, `evaluateDriverAvailability`) and Prisma-backed loader (`getDispatchAvailability`).
- Evaluates active/inactive state (`MAINTENANCE` trucks, `OFF_DUTY` drivers, `isArchived` flags), existing same-day load-plan commitments, active `DISPATCHED` in-transit commitments, and weight capacity compatibility (`requiredWeight` vs `weightCapacity`).

### Feature C — Scheduling Conflict Detection (`lib/services/dispatch-conflicts.ts`)
- Pure conflict detector (`detectSchedulingConflicts`) and Prisma-backed service (`getDispatchConflicts`).
- Classifies issues into `BLOCKING`, `WARNING`, and `INFO` severities:
  - `BLOCKING`: `TRUCK_CONFLICT` (double-booked or in transit), `DRIVER_CONFLICT` (double-booked or on trip), `CAPACITY_EXCEEDED`, `TRUCK_UNAVAILABLE`, `DRIVER_UNAVAILABLE`, `MISSING_TRUCK`, `INVALID_DELIVERY_STATUS`, and `MISSING_DRIVER` / `EMPTY_LOAD_PLAN` on `READY` or due-today plans.
  - `WARNING`: `DELIVERY_DATE_MISMATCH`, `OVERDUE_DISPATCH`, `OVERDUE_COMPLETION`, and future `DRAFT` plans missing a driver or deliveries.
  - `INFO`: `CANCELLED_DELIVERY_INCLUDED`.

### Feature D — Quick Assignment Workflows (`components/dispatch/QuickAssignResourcesDialog.tsx`)
- Interactive dialog for assigning or changing a load plan's truck and driver directly from the Dispatch Board.
- Loads real-time availability from `GET /api/dispatch/availability`, displays spare capacity or overweight warnings, prevents silent assignment of unavailable/conflicting resources, and uses the authoritative `PATCH /api/loads/[id]` service (safely reverting `READY` plans to `DRAFT` when unlocking for edits, without auto-dispatching).

### Feature E — Dispatch Calendar (`app/(dashboard)/dispatch/calendar/page.tsx`)
- 7-day weekly scheduling grid and selected operating date breakdown at `/dispatch/calendar`.
- Supports Previous/Next Week, Previous/Next Day, and Today navigation, plus status, truck, and driver filters.
- Displays scheduled load plans with readiness badges, conflict indicators, stop counts, payload weights, and unassigned deliveries due on each day.

### Feature F & G — Dispatch Readiness & Lifecycle Quick Actions
- `evaluatePlanDispatchReadiness` computes deterministic readiness states (`READY_TO_DISPATCH`, `READY_TO_LOCK`, `AWAITING_ASSIGNMENT`, `BLOCKED`, `DISPATCHED`, `COMPLETED`) with human-readable blocking reasons and checklist booleans.
- Surfaced across the Dispatch Board, `LoadPlanCard`, Dispatch Calendar, and Load Plan detail page (`/loads/[id]`).
- Quick lifecycle actions (`Mark Ready`, `Dispatch`, `Complete`) use confirmation dialogs and call `PATCH /api/loads/[id]` (`updateLoadPlan`), preserving transactional integrity and `ActivityEvent` / customer tracking logging.

### Feature H & I — Dashboard Integration, Filtering & Search
- Enhanced `app/(dashboard)/dashboard/page.tsx` with blocking resource conflict counts, unassigned delivery counts, and direct links to `/dispatch` and `/dispatch/calendar`.
- Full server-backed filtering on the Dispatch Board by operating date, scope, lifecycle status, readiness/assignment state, truck, driver, conflict state, overdue state, search query (`q`), and Saved Views (`workspace="dispatch"`).

---

## 3. API Endpoints Added

- `GET /api/dispatch/board` — Full Dispatch Board state, summary metrics, unassigned queue, grouped load plans, availability, conflicts, and exceptions.
- `GET /api/dispatch/availability` — Company-scoped truck and driver availability for a target date, optional `excludePlanId`, and `requiredWeight`.
- `GET /api/dispatch/conflicts` — Company-scoped scheduling conflicts and per-plan readiness map.
- `GET /api/dispatch/calendar` — 7-day weekly and daily dispatch schedule with readiness and conflict metadata.

