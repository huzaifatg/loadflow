import React from 'react';
import { cn } from '@/lib/utils';

export interface CapacityBarProps {
  current: number;
  max: number;
  className?: string;
}

export function CapacityBar({
  current,
  max,
  className,
}: CapacityBarProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const rounded = Math.round(pct);

  const barColor =
    pct > 85
      ? 'bg-rose-500'
      : pct >= 60
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const textColor =
    pct > 85
      ? 'text-rose-600'
      : pct >= 60
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <div className={cn('w-full', className)}>
      {/* Label */}
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-700">
          {current.toLocaleString()}kg{' '}
          <span className="text-gray-400">
            / {max.toLocaleString()}kg
          </span>
        </span>
        <span className={cn('font-semibold', textColor)}>
          {rounded}%
        </span>
      </div>

      {/* Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out animate-fill',
            barColor
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
