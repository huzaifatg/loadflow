import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusMeta, TONE_CLASSES, type StatusDomain, type StatusTone } from '@/lib/ui/status';

/* ── Badge ───────────────────────────────────────── */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'neutral', dot = false, size = 'md', className, children, ...props }: BadgeProps) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-xs',
        t.badge,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

/* ── StatusBadge ─────────────────────────────────── */
export interface StatusBadgeProps {
  status?: string | null;
  /** Disambiguates statuses shared between domains (e.g. AVAILABLE). */
  domain?: StatusDomain;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The only component that renders lifecycle/resource status. Label, colour
 * and tooltip text come from lib/ui/status.ts. Status is conveyed by text as
 * well as colour (WCAG 1.4.1).
 */
export function StatusBadge({ status, domain, size = 'md', className }: StatusBadgeProps) {
  const meta = getStatusMeta(status, domain);
  return (
    <Badge tone={meta.tone} dot size={size} className={className} title={meta.description || undefined}>
      {meta.label}
    </Badge>
  );
}

