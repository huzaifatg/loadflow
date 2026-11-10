// ─── Status presentation — single source of truth (Sprint 15) ──────────────
// Every status badge, chart segment and lifecycle indicator in the UI derives
// its label, tone and description from here. Pure module: no React, no DB.

import {
  validateTransition,
  isPlanEditable,
  isPlanDeletable,
} from '@/lib/services/load-plan-lifecycle';

export type StatusTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  description: string;
}

export const LOAD_PLAN_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: {
    label: 'Draft',
    tone: 'neutral',
    description: 'Being planned — deliveries, truck and driver can still change.',
  },
  READY: {
    label: 'Ready',
    tone: 'info',
    description: 'Locked and awaiting dispatch. Revert to Draft to edit.',
  },
  DISPATCHED: {
    label: 'Dispatched',
    tone: 'primary',
    description: 'Truck is on the road; deliveries are in transit.',
  },
  COMPLETED: {
    label: 'Completed',
    tone: 'success',
    description: 'All deliveries completed. Read-only.',
  },
};

export const DELIVERY_STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    label: 'Pending',
    tone: 'warning',
    description: 'Awaiting allocation to a load plan.',
  },
  ASSIGNED: {
    label: 'Assigned',
    tone: 'info',
    description: 'Allocated to a load plan that has not been dispatched.',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    tone: 'primary',
    description: 'On a dispatched load plan.',
  },
  DELIVERED: {
    label: 'Delivered',
    tone: 'success',
    description: 'Completed via its load plan.',
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'danger',
    description: 'Cancelled by a dispatcher.',
  },
};

export const TRUCK_STATUS_META: Record<string, StatusMeta> = {
  AVAILABLE: {
    label: 'Available',
    tone: 'success',
    description: 'Ready to be assigned to a load plan.',
  },
  IN_USE: {
    label: 'In Use',
    tone: 'primary',
    description: 'Currently assigned to a dispatched load plan.',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    tone: 'warning',
    description: 'Out of service — cannot be assigned or dispatched.',
  },
};

export const DRIVER_STATUS_META: Record<string, StatusMeta> = {
  AVAILABLE: {
    label: 'Available',
    tone: 'success',
    description: 'Ready to be assigned to a load plan.',
  },
  ON_TRIP: {
    label: 'On Trip',
    tone: 'primary',
    description: 'Currently driving a dispatched load plan.',
  },
  OFF_DUTY: {
    label: 'Off Duty',
    tone: 'neutral',
    description: 'Unavailable — cannot be assigned or dispatched.',
  },
};

export type StatusDomain = 'loadPlan' | 'delivery' | 'truck' | 'driver';

const DOMAIN_META: Record<StatusDomain, Record<string, StatusMeta>> = {
  loadPlan: LOAD_PLAN_STATUS_META,
  delivery: DELIVERY_STATUS_META,
  truck: TRUCK_STATUS_META,
  driver: DRIVER_STATUS_META,
};

const KNOWN_DOMAINS = new Set<string>(['loadPlan', 'delivery', 'truck', 'driver']);

/** Legacy/alias statuses seen in older data or components. */
const ALIASES: Record<string, string> = {
  ALLOCATED: 'ASSIGNED',
  CONFIRMED: 'READY',
};

/**
 * Resolve presentation metadata for a status.
 * Supports both `(domain, status)` and `(status, domain?)` call conventions.
 * Unknown or null statuses fall back to a neutral label and never throw.
 */
export function getStatusMeta(
  first?: string | null,
  second?: string | null
): StatusMeta {
  let domain: StatusDomain | undefined;
  let rawStatus: string | null | undefined;

  if (first && KNOWN_DOMAINS.has(first)) {
    domain = first as StatusDomain;
    rawStatus = second;
  } else {
    rawStatus = first;
    if (second && KNOWN_DOMAINS.has(second)) {
      domain = second as StatusDomain;
    }
  }

  if (!rawStatus) {
    return {
      label: 'Unknown',
      tone: 'neutral',
      description: 'Status not specified',
    };
  }

  const normalized = rawStatus.trim().toUpperCase();
  const key = ALIASES[normalized] ?? normalized;

  if (domain) {
    return (
      DOMAIN_META[domain][key] ?? {
        label: normalized.replace(/_/g, ' '),
        tone: 'neutral',
        description: '',
      }
    );
  }

  for (const d of ['loadPlan', 'delivery', 'truck', 'driver'] as StatusDomain[]) {
    const meta = DOMAIN_META[d][key];
    if (meta) return meta;
  }

  return {
    label: normalized.replace(/_/g, ' '),
    tone: 'neutral',
    description: '',
  };
}

