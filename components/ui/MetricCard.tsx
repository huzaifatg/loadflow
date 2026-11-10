import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';
import type { StatusTone } from '@/lib/ui/status';

export interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: StatusTone;
  href?: string;
  className?: string;
}

const iconToneStyles: Record<StatusTone, string> = {
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  primary: 'bg-primary-50 text-primary-600 border-primary-100',
  accent: 'bg-primary-50 text-primary-600 border-primary-100',
  info: 'bg-sky-50 text-sky-600 border-sky-100',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  danger: 'bg-rose-50 text-rose-600 border-rose-100',
};

export function MetricCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'primary',
  href,
  className,
}: MetricCardProps) {
  const inner = (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-all',
        href && 'hover:border-primary-300 hover:shadow-sm',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {icon && (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              iconToneStyles[tone]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
          {value}
        </p>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-primary-600" />
        )}
      </div>

      {sublabel && (
        <p className="mt-1 text-xs text-gray-500 truncate">{sublabel}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl focus-visible:outline-none">
        {inner}
      </Link>
    );
  }

  return inner;
}
