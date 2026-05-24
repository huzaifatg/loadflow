'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';

export function SearchClient({ placeholder = 'Search...' }: { placeholder?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [text, setText] = useState(searchParams.get('q') || '');
  const [query] = useDebounce(text, 500);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('q', query);
      params.delete('page'); // Reset page when searching
    } else {
      params.delete('q');
    }
    
    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();
    
    if (newQueryString !== currentQueryString) {
      router.replace(`${pathname}?${newQueryString}`);
    }
  }, [query, pathname, router, searchParams]);

  return (
    <div className="relative w-full max-w-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
      </div>
      <input
        type="text"
        name="search"
        id="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 shadow-sm"
        placeholder={placeholder}
      />
    </div>
  );
}
