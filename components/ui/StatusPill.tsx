import React from 'react';
import { StatusBadge } from '@/components/ui/Badge';
import type { StatusDomain } from '@/lib/ui/status';

/**
 * Backwards-compatible wrapper. All status rendering now goes through
 * StatusBadge (components/ui/Badge.tsx) and lib/ui/status.ts.
 * `variantMap` is accepted for API compatibility but intentionally ignored so
 * colours stay consistent across the app.
 */
export interface StatusPillProps {
  status: string;
  domain?: StatusDomain;
  /** @deprecated colours are centralised in lib/ui/status.ts */
  variantMap?: Record<string, string>;
  className?: string;
}

export function StatusPill({ status, domain, className }: StatusPillProps) {
  return <StatusBadge status={status} domain={domain} className={className} />;
}
