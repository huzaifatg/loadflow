import React from 'react';
import { cn } from '@/lib/utils';
import { getCapacityLevel, CAPACITY_TONE } from '@/lib/ui/status';

export interface CapacityBarProps {
  current: number;
  max: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  unit?: string;
  className?: string;
}

export function CapacityBar({
  current,
  max,
  size = 'md',
  showLabel = true,
  unit = 'kg',
  className,
}: CapacityBarProps) {
  const { pct, rounded, level, isOverweight } = getCapacityLevel(current, max);
  const colors = CAPACITY_TONE[level];

  if (max <= 0) {
    return (
      <div className={cn('text-xs text-gray-400', className)}>
        No capacity configured
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs tabular-nums">
          <span className="font-medium text-gray-700">
            {current.toLocaleString()} {unit}{' '}
            <span className="text-gray-400">
              / {max.toLocaleString()} {unit}
            </span>
          </span>
          <span className={cn('font-semibold', colors.text)}>
            {rounded}%{isOverweight ? ' (Over)' : ''}
          </span>
        </div>
      )}

      <div
        className={cn(
          'w-full overflow-hidden rounded-full',
          size === 'sm' ? 'h-1.5' : 'h-2',
          colors.track
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            colors.bar
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
