import React from 'react';
import { cn } from '@/lib/utils';

/* ── Variant color map ───────────────────────────── */
type PillColorScheme = {
  bg: string;
  text: string;
  dot: string;
};

const colorSchemes: Record<string, PillColorScheme> = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
  },
};

/* ── Pre-configured status → color mappings ──────── */
const statusVariantMaps = {
  // Truck statuses
  AVAILABLE: 'emerald',
  IN_USE: 'blue',
  MAINTENANCE: 'amber',

  // Driver statuses
  ON_TRIP: 'blue',
  OFF_DUTY: 'gray',

  // Delivery statuses
  PENDING: 'amber',
  ALLOCATED: 'blue',
  IN_TRANSIT: 'indigo',
  DELIVERED: 'emerald',
  CANCELLED: 'rose',

  // Load plan statuses
  DRAFT: 'gray',
  CONFIRMED: 'blue',
  DISPATCHED: 'indigo',
  COMPLETED: 'emerald',
} as const;

/* ── Component ───────────────────────────────────── */
export interface StatusPillProps {
  status: string;
  /** Override the built-in color mapping */
  variantMap?: Record<string, string>;
  className?: string;
}

export function StatusPill({
  status,
  variantMap,
  className,
}: StatusPillProps) {
  const map = { ...statusVariantMaps, ...variantMap };
  const colorKey =
    (map as Record<string, string>)[status] ?? 'gray';
  const scheme = colorSchemes[colorKey] ?? colorSchemes.gray;

  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        scheme.bg,
        scheme.text,
        className
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', scheme.dot)}
        aria-hidden
      />
      {label}
    </span>
  );
}
