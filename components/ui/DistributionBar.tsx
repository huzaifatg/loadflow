import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, type StatusTone } from '@/lib/ui/status';

export interface DistributionSegment {
  key: string;
  label: string;
  count: number;
  tone: StatusTone;
  href?: string;
}

export interface DistributionBarProps {
  segments: DistributionSegment[];
  totalLabel?: string;
  emptyLabel?: string;
  className?: string;
}

export function DistributionBar({
  segments,
  totalLabel = 'Total',
  emptyLabel = 'No records yet',
  className,
}: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-500">{totalLabel}</span>
        <span className="font-bold text-gray-900 tabular-nums">{total}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 p-0.5 gap-0.5">
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-gray-200/70" />
        ) : (
          segments
            .filter((s) => s.count > 0)
            .map((seg) => {
              const widthPct = Math.max((seg.count / total) * 100, 4);
              const toneStyle = TONE_CLASSES[seg.tone];
              return (
                <div
                  key={seg.key}
                  style={{ width: `${widthPct}%` }}
                  title={`${seg.label}: ${seg.count}`}
                  className={cn(
                    'h-full first:rounded-l-full last:rounded-r-full transition-all duration-300',
                    toneStyle.bar
                  )}
                />
              );
            })
        )}
      </div>

      {/* Legend */}
      {total === 0 ? (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 sm:grid-cols-3">
          {segments.map((seg) => {
            const toneStyle = TONE_CLASSES[seg.tone];
            const content = (
              <div
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition-colors',
                  seg.href && 'hover:bg-gray-50'
                )}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      toneStyle.dot
                    )}
                  />
                  <span className="truncate text-gray-600">{seg.label}</span>
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {seg.count}
                </span>
              </div>
            );

            return seg.href ? (
              <Link key={seg.key} href={seg.href}>
                {content}
              </Link>
            ) : (
              <React.Fragment key={seg.key}>{content}</React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

