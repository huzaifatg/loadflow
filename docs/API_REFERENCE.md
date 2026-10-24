# API Reference

All endpoints require authentication via Supabase session cookie unless noted otherwise. All responses follow the `{ data, error }` envelope pattern.

**Base URL:** `http://localhost:3000/api`

---

## Company

### `PATCH /api/company`

Update the authenticated user's company settings and profile.

**Request Body:**
```json
{
  "name": "string",
  "fullName": "string",
  "displayName": "string",
  "phone": "string",
  "timezone": "string",
  "units": "imperial | metric",
  "emailNotifications": true,
  "dispatchAlerts": true,
  "weeklyReport": false
}
```
All fields are optional — only provided fields are updated.

**Response:** `200` — Updated company object.

**Errors:** `401` Unauthorized, `500` Internal error.

---

## Deliveries

### `GET /api/deliveries`

List all non-archived deliveries for the authenticated company.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, or `ALL` |
| `date` | string (ISO date) | Filter by scheduled date (matches entire day) |

**Response:** `200`
```json
{
  "data": [
    {
      "id": "uuid",
      "companyId": "uuid",
      "customerName": "ACME Corp",
      "pickupAddress": "123 Warehouse St",
      "deliveryAddress": "456 Main St",
      "weight": 1500.0000,
      "status": "PENDING",
      "scheduledDate": "2026-08-05T00:00:00.000Z",
      "notes": null,
      "isArchived": false,
      "createdAt": "2026-08-01T...",
      "updatedAt": "2026-08-01T...",
      "_count": { "loadPlanItems": 0, "items": 2 },
      "items": [{ "productName": "Widget A", "quantity": 10, "totalWeight": 500 }]
    }
  ],
  "error": null
}
```

**Sorting:** `scheduledDate` ASC (nulls last), then `createdAt` DESC.

---

### `POST /api/deliveries`

Create a new delivery.

**Request Body:**
```json
{
  "customerName": "ACME Corp",
  "pickupAddress": "123 Warehouse St",
  "deliveryAddress": "456 Main St",
  "weight": 1500,
  "scheduledDate": "2026-08-10",
  "notes": "Fragile",
  "status": "PENDING",
  "items": [
    {
      "productName": "Widget A",
      "quantity": 10,
      "quantityUnit": "cartons",
      "unitType": "STANDARD_WEIGHT",
      "unitWeight": 50,
      "notes": null
    }
  ]
}
```

**Required:** `customerName`, `pickupAddress`, `deliveryAddress`. Either `weight` or `items[]` must be provided.

If `items[]` is provided, `weight` is auto-computed from item weights.

**Response:** `201` — Created delivery with items.

**Errors:** `400` Validation error, `401` Unauthorized, `500` Internal error.

---

### `GET /api/deliveries/:id`

Get a single delivery with its items and load plan assignments.

**Path Parameters:** `id` — Delivery UUID.

**Response:** `200` — Delivery object with `items[]` and `loadPlanItems[]` (includes related `loadPlan` with `truck` and `driver`).

**Errors:** `400` Invalid UUID, `401` Unauthorized, `404` Not found, `500` Internal error.

---

### `PUT /api/deliveries/:id`

Update a delivery. All fields are optional — only provided fields are updated.

**Business Rules:**
- Cannot edit core fields (`customerName`, `pickupAddress`, `deliveryAddress`, `weight`, `items`) when status is `IN_TRANSIT` or `DELIVERED`.
- Cannot archive a delivery assigned to a load plan.
- Status transitions are restricted: `PENDING` → `CANCELLED`, `ASSIGNED` → `CANCELLED`. Other transitions must go through the load plan dispatch flow.

**Request Body:** Same fields as `POST` (all optional). Additionally accepts `isArchived: boolean`.

If `items[]` is provided, all existing items are replaced (transactional upsert). Weight is recomputed from new items.

**Response:** `200` — Updated delivery.

**Errors:** `400` Validation/business rule violation, `401` Unauthorized, `404` Not found, `500` Internal error.

---

### `DELETE /api/deliveries/:id`

Delete a delivery. Wrapped in a transaction to prevent race conditions.

**Business Rules:** Cannot delete a delivery assigned to a load plan.

**Response:** `200` — `{ data: { id }, error: null }`.

**Errors:** `400` Has load plans, `401` Unauthorized, `404` Not found, `500` Internal error.

---

## Trucks

### `GET /api/trucks`

List all non-archived trucks for the authenticated company.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `AVAILABLE`, `IN_USE`, `MAINTENANCE` |

**Response:** `200` — Array of truck objects with `_count: { loadPlans }`.

