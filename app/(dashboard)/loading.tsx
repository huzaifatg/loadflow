export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200/80 pb-5">
        <div className="h-3.5 w-32 skeleton rounded mb-2" />
        <div className="h-7 w-64 skeleton rounded-lg" />
        <div className="h-4 w-96 skeleton rounded mt-2" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div className="h-3.5 w-24 skeleton rounded" />
              <div className="h-8 w-8 skeleton rounded-lg" />
            </div>
            <div className="mt-3 h-7 w-16 skeleton rounded" />
            <div className="mt-2 h-3 w-28 skeleton rounded" />
          </div>
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="h-5 w-48 skeleton rounded" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex items-center gap-4 py-2">
              <div className="h-9 w-9 skeleton rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 skeleton rounded" />
                <div className="h-3 w-48 skeleton rounded" />
              </div>
              <div className="h-6 w-20 skeleton rounded-md" />
            </div>
          ))}
        </div>
        <div className="xl:col-span-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="h-5 w-44 skeleton rounded" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex items-center gap-4 py-2">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-44 skeleton rounded" />
              </div>
              <div className="h-5 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
