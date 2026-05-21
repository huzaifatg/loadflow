'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────── */
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

/* ── Skeleton rows ───────────────────────────────── */
function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <td key={colIdx} className="px-5 py-3.5">
              <div className="skeleton h-4 w-3/4 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ── Component ───────────────────────────────────── */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data to display.',
  loading = false,
  className,
}: DataTableProps<T>) {
  const isEmpty = !loading && data.length === 0;

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-gray-200 bg-white',
        className
      )}
    >
      <table className="w-full text-left text-sm">
        {/* Head */}
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <SkeletonRows columns={columns.length} />
          ) : isEmpty ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-16 text-center text-sm text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={(row.id as string | number) ?? idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors duration-100',
                  onRowClick &&
                    'cursor-pointer hover:bg-gray-50/80'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="whitespace-nowrap px-5 py-3.5 text-gray-700"
                  >
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