---

### `POST /api/trucks`

Create a new truck.

**Request Body:**
```json
{
  "name": "Heavy Hauler",
  "plateNumber": "HH-001",
  "type": "Box Truck",
  "weightCapacity": 10000,
  "status": "AVAILABLE",
  "notes": null
}
```

**Required:** `name`, `plateNumber`, `weightCapacity` (> 0).

**Response:** `201` — Created truck.

**Errors:** `400` Validation error, `401` Unauthorized, `500` Internal error.

---

### `GET /api/trucks/:id`

Get a single truck.

**Response:** `200` — Truck object.

**Errors:** `400` Invalid UUID, `401` Unauthorized, `404` Not found.

---

### `PUT /api/trucks/:id`

Update a truck. All fields optional. Accepts `isArchived: boolean` for soft delete.

**Response:** `200` — Updated truck.

**Errors:** `400` Validation error, `401` Unauthorized, `404` Not found.

---

### `DELETE /api/trucks/:id`

Permanently delete a truck. Blocked if truck has load plan assignments.

**Response:** `200` — `{ data: { id }, error: null }`.

**Errors:** `400` Has load plans, `401` Unauthorized, `404` Not found.

---

## Drivers

### `GET /api/drivers`

List all non-archived drivers for the authenticated company.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `AVAILABLE`, `ON_TRIP`, `OFF_DUTY` |

**Response:** `200` — Array of driver objects with `_count: { loadPlans }`.

---

### `POST /api/drivers`

Create a new driver.

**Request Body:**
```json
{
  "name": "John Smith",
  "phone": "555-0001",
  "licenseNumber": "DL-001",
  "status": "AVAILABLE",
  "notes": null
}
```

**Required:** `name`.

**Response:** `201` — Created driver.

---

### `GET /api/drivers/:id`

Get a single driver.

**Response:** `200` — Driver object.

---

### `PUT /api/drivers/:id`

Update a driver. All fields optional. Accepts `isArchived: boolean`.

**Response:** `200` — Updated driver.

---

### `DELETE /api/drivers/:id`

Permanently delete a driver. Blocked if driver has load plan assignments.

**Response:** `200` — `{ data: { id }, error: null }`.

---

## Load Plans

### `GET /api/loads`

List all load plans for the authenticated company, grouped by date.

**Response:** `200` — Array of load plans with `truck`, `driver`, `items[]` (each with `delivery`), and `_count: { items }`.

**Sorting:** `date` DESC.

---

### `POST /api/loads`

Create a new load plan with optional delivery items. Handled transactionally with full company isolation and resource validation.

**Request Body:**
```json
{
  "truckId": "uuid",
  "driverId": "uuid | null",
  "date": "2026-08-10",
  "status": "DRAFT",
  "notes": null,
  "items": [
    { "deliveryId": "uuid", "sortOrder": 0 }
  ]
}
```

**Required:** `truckId`, `date`. `driverId` is optional at creation (defaults to `null` for draft plans).

**Server-Side Validations:**
- **Company scoping:** Truck, driver, and all deliveries must belong to the caller's company (`404` if not found or cross-tenant).
- **Resource status:** Truck cannot be in `MAINTENANCE` (`409`). Driver cannot be in `OFF_DUTY` (`409`).
- **Conflict detection:** Neither truck nor driver may be assigned to another load plan on the same calendar day (`409`).
- **Delivery eligibility:** Every added delivery must be `PENDING`, unarchived, and not allocated to another active plan (`409`).
- **Capacity fit:** Total weight cannot exceed truck capacity (`409`).

When items are added, referenced deliveries transition to `ASSIGNED`. Returns delivery date warnings if scheduled dates differ from plan date.

**Response:** `201`
```json
{
  "data": {
    "id": "uuid",
    "companyId": "uuid",
    "truckId": "uuid",
    "driverId": "uuid | null",
    "date": "2026-08-10T00:00:00.000Z",
    "status": "DRAFT",
    "notes": null,
    "truck": { ... },
    "driver": { ... },
    "items": [{ "deliveryId": "uuid", "sortOrder": 0, "delivery": { ... } }]
  },
  "warnings": [{ "deliveryId": "uuid", "message": "Scheduled for 2026-08-12, but load plan is on 2026-08-10" }],
  "error": null
}
```

**Errors:** `400` Validation error, `401` Unauthorized, `404` Resource not found, `409` Status/schedule/capacity conflict, `500` Internal error.

---

### `GET /api/loads/:id`

Get a single load plan with truck, driver, and delivery items.

**Response:** `200` — Full load plan with relations.

