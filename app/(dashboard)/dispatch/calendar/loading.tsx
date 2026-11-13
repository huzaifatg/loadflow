import React from 'react';

export default function DispatchCalendarLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-44 skeleton rounded" />
          <div className="h-7 w-64 skeleton rounded-lg" />
          <div className="h-4 w-96 max-w-full skeleton rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-56 skeleton rounded-lg" />
          <div className="h-9 w-32 skeleton rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 space-y-2"
          >
            <div className="h-3.5 w-24 skeleton rounded" />
            <div className="h-6 w-16 skeleton rounded" />
            <div className="h-3 w-28 skeleton rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[280px] rounded-xl border border-gray-200 bg-white p-3 space-y-3"
          >
            <div className="h-5 w-24 skeleton rounded" />
            <div className="h-24 w-full skeleton rounded-lg" />
            <div className="h-24 w-full skeleton rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
