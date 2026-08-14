# System Workflows

## Delivery Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Created (manual or CSV import)

    PENDING --> ASSIGNED: Added to Load Plan
    PENDING --> CANCELLED: Dispatcher cancels

    ASSIGNED --> PENDING: Removed from Load Plan
    ASSIGNED --> IN_TRANSIT: Load Plan dispatched
    ASSIGNED --> CANCELLED: Dispatcher cancels

    IN_TRANSIT --> DELIVERED: Load Plan completed

    DELIVERED --> [*]
    CANCELLED --> [*]
```

### Key Rules
- `PENDING → ASSIGNED`: Automatic when delivery is added to a load plan via `PATCH /api/loads/:id`.
- `ASSIGNED → PENDING`: Automatic when delivery is removed from a load plan or plan is deleted.
- `IN_TRANSIT → DELIVERED`: Only via load plan completion (`PATCH /api/loads/:id` with `status: COMPLETED`).
- Direct status changes are limited to cancellation only. All other transitions go through the load plan workflow.
- Core fields cannot be edited once status is `IN_TRANSIT` or `DELIVERED`.

---

## Load Plan Lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Created

    DRAFT --> READY: All details confirmed
    READY --> DISPATCHED: Driver departs
    DISPATCHED --> COMPLETED: All deliveries done

    note right of DRAFT: Add/remove deliveries freely
    note right of DISPATCHED: Deliveries → IN_TRANSIT
    note right of COMPLETED: Deliveries → DELIVERED, Truck → AVAILABLE
```

### Side Effects by Status Transition

| Transition | Side Effect |
|-----------|-------------|
| `→ DRAFT` | No side effects |
| `→ READY` | No side effects |
| `→ DISPATCHED` | All assigned deliveries → `IN_TRANSIT` |
| `→ COMPLETED` | All assigned deliveries → `DELIVERED`, truck status → `AVAILABLE` |
| Load plan deleted | All assigned deliveries → `PENDING` |

---

## Truck Assignment Flow

```mermaid
sequenceDiagram
    participant D as Dispatcher
    participant LP as Load Plan API
    participant DB as Database

    D->>LP: POST /api/loads { truckId, date }
    LP->>DB: Create LoadPlan (status: DRAFT)
    LP-->>D: Load plan created

    D->>LP: PATCH /api/loads/:id { items: [...] }
    LP->>DB: Replace load plan items
    LP->>DB: Update delivery statuses → ASSIGNED
    LP-->>D: Items updated

    D->>LP: PATCH /api/loads/:id { status: DISPATCHED }
    LP->>DB: Update load plan status
    LP->>DB: Update deliveries → IN_TRANSIT
    LP-->>D: Dispatched
```

---

## Recommendation Flow

```mermaid
sequenceDiagram
    participant UI as Recommendation UI
    participant API as /api/recommendations
    participant Auth as getAuthContext()
    participant DB as Prisma
    participant Eng as Recommendation Engine

    UI->>API: POST { date, deliveryIds? }
    API->>Auth: Verify session
    Auth-->>API: { companyId }

    API->>DB: Fetch pending deliveries (scoped by companyId)
    API->>DB: Fetch available trucks + committed weights
    API->>DB: Fetch available drivers + active plan counts

    API->>API: Transform Prisma models → Engine types

    API->>Eng: generateRecommendation({ deliveries, trucks, drivers })

    Note over Eng: Pure computation — no DB access
    Eng->>Eng: Score each truck (4 factors)
    Eng->>Eng: Score each driver (2 factors)
    Eng->>Eng: Apply hard constraints
    Eng->>Eng: Rank, compute confidence

    Eng-->>API: RecommendationResult

    API-->>UI: JSON response with ranked trucks, drivers, explanations
```

### Scoring Factors

**Truck Scoring (70% of confidence):**
| Factor | Weight | Algorithm |
|--------|--------|-----------|
| Capacity Fit | 30% | Bell curve peaking at 80% utilization |
| Remaining Capacity | 15% | Normalized: `remainingCapacity / maxCapacity` |
| Availability | 15% | `AVAILABLE` = 1.0, `IN_USE` = 0.5, `MAINTENANCE` = excluded |
| Workload | 10% | Inverse: fewer active plans = higher score |

