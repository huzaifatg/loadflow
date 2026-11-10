'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { cn } from '@/lib/utils';

export function SearchClient({
  placeholder = 'Search...',
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [text, setText] = useState(searchParams.get('q') || '');
  const [query] = useDebounce(text, 350);

  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== text && query === urlQ) {
      setText(urlQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('q', query);
      params.delete('page');
    } else {
      params.delete('q');
    }

    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();

    if (newQueryString !== currentQueryString) {
      router.replace(newQueryString ? `${pathname}?${newQueryString}` : pathname);
    }
  }, [query, pathname, router, searchParams]);

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
      </div>
      <input
        type="search"
        name="search"
        aria-label={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="block h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 transition-colors hover:border-gray-400 focus:border-primary-600 focus:outline-none focus:ring-3 focus:ring-primary-500/15"
        placeholder={placeholder}
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