---

### `PATCH /api/loads/:id`

Update a load plan. Supports lifecycle status transitions, driver assignment, notes, and transactional delivery item replacement.

**Request Body:**
```json
{
  "status": "READY",
  "truckId": "uuid",
  "driverId": "uuid",
  "notes": "Updated notes",
  "items": [
    { "deliveryId": "uuid", "sortOrder": 0 }
  ]
}
```
All fields optional.

**Editing & Lock Rules:**
- Modifying `items`, `truckId`, or `driverId` is **ONLY** permitted when the plan is in `DRAFT` status.
- Once a plan is `READY`, `DISPATCHED`, or `COMPLETED`, content edits return `400` ("Cannot modify a load plan that is READY. Revert to DRAFT first.").
- A `READY` plan can be reverted to `DRAFT` by passing `{"status": "DRAFT"}`.

**Lifecycle State Machine (`DRAFT` → `READY` ↔ `DISPATCHED` → `COMPLETED`):**
- `DRAFT` → `READY`: Locks the plan for dispatch preparation.
- `READY` → `DRAFT`: Unlocks the plan for editing.
- `READY` → `DISPATCHED`: Dispatches the load. Preconditions enforced atomically:
  - Plan must be in `READY` status.
  - Truck must be assigned, active, and not in `MAINTENANCE`.
  - Driver must be assigned, active, and not `OFF_DUTY`.
  - Plan must contain at least 1 dispatchable delivery item.
  - Atomically transitions plan to `DISPATCHED`, delivery items to `IN_TRANSIT`, truck to `IN_USE`, driver to `ON_TRIP`.
- `DISPATCHED` → `COMPLETED`: Terminal transition. Marks plan `COMPLETED`, delivery items `DELIVERED`, truck `AVAILABLE`, driver `AVAILABLE`.
- Illegal transitions (e.g. `DRAFT` → `DISPATCHED`, `DISPATCHED` → `READY`, or changing `COMPLETED`) return `400`.

**Delivery Release Semantics:**
- When items are removed from a `DRAFT` plan, deliveries with status `ASSIGNED` revert to `PENDING`.
- Deliveries in terminal or non-assigned states (e.g. `CANCELLED`, `DELIVERED`, `IN_TRANSIT`) are preserved as-is and never reset to `PENDING`.

**Response:** `200` — `{ data: { ...loadPlan }, warnings: [...], error: null }`.

**Errors:** `400` Invalid transition / plan locked, `401` Unauthorized, `404` Not found, `409` Precondition failure (off-duty driver, maintenance truck, no items, capacity exceeded), `500` Internal error.

---

### `DELETE /api/loads/:id`

Delete a load plan. Only allowed for plans in `DRAFT` or `READY` status.

Plans that have started execution (`DISPATCHED` or `COMPLETED`) cannot be deleted (`400`).

On deletion, all `ASSIGNED` deliveries in the plan atomically revert to `PENDING`. Any `CANCELLED` deliveries remain unchanged.

**Response:** `200` — `{ data: { id }, error: null }`.

**Errors:** `400` Plan already dispatched/completed, `401` Unauthorized, `404` Not found.

---

## Load Optimization

### `POST /api/loads/optimize`

Generate an optimized load plan assignment using First Fit Decreasing bin-packing.

**Request Body:**
```json
{
  "date": "2026-08-10"
}
```

**Response:** `200`
```json
{
  "assignments": [
    {
      "truck": { "id": "uuid", "name": "...", "weightCapacity": 10000 },
      "driver": { "id": "uuid", "name": "..." },
      "deliveries": [{ "id": "uuid", "customerName": "...", "weight": 1500 }],
      "totalWeight": 3500,
      "utilizationPct": 35
    }
  ],
  "unassigned": [],
  "stats": { "totalDeliveries": 5, "assignedDeliveries": 5, "trucksUsed": 2 }
}
```

---

## Recommendations

### `POST /api/recommendations`

Generate truck and driver recommendations for a delivery batch.

**Request Body:**
```json
{
  "date": "2026-08-10",
  "deliveryIds": ["uuid", "uuid"]
}
```

`deliveryIds` is optional. If omitted, all pending/unassigned deliveries for the date are evaluated.

