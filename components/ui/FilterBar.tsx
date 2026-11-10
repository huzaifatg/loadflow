'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface FilterTabOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterTabsProps {
  paramName?: string;
  options: FilterTabOption[];
  defaultValue?: string;
  className?: string;
}

export function FilterTabs({
  paramName = 'status',
  options,
  defaultValue = 'ALL',
  className,
}: FilterTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const current = searchParams.get(paramName) || defaultValue;

  const handleSelect = (val: string) => {
    const params = new URLSearchParams(searchParams);
    if (!val || val === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, val);
    }
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div
      role="tablist"
      aria-label={`Filter by ${paramName}`}
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-gray-100/80 p-1',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
              isActive
                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-gray-200/70 text-gray-600'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface FilterSelectProps {
  paramName: string;
  label?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
}

export function FilterSelect({
  paramName,
  label,
  options,
  defaultValue = 'ALL',
  className,
}: FilterSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const current = searchParams.get(paramName) || defaultValue;

  const handleChange = (val: string) => {
    const params = new URLSearchParams(searchParams);
    if (!val || val === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, val);
    }
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {label && (
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          {label}
        </span>
      )}
      <select
        aria-label={label || paramName}
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 rounded-lg border border-gray-300 bg-white px-3 pr-8 text-xs font-medium text-gray-700 shadow-xs transition-colors hover:border-gray-400 focus:border-primary-600 focus:outline-none focus:ring-3 focus:ring-primary-500/15 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ClearFiltersButton({
  paramNames = ['q', 'status', 'date', 'sort', 'view'],
}: {
  paramNames?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const hasActive = paramNames.some((key) => searchParams.has(key));
  if (!hasActive) return null;

  const handleClear = () => {
    const params = new URLSearchParams(searchParams);
    paramNames.forEach((key) => params.delete(key));
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <button
      type="button"
      onClick={handleClear}
      className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer"
    >
      <X className="h-3.5 w-3.5" />
      <span>Reset filters</span>
    </button>
  );
}