/** Tailwind classes per tone. Kept here so badges, dots and charts agree. */
export const TONE_CLASSES: Record<
  StatusTone,
  { badge: string; dot: string; bar: string; text: string }
> = {
  neutral: {
    badge: 'bg-gray-100 text-gray-700 ring-gray-200',
    dot: 'bg-gray-400',
    bar: 'bg-gray-400',
    text: 'text-gray-700',
  },
  primary: {
    badge: 'bg-primary-50 text-primary-700 ring-primary-200',
    dot: 'bg-primary-600',
    bar: 'bg-primary-600',
    text: 'text-primary-700',
  },
  accent: {
    badge: 'bg-primary-50 text-primary-700 ring-primary-200',
    dot: 'bg-primary-600',
    bar: 'bg-primary-600',
    text: 'text-primary-700',
  },
  info: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    text: 'text-sky-700',
  },
  success: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
  },
  danger: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
  },
};

// ─── Load plan lifecycle presentation ──────────────────────────────────────

export const LIFECYCLE_STEPS = [
  {
    status: 'DRAFT',
    label: 'Draft',
    description: 'Editable — allocate deliveries and assign resources',
  },
  {
    status: 'READY',
    label: 'Ready',
    description: 'Locked and verified — awaiting truck dispatch',
  },
  {
    status: 'DISPATCHED',
    label: 'Dispatched',
    description: 'Truck in transit — deliveries on the road',
  },
  {
    status: 'COMPLETED',
    label: 'Completed',
    description: 'All deliveries fulfilled and resources released',
  },
] as const;

export interface PlanActionAvailability {
  canEdit: boolean;
  canMarkReady: boolean;
  canRevertToDraft: boolean;
  canDispatch: boolean;
  canComplete: boolean;
  canDelete: boolean;
}

/**
 * Actions the UI may offer for a plan in `status`. Derived from the same
 * lifecycle rules the server enforces (`lib/services/load-plan-lifecycle.ts`),
 * so the UI can never expose a transition the API would reject.
 */
export function getAvailablePlanActions(
  status?: string | null
): PlanActionAvailability {
  const s = status ?? '';
  return {
    canEdit: isPlanEditable(s),
    canMarkReady: validateTransition(s, 'READY').ok,
    canRevertToDraft: validateTransition(s, 'DRAFT').ok,
    canDispatch: validateTransition(s, 'DISPATCHED').ok,
    canComplete: validateTransition(s, 'COMPLETED').ok,
    canDelete: isPlanDeletable(s),
  };
}

/** Index of the current step in LIFECYCLE_STEPS (0..3), defaulting to 0. */
export function getLifecycleStepIndex(status?: string | null): number {
  const idx = LIFECYCLE_STEPS.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

// ─── Capacity presentation ─────────────────────────────────────────────────

export type CapacityLevel = 'low' | 'medium' | 'high' | 'over';

export function getCapacityLevel(
  current: number,
  max: number
): {
  pct: number;
  rounded: number;
  level: CapacityLevel;
  isOverweight: boolean;
} {
  if (!Number.isFinite(max) || max <= 0) {
    return { pct: 0, rounded: 0, level: 'low', isOverweight: false };
  }
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const rawPct = (safeCurrent / max) * 100;
  const rounded = Math.round(rawPct);
  const pct = Math.min(100, Math.max(0, rawPct));
  const isOverweight = safeCurrent > max;
  const level: CapacityLevel = isOverweight
    ? 'over'
    : rawPct >= 90
    ? 'high'
    : rawPct >= 70
    ? 'medium'
    : 'low';

  return { pct, rounded, level, isOverweight };
}

export const CAPACITY_TONE: Record<
  CapacityLevel,
  { bar: string; text: string; track: string }
> = {
  low: {
    bar: 'bg-primary-600',
    text: 'text-gray-700',
    track: 'bg-gray-100',
  },
  medium: {
    bar: 'bg-emerald-600',
    text: 'text-emerald-700',
    track: 'bg-emerald-50',
  },
  high: {
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    track: 'bg-amber-50',
  },
  over: {
    bar: 'bg-rose-600',
    text: 'text-rose-700',
    track: 'bg-rose-50',
  },
};
