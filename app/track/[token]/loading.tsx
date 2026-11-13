import React from 'react';
import { Truck } from 'lucide-react';

export default function PublicTrackingLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="h-7 w-28 animate-pulse rounded-full bg-gray-200" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-7 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-80 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 text-xs text-gray-400 sm:px-6">
          <span>Powered by LoadFlow</span>
          <span>Loading shipment status...</span>
        </div>
      </footer>
    </div>
  );
}
