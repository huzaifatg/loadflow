# Sprint 15 — UI Audit

**Branch:** `feature/sprint-15-product-experience` (from `develop` @ `9414830`)
**Baseline release:** v0.9.0 (`main` @ `a082f25`)

---

## 1. Existing application structure

| Area | Location | Notes |
|------|----------|-------|
| Root layout | `app/layout.tsx` | Inter via `next/font/google`, `sonner` Toaster |
| Auth pages | `app/(auth)/login`, `signup` | Separate layout |
| Dashboard shell | `app/(dashboard)/layout.tsx` → `components/layout/DashboardLayoutShell.tsx` | Server layout resolves user + company, client shell renders Sidebar / Topbar / MobileNav |
| Dashboard pages | `dashboard`, `deliveries(/new,/[id])`, `trucks(/new,/[id])`, `drivers(/new,/[id])`, `loads(/new,/[id],/optimize,/recommend)`, `schedule`, `import(/history,/history/[id])`, `settings`, `guide` | All server components; data fetched with Prisma + `getAuthContext()` |
| UI primitives | `components/ui/*` | Button, Card, Input, Select, Textarea, Modal, DataTable, StatusPill, CapacityBar, EmptyState, PageHeader, PaginationClient, SearchClient, ThemeToggle |
| Feature components | `components/{loads,deliveries,trucks,drivers,import,settings,landing}` | Client components for interactive workflows |
| Styling | Tailwind CSS v4 (`@theme` in `app/globals.css`) | No `tailwind.config` file; tokens are CSS-first |

## 2. Current UI framework / libraries

| Question | Answer |
|----------|--------|
| UI framework | Tailwind CSS v4 + hand-written primitives |
| shadcn/ui | **Not present** |
| Radix UI | **Not present** |
| Icons | `lucide-react` (consistent stroke style — keep) |
| Charts | **None installed** |
| TanStack Query | **Not present** — data is fetched in server components; mutations via `fetch` + `router.refresh()` |
| Toasts | `sonner` |
| Theme | `next-themes` installed; app is effectively light-only |
| Utilities | `clsx` + `tailwind-merge` (`cn`), `date-fns`, `use-debounce` |
| Frontend tests | **None.** Only Node test runner (`tsx --test`) unit tests for `lib/` |

**Decision:** keep the existing stack. No new UI dependencies. Charts are implemented as small, accessible SVG/CSS components fed by real Prisma aggregates — adding a charting library for 3 simple distributions is not justified.

## 3. Design inconsistencies found

