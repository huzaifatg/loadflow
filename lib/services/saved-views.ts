// ─── Saved Views & Filter Presets (Sprint 16) ────────────────────────────────
// Provides built-in operational presets plus user-persisted custom filter views
// per workspace (`deliveries`, `loads`, `trucks`, `drivers`), strictly scoped
// by `companyId` and `userId`.

import { isValidUuid } from '@/lib/security/constants'

export const SAVED_VIEW_WORKSPACES = ['deliveries', 'loads', 'trucks', 'drivers', 'dispatch'] as const
export type SavedViewWorkspace = (typeof SAVED_VIEW_WORKSPACES)[number]

export interface PresetView {
  id: string
  name: string
  query: string
  isDefault: true
}

export interface CustomSavedView {
  id: string
  workspace: string
  name: string
  query: string
  createdAt: Date | string
  updatedAt: Date | string
}

export const DEFAULT_PRESET_VIEWS: Record<SavedViewWorkspace, PresetView[]> = {
  deliveries: [
    { id: 'preset-del-pending', name: 'Pending Queue', query: 'status=PENDING', isDefault: true },
    { id: 'preset-del-overdue', name: 'Overdue & Due Soon', query: 'status=PENDING&schedule=overdue', isDefault: true },
    { id: 'preset-del-unscheduled', name: 'Unscheduled Pending', query: 'status=PENDING&schedule=unscheduled', isDefault: true },
    { id: 'preset-del-transit', name: 'In Transit', query: 'status=IN_TRANSIT', isDefault: true },
    { id: 'preset-del-delivered', name: 'Delivered', query: 'status=DELIVERED', isDefault: true },
  ],
  loads: [
    { id: 'preset-lp-draft', name: 'Draft Plans', query: 'status=DRAFT', isDefault: true },
    { id: 'preset-lp-ready', name: 'Ready for Dispatch', query: 'status=READY', isDefault: true },
    { id: 'preset-lp-dispatched', name: 'In Transit', query: 'status=DISPATCHED', isDefault: true },
    { id: 'preset-lp-completed', name: 'Completed', query: 'status=COMPLETED', isDefault: true },
  ],
  trucks: [
    { id: 'preset-trk-avail', name: 'Available Fleet', query: 'status=AVAILABLE', isDefault: true },
    { id: 'preset-trk-inuse', name: 'In Use', query: 'status=IN_USE', isDefault: true },
    { id: 'preset-trk-maint', name: 'Maintenance', query: 'status=MAINTENANCE', isDefault: true },
  ],
  drivers: [
    { id: 'preset-drv-avail', name: 'Available Drivers', query: 'status=AVAILABLE', isDefault: true },
    { id: 'preset-drv-trip', name: 'On Trip', query: 'status=ON_TRIP', isDefault: true },
    { id: 'preset-drv-off', name: 'Off Duty', query: 'status=OFF_DUTY', isDefault: true },
  ],
  dispatch: [
    { id: 'preset-dsp-ready', name: 'Ready to Dispatch', query: 'status=READY', isDefault: true },
    { id: 'preset-dsp-missing-drv', name: 'Missing Driver', query: 'assignment=UNASSIGNED_DRIVER', isDefault: true },
    { id: 'preset-dsp-conflicts', name: 'Blocking Conflicts', query: 'conflict=BLOCKING_ONLY', isDefault: true },
    { id: 'preset-dsp-overdue', name: 'Overdue Queue', query: 'overdue=OVERDUE_ONLY', isDefault: true },
  ],
}

const ALLOWED_QUERY_KEYS = new Set([
  'status',
  'schedule',
  'q',
  'sort',
  'view',
  'assignment',
  'conflict',
  'overdue',
  'truckId',
  'driverId',
  'scope',
])

export function isSavedViewWorkspace(v: unknown): v is SavedViewWorkspace {
  return typeof v === 'string' && (SAVED_VIEW_WORKSPACES as readonly string[]).includes(v)
}

/** Normalize and whitelist URL query parameters so saved views only store filter/sort state. */
export function sanitizeViewQuery(raw: string): string {
  const sp = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const clean = new URLSearchParams()
  const entries = Array.from(sp.entries()).sort(([a], [b]) => a.localeCompare(b))
  for (const [k, v] of entries) {
    const trimmed = v.trim()
    if (ALLOWED_QUERY_KEYS.has(k) && trimmed && trimmed !== 'ALL') {
      clean.set(k, trimmed.slice(0, 120))
    }
  }
  return clean.toString()
}

type SavedViewDb = {
  savedView?: {
    findMany: (args: {
      where: { companyId: string; userId: string; workspace?: string }
      orderBy: { createdAt: 'asc' | 'desc' }
    }) => Promise<CustomSavedView[]>
    upsert: (args: {
      where: {
        companyId_userId_workspace_name: {
          companyId: string
          userId: string
          workspace: string
          name: string
        }
      }
      create: { companyId: string; userId: string; workspace: string; name: string; query: string }
      update: { query: string }
    }) => Promise<CustomSavedView>
    findFirst: (args: {
      where: { id: string; companyId: string; userId: string }
    }) => Promise<CustomSavedView | null>
    update: (args: {
      where: { id: string }
      data: { name?: string; query?: string }
    }) => Promise<CustomSavedView>
    deleteMany: (args: {
      where: { id: string; companyId: string; userId: string }
    }) => Promise<{ count: number }>
  }
}

export async function listSavedViews(
  db: SavedViewDb,
  companyId: string,
  userId: string,
  workspace?: SavedViewWorkspace,
): Promise<CustomSavedView[]> {
  if (!db.savedView?.findMany) return []
  try {
    return await db.savedView.findMany({
      where: { companyId, userId, ...(workspace ? { workspace } : {}) },
      orderBy: { createdAt: 'asc' },
    })
  } catch {
    return []
  }
}

export async function upsertSavedView(
  db: SavedViewDb,
  companyId: string,
  userId: string,
  input: { workspace?: unknown; name?: unknown; query?: unknown },
): Promise<{ ok: true; data: CustomSavedView } | { ok: false; status: number; error: string }> {
  if (!isSavedViewWorkspace(input.workspace)) {
    return { ok: false, status: 400, error: 'Invalid workspace.' }
  }
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 40) {
    return { ok: false, status: 400, error: 'View name is required (max 40 characters).' }
  }
  const rawQuery = typeof input.query === 'string' ? input.query : ''
  const query = sanitizeViewQuery(rawQuery)
  if (!query) {
    return { ok: false, status: 400, error: 'Select at least one filter or search term before saving a view.' }
  }
  if (!db.savedView?.upsert) {
    return { ok: false, status: 503, error: 'Saved views storage is not available.' }
  }

  const data = await db.savedView.upsert({
    where: {
      companyId_userId_workspace_name: {
        companyId,
        userId,
        workspace: input.workspace,
        name,
      },
    },
    create: {
      companyId,
      userId,
      workspace: input.workspace,
      name,
      query,
    },
    update: { query },
  })
  return { ok: true, data }
}

export async function deleteSavedView(
  db: SavedViewDb,
  companyId: string,
  userId: string,
  viewId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isValidUuid(viewId)) {
    return { ok: false, status: 400, error: 'Invalid saved view ID.' }
  }
  if (!db.savedView?.deleteMany) {
    return { ok: false, status: 503, error: 'Saved views storage is not available.' }
  }
  const res = await db.savedView.deleteMany({
    where: { id: viewId, companyId, userId },
  })
  if (res.count === 0) {
    return { ok: false, status: 404, error: 'Saved view not found.' }
  }
  return { ok: true }
}

