'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationClientProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
}

export function PaginationClient({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
}: PaginationClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  if (totalPages <= 1 && (!totalItems || totalItems <= pageSize)) return null;

  const startItem = totalItems ? (currentPage - 1) * pageSize + 1 : null;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-gray-500 tabular-nums">
        {totalItems !== undefined && startItem !== null && endItem !== null ? (
          <>
            Showing <span className="font-semibold text-gray-800">{startItem}</span>–
            <span className="font-semibold text-gray-800">{endItem}</span> of{' '}
            <span className="font-semibold text-gray-800">{totalItems}</span> records
          </>
        ) : (
          <>
            Page <span className="font-semibold text-gray-800">{currentPage}</span> of{' '}
            <span className="font-semibold text-gray-800">{totalPages}</span>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="inline-flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => router.push(createPageURL(currentPage - 1))}
            disabled={currentPage <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Prev</span>
          </button>

          <div className="hidden sm:flex sm:items-center sm:gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => router.push(createPageURL(page))}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer',
                      isActive
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {page}
                  </button>
                );
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span
                    key={page}
                    className="inline-flex h-8 items-center px-1.5 text-xs text-gray-400"
                  >
                    …
                  </span>
                );
              }
              return null;
            })}
          </div>

          <button
            type="button"
            onClick={() => router.push(createPageURL(currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
