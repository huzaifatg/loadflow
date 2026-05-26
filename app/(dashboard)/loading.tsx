export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="h-4 w-72 skeleton rounded-lg mt-2" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 skeleton rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 skeleton rounded" />
                <div className="h-6 w-16 skeleton rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables Skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 p-6">
            <div className="h-6 w-48 skeleton rounded mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-4">
                  <div className="h-10 w-10 skeleton rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 skeleton rounded" />
                    <div className="h-3 w-48 skeleton rounded" />
                  </div>
                  <div className="h-6 w-16 skeleton rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