1. **Status colours defined in 4 places** — `StatusPill`, dashboard `statusStyles`, `LoadPlanCard.getUtilizationStyle`, load-plan detail `getUtilizationStyle`. READY is blue in one place and amber in another; DISPATCHED is indigo vs blue.
2. **Accent drift** — `primary-*` (indigo), raw `indigo-*`, `violet-*`, and `blue-*` used interchangeably for primary actions.
3. **Buttons hand-rolled** in `LoadPlanActions`, `AllocationPanel`, loads list header, empty states — inconsistent heights/radii.
4. **Native `confirm()`** for Dispatch, Complete and Revert-to-Draft.
5. **Card radii/shadows vary**: `rounded-xl shadow-sm`, `rounded-2xl ring-1`, `rounded-lg border`.
6. **Page titles duplicated** — Topbar shows a title *and* each page renders an `h1` with the same text.
7. **No breadcrumbs**; detail pages have no back-navigation affordance.
8. **Sidebar** is a flat list (no grouping), not collapsible, Recommendations/Optimizer undiscoverable from nav, no company context.
9. **Mobile**: bottom nav duplicates sidebar with a different item subset.
10. **Tables**: no status filters on any list, no date filters, no sorting; Load Plans has no pagination and is a card grid that becomes hard to scan.
11. **Dashboard**: "Completed Rate" KPI uses a positive-trend arrow without historical data (implies a trend that doesn't exist); "Scheduled" column shows `h:mm a` of a date-only field (always 12:00 AM).
12. **Truck capacity fallback**: load plan detail uses `|| 40000` when capacity missing — misleading.
13. **Pagination/Search** styled differently from Inputs.

## 4. API capabilities available to the frontend

| Endpoint | Use |
|----------|-----|
| `GET/POST /api/deliveries`, `GET/PUT/DELETE /api/deliveries/:id` | Delivery CRUD; direct status change limited to `CANCELLED` |
| `GET/POST /api/trucks`, `GET/PUT/DELETE /api/trucks/:id` | Truck CRUD + archive |
| `GET/POST /api/drivers`, `GET/PUT/DELETE /api/drivers/:id` | Driver CRUD + archive |
| `GET/POST /api/loads` | List / create DRAFT plan (response = plan object at root) |
| `GET/PATCH/DELETE /api/loads/:id` | Detail / edit (DRAFT only) / lifecycle transitions; PATCH response = plan + optional `_warnings` |
| `POST /api/loads/optimize` | FFD optimizer |
| `POST /api/recommendations`, `POST /api/recommendations/assign` | Recommendation engine + assignment |
| `/api/import/*` | CSV pipeline |

> [!NOTE]
> `docs/API_REFERENCE.md` (Sprint 14) describes `POST /api/loads` as returning `{ data, warnings, error }`. The actual route returns the plan object at the root and `PATCH` returns `_warnings`. Clients use the actual shape; Sprint 15 does not change these contracts. Documentation correction is listed as follow-up.

Server components query Prisma directly with company scoping, which allows dashboards/lists to use `groupBy`/`count` aggregates without new endpoints.

## 5. Missing capabilities (not faked)

| Capability | Status | Sprint 15 handling |
|-----------|--------|--------------------|
| Activity / audit log | No model | **Omitted** from dashboard — no fabricated history |
| Delivery assignment history | No model (only current `LoadPlanItem`) | Show current assignment only |
| Historical trends | No snapshots | KPIs show current values only; no % change |
| Notifications | No backend | No bell icon |
| Global search endpoint | None | **Add** small read-only, company-scoped `GET /api/search` (≤5 results/type) |
| Truck maintenance records | Only `status` + `notes` | Show status + notes only |
| Per-user roles in UI | `CompanyMember.role` exists | Display only, no RBAC UI |

## 6. Proposed design system

- **Identity:** "Operational cobalt" — dark navy sidebar (`#0b1220`), cool near-white canvas, white panels with hairline borders, a cobalt accent distinct from Linear's violet.
- **Tokens (Tailwind v4 `@theme`):** `primary` 50–950 (cobalt), neutral scale remapped from `gray` to a cool slate-tinted ramp so all existing `gray-*` classes inherit the new neutrals; `indigo`/`violet` remapped to `primary` to eliminate accent drift; semantic `success`/`warning`/`danger`/`info`; `surface`, `canvas`, `border` aliases; radii (`6/8/10/12`), elevation (`xs/sm/md/lg/overlay`), focus ring.
- **Typography:** Inter, tabular numerals for metrics, scale: page title 22/28 semibold, section 15/20 semibold, body 14/20, meta 12/16, eyebrow 11 uppercase tracking.
- **Status system:** single source `lib/ui/status.ts` (label, tone, description) consumed by `StatusBadge`, dashboard charts, lifecycle stepper.
- **Primitives:** Button (+ `ButtonLink`, icon size, `subtle`/`outline`), Badge, StatusBadge, Card (+ header/description/actions), MetricCard, Input/Select/Textarea (hint, required marker), Modal (focus management, footer), ConfirmDialog, DropdownMenu, Tooltip, FilterTabs (URL-driven), Skeleton, EmptyState (link or action), ErrorState, PageHeader (breadcrumbs, eyebrow, meta), Kbd, ProgressBar/CapacityBar, DistributionBar, CommandPalette.

## 7. Implementation sequence

1. Tokens + primitives (15.1)
2. Shell: grouped collapsible sidebar, header with breadcrumbs, user menu, ⌘K command palette, mobile drawer (15.2)
3. Dashboard with real aggregates, exceptions, onboarding checklist (15.3)
4. Load Plans list (table, filters, sorting, pagination), detail (lifecycle stepper, ConfirmDialogs, assignment editor), creation (15.4)
5. Fleet: trucks & drivers lists with status filters + detail polish (15.5)
6. Deliveries list with status/date filters + assignment column (15.6)
7. Recommendations restyle (15.7)
8. Loading/error/empty states, responsive + a11y polish (15.8)
9. Tests, tsc, prisma, build, report (15.9)

