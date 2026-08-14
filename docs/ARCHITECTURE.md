# Architecture

## System Overview

LoadFlow is a multi-tenant logistics SaaS application. Each tenant (company) has complete data isolation — a user can only see and modify data belonging to their company.

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser"]
    end

    subgraph "Next.js App Router"
        Pages["Server Components<br/>(Pages)"]
        API["API Route Handlers<br/>/api/*"]
        MW["Middleware<br/>(Auth Redirect)"]
    end

    subgraph "Business Logic Layer"
        Auth["Auth Context<br/>lib/auth.ts"]
        Sec["Security Layer<br/>lib/security/"]
        RecEngine["Recommendation<br/>Engine"]
        ImportPipeline["CSV Import<br/>Pipeline"]
        DeliveryItems["Delivery Item<br/>Weight Calculator"]
    end

    subgraph "Data Layer"
        Prisma["Prisma ORM"]
        RLS["RLS Helpers<br/>lib/rls.ts"]
    end

    subgraph "External Services"
        Supabase["Supabase<br/>(PostgreSQL + Auth)"]
    end

    Browser --> MW --> Pages
    Browser --> API
    Pages --> Auth
    API --> Auth
    Auth --> Sec
    API --> RecEngine
    API --> ImportPipeline
    API --> DeliveryItems
    Auth --> Prisma
    API --> Prisma
    Prisma --> Supabase
    RLS --> Supabase
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant MW as Middleware
    participant SA as Supabase Auth
    participant AC as getAuthContext()
    participant DB as PostgreSQL

    B->>MW: Request /dashboard
    MW->>SA: Check session cookie
    alt No session
        MW-->>B: Redirect → /login
    else Valid session
        MW-->>B: Allow through
    end

    B->>AC: Server component renders
    AC->>SA: supabase.auth.getUser()
    SA-->>AC: User { id, email }
    AC->>DB: Find CompanyMember by userId
    alt Member exists
        DB-->>AC: { company, companyId }
    else First login
        AC->>DB: Create Company + CompanyMember (OWNER)
        DB-->>AC: { company, companyId }
    end
    AC-->>B: AuthContext { userId, email, company, companyId }
```

Every API route and server component calls `getAuthContext()` to:
1. Verify the user has a valid Supabase session
2. Resolve which company the user belongs to
3. Return a `companyId` used to scope all subsequent database queries

## Tenant Isolation

All database queries are scoped by `companyId`. This is enforced at three levels:

1. **Application Layer**: Every Prisma query includes `where: { companyId }` as a mandatory filter.
2. **Security Helpers**: `validatePathId()` ensures path parameters are valid UUIDs. `assertOwnership()` verifies a record belongs to the requesting company.
3. **Database Layer**: PostgreSQL Row Level Security (RLS) policies are defined in `prisma/rls/` as a defense-in-depth measure.

## Module Architecture

### Core Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Auth | `lib/auth.ts` | Session verification, company resolution, auto-provisioning |
| Security | `lib/security/` | UUID validation, tenant ownership assertions, error responses |
| Prisma | `lib/prisma.ts` | Database client singleton |
| RLS | `lib/rls.ts` | Row Level Security query helpers |
| Constants | `lib/constants.ts` | Shared business constants |
| Utils | `lib/utils.ts` | Generic utilities (`cn()` for class names) |
| Types | `types/index.ts` | Shared TypeScript interfaces and enums |

### Business Domain Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Deliveries | `app/api/deliveries/`, `components/deliveries/` | CRUD, status lifecycle, item management |
| Trucks | `app/api/trucks/`, `components/trucks/` | CRUD, status tracking, capacity management |
| Drivers | `app/api/drivers/`, `components/drivers/` | CRUD, availability tracking |
| Load Plans | `app/api/loads/`, `components/loads/` | Plan creation, delivery assignment, dispatch lifecycle |
| Recommendations | `lib/services/recommendation-engine.ts`, `app/api/recommendations/` | Deterministic truck/driver scoring |
| CSV Import | `lib/import/` | Multi-stage import pipeline |
| Delivery Items | `lib/delivery-items.ts` | Item-level weight computation |

### CSV Import Pipeline

The import pipeline processes CSV files through six sequential stages:

```mermaid
graph LR
    CSV["CSV File"] --> Parse["Parse<br/>(csv/)"]
    Parse --> Validate["Validate<br/>(validation/)"]
    Validate --> Map["Map<br/>(mapping/)"]
    Map --> Preview["Preview<br/>(preview/)"]
    Preview --> Commit["Commit<br/>(commit/)"]
    Commit --> DB["Database"]

    style Parse fill:#e8f5e9
    style Validate fill:#fff3e0
    style Map fill:#e3f2fd
    style Preview fill:#f3e5f5
    style Commit fill:#fce4ec
```

Each stage is a pure engine with its own test suite. The orchestrator (`pipeline/engine.ts`) runs them in sequence and produces diagnostics at each stage.

| Stage | Engine | Tests | Purpose |
|-------|--------|-------|---------|
| Parse | `csv/parser.ts` | 100+ rows/sec | Parse CSV text into structured rows |
| Validate | `validation/engine.ts` | Field-level | Validate required fields, types, formats |
| Map | `mapping/engine.ts` | Column matching | Map CSV columns to delivery domain fields |
| Preview | `preview/engine.ts` | Diff engine | Classify rows as create/update/skip with field diffs |
| Commit | `commit/engine.ts` | Transactional | Write to database with rollback support |

### Recommendation Engine

```mermaid
graph TB
    Input["Deliveries + Trucks + Drivers"] --> Engine["generateRecommendation()"]

    subgraph "Scoring Pipeline"
        Engine --> TruckScore["Score Trucks"]
        Engine --> DriverScore["Score Drivers"]

        TruckScore --> CF["Capacity Fit (30%)"]
        TruckScore --> RC["Remaining Cap (15%)"]
        TruckScore --> TA["Availability (15%)"]
        TruckScore --> TW["Workload (10%)"]

        DriverScore --> DA["Availability (20%)"]
        DriverScore --> DW["Workload (10%)"]
    end

    TruckScore --> HC{"Hard Constraint<br/>Check"}
    HC -->|Cannot fit| Zero["Score = 0"]
    HC -->|Can fit| Rank["Rank & Sort"]

    Rank --> Output["Best Truck + Driver<br/>Confidence Level<br/>Explanations"]
```

The engine is pure computation — no database access, no side effects. The API route (`/api/recommendations`) handles data fetching and passes pre-transformed data to the engine.

## Server/Client Boundary

| Layer | Rendering | Purpose |
|-------|-----------|---------|
| `app/(dashboard)/*/page.tsx` | Server | Auth check, data fetching, page shell |
| `components/*/` | Client (`'use client'`) | Interactive UI, forms, state management |
| `app/api/*/route.ts` | Server | REST endpoints, business logic |
| `lib/services/` | Server | Pure business logic (no React) |
| `lib/import/` | Server | Pipeline engines (no React) |

## Data Flow

All data flows through this pattern:

```
Browser → API Route → getAuthContext() → Prisma (scoped by companyId) → PostgreSQL
```

For server components:

```
Browser → Server Component → getAuthContext() → Prisma (scoped by companyId) → PostgreSQL → Render HTML
```

## Dependency Direction

```
Pages → Components → UI Components
  ↓
API Routes → Business Logic (services, import) → Prisma → Database
  ↓
Auth + Security (cross-cutting)
```

Dependencies flow inward. Business logic never imports from React components. The recommendation engine and import pipeline have zero React dependencies.
