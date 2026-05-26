// ─── Enums ───────────────────────────────────────────────────────────────────

export enum TruckStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum DriverStatus {
  AVAILABLE = 'AVAILABLE',
  ON_TRIP = 'ON_TRIP',
  OFF_DUTY = 'OFF_DUTY',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum LoadPlanStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  DISPATCHED = 'DISPATCHED',
  COMPLETED = 'COMPLETED',
}

export enum UnitType {
  STANDARD_WEIGHT = 'STANDARD_WEIGHT',
  VARIABLE_WEIGHT = 'VARIABLE_WEIGHT',
  PIECE_BASED = 'PIECE_BASED',
}

// ─── Base Model Types ────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}


export interface Truck {
  id: string
  companyId: string
  name: string
  plateNumber: string
  type: string | null
  /** Weight capacity in kilograms */
  weightCapacity: number
  status: TruckStatus
  notes: string | null
  isArchived: boolean
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Driver {
  id: string
  companyId: string
  name: string
  phone: string | null
  licenseNumber: string | null
  status: DriverStatus
  notes: string | null
  isArchived: boolean
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Delivery {
  id: string
  companyId: string
  customerName: string
  pickupAddress: string
  deliveryAddress: string
  /** Weight in kilograms. Decimal(12,4) — parsed to number on the client. */
  weight: number
  status: DeliveryStatus
  scheduledDate: Date | null
  notes: string | null
  isArchived: boolean
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface DeliveryItem {
  id: string
  deliveryId: string
  productName: string
  sku: string | null
  /** Decimal(12,4) — supports fractional quantities (e.g., 1.5 pallets) */
  quantity: number
  quantityUnit: string
  unitType: UnitType
  /** Weight per single unit in kg. Decimal(12,4). Null for VARIABLE_WEIGHT. */
  unitWeight: number | null
  /** Actual total weight for this line in kg. Decimal(12,4). */
  totalWeight: number
  notes: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface LoadPlan {
  id: string
  companyId: string
  truckId: string
  driverId: string | null
  status: LoadPlanStatus
  date: Date
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LoadPlanItem {
  id: string
  loadPlanId: string
  deliveryId: string
  sortOrder: number
  createdAt: Date
}

// ─── Extended Types with Relations ───────────────────────────────────────────

export interface CompanyWithRelations extends Company {
  trucks: Truck[]
  drivers: Driver[]
  deliveries: Delivery[]
  loadPlans: LoadPlan[]
}


export interface TruckWithLoadPlans extends Truck {
  loadPlans: LoadPlan[]
}

export interface DriverWithLoadPlans extends Driver {
  loadPlans: LoadPlan[]
}

export interface LoadPlanItemWithDelivery extends LoadPlanItem {
  delivery: Delivery
}

export interface LoadPlanWithDetails extends LoadPlan {
  truck: Truck
  driver: Driver | null
  items: LoadPlanItemWithDelivery[]
}

export interface DeliveryWithLoadPlanItems extends Delivery {
  loadPlanItems: (LoadPlanItem & {
    loadPlan: LoadPlan
  })[]
}

export interface DeliveryWithItems extends Delivery {
  items: DeliveryItem[]
}

export interface DeliveryWithItemsAndLoadPlan extends DeliveryWithItems {
  loadPlanItems: (LoadPlanItem & {
    loadPlan: LoadPlan
  })[]
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error: null
}

export interface ApiErrorResponse {
  data: null
  error: {
    message: string
    code?: string
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Form Input Types (Create) ───────────────────────────────────────────────

export interface CreateCompanyInput {
  name: string
}

export interface CreateTruckInput {
  name: string
  plateNumber: string
  type?: string | null
  /** Weight capacity in kilograms */
  weightCapacity: number
  status?: TruckStatus
  notes?: string | null
}

export interface CreateDriverInput {
  name: string
  phone?: string | null
  licenseNumber?: string | null
  status?: DriverStatus
  notes?: string | null
}

export interface CreateDeliveryInput {
  customerName: string
  pickupAddress: string
  deliveryAddress: string
  /** Weight in kilograms. Used for legacy mode (no items). */
  weight?: number
  status?: DeliveryStatus
  scheduledDate?: Date | string | null
  notes?: string | null
  /** Optional delivery items. If provided, weight is auto-computed. */
  items?: CreateDeliveryItemInput[]
}

export interface CreateDeliveryItemInput {
  productName: string
  sku?: string | null
  quantity: number
  quantityUnit?: string
  unitType?: UnitType | string
  unitWeight?: number | null
  totalWeight?: number | null
  notes?: string | null
  sortOrder?: number
}

export interface CreateLoadPlanInput {
  truckId: string
  driverId?: string | null
  status?: LoadPlanStatus
  date: Date | string
  notes?: string | null
  items?: CreateLoadPlanItemInput[]
}

export interface CreateLoadPlanItemInput {
  deliveryId: string
  sortOrder: number
}

// ─── Form Input Types (Update) ───────────────────────────────────────────────

export interface UpdateCompanyInput {
  name?: string
}

export interface UpdateTruckInput {
  name?: string
  plateNumber?: string
  type?: string | null
  weightCapacity?: number
  status?: TruckStatus
  notes?: string | null
  isArchived?: boolean
}

export interface UpdateDriverInput {
  name?: string
  phone?: string | null
  licenseNumber?: string | null
  status?: DriverStatus
  notes?: string | null
  isArchived?: boolean
}

export interface UpdateDeliveryInput {
  customerName?: string
  pickupAddress?: string
  deliveryAddress?: string
  weight?: number
  status?: DeliveryStatus
  scheduledDate?: Date | string | null
  notes?: string | null
  isArchived?: boolean
  /** If provided, replaces all items (upsert strategy). */
  items?: CreateDeliveryItemInput[]
}

export interface UpdateLoadPlanInput {
  truckId?: string
  driverId?: string | null
  status?: LoadPlanStatus
  date?: Date | string
  notes?: string | null
}

// ─── Dashboard Types ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalTrucks: number
  availableTrucks: number
  totalDrivers: number
  availableDrivers: number
  pendingDeliveries: number
  inTransitDeliveries: number
  completedDeliveries: number
  cancelledDeliveries: number
  activeLoadPlans: number
  totalWeightInTransit: number
}