**Response:** `200`
```json
{
  "date": "2026-08-10T00:00:00.000Z",
  "totalWeight": 5000,
  "deliveries": [{ "id": "uuid", "customerName": "...", "weight": 2500 }],
  "recommendation": {
    "truck": {
      "truckId": "uuid",
      "truckName": "Heavy Hauler",
      "truckPlateNumber": "HH-001",
      "truckCapacity": 10000,
      "committedWeight": 0,
      "remainingCapacity": 10000,
      "totalScore": 87,
      "factors": [
        { "factor": "capacityFit", "score": 0.94, "weight": 0.3, "weighted": 0.282, "explanation": "Capacity fit: 50% utilization" }
      ]
    },
    "driver": {
      "driverId": "uuid",
      "driverName": "John Smith",
      "totalScore": 100,
      "factors": [...]
    },
    "utilizationPct": 50,
    "confidence": "HIGH",
    "confidenceScore": 92,
    "explanations": [
      "Heavy Hauler (HH-001) recommended with a score of 87/100.",
      "Capacity utilization: 50% — 5,000 kg of 10,000 kg available.",
      "High confidence recommendation."
    ],
    "allTrucks": [...],
    "allDrivers": [...]
  },
  "stats": {
    "deliveryCount": 2,
    "totalWeight": 5000,
    "truckCandidates": 3,
    "driverCandidates": 2,
    "eligibleTrucks": 3,
    "eligibleDrivers": 2
  }
}
```

**Errors:** `400` No date / no eligible deliveries, `401` Unauthorized, `500` Internal error.

---

### `POST /api/recommendations/assign`

Create a Load Plan from a dispatcher-approved recommendation. Validates all inputs server-side before transactional assignment.

**Request Body:**
```json
{
  "truckId": "uuid",
  "driverId": "uuid | null",
  "deliveryIds": ["uuid", "..."],
  "date": "2026-09-01"
}
```

**Server-Side Validation:** Authentication, UUID format, date validity, truck/driver/delivery ownership (company), truck status (not MAINTENANCE), driver status (not OFF_DUTY), delivery eligibility (PENDING only, not archived, not in another active plan), capacity fit, truck/driver date conflicts.

**Response:** `200`
```json
{
  "success": true,
  "loadPlan": {
    "id": "uuid",
    "companyId": "uuid",
    "truckId": "uuid",
    "driverId": "uuid | null",
    "date": "2026-09-01T00:00:00.000Z",
    "status": "DRAFT",
    "truck": { ... },
    "driver": { ... },
    "items": [{ "deliveryId": "uuid", "sortOrder": 0, "delivery": { ... } }]
  },
  "warnings": [{ "deliveryId": "uuid", "message": "..." }]
}
```

**Error Responses:**

| Code | Condition |
|------|-----------|
| `400` | Missing/invalid fields, invalid UUID format, invalid date |
| `401` | Not authenticated |
| `404` | Truck/driver/delivery not found or belongs to another company |
| `409` | Truck in MAINTENANCE, driver OFF_DUTY, delivery not PENDING, capacity exceeded, truck/driver conflict |
| `500` | Internal error (transaction rolled back, no partial state) |

**Side Effects:**
- Creates a LoadPlan (status: DRAFT) with associated LoadPlanItems
- Updates delivery statuses from PENDING → ASSIGNED
- All operations are transactional — failure rolls back everything

---

## CSV Import

### `POST /api/import/csv`

Upload and process a CSV file through the full import pipeline.

**Request Body:** `multipart/form-data` with `file` field containing a `.csv` file.

**Response:** `200` — Pipeline result with diagnostics, preview summary, and commit results.

**Errors:** `400` No file / invalid CSV, `401` Unauthorized, `500` Pipeline error.

---

### `POST /api/import/commit`

Commit a previewed import job to the database.

**Request Body:**
```json
{
  "jobId": "uuid"
}
```

**Response:** `200` — Commit results with statistics.

---

### `GET /api/import/history`

List all import jobs for the authenticated company, newest first.

**Response:** `200` — Array of import jobs with `_count: { rows, deliveries }`.

---

### `GET /api/import/history/:id`

Get a single import job with all its rows.

**Response:** `200` — Import job with `rows[]` (including `rawData`, `mappedData`, `status`, `errors`).

---

## Demo

### `GET /api/demo`

Seed the authenticated company with demonstration data (trucks, drivers, deliveries).

**Response:** `200` — Summary of created records.

---

### `POST /api/demo/reset`

Delete all data for the authenticated company and re-seed with fresh demo data.

**Response:** `200` — Summary of reset operation.

---

## Common Error Response Format

All error responses follow:

```json
{
  "data": null,
  "error": {
    "message": "Human-readable error description"
  }
}
```

Or for the recommendations API:
```json
{
  "error": "Human-readable error description"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / validation error / business rule violation |
| `401` | Not authenticated |
| `403` | Not authorized (wrong company) |
| `404` | Resource not found |
| `500` | Internal server error |
