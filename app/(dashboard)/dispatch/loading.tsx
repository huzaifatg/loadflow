import React from 'react';

export default function DispatchBoardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 skeleton rounded" />
          <div className="h-7 w-64 skeleton rounded-lg" />
          <div className="h-4 w-96 max-w-full skeleton rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 skeleton rounded-lg" />
          <div className="h-9 w-28 skeleton rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
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

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-9 w-full skeleton rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="h-5 w-48 skeleton rounded" />
          <div className="h-24 w-full skeleton rounded-lg" />
          <div className="h-24 w-full skeleton rounded-lg" />
          <div className="h-24 w-full skeleton rounded-lg" />
        </div>
        <div className="xl:col-span-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="h-5 w-32 skeleton rounded" />
            <div className="h-36 w-full skeleton rounded-lg" />
            <div className="h-36 w-full skeleton rounded-lg" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="h-5 w-32 skeleton rounded" />
            <div className="h-36 w-full skeleton rounded-lg" />
            <div className="h-36 w-full skeleton rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