**Driver Scoring (30% of confidence):**
| Factor | Weight | Algorithm |
|--------|--------|-----------|
| Availability | 20% | `AVAILABLE` = 1.0, `ON_TRIP` = 0.4, `OFF_DUTY` = excluded |
| Workload | 10% | Inverse: fewer active plans = higher score |

---

## CSV Import Flow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Import UI
    participant API as /api/import/csv
    participant P as Parse Engine
    participant V as Validation Engine
    participant M as Mapping Engine
    participant Pr as Preview Engine
    participant C as Commit Engine
    participant DB as Database

    User->>UI: Upload CSV file
    UI->>API: POST (multipart/form-data)

    API->>P: Parse CSV text
    P-->>API: Rows[] with headers

    API->>V: Validate fields
    V-->>API: Validation results
    Note over V: Halt if critical errors

    API->>M: Map columns → delivery fields
    M-->>API: Mapped rows

    API->>Pr: Preview changes
    Pr->>DB: Fetch existing deliveries (by external_id)
    Pr-->>API: Classify: create / update / skip / duplicate

    API->>C: Commit changes
    C->>DB: Transaction: create/update deliveries
    C-->>API: Commit results

    API-->>UI: Full pipeline result
    UI-->>User: Import summary
```

### Import Pipeline Stages

1. **Parse** — Converts raw CSV text into structured row objects. Handles quoting, escaping, and header detection.
2. **Validate** — Checks required fields (`customerName`, `deliveryAddress`), data types, and value formats.
3. **Map** — Maps CSV column headers to delivery domain fields using fuzzy matching.
4. **Preview** — Compares mapped data against existing database records. Classifies each row as `create`, `update`, `no_change`, `skip`, or `duplicate`. Computes field-level diffs for updates.
5. **Commit** — Writes changes to the database inside a transaction. Supports rollback on failure. Creates `ImportRow` records for audit trail.

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant LP as Login Page
    participant SA as Supabase Auth
    participant MW as Middleware
    participant AC as getAuthContext()
    participant DB as PostgreSQL

    B->>LP: Navigate to /login
    B->>LP: Enter email + password
    LP->>SA: signInWithPassword()
    SA-->>LP: Session cookie set
    LP->>B: Redirect to /dashboard

    B->>MW: GET /dashboard
    MW->>SA: Verify session cookie
    MW-->>B: Allow (session valid)

    B->>AC: Server component loads
    AC->>SA: getUser()
    SA-->>AC: User { id, email }
    AC->>DB: CompanyMember.findFirst({ userId })

    alt First-time user
        AC->>DB: Transaction: Create Company + CompanyMember(OWNER)
    end

    AC-->>B: AuthContext { userId, companyId, company }
```

### Auto-Provisioning

When a user signs up and accesses the dashboard for the first time:
1. `getAuthContext()` looks up `CompanyMember` by `userId`.
2. If no membership exists, it creates a new `Company` named `"{email prefix}'s Company"`.
3. It creates a `CompanyMember` with role `OWNER` in a single transaction.
4. The user immediately has a fully functional tenant with no manual setup.

---

## Route Optimization Flow

```mermaid
sequenceDiagram
    participant UI as Optimization UI
    participant API as /api/loads/optimize
    participant DB as Database

    UI->>API: POST { date }
    API->>DB: Fetch pending deliveries for date
    API->>DB: Fetch available trucks
    API->>DB: Fetch available drivers

    API->>API: Sort deliveries by weight DESC
    API->>API: Sort trucks by capacity DESC
    API->>API: First Fit Decreasing bin-packing

    loop For each delivery
        API->>API: Find first truck with enough remaining capacity
        API->>API: Assign delivery to truck
    end

    API->>API: Pair trucks with drivers (round-robin)

    API-->>UI: Assignments + unassigned + stats
```

The optimizer uses the **First Fit Decreasing** algorithm: deliveries are sorted heaviest-first, and each is assigned to the first truck that has enough remaining capacity. This produces good utilization without exponential computation.
