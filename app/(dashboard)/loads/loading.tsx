export default function LoadsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 skeleton rounded-lg" />
          <div className="h-4 w-64 skeleton rounded-lg mt-2" />
        </div>
        <div className="h-10 w-32 skeleton rounded-lg" />
      </div>
      <div className="space-y-8">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g}>
            <div className="h-4 w-36 skeleton rounded mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-16 skeleton rounded-full" />
                    <div className="h-4 w-12 skeleton rounded" />
                  </div>
                  <div className="h-4 w-28 skeleton rounded" />
                  <div className="h-3 w-20 skeleton rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
